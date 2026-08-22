# Trove Backoffice

Internal operations dashboard for the Trove Finance platform.

## Overview

Used by the back-office team to manage supply-chain finance programs, entity onboarding, financing requests, disbursements, risk monitoring, and compliance.

## Audience

Internal team members with assigned roles:
- **Super Admin** — full platform access, user management
- **Maker** — entity review, limit assessment, financing assessment
- **Checker** — second-level approval (entity, limits, financing)
- **FI Admin / FI Checker** — financial institution document review and screening
- **Master Anchor Admin** — program and anchor-level oversight

## Key Features

- **Onboarding pipeline** — invitation → entity review → Maker/Checker/FI stages → offer letter
- **Segregation of duties** — Maker ≠ Checker enforced on reviews, limit approvals, and financing approvals
- **6 product types** — Invoice Finance, Reverse Factoring, Invoice Discounting, Blended Finance, Leasing, Warehouse Receipt
- **Financing & disbursement** — assess → approve → disburse (Bank Transfer or M-Pesa) with auto-disburse config per FI pricing
- **Limit management** — two-step assessment + approval with automatic entity limit updates
- **General ledger** — double-entry journal entries posted on disbursement and repayment
- **Risk management** — credit scoring (A+ to D), automated risk alerts, anomaly scanning, AI assistant (Gemini)
- **Bank accounts** — entity disbursement routing with bank details and mobile money
- **Asset schedules** — leasing asset tracking (make, model, depreciation, insurance)
- **Warehouse receipts** — commodity tracking (commodity, grade, collateral manager)
- **Operations Guide** — in-app reference for all workflows, roles, and procedures
- **Data export** — CSV export for any table

## Tech Stack

- React + TypeScript frontend with Tailwind CSS
- ZiteJS backend endpoints
- Zite Database (shared across all Trove apps)
- Gemini AI integration for risk assistant

## Getting Started

1. Sign in with your organisation credentials
2. A Super Admin must assign you a role before you can access the dashboard
3. Your navigation and available actions depend on your assigned role
