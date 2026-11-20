import React, { useState, useMemo } from 'react';
import { ClaimVoucher, UserProfile, CompanyEntity, ClaimStatus } from '../types';
import { COMPANIES, USERS } from '../data/mockData';
import { 
  Receipt, Clock, CheckCircle, XCircle, DollarSign, Search, 
  Filter, Building2, Printer, Eye, Trash2, ArrowUpRight, FileSpreadsheet,
  Check, AlertCircle
} from 'lucide-react';
import { db, CLAIMS_COLLECTION } from '../firebase';
import { deleteDoc, doc } from 'firebase/firestore';

interface DashboardProps {
  claims: ClaimVoucher[];
  currentUser: UserProfile;
  selectedEntityFilter: string;
  setSelectedEntityFilter: (entityId: string) => void;
  onSelectClaim: (claim: ClaimVoucher) => void;
  onDeleteClaim: (claimId: string) => void;
  onOpenExportModal: () => void;
  onOpenSubmitModal: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  claims,
  currentUser,
  selectedEntityFilter,
  setSelectedEntityFilter,
  onSelectClaim,
  onDeleteClaim,
  onOpenExportModal,
  onOpenSubmitModal
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [bannerMsg, setBannerMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filtered claims
  const filteredClaims = useMemo(() => {
    return claims.filter(c => {
      const matchEntity = selectedEntityFilter === 'all' || c.companyId === selectedEntityFilter;
      const matchStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchSearch = searchQuery === '' || 
        c.voucherNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.payTo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.items.some(item => 
          item.merchant.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.particulars.toLowerCase().includes(searchQuery.toLowerCase())
        );
      return matchEntity && matchStatus && matchSearch;
    });
  }, [claims, selectedEntityFilter, statusFilter, searchQuery]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const total = claims.length;
    const pending = claims.filter(c => c.status === 'pending').length;
    const approved = claims.filter(c => c.status === 'approved').length;
    const paid = claims.filter(c => c.status === 'paid').length;
    const totalAmount = claims
      .filter(c => c.status !== 'rejected')
      .reduce((sum, c) => sum + c.totalAmountRM, 0);
    return { total, pending, approved, paid, totalAmount };
  }, [claims]);

  const getStatusBadge = (status: ClaimStatus) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800"><Clock className="w-3 h-3 mr-1" /> Pending Approval</span>;
      case 'approved':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><CheckCircle className="w-3 h-3 mr-1" /> Approved</span>;
      case 'paid':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"><DollarSign className="w-3 h-3 mr-1" /> Paid</span>;
      case 'rejected':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-800"><XCircle className="w-3 h-3 mr-1" /> Rejected</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {bannerMsg && (
        <div className={`p-4 rounded-xl text-sm flex items-center space-x-2 border ${
          bannerMsg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          {bannerMsg.type === 'success' ? <Check className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
          <span className="font-semibold">{bannerMsg.text}</span>
        </div>
      )}
      
      {/* Welcome & Quick Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Expense Claims & Payment Vouchers</h1>
          <p className="text-sm text-slate-600">
            Manage multi-entity staff claims, Gemini OCR receipt extraction, and A4 payment vouchers.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {currentUser.role !== 'staff' && (
            <button
              onClick={onOpenExportModal}
              className="inline-flex items-center space-x-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium shadow-2xs transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export Accounting CSV</span>
            </button>
          )}
          <button
            onClick={onOpenSubmitModal}
            className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition"
          >
            <span>+ Submit New Claim</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Claims</span>
            <Receipt className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{metrics.total}</div>
          <div className="text-xs text-slate-500 mt-1">Across all 5 entities</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Pending</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-2">{metrics.pending}</div>
          <div className="text-xs text-slate-500 mt-1">Awaiting partner approval</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Approved</span>
            <CheckCircle className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-600 mt-2">{metrics.approved}</div>
          <div className="text-xs text-slate-500 mt-1">Ready for payment voucher</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Paid / Settled</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">{metrics.paid}</div>
          <div className="text-xs text-slate-500 mt-1">Completed vouchers</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Total Value (RM)</span>
            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">MYR</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            RM {metrics.totalAmount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-1">Approved & pending claims</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search voucher no, payee, merchant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          
          {/* Entity Filter */}
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-slate-500 hidden sm:inline" />
            <select
              value={selectedEntityFilter}
              onChange={(e) => setSelectedEntityFilter(e.target.value)}
              className="text-sm bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All 5 Entities / Departments</option>
              {COMPANIES.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-500 hidden sm:inline" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

        </div>
      </div>

      {/* Claims Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 text-slate-700 text-xs font-semibold uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-6 py-3 text-left">Voucher No. & Date</th>
                <th scope="col" className="px-6 py-3 text-left">Entity / Department</th>
                <th scope="col" className="px-6 py-3 text-left">Payee / Claimant</th>
                <th scope="col" className="px-6 py-3 text-left">Particulars / Merchants</th>
                <th scope="col" className="px-6 py-3 text-right">Amount (RM)</th>
                <th scope="col" className="px-6 py-3 text-center">Status</th>
                <th scope="col" className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200 text-sm">
              {filteredClaims.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <AlertCircle className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <p className="font-medium">No claims or payment vouchers found.</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or click "+ Submit New Claim".</p>
                  </td>
                </tr>
              ) : (
                filteredClaims.map((claim) => {
                  const company = COMPANIES.find(c => c.id === claim.companyId);
                  const claimant = USERS.find(u => u.id === claim.claimantId);
                  return (
                    <tr key={claim.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900">{claim.voucherNo}</div>
                        <div className="text-xs text-slate-500">{claim.voucherDate}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-semibold text-slate-800 line-clamp-1">{company?.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{company?.regNo}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs font-medium text-slate-900">{claim.payTo}</div>
                        <div className="text-[10px] text-slate-500">{claimant?.email || 'Staff'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-slate-900 font-medium">
                          {claim.items[0]?.merchant} {claim.items.length > 1 ? `(+${claim.items.length - 1} more)` : ''}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">
                          {claim.items[0]?.particulars}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-mono font-bold text-slate-900">
                        RM {claim.totalAmountRM.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {getStatusBadge(claim.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium space-x-2">
                        <button
                          onClick={() => onSelectClaim(claim)}
                          className="inline-flex items-center space-x-1 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 px-3 py-1.5 rounded-lg transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{currentUser.role === 'admin' ? 'Process / Voucher' : 'View Voucher'}</span>
                        </button>
                        {currentUser.role === 'admin' && (
                          <div className="inline-flex items-center space-x-1.5 ml-2">
                            {confirmDeleteId === claim.id ? (
                              <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    try {
                                      await onDeleteClaim(claim.id);
                                      setBannerMsg({ type: 'success', text: 'Claim deleted successfully.' });
                                      setConfirmDeleteId(null);
                                      setTimeout(() => setBannerMsg(null), 4000);
                                    } catch (err: any) {
                                      setBannerMsg({ type: 'error', text: `Failed to delete claim: ${err.message || err}` });
                                      setConfirmDeleteId(null);
                                      setTimeout(() => setBannerMsg(null), 5000);
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-semibold transition shadow-2xs"
                                >
                                  Confirm Delete
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setConfirmDeleteId(null);
                                  }}
                                  className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[11px] font-semibold transition"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setConfirmDeleteId(claim.id);
                                }}
                                className="text-slate-400 hover:text-rose-600 p-1.5 transition"
                                title="Delete Claim"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
