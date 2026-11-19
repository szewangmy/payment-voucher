# Project Specification: Multi-Entity Staff Claim & Payment Voucher System

**Target Platform:** Google AI Studio (Build Mode)

**Currency:** Malaysian Ringgit (RM)

**Core Capabilities:** AI Receipt/Invoice OCR, Multi-Company Entity Routing, Role-Based Approval Workflow, Exact-Layout PDF Payment Voucher Generation, & Accounting Software CSV Export (SQL Accounting / AutoCount compatible).

## 1. Master Prompt for Google AI Studio (Build Mode)

> **Instructions:** Copy and paste the entire prompt below into Google AI Studio's Build Mode to generate the full-stack application.

```
Build a full-stack internal Staff Expense Claim & Payment Voucher Management Web Application using React, Tailwind CSS, and Gemini API (gemini-2.5-flash) for multimodal receipt/invoice OCR.

### 1. Multi-Entity / Department Structure
The organization consists of 5 distinct legal entities (treated as departments). Every user profile, submitted claim, and generated Payment Voucher must belong to one of these 5 entities, using their exact official letterhead details:

1. **MY CORPORATE SERVICES SDN. BHD.**
   - Reg No: `200101031000 (566759-X)`
   - Subtitle: *(None)*
   - Address: `No. 23, Jalan Sulam, Taman Sentosa, 80150 Johor Bahru, Johor.`
   - Header Alignment: Left-aligned company header; right-aligned underlined "PAYMENT VOUCHER" above the grid.
   - Payment Field Label: `Cash :` and `Cheque No. :`

2. **T. J. WANG ACCOUNTING MANAGEMENT SDN. BHD.**
   - Reg No: `197801000977 (37994-U)`
   - Subtitle: *(None)*
   - Address: `No. 24, Jalan Sulam, Taman Sentosa, 80150 Johor Bahru, Johor.`
   - Header Alignment: Center-aligned company header and centered underlined "PAYMENT VOUCHER".
   - Payment Field Label: `Cash :` and `Cheque :`

3. **ING WANG & CO. (AF 1499)**
   - Reg No: *(Included in title: AF 1499)*
   - Subtitle: `CHARTERED ACCOUNTANTS`
   - Address: `No. 23A, Jalan Sulam, Taman Sentosa, 80150 Johor Bahru, Johor.`
   - Header Alignment: Center-aligned company header; right-aligned underlined "PAYMENT VOUCHER" above the grid.
   - Payment Field Label: `Cash :` and `Cheque :`

4. **WANG ACCOUNTING SERVICES (NF 0431)**
   - Reg No: `Company No. 199503046384 (JM0224274-M)`
   - Subtitle: *(None)*
   - Address: `No. 24A, Jalan Sulam, Taman Sentosa, 80150 Johor Bahru, Johor.`
   - Header Alignment: Center-aligned company header and centered underlined "PAYMENT VOUCHER".
   - Payment Field Label: `Cash :` and `Cheque :`

5. **WANG & PARTNERS PLT (NF-2317)**
   - Reg No: `Company No. 202106000027 (LLP0029631-LCA)`
   - Subtitle: *(None)*
   - Address: `Room 2 and Room 3, No. 24, Jalan Sulam, Taman Sentosa, 80150 Johor Bahru, Johor.`
   - Header Alignment: Left-aligned company header; centered underlined "PAYMENT VOUCHER".
   - Payment Field Label: `Cash :` and `Cheque :`

---

### 2. Core User Roles & Workflows
Include a quick role/user switcher in the top navigation bar (plus persistent local storage/state) to test the full lifecycle across multiple users and entities:
- **Staff (Claimant):**
  - Selects which of the 5 companies/entities the claim is charged to (defaults to their assigned entity, with ability to submit cross-entity claims if needed).
  - Uploads one or multiple receipt/invoice images (JPG, PNG, WebP) or PDFs.
  - **AI OCR Extraction:** Uses `gemini-2.5-flash` with Structured JSON Output to read each receipt and extract:
    - `merchant_name`
    - `receipt_date` (YYYY-MM-DD)
    - `receipt_or_invoice_no`
    - `description_summary` (concise line-item summary suitable for "Particulars")
    - `total_amount_rm` (numeric, in RM)
    - `tax_amount_rm` (if SST/service tax is present)
    - `suggested_account_category` (e.g., `610-010 Printing & Stationery`, `610-020 Travelling & Petrol`, `610-030 Refreshments & Entertainment`, `610-040 Courier & Postage`, `610-050 Office Maintenance`, `610-060 Filing & Stamping Fees`)
  - Staff reviews/edits the extracted line items, attaches the receipt thumbnails, and submits the claim.
- **Accounts / Approver (Admin):**
  - Views a unified dashboard filterable by Entity (all 5 companies), Status (`Pending`, `Approved`, `Paid`, `Rejected`), Date Range, and Claimant.
  - Verifies extracted data side-by-side against the uploaded receipt image(s).
  - Assigns **Accounts Allocation** GL code/category (separated into `Account Code` and `Account Description`), selects Payment Method (`Cash` or `Cheque` + Cheque No.), sets Voucher Date, and clicks **Approve**.
  - Generates and downloads/prints the official **Payment Voucher PDF**.
  - Exports filtered approved/paid Payment Vouchers to **Accounting CSV** (compatible with SQL Accounting / AutoCount Payment Voucher import).

---

### 3. Exact Payment Voucher PDF / Print Layout Requirements
Implement a dedicated, print-ready A4 Payment Voucher renderer (`@media print` + one-click PDF export via `html2pdf.js` or `jspdf`) that replicates the exact classic boxed table layout shown in the organization's forms:
- **Typography:** Classic serif font (`Times New Roman`, Georgia, serif) with crisp black borders (`1px solid #000`).
- **Top Letterhead:** Dynamically renders the exact Company Name, Registration Number, Subtitle (e.g., `CHARTERED ACCOUNTANTS` for Ing Wang & Co.), and Address matching the selected entity.
- **Title:** Bold, underlined `PAYMENT VOUCHER`.
- **Main Voucher Grid Structure:**
  - **Row 1 (Header Info):**
    - Left/Center (`~75%` width): `PAY TO : [Staff Full Name]`
    - Right (`~25%` width): `Date: [DD/MM/YYYY]`
  - **Row 2 (Column Headers & Body):**
    - Left Column (`~75%` width): `Particulars :` followed by itemized claim lines (Date, Merchant, Receipt No., Description) neatly listed, with `Cash :` and `Cheque :` / `Cheque No. :` positioned near the bottom-left of the Particulars box.
    - Right Column (`~25%` width, separated by a solid vertical line): Header `Amount` / `RM` (separated by a horizontal border), individual line item amounts aligned right, and the **Total RM** at the bottom right enclosed with a single top border and **double bottom accounting underline** (`border-bottom: 3px double #000`).
  - **Row 3 (Footer / Sign-off Grid):**
    - Separated from the Particulars/Amount section by a full-width horizontal border.
    - Left/Center (`~75%` width):
      - `Received by :` (with signature line/digital stamp)
      - `Approved by :` (with approver name/signature line)
    - Right (`~25%` width, aligned under the Amount column):
      - Centered label `Accounts Allocation` at the top of the cell, with space below displaying the assigned GL/Account code.
