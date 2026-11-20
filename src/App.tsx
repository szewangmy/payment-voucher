import React, { useState, useEffect } from 'react';
import { UserProfile, ClaimVoucher, UserRole } from './types';
import { COMPANIES, USERS, INITIAL_CLAIMS } from './data/mockData';
import { auth, db, CLAIMS_COLLECTION } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, query, where, onSnapshot } from 'firebase/firestore';

import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { EntitiesDirectory } from './components/EntitiesDirectory';
import { ClaimSubmitModal } from './components/ClaimSubmitModal';
import { VoucherDetailModal } from './components/VoucherDetailModal';
import { PaymentVoucherPrintView } from './components/PaymentVoucherPrintView';
import { AccountingExportModal } from './components/AccountingExportModal';
import { LoginScreen } from './components/LoginScreen';
import { UserManagementModal } from './components/UserManagementModal';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [claims, setClaims] = useState<ClaimVoucher[]>([]);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);

  const [selectedEntityFilter, setSelectedEntityFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'directory'>('dashboard');

  // Modals
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState<boolean>(false);
  const [selectedClaim, setSelectedClaim] = useState<ClaimVoucher | null>(null);
  const [printClaim, setPrintClaim] = useState<ClaimVoucher | null>(null);

  // Handle Firebase Auth & User Profile sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          const userDocRef = doc(db, 'users', fbUser.uid);
          const userSnap = await getDoc(userDocRef);

          let assignedRole: UserRole = 'staff';
          let assignedEnts = ['ing-wang'];

          if (userSnap.exists()) {
            const data = userSnap.data() as UserProfile;
            setCurrentUser({ ...data, id: userSnap.id });
          } else {
            try {
              const bootstrapRef = doc(db, 'system_settings', 'admin_bootstrap');
              const bootstrapSnap = await getDoc(bootstrapRef);
              if (!bootstrapSnap.exists()) {
                await setDoc(bootstrapRef, {
                  ownerUid: fbUser.uid,
                  ownerEmail: fbUser.email || '',
                  claimedAt: new Date().toISOString()
                });
                assignedRole = 'admin';
                assignedEnts = COMPANIES.map(c => c.id);
              }
            } catch (bootErr) {
              console.warn('Bootstrap claim note:', bootErr);
            }

            const newProfile: UserProfile = {
              id: fbUser.uid,
              uid: fbUser.uid,
              name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Staff User',
              email: fbUser.email || '',
              role: assignedRole,
              assignedEntities: assignedEnts,
              defaultCompanyId: 'ing-wang'
            };
            await setDoc(userDocRef, newProfile);
            setCurrentUser(newProfile);
          }
        } catch (err) {
          console.error('Error loading user profile:', err);
        }
      } else {
        setCurrentUser(null);
        setClaims([]);
      }
      setIsLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  // Real-time claims subscription via onSnapshot
  useEffect(() => {
    if (!currentUser) {
      setClaims([]);
      return;
    }

    const unsubClaims = onSnapshot(collection(db, CLAIMS_COLLECTION), (snapshot) => {
      const list: ClaimVoucher[] = [];
      snapshot.forEach((docSnap) => {
        const claim = { id: docSnap.id, ...docSnap.data() } as ClaimVoucher;
        
        // Privacy & role-based filtering
        if (currentUser.role === 'admin') {
          list.push(claim);
        } else if (currentUser.role === 'staff') {
          if (claim.createdByUid === currentUser.uid || claim.claimantId === currentUser.uid) {
            list.push(claim);
          }
        } else {
          // manager / accounts
          const assigned = currentUser.assignedEntities || [];
          if (assigned.includes(claim.companyId) || assigned.includes(claim.companyEntityId)) {
            list.push(claim);
          }
        }
      });

      // Sort in JS by createdAt descending (no composite index required)
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setClaims(list);
    }, (err) => {
      console.error('Claims snapshot error:', err);
    });

    return () => unsubClaims();
  }, [currentUser]);

  const handleAddClaim = (newClaim: ClaimVoucher) => {
    // Real-time claims synced via onSnapshot
  };

  const handleUpdateClaim = async (updated: ClaimVoucher) => {
    try {
      await updateDoc(doc(db, 'claims', updated.id), { ...updated });
      setClaims(prev => prev.map(c => c.id === updated.id ? updated : c));
    } catch (err: any) {
      console.error('Error updating claim:', err);
      alert(`Failed to update claim in Firestore: ${err.message || err}`);
    }
  };

  const handleDeleteClaim = async (claimId: string) => {
    if (window.confirm('Are you sure you want to delete this claim voucher from Firestore?')) {
      try {
        await deleteDoc(doc(db, 'claims', claimId));
        setClaims(prev => prev.filter(c => c.id !== claimId));
        if (selectedClaim?.id === claimId) setSelectedClaim(null);
      } catch (err: any) {
        console.error('Error deleting claim:', err);
        alert(`Failed to delete claim from Firestore: ${err.message || err}`);
      }
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        <p className="text-sm font-medium text-slate-300">Loading Staff Claim & Voucher Portal...</p>
      </div>
    );
  }

  if (!firebaseUser || !currentUser) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans antialiased flex flex-col justify-between">
      
      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        firebaseUser={firebaseUser}
        onOpenSubmitModal={() => setIsSubmitModalOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenUserManagementModal={() => setIsUserManagementOpen(true)}
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
        <p>Staff Claim & Payment Voucher System (RM) • Multi-Entity Malaysian Accounting & Firebase Security</p>
      </footer>

      {/* Modals */}
      {isSubmitModalOpen && (
        <ClaimSubmitModal
          currentUser={currentUser}
          onClose={() => setIsSubmitModalOpen(false)}
          onAddClaim={handleAddClaim}
          onClaimSubmitted={() => setSelectedEntityFilter('all')}
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

      {isExportModalOpen && currentUser.role !== 'staff' && (
        <AccountingExportModal
          claims={claims}
          onClose={() => setIsExportModalOpen(false)}
        />
      )}

      {isUserManagementOpen && currentUser.role === 'admin' && (
        <UserManagementModal
          currentUser={currentUser}
          onClose={() => setIsUserManagementOpen(false)}
        />
      )}

    </div>
  );
}
