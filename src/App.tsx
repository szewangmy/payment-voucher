import React, { useState, useEffect } from 'react';
import { UserProfile, ClaimVoucher, UserRole } from './types';
import { COMPANIES, USERS, INITIAL_CLAIMS } from './data/mockData';
import { auth, db } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';

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
            assignedRole = data.role;
            assignedEnts = data.assignedEntities || ['ing-wang'];
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

          // Fetch claims from Firestore
          await fetchClaims(fbUser.uid, assignedRole, assignedEnts);
        } catch (err) {
          console.error('Error loading user profile or claims:', err);
        }
      } else {
        setCurrentUser(null);
        setClaims([]);
      }
      setIsLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  const fetchClaims = async (uid: string, role: string, assignedEntities: string[]) => {
    try {
      const claimsSnap = await getDocs(collection(db, 'claims'));
      const list: ClaimVoucher[] = [];
      claimsSnap.forEach((docSnap) => {
        const claim = { id: docSnap.id, ...docSnap.data() } as ClaimVoucher;
        
        // Privacy & role-based filtering
        if (role === 'staff') {
          if (claim.createdByUid === uid || claim.claimantId === uid) {
            list.push(claim);
          }
        } else {
          // accounts or admin can view claims in assigned entities
          if (assignedEntities.includes(claim.companyId) || assignedEntities.includes(claim.companyEntityId)) {
            list.push(claim);
          }
        }
      });

      // If no claims exist in Firestore yet, seed initial mock claims for immediate testing
      if (list.length === 0 && claimsSnap.empty) {
        for (const initial of INITIAL_CLAIMS) {
          const seededClaim = {
            ...initial,
            createdByUid: uid,
            companyEntityId: initial.companyId
          };
          await setDoc(doc(collection(db, 'claims')), seededClaim);
          list.push(seededClaim);
        }
      }

      setClaims(list);
    } catch (err) {
      console.error('Error fetching claims:', err);
    }
  };

  const handleAddClaim = async (newClaim: ClaimVoucher) => {
    if (!currentUser) return;
    try {
      const claimWithMeta = {
        ...newClaim,
        createdByUid: currentUser.uid,
        companyEntityId: newClaim.companyId
      };
      const docRef = await addDoc(collection(db, 'claims'), claimWithMeta);
      const savedClaim = { ...claimWithMeta, id: docRef.id };
      setClaims(prev => [savedClaim, ...prev]);
    } catch (err) {
      console.error('Error adding claim:', err);
    }
  };

  const handleUpdateClaim = async (updated: ClaimVoucher) => {
    try {
      await updateDoc(doc(db, 'claims', updated.id), { ...updated });
      setClaims(prev => prev.map(c => c.id === updated.id ? updated : c));
    } catch (err) {
      console.error('Error updating claim:', err);
    }
  };

  const handleDeleteClaim = async (claimId: string) => {
    if (window.confirm('Are you sure you want to delete this claim voucher?')) {
      try {
        await deleteDoc(doc(db, 'claims', claimId));
        setClaims(prev => prev.filter(c => c.id !== claimId));
        if (selectedClaim?.id === claimId) setSelectedClaim(null);
      } catch (err) {
        console.error('Error deleting claim:', err);
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