- **Appendix Page(s):** Automatically append the attached receipt/invoice images on Page 2+ of the PDF export so the voucher and supporting receipts form a single auditable PDF packet.

---

### 4. Accounting Software CSV Export Specification
Add an **"Export CSV for Accounting"** button on the Accounts Dashboard that exports currently filtered `Approved` or `Paid` vouchers (or selected checkboxes) into a clean, UTF-8 CSV file named `[EntityCode]_PaymentVouchers_[YYYYMMDD].csv`.
- **Granularity:** One row per expense line item (standard multi-line Payment Voucher import format for Malaysian accounting systems like **SQL Accounting** and **AutoCount**), repeating the voucher header fields so each line maps cleanly to a GL Account Code.
- **Exact CSV Columns (in order):**
  1. `DocNo` (Auto-generated Payment Voucher No., e.g., `IWC-PV-2026-008`)
  2. `DocDate` (`DD/MM/YYYY` format matching Malaysian accounting locale)
  3. `EntityName` (Exact company name)
  4. `PayTo` (Staff/Payee Name)
  5. `PaymentMethod` (`CASH` or `CHEQUE`)
  6. `BankAccountCode` (e.g., `310-000` for Cash-in-Hand or `320-001` for Bank)
  7. `ChequeNo` (Cheque number if applicable, blank if Cash)
  8. `LineNo` (`1`, `2`, `3`...)
  9. `AccountCode` (GL Expense Code from Accounts Allocation, e.g., `610-010`)
  10. `AccountName` (GL Expense Name, e.g., `Printing & Stationery`)
  11. `ReceiptDate` (`DD/MM/YYYY` of individual receipt)
  12. `RefNo` (Supplier Receipt / Invoice No.)
  13. `Description` (`[Merchant Name] - [Particulars]`, properly double-quoted to escape commas)
  14. `TaxCode` (e.g., `NR` / `SV` / `ZRL` or blank)
  15. `TaxAmountRM` (`0.00` formatted to 2 decimal places)
  16. `NetAmountRM` (Line amount excluding tax, formatted to 2 decimal places)
  17. `TotalAmountRM` (Line gross amount in RM, formatted to 2 decimal places)
  18. `Status` (`APPROVED` or `PAID`)
  19. `ApprovedBy` (Name of approving partner/manager)
