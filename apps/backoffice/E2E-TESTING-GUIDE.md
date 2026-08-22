# Trove Platform — E2E Testing Guide

> Step-by-step scenarios for end-to-end testing across the Backoffice and Customer Portal apps.

---

## Prerequisites

1. **Seed test data** — Run the `seedTestData` endpoint from either the Backoffice or Customer Portal to populate realistic test data across all 6 product types. The seed is idempotent (safe to re-run).
2. **User accounts** — You need at least these roles in the Backoffice:
   - 1 × Super Admin
   - 1 × Maker
   - 1 × Checker (different person from Maker)
   - 1 × FI Admin
   - 1 × Partner Admin (linked to a partner)
3. **Customer Portal account** — At least 1 user with a verified entity

---

## Test Scenario 1: Full Onboarding Pipeline

**Goal:** Verify invitation → code verification → KYC → Maker → Checker → FI review → offer letter → acceptance.

### Steps

| # | App | Role | Action | Expected |
|---|-----|------|--------|----------|
| 1 | Backoffice | Super Admin / Maker | Go to **Invitations** → Create invitation for a programme (e.g. Invoice Finance). Note the invitation code | Invitation created with status "Pending" |
| 2 | Customer Portal | New user | Sign up → **Select Product** page → choose the matching product | Product selection screen shows all 6 products |
| 3 | Customer Portal | New user | Enter the invitation code on the **Verify Code** page | Code accepted, redirected to Onboarding |
| 4 | Customer Portal | New user | Complete all KYC stages: company details, director info, bank statement, location photo, etc. | Each stage saves; progress bar advances |
| 5 | Backoffice | Maker | Go to **Entity Review** → find the new entity → click Review → Approve | Entity status moves to "Maker Approved" |
| 6 | Backoffice | Checker | Go to **Checker → Entity Verification** → find the entity → Approve | Status moves to "Checker Approved". Verify the checker is NOT the same person as the maker |
| 7 | Backoffice | FI Admin | Go to **FI Operations → Entity Screening** → find the entity → Review documents → Approve | Status moves to "FI Approved" |
| 8 | Customer Portal | Entity user | Dashboard should show "Pending FI Review" → then offer letter | Offer letter appears with financing limit |
| 9 | Customer Portal | Entity user | View offer letter → Accept | Entity status → "Active", limit is assigned |
| 10 | Backoffice | Any | Go to **Offer Letters** → verify the accepted offer shows "Accepted" | ✓ |

