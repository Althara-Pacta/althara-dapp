import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, getContract } from "viem";
import { sepolia } from "viem/chains";
import { tenderContractAddress, tenderContractABI } from "../../../../../lib/contracts/index";

const client = createPublicClient({
  chain: sepolia,
  transport: http(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenderId = parseInt(id);
    
    if (isNaN(tenderId) || tenderId < 0) {
      return NextResponse.json(
        { error: "Invalid tender ID" },
        { status: 400 }
      );
    }

    const contract = getContract({
      address: tenderContractAddress,
      abi: tenderContractABI,
      client,
    });

    // Get tender data from smart contract
    const tender = (await contract.read.getTenderInfo([BigInt(tenderId)])) as [
      string,
      bigint,
      string,
      boolean,
      bigint[],
      string,
      bigint
    ];

    if (!tender) {
      return NextResponse.json(
        { error: "Tender not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      tender: {
        id: tenderId,
        description: tender[0],
        budget: tender[1].toString(),
        requirementsCid: tender[2],
        completed: tender[3],
        isActive: !tender[3],
        bidCount: tender[4]?.length ?? 0,
        bidIds: tender[4]?.map((bidId) => bidId.toString()) ?? [],
        government: tender[5],
        createdAt: tender[6].toString(),
      },
    });

  } catch (error) {
    console.error("Error fetching tender:", error);
    return NextResponse.json(
      { error: "Failed to fetch tender" },
      { status: 500 }
    );
  }
}
