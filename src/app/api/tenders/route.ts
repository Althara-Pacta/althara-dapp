import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, getContract } from "viem";
import { sepolia } from "viem/chains";
import { tenderContractAddress, tenderContractABI } from "../../../../lib/contracts/index";

const client = createPublicClient({
  chain: sepolia,
  transport: http(),
});

// Simple in-memory cache (in production, consider using Redis or similar)
let tenderCache: {
  data: unknown;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  try {
    // Check cache first
    if (tenderCache && Date.now() - tenderCache.timestamp < CACHE_DURATION) {
      return NextResponse.json({
        success: true,
        tenders: tenderCache.data,
        cached: true,
      });
    }

    const contract = getContract({
      address: tenderContractAddress,
      abi: tenderContractABI,
      client,
    });

    // Get total number of tenders with timeout
    const totalTenders = await Promise.race([
      contract.read.getTenderCount(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 10000)
      )
    ]);
    
    const total = Number(totalTenders);

    if (total === 0) {
      const emptyResult = { success: true, tenders: [] };
      tenderCache = { data: [], timestamp: Date.now() };
      return NextResponse.json(emptyResult);
    }

    // Handle case where there might be tenders but they're not accessible
    if (total > 0) {
      try {
        // Try to get the first tender to see if it exists (start from ID 1)
        await contract.read.getTenderInfo([BigInt(1)]);
      } catch (error) {
        // If first tender doesn't exist, return empty array
        if (error instanceof Error && error.message.includes('InvalidTenderId')) {
          const emptyResult = { success: true, tenders: [] };
          tenderCache = { data: [], timestamp: Date.now() };
          return NextResponse.json(emptyResult);
        }
        throw error; // Re-throw other errors
      }
    }

    // Fetch all tenders efficiently with timeout and batch processing
    const tenderPromises = [];
    const batchSize = 10; // Process in batches to avoid overwhelming the RPC
    
    for (let i = 0; i < total; i += batchSize) {
      const batch = [];
      for (let j = 0; j < batchSize && i + j < total; j++) {
        batch.push(contract.read.getTenderInfo([BigInt(i + j + 1)])); // Start from ID 1
      }
      tenderPromises.push(Promise.all(batch));
    }

    // Process batches with timeout
    const batchResults = await Promise.race([
      Promise.all(tenderPromises),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout fetching tenders')), 30000)
      )
    ]) as unknown[][];
    
    // Flatten results
    const tenderResults = batchResults.flat();
    
    const tenders = tenderResults.map((tender: unknown, index: number) => {
      const tenderData = tender as [string, bigint, string, boolean, bigint[], string, bigint];
      return {
        id: index + 1, // Use actual tender ID (starting from 1)
        description: tenderData[0],
        budget: tenderData[1].toString(),
        requirementsCid: tenderData[2],
        completed: tenderData[3],
        isActive: !tenderData[3],
        bidCount: tenderData[4]?.length ?? 0,
        hasAcceptedBid: tenderData[3],
        government: tenderData[5],
        createdAt: tenderData[6].toString(),
      };
    });

    // Update cache
    tenderCache = { data: tenders, timestamp: Date.now() };

    return NextResponse.json({
      success: true,
      tenders,
      cached: false,
    });

  } catch (error) {
    console.error("Error fetching tenders:", error);
    
    // Return cached data if available, even if expired
    if (tenderCache) {
      return NextResponse.json({
        success: true,
        tenders: tenderCache.data,
        cached: true,
        warning: "Using cached data due to blockchain timeout",
      });
    }
    
    return NextResponse.json(
      { 
        error: "Failed to fetch tenders. Please try again later.",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Invalidate cache when new tender is created
    if (body.action === 'invalidate-cache') {
      tenderCache = null;
      return NextResponse.json({ success: true, message: 'Cache invalidated' });
    }


    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Error in POST /api/tenders:", error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
