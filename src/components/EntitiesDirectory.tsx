import React from 'react';
import { COMPANIES } from '../data/mockData';
import { Building2, FileText, MapPin, Hash, CheckCircle2 } from 'lucide-react';

export const EntitiesDirectory: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">5 Legal Entities & Department Directory</h1>
        <p className="text-sm text-slate-600">
          Official company letterhead specifications, registration numbers, addresses, and payment voucher formatting rules for Malaysian corporate accounting.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {COMPANIES.map((company, index) => (
          <div key={company.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
            
            {/* Card Header Preview Box */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex justify-between items-start mb-3">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                  Entity #{index + 1}
                </span>
                <span className="text-xs font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                  Prefix: {company.voucherPrefix}
                </span>
              </div>

              {/* Company Header Simulation */}
              <div className={`p-4 bg-white border border-slate-300 rounded shadow-2xs ${company.headerAlign === 'center' ? 'text-center' : 'text-left'}`}>
                <h3 className="font-serif font-bold text-slate-900 text-sm tracking-tight">{company.name}</h3>
                {company.subtitle && (
                  <p className="text-[11px] font-bold tracking-widest text-slate-700 mt-0.5">{company.subtitle}</p>
                )}
                <p className="text-[10px] font-mono text-slate-600 mt-1">{company.regNo}</p>
                <p className="text-[10px] text-slate-500 mt-1 leading-tight">{company.address}</p>
              </div>
            </div>

            {/* Details & Specifications */}
            <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-3 text-xs">
                <div className="flex items-start space-x-2">
                  <Hash className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-slate-700 block">Registration Number</span>
                    <span className="font-mono text-slate-900">{company.regNo}</span>
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-slate-700 block">Registered Address</span>
                    <span className="text-slate-600">{company.address}</span>
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-slate-700 block">Voucher Layout Style</span>
                    <span className="text-slate-600 capitalize">
                      {company.headerAlign} header alignment; Payment labels: [{company.paymentLabels.cash} / {company.paymentLabels.cheque}]
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center text-emerald-600 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Active in System
                </span>
                <span className="font-mono text-[11px]">SQL / AutoCount Ready</span>
              </div>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
};
