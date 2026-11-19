export type UserRole = 'staff' | 'admin' | 'partner';

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
  name: string;
  email: string;
  role: UserRole;
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
  taxCode: string; // 'NR' (Non-Reg), 'SV' (Standard 8%), 'ZRL' (Zero)
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
  companyId: string;
  claimantId: string;
  payTo: string;
  voucherDate: string;
  status: ClaimStatus;
  paymentMethod: PaymentMethod;
  bankAccountCode: string; // e.g. '310-000' or '320-001'
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
