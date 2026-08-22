# Trove Platform — Complete Rebuild Prompt

> Paste this into a fresh Zite workspace to recreate the entire Trove supply chain finance platform. Build each app one at a time starting with the database schema, then Backoffice, then Customer Portal, then Developer Docs.

---

## Platform Overview

**Trove** is a multi-app supply chain finance (SCF) operations platform for Kenya. It connects financial institutions (FIs), anchor companies, and their supply chains (dealers & suppliers). Currency: **KES** (Kenyan Shilling). 

It supports **6 financial products**:
1. **Invoice Finance** — Master Anchor → Anchor → Dealer chain; dealers financed against anchor invoices
2. **Reverse Factoring** — Anchor Buyer → Supplier; suppliers receive early payment, anchor buyer is borrower
3. **Invoice Discounting** — Anchor Buyer → Supplier; supplier-led invoice-to-cash conversion
4. **Blended Finance** — Anchor Buyer → Supplier (≥2 FIs); multi-FI capital pools
5. **Leasing** — FI → Dealer/Supplier/Anchor/AB; structured lease financing with asset schedules
6. **Warehouse Receipt** — FI → Supplier/Dealer/Anchor/AB; commodity-collateralised financing with warehouse receipts

**4 apps sharing one database:**
- **Backoffice** (internal) — operations team dashboard
- **Customer Portal** (external) — self-service for supply chain participants
- **Developer Docs** (external) — public API documentation
- **Marketing Brochure** (external) — public landing page

**Brand & Visual Identity:**

*Logo:* The Trove logo is a stylised hexagonal prism (three-sided gem shape) rendered in SVG. Use it in sidebar headers and loading screens:
```svg
<svg viewBox="0 0 24 24" fill="none">
  <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="currentColor" opacity="0.3"/>
  <path d="M12 2L3 7l9 5 9-5-9-5z" fill="currentColor"/>
  <path d="M3 7v10l9 5V12L3 7z" fill="currentColor" opacity="0.7"/>
</svg>
```
Brand text: **"trove"** (lowercase). In the Backoffice sidebar: **"trove ops"**. In the Customer Portal header: **"trove"**.

*Fonts:*
- Primary: **General Sans** (weights 400–700) + **Inter** (fallback) — `--font-sans: 'General Sans', 'Inter', system-ui, sans-serif;`
- Mono: **IBM Plex Mono** (Backoffice/Portal) / **JetBrains Mono** (Developer Docs) — `--font-mono: 'IBM Plex Mono', monospace;`
- Load via:
```
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
@import url('https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap');
```

*Theme — YC fintech style (light only — all apps share this palette):*
```css
--background: 40 12% 97.5%;       /* near-white with barely-there warmth */
--foreground: 150 30% 9%;         /* deep green-black */
--card: 0 0% 100%;                /* pure white cards for contrast */
--card-foreground: 150 30% 9%;
--popover: 0 0% 100%;
--popover-foreground: 150 30% 9%;
--primary: 152 64% 18%;           /* forest green — Trove signature */
--primary-foreground: 0 0% 100%;
--secondary: 40 10% 94%;          /* warm neutral */
--secondary-foreground: 150 25% 10%;
--muted: 40 8% 94.5%;
--muted-foreground: 150 8% 42%;
--accent: 40 10% 93%;
--accent-foreground: 152 60% 14%;
--destructive: 0 72% 51%;
--destructive-foreground: 0 0% 100%;
--border: 40 8% 90%;              /* subtle, barely-there borders */
--input: 40 8% 87%;
--ring: 152 64% 18%;
--radius: 0.5rem;
--chart-1: 152 64% 18%;           /* green */
--chart-2: 40 65% 52%;            /* gold */
--chart-3: 200 65% 45%;           /* blue */
--chart-4: 340 55% 52%;           /* rose */
--chart-5: 280 45% 55%;           /* purple */
```

*Shadows — refined, layered (Mercury/Stripe approach):*
```css
--shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.03);
--shadow: 0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.04);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.04);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.06), 0 4px 6px -4px rgb(0 0 0 / 0.04);
```

*Backoffice sidebar (dark sidebar):*
```css
--sidebar-background: 152 45% 7%;
--sidebar-foreground: 40 12% 78%;
--sidebar-primary: 152 50% 42%;
--sidebar-primary-foreground: 0 0% 100%;
--sidebar-accent: 152 25% 12%;
--sidebar-accent-foreground: 40 12% 92%;
--sidebar-border: 152 18% 13%;
--sidebar-ring: 152 50% 42%;
```

*Customer Portal sidebar (light):*
```css
--sidebar-background: 0 0% 100%;
--sidebar-foreground: 150 20% 15%;
--sidebar-primary: 152 64% 18%;
--sidebar-primary-foreground: 0 0% 100%;
--sidebar-accent: 40 10% 94%;
--sidebar-accent-foreground: 150 20% 12%;
--sidebar-border: 40 8% 90%;
--sidebar-ring: 152 64% 18%;
```

*Landing page brand constants (hardcoded for marketing pages):*
```js
const C = {
  green: '#155c30', greenDark: '#0c2d18', greenLight: '#1e7a3f',
  gold: '#c6a24a', goldLight: '#d4b25e',
  cream: '#f9f8f6', creamDark: '#f3f2ef',
  text: '#111a14', textMuted: '#556059', textLight: '#8a918c',
  border: '#e5e3df',
};
```

---

## DATABASE SCHEMA (30 tables)

