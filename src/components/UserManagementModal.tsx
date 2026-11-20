import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { COMPANIES } from '../data/mockData';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { Shield, Users, Check, X, Building2, UserCheck } from 'lucide-react';

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

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const list: UserProfile[] = [];
      querySnapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as UserProfile);
      });
      setUsersList(list);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserRole = async (uid: string, newRole: 'staff' | 'accounts' | 'admin') => {
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
      setUsersList(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole } : u));
    } catch (err) {
      console.error('Error updating user role:', err);
    }
  };

  const toggleEntityAccess = async (uid: string, entityId: string, currentEntities: string[]) => {
    let updatedEntities = [...(currentEntities || [])];
    if (updatedEntities.includes(entityId)) {
      updatedEntities = updatedEntities.filter(id => id !== entityId);
    } else {
      updatedEntities.push(entityId);
    }

    try {
      await updateDoc(doc(db, 'users', uid), { assignedEntities: updatedEntities });
      setUsersList(prev => prev.map(u => u.uid === uid ? { ...u, assignedEntities: updatedEntities } : u));
    } catch (err) {
      console.error('Error updating entity access:', err);
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
            <h2 className="text-lg font-bold">Team & Access Control (Admin Settings)</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          <p className="text-sm text-slate-600">
            Manage user roles and multi-entity access permissions across the 5 legal entities.
          </p>

          {isLoading ? (
            <div className="text-center py-12 text-slate-500">Loading team members...</div>
          ) : (
            <div className="space-y-4">
              {usersList.map((user) => (
                <div key={user.uid} className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                        <span>{user.name}</span>
                        <span className="text-xs font-mono text-slate-500">({user.email})</span>
                      </div>
                      <div className="text-xs text-slate-500 font-mono">UID: {user.uid}</div>
                    </div>

                    {/* Role Selector */}
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold text-slate-600">Role:</span>
                      <select
                        value={user.role}
                        onChange={(e) => updateUserRole(user.uid, e.target.value as any)}
                        className="text-xs bg-white border border-slate-300 rounded-lg p-1.5 font-semibold"
                      >
                        <option value="staff">Staff (Claimant)</option>
                        <option value="accounts">Accounts (Verifier)</option>
                        <option value="admin">Admin (Partner)</option>
                      </select>
                    </div>
                  </div>

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
              ))}
            </div>
          )}
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
