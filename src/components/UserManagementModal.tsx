import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { COMPANIES } from '../data/mockData';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { Shield, Users, Check, X, Building2, UserCheck, Key, Save, Sparkles, AlertCircle } from 'lucide-react';

const SYSTEM_SETTINGS_COLLECTION = 'system_settings';
const GEMINI_CONFIG_DOC = 'gemini_config';

interface UserManagementModalProps {
  currentUser: UserProfile;
  onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  currentUser,
  onClose
}) => {
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sharedApiKey, setSharedApiKey] = useState<string>('');
  const [existingKeyMasked, setExistingKeyMasked] = useState<string | null>(null);
  const [isSavingKey, setIsSavingKey] = useState<boolean>(false);
  const [keySavedSuccess, setKeySavedSuccess] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [strictRealDateOnlyPolicy, setStrictRealDateOnlyPolicy] = useState<boolean>(true);
  const [selectedEntityToClear, setSelectedEntityToClear] = useState<string>(COMPANIES[0].id);
  const [confirmDeleteText, setConfirmDeleteText] = useState<string>('');
  const [isPurgingMock, setIsPurgingMock] = useState<boolean>(false);
  const [isClearingEntityClaims, setIsClearingEntityClaims] = useState<boolean>(false);

  useEffect(() => {
    fetchUsers();
    fetchSharedApiKey();
    getDoc(doc(db, SYSTEM_SETTINGS_COLLECTION, 'security_policy')).then(snap => {
      if (snap.exists() && typeof snap.data().strictRealDateOnly === 'boolean') {
        setStrictRealDateOnlyPolicy(snap.data().strictRealDateOnly);
      }
    }).catch(err => console.warn(err));
  }, []);

  const handleToggleStrictPolicy = async (newVal: boolean) => {
    setStrictRealDateOnlyPolicy(newVal);
    try {
      await setDoc(doc(db, SYSTEM_SETTINGS_COLLECTION, 'security_policy'), {
        strictRealDateOnly: newVal,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setToastMsg(`Strict Real-Date Policy set to ${newVal ? 'ON' : 'OFF'}`);
      setTimeout(() => setToastMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(`Failed to save policy: ${err.message}`);
    }
  };

  const handlePurgeMockData = async () => {
    if (!window.confirm('Are you sure you want to purge all sample / mock data claims from Firestore?')) return;
    setIsPurgingMock(true);
    try {
      const claimsSnap = await getDocs(collection(db, 'claims'));
      let count = 0;
      for (const dSnap of claimsSnap.docs) {
        const data = dSnap.data();
        if (data.id?.startsWith('CLM-2024') || data.id?.startsWith('CLM-2025') || data.voucherNo?.includes('2024') || data.voucherNo?.includes('2025')) {
          await deleteDoc(doc(db, 'claims', dSnap.id));
          count++;
        }
      }
      setToastMsg(`Successfully purged ${count} sample/mock claims.`);
      setTimeout(() => setToastMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(`Purge failed: ${err.message}`);
    } finally {
      setIsPurgingMock(false);
    }
  };

  const handleClearCompanyClaims = async () => {
    if (confirmDeleteText !== 'CONFIRM') {
      setErrorMsg('Please type CONFIRM exactly to authorize clearing company claims.');
      return;
    }
    setIsClearingEntityClaims(true);
    try {
      const claimsSnap = await getDocs(collection(db, 'claims'));
      let count = 0;
      for (const dSnap of claimsSnap.docs) {
        const data = dSnap.data();
        if (data.companyId === selectedEntityToClear || data.companyEntityId === selectedEntityToClear) {
          await deleteDoc(doc(db, 'claims', dSnap.id));
          count++;
        }
      }
      setConfirmDeleteText('');
      setToastMsg(`Successfully cleared ${count} claims for company entity.`);
      setTimeout(() => setToastMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(`Clear claims failed: ${err.message}`);
    } finally {
      setIsClearingEntityClaims(false);
    }
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const list: UserProfile[] = [];
      querySnapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as UserProfile);
      });
      setUsersList(list);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setErrorMsg(err.message || 'Failed to fetch team users.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSharedApiKey = async () => {
    try {
      const docSnap = await getDoc(doc(db, SYSTEM_SETTINGS_COLLECTION, GEMINI_CONFIG_DOC));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.apiKey) {
          setSharedApiKey(data.apiKey);
          const key = data.apiKey;
          if (key.length > 10) {
            setExistingKeyMasked(`${key.substring(0, 6)}...${key.substring(key.length - 4)}`);
          } else {
            setExistingKeyMasked('Active');
          }
        }
      }
    } catch (err) {
      console.error('Error fetching shared API key:', err);
    }
  };

  const handleSaveSharedKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedKey = sharedApiKey.trim();
    if (!trimmedKey) {
      setErrorMsg('Please enter a valid Gemini API key.');
      return;
    }

    setIsSavingKey(true);
    setKeySavedSuccess(false);
    setErrorMsg(null);
    try {
      // 1. Save to Firestore
      await setDoc(doc(db, SYSTEM_SETTINGS_COLLECTION, GEMINI_CONFIG_DOC), {
        apiKey: trimmedKey,
        updatedBy: currentUser.email || currentUser.name,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // 2. Send to backend server cache immediately via POST /api/gemini/config
      await fetch('/api/gemini/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: trimmedKey })
      }).catch(err => console.warn('Server config cache notification failed:', err));

      setKeySavedSuccess(true);
      if (trimmedKey.length > 10) {
        setExistingKeyMasked(`${trimmedKey.substring(0, 6)}...${trimmedKey.substring(trimmedKey.length - 4)}`);
      }
      setToastMsg('Shared Gemini API Key saved and active for all staff!');
      setTimeout(() => {
        setKeySavedSuccess(false);
        setToastMsg(null);
      }, 4000);
    } catch (err: any) {
      console.error('Error saving shared API key:', err);
      setErrorMsg(`Failed to save shared API key to Firestore: ${err.message || err}. (Ensure firestore.rules are published).`);
    } finally {
      setIsSavingKey(false);
    }
  };

  const updateUserRole = async (uid: string, newRole: 'staff' | 'manager' | 'accounts' | 'admin') => {
    setErrorMsg(null);
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
      setUsersList(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole } : u));
      setToastMsg('Permissions updated');
      setTimeout(() => setToastMsg(null), 3000);
    } catch (err: any) {
      console.error('Error updating user role:', err);
      setErrorMsg(err.message || 'Failed to update user role.');
    }
  };

  const toggleEntityAccess = async (uid: string, entityId: string, currentEntities: string[]) => {
    setErrorMsg(null);
    let updatedEntities = [...(currentEntities || [])];
    if (updatedEntities.includes(entityId)) {
      updatedEntities = updatedEntities.filter(id => id !== entityId);
    } else {
      updatedEntities.push(entityId);
    }

    try {
      await updateDoc(doc(db, 'users', uid), { assignedEntities: updatedEntities });
      setUsersList(prev => prev.map(u => u.uid === uid ? { ...u, assignedEntities: updatedEntities } : u));
      setToastMsg('Permissions updated');
      setTimeout(() => setToastMsg(null), 3000);
    } catch (err: any) {
      console.error('Error updating entity access:', err);
      setErrorMsg(err.message || 'Failed to update entity access.');
    }
  };

  if (currentUser.role !== 'admin') {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold">Team, Roles & Shared Gemini API Key Settings</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {toastMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center space-x-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{toastMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Shared Company Gemini API Key Section */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-emerald-900 font-bold text-sm">
                <Key className="w-4 h-4 text-emerald-700" />
                <span>Shared Company Gemini API Key (Universal Fallback)</span>
              </div>
              {existingKeyMasked ? (
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-mono font-bold">
                  Shared Key Active ({existingKeyMasked})
                </span>
              ) : (
                <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">
                  No Shared Key Saved Yet
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600">
              Save your company's Gemini API key here so all Staff, Managers, and Accounts users have instant access to AI Receipt OCR across any browser or hosting environment without needing server restarts.
            </p>

            <form onSubmit={handleSaveSharedKey} className="flex flex-col sm:flex-row gap-3 pt-1">
              <input
                type="password"
                placeholder="AIzaSy... (Paste Gemini API Key)"
                value={sharedApiKey}
                onChange={(e) => setSharedApiKey(e.target.value)}
                className="flex-1 text-xs bg-white border border-slate-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={isSavingKey}
                className="inline-flex items-center justify-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-lg text-xs font-semibold shadow-2xs transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingKey ? 'Saving...' : 'Save Shared Key'}</span>
              </button>
            </form>

            {keySavedSuccess && (
              <p className="text-xs text-emerald-700 font-semibold flex items-center">
                <Check className="w-3.5 h-3.5 mr-1" /> Shared Gemini API Key saved and active for all staff!
              </p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Team Members & Entity Access Permissions</h3>
            {isLoading ? (
              <div className="text-center py-8 text-slate-500 text-xs">Loading team members...</div>
            ) : (
              <div className="space-y-4">
                {usersList.map((user) => {
                  const isSelfAdmin = user.uid === currentUser.uid;
                  return (
                    <div key={user.uid} className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                            <span>{user.name}</span>
                            <span className="text-xs font-mono text-slate-500">({user.email})</span>
                            {isSelfAdmin && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">You (Admin)</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 font-mono">UID: {user.uid}</div>
                        </div>

                        {/* Role Selector with Self-Demotion Guard */}
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-semibold text-slate-600">Role:</span>
                          <select
                            value={user.role}
                            disabled={isSelfAdmin}
                            onChange={(e) => updateUserRole(user.uid, e.target.value as any)}
                            className={`text-xs bg-white border border-slate-300 rounded-lg p-1.5 font-semibold ${
                              isSelfAdmin ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''
                            }`}
                          >
                            <option value="staff">Staff (Claimant)</option>
                            <option value="manager">Manager (Approver)</option>
                            <option value="accounts">Accounts (Verifier)</option>
                            <option value="admin">Admin (Partner)</option>
                          </select>
                        </div>
                      </div>

                      {isSelfAdmin && (
                        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                          ⚠️ You cannot demote your own Admin role — promote another user to Admin first, then have them update your role if transferring ownership.
                        </p>
                      )}

                      {/* Company Access Toggles */}
                      <div className="pt-3 border-t border-slate-200">
                        <span className="text-xs font-bold text-slate-700 block mb-2">Assigned Company Entities:</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {COMPANIES.map(company => {
                            const isAssigned = (user.assignedEntities || []).includes(company.id);
                            return (
                              <button
                                key={company.id}
                                type="button"
                                onClick={() => toggleEntityAccess(user.uid, company.id, user.assignedEntities)}
                                className={`text-left px-3 py-2 rounded-lg text-xs border transition flex items-center justify-between ${
                                  isAssigned ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-medium' : 'bg-white border-slate-200 text-slate-600'
                                }`}
                              >
                                <span className="truncate mr-2">{company.name}</span>
                                {isAssigned && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Admin Danger Zone Panel */}
          <div className="bg-rose-50/70 border-2 border-rose-300 rounded-xl p-5 space-y-5">
            <div className="flex items-center space-x-2 text-rose-900 font-bold text-sm">
              <AlertCircle className="w-5 h-5 text-rose-600" />
              <span>Admin Danger Zone Controls (Restricted)</span>
            </div>

            {/* 1. Strict Real-Date Policy Toggle */}
            <div className="bg-white p-4 rounded-xl border border-rose-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 text-xs block">Enforce Strict Real-Date Policy</span>
                <span className="text-[11px] text-slate-600">When active, blocks claim submissions with future, expired (&gt;90d), or unauthentic/placeholder dates.</span>
              </div>
              <button
                type="button"
                onClick={() => handleToggleStrictPolicy(!strictRealDateOnlyPolicy)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  strictRealDateOnlyPolicy ? 'bg-rose-600' : 'bg-slate-400'
                }`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  strictRealDateOnlyPolicy ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* 2. Purge Sample / Mock Data */}
            <div className="bg-white p-4 rounded-xl border border-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="font-bold text-slate-900 text-xs block">Purge Sample / Mock Claims</span>
                <span className="text-[11px] text-slate-600">Permanently remove seeded sample 2024/2025 demo vouchers from Firestore.</span>
              </div>
              <button
                type="button"
                onClick={handlePurgeMockData}
                disabled={isPurgingMock}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-2xs transition disabled:opacity-50 shrink-0"
              >
                {isPurgingMock ? 'Purging...' : 'Purge Sample Data'}
              </button>
            </div>

            {/* 3. Clear Claims by Company Entity */}
            <div className="bg-white p-4 rounded-xl border border-rose-200 space-y-3">
              <div>
                <span className="font-bold text-slate-900 text-xs block">Clear Claims by Company Entity</span>
                <span className="text-[11px] text-slate-600">Delete all claims for a selected corporate entity. Strictly preserves user accounts and shared API keys.</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={selectedEntityToClear}
                  onChange={(e) => setSelectedEntityToClear(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-300 rounded-lg p-2"
                >
                  {COMPANIES.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Type CONFIRM"
                    value={confirmDeleteText}
                    onChange={(e) => setConfirmDeleteText(e.target.value)}
                    className="flex-1 text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleClearCompanyClaims}
                    disabled={isClearingEntityClaims || confirmDeleteText !== 'CONFIRM'}
                    className="px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded-lg text-xs font-semibold shadow-2xs transition disabled:opacity-50 shrink-0"
                  >
                    {isClearingEntityClaims ? 'Clearing...' : 'Clear Claims'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