Create all tables first before building any app. All currency fields use KES with 2 decimal places. All percent fields store decimals (0.5 = 50%).

### Core Tables

**1. Invitations**
- code (primary, single_line_text) — format: TRV-YYYY-NNNN
- entityName (single_line_text)
- entityType (single_select: Dealer, Supplier, Anchor Buyer, Anchor)
- contactEmail (email)
- contactPhone (phone_number)
- status (single_select: Pending Sign-up, Signed Up, Onboarding, Expired)
- sentVia (multiple_select: Email, SMS)
- sentAt (datetime)
- expiresAt (datetime)
- createdBy (user field)
- productType (single_select: Invoice Finance, Reverse Factoring, Invoice Discounting, Blended Finance, Leasing, Warehouse Receipt)
- program (linked_record → Programs)
- recommenderEntity (linked_record → Entities)
- proposedLimit (currency, KES)
- notes (long_text)
- createdAt (created_at)

**2. Entities**
- name (primary, single_line_text)
- entityType (single_select: Dealer, Supplier, Anchor Buyer, Anchor, Master Anchor, FI)
- kycStatus (single_select: Pending, In Review, Approved, Rejected)
- contactEmail (email)
- contactPhone (phone_number)
- registrationNumber (single_line_text)
- approvedLimit (currency, KES)
- kraPin (single_line_text)
- businessSector (single_line_text)
- physicalAddress (single_line_text)
- onboardingStatus (single_select: Not Started, In Progress, Awaiting Review, Active, Suspended)
- owner (user field)
- createdAt (created_at)
- *Links to: invitations (2 links), programs, loans, onboardings, entity owners, entity operators, limit proposals, invoices (2 links — as supplier and as buyer), financing requests (2 links), offer letters, journal entries, credit scores, risk alerts, bank accounts, asset schedules, warehouse receipts*

**3. Programs**
- name (primary, single_line_text)
- productType (single_select: 6 product types)
- anchorEntity (linked_record → Entities)
- status (single_select: Active, Suspended, Closed)
- description (long_text)
- programSize (currency, KES)
- creditPeriodDays (number, 0 decimals)
- financePercentage (percent, 1 decimal)
- minParticipantLimit (currency, KES)
- maxParticipantLimit (currency, KES)
- approvalDate (date)
- renewalDate (date)
- programOwnerType (single_select: Master Anchor, Anchor Buyer, FI)
- createdAt (created_at)

**4. Notifications**
- title (primary, single_line_text)
- message (long_text)
- type (single_select: Entity Approved, Entity Rejected, Limit Offer, Financing Approved, Disbursement, Repayment Confirmed, Loan Overdue, Compliance Alert)
- read (checkbox)
- linkPath (single_line_text)
- recipient (user field)
- createdAt (created_at)

**5. System Settings**
- key (primary, single_line_text)
- value (long_text)
- description (long_text)
- updatedBy (single_line_text)
- updatedAt (updated_at)

**6. Backoffice Users**
- name (primary, single_line_text)
- role (single_select: Super Admin, Maker, Checker, FI Admin, FI Checker, Master Anchor Admin, Partner Admin)
- user (user field, single, deleteRowWhenUserDeleted: true)
- apiPartner (linked_record → Api Partners) — set when role is Partner Admin
- createdAt (created_at)

### Onboarding Pipeline Tables

**7. Onboardings** *(the core workflow table)*
- onboardingNumber (primary, autonumber)
- entity (linked_record → Entities)
- program (linked_record → Programs)
- productType (single_select: 6 types)
- entityType (single_select: Dealer, Supplier, Anchor Buyer, Anchor)
- currentStage (single_select with 17 values: Business Details, Document Upload, Owner Details, Owner KYC Documents, Location Photo, Bank Statement, Bank Details, Operators, Limit Proposal, Submitted for Review, Maker Review, Checker Review, FI Document Review, Sent to FI, Offer Generated, Awaiting Offer Response, Completed)
- overallStatus (single_select: Not Started, In Progress, Awaiting Review, Approved, Rejected, Pending FI Review, FI Approved, Sent to FI, Offer Received, Offer Accepted, Completed)
- owner (user field)
- invitation (linked_record → Invitations)
- businessDetailsJson (long_text)
- bankDetailsJson (long_text)
- makerReviewedBy (single_line_text)
- makerReviewedAt (datetime)
- makerNotes (long_text)
- checkerReviewedBy (single_line_text)
- checkerReviewedAt (datetime)
- checkerNotes (long_text)
- fiReviewedBy (single_line_text)
- fiReviewedAt (datetime)
- fiReviewNotes (long_text)
- createdAt (created_at)
- updatedAt (updated_at)

**8. Onboarding Documents**
- documentName (primary, single_line_text)
- onboarding (linked_record → Onboardings)
- documentType (single_line_text) — types: Business Registration, KRA PIN Certificate, CR12, National ID, Bank Statement, Business Permit, Location Photo
- verificationStatus (single_select: Pending Verification, Verified, Rejected)
- notes (long_text)

**9. Entity Owners**
- fullName (primary, single_line_text)
- entity (linked_record → Entities)
- idNumber (single_line_text)
- idType (single_select: National ID, Passport)
- dateOfBirth (date)
- phone (phone_number)
- email (email)
- ownershipPercentage (percent)
- isPrimaryContact (checkbox)
- idDocument (attachments)
- kraPin (single_line_text)

**10. Entity Operators**
- fullName (primary, single_line_text)
- entity (linked_record → Entities)
- idNumber (single_line_text)
- role (single_line_text)
- phoneNumber (phone_number)
- email (email)