### What to verify
- ✅ Maker ≠ Checker enforcement (same user can't approve both)
- ✅ Onboarding stages appear correctly for entity type (Anchor = 5 stages, Dealer/Supplier = 10 stages)
- ✅ Document uploads are saved and visible in backoffice review
- ✅ Notifications generated at each stage transition

---

## Test Scenario 2: Invoice → Financing → Disbursement → Repayment

**Goal:** Full financing lifecycle from invoice creation to final repayment.

### Steps

| # | App | Role | Action | Expected |
|---|-----|------|--------|----------|
| 1 | Customer Portal | Dealer/Supplier | Go to **Invoices** → Create invoice (fill amount, due date, invoice number) | Invoice created with status "Submitted" |
| 2 | Customer Portal | Anchor Buyer (if Reverse Factoring) | Go to **Anchor Invoices** → Approve the invoice | Invoice status → "Approved" |
| 3 | Customer Portal | Dealer/Supplier | Go to **Financing** → Create financing request against the approved invoice | Request created with status "Pending" |
| 4 | Backoffice | Maker | Go to **Financing Assessment** → find request → Assess (set rate, tenor, approved amount) | Status → "Assessed" |
| 5 | Backoffice | Checker | Go to **Checker → Financing Approval** → find request → Approve | Status → "Approved" |
| 6 | Backoffice | FI Admin | Go to **FI Operations → Financing Approval** → Disburse | Status → "Disbursed". Loan created, journal entry posted |
| 7 | Backoffice | FI Admin | Go to **FI Operations → Loan Book** → find the new loan | Loan visible with correct principal, maturity date |
| 8 | Backoffice | FI Admin | Go to **FI Operations → Ledger & Accounting** → verify journal entry | Balanced debit/credit entry for disbursement |
| 9 | Customer Portal | Dealer/Supplier | Go to **Dashboard** → see active loan → click **Repay** | Repayment form appears |
| 10 | Customer Portal | Dealer | Enter repayment amount → M-Pesa STK Push (or manual) | Loan balance reduced, transaction recorded |
| 11 | Backoffice | FI Admin | Verify in Ledger: repayment journal entry posted | ✓ Balanced debit/credit |
| 12 | Customer Portal | Dealer | Repay remaining balance → verify loan status → "Settled" | ✓ Zero outstanding balance |

### What to verify
- ✅ Financing request amount ≤ entity's remaining limit
- ✅ Loan maturity date computed correctly (from credit period or tenor)
- ✅ Double-entry ledger balanced after disbursement AND repayment
- ✅ Entity limit utilisation updated after disbursement
- ✅ No overpayment allowed (repayment ≤ outstanding)
- ✅ Notifications sent for each status change

---

## Test Scenario 3: Partner White-Label Portal

**Goal:** Verify partners see only their own data and can create programs.

### Steps

| # | App | Role | Action | Expected |
|---|-----|------|--------|----------|
| 1 | Backoffice | Super Admin | Go to **Settings → Users** → assign a user "Partner Admin" role linked to a partner | Role saved with partnerId |
| 2 | Backoffice | Partner Admin | Login → auto-redirect to `/partner/dashboard` | Partner dashboard loads with scoped stats |
| 3 | Backoffice | Partner Admin | Navigate sidebar → verify only partner sections visible | No Maker/Checker/FI/Management sections |
| 4 | Backoffice | Partner Admin | Go to **My Entities** | Only entities linked to this partner appear |
| 5 | Backoffice | Partner Admin | Go to **My Programs** → click "Create Program" | Create program dialog opens |
| 6 | Backoffice | Partner Admin | Fill program details + add FI pricing → Submit | Program created and linked to partner |
| 7 | Backoffice | Partner Admin | Go to **My Invoices** | Only invoices from partner entities shown |
| 8 | Backoffice | Partner Admin | Go to **Loans** | Only loans for partner entities shown |
| 9 | Backoffice | Partner Admin | Go to **API Keys** → Generate a sandbox key | Key generated, shown once, then masked |
| 10 | Backoffice | Partner Admin | Try navigating to `/overview` or `/entity-review` | Redirected or access denied |

### What to verify
- ✅ All data scoped to the partner's entities only
- ✅ Partner cannot access internal Trove pages
- ✅ Created programs are linked back to the partner
- ✅ API key generation works (sandbox + production)

---

## Test Scenario 4: Role Enforcement & Segregation of Duties

**Goal:** Verify role-based access control works correctly.

### Tests

| Test | Action | Expected |
|------|--------|----------|
| Maker approves entity | Maker reviews & approves entity in Entity Review | ✓ Works |
| Same person tries Checker approval | Same user tries to approve in Checker Entity Verification | ✗ Should be blocked — "Cannot approve own review" |
| Different Checker approves | Different user with Checker role approves | ✓ Works |
| FI Admin accesses Maker page | FI Admin navigates to `/entity-review` | ✗ Blocked by RoleGuard |
| Pending user accesses app | User with no assigned role logs in | Shows "Account Pending Approval" screen |
| Partner accesses Management | Partner Admin navigates to `/programs` (management route) | ✗ Blocked — partner only sees `/partner/*` |

---

## Test Scenario 5: Product-Specific Features

### 5a. Leasing — Asset Schedules

| # | Action | Expected |
|---|--------|----------|
| 1 | Create a program with product type "Leasing" | Program created |
| 2 | Onboard an entity, get financing approved + disbursed | Loan created |
| 3 | Go to **Asset Schedules** in backoffice | Asset schedule linked to loan |
| 4 | Verify: make, model, serial, depreciation, insurance dates | All fields populated |
| 5 | Check insurance alerts: expired or expiring within 30 days | Alert badges shown |

### 5b. Warehouse Receipt — Commodity Tracking

| # | Action | Expected |
|---|--------|----------|
| 1 | Create a program with product type "Warehouse Receipt" | Program created |
| 2 | Finance against warehouse receipts | Loan created |
| 3 | Go to **Warehouse Receipts** in backoffice | Receipt visible with commodity details |
| 4 | Verify: collateral manager, commodity type, quantity, value, expiry | All fields populated |
| 5 | Check expiry alerts: expired or expiring within 30 days | Alert badges shown |
| 6 | Toggle pledged/released status | Status updates |

### 5c. Blended Finance — Multi-FI

| # | Action | Expected |
|---|--------|----------|
| 1 | Create a Blended Finance program with ≥2 FI pricing entries | ✓ At least 2 FIs required |
| 2 | Request financing — FIs share the facility | Each FI sees their portion |

---

## Test Scenario 6: Batch Operations & Exports

| # | Action | Expected |
|---|--------|----------|
| 1 | Customer Portal: **Batch Upload** → upload a CSV with 5 invoices | Preview shows 5 rows → confirm creates all |
| 2 | Customer Portal: **Data Export** → export invoices to CSV | CSV downloaded with correct data |
| 3 | Backoffice: **Data Export** → export entities, invoices, loans | CSVs match database records |

---

## Test Scenario 7: Penalty & Overdue Management

| # | App | Action | Expected |
|---|-----|--------|----------|
| 1 | Backoffice | Run **Calculate Penalties** | Penalties accrued on overdue loans |
| 2 | Backoffice | Go to **Overdue Loans** | Loans past maturity listed with classification bands |
| 3 | Backoffice | Verify classification: Watch (1-30d) → Special Mention (31-60d) → Substandard (61-90d) → Doubtful (91-180d) → Loss (180d+) | Correct band applied |
| 4 | Backoffice | Run **Credit Score** computation | Entity scores updated based on repayment history |

---

## Test Scenario 8: Cross-App Consistency

| Test | Expected |
|------|----------|
| Entity created in Customer Portal → visible in Backoffice | ✓ Same record ID |
| Loan disbursed in Backoffice → visible in Customer Portal dashboard | ✓ With correct balance |
| Invoice approved in Backoffice → status updated in Customer Portal | ✓ |
| Repayment recorded in Customer Portal → reflected in Backoffice loan book and ledger | ✓ |
| Notification created in either app → visible in the other app's notification centre | ✓ |

---

## Quick Smoke Tests

Run these after any code change to verify nothing is broken:

1. **Backoffice loads** → Overview page renders with stats
2. **Customer Portal loads** → Landing page renders, login works
3. **All nav links work** → Click every sidebar item, each page renders without error
4. **Create + read cycle** → Create an entity/invoice/loan → verify it appears in the list
5. **Search works** → Type in search box on Entities, Invoices, Loans pages → results filter
6. **Maker-Checker flow** → Quick entity review with 2 different users

---

## Known Limitations / Edge Cases

- **M-Pesa STK Push** requires Safaricom Daraja sandbox credentials; mock in test if unavailable
- **PDF generation** (offer letters, brochures) — verify output opens correctly in PDF viewers
- **Large datasets** — test with 500+ entities/invoices to verify pagination and performance
- **Concurrent access** — two Makers reviewing the same entity simultaneously (last write wins)
- **Browser compatibility** — test in Chrome, Firefox, Safari
