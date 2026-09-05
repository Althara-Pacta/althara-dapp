import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, getContract } from "viem";
import { sepolia } from "viem/chains";
import { bidSubmissionContractAddress, bidSubmissionContractABI } from "../../../../../lib/contracts/index";

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
    const bidId = parseInt(id);
    
    if (isNaN(bidId) || bidId < 0) {
      return NextResponse.json(
        { error: "Invalid bid ID" },
        { status: 400 }
      );
    }

    const contract = getContract({
      address: bidSubmissionContractAddress,
      abi: bidSubmissionContractABI,
      client,
    });

    // Get bid data from smart contract
    const bid = (await contract.read.getBidInfo([BigInt(bidId)])) as [
      bigint,
      string,
      bigint,
      string,
      string,
      number,
      bigint
    ];

    if (!bid) {
      return NextResponse.json(
        { error: "Bid not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      bid: {
        id: bidId,
        tenderId: bid[0].toString(),
        vendor: bid[1],
        price: bid[2].toString(),
        description: bid[3],
        proposalCid: bid[4],
        status: bid[5],
        submittedAt: bid[6].toString(),
      },
    });

  } catch (error) {
    console.error("Error fetching bid:", error);
    return NextResponse.json(
      { error: "Failed to fetch bid" },
      { status: 500 }
    );
  }
}