### Financing Tables

**11. Limit Proposals**
- proposedAmount (currency, KES)
- entity (linked_record → Entities)
- program (linked_record → Programs)
- onboarding (linked_record → Onboardings)
- approvedAmount (currency, KES)
- currency (single_line_text, default "KES")
- preferredTenorDays (number)
- status (single_select: Pending, Assessed, Under Review, Approved, Rejected)
- justification (long_text)
- assessedBy (single_line_text)
- assessedAt (datetime)
- approvedBy (single_line_text)
- approvedAt (datetime)
- rejectionReason (long_text)

**12. Invoices**
- invoiceNumber (primary, single_line_text) — format: INV-YYYY-NNNNN
- issuerEntity (linked_record → Entities) — the supplier/dealer
- recipientEntity (linked_record → Entities) — the buyer/anchor
- program (linked_record → Programs)
- productType (single_line_text)
- amount (currency, KES)
- issueDate (date)
- dueDate (date)
- status (single_select: Uploaded, Verified, Finance Eligible, Financed, Paid, Partially Paid, Early Paid, Draft, Submitted, Approved, Rejected)
- description (long_text)

**13. Financing Requests**
- requestingEntity (linked_record → Entities)
- borrowerEntity (linked_record → Entities)
- program (linked_record → Programs)
- invoices (linked_record → Invoices)
- loans (linked_record → Loans)
- productType (single_line_text)
- requestedAmount (currency, KES)
- financeableAmount (currency, KES)
- interestRate (percent)
- tenorDays (number)
- status (single_select: Pending, Assessed, Under Review, Approved, Rejected, Disbursed, Pending Approval)
- assessedBy (single_line_text)
- assessedAt (datetime)
- assessmentNotes (long_text)
- approvedBy (single_line_text)
- approvedAt (datetime)
- rejectionReason (long_text)
- comments (long_text)
- currency (single_line_text, default "KES")

**14. Offer Letters**
- entity (linked_record → Entities)
- onboarding (linked_record → Onboardings)
- program (linked_record → Programs)
- approvedLimit (currency, KES)
- interestRate (percent)
- tenorDays (number)
- status (single_select: Generated, Sent, Accepted, Rejected, Expired, Draft)
- expiryDate (date)
- notes (long_text)

**15. Loans**
- loanReference (primary, single_line_text) — format: LN-NNNNN
- entity (linked_record → Entities)
- program (linked_record → Programs)
- productType (single_line_text)
- principal (currency, KES)
- outstandingBalance (currency, KES)
- interestRate (percent)
- penaltyAmount (currency, KES)
- status (single_select: Active, Overdue, Settled, Written Off, Restructured)
- disbursedAt (datetime)
- maturityDate (date)
- daysOverdue (number)
- borrowerEntityType (single_line_text)
- transactions (linked_record → Transactions)

**16. Transactions**
- reference (primary, single_line_text) — format: TXN-D-NNNNN or TXN-R-NNNNN
- loan (linked_record → Loans)
- type (single_select: Disbursement, Repayment, Fee, Interest, Penalty)
- amount (currency, KES)
- paymentMethod (single_select: Bank Transfer, M-Pesa, Cheque)
- mPesaReceipt (single_line_text) — M-Pesa confirmation code
- status (single_select: Pending, Completed, Failed, Reversed)

**17. Financial Institutions**
- legalName (primary, single_line_text)
- tradingName (single_line_text)
- contactEmail (email)
- contactPhone (phone_number)
- bankCode (single_line_text)
- swiftCode (single_line_text)
- status (single_select: Active, Suspended)
- country (single_line_text, default "KE")
- currency (single_line_text, default "KES")

**18. FI Program Pricing**
- pricingName (primary, single_line_text)
- financialInstitution (linked_record → Financial Institutions)
- program (linked_record → Programs)
- productType (single_line_text)
- minLimit (currency, KES)
- maxLimit (currency, KES)
- transactionFeeRate (percent)
- processingFeeFixed (currency, KES)
- processingFeeRate (percent)
- penaltyFeeRate (percent)
- pastDueDailyRate (percent)
- status (single_select: Active, Expired)

### Accounting Tables

**19. GL Accounts**
- accountNumber (primary, single_line_text) — e.g. 1100, 1110, 2100, 4100
- accountName (single_line_text)
- accountType (single_select: Asset, Liability, Equity, Revenue, Expense)
- subType (single_line_text)
- normalBalance (single_select: Debit, Credit)
- description (long_text)
- isActive (checkbox)
- currentBalance (currency, KES)

**20. Journal Entries**
- entryDate (date)
- reference (single_line_text) — format: JE-DISB-NNNNN or JE-RPMT-NNNNN
- description (long_text)
- status (single_select: Draft, Posted, Reversed)
- totalAmount (currency, KES)
- entity (linked_record → Entities)
- program (linked_record → Programs)
- financingRequest (linked_record → Financing Requests)
- loan (linked_record → Loans)

**21. Journal Lines**
- journalEntry (linked_record → Journal Entries)
- glAccount (linked_record → GL Accounts)
- debitAmount (currency, KES)
- creditAmount (currency, KES)
- narration (long_text)

### Risk Tables

