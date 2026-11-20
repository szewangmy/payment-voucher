import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { COMPANIES } from '../data/mockData';
import { auth, googleProvider } from '../firebase';
import { signOut, User as FirebaseUser } from 'firebase/auth';
import { 
  Building2, UserCircle, PlusCircle, FileSpreadsheet, 
  ShieldCheck, Receipt, LogOut, Shield, Users 
} from 'lucide-react';

interface NavbarProps {
  currentUser: UserProfile;
  firebaseUser: FirebaseUser;
  onOpenSubmitModal: () => void;
  onOpenExportModal: () => void;
  onOpenUserManagementModal: () => void;
  activeTab: 'dashboard' | 'directory';
  setActiveTab: (tab: 'dashboard' | 'directory') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  firebaseUser,
  onOpenSubmitModal,
  onOpenExportModal,
  onOpenUserManagementModal,
  activeTab,
  setActiveTab
}) => {
  const primaryEntity = COMPANIES.find(c => c.id === currentUser.defaultCompanyId) || COMPANIES[0];

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign Out Error:', err);
    }
  };

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
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-wide block leading-none">Staff Claim & Voucher System</span>
              </div>
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

          {/* Action Buttons & User Profile */}
          <div className="flex items-center space-x-3">
            
            {/* Submit Claim Button */}
            <button
              onClick={onOpenSubmitModal}
              className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-lg text-sm font-medium shadow-sm transition-all transform active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Claim</span>
            </button>

            {/* Export CSV Button (Only for accounts and admin) */}
            {currentUser.role !== 'staff' && (
              <button
                onClick={onOpenExportModal}
                className="hidden sm:inline-flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-lg text-sm font-medium transition-all"
                title="Export CSV for SQL Accounting / AutoCount"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Accounting CSV</span>
              </button>
            )}

            {/* Admin User Management Button */}
            {currentUser.role === 'admin' && (
              <button
                onClick={onOpenUserManagementModal}
                className="hidden sm:inline-flex items-center space-x-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-600/40 px-3 py-2 rounded-lg text-xs font-semibold transition"
                title="Manage Team & Access Control"
              >
                <Users className="w-4 h-4" />
                <span>Team Settings</span>
              </button>
            )}

            {/* User Profile Badge & Sign Out */}
            <div className="flex items-center space-x-3 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl">
              <div className="text-left">
                <div className="text-xs font-semibold leading-tight flex items-center space-x-1.5">
                  <span>{currentUser.name}</span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold ${
                    currentUser.role === 'admin' ? 'bg-amber-100 text-amber-800' :
                    currentUser.role === 'accounts' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-800'
                  }`}>
                    {currentUser.role}
                  </span>
                </div>
                <div className="text-[10px] text-emerald-400 truncate max-w-[140px]">
                  {primaryEntity.name}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="text-slate-400 hover:text-white p-1 transition"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>
      </div>
    </header>
  );
};
