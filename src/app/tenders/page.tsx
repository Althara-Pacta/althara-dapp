"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

interface Tender {
  id: number;
  description: string;
  budget: string;
  requirementsCid: string;
  government: string;
  isActive: boolean;
  createdAt: string;
  bidCount?: number;
  hasAcceptedBid?: boolean;
}

export default function TendersPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setRetryCount] = useState(0);
  const [isCached, setIsCached] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isSearching, setIsSearching] = useState(false);

  // Fetch all tenders efficiently - no wallet required
  useEffect(() => {
    const fetchTenders = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/tenders');
        const data = await response.json();
        
        if (data.success) {
          setTenders(data.tenders.reverse()); // Show newest first
          setIsCached(data.cached || false);
        } else {
          setError(data.error || "Failed to load tenders");
        }
      } catch (err) {
        console.error("Error fetching tenders:", err);
        setError("Failed to load tenders. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchTenders();
  }, []); // Remove dependency on totalTenders

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setError(null);
    setLoading(true);
    
    // Retry fetching
    setTimeout(() => {
      fetch('/api/tenders')
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            setTenders(data.tenders.reverse());
            setIsCached(data.cached || false);
          } else {
            setError(data.error || "Failed to load tenders");
          }
        })
        .catch(err => {
          console.error("Retry error:", err);
          setError("Failed to load tenders. Please try again.");
        })
        .finally(() => {
          setLoading(false);
        });
    }, 1000);
  };

  const formatBudget = (budget: string) => {
    return `${Number(budget) / 10 ** 18} ETH`;
  };

  const formatDate = (timestamp: string) => {
    if (!timestamp || timestamp === '') return 'Unknown';
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const parseDescription = (description: string) => {
    const parts = description.split('|');
    return {
      title: parts[0] || 'Untitled',
      description: parts[1] || 'No description',
      deadline: parts[2]?.replace('Deadline: ', '') || 'No deadline',
      status: parts[3]?.replace('Status: ', '') || 'Unknown'
    };
  };

  const getStatusColor = (status: string, hasAcceptedBid?: boolean) => {
    if (hasAcceptedBid) {
      return 'bg-purple-100 text-purple-800 border-purple-200';
    }
    
    switch (status.toLowerCase()) {
      case 'open':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'closed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'awarded':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const truncateAddress = (address: string | boolean) => {
    if (typeof address === 'string') {
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
    return 'Unknown';
  };

  // Handle search with debouncing
  useEffect(() => {
    if (searchTerm) {
      setIsSearching(true);
      const timer = setTimeout(() => {
        setIsSearching(false);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setIsSearching(false);
    }
  }, [searchTerm]);

  // Filter and search tenders
  const filteredTenders = tenders.filter(tender => {
    const parsed = parseDescription(tender.description);
    const matchesSearch = searchTerm === '' || 
      parsed.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      parsed.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      parsed.deadline.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || 
      parsed.status.toLowerCase() === filterStatus.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  // Remove wallet requirement for viewing tenders - anyone can browse
  // Wallet is only needed for creating tenders or bidding

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-lg border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center py-4">
            {/* Logo - Links to landing page */}
            <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
                             <div className="w-8 h-8 flex items-center justify-center">
                 <Image src="/althara pacta logo.png" alt="Althara Pacta" width={32} height={32} />
               </div>
              <span className="text-xl font-bold text-gray-900">Althara Pacta</span>
            </Link>
            
                         {/* Navigation Links */}
             <div className="flex items-center space-x-4">
               {!isConnected ? (
                 <button
                   onClick={() => router.push("/connect-wallet-vendor")}
                   className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                 >
                   Connect Wallet
                 </button>
               ) : (
                 <>
                   <Link 
                     href="/tenders/create-tender"
                     className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                   >
                     Create Tender
                   </Link>
                   <span className="text-sm text-blue-600">
                     Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
                   </span>
                 </>
               )}
             </div>
          </div>
        </div>
      </nav>

      <div className="py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
                         <h1 className="text-4xl font-bold text-black mb-3">All Tenders</h1>
             <p className="text-black text-lg max-w-2xl mx-auto">Browse all available tenders. Connect your wallet to submit bids. Each tender is stored securely on the blockchain.</p>
                         <div className="mt-4">
               <button
                 onClick={handleRetry}
                 className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
               >
                 Refresh Tenders
               </button>
             </div>
           </div>

           {/* Search and Filter Section */}
           <div className="mb-8 bg-gray-50 rounded-xl p-6">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               {/* Search Input */}
               <div className="relative">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                   {isSearching ? (
                     <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                   ) : (
                     <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                     </svg>
                   )}
                 </div>
                                   <input
                    type="text"
                    placeholder="Search tenders..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 placeholder-gray-500 transition-all duration-200"
                  />
               </div>

               {/* Status Filter */}
               <div>
                                   <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900"
                  >
                   <option value="all">All Status</option>
                   <option value="open">Open</option>
                   <option value="closed">Closed</option>
                   <option value="awarded">Awarded</option>
                   <option value="cancelled">Cancelled</option>
                 </select>
               </div>

               {/* Results Count */}
                               <div className="flex items-center justify-end">
                  <span className="text-sm text-gray-700 font-medium">
                    {filteredTenders.length} of {tenders.length} tenders
                  </span>
                </div>
             </div>
           </div>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600 text-lg">Loading tenders...</span>
            </div>
          )}

          {!loading && isCached && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
              <div className="flex items-center">
                <svg className="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-blue-800 text-sm">Showing cached data for faster loading</span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800">{error}</p>
              <button
                onClick={handleRetry}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Retry
              </button>
            </div>
          )}

                     {!loading && !error && filteredTenders.length === 0 && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
                             <h3 className="text-xl font-semibold text-gray-900 mb-2">
                 {tenders.length === 0 ? 'No Tenders Found' : 'No Matching Tenders'}
               </h3>
               <p className="text-gray-600">
                 {tenders.length === 0 
                   ? 'There are currently no tenders available. Check back later!' 
                   : 'Try adjusting your search or filter criteria.'
                 }
               </p>
            </div>
          )}

                     {!loading && !error && filteredTenders.length > 0 && (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {filteredTenders.map((tender) => {
                const parsed = parseDescription(tender.description);
                                 return (
                   <div key={tender.id} className="bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-200 p-6 hover:shadow-xl hover:scale-105 transition-all duration-300 transform">
                                         <div className="flex items-start justify-between mb-4">
                       <h3 className="text-lg font-semibold text-black line-clamp-2">{parsed.title}</h3>
                       <div className="flex flex-col items-end space-y-1">
                         <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(parsed.status, tender.hasAcceptedBid)}`}>
                           {tender.hasAcceptedBid ? 'Awarded' : parsed.status}
                         </span>
                         <span className="text-xs text-gray-500">
                           {tender.isActive ? 'Active' : 'Inactive'}
                         </span>
                         {tender.bidCount !== undefined && (
                           <span className="text-xs text-blue-600 font-medium">
                             {tender.bidCount} bid{tender.bidCount !== 1 ? 's' : ''}
                           </span>
                         )}
                       </div>
                     </div>

                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">{parsed.description}</p>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Budget:</span>
                        <span className="text-sm font-semibold text-green-600">{formatBudget(tender.budget)}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Deadline:</span>
                        <span className="text-sm text-gray-600">{parsed.deadline}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Government:</span>
                        <span className="text-sm text-gray-600 font-mono">{truncateAddress(tender.government)}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Created:</span>
                        <span className="text-sm text-gray-600">{formatDate(tender.createdAt)}</span>
                      </div>

                                                                                           {tender.requirementsCid && tender.requirementsCid !== '[object Object]' && tender.requirementsCid !== '' && tender.requirementsCid.length > 10 && (
                         <div className="pt-3 border-t border-gray-200">
                           <div className="flex items-center justify-between">
                             <span className="text-sm font-medium text-gray-700">Documents:</span>
                             <a
                               href={`https://ipfs.io/ipfs/${tender.requirementsCid}`}
                               target="_blank"
                               rel="noopener noreferrer"
                               className="text-xs text-blue-600 font-mono bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                             >
                               View Docs
                             </a>
                           </div>
                         </div>
                       )}
                    </div>

                    <div className="mt-6 pt-4 border-t border-gray-200 space-y-2">
                      {/* View Details Button - Always available */}
                      <button
                        className="w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium border border-gray-300"
                        onClick={() => {
                          router.push(`/tenders/${tender.id}`);
                        }}
                      >
                        View Details
                      </button>
                      
                      {/* Bid Button - Only for connected users */}
                      <button
                        className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        onClick={() => {
                          if (!isConnected) {
                            alert('Please connect your wallet to bid on this tender');
                            return;
                          }
                          // Navigate to tender details page
                          router.push(`/tenders/${tender.id}`);
                        }}
                      >
                        {isConnected ? 'Bid Now' : 'Connect Wallet to Bid'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
                     )}
         </div>
       </div>
     </div>
   </div>
   );
 }