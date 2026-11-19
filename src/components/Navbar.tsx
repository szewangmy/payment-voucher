import React from 'react';
import { UserProfile, CompanyEntity } from '../types';
import { COMPANIES, USERS } from '../data/mockData';
import { Building2, UserCircle, PlusCircle, FileSpreadsheet, ShieldCheck, Receipt } from 'lucide-react';

interface NavbarProps {
  currentUser: UserProfile;
  setCurrentUser: (user: UserProfile) => void;
  selectedEntityFilter: string;
  setSelectedEntityFilter: (entityId: string) => void;
  onOpenSubmitModal: () => void;
  onOpenExportModal: () => void;
  activeTab: 'dashboard' | 'directory';
  setActiveTab: (tab: 'dashboard' | 'directory') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  setCurrentUser,
  selectedEntityFilter,
  setSelectedEntityFilter,
  onOpenSubmitModal,
  onOpenExportModal,
  activeTab,
  setActiveTab
}) => {
  const currentEntity = COMPANIES.find(c => c.id === currentUser.defaultCompanyId) || COMPANIES[0];

  return (
    <header className="bg-slate-900 text-white shadow-md border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-600 p-2 rounded-lg text-white shadow-inner flex items-center justify-center">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-wide block leading-none">Staff Claim & Voucher System</span>
              <span className="text-xs text-emerald-400 font-medium">Multi-Entity Malaysian Accounting Portal (RM)</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="hidden md:flex items-center space-x-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'dashboard' ? 'bg-slate-800 text-emerald-400' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              Claims & Vouchers
            </button>
            <button
              onClick={() => setActiveTab('directory')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'directory' ? 'bg-slate-800 text-emerald-400' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              5 Legal Entities Directory
            </button>
          </div>

          {/* Action Buttons & Switchers */}
          <div className="flex items-center space-x-3">
            
            {/* Submit Claim Button */}
            <button
              onClick={onOpenSubmitModal}
              className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-lg text-sm font-medium shadow-sm transition-all transform active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Claim</span>
            </button>

            {/* Export CSV Button */}
            <button
              onClick={onOpenExportModal}
              className="inline-flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-lg text-sm font-medium transition-all"
              title="Export CSV for SQL Accounting / AutoCount"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Accounting CSV</span>
            </button>

            {/* User Switcher Dropdown */}
            <div className="relative group">
              <div className="flex items-center space-x-2 bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-slate-800 transition">
                <UserCircle className="w-5 h-5 text-emerald-400" />
                <div className="text-left hidden lg:block">
                  <div className="text-xs font-semibold leading-none">{currentUser.name}</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">{currentUser.role}</div>
                </div>
              </div>
              <div className="absolute right-0 mt-2 w-72 bg-white text-slate-900 rounded-xl shadow-2xl py-2 hidden group-hover:block z-50 border border-slate-200">
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-bold">Switch Demo User & Role</p>
                  <p className="text-xs text-slate-600">Simulate staff vs. managing partner approval</p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {USERS.map(u => {
                    const comp = COMPANIES.find(c => c.id === u.defaultCompanyId);
                    const isSelected = u.id === currentUser.id;
                    return (
                      <button
                        key={u.id}
                        onClick={() => setCurrentUser(u)}
                        className={`w-full text-left px-4 py-2.5 text-xs hover:bg-emerald-50 transition flex items-center justify-between border-b border-slate-50 last:border-0 ${
                          isSelected ? 'bg-emerald-50/80 font-semibold text-emerald-900' : ''
                        }`}
                      >
                        <div>
                          <div className="font-medium text-slate-900 flex items-center space-x-1">
                            <span>{u.name}</span>
                            {u.role === 'admin' && <ShieldCheck className="w-3.5 h-3.5 text-amber-600 inline" />}
                          </div>
                          <div className="text-[10px] text-slate-500">{comp?.name.substring(0, 30)}...</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                          u.role === 'admin' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {u.role}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </header>
  );
};