**22. Credit Scores**
- entityName (primary, single_line_text)
- entity (linked_record → Entities)
- score (number) — 0-100
- rating (single_select: A+, A, B, C, D) — A+ ≥90, A ≥75, B ≥60, C ≥40, D < 40
- paymentTimelinessScore (number)
- tradeVolumeScore (number)
- defaultRateScore (number)
- entityAgeScore (number)
- productDiversityScore (number)
- onTimePercent (percent)
- totalTradeVolume (currency, KES)
- defaultRate (percent)
- computedAt (datetime)

**23. Risk Alerts**
- title (primary, single_line_text)
- entity (linked_record → Entities)
- program (linked_record → Programs)
- alertType (single_select: Payment Pattern Shift, Credit Score Decline, High Concentration, Overdue Payment, Credit Deterioration, Limit Breach, Anomaly Detected)
- severity (single_select: Low, Warning, High, Critical)
- description (long_text)
- status (single_select: Open, Acknowledged, Resolved, Escalated)
- detectedAt (datetime)
- resolvedBy (single_line_text)
- resolvedAt (datetime)
- resolutionNotes (long_text)

### Asset Tables

**24. Bank Accounts**
- bankName (primary, single_line_text)
- entity (linked_record → Entities)
- branchName (single_line_text)
- accountNumber (single_line_text)
- accountType (single_select: Current, Savings)
- mpesaNumber (single_line_text)
- isPrimary (checkbox)

**25. Asset Schedules** (for Leasing product)
- assetDescription (primary, single_line_text)
- entity (linked_record → Entities)
- program (linked_record → Programs)
- loan (linked_record → Loans)
- make (single_line_text)
- model (single_line_text)
- serialNumber (single_line_text)
- purchaseDate (date)
- purchasePrice (currency, KES)
- depreciationMethod (single_line_text)
- usefulLifeYears (number)
- residualValue (currency, KES)
- currentValue (currency, KES)
- insuranceProvider (single_line_text)
- insurancePolicyNumber (single_line_text)
- insuranceExpiry (date)
- status (single_select: Active, Disposed, Written Off)

**26. Warehouse Receipts** (for WRF product)
- receiptNumber (primary, single_line_text)
- entity (linked_record → Entities)
- program (linked_record → Programs)
- loan (linked_record → Loans)
- commodity (single_line_text)
- grade (single_line_text)
- quantity (number)
- unit (single_line_text)
- warehouseName (single_line_text)
- warehouseLocation (single_line_text)
- collateralManagerName (single_line_text)
- depositDate (date)
- expiryDate (date)
- estimatedValue (currency, KES)
- status (single_select: Active, Released, Expired)

### Partner & API Tables

**27. API Partners**
- partnerName (primary, single_line_text)
- partnerType (single_select: Technology, Financial, Distribution, Other)
- contactEmail (email)
- contactPhone (phone_number)
- status (single_select: Active, Suspended, Pending)
- environment (single_select: Sandbox, Production)
- website (url)
- description (long_text)
- entities (linked_record → Entities)
- programs (linked_record → Programs)
- createdAt (created_at)

**28. API Keys**
- keyName (primary, single_line_text)
- apiPartner (linked_record → API Partners)
- keyPrefix (single_line_text) — first 8 chars of the key (for identification)
- keyHash (single_line_text) — SHA-256 hash of the full key
- environment (single_select: Sandbox, Production)
- status (single_select: Active, Revoked)
- lastUsedAt (datetime)
- createdAt (created_at)

**29. API Activity Log**
- action (primary, single_line_text)
- apiPartner (linked_record → API Partners)
- method (single_line_text)
- path (single_line_text)
- statusCode (number)
- responseTime (number) — milliseconds
- ipAddress (single_line_text)
- createdAt (created_at)

**30. Reminder Templates**
- templateName (primary, single_line_text)
- category (single_select: Overdue Payment, Document Request, Limit Expiry, Onboarding Follow-up, Offer Expiry, General)
- subject (long_text)
- body (long_text) — supports variable placeholders: {{entity_name}}, {{loan_reference}}, {{outstanding_balance}}, {{days_overdue}}, {{penalty_amount}}
- channel (single_select: In-App Notification, Email, SMS)
- active (checkbox, default true)
- createdAt (created_at)
- updatedAt (updated_at)

---

## APP 1: BACKOFFICE (Internal)

Auth: magic link + Google. Role-based access. Partner white-label portal.

### Backend Endpoints (Workflows)

**Role Management:**
- `getCurrentUserRole` — looks up signed-in user in Backoffice Users table, returns their role, partnerId, partnerName (if Partner Admin)
- `getBackofficeUsers` — lists all backoffice users with roles
- `updateBackofficeUserRole` — Super Admin changes a user's role (validates partnerId when role is Partner Admin)

**Dashboard:**
- `getOverview` — SQL aggregates: total entities, active programs, pending onboardings, active/overdue loans, total disbursed, recent activity
- `getPartnerOverview` — partner-scoped dashboard: entity count, program count, loan stats, recent activity

**Partner Management:**
- `getPartnersList` — list all API partners
- `getPartnerDetail` — single partner with stats
- `createPartner` / `updatePartner` — CRUD for API partners
- `getPartnerPrograms` — programs linked to a partner
- `getPartnerEntities` — entities via partner programs
- `getPartnerInvoices` / `getPartnerLoans` / `getPartnerFinancing` / `getPartnerTransactions` — partner-scoped data views
- `generateApiKey` / `revokeApiKey` — API key lifecycle for partners

**Entity Management:**
- `getEntitiesForReview` — entities with kycStatus = Pending or In Review
- `getEntityDetail` — full entity with owners, operators, bank accounts, programs, loans, credit scores
- `updateEntityKyc` — update entity KYC status

