import { CompanyEntity, UserProfile, ClaimVoucher, GLAccount } from '../types';

export const COMPANIES: CompanyEntity[] = [
  {
    id: 'my-corp',
    name: 'MY CORPORATE SERVICES SDN. BHD.',
    regNo: '200101031000 (566759-X)',
    address: 'No. 23, Jalan Sulam, Taman Sentosa, 80150 Johor Bahru, Johor.',
    headerAlign: 'left',
    paymentLabels: {
      cash: 'Cash :',
      cheque: 'Cheque No. :'
    },
    voucherPrefix: 'MCS-PV-'
  },
  {
    id: 'tjw-accounting',
    name: 'T. J. WANG ACCOUNTING MANAGEMENT SDN. BHD.',
    regNo: '197801000977 (37994-U)',
    address: 'No. 24, Jalan Sulam, Taman Sentosa, 80150 Johor Bahru, Johor.',
    headerAlign: 'center',
    paymentLabels: {
      cash: 'Cash :',
      cheque: 'Cheque :'
    },
    voucherPrefix: 'TJW-PV-'
  },
  {
    id: 'ing-wang',
    name: 'ING WANG & CO. (AF 1499)',
    regNo: 'AF 1499',
    subtitle: 'CHARTERED ACCOUNTANTS',
    address: 'No. 23A, Jalan Sulam, Taman Sentosa, 80150 Johor Bahru, Johor.',
    headerAlign: 'center',
    paymentLabels: {
      cash: 'Cash :',
      cheque: 'Cheque :'
    },
    voucherPrefix: 'IWC-PV-'
  },
  {
    id: 'wang-accounting',
    name: 'WANG ACCOUNTING SERVICES (NF 0431)',
    regNo: 'Company No. 199503046384 (JM0224274-M)',
    address: 'No. 24A, Jalan Sulam, Taman Sentosa, 80150 Johor Bahru, Johor.',
    headerAlign: 'center',
    paymentLabels: {
      cash: 'Cash :',
      cheque: 'Cheque :'
    },
    voucherPrefix: 'WAS-PV-'
  },
  {
    id: 'wang-partners',
    name: 'WANG & PARTNERS PLT (NF-2317)',
    regNo: 'Company No. 202106000027 (LLP0029631-LCA)',
    address: 'Room 2 and Room 3, No. 24, Jalan Sulam, Taman Sentosa, 80150 Johor Bahru, Johor.',
    headerAlign: 'left',
    paymentLabels: {
      cash: 'Cash :',
      cheque: 'Cheque :'
    },
    voucherPrefix: 'WPP-PV-'
  }
];

export const USERS: UserProfile[] = [
  {
    id: 'user_01',
    name: 'Tan Wei Ming',
    email: 'weiming@wangaccounting.com.my',
    role: 'staff',
    defaultCompanyId: 'ing-wang'
  },
  {
    id: 'user_02',
    name: 'Sarah Lim',
    email: 'sarah.lim@mycorp.com.my',
    role: 'staff',
    defaultCompanyId: 'my-corp'
  },
  {
    id: 'user_03',
    name: 'Ahmad Razak',
    email: 'ahmad@tjw.com.my',
    role: 'staff',
    defaultCompanyId: 'tjw-accounting'
  },
  {
    id: 'user_04',
    name: 'Mei Ling',
    email: 'meiling@wangservices.com.my',
    role: 'staff',
    defaultCompanyId: 'wang-accounting'
  },
  {
    id: 'user_05',
    name: 'Partner Wang Senior',
    email: 'partner.wang@wangaccounting.com.my',
    role: 'admin',
    defaultCompanyId: 'ing-wang'
  }
];

