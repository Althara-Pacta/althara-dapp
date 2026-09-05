"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { parseEther, formatEther } from "viem";
import { 
  tenderContractAddress, 
  tenderContractABI, 
  bidSubmissionContractAddress, 
  bidSubmissionContractABI 
} from "../../../../lib/contracts/index";

interface TenderDetails {
  description: string;
  budget: bigint;
  requirementsCid: string;
  completed: boolean;
  bidIds: readonly bigint[];
  creator: string;
  createdAt: bigint;
}

interface BidDetails {
  id?: number;
  tenderId: bigint;
  vendor: string;
  price: bigint;
  description: string;
  proposalCid: string;
  status: number;
  submittedAt: bigint;
}

export default function TenderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const tenderId = params.id as string;

  // State management
  const [tender, setTender] = useState<TenderDetails | null>(null);
  const [bids, setBids] = useState<BidDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVendor, setIsVendor] = useState(false);
  const [isGovernment, setIsGovernment] = useState(false);
  const [showBidForm, setShowBidForm] = useState(false);
  const [bidFormData, setBidFormData] = useState({
    price: "",
    description: "",
    proposalFile: null as File | null,
  });
  const [uploadingFile, setUploadingFile] = useState(false);
  const [submittingBid, setSubmittingBid] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [acceptingBid, setAcceptingBid] = useState<number | null>(null);
  const [showAcceptConfirmation, setShowAcceptConfirmation] = useState<number | null>(null);

  // Contract reads
  const { data: tenderData, error: tenderError } = useReadContract({
    address: tenderContractAddress,
    abi: tenderContractABI,
    functionName: "getTenderInfo",
    args: [BigInt(tenderId)],
    query: {
      enabled: !!tenderId,
    },
  });

  // Vendor role check removed as it's not being used

  const { data: governmentRole } = useReadContract({
    address: tenderContractAddress,
    abi: tenderContractABI,
    functionName: "hasRole",
    args: ["0x0000000000000000000000000000000000000000000000000000000000000000", address as `0x${string}`], // GOVERNMENT_ROLE
    query: {
      enabled: !!address,
    },
  });

  const { data: serviceFee } = useReadContract({
    address: bidSubmissionContractAddress,
    abi: bidSubmissionContractABI,
    functionName: "serviceFee",
  });

  // Contract writes
  const { writeContract: submitBid, data: submitBidData } = useWriteContract();

  const { writeContract: markComplete, data: markCompleteData } = useWriteContract();

  const { writeContract: acceptBid, data: acceptBidData } = useWriteContract();

  // Handle transaction success/error states
  useEffect(() => {
    if (submitBidData) {
      setSubmittingBid(false);
      setShowBidForm(false);
      setBidFormData({ price: "", description: "", proposalFile: null });
      // Refresh tender data
      window.location.reload();
    }
  }, [submitBidData]);

  useEffect(() => {
    if (markCompleteData) {
      // Refresh tender data
      window.location.reload();
    }
  }, [markCompleteData]);

  useEffect(() => {
    if (acceptBidData) {
      // Bid was accepted successfully, now mark the tender as complete
      markComplete({
        address: tenderContractAddress,
        abi: tenderContractABI,
        functionName: "markTenderComplete",
        args: [BigInt(tenderId)]
      });
      
      setAcceptingBid(null);
    }
  }, [acceptBidData, markComplete, tenderId]);

  // Parse tender data
  useEffect(() => {
    if (tenderData) {
      const [description, budget, requirementsCid, completed, bidIds, creator, createdAt] = tenderData;
      setTender({
        description,
        budget,
        requirementsCid,
        completed,
        bidIds,
        creator,
        createdAt,
      });
    } else if (tenderError) {
      setError("Failed to load tender details");
      setLoading(false);
    }
  }, [tenderData, tenderError]);

  // Check user roles
  useEffect(() => {
    if (address) {
      // For now, assume any connected user who is not government can be a vendor
      // In a real implementation, you might want to check for a specific VENDOR_ROLE
      setIsVendor(!governmentRole && isConnected);
      setIsGovernment(!!governmentRole);
    } else {
      setIsVendor(false);
      setIsGovernment(false);
    }
  }, [address, governmentRole, isConnected]);

  // Fetch bids
  useEffect(() => {
    const fetchBids = async () => {
      if (!tender?.bidIds || tender.bidIds.length === 0) {
        setBids([]);
        setLoading(false);
        return;
      }

      try {
        const bidPromises = tender.bidIds.map(async (bidId) => {
          const response = await fetch(`/api/bids/${bidId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.bid) {
              return {
                id: Number(data.bid.id),
                tenderId: BigInt(data.bid.tenderId),
                vendor: data.bid.vendor,
                price: BigInt(data.bid.price),
                description: data.bid.description,
                proposalCid: data.bid.proposalCid,
                status: Number(data.bid.status),
                submittedAt: BigInt(data.bid.submittedAt),
              };
            }
          }
          return null;
        });

        const bidResults = await Promise.all(bidPromises);
        const validBids = bidResults.filter(bid => bid !== null);
        setBids(validBids);
      } catch (error) {
        console.error("Error fetching bids:", error);
        setError("Failed to fetch bids");
      } finally {
        setLoading(false);
      }
    };

    if (tender) {
      fetchBids();
    } else if (!tenderData && !tenderError) {
      // Still loading tender data
      setLoading(true);
    }
  }, [tender, tenderData, tenderError]);

  // Handle file upload
  const handleFileUpload = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/upload-document", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Upload failed");
    }

    const result = await response.json();
    return result.cid;
  };

  // Handle bid submission
  const handleBidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!bidFormData.price || !bidFormData.description || !bidFormData.proposalFile) {
      setError("Please fill in all fields and upload a proposal document");
      return;
    }

    // Show confirmation modal
    setShowConfirmation(true);
  };

  // Handle confirmed bid submission
  const handleConfirmedBidSubmit = async () => {
    try {
      setSubmittingBid(true);
      setError(null);
      setShowConfirmation(false);

      // Upload proposal document
      setUploadingFile(true);
      const proposalCid = await handleFileUpload(bidFormData.proposalFile!);
      setUploadingFile(false);

      // Submit bid to smart contract
      const priceInWei = parseEther(bidFormData.price);
      const serviceFeeInWei = serviceFee || parseEther("0.005");

      submitBid({
        address: bidSubmissionContractAddress,
        abi: bidSubmissionContractABI,
        functionName: "submitBid",
        args: [BigInt(tenderId), priceInWei, bidFormData.description, proposalCid],
        value: serviceFeeInWei,
      });

    } catch (error) {
      setSubmittingBid(false);
      setUploadingFile(false);
      setError(error instanceof Error ? error.message : "Failed to submit bid");
    }
  };

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBidFormData(prev => ({ ...prev, proposalFile: file }));
    }
  };

  // Handle bid acceptance
  const handleAcceptBid = (bidIndex: number) => {
    setShowAcceptConfirmation(bidIndex);
  };

  const handleConfirmedAcceptBid = async (bidIndex: number) => {
    try {
      setAcceptingBid(bidIndex);
      setShowAcceptConfirmation(null);
      setError(null);
      
      const selectedBid = bids[bidIndex];
      
      // First, accept the bid in the bid submission contract
      acceptBid({
        address: bidSubmissionContractAddress,
        abi: bidSubmissionContractABI,
        functionName: "acceptBid",
        args: [BigInt(tenderId), tender?.bidIds[bidIndex] ?? BigInt(selectedBid.id ?? selectedBid.tenderId)],
      });
      
    } catch (error) {
      console.error("Error accepting bid:", error);
      setError("Failed to accept bid. Please try again.");
      setAcceptingBid(null);
    }
  };

  // Parse tender description (assuming it contains title and deadline)
  const parseTenderDescription = (description: string) => {
    // Simple parsing - you might need to adjust based on your data format
    const lines = description.split('\n');
    return {
      title: lines[0] || "Untitled Tender",
      details: lines.slice(1).join('\n') || description,
    };
  };

  // Format timestamp
  const formatTimestamp = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Get bid status string
  const getBidStatus = (status: number) => {
    switch (status) {
      case 0: return "Pending";
      case 1: return "Accepted";
      case 2: return "Rejected";
      default: return "Unknown";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tender details...</p>
        </div>
      </div>
    );
  }

  // Show connection banner if not connected - but allow viewing tender details
  const showConnectionBanner = !isConnected;

  if (error || tenderError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <p className="font-bold">Error</p>
            <p>{error || "Failed to load tender details"}</p>
            <button
              onClick={() => router.push("/tenders")}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Back to Tenders
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!tender) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
            <p className="font-bold">Tender Not Found</p>
            <p>The tender you&apos;re looking for doesn&apos;t exist.</p>
            <button
              onClick={() => router.push("/tenders")}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Back to Tenders
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { title, details } = parseTenderDescription(tender.description);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Government Portal</h1>
              <p className="text-blue-100">Althara Pacta - Decentralized Tender Management</p>
              <p className="text-blue-200 text-sm">Tender ID: {tenderId}</p>
            </div>
            <button
              onClick={() => router.push("/tenders")}
              className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-lg transition-colors"
            >
              ← Back to Tenders
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Connection Banner */}
        {showConnectionBanner && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="text-yellow-800 font-medium">Wallet Not Connected</span>
              </div>
              <button
                onClick={() => router.push("/connect-wallet-vendor")}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Connect Wallet
              </button>
            </div>
            <p className="text-yellow-700 text-sm mt-2">
              Connect your wallet to submit bids and access full functionality.
            </p>
          </div>
        )}
        {/* Tender Details Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Tender Details</h2>
            <div className="flex items-center space-x-2">
              {tender.completed ? (
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                  Completed
                </span>
              ) : (
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  Active
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-gray-600 mb-4 whitespace-pre-wrap">{details}</p>
              
              <div className="space-y-3">
                <div>
                  <span className="font-medium text-gray-700">Budget:</span>
                  <span className="ml-2 text-lg font-semibold text-blue-600">
                    {formatEther(tender.budget)} ETH
                  </span>
                </div>
                
                <div>
                  <span className="font-medium text-gray-700">Government Address:</span>
                  <span className="ml-2 text-sm font-mono text-gray-600">
                    {tender.creator}
                  </span>
                </div>
                
                <div>
                  <span className="font-medium text-gray-700">Created:</span>
                  <span className="ml-2 text-gray-600">
                    {formatTimestamp(tender.createdAt)}
                  </span>
                </div>
                
                <div>
                  <span className="font-medium text-gray-700">Total Bids:</span>
                  <span className="ml-2 text-gray-600">
                    {tender.bidIds.length}
                  </span>
                </div>
              </div>
            </div>

                                                   <div>
                {tender.requirementsCid && tender.requirementsCid !== '[object Object]' && tender.requirementsCid !== '' && tender.requirementsCid.length > 10 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-700 mb-2">Official Documents</h4>
                    <a
                      href={`https://ipfs.io/ipfs/${tender.requirementsCid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      View Official Documents
                    </a>
                    <p className="text-xs text-gray-500 mt-1">CID: {tender.requirementsCid}</p>
                  </div>
                )}


            </div>
          </div>
        </div>

        {/* Bids Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                     <div className="flex items-center justify-between mb-6">
             <h3 className="text-xl font-bold text-gray-900">Bids ({bids.length})</h3>
             <div className="flex space-x-2">
               <button
                 onClick={() => window.location.reload()}
                 className="bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm"
               >
                 Refresh
               </button>
               {isVendor && !tender.completed && (
                 <button
                   onClick={() => setShowBidForm(!showBidForm)}
                   className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                 >
                   {showBidForm ? "Cancel" : "Submit Bid"}
                 </button>
               )}
             </div>
           </div>

          {/* Bid Submission Form */}
          {showBidForm && isVendor && !tender.completed && (
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Submit Your Bid</h4>
              <form onSubmit={handleBidSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bid Price (ETH)
                  </label>
                                     <input
                     type="number"
                     step="0.001"
                     min="0"
                     value={bidFormData.price}
                     onChange={(e) => setBidFormData(prev => ({ ...prev, price: e.target.value }))}
                     className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500"
                     placeholder="0.0"
                     required
                   />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bid Description
                  </label>
                                     <textarea
                     value={bidFormData.description}
                     onChange={(e) => setBidFormData(prev => ({ ...prev, description: e.target.value }))}
                     className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500"
                     rows={4}
                     placeholder="Describe your proposal and approach..."
                     required
                   />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Proposal Document
                  </label>
                                     <input
                     type="file"
                     onChange={handleFileChange}
                     accept=".pdf,.doc,.docx,.txt"
                     className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                     required
                   />
                  <p className="text-sm text-gray-500 mt-1">
                    Supported formats: PDF, DOC, DOCX, TXT (max 10MB)
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Service Fee:</strong> {serviceFee ? formatEther(serviceFee) : "0.005"} ETH
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    This fee covers the cost of processing your bid on the blockchain.
                  </p>
                </div>

                <div className="flex space-x-4">
                  <button
                    type="submit"
                    disabled={submittingBid || uploadingFile}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submittingBid ? "Submitting..." : uploadingFile ? "Uploading..." : "Submit Bid"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBidForm(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

                     {/* Bids List */}
           {bids.length === 0 ? (
             <div className="text-center py-8">
               <p className="text-gray-500">No bids submitted yet.</p>
               {!isVendor && !tender.completed && (
                 <p className="text-sm text-gray-400 mt-2">
                   Connect your wallet as a vendor to submit a bid.
                 </p>
               )}
             </div>
           ) : (
             <div className="space-y-4">
               {bids.map((bid, index) => (
                 <div key={index} className="border border-gray-200 rounded-lg p-4">
                   <div className="flex items-center justify-between mb-3">
                     <div>
                       <h5 className="font-semibold text-gray-900">
                         Bid from {bid.vendor.slice(0, 6)}...{bid.vendor.slice(-4)}
                       </h5>
                       <p className="text-sm text-gray-500">
                         Submitted: {formatTimestamp(bid.submittedAt)}
                       </p>
                     </div>
                     <div className="text-right">
                       <div className="text-lg font-bold text-blue-600">
                         {formatEther(bid.price)} ETH
                       </div>
                       <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                         bid.status === 1 ? 'bg-green-100 text-green-800' :
                         bid.status === 2 ? 'bg-red-100 text-red-800' :
                         'bg-yellow-100 text-yellow-800'
                       }`}>
                         {getBidStatus(bid.status)}
                       </span>
                     </div>
                   </div>
                   
                   <p className="text-gray-600 mb-3">{bid.description}</p>
                   
                                       <div className="flex items-center justify-between">
                      {bid.proposalCid && bid.proposalCid !== '[object Object]' && bid.proposalCid !== '' && bid.proposalCid.length > 10 && (
                        <a
                          href={`https://ipfs.io/ipfs/${bid.proposalCid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          View Proposal Document
                        </a>
                      )}
                     
                     {/* Accept Bid Button for Government Users */}
                     {isGovernment && !tender.completed && bid.status === 0 && (
                       <button
                         onClick={() => handleAcceptBid(index)}
                         disabled={acceptingBid === index}
                         className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
                       >
                         {acceptingBid === index ? "Processing..." : "Accept Bid"}
                       </button>
                     )}
                     
                     {/* Show accepted status */}
                     {bid.status === 1 && (
                       <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium">
                         Accepted
                       </span>
                     )}
                     
                     {/* Show rejected status */}
                     {bid.status === 2 && (
                       <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-medium">
                         Rejected
                       </span>
                     )}
                   </div>
                 </div>
               ))}
             </div>
           )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            <p className="font-bold">Error</p>
            <p>{error}</p>
          </div>
        )}

                 {/* Bid Submission Confirmation Modal */}
         {showConfirmation && (
           <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
             <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
               <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Bid Submission</h3>
               <div className="space-y-3 mb-6">
                 <p className="text-gray-600">
                   <strong>Bid Price:</strong> {bidFormData.price} ETH
                 </p>
                 <p className="text-gray-600">
                   <strong>Service Fee:</strong> {serviceFee ? formatEther(serviceFee) : "0.005"} ETH
                 </p>
                 <p className="text-gray-600">
                   <strong>Total Cost:</strong> {(parseFloat(bidFormData.price) + (serviceFee ? parseFloat(formatEther(serviceFee)) : 0.005)).toFixed(6)} ETH
                 </p>
               </div>
               <div className="flex space-x-4">
                 <button
                   onClick={handleConfirmedBidSubmit}
                   disabled={submittingBid}
                   className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                 >
                   {submittingBid ? "Submitting..." : "Confirm & Submit"}
                 </button>
                 <button
                   onClick={() => setShowConfirmation(false)}
                   disabled={submittingBid}
                   className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                 >
                   Cancel
                 </button>
               </div>
             </div>
           </div>
         )}

         {/* Accept Bid Confirmation Modal */}
         {showAcceptConfirmation !== null && (
           <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
             <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
               <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Bid Acceptance</h3>
               <div className="space-y-3 mb-6">
                 <p className="text-gray-600">
                   <strong>Bid Price:</strong> {formatEther(bids[showAcceptConfirmation].price)} ETH
                 </p>
                 <p className="text-gray-600">
                   <strong>Vendor:</strong> {bids[showAcceptConfirmation].vendor.slice(0, 6)}...{bids[showAcceptConfirmation].vendor.slice(-4)}
                 </p>
                 <p className="text-gray-600">
                   <strong>Description:</strong> {bids[showAcceptConfirmation].description.substring(0, 100)}...
                 </p>
                 <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                   <p className="text-yellow-800 text-sm">
                     <strong>Note:</strong> This will:
                   </p>
                   <ul className="text-yellow-800 text-sm mt-2 list-disc list-inside">
                     <li>Accept the selected bid</li>
                     <li>Close the tender (mark as completed)</li>
                     <li>Trigger a payment transaction of {formatEther(bids[showAcceptConfirmation].price)} ETH from government to vendor</li>
                   </ul>
                 </div>
               </div>
               <div className="flex space-x-4">
                 <button
                   onClick={() => handleConfirmedAcceptBid(showAcceptConfirmation)}
                   disabled={acceptingBid === showAcceptConfirmation}
                   className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                 >
                   {acceptingBid === showAcceptConfirmation ? "Processing..." : "Accept Bid & Close Tender"}
                 </button>
                 <button
                   onClick={() => setShowAcceptConfirmation(null)}
                   disabled={acceptingBid === showAcceptConfirmation}
                   className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                 >
                   Cancel
                 </button>
               </div>
             </div>
           </div>
         )}
      </div>
    </div>
  );
}