**Onboarding Pipeline (core workflow):**
- `getOnboardingsList` — all onboardings with stage/status filters
- `getOnboardingDetail` — full onboarding with documents, limit proposals, offer letters, review history
- `reviewOnboarding` — **Maker or Checker reviews an onboarding**:
  - Input: onboardingId, reviewerRole (Maker/Checker), decision (Approved/Rejected), notes
  - Maker approval → moves to Checker Review stage
  - Checker approval → moves to Sent to FI stage + updates entity KYC to Approved
  - Rejection → sets overallStatus to Rejected + updates entity KYC to Rejected
  - **SEGREGATION OF DUTIES: Checker cannot be the same person as the Maker reviewer (compared by name string)**
- `reviewOnboardingFi` — **FI Admin screens an entity**:
  - Input: onboardingId, decision (Approved/Rejected), notes
  - Only allowed when stage is "Sent to FI" or "FI Document Review"
  - Approval → moves to Offer Generated stage with FI Approved status
  - Rejection → stays at FI Document Review with Rejected status

**Limit Management:**
- `getLimitProposalsList` — all limit proposals with status filters
- `assessLimitProposal` — Maker assesses a limit proposal (sets assessedBy, assessedAt, assessment notes, status → Assessed)
- `approveLimitProposal` — **Checker/FI approves or rejects with approved amount**:
  - **SEGREGATION: approver ≠ assessor (compared by name string)**
  - On approval: updates entity's approvedLimit to the approved amount

**Financing Management:**
- `getFinancingRequestsList` — all financing requests with status filters
- `assessFinancingRequest` — Maker assesses (sets assessedBy, status → Assessed/Under Review)
- `approveFinancingRequest` — **Checker/FI approves or rejects**:
  - **SEGREGATION: approver ≠ assessor**
  - On approval: can create a loan record

**Invitation Management:**
- `getInvitations` — list all invitations with filters
- `createInvitation` — create new invitation with code, entity details, product type, program link, proposed limit
- `resendInvitation` — resend an existing invitation

**FI Screening:**
- `getFiScreeningQueue` — onboardings at Sent to FI / FI Document Review stages

**Other Operations:**
- `getInvoicesList` / `getInvoiceDetail` / `updateInvoiceStatus`
- `getTransactionsList`
- `getOfferLettersList`
- `getFinancialInstitutions` / `saveFiPricing`
- `getPrograms` / `getProgramDetail`
- `getOverdueLoans` — overdue loans with **default classification bands** (Watch 1-30d, Special Mention 31-60d, Substandard 61-90d, Doubtful 91-180d, Loss 180d+) and aggregated stats per band
- `getLoanDetail` — full loan detail with transactions, **charges timeline** (penalty/interest/fee entries), **penalty breakdown** (daily rate, accrued total, projected 7d/30d), **reminder history** (notifications sent for the loan), and default classification
- `calculatePenalties` — **daily penalty accrual** for all overdue loans:
  - Looks up FI Program Pricing for each loan's program to get `pastDueDailyRate`
  - Falls back to 0.1%/day default if no pricing set
  - Calculates daily penalty charge = outstanding balance × daily rate
  - Updates each loan's `penaltyAmount` with new accrued total
  - Returns per-loan breakdown with classification

**Reminder Templates & Sending:**
- `getReminderTemplates` — lists all reminder templates, optionally filtered by category
- `saveReminderTemplate` — creates or updates a reminder template (name, category, subject, body, channel, active flag)
- `sendReminder` — **FI users invoke reminders** using a template:
  - Input: templateId + optional entityId/loanId
  - Supports variable substitution: `{{entity_name}}`, `{{loan_reference}}`, `{{outstanding_balance}}`, `{{days_overdue}}`, `{{penalty_amount}}`
  - Variables auto-filled from actual entity/loan data
  - Creates notification record with substituted content

**Risk & Compliance:**
- `computeCreditScores` — SQL-based scoring algorithm:
  - 5 components: payment timeliness (on-time loan %), trade volume (log scale), default rate (inverse), entity age (months), product diversity (unique product types)
  - Grades: A+ ≥90, A ≥75, B ≥60, C ≥40, D < 40
- `getCreditScores` — list all credit scores
- `getRiskAlerts` / `updateRiskAlert` (acknowledge/resolve/escalate)
- `runAnomalyScan` — detects payment pattern shifts and credit score declines via SQL
- `getComplianceAlerts`

**AI & Documents:**
- `aiAssistant` — **streaming** Gemini chat for risk analysis and operational queries (requires Gemini integration)
- `analyzeDocument` — AI document analysis using Gemini
- `verifyDocument` — mark onboarding document as verified/rejected

**PDF Generation:**
- `generateOfferLetterPdf` — professional PDF with financing terms
- `generateBrochurePdf` — platform brochure PDF

**Notifications:**
- `getBackofficeNotifications` — user's notifications
- `markBackofficeNotificationRead`
- `generateReminders` — create reminder notifications for overdue items

**System:**
- `getSystemSettings` / `updateSystemSetting`
- `exportTableCsv` — CSV export of any database table (allowlisted set covering ALL 26 tables)
- `seedTestData` — **phased seeding** (see Seeding section below)

### Frontend Pages & Layout