export const GL_ACCOUNTS: GLAccount[] = [
  { code: '610-010', name: 'Printing & Stationery', category: 'Operating Expenses' },
  { code: '610-020', name: 'Travelling & Petrol', category: 'Operating Expenses' },
  { code: '610-030', name: 'Refreshments & Entertainment', category: 'Operating Expenses' },
  { code: '610-040', name: 'Courier & Postage', category: 'Operating Expenses' },
  { code: '610-050', name: 'Office Maintenance & Repair', category: 'Operating Expenses' },
  { code: '610-060', name: 'Filing & Stamping Fees', category: 'Operating Expenses' },
  { code: '610-070', name: 'Professional Subscriptions & ICAEW', category: 'Operating Expenses' },
  { code: '610-080', name: 'Utilities & Telecommunications', category: 'Operating Expenses' },
  { code: '610-090', name: 'Computer & Software Licenses', category: 'Operating Expenses' }
];

export const INITIAL_CLAIMS: ClaimVoucher[] = [
  {
    id: 'CLM-2026-001',
    voucherNo: 'IWC-PV-2026-008',
    companyId: 'ing-wang',
    claimantId: 'user_01',
    payTo: 'Tan Wei Ming',
    voucherDate: '2026-11-18',
    status: 'approved',
    paymentMethod: 'cheque',
    bankAccountCode: '320-001',
    chequeNo: 'MBB 448912',
    totalAmountRM: 210.50,
    approvedBy: 'Partner Wang Senior',
    createdAt: '2026-11-17',
    items: [
      {
        lineNo: 1,
        date: '2026-11-17',
        merchant: 'Popular Book Co. (M) Sdn Bhd',
        receiptNo: 'INV-992831',
        particulars: 'A4 Double A Paper (3 reams) & Arch Files for Audit Dept',
        accountCode: '610-010',
        accountName: 'Printing & Stationery',
        taxCode: 'NR',
        taxAmountRM: 0.00,
        netAmountRM: 145.50,
        amountRM: 145.50,
        receiptImageUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80'
      },
      {
        lineNo: 2,
        date: '2026-11-18',
        merchant: 'Petronas Taman Sentosa',
        receiptNo: 'RCP-77412',
        particulars: 'Petrol for client site visit (SSM & LHDN runner trip)',
        accountCode: '610-020',
        accountName: 'Travelling & Petrol',
        taxCode: 'NR',
        taxAmountRM: 0.00,
        netAmountRM: 65.00,
        amountRM: 65.00,
        receiptImageUrl: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=80'
      }
    ]
  },
  {
    id: 'CLM-2026-002',
    voucherNo: 'MCS-PV-2026-003',
    companyId: 'my-corp',
    claimantId: 'user_02',
    payTo: 'Sarah Lim',
    voucherDate: '2026-11-19',
    status: 'pending',
    paymentMethod: 'cash',
    bankAccountCode: '310-000',
    totalAmountRM: 88.00,
    createdAt: '2026-11-19',
    items: [
      {
        lineNo: 1,
        date: '2026-11-19',
        merchant: 'Secret Recipe Plaza Pelangi',
        receiptNo: 'SR-88231',
        particulars: 'Client meeting refreshments & tea catering',
        accountCode: '610-030',
        accountName: 'Refreshments & Entertainment',
        taxCode: 'SV',
        taxAmountRM: 4.98,
        netAmountRM: 83.02,
        amountRM: 88.00,
        receiptImageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80'
      }
    ]
  },
  {
    id: 'CLM-2026-003',
    voucherNo: 'TJW-PV-2026-012',
    companyId: 'tjw-accounting',
    claimantId: 'user_03',
    payTo: 'Ahmad Razak',
    voucherDate: '2026-11-16',
    status: 'paid',
    paymentMethod: 'cheque',
    bankAccountCode: '320-001',
    chequeNo: 'CIMB 991204',
    totalAmountRM: 350.00,
    approvedBy: 'Partner Wang Senior',
    createdAt: '2026-11-15',
    items: [
      {
        lineNo: 1,
        date: '2026-11-15',
        merchant: 'Pos Malaysia Berhad JB',
        receiptNo: 'POS-2026-991',
        particulars: 'Courier dispatch for Annual Return & Board resolutions to ROC',
        accountCode: '610-040',
        accountName: 'Courier & Postage',
        taxCode: 'NR',
        taxAmountRM: 0.00,
        netAmountRM: 350.00,
        amountRM: 350.00,
        receiptImageUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80'
      }
    ]
  }
];
