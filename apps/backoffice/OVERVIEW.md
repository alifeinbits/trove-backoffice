# Trove Backoffice

Internal operations dashboard for the Trove Finance platform. Used by the back-office team to manage supply-chain finance programs, entity onboarding, financing requests, risk monitoring, and compliance.

## Who it's for
Internal team members with assigned roles: Super Admin, Maker, Checker, FI Admin, FI Checker, Master Anchor Admin.

## Key capabilities
- **Full onboarding pipeline** — from invitation to FI screening to offer letter acceptance, with Maker/Checker/FI review stages
- **Segregation of duties** — Maker ≠ Checker enforced on onboarding reviews, limit approvals, and financing approvals
- **6 product types** — Invoice Finance, Reverse Factoring, Invoice Discounting, Blended Finance, Leasing, Warehouse Receipt
- **Limit & financing management** — two-step assessment + approval with automatic entity limit updates and loan creation
- **Auto-disburse** — FI pricing can enable automatic disbursement on approval, creating loans and posting journal entries in one step
- **Repayment recording** — record repayments via loan detail page with validation (no overpayment, auto-settle on zero balance), balanced double-entry journal entries
- **M-Pesa daily limit** — KES 500,000 aggregate daily limit on M-Pesa disbursements, validated at disbursement time
- **General ledger** — double-entry journal entries posted on disbursement and repayment, with FI-wide ledger view
- **Penalty calculation** — daily penalty accrual on overdue loans using FI pricing rates, with default classification bands (Watch → Special Mention → Substandard → Doubtful → Loss)
- **Risk management** — credit scoring (A+ to D), automated risk alerts, anomaly scanning (invoice volume spikes, payment pattern shifts, credit score declines), AI assistant (Gemini)
- **Bank accounts** — entity disbursement routing with bank details and mobile money
- **Asset schedules** — leasing asset tracking with make/model, depreciation, insurance monitoring (no-policy alerts, expiry warnings within 30 days)
- **Warehouse receipts** — WRF commodity tracking with collateral manager, expiry monitoring (30-day warnings), pledged/released status, summary statistics
- **Operations Guide** — in-app reference for all workflows, roles, and procedures
- **Maturity date fix** — loans now correctly compute maturity from program credit period when financing request tenor is not set
- **Full partner portal** — Partner Admins see scoped Programs, Entities, Invoices, Financing Requests, Loans, Transactions, API Keys, and Activity — all data filtered to only their linked entities

## Brand
DM Sans + JetBrains Mono typography, Trove deep green primary (#152 71% 15%), warm cream background, consistent with Customer Portal and Developer Docs.