**Layout:** Collapsible sidebar with role-based section visibility:
- **Maker section** (visible to Maker/Super Admin): Entity Review, Limits, Financing
- **Checker section** (visible to Checker/Super Admin): Checker Entities, Checker Limits, Checker Financing, Invoices
- **FI section** (visible to FI Admin/FI Checker/Super Admin): Entity Screening, FI Limits, FI Financing, **Reminders** (template management + send flow)
- **Partner section** (visible to Partner Admin/Super Admin): Partner Dashboard, Partner Entities, Partner Programs, Partner API Keys, Partner Activity
- **Management section** (visible to Super Admin/Master Anchor Admin): Programs, Invite Entities, Onboardings, Offer Letters, Financial Institutions, Partners
- **Finance section**: Transactions
- **Risk section**: Credit Scores, Risk Alerts, AI Assistant, Compliance, Overdue Loans
- **Always visible**: Overview, Notifications, Settings, Operations Guide, Data Export
- Sidebar has logout button
- Brand: "trove ops" in sidebar header

**Pages:**
- OverviewPage — dashboard with KPI cards and activity feed
- EntityReviewPage — Maker entity review queue with approve/reject
- EntityDetailPage — full entity profile with all linked records
- CheckerEntitiesPage / CheckerLimitsPage / CheckerFinancingPage — Checker queues
- FiEntityScreeningPage / FiLimitsPage / FiFinancingPage — FI queues
- **FiRemindersPage** — FI reminder template management:
  - CRUD for templates with categories (Overdue Payment, Document Request, Limit Expiry, Onboarding Follow-up, Offer Expiry, General)
  - Channel selection (In-App Notification, Email, SMS)
  - Variable reference panel showing available placeholders
  - Send dialog targeting specific overdue loans with auto-substitution
  - Active/inactive toggle per template
- ProgramsPage / ProgramDetailPage — program management
- InviteEntitiesPage — create invitations
- OnboardingsPage / OnboardingDetailPage — onboarding pipeline management
- OfferLettersPage — offer letter list
- InvoicesPage / InvoiceDetailPage — invoice management
- FinancingPage — financing request management (Maker)
- LimitsPage — limit proposal management (Maker)
- TransactionsPage — transaction ledger
- FinancialInstitutionsPage — FI and pricing management
- CreditScoresPage — credit score display
- RiskAlertsPage — risk alert management
- AiAssistantPage — Gemini chat interface
- CompliancePage — compliance dashboard
- OverdueLoansPage / LoanDetailPage — overdue loan management with **default classification bands** (Watch/Special Mention/Substandard/Doubtful/Loss), clickable band filters, "Run Penalty Calc" button, **penalty breakdown sidebar**, **charges timeline tab**, **reminders tab**
- NotificationsPage — notification center
- SettingsPage — system settings
- OperationsGuidePage — in-app documentation of all workflows, roles, procedures
- DataExportPage — CSV export UI for all tables

### Partner White-Label Pages (visible to Partner Admin)
- PartnerDashboardPage — partner-scoped KPIs: entities, programs, loans, recent activity
- PartnerEntitiesPage — entities linked through partner programs
- PartnerProgramsPage — partner's programs with create dialog
- PartnerApiKeysPage — generate/revoke API keys
- PartnerActivityPage — partner transaction/event log
- PartnerInvoicesPage / PartnerLoansPage / PartnerFinancingPage / PartnerTransactionsPage — filtered views

### RoleContext Component
- Fetches current user's role from `getCurrentUserRole` endpoint
- Provides role via React context
- `RoleGuard` component shows content only if user's role has access to that section

---

## APP 2: CUSTOMER PORTAL (External)

Auth: magic link + Google. External access for supply chain participants.

### Backend Endpoints

- `validateCode` — validates invitation code, returns programme/product context
- `autoLinkInvitation` — auto-matches signed-in user's email to pending Invitations and claims them
- `saveOnboardingStep` — saves each onboarding step's data (stage-by-stage progression)
- `getOnboarding` — returns current user's onboarding with stage data
- `getDashboard` — role-aware KPIs and summaries
- `getEntityProfile` — current user's entity profile
- `getMyPrograms` — programmes the user belongs to
- `getInvoices` / `createInvoice` — invoice CRUD
- `getDirectionalInvoices` — invoices filtered by issuer/recipient role
- `batchUploadInvoices` — CSV upload creating multiple invoices
- `approveInvoice` — Anchor Buyer approves/rejects supplier invoices
- `createFinancingRequest` — submit financing request
- `getFinancingRequests` / `getLimits` — view financing and limits
- `getLoan` / `getTransactions` — loan and transaction views
- `initiateStkPush` — M-Pesa STK Push for dealer repayments (Safaricom Daraja API)
- `mpesaCallback` — **webhook** for Safaricom Daraja callbacks, auto-updates loan balance
- `respondToOffer` — accept/reject offer letter
- `generateOfferLetterPdf` — PDF generation
- `inviteDealer` — Anchors invite dealers into their programmes
- `getAnchorInvitations` — list invitations created by anchor
- `postDisbursementLedger` — creates balanced journal entry on disbursement:
  - Debit Loans Receivable, Credit Cash/Bank, Credit Fee Revenue, Credit Interest Revenue
- `postRepaymentLedger` — creates balanced journal entry on repayment:
  - Debit Cash/Bank, Credit Loans Receivable, Credit Interest Revenue
- `getLedger` — returns journal entries + lines for an entity
- `getNotifications` / `markNotificationRead` / `getUnreadCount`
- `exportTableCsv` — CSV export
- `seedTestData` — seeds all tables with test data (idempotent check — skips if FIs already exist)

### Frontend Pages

