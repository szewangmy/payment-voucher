import React, { useState } from 'react';
import { ClaimVoucher } from '../types';
import { COMPANIES } from '../data/mockData';
import { FileSpreadsheet, X, Download, CheckCircle } from 'lucide-react';

interface AccountingExportModalProps {
  claims: ClaimVoucher[];
  onClose: () => void;
}

export const AccountingExportModal: React.FC<AccountingExportModalProps> = ({
  claims,
  onClose
}) => {
  const [selectedEntityId, setSelectedEntityId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('approved_paid');

  // Filter claims eligible for accounting export (approved or paid)
  const eligibleClaims = claims.filter(c => {
    const matchEntity = selectedEntityId === 'all' || c.companyId === selectedEntityId;
    const matchStatus = 
      statusFilter === 'all' ? c.status !== 'rejected' :
      statusFilter === 'approved_paid' ? (c.status === 'approved' || c.status === 'paid') :
      c.status === statusFilter;
    return matchEntity && matchStatus;
  });

  const handleExportCSV = () => {
    const headers = [
      'DocNo', 'DocDate', 'EntityName', 'PayTo', 'PaymentMethod', 'BankAccountCode',
      'ChequeNo', 'LineNo', 'AccountCode', 'AccountName', 'ReceiptDate', 'RefNo',
      'Description', 'TaxCode', 'TaxAmountRM', 'NetAmountRM', 'TotalAmountRM', 'Status', 'ApprovedBy'
    ];

    const rows: string[][] = [];

    eligibleClaims.forEach(claim => {
      const company = COMPANIES.find(c => c.id === claim.companyId);
      claim.items.forEach(item => {
        rows.push([
          claim.voucherNo,
          claim.voucherDate,
          `"${company?.name || ''}"`,
          `"${claim.payTo}"`,
          claim.paymentMethod.toUpperCase(),
          claim.bankAccountCode,
          claim.chequeNo || '',
          String(item.lineNo),
          item.accountCode,
          `"${item.accountName}"`,
          item.date,
          `"${item.receiptNo}"`,
          `"${item.merchant} - ${item.particulars}"`,
          item.taxCode,
          item.taxAmountRM.toFixed(2),
          item.netAmountRM.toFixed(2),
          item.amountRM.toFixed(2),
          claim.status.toUpperCase(),
          `"${claim.approvedBy || 'Partner Wang'}"`
        ]);
      });
    });

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const entityPrefix = selectedEntityId === 'all' ? 'Master' : (COMPANIES.find(c => c.id === selectedEntityId)?.voucherPrefix || 'Entity');
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const filename = `${entityPrefix}_PaymentVouchers_${dateStr}.csv`;

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold">Export Accounting Software CSV</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <p className="text-sm text-slate-600">
            Export multi-line payment vouchers formatted for direct import into <b>SQL Accounting</b>, <b>AutoCount</b>, or <b>Xero</b>.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Target Entity / Company</label>
              <select
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
                className="w-full text-sm bg-slate-50 border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All 5 Entities (Master Combined CSV)</option>
                {COMPANIES.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Voucher Status Filter</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full text-sm bg-slate-50 border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="approved_paid">Approved & Paid Vouchers (Recommended)</option>
                <option value="approved">Approved Only</option>
                <option value="paid">Paid Only</option>
                <option value="all">All Eligible (Excluding Rejected)</option>
              </select>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-900 space-y-2">
              <div className="font-bold flex items-center space-x-1">
                <CheckCircle className="w-4 h-4 text-emerald-700" />
                <span>Export Summary</span>
              </div>
              <p>
                Found <b>{eligibleClaims.length}</b> vouchers with <b>{eligibleClaims.reduce((acc, c) => acc + c.items.length, 0)}</b> expense line items ready for CSV export.
              </p>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                handleExportCSV();
                onClose();
              }}
              disabled={eligibleClaims.length === 0}
              className="inline-flex items-center space-x-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium shadow-sm disabled:opacity-50 transition"
            >
              <Download className="w-4 h-4" />
              <span>Download CSV File</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
