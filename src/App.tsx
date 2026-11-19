import React, { useState, useEffect } from 'react';
import { UserProfile, ClaimVoucher } from './types';
import { USERS, INITIAL_CLAIMS } from './data/mockData';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { EntitiesDirectory } from './components/EntitiesDirectory';
import { ClaimSubmitModal } from './components/ClaimSubmitModal';
import { VoucherDetailModal } from './components/VoucherDetailModal';
import { PaymentVoucherPrintView } from './components/PaymentVoucherPrintView';
import { AccountingExportModal } from './components/AccountingExportModal';

export default function App() {
  // Persistent User state
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('staff_claim_current_user');
    return saved ? JSON.parse(saved) : USERS[0];
  });

  // Persistent Claims state
  const [claims, setClaims] = useState<ClaimVoucher[]>(() => {
    const saved = localStorage.getItem('staff_claim_vouchers_list');
    return saved ? JSON.parse(saved) : INITIAL_CLAIMS;
  });

  const [selectedEntityFilter, setSelectedEntityFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'directory'>('dashboard');

  // Modals state
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [selectedClaim, setSelectedClaim] = useState<ClaimVoucher | null>(null);
  const [printClaim, setPrintClaim] = useState<ClaimVoucher | null>(null);

  useEffect(() => {
    localStorage.setItem('staff_claim_current_user', JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('staff_claim_vouchers_list', JSON.stringify(claims));
  }, [claims]);

  const handleAddClaim = (newClaim: ClaimVoucher) => {
    setClaims(prev => [newClaim, ...prev]);
  };

  const handleUpdateClaim = (updated: ClaimVoucher) => {
    setClaims(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  const handleDeleteClaim = (claimId: string) => {
    if (window.confirm('Are you sure you want to delete this claim voucher?')) {
      setClaims(prev => prev.filter(c => c.id !== claimId));
      if (selectedClaim?.id === claimId) setSelectedClaim(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans antialiased flex flex-col justify-between">
      
      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        selectedEntityFilter={selectedEntityFilter}
        setSelectedEntityFilter={setSelectedEntityFilter}
        onOpenSubmitModal={() => setIsSubmitModalOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'dashboard' ? (
          <Dashboard
            claims={claims}
            currentUser={currentUser}
            selectedEntityFilter={selectedEntityFilter}
            setSelectedEntityFilter={setSelectedEntityFilter}
            onSelectClaim={(claim) => setSelectedClaim(claim)}
            onDeleteClaim={handleDeleteClaim}
            onOpenExportModal={() => setIsExportModalOpen(true)}
            onOpenSubmitModal={() => setIsSubmitModalOpen(true)}
          />
        ) : (
          <EntitiesDirectory />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <p>Staff Claim & Payment Voucher System (RM) • Multi-Entity Malaysian Accounting & Gemini AI OCR</p>
      </footer>

      {/* Modals */}
      {isSubmitModalOpen && (
        <ClaimSubmitModal
          currentUser={currentUser}
          onClose={() => setIsSubmitModalOpen(false)}
          onAddClaim={handleAddClaim}
        />
      )}

      {selectedClaim && (
        <VoucherDetailModal
          claim={selectedClaim}
          currentUser={currentUser}
          onClose={() => setSelectedClaim(null)}
          onUpdateClaim={handleUpdateClaim}
          onOpenPrintView={(claim) => {
            setSelectedClaim(null);
            setPrintClaim(claim);
          }}
        />
      )}

      {printClaim && (
        <PaymentVoucherPrintView
          claim={printClaim}
          onClose={() => setPrintClaim(null)}
        />
      )}

      {isExportModalOpen && (
        <AccountingExportModal
          claims={claims}
          onClose={() => setIsExportModalOpen(false)}
        />
      )}

    </div>
  );
}