- **LandingPage** — marketing-style page with all 6 product types, capabilities, onboarding flow, FAQ (honest about Kenya pilot status)
- **ProductSelectionPage** — choose financial product
- **VerifyCodePage** — validate invitation code
- **OnboardingPage** — multi-stage form:
  - Anchors: 5 stages (Business Details, Document Upload, Bank Details, Limit Proposal, Submitted for Review)
  - Others: 10 stages (Business Details, Document Upload, Owner Details, Owner KYC Docs, Location Photo, Bank Statement, Bank Details, Operators, Limit Proposal, Submitted for Review)
  - Shows FI review status after internal approval
- **DashboardPage** — role-aware KPIs, quick actions, recent loans/transactions
- **InvoicesPage** — create and view invoices
- **SupplierInvoicesPage** — supplier's submitted invoices
- **AnchorInvoicesPage** — Anchor Buyer invoice approval queue
- **BatchUploadPage** — CSV invoice upload with preview/validation
- **FinancingPage** — submit and track financing requests
- **LimitsPage** — view approved limits and utilization
- **LoanDetailPage** — loan detail with repayment options
- **RepaymentPage** — M-Pesa STK Push (dealers) or bank transfer instructions (anchor buyers)
- **OfferLetterPage** — view/accept/reject offer letters, generate PDF
- **InviteDealersPage** — Anchors invite dealers
- **TransactionsPage** — transaction history
- **EntityProfilePage** — view/edit entity profile
- **NotificationsPage** — notification center with badges
- **LedgerPage** — double-entry journal entries and lines
- **PartnerSignupPage** — API partner registration flow
- **DevDashboardPage** — developer sandbox dashboard with API key management
- **DataExportPage** — CSV export

### ProgramContext
- Header dropdown for switching between user's programmes
- Persisted in localStorage
- All data-fetching endpoints accept programId filter

---

## APP 3: DEVELOPER DOCS (External)

Public API documentation site. No auth required. Stripe-docs-inspired layout.

### Configuration
- Access mode: external
- No authentication needed
- SEO title: "Trove Docs"
- Same brand theme (General Sans + JetBrains Mono for code, forest green/warm white palette)

### Layout — DocsLayout Component
- Fixed top nav bar with "trove docs" brand, search shortcut (⌘K), and responsive mobile menu toggle
- Left sidebar with collapsible navigation sections
- Main content area with `max-w-3xl` reading width
- **SearchDialog** component — ⌘K searchable index of all pages, filters by title

### Navigation Structure & Pages

**Getting Started:**
- **Overview** (`/`) — API base URL (`https://api.platform.com/v1`), quick-start steps, pagination (limit/offset), rate limits (100 req/min)
- **Authentication** (`/authentication`) — Bearer token auth (`sk_live_*` / `sk_test_*`), key types, permission scopes (Super Admin, Program Manager, Analyst, Auditor), security best practices
- **Error Handling** (`/errors`) — HTTP status codes, error response format, common error codes

**Products** (one page per product with entity hierarchy, flow, and use case):
- **Invoice Finance** (`/products/invoice-finance`) — Master Anchor → Anchor → Dealer flow
- **Reverse Factoring** (`/products/reverse-factoring`) — Anchor Buyer → Supplier flow
- **Invoice Discounting** (`/products/invoice-discounting`) — Supplier-led invoice-to-cash
- **Blended Finance** (`/products/blended-finance`) — Multi-FI capital pools
- **Leasing** (`/products/leasing`) — Structured lease with asset schedules
- **Warehouse Receipts** (`/products/warehouse-receipt`) — Commodity-collateralised financing

**API Reference** (each page has endpoint table with method, path, curl examples, request/response JSON schemas):
- **Programs** (`/api/programs`) — CRUD + list with filters
- **Entities** (`/api/entities`) — Entity management, KYC status updates
- **Onboarding** (`/api/onboarding`) — Stage progression, document upload
- **Invoices** (`/api/invoices`) — Invoice lifecycle, batch upload
- **Financing** (`/api/financing`) — Request, assess, approve flows
- **Transactions** (`/api/transactions`) — Disbursement + repayment records
- **Limits** (`/api/limits`) — Limit proposals and approvals
- **Loans** (`/api/loans`) — Loan status, overdue tracking

**Guides:**
- **System Actors & Roles** (`/guides/roles`) — Full role matrix: Super Admin, Maker, Checker, FI Admin, FI Checker, Master Anchor Admin + entity types (Dealer, Supplier, Anchor Buyer, Anchor, Master Anchor, FI)
- **Approval Workflows** (`/guides/approvals`) — Maker → Checker → FI pipeline with flow diagram, segregation of duties rules
- **Disbursement & Repayment** (`/guides/disbursement`) — End-to-end money flow, M-Pesa STK Push, journal entry creation
- **Status Transitions** (`/guides/status-transitions`) — State machines for all key tables (Onboardings 17 stages, Invoices, Financing Requests, Loans, Limit Proposals)
- **Verification Checklists** (`/guides/verification`) — Document verification requirements per entity type

### Shared Components
- `DocComponents.tsx` — reusable code block, endpoint table, request/response viewer, section heading components used across all doc pages

---

## APP 4: MARKETING BROCHURE (External)

Public landing/brochure page for the Trove platform. Currently a placeholder (only `main.tsx` exists — no `App.tsx` built yet).

### Configuration
- Access mode: external
- No authentication needed
- Same brand theme (General Sans + JetBrains Mono for code, forest green/warm white palette)

