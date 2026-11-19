import React, { useRef } from 'react';
import { ClaimVoucher } from '../types';
import { COMPANIES, USERS } from '../data/mockData';
import { Printer, Download, X, ArrowLeft } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface PaymentVoucherPrintViewProps {
  claim: ClaimVoucher;
  onClose: () => void;
}

export const PaymentVoucherPrintView: React.FC<PaymentVoucherPrintViewProps> = ({
  claim,
  onClose
}) => {
  const company = COMPANIES.find(c => c.id === claim.companyId) || COMPANIES[0];
  const claimant = USERS.find(u => u.id === claim.claimantId);
  const voucherRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!voucherRef.current) return;
    try {
      const canvas = await html2canvas(voucherRef.current, {
        scale: 2,
        useCORS: true,
        logging: false
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`${claim.voucherNo}_Payment_Voucher.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-start py-8 px-4">
      
      {/* Top Action Bar */}
      <div className="max-w-4xl w-full flex justify-between items-center mb-4 bg-slate-900 text-white px-6 py-3 rounded-xl shadow-lg print:hidden">
        <button
          onClick={onClose}
          className="inline-flex items-center space-x-2 text-slate-300 hover:text-white text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>

        <div className="flex items-center space-x-3">
          <button
            onClick={handlePrint}
            className="inline-flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium border border-slate-700 transition"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>Print A4</span>
          </button>
          <button
            onClick={handleDownloadPDF}
            className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF Packet</span>
          </button>
        </div>
      </div>

      {/* Printable A4 Container */}
      <div 
        ref={voucherRef} 
        className="bg-white text-slate-900 w-full max-w-[210mm] min-h-[297mm] p-8 sm:p-12 shadow-2xl rounded-none sm:rounded-lg print:shadow-none print:w-full print:p-6 font-serif border border-slate-300"
        style={{ fontFamily: '"Times New Roman", Times, Georgia, serif' }}
      >
        
        {/* --- PAGE 1: PAYMENT VOUCHER --- */}
        <div className="flex flex-col justify-between min-h-[260mm]">
          
          <div>
            {/* Top Letterhead */}
            <div className={`mb-6 pb-4 border-b-2 border-black ${company.headerAlign === 'center' ? 'text-center' : 'text-left'}`}>
              <h1 className="text-xl font-bold uppercase tracking-tight text-black">{company.name}</h1>
              {company.subtitle && (
                <p className="text-xs font-bold tracking-widest text-slate-800 mt-1">{company.subtitle}</p>
              )}
              <p className="text-[11px] font-mono text-black mt-1">{company.regNo}</p>
              <p className="text-[11px] text-black mt-0.5">{company.address}</p>
            </div>

            {/* Title & Voucher No. */}
            <div className="flex justify-between items-baseline mb-6">
              <div>
                <span className="font-bold text-xs uppercase tracking-wide">Voucher No. : </span>
                <span className="font-mono font-bold text-sm underline">{claim.voucherNo}</span>
              </div>
              <div className="text-center">
                <h2 className="text-lg font-bold uppercase tracking-wider underline underline-offset-4">PAYMENT VOUCHER</h2>
              </div>
              <div>
                <span className="font-bold text-xs uppercase tracking-wide">Date : </span>
                <span className="font-mono text-sm">{claim.voucherDate}</span>
              </div>
            </div>

            {/* Main Boxed Voucher Grid */}
            <div className="border-2 border-black">
              
              {/* Row 1: Pay To */}
              <div className="flex border-b border-black">
                <div className="p-3 flex-1 flex items-center space-x-2">
                  <span className="font-bold uppercase text-xs">PAY TO :</span>
                  <span className="font-bold text-sm underline">{claim.payTo}</span>
                </div>
              </div>

              {/* Row 2: Particulars & Amount Headers */}
              <div className="flex border-b border-black bg-slate-50/50 font-bold text-xs">
                <div className="flex-1 p-2.5 border-r border-black uppercase text-center tracking-wider">
                  PARTICULARS
                </div>
                <div className="w-36 p-2.5 uppercase text-center tracking-wider">
                  AMOUNT (RM)
                </div>
              </div>

              {/* Row 3: Items List & Amounts */}
              <div className="flex min-h-[180px] text-xs">
                
                {/* Particulars Left Column (~75%) */}
                <div className="flex-1 p-3 border-r border-black flex flex-col justify-between">
                  <div className="space-y-3">
                    {claim.items.map((item, idx) => (
                      <div key={idx} className="space-y-0.5 pb-2 border-b border-dotted border-slate-300 last:border-0">
                        <div className="font-bold text-black">
                          {idx + 1}. {item.merchant} <span className="font-mono font-normal text-slate-700">({item.receiptNo})</span>
                        </div>
                        <div className="text-slate-800 pl-4">{item.particulars}</div>
                        <div className="text-[10px] text-slate-500 pl-4 font-mono">Date: {item.date} | GL Code: {item.accountCode} - {item.accountName}</div>
                      </div>
                    ))}
                  </div>

                  {/* Payment Info at bottom left of Particulars box */}
                  <div className="pt-6 mt-4 border-t border-black space-y-1 text-xs">
                    <div className="flex items-center space-x-4">
                      <span>{company.paymentLabels.cash}</span>
                      <span className="font-mono font-bold">{claim.paymentMethod === 'cash' ? `RM ${claim.totalAmountRM.toFixed(2)}` : '__________'}</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span>{company.paymentLabels.cheque}</span>
                      <span className="font-mono font-bold">{claim.paymentMethod === 'cheque' ? claim.chequeNo || '________________' : '__________'}</span>
                    </div>
                  </div>
                </div>

                {/* Amount Right Column (~25%) */}
                <div className="w-36 flex flex-col justify-between p-3 text-right">
                  <div className="space-y-3 font-mono">
                    {claim.items.map((item, idx) => (
                      <div key={idx} className="pb-2 border-b border-dotted border-slate-300 last:border-0">
                        {item.amountRM.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Total Row */}
              <div className="flex border-t-2 border-black font-bold text-xs bg-slate-50">
                <div className="flex-1 p-3 border-r border-black text-right uppercase tracking-wider">
                  TOTAL RM :
                </div>
                <div className="w-36 p-3 text-right font-mono text-sm">
                  <span className="border-b-4 border-double border-black pb-0.5">
                    {claim.totalAmountRM.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

            </div>

            {/* Sign-off & Accounts Allocation Footer Grid */}
            <div className="border-2 border-t-0 border-black grid grid-cols-4 text-xs">
              
              {/* Received by */}
              <div className="p-3 border-r border-black flex flex-col justify-between h-28">
                <span className="font-bold text-[11px]">Received by :</span>
                <div className="border-t border-black pt-1 text-center text-[10px] text-slate-700">
                  Signature & Date
                </div>
              </div>

              {/* Prepared by */}
              <div className="p-3 border-r border-black flex flex-col justify-between h-28">
                <span className="font-bold text-[11px]">Prepared by :</span>
                <div className="text-center font-medium text-slate-800">{claim.payTo}</div>
                <div className="border-t border-black pt-1 text-center text-[10px] text-slate-700">
                  Staff Claimant
                </div>
              </div>

              {/* Approved by */}
              <div className="p-3 border-r border-black flex flex-col justify-between h-28">
                <span className="font-bold text-[11px]">Approved by :</span>
                <div className="text-center font-medium text-slate-800">{claim.approvedBy || 'Partner Wang'}</div>
                <div className="border-t border-black pt-1 text-center text-[10px] text-slate-700">
                  Partner / Director
                </div>
              </div>

              {/* Accounts Allocation */}
              <div className="p-3 flex flex-col justify-between h-28 bg-slate-50">
                <span className="font-bold text-[11px] text-center block">Accounts Allocation</span>
                <div className="text-center font-mono text-[11px] font-bold text-emerald-800">
                  {claim.items[0]?.accountCode}<br />
                  <span className="text-[10px] text-slate-600 font-normal">{claim.items[0]?.accountName}</span>
                </div>
                <div className="border-t border-black pt-1 text-center text-[10px] text-slate-700">
                  GL Code
                </div>
              </div>

            </div>

          </div>

          <div className="text-center text-[10px] text-slate-500 pt-8 border-t border-slate-200 mt-8">
            System-generated Payment Voucher for {company.name} • Compatible with SQL Accounting & AutoCount import.
          </div>

        </div>

        {/* --- PAGE 2+: APPENDIX SUPPORTING RECEIPTS --- */}
        {claim.items.some(i => i.receiptImageUrl) && (
          <div className="page-break mt-12 pt-8 border-t-4 border-slate-800">
            <div className="mb-6 text-center">
              <h3 className="text-base font-bold uppercase tracking-wider underline">APPENDIX: SUPPORTING RECEIPT PACKET</h3>
              <p className="text-xs text-slate-600 font-mono mt-1">Voucher Ref: {claim.voucherNo}</p>
            </div>

            <div className="grid grid-cols-1 gap-8">
              {claim.items.map((item, idx) => item.receiptImageUrl && (
                <div key={idx} className="border-2 border-slate-400 rounded-xl p-4 bg-slate-50 space-y-3">
                  <div className="flex justify-between items-center text-xs font-bold border-b border-slate-300 pb-2">
                    <span>Receipt #{idx + 1}: {item.merchant} ({item.receiptNo})</span>
                    <span className="font-mono">RM {item.amountRM.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-center bg-white p-4 rounded border border-slate-300">
                    <img 
                      src={item.receiptImageUrl} 
                      alt={`Receipt ${idx + 1}`} 
                      className="max-h-[400px] w-auto object-contain"
                    />
                  </div>
                  <p className="text-xs text-slate-600 italic text-center">Particulars: {item.particulars}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
