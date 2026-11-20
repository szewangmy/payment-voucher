export type UserRole = 'staff' | 'manager' | 'accounts' | 'admin';

export interface CompanyEntity {
  id: string;
  name: string;
  regNo: string;
  subtitle?: string;
  address: string;
  headerAlign: 'left' | 'center';
  paymentLabels: {
    cash: string;
    cheque: string;
  };
  voucherPrefix: string;
}

export interface UserProfile {
  id: string;
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  assignedEntities: string[]; // array of company IDs
  defaultCompanyId: string;
  avatar?: string;
}

export interface ExpenseItem {
  lineNo: number;
  date: string;
  merchant: string;
  receiptNo: string;
  particulars: string;
  accountCode: string;
  accountName: string;
  taxCode: string; // 'NR', 'SV', 'ZRL'
  taxAmountRM: number;
  netAmountRM: number;
  amountRM: number;
  receiptImageUrl?: string;
}

export type ClaimStatus = 'pending' | 'approved' | 'paid' | 'rejected';
export type PaymentMethod = 'cash' | 'cheque';

export interface ClaimVoucher {
  id: string;
  voucherNo: string;
  companyId: string; // companyEntityId
  companyEntityId: string;
  claimantId: string;
  createdByUid: string;
  payTo: string;
  voucherDate: string;
  status: ClaimStatus;
  paymentMethod: PaymentMethod;
  bankAccountCode: string;
  chequeNo?: string;
  totalAmountRM: number;
  approvedBy?: string;
  rejectionReason?: string;
  createdAt: string;
  items: ExpenseItem[];
}

export interface GLAccount {
  code: string;
  name: string;
  category: string;
}