### Intended Design
- **Hero section** — bold headline about supply chain finance in East Africa, CTA button linking to Customer Portal sign-up
- **Products overview** — visual cards for all 6 financial product types with short descriptions
- **How it works** — step-by-step (Get invited → Complete onboarding → Get financed → Repay)
- **Platform capabilities** — multi-FI support, M-Pesa integration, real-time risk scoring, double-entry ledger
- **Trust signals** — KES currency focus, Kenyan market, regulatory compliance emphasis
- **Footer** — links to Developer Docs, Customer Portal, contact info
- **Fully responsive** — mobile-first, single-page scroll design
- Uses the Trove SVG logo and "trove" brand text

---

## SEEDING SPECIFICATION

### Backoffice seedTestData (phased, idempotent via matchOn)

**Phase 1: Foundation**
- 16 GL Accounts (1100-5110): Trade Receivables, Loans Receivable, Interest Receivable, Penalty Receivable, Bank - KES Operating, Bank - M-Pesa Float, FI Funding Payable, Anchor Payable, Supplier Payable, Retained Earnings, Interest Income, Transaction Fee Income, Processing Fee Income, Penalty Income, Provision for Bad Debts, Platform Operating Costs
- 3 Financial Institutions: KCB, Equity Bank, Co-op Bank (with realistic Kenya bank codes and SWIFT)
- 8 Programs across all 6 product types (KES 150M-1B program sizes)
- 6 FI Program Pricing records linking FIs to programs with realistic fee structures
- ~48 Entities: 8 Anchor Buyers, 20 Suppliers, 15 Dealers, 3 FIs, 2 Master Anchors (all Kenyan businesses with realistic names, KRA PINs, sectors)
- ~40 Entity Owners with realistic Kenyan names
- Onboardings across ALL 17 stages (Completed, Submitted for Review, Maker Review, Checker Review, Sent to FI, FI Document Review, Offer Generated, Awaiting Offer Response, Business Details, Document Upload, Bank Details) with appropriate maker/checker/FI review timestamps
- Onboarding Documents (2-6 per onboarding): Business Registration, KRA PIN Certificate, CR12, National ID, Bank Statement, Business Permit, Location Photo
- 40 Invitations with varied statuses

**Phase 2: Invoices**
- ~500 invoices across 18 months with statuses: Uploaded, Verified, Finance Eligible, Financed, Paid, Partially Paid, Early Paid

**Phase 3: Loans + Financing Requests**
- 200 Loans (mix of Active, Overdue, Settled) with realistic principals (KES 100K-10M)
- 200 Financing Requests linked to loans
- Transactions: disbursement for every loan + repayments (full for Settled, partial for Active/Overdue)

**Phase 4: Ledger**
- Journal Entries for first 100 loans (disbursement + repayment entries)
- Journal Lines: 2 balanced lines per entry (Debit Loans Receivable / Credit Bank for disbursement; reverse for repayment)

**Phase 5: Credit Scoring + Risk**
- Credit Scores computed via SQL (payment timeliness, trade volume, default rate, entity age, product diversity)
- Risk Alerts from SQL queries (payment pattern shifts for entities with >30% overdue; credit score declines for scores < 45)
- Limit Proposals for eligible onboardings
- Offer Letters for approved onboardings

### Customer Portal seedTestData
- Creates FIs, programs, entities, invitations, onboardings, invoices, loans, financing requests, transactions, limit proposals, offer letters
- Simpler structure but covers all 6 product types
- Idempotent — checks if FIs exist before running

---

## INTEGRATION REQUIREMENTS

- **Gemini AI** — connect to Backoffice app for AI Assistant (streaming chat endpoint)
- Access token available as `ZITE_GEMINI_ACCESS_TOKEN`
- **M-Pesa / Safaricom Daraja** — Customer Portal uses an env var `ZITE_MPESA_CONSUMER_KEY` and `ZITE_MPESA_CONSUMER_SECRET` for STK Push initiation + webhook callback

---

## BRAND KIT NOTES

All 4 apps must use the same visual identity:
- Load `General Sans` (from Fontshare) + `Inter` (from Google Fonts) via `@import` at the top of each app's `index.css`
- Set the same HSL palette in every app's `:root` (see Brand section above)
- Use pure white cards (`--card: 0 0% 100%`) against barely-warm background (`--background: 40 12% 97.5%`) for clear hierarchy
- Use the Trove SVG logo consistently in headers/sidebars/loading screens
- Light theme only — no `.dark {}` block needed (include one for completeness but don't activate)
- Border radius: `0.5rem` across all apps
- Shadows: hand-tuned layered shadows (subtle, not formula-based)
- YC fintech style: crisp, restrained, confident — think Mercury, Ramp, Brex

---

## IMPORTANT IMPLEMENTATION RULES

1. **Segregation of duties** is regulatory — enforce in backend endpoints, not just UI. Compare reviewer names as strings
2. **Double-entry accounting** must always balance (total debits = total credits per journal entry)
3. **All currency values** in KES, 2 decimal places
4. **Percent fields** stored as decimals (0.5 = 50%, 1.0 = 100%)
5. **Role-based UI** — sidebar sections visible only to authorized roles
6. **The 17-stage onboarding pipeline** is the core workflow — each stage has specific data requirements
7. **Seed data must be idempotent** — use `matchOn` for bulkCreate upserts, safe to re-run
8. **CSV export** available in both Backoffice and Customer Portal for backup/testing, covering ALL tables
9. **Streaming** for AI Assistant endpoint (Gemini chat)
10. **M-Pesa webhook** for Customer Portal repayment callbacks
