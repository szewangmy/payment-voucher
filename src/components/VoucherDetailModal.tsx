import React, { useState } from 'react';
import { ClaimVoucher, UserProfile, ClaimStatus } from '../types';
import { COMPANIES, GL_ACCOUNTS } from '../data/mockData';
import { 
  X, Printer, CheckCircle, XCircle, DollarSign, Clock, 
  Building2, Receipt, ShieldCheck, FileText, ExternalLink 
} from 'lucide-react';

interface VoucherDetailModalProps {
  claim: ClaimVoucher;
  currentUser: UserProfile;
  onClose: () => void;
  onUpdateClaim: (updated: ClaimVoucher) => void;
  onOpenPrintView: (claim: ClaimVoucher) => void;
}

export const VoucherDetailModal: React.FC<VoucherDetailModalProps> = ({
  claim,
  currentUser,
  onClose,
  onUpdateClaim,
  onOpenPrintView
}) => {
  const company = COMPANIES.find(c => c.id === claim.companyId) || COMPANIES[0];
  
  const [status, setStatus] = useState<ClaimStatus>(claim.status);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'cheque'>(claim.paymentMethod);
  const [chequeNo, setChequeNo] = useState<string>(claim.chequeNo || '');
  const [items, setItems] = useState(claim.items);
  const [activeReceiptImg, setActiveReceiptImg] = useState<string | undefined>(
    claim.items[0]?.receiptImageUrl
  );

  const isAdmin = currentUser.role === 'admin';

  const handleSaveAndApprove = (newStatus: ClaimStatus) => {
    const updated: ClaimVoucher = {
      ...claim,
      status: newStatus,
      paymentMethod,
      chequeNo: paymentMethod === 'cheque' ? chequeNo : undefined,
      approvedBy: newStatus === 'approved' || newStatus === 'paid' ? currentUser.name : claim.approvedBy,
      items
    };
    onUpdateClaim(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-600 p-2 rounded-lg text-white">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono font-bold text-emerald-400">{claim.voucherNo}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                  claim.status === 'approved' ? 'bg-blue-900 text-blue-200' :
                  claim.status === 'paid' ? 'bg-emerald-900 text-emerald-200' :
                  claim.status === 'rejected' ? 'bg-rose-900 text-rose-200' : 'bg-amber-900 text-amber-200'
                }`}>
                  {claim.status}
                </span>
              </div>
              <p className="text-xs text-slate-400">{company.name}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => onOpenPrintView(claim)}
              className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print A4 Payment Voucher PDF</span>
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left / Main Details (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Voucher Metadata */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block font-semibold">Payee (Staff)</span>
                <span className="font-bold text-slate-900">{claim.payTo}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-semibold">Voucher Date</span>
                <span className="font-mono text-slate-900">{claim.voucherDate}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-semibold">Payment Method</span>
                <span className="font-medium text-slate-900 uppercase">{paymentMethod}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-semibold">Total Amount</span>
                <span className="font-mono font-bold text-emerald-700 text-sm">
                  RM {claim.totalAmountRM.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Admin Approval / Payment Settings */}
            {isAdmin && (
              <div className="bg-amber-50/60 rounded-xl p-4 border border-amber-200 space-y-3">
                <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4 text-amber-700" />
                  <span>Partner / Approver Controls</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Status Action</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as ClaimStatus)}
                      className="w-full text-xs bg-white border border-slate-300 rounded p-2 font-semibold"
                    >
                      <option value="pending">Pending Approval</option>
                      <option value="approved">Approved</option>
                      <option value="paid">Paid & Settled</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'cheque')}
                      className="w-full text-xs bg-white border border-slate-300 rounded p-2"
                    >
                      <option value="cheque">Cheque</option>
                      <option value="cash">Cash</option>
                    </select>
                  </div>

                  {paymentMethod === 'cheque' && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cheque No.</label>
                      <input
                        type="text"
                        value={chequeNo}
                        onChange={(e) => setChequeNo(e.target.value)}
                        placeholder="e.g. MBB 448912"
                        className="w-full text-xs bg-white border border-slate-300 rounded p-2 font-mono"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Expense Line Items & GL Codes */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Itemized Accounts Allocation</h3>
              
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={idx} className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-mono font-bold text-slate-700">Line #{item.lineNo} - {item.merchant}</span>
                      <span className="font-mono font-bold text-emerald-700">RM {item.amountRM.toFixed(2)}</span>
                    </div>

                    <div className="text-xs text-slate-600">
                      <p><span className="font-semibold">Particulars:</span> {item.particulars}</p>
                      <p><span className="font-semibold">Receipt / Ref No:</span> {item.receiptNo} ({item.date})</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500">GL Account Code</label>
                        {isAdmin ? (
                          <select
                            value={item.accountCode}
                            onChange={(e) => {
                              const gl = GL_ACCOUNTS.find(g => g.code === e.target.value);
                              const updated = [...items];
                              updated[idx].accountCode = e.target.value;
                              updated[idx].accountName = gl?.name || '';
                              setItems(updated);
                            }}
                            className="w-full text-xs bg-slate-50 border border-slate-300 rounded p-1.5 font-mono"
                          >
                            {GL_ACCOUNTS.map(g => (
                              <option key={g.code} value={g.code}>{g.code} - {g.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs font-mono font-medium text-slate-800">{item.accountCode} - {item.accountName}</span>
                        )}
                      </div>

                      {item.receiptImageUrl && (
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => setActiveReceiptImg(item.receiptImageUrl)}
                            className="text-xs text-emerald-700 hover:underline flex items-center space-x-1 font-medium bg-emerald-50 px-2 py-1 rounded"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Preview Attached Receipt</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column: Receipt Image Viewer */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Supporting Receipt Packet</h3>
            
            <div className="bg-slate-100 rounded-xl p-3 border border-slate-300 flex flex-col items-center justify-center min-h-[300px]">
              {activeReceiptImg ? (
                <div className="space-y-3 w-full">
                  <div className="relative rounded-lg overflow-hidden border border-slate-300 bg-white shadow-sm">
                    <img 
                      src={activeReceiptImg} 
                      alt="Receipt" 
                      className="w-full h-auto max-h-96 object-contain mx-auto"
                    />
                  </div>
                  <p className="text-[11px] text-center text-slate-500">
                    Attached receipt thumbnail (Appended to Page 2+ of Payment Voucher PDF)
                  </p>
                </div>
              ) : (
                <div className="text-center text-slate-400 text-xs py-12">
                  <Receipt className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p>No receipt image selected.</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-white"
          >
            Close
          </button>

          {isAdmin && (
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => handleSaveAndApprove('rejected')}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-medium shadow-sm transition"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => handleSaveAndApprove('approved')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium shadow-sm transition"
              >
                Approve Voucher
              </button>
              <button
                type="button"
                onClick={() => handleSaveAndApprove('paid')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium shadow-sm transition"
              >
                Mark as Paid
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