- **Export Options:** Allow exporting either per-entity (recommended so each company imports into its own accounting database/book) or a combined master CSV across all 5 entities.

---

### 5. Seed Data for Immediate Testing
Pre-populate the app with realistic sample users across all 5 entities (e.g., Sarah Lim - Ing Wang & Co., Ahmad Razak - My Corporate Services Sdn. Bhd., Jason Tan - Wang & Partners PLT, Priya Devi - TJ Wang Accounting Management Sdn Bhd, Mei Ling - Wang Accounting Services) and 3 sample claims in different statuses (`Pending`, `Approved`) with realistic Malaysian receipts so the user can immediately test OCR upload, approval, PDF voucher generation, and CSV export.
```

## 2. Entity & Voucher Mapping Reference

The table below documents the exact details extracted from your 5 sample forms (`1.jpg` to `5.jpg`) along with suggested Voucher Prefixes for CSV & PDF numbering:

| \# | Entity Name | Registration / Firm No. | Subtitle | Registered Address | Payment Label | Voucher Prefix |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **MY CORPORATE SERVICES SDN. BHD.** | `200101031000 (566759-X)` | — | No. 23, Jalan Sulam, Taman Sentosa, 80150 Johor Bahru, Johor. | `Cash :` / `Cheque No. :` | `MCS-PV-` |
| **2** | **T. J. WANG ACCOUNTING MANAGEMENT SDN. BHD.** | `197801000977 (37994-U)` | — | No. 24, Jalan Sulam, Taman Sentosa, 80150 Johor Bahru, Johor. | `Cash :` / `Cheque :` | `TJW-PV-` |
| **3** | **ING WANG & CO. (AF 1499)** | `AF 1499` | `CHARTERED ACCOUNTANTS` | No. 23A, Jalan Sulam, Taman Sentosa, 80150 Johor Bahru, Johor. | `Cash :` / `Cheque :` | `IWC-PV-` |
| **4** | **WANG ACCOUNTING SERVICES (NF 0431)** | `Company No. 199503046384 (JM0224274-M)` | — | No. 24A, Jalan Sulam, Taman Sentosa, 80150 Johor Bahru, Johor. | `Cash :` / `Cheque :` | `WAS-PV-` |
| **5** | **WANG & PARTNERS PLT (NF-2317)** | `Company No. 202106000027 (LLP0029631-LCA)` | — | Room 2 and Room 3, No. 24, Jalan Sulam, Taman Sentosa, 80150 Johor Bahru, Johor. | `Cash :` / `Cheque :` | `WPP-PV-` |

## 3. Sample CSV Export Output Structure

Below is an example of the generated CSV file (`IWC_PaymentVouchers_20261119.csv`) structured for direct import into **SQL Accounting**, **AutoCount**, **Xero**, or Excel reconciliation:

```csv
DocNo,DocDate,EntityName,PayTo,PaymentMethod,BankAccountCode,ChequeNo,LineNo,AccountCode,AccountName,ReceiptDate,RefNo,Description,TaxCode,TaxAmountRM,NetAmountRM,TotalAmountRM,Status,ApprovedBy
IWC-PV-2026-008,19/11/2026,"ING WANG & CO. (AF 1499)",Tan Wei Ming,CHEQUE,320-001,MBB 448912,1,610-010,Printing & Stationery,17/11/2026,INV-992831,"Popular Book Co. (M) Sdn Bhd - A4 Double A Paper (3 reams) & Arch Files",NR,0.00,145.50,145.50,APPROVED,Partner Wang
IWC-PV-2026-008,19/11/2026,"ING WANG & CO. (AF 1499)",Tan Wei Ming,CHEQUE,320-001,MBB 448912,2,610-020,Travelling & Petrol,18/11/2026,RCP-77412,"Petronas Taman Sentosa - Petrol for SSM & LHDN runner trip",NR,0.00,65.00,65.00,APPROVED,Partner Wang
```

### Column Mapping Notes for Malaysian Accounting Packages
* **SQL Accounting (Cash Book Entry / Payment Voucher Import):** Map `DocNo` $\rightarrow$ `DocNo`, `DocDate` $\rightarrow$ `DocDate`, `BankAccountCode` $\rightarrow$ `PaymentMethod`, `ChequeNo` $\rightarrow$ `ChequeNo`, `AccountCode` $\rightarrow$ `Account`, `Description` $\rightarrow$ `Description`, and `TotalAmountRM` $\rightarrow$ `Amount`.
* **AutoCount Accounting (AP / Cash Book Payment Import):** Map `DocNo` $\rightarrow$ `DocNo`, `DocDate` $\rightarrow$ `DocDate`, `PayTo` $\rightarrow$ `PayTo`, `AccountCode` $\rightarrow$ `AccNo`, `RefNo` $\rightarrow$ `RefNo2`, and `TotalAmountRM` $\rightarrow$ `Amount`.

## 4. Recommended Data Schema (JSON / Firestore)

If you decide to connect Firebase Firestore in Google AI Studio for persistent multi-user storage across your office, use these three collections:

### `companies` Collection

```json
{
  "id": "my-corp-services",
  "name": "MY CORPORATE SERVICES SDN. BHD.",
  "regNo": "200101031000 (566759-X)",
  "subtitle": "",
  "address": "No. 23, Jalan Sulam, Taman Sentosa, 80150 Johor Bahru, Johor.",
  "chequeLabel": "Cheque No.",
  "voucherPrefix": "MCS-PV-"
}
```

### `users` Collection

```json
{
  "uid": "user_01",
  "name": "Tan Wei Ming",
  "email": "weiming@wangaccounting.com.my",
  "role": "staff",
  "defaultCompanyId": "ing-wang-co"
}
```

### `claims` Collection

```json
{
  "id": "CLM-2026-0014",
  "voucherNo": "IWC-PV-2026-008",
  "companyId": "ing-wang-co",
  "claimantId": "user_01",
  "payTo": "Tan Wei Ming",
  "voucherDate": "2026-11-19",
  "status": "approved",
  "paymentMethod": "cheque",
  "bankAccountCode": "320-001",
  "chequeNo": "MBB 448912",
  "totalAmountRM": 210.50,
  "approvedBy": "Partner Wang",
  "items": [
    {
      "lineNo": 1,
      "date": "2026-11-17",
      "merchant": "Popular Book Co. (M) Sdn Bhd",
      "receiptNo": "INV-992831",
      "particulars": "A4 Double A Paper (3 reams) & Arch Files",
      "accountCode": "610-010",
      "accountName": "Printing & Stationery",
      "taxCode": "NR",
      "taxAmountRM": 0.00,
      "netAmountRM": 145.50,
      "amountRM": 145.50,
      "receiptImageUrl": "data:image/jpeg;base64,..."
    }
  ]
}
```

## 5. Step-by-Step Deployment Guide in Google AI Studio

1. Open [**Google AI Studio**](https://aistudio.google.com/) and select **Build** from the left menu.
2. Paste the **Master Prompt** from Section 1 into the prompt box and run it.
3. Once the prototype loads, test the **Receipt OCR** by uploading a photo of a Malaysian receipt (e.g., Petronas, Popular, Grab, or TNB) and verifying that the RM amount, date, and particulars populate automatically.
4. Click **Approve** on a claim, assign the GL **Accounts Allocation** code, and select **Download Payment Voucher PDF** to verify that the company header, registration number, boxed layout, double-underlined RM total, and `Accounts Allocation` box match your 5 sample templates.
5. Click **Export CSV for Accounting** on the dashboard to download the multi-line CSV ready for import into SQL Accounting or AutoCount.
6. *(Optional)* Click **Connect Firebase** inside AI Studio's Build toolbar to enable real Google Sign-In for your staff and live database syncing across computers.