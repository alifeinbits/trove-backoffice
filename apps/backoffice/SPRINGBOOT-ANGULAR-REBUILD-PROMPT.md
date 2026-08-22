# Trove Platform — Java Spring Boot Microservices + Angular Rebuild Prompt

> Use this document to rebuild the entire Trove supply chain finance platform using **Java 21 + Spring Boot 3.x microservices** (backend) and **Angular 17+** (frontend). The system is currently running on a ZiteJS (React + Node) stack and this prompt captures every domain rule, data model, business logic, and UI specification needed to recreate it faithfully.

---

## 1. PLATFORM OVERVIEW

**Trove** is a multi-app supply chain finance (SCF) operations platform for Kenya. It connects financial institutions (FIs), anchor companies, and their supply chains (dealers & suppliers). Currency: **KES** (Kenyan Shilling).

It supports **6 financial products**:
1. **Invoice Finance** — Master Anchor → Anchor → Dealer chain; dealers financed against anchor invoices
2. **Reverse Factoring** — Anchor Buyer → Supplier; suppliers receive early payment, anchor buyer is borrower
3. **Invoice Discounting** — Anchor Buyer → Supplier; supplier-led invoice-to-cash conversion
4. **Blended Finance** — Anchor Buyer → Supplier (≥2 FIs); multi-FI capital pools
5. **Leasing** — FI → Dealer/Supplier/Anchor/AB; structured lease financing with asset schedules
6. **Warehouse Receipt** — FI → Supplier/Dealer/Anchor/AB; commodity-collateralised financing with warehouse receipts

**4 frontend applications sharing one database:**
- **Backoffice** (internal) — operations team dashboard
- **Customer Portal** (external) — self-service for supply chain participants
- **Developer Docs** (external) — public API documentation
- **Marketing Brochure** (external) — public landing page

---

## 2. MICROSERVICES ARCHITECTURE

### 2.1 Recommended Service Decomposition

```
┌─────────────────────────────────────────────────────────────────────┐
│                        API Gateway (Spring Cloud Gateway)           │
│                   - Route to microservices                          │
│                   - JWT validation                                  │
│                   - Rate limiting (100 req/min)                     │
│                   - CORS for Angular frontends                      │
└──────────┬──────────┬──────────┬──────────┬──────────┬──────────────┘
           │          │          │          │          │
    ┌──────▼──┐ ┌─────▼────┐ ┌──▼──────┐ ┌▼────────┐ ┌▼──────────┐
    │ Auth    │ │ Entity   │ │Financing│ │ Risk &  │ │ Partner & │
    │ Service │ │ Service  │ │ Service │ │Compliance│ │ API Svc   │
    └─────────┘ └──────────┘ └─────────┘ └─────────┘ └───────────┘
                     │              │
              ┌──────▼──┐    ┌──────▼──────┐
              │Onboarding│   │ Accounting  │
              │ Service  │   │ Service     │
              └─────────┘    └─────────────┘
```

### 2.2 Service Breakdown

#### 2.2.1 `trove-auth-service`
**Responsibilities:** Authentication, authorization, user management, role management
- **Tech:** Spring Security + **Keycloak** (recommended), **Logto**, or **Zitadel** as the identity provider (IdP)
- **Tables owned:** `backoffice_users`
- **Roles:** Super Admin, Maker, Checker, FI Admin, FI Checker, Master Anchor Admin, Partner Admin

**Identity Provider Options (pick one):**

| Provider | Best For | Notes |
|----------|----------|-------|
| **Keycloak** | Self-hosted, full control, mature ecosystem | Most popular open-source IAM. Deploy alongside your services. Supports OIDC, SAML, social login, MFA, fine-grained RBAC via realm roles. Spring Boot has first-class support via `spring-boot-starter-oauth2-resource-server`. |
| **Logto** | Developer experience, modern UI, quick setup | Open-source, cloud or self-hosted. Built-in beautiful sign-in UI. OIDC-compliant. Good for startups — less config than Keycloak. Has SDKs for Angular (`@logto/js`) and Spring Boot. |
| **Zitadel** | Cloud-native, multi-tenant, API-first | Open-source, written in Go. Built-in multi-tenancy (good for partner white-labeling). OIDC-compliant. gRPC + REST APIs. Strong audit logging. Spring Boot integration via standard OIDC resource server. |

**Recommended: Keycloak** — widest community, easiest Spring Boot integration, proven at scale in fintech.

**Keycloak Setup:**
```yaml
# docker-compose.yml addition
keycloak:
  image: quay.io/keycloak/keycloak:24.0
  command: start-dev
  environment:
    KC_DB: postgres
    KC_DB_URL: jdbc:postgresql://postgres:5432/keycloak
    KC_DB_USERNAME: keycloak
    KC_DB_PASSWORD: ${KC_DB_PASSWORD}
    KEYCLOAK_ADMIN: admin
    KEYCLOAK_ADMIN_PASSWORD: ${KC_ADMIN_PASSWORD}
  ports: ["8180:8080"]
```

**Keycloak Realm Configuration:**
- Realm: `trove`
- Clients:
  - `trove-backoffice` (public, PKCE) — for Backoffice Angular app
  - `trove-portal` (public, PKCE) — for Customer Portal Angular app
  - `trove-api` (confidential) — for service-to-service calls
- Realm roles: `super_admin`, `maker`, `checker`, `fi_admin`, `fi_checker`, `master_anchor_admin`, `partner_admin`
- Identity providers: Google (social login)
- Authentication flows: Browser (username/password + OTP), Magic link (custom authenticator SPI or use Keycloak's built-in "magic link" authenticator from keycloak-magic-link extension)
- Client scopes: `roles` (maps realm roles into JWT `realm_access.roles` claim)

**Spring Boot Resource Server Config:**
```java
// application.yml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: http://keycloak:8180/realms/trove
          jwk-set-uri: http://keycloak:8180/realms/trove/protocol/openid-connect/certs

// SecurityConfig.java
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthConverter()))
            )
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/public/**").permitAll()
                .requestMatchers("/api/admin/**").hasRole("SUPER_ADMIN")
                .anyRequest().authenticated()
            );
        return http.build();
    }

    private JwtAuthenticationConverter jwtAuthConverter() {
        var converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> {
            // Extract roles from Keycloak's realm_access.roles claim
            var realmAccess = (Map<String, Object>) jwt.getClaims().get("realm_access");
            var roles = (List<String>) realmAccess.get("roles");
            return roles.stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role.toUpperCase()))
                .collect(Collectors.toList());
        });
        return converter;
    }
}
```

**Angular Integration (all apps):**
```typescript
// Use angular-auth-oidc-client (works with Keycloak, Logto, and Zitadel)
// npm install angular-auth-oidc-client

// app.config.ts
import { provideAuth, LogLevel } from 'angular-auth-oidc-client';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAuth({
      config: {
        authority: 'http://keycloak:8180/realms/trove',
        redirectUrl: window.location.origin,
        postLogoutRedirectUri: window.location.origin,
        clientId: 'trove-backoffice', // or 'trove-portal'
        scope: 'openid profile email roles',
        responseType: 'code',
        silentRenew: true,
        useRefreshToken: true,
        logLevel: LogLevel.Warn,
      },
    }),
  ],
};
```

**If using Logto instead:**
```yaml
# docker-compose.yml
logto:
  image: svhd/logto:latest
  environment:
    DB_URL: postgresql://logto:${LOGTO_DB_PASSWORD}@postgres:5432/logto
  ports: ["3301:3001", "3302:3002"]  # 3001=admin, 3002=auth
```
- Spring Boot: same `spring-boot-starter-oauth2-resource-server` — just change `issuer-uri` to Logto's endpoint
- Angular: same `angular-auth-oidc-client` — change `authority` to Logto's endpoint

**If using Zitadel instead:**
```yaml
# docker-compose.yml
zitadel:
  image: ghcr.io/zitadel/zitadel:latest
  command: start-from-init --masterkey "your-master-key" --tlsMode disabled
  environment:
    ZITADEL_DATABASE_POSTGRES_HOST: postgres
    ZITADEL_DATABASE_POSTGRES_PORT: 5432
    ZITADEL_DATABASE_POSTGRES_DATABASE: zitadel
    ZITADEL_DATABASE_POSTGRES_USER_USERNAME: zitadel
    ZITADEL_DATABASE_POSTGRES_USER_PASSWORD: ${ZITADEL_DB_PASSWORD}
    ZITADEL_EXTERNALDOMAIN: localhost
    ZITADEL_EXTERNALPORT: 8080
  ports: ["8280:8080"]
```
- Spring Boot: same resource server config — change `issuer-uri` to `http://zitadel:8280`
- Angular: same OIDC client — change `authority`
- Bonus: Zitadel has built-in multi-tenancy via "organizations", which maps well to Trove's partner white-labeling

- **Key APIs:**
  - `GET /auth/me` — current user + role + partnerId/partnerName (reads from JWT claims + `backoffice_users` table)
  - `GET /auth/users` — list backoffice users (Super Admin only)
  - `PUT /auth/users/{id}/role` — update user role (validates partnerId when role = "Partner Admin")
  - User creation/login/logout are handled entirely by the IdP (Keycloak/Logto/Zitadel) — no custom auth endpoints needed

#### 2.2.2 `trove-entity-service`
**Responsibilities:** Entity CRUD, KYC management, invitations, entity owners/operators, bank accounts
- **Tables owned:** `entities`, `invitations`, `entity_owners`, `entity_operators`, `bank_accounts`
- **Key APIs:**
  - `GET /entities` — list with filters (kycStatus, entityType, onboardingStatus, search)
  - `GET /entities/{id}` — full detail with owners, operators, bank accounts, programs, loans, credit scores
  - `PUT /entities/{id}/kyc` — update KYC status (Approved/Rejected/In Review)
  - `GET /entities/review-queue` — entities with kycStatus = Pending or In Review
  - `POST /invitations` — create invitation (code format: TRV-YYYY-NNNN)
  - `GET /invitations` — list with status filter
  - `POST /invitations/{id}/resend`
  - `PUT /entities/{id}/self-invoicing` — toggle self-invoicing flag

#### 2.2.3 `trove-onboarding-service`
**Responsibilities:** Onboarding pipeline (17-stage workflow), document management, Maker/Checker/FI review
- **Tables owned:** `onboardings`, `onboarding_documents`
- **17 stages:** Business Details → Document Upload → Owner Details → Owner KYC Documents → Location Photo → Bank Statement → Bank Details → Operators → Limit Proposal → Submitted for Review → Maker Review → Checker Review → FI Document Review → Sent to FI → Offer Generated → Awaiting Offer Response → Completed
- **Key APIs:**
  - `GET /onboardings` — list with stage/status filters
  - `GET /onboardings/{id}` — full detail with documents, limit proposals, offer letters, review history
  - `POST /onboardings/{id}/review` — **Maker or Checker review** (critical business logic):
    - Input: reviewerRole (Maker/Checker), decision (Approved/Rejected), notes
    - Maker approval → moves to "Checker Review" stage
    - Checker approval → moves to "Sent to FI" stage + updates entity KYC to Approved
    - Rejection → sets overallStatus to Rejected + updates entity KYC to Rejected
    - **⚠️ SEGREGATION OF DUTIES: Checker cannot be the same person as the Maker reviewer (compared by name string)**
  - `POST /onboardings/{id}/fi-review` — **FI Admin review**:
    - Only allowed when stage is "Sent to FI" or "FI Document Review"
    - Approval → moves to "Offer Generated" stage with "FI Approved" status
    - Rejection → stays at "FI Document Review" with Rejected status
  - `POST /onboardings/{id}/save-step` — save step data (stage-by-stage progression, Customer Portal)
  - `GET /onboardings/{id}/documents` — list onboarding documents
  - `PUT /onboarding-documents/{id}/verify` — verify or reject a document
  - `POST /onboarding-documents` — upload document (with file attachment)
  - `POST /onboarding-documents/{id}/analyze` — AI document analysis (calls Gemini)

#### 2.2.4 `trove-financing-service`
**Responsibilities:** Programs, limit proposals, financing requests, invoices, offer letters, loans, transactions
- **Tables owned:** `programs`, `limit_proposals`, `invoices`, `financing_requests`, `offer_letters`, `loans`, `transactions`, `financial_institutions`, `fi_program_pricing`
- **Key APIs:**

  **Programs:**
  - `GET /programs` — list with filters
  - `GET /programs/{id}` — detail with entities, invoices, loans, pricing
  - `POST /programs` — create (Partner Admins can create for their partner)

  **Limit Proposals:**
  - `GET /limit-proposals` — list with status filter
  - `POST /limit-proposals/{id}/assess` — Maker assesses (sets assessedBy, status → Assessed)
  - `POST /limit-proposals/{id}/approve` — **Checker/FI approves or rejects with approved amount**:
    - **⚠️ SEGREGATION: approver ≠ assessor (compared by name string)**
    - On approval: updates entity's approvedLimit to the approved amount

  **Invoices:**
  - `GET /invoices` — list with status/date/entity filters
  - `GET /invoices/{id}` — full detail
  - `PUT /invoices/{id}/status` — update invoice status
  - `POST /invoices` — create invoice
  - `POST /invoices/batch` — CSV batch upload

  **Financing Requests:**
  - `GET /financing-requests` — list with status filter
  - `POST /financing-requests` — create financing request
  - `POST /financing-requests/{id}/assess` — Maker assesses
  - `POST /financing-requests/{id}/approve` — **Checker/FI approves or rejects**:
    - **⚠️ SEGREGATION: approver ≠ assessor**
    - On approval: creates loan record
  - `POST /financing-requests/{id}/disburse` — disburse (creates loan + transaction + journal entries)

  **Offer Letters:**
  - `GET /offer-letters` — list
  - `POST /offer-letters/{id}/respond` — accept/reject
  - `GET /offer-letters/{id}/pdf` — generate PDF

  **Loans:**
  - `GET /loans` — list with status filter
  - `GET /loans/{id}` — full detail with transactions, charges timeline, penalty breakdown, reminder history, default classification
  - `GET /loans/overdue` — overdue loans with **default classification bands**:
    - Watch: 1-30 days overdue
    - Special Mention: 31-60 days
    - Substandard: 61-90 days
    - Doubtful: 91-180 days
    - Loss: 180+ days
  - `POST /loans/calculate-penalties` — **daily penalty accrual** for all overdue loans:
    - Looks up FI Program Pricing for each loan's program to get `pastDueDailyRate`
    - Falls back to 0.1%/day default if no pricing set
    - Daily penalty = outstanding balance × daily rate
    - Updates each loan's `penaltyAmount`
  - `POST /loans/{id}/repayment` — record repayment

  **Transactions:**
  - `GET /transactions` — list with type/date filters

  **Financial Institutions:**
  - `GET /financial-institutions` — list
  - `POST /fi-program-pricing` — save/update FI pricing for a program

#### 2.2.5 `trove-accounting-service`
**Responsibilities:** Double-entry ledger, GL accounts, journal entries and lines
- **Tables owned:** `gl_accounts`, `journal_entries`, `journal_lines`
- **⚠️ RULE: Double-entry accounting must ALWAYS balance (total debits = total credits per journal entry)**
- **Key APIs:**
  - `GET /gl-accounts` — list all GL accounts
  - `GET /ledger` — journal entries + lines for an entity
  - `POST /ledger/disbursement` — creates balanced journal entry on disbursement:
    - Debit: Loans Receivable, Credit: Cash/Bank, Credit: Fee Revenue, Credit: Interest Revenue
  - `POST /ledger/repayment` — creates balanced journal entry on repayment:
    - Debit: Cash/Bank, Credit: Loans Receivable, Credit: Interest Revenue

  **16 GL Accounts (seed data):**
  | Number | Name | Type | Normal Balance |
  |--------|------|------|----------------|
  | 1100 | Trade Receivables | Asset | Debit |
  | 1110 | Loans Receivable | Asset | Debit |
  | 1120 | Interest Receivable | Asset | Debit |
  | 1130 | Penalty Receivable | Asset | Debit |
  | 1200 | Bank - KES Operating | Asset | Debit |
  | 1210 | Bank - M-Pesa Float | Asset | Debit |
  | 2100 | FI Funding Payable | Liability | Credit |
  | 2200 | Anchor Payable | Liability | Credit |
  | 2300 | Supplier Payable | Liability | Credit |
  | 3100 | Retained Earnings | Equity | Credit |
  | 4100 | Interest Income | Revenue | Credit |
  | 4200 | Transaction Fee Income | Revenue | Credit |
  | 4300 | Processing Fee Income | Revenue | Credit |
  | 4400 | Penalty Income | Revenue | Credit |
  | 5100 | Provision for Bad Debts | Expense | Debit |
  | 5110 | Platform Operating Costs | Expense | Debit |

#### 2.2.6 `trove-risk-service`
**Responsibilities:** Credit scoring, risk alerts, anomaly detection, compliance
- **Tables owned:** `credit_scores`, `risk_alerts`
- **Key APIs:**
  - `POST /credit-scores/compute` — SQL-based scoring algorithm:
    - 5 components: payment timeliness (on-time loan %), trade volume (log scale), default rate (inverse), entity age (months), product diversity (unique product types)
    - Grades: A+ ≥90, A ≥75, B ≥60, C ≥40, D < 40
  - `GET /credit-scores` — list all
  - `GET /risk-alerts` — list with status/severity filters
  - `PUT /risk-alerts/{id}` — acknowledge/resolve/escalate
  - `POST /risk-alerts/anomaly-scan` — detects:
    - Payment pattern shifts (entities with >30% overdue loans)
    - Credit score declines (scores < 45)
  - `GET /compliance/alerts` — compliance-focused view

#### 2.2.7 `trove-partner-service`
**Responsibilities:** API partner management, API key lifecycle, partner activity log
- **Tables owned:** `api_partners`, `api_keys`, `api_activity_log`
- **Key APIs:**
  - `GET /partners` — list all
  - `GET /partners/{id}` — detail with stats
  - `POST /partners` — create
  - `PUT /partners/{id}` — update
  - `POST /partners/{id}/api-keys` — generate API key
  - `DELETE /api-keys/{id}` — revoke
  - `GET /partners/{id}/activity` — activity log
  - `GET /partners/{id}/programs` — partner-scoped programs (via `api_partners_programs` join table)
  - `GET /partners/{id}/entities` — partner-scoped entities
  - `GET /partners/{id}/invoices` — partner-scoped invoices
  - `GET /partners/{id}/loans` — partner-scoped loans
  - `GET /partners/{id}/financing` — partner-scoped financing requests
  - `GET /partners/{id}/transactions` — partner-scoped transactions
  - `GET /partners/{id}/overview` — partner dashboard KPIs

#### 2.2.8 `trove-notification-service`
**Responsibilities:** Notifications, reminder templates, sending reminders
- **Tables owned:** `notifications`, `reminder_templates`
- **Key APIs:**
  - `GET /notifications` — user's notifications
  - `PUT /notifications/{id}/read` — mark read
  - `GET /notifications/unread-count`
  - `GET /reminder-templates` — list, optionally filtered by category
  - `POST /reminder-templates` — create/update template
  - `POST /reminders/send` — send reminder using template:
    - Variable substitution: `{{entity_name}}`, `{{loan_reference}}`, `{{outstanding_balance}}`, `{{days_overdue}}`, `{{penalty_amount}}`
    - Variables auto-filled from actual entity/loan data
    - Creates notification record with substituted content
  - `POST /reminders/generate` — auto-generate reminders for overdue items

#### 2.2.9 `trove-ai-service`
**Responsibilities:** AI-powered assistant, document analysis
- **Tech:** Google Gemini API (via REST or SDK)
- **Key APIs:**
  - `POST /ai/chat` — **streaming** chat endpoint (SSE) for risk analysis and operational queries
  - `POST /ai/analyze-document` — document analysis

#### 2.2.10 `trove-report-service`
**Responsibilities:** PDF generation, CSV export, dashboard aggregates
- **Key APIs:**
  - `GET /reports/overview` — dashboard KPIs (SQL aggregates)
  - `GET /reports/export/{table}` — CSV export for any table (allowlisted)
  - `POST /reports/offer-letter-pdf` — generate offer letter PDF
  - `POST /reports/brochure-pdf` — generate brochure PDF
  - `POST /reports/pitch-deck-pdf` — generate pitch deck PDF

#### 2.2.11 `trove-mpesa-service` (Customer Portal only)
**Responsibilities:** M-Pesa STK Push integration for dealer repayments
- **Tech:** Safaricom Daraja API
- **Key APIs:**
  - `POST /mpesa/stk-push` — initiate STK Push
  - `POST /mpesa/callback` — **webhook** for Daraja callbacks, auto-updates loan balance
- **Env vars:** `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`

### 2.3 Shared Libraries

Create a `trove-commons` Maven module with:
- **DTOs** — shared request/response objects
- **Enums** — EntityType, ProductType, OnboardingStage (17 values), KycStatus, LoanStatus, InvoiceStatus, etc.
- **Exceptions** — `TroveBusinessException`, `SegregationOfDutiesViolation`, `UnbalancedJournalEntryException`
- **Utils** — `KesFormatter` (2 decimal places), `CodeGenerator` (TRV-YYYY-NNNN, INV-YYYY-NNNNN, LN-NNNNN, TXN-D-NNNNN)
- **Security** — JWT token utils, role annotations (`@RequiresRole("Maker")`, `@RequiresAnyRole("Checker", "Super Admin")`)
- **Audit** — `@Auditable` annotation for tracking who changed what

### 2.4 Infrastructure

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: trove
      POSTGRES_USER: trove
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  rabbitmq:  # or Kafka
    image: rabbitmq:3-management
    ports: ["5672:5672", "15672:15672"]

  gateway:
    build: ./trove-gateway
    ports: ["8080:8080"]
    depends_on: [auth-service, entity-service, ...]

  auth-service:
    build: ./trove-auth-service
    ports: ["8081:8081"]

  entity-service:
    build: ./trove-entity-service
    ports: ["8082:8082"]

  # ... etc for each service
```

**Recommended Stack:**
- Java 21 + Spring Boot 3.2+
- Spring Cloud Gateway (API gateway)
- Spring Security + OAuth2 Resource Server
- Spring Data JPA + Hibernate
- PostgreSQL 16
- Flyway (database migrations)
- Redis (session cache, rate limiting)
- RabbitMQ or Kafka (inter-service events: entity.approved, loan.disbursed, etc.)
- Spring Cloud OpenFeign (service-to-service calls)
- Springdoc OpenAPI (Swagger UI per service)
- Testcontainers (integration tests)
- MapStruct (DTO mapping)
- Lombok

---

## 3. DATABASE SCHEMA (PostgreSQL)

### 3.1 Naming Conventions
- Table names: `snake_case` (e.g. `financing_requests`)
- Column names: `snake_case`
- Join tables: `{table1}_{table2}` (e.g. `entities_programs`)
- Primary keys: `id UUID DEFAULT gen_random_uuid()`
- Timestamps: `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ`
- All currency columns: `DECIMAL(15,2)` — KES with 2 decimal places
- All percent columns: `DECIMAL(8,4)` — stored as decimals (0.5 = 50%)
- Soft deletes: `deleted_at TIMESTAMPTZ NULL`

### 3.2 Flyway Migration Scripts

#### V1__core_tables.sql

```sql
-- Enums as PostgreSQL types
CREATE TYPE entity_type AS ENUM ('Dealer', 'Supplier', 'Anchor Buyer', 'Anchor', 'Master Anchor', 'FI');
CREATE TYPE kyc_status AS ENUM ('Pending', 'In Review', 'Approved', 'Rejected');
CREATE TYPE onboarding_status AS ENUM ('Not Started', 'In Progress', 'Awaiting Review', 'Active', 'Suspended');
CREATE TYPE product_type AS ENUM ('Invoice Finance', 'Reverse Factoring', 'Invoice Discounting', 'Blended Finance', 'Leasing', 'Warehouse Receipt');
CREATE TYPE invitation_status AS ENUM ('Pending Sign-up', 'Signed Up', 'Onboarding', 'Expired');
CREATE TYPE program_status AS ENUM ('Active', 'Suspended', 'Closed');
CREATE TYPE program_owner_type AS ENUM ('Master Anchor', 'Anchor Buyer', 'FI');
CREATE TYPE loan_status AS ENUM ('Active', 'Overdue', 'Settled', 'Written Off', 'Restructured');
CREATE TYPE transaction_type AS ENUM ('Disbursement', 'Repayment', 'Fee', 'Interest', 'Penalty');
CREATE TYPE payment_method AS ENUM ('Bank Transfer', 'M-Pesa', 'System', 'Cheque');
CREATE TYPE transaction_status AS ENUM ('Pending', 'Completed', 'Failed', 'Reversed');
CREATE TYPE notification_type AS ENUM ('Entity Approved', 'Entity Rejected', 'Limit Offer', 'Financing Approved', 'Disbursement', 'Repayment Confirmed', 'Loan Overdue', 'Compliance Alert');
CREATE TYPE onboarding_stage AS ENUM (
  'Business Details', 'Document Upload', 'Owner Details', 'Owner KYC Documents',
  'Location Photo', 'Bank Statement', 'Bank Details', 'Operators', 'Limit Proposal',
  'Submitted for Review', 'Maker Review', 'Checker Review', 'FI Document Review',
  'Sent to FI', 'Offer Generated', 'Awaiting Offer Response', 'Completed'
);
CREATE TYPE overall_status AS ENUM (
  'Not Started', 'In Progress', 'Awaiting Review', 'Approved', 'Rejected',
  'Pending FI Review', 'FI Approved', 'Sent to FI', 'Offer Received', 'Offer Accepted', 'Completed'
);

-- Auth / Users
CREATE TABLE backoffice_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'Maker',
  api_partner_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entities
CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  entity_type entity_type NOT NULL,
  kyc_status kyc_status DEFAULT 'Pending',
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  registration_number VARCHAR(100),
  approved_limit DECIMAL(15,2) DEFAULT 0,
  kra_pin VARCHAR(50),
  business_sector VARCHAR(100),
  physical_address TEXT,
  onboarding_status onboarding_status DEFAULT 'Not Started',
  owner_user_id UUID, -- FK to auth users
  allow_self_invoicing BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Programs
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  product_type product_type NOT NULL,
  anchor_entity_id UUID REFERENCES entities(id),
  status program_status DEFAULT 'Active',
  description TEXT,
  program_size DECIMAL(15,2),
  credit_period_days INTEGER,
  finance_percentage DECIMAL(8,4),
  min_participant_limit DECIMAL(15,2),
  max_participant_limit DECIMAL(15,2),
  approval_date DATE,
  renewal_date DATE,
  program_owner_type program_owner_type,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invitations
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL, -- TRV-YYYY-NNNN
  entity_name VARCHAR(255),
  entity_type entity_type,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  status invitation_status DEFAULT 'Pending Sign-up',
  sent_via TEXT[], -- {'Email', 'SMS'}
  sent_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by_user_id UUID,
  product_type product_type,
  proposed_limit DECIMAL(15,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Join: invitations ↔ programs
CREATE TABLE invitations_programs (
  invitation_id UUID REFERENCES invitations(id),
  program_id UUID REFERENCES programs(id),
  PRIMARY KEY (invitation_id, program_id)
);

-- Join: entities ↔ invitations
CREATE TABLE entities_invitations (
  entity_id UUID REFERENCES entities(id),
  invitation_id UUID REFERENCES invitations(id),
  PRIMARY KEY (entity_id, invitation_id)
);

-- Join: entities ↔ programs
CREATE TABLE entities_programs (
  entity_id UUID REFERENCES entities(id),
  program_id UUID REFERENCES programs(id),
  PRIMARY KEY (entity_id, program_id)
);

-- Entity Owners
CREATE TABLE entity_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(255) NOT NULL,
  entity_id UUID REFERENCES entities(id),
  id_number VARCHAR(50),
  id_type VARCHAR(20), -- 'National ID' or 'Passport'
  date_of_birth DATE,
  phone VARCHAR(50),
  email VARCHAR(255),
  ownership_percentage DECIMAL(8,4),
  is_primary_contact BOOLEAN DEFAULT FALSE,
  kra_pin VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entity Operators
CREATE TABLE entity_operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(255) NOT NULL,
  entity_id UUID REFERENCES entities(id),
  id_number VARCHAR(50),
  role VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(255),
  is_authorized_signatory BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Onboardings
CREATE TABLE onboardings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_number SERIAL,
  entity_id UUID REFERENCES entities(id),
  program_id UUID REFERENCES programs(id),
  product_type product_type,
  entity_type entity_type,
  current_stage onboarding_stage DEFAULT 'Business Details',
  overall_status overall_status DEFAULT 'Not Started',
  owner_user_id UUID,
  invitation_id UUID REFERENCES invitations(id),
  business_details_json JSONB,
  bank_details_json JSONB,
  maker_reviewed_by VARCHAR(255),
  maker_reviewed_at TIMESTAMPTZ,
  maker_notes TEXT,
  checker_reviewed_by VARCHAR(255),
  checker_reviewed_at TIMESTAMPTZ,
  checker_notes TEXT,
  fi_reviewed_by VARCHAR(255),
  fi_reviewed_at TIMESTAMPTZ,
  fi_review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Onboarding Documents
CREATE TABLE onboarding_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_name VARCHAR(255) NOT NULL,
  onboarding_id UUID REFERENCES onboardings(id),
  document_type VARCHAR(50), -- Business Registration, KRA PIN Certificate, CR12, National ID, Bank Statement, Business Permit, Location Photo
  file_url TEXT,
  file_name VARCHAR(255),
  file_size BIGINT,
  file_mime_type VARCHAR(100),
  verification_status VARCHAR(30) DEFAULT 'Pending Verification', -- Pending Verification, Verified, Rejected
  notes TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  message TEXT,
  type notification_type,
  read BOOLEAN DEFAULT FALSE,
  link_path VARCHAR(255),
  recipient_user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System Settings
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  updated_by VARCHAR(255),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bank Accounts
CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name VARCHAR(255),
  entity_id UUID REFERENCES entities(id),
  bank_name VARCHAR(255),
  branch_name VARCHAR(255),
  account_number VARCHAR(50),
  bank_code VARCHAR(20),
  branch_code VARCHAR(20),
  swift_code VARCHAR(20),
  account_type VARCHAR(20) DEFAULT 'Current', -- Current, Savings, Mobile Money
  mobile_money_number VARCHAR(50),
  currency VARCHAR(3) DEFAULT 'KES',
  is_primary BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  status VARCHAR(30) DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### V2__financing_tables.sql

```sql
-- Limit Proposals
CREATE TABLE limit_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_number SERIAL,
  entity_id UUID REFERENCES entities(id),
  program_id UUID REFERENCES programs(id),
  onboarding_id UUID REFERENCES onboardings(id),
  proposed_amount DECIMAL(15,2),
  approved_amount DECIMAL(15,2),
  currency VARCHAR(3) DEFAULT 'KES',
  preferred_tenor_days INTEGER,
  status VARCHAR(30) DEFAULT 'Pending', -- Pending, Assessed, Under Review, Approved, Rejected
  justification TEXT,
  assessed_by VARCHAR(255),
  assessed_at TIMESTAMPTZ,
  approved_by VARCHAR(255),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(20) UNIQUE NOT NULL, -- INV-YYYY-NNNNN
  issuer_entity_id UUID REFERENCES entities(id),
  recipient_entity_id UUID REFERENCES entities(id),
  program_id UUID REFERENCES programs(id),
  product_type product_type,
  amount DECIMAL(15,2),
  issue_date DATE,
  due_date DATE,
  status VARCHAR(30) DEFAULT 'Uploaded',
  description TEXT,
  document_url TEXT,
  purchase_order_number VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financing Requests
CREATE TABLE financing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number SERIAL,
  requesting_entity_id UUID REFERENCES entities(id),
  borrower_entity_id UUID REFERENCES entities(id),
  program_id UUID REFERENCES programs(id),
  product_type product_type,
  requested_amount DECIMAL(15,2),
  financeable_amount DECIMAL(15,2),
  interest_rate DECIMAL(8,4),
  tenor_days INTEGER,
  status VARCHAR(30) DEFAULT 'Pending',
  assessed_by VARCHAR(255),
  assessed_at TIMESTAMPTZ,
  approved_by VARCHAR(255),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  comments TEXT,
  currency VARCHAR(3) DEFAULT 'KES',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Join: financing_requests ↔ invoices
CREATE TABLE financing_requests_invoices (
  financing_request_id UUID REFERENCES financing_requests(id),
  invoice_id UUID REFERENCES invoices(id),
  PRIMARY KEY (financing_request_id, invoice_id)
);

-- Loans
CREATE TABLE loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_reference VARCHAR(20) UNIQUE NOT NULL, -- LN-NNNNN
  entity_id UUID REFERENCES entities(id),
  program_id UUID REFERENCES programs(id),
  product_type product_type,
  principal DECIMAL(15,2),
  outstanding_balance DECIMAL(15,2),
  interest_rate DECIMAL(8,4),
  penalty_amount DECIMAL(15,2) DEFAULT 0,
  status loan_status DEFAULT 'Active',
  disbursed_at TIMESTAMPTZ,
  maturity_date DATE,
  days_overdue INTEGER DEFAULT 0,
  borrower_entity_type VARCHAR(30),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Join: financing_requests ↔ loans
CREATE TABLE financing_requests_loans (
  financing_request_id UUID REFERENCES financing_requests(id),
  loan_id UUID REFERENCES loans(id),
  PRIMARY KEY (financing_request_id, loan_id)
);

-- Transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference VARCHAR(20) UNIQUE NOT NULL, -- TXN-D-NNNNN or TXN-R-NNNNN
  loan_id UUID REFERENCES loans(id),
  type transaction_type,
  amount DECIMAL(15,2),
  payment_method payment_method,
  mpesa_receipt VARCHAR(50),
  phone_number VARCHAR(50),
  status transaction_status DEFAULT 'Pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Offer Letters
CREATE TABLE offer_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_number SERIAL,
  entity_id UUID REFERENCES entities(id),
  onboarding_id UUID REFERENCES onboardings(id),
  program_id UUID REFERENCES programs(id),
  approved_limit DECIMAL(15,2),
  interest_rate DECIMAL(8,4),
  tenor_days INTEGER,
  status VARCHAR(20) DEFAULT 'Generated', -- Generated, Accepted, Rejected, Expired
  expiry_date DATE,
  document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financial Institutions
CREATE TABLE financial_institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name VARCHAR(255) NOT NULL,
  trading_name VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  bank_code VARCHAR(20),
  swift_code VARCHAR(20),
  status VARCHAR(20) DEFAULT 'Active',
  country VARCHAR(3) DEFAULT 'KE',
  currency VARCHAR(3) DEFAULT 'KES',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FI Program Pricing
CREATE TABLE fi_program_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_name VARCHAR(255),
  financial_institution_id UUID REFERENCES financial_institutions(id),
  program_id UUID REFERENCES programs(id),
  product_type product_type,
  min_limit DECIMAL(15,2),
  max_limit DECIMAL(15,2),
  interest_rate DECIMAL(8,4),
  tenor_days INTEGER,
  transaction_fee_rate DECIMAL(8,4),
  processing_fee_fixed DECIMAL(15,2),
  processing_fee_rate DECIMAL(8,4),
  penalty_fee_rate DECIMAL(8,4),
  past_due_daily_rate DECIMAL(8,4),
  trove_fee_rate DECIMAL(8,4),
  trove_fee_fixed DECIMAL(15,2),
  fi_charge_rate DECIMAL(8,4),
  fi_charge_fixed DECIMAL(15,2),
  repayment_bank_account TEXT,
  tiers_json JSONB,
  auto_disburse BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### V3__accounting_tables.sql

```sql
-- GL Accounts
CREATE TABLE gl_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number VARCHAR(10) UNIQUE NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  account_type VARCHAR(20) NOT NULL, -- Asset, Liability, Equity, Revenue, Expense
  sub_type VARCHAR(50),
  normal_balance VARCHAR(10) NOT NULL, -- Debit or Credit
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  current_balance DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Journal Entries
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number SERIAL,
  entry_date DATE NOT NULL,
  reference VARCHAR(50), -- JE-DISB-NNNNN or JE-RPMT-NNNNN
  description TEXT,
  status VARCHAR(20) DEFAULT 'Draft', -- Draft, Posted, Reversed
  total_amount DECIMAL(15,2),
  posted_by VARCHAR(255),
  entity_id UUID REFERENCES entities(id),
  program_id UUID REFERENCES programs(id),
  financing_request_id UUID REFERENCES financing_requests(id),
  loan_id UUID REFERENCES loans(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Journal Lines
CREATE TABLE journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_number SERIAL,
  journal_entry_id UUID REFERENCES journal_entries(id),
  gl_account_id UUID REFERENCES gl_accounts(id),
  debit_amount DECIMAL(15,2) DEFAULT 0,
  credit_amount DECIMAL(15,2) DEFAULT 0,
  narration TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### V4__risk_tables.sql

```sql
-- Credit Scores
CREATE TABLE credit_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_name VARCHAR(255),
  entity_id UUID REFERENCES entities(id),
  score INTEGER, -- 0-100
  rating VARCHAR(5), -- A+, A, B, C, D
  payment_timeliness_score DECIMAL(5,1),
  trade_volume_score DECIMAL(5,1),
  default_rate_score DECIMAL(5,1),
  entity_age_score DECIMAL(5,1),
  product_diversity_score DECIMAL(5,1),
  on_time_percent DECIMAL(8,4),
  total_trade_volume DECIMAL(15,2),
  default_rate DECIMAL(8,4),
  ai_summary TEXT,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Risk Alerts
CREATE TABLE risk_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  entity_id UUID REFERENCES entities(id),
  program_id UUID REFERENCES programs(id),
  alert_type VARCHAR(50), -- Invoice Volume Spike, Payment Pattern Shift, Credit Score Decline, etc.
  severity VARCHAR(20), -- Critical, Warning, Info
  description TEXT,
  status VARCHAR(20) DEFAULT 'Open', -- Open, Investigating, Resolved, Dismissed
  resolved_by VARCHAR(255),
  resolution_notes TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### V5__asset_tables.sql

```sql
-- Asset Schedules (Leasing product)
CREATE TABLE asset_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_reference VARCHAR(50) UNIQUE,
  entity_id UUID REFERENCES entities(id),
  program_id UUID REFERENCES programs(id),
  loan_id UUID REFERENCES loans(id),
  asset_description TEXT,
  asset_category VARCHAR(30), -- Vehicle, Equipment, Machinery, Property, Other
  serial_number VARCHAR(100),
  make_and_model VARCHAR(255),
  year_of_manufacture INTEGER,
  asset_value DECIMAL(15,2),
  residual_value DECIMAL(15,2),
  lease_term_months INTEGER,
  depreciation_rate DECIMAL(8,4),
  lease_start_date DATE,
  lease_end_date DATE,
  status VARCHAR(20) DEFAULT 'Active',
  insurance_policy_number VARCHAR(100),
  insurance_expiry DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Warehouse Receipts (WRF product)
CREATE TABLE warehouse_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number VARCHAR(50) UNIQUE,
  entity_id UUID REFERENCES entities(id),
  program_id UUID REFERENCES programs(id),
  loan_id UUID REFERENCES loans(id),
  warehouse_name VARCHAR(255),
  warehouse_location VARCHAR(255),
  commodity_type VARCHAR(100),
  grade VARCHAR(50),
  quantity DECIMAL(15,2),
  unit_of_measure VARCHAR(20),
  unit_price DECIMAL(15,2),
  total_value DECIMAL(15,2),
  date_deposited DATE,
  expiry_date DATE,
  status VARCHAR(20) DEFAULT 'Active', -- Active, Released, Expired, Pledged
  collateral_manager VARCHAR(255),
  receipt_document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### V6__partner_tables.sql

```sql
-- API Partners
CREATE TABLE api_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name VARCHAR(255) NOT NULL,
  partner_type VARCHAR(30), -- FI, Master Anchor, Fintech
  status VARCHAR(30) DEFAULT 'Pending Approval',
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  company_registration VARCHAR(100),
  country VARCHAR(50),
  website VARCHAR(255),
  enabled_products TEXT[], -- array of product_type values
  sandbox_enabled BOOLEAN DEFAULT TRUE,
  production_enabled BOOLEAN DEFAULT FALSE,
  approved_by VARCHAR(255),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK to backoffice_users
ALTER TABLE backoffice_users ADD CONSTRAINT fk_api_partner
  FOREIGN KEY (api_partner_id) REFERENCES api_partners(id);

-- Join: api_partners ↔ entities
CREATE TABLE api_partners_entities (
  api_partner_id UUID REFERENCES api_partners(id),
  entity_id UUID REFERENCES entities(id),
  PRIMARY KEY (api_partner_id, entity_id)
);

-- Join: api_partners ↔ programs
CREATE TABLE api_partners_programs (
  api_partner_id UUID REFERENCES api_partners(id),
  program_id UUID REFERENCES programs(id),
  PRIMARY KEY (api_partner_id, program_id)
);

-- API Keys
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_prefix VARCHAR(12), -- first 8 chars (e.g. sk_live_Ab)
  api_partner_id UUID REFERENCES api_partners(id),
  environment VARCHAR(20), -- Sandbox, Production
  key_hash VARCHAR(64), -- SHA-256 hash of full key
  key_hint VARCHAR(20), -- last 4 chars
  label VARCHAR(255),
  status VARCHAR(20) DEFAULT 'Active',
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by VARCHAR(255),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API Activity Log
CREATE TABLE api_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id SERIAL,
  api_partner_id UUID REFERENCES api_partners(id),
  api_key_id UUID REFERENCES api_keys(id),
  environment VARCHAR(20),
  endpoint VARCHAR(255),
  method VARCHAR(10),
  status_code INTEGER,
  entity_created_id UUID REFERENCES entities(id),
  request_summary TEXT,
  error_message TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reminder Templates
CREATE TABLE reminder_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name VARCHAR(255) NOT NULL,
  category VARCHAR(30), -- Overdue Payment, Document Request, Limit Expiry, Onboarding Follow-up, Offer Expiry, General
  subject TEXT,
  body TEXT, -- supports {{entity_name}}, {{loan_reference}}, {{outstanding_balance}}, {{days_overdue}}, {{penalty_amount}}
  channel VARCHAR(30), -- In-App Notification, Email, SMS
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. ANGULAR FRONTEND APPLICATIONS

### 4.1 Project Structure

Use **Nx monorepo** or **Angular CLI workspaces** with shared libraries:

```
trove-frontend/
├── apps/
│   ├── backoffice/          # Internal ops dashboard
│   ├── customer-portal/     # External self-service
│   ├── developer-docs/      # Public API docs
│   └── marketing/           # Public landing page
├── libs/
│   ├── shared/
│   │   ├── ui/              # Shared UI components (buttons, cards, tables, dialogs)
│   │   ├── data-access/     # API services (HttpClient wrappers per microservice)
│   │   ├── models/          # TypeScript interfaces/types matching DTOs
│   │   ├── utils/           # Formatters (KES currency, dates), validators
│   │   └── auth/            # Auth guards, interceptors, JWT handling
│   ├── backoffice/
│   │   ├── feature-overview/
│   │   ├── feature-entities/
│   │   ├── feature-onboarding/
│   │   ├── feature-financing/
│   │   ├── feature-risk/
│   │   ├── feature-partner/
│   │   └── ...
│   └── portal/
│       ├── feature-onboarding/
│       ├── feature-invoices/
│       ├── feature-financing/
│       └── ...
├── angular.json
├── nx.json
└── package.json
```

### 4.2 Shared UI Library (`libs/shared/ui`)

Use **Angular Material** or **PrimeNG** as the component library. Key components:

- `TroveButtonComponent` — primary/secondary/destructive variants
- `TroveCardComponent` — white card on warm background
- `TroveDataTableComponent` — sortable, filterable, paginated table with bulk actions
- `TroveDialogComponent` — confirmation dialogs
- `TroveFormFieldComponent` — input with label, validation errors
- `TroveSelectComponent` — dropdown with search
- `TroveBadgeComponent` — status badges with color coding
- `TroveKpiCardComponent` — dashboard metric cards
- `TroveSkeletonLoaderComponent` — loading states
- `TroveSidebarComponent` — collapsible sidebar with role-based sections
- `TroveToastService` — notification toasts

### 4.3 Brand & Theme

**Same visual identity across all 4 Angular apps.**

```scss
// libs/shared/ui/styles/_variables.scss
$trove-green: hsl(152, 64%, 18%);        // Primary — forest green
$trove-green-dark: hsl(152, 45%, 7%);    // Sidebar background (Backoffice)
$trove-green-light: hsl(152, 50%, 42%);  // Sidebar active item
$trove-gold: hsl(40, 65%, 52%);          // Chart accent
$trove-background: hsl(40, 12%, 97.5%);  // Page background (warm near-white)
$trove-card: hsl(0, 0%, 100%);           // Card background (pure white)
$trove-foreground: hsl(150, 30%, 9%);    // Text color
$trove-muted: hsl(150, 8%, 42%);         // Muted text
$trove-border: hsl(40, 8%, 90%);         // Subtle borders
$trove-destructive: hsl(0, 72%, 51%);    // Error/destructive

// Shadows (Mercury/Stripe style)
$shadow-sm: 0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.03);
$shadow: 0 1px 3px 0 rgba(0,0,0,0.05), 0 1px 2px -1px rgba(0,0,0,0.04);
$shadow-md: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.04);
$shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.06), 0 4px 6px -4px rgba(0,0,0,0.04);

$border-radius: 0.5rem;

// Fonts
$font-sans: 'General Sans', 'Inter', system-ui, sans-serif;
$font-mono: 'IBM Plex Mono', monospace; // JetBrains Mono for Developer Docs
```

**Logo:** SVG hexagonal prism (see SVG in Platform Overview). Brand text: **"trove"** (lowercase). Backoffice sidebar: **"trove ops"**.

### 4.4 Backoffice App Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/overview` | `OverviewComponent` | Dashboard with KPI cards and activity feed |
| `/entities/review` | `EntityReviewComponent` | Maker entity review queue |
| `/entities/:id` | `EntityDetailComponent` | Full entity profile |
| `/checker/entities` | `CheckerEntitiesComponent` | Checker entity queue |
| `/checker/limits` | `CheckerLimitsComponent` | Checker limits queue |
| `/checker/financing` | `CheckerFinancingComponent` | Checker financing queue |
| `/fi/screening` | `FiScreeningComponent` | FI entity screening |
| `/fi/limits` | `FiLimitsComponent` | FI limits queue |
| `/fi/financing` | `FiFinancingComponent` | FI financing queue |
| `/fi/reminders` | `FiRemindersComponent` | Reminder template CRUD + send |
| `/fi/loans` | `FiLoansComponent` | FI loan management |
| `/fi/ledger` | `FiLedgerComponent` | FI ledger view |
| `/programs` | `ProgramsComponent` | Program list |
| `/programs/:id` | `ProgramDetailComponent` | Program detail |
| `/invite` | `InviteEntitiesComponent` | Create invitations |
| `/onboardings` | `OnboardingsComponent` | Pipeline list |
| `/onboardings/:id` | `OnboardingDetailComponent` | Full onboarding detail |
| `/offer-letters` | `OfferLettersComponent` | Offer letter list |
| `/invoices` | `InvoicesComponent` | Invoice list |
| `/invoices/:id` | `InvoiceDetailComponent` | Invoice detail |
| `/financing` | `FinancingComponent` | Financing requests (Maker) |
| `/financing/:id` | `FinancingDetailComponent` | Financing detail |
| `/limits` | `LimitsComponent` | Limit proposals (Maker) |
| `/transactions` | `TransactionsComponent` | Transaction ledger |
| `/financial-institutions` | `FiManagementComponent` | FI + pricing management |
| `/credit-scores` | `CreditScoresComponent` | Credit score display |
| `/risk-alerts` | `RiskAlertsComponent` | Risk alert management |
| `/ai-assistant` | `AiAssistantComponent` | Gemini chat (SSE streaming) |
| `/compliance` | `ComplianceComponent` | Compliance dashboard |
| `/overdue-loans` | `OverdueLoansComponent` | Overdue loans with classification bands |
| `/loans/:id` | `LoanDetailComponent` | Loan detail with penalty breakdown |
| `/notifications` | `NotificationsComponent` | Notification center |
| `/settings` | `SettingsComponent` | System settings |
| `/operations-guide` | `OpsGuideComponent` | In-app documentation |
| `/data-export` | `DataExportComponent` | CSV export |
| `/partners` | `PartnersComponent` | Partner list |
| `/partners/:id` | `PartnerDetailComponent` | Partner detail |
| `/partner/*` | Partner-scoped pages | (see below) |

**Partner White-Label Routes (Partner Admin only):**

| Route | Component |
|-------|-----------|
| `/partner/dashboard` | `PartnerDashboardComponent` |
| `/partner/entities` | `PartnerEntitiesComponent` |
| `/partner/programs` | `PartnerProgramsComponent` |
| `/partner/api-keys` | `PartnerApiKeysComponent` |
| `/partner/activity` | `PartnerActivityComponent` |
| `/partner/invoices` | `PartnerInvoicesComponent` |
| `/partner/loans` | `PartnerLoansComponent` |
| `/partner/financing` | `PartnerFinancingComponent` |
| `/partner/transactions` | `PartnerTransactionsComponent` |

### 4.5 Role-Based Sidebar Visibility

```typescript
const SIDEBAR_SECTIONS = {
  maker: {
    roles: ['Maker', 'Super Admin'],
    items: ['Entity Review', 'Limits', 'Financing']
  },
  checker: {
    roles: ['Checker', 'Super Admin'],
    items: ['Checker Entities', 'Checker Limits', 'Checker Financing', 'Invoices']
  },
  fi: {
    roles: ['FI Admin', 'FI Checker', 'Super Admin'],
    items: ['Entity Screening', 'FI Limits', 'FI Financing', 'FI Loans', 'FI Ledger', 'Reminders']
  },
  partner: {
    roles: ['Partner Admin', 'Super Admin'],
    items: ['Partner Dashboard', 'Partner Entities', 'Partner Programs', 'Partner API Keys', 'Partner Activity']
  },
  management: {
    roles: ['Super Admin', 'Master Anchor Admin'],
    items: ['Programs', 'Invite Entities', 'Onboardings', 'Offer Letters', 'Financial Institutions', 'Partners']
  },
  finance: {
    roles: ['*'], // all roles
    items: ['Transactions']
  },
  risk: {
    roles: ['*'],
    items: ['Credit Scores', 'Risk Alerts', 'AI Assistant', 'Compliance', 'Overdue Loans']
  },
  always: {
    roles: ['*'],
    items: ['Overview', 'Notifications', 'Settings', 'Operations Guide', 'Data Export']
  }
};
```

### 4.6 Customer Portal Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `LandingComponent` | Marketing-style page with 6 products |
| `/product-selection` | `ProductSelectionComponent` | Choose financial product |
| `/verify-code` | `VerifyCodeComponent` | Validate invitation code |
| `/onboarding` | `OnboardingComponent` | Multi-stage form (5 or 10 stages) |
| `/dashboard` | `DashboardComponent` | Role-aware KPIs |
| `/invoices` | `InvoicesComponent` | Create and view invoices |
| `/supplier-invoices` | `SupplierInvoicesComponent` | Supplier's submitted invoices |
| `/anchor-invoices` | `AnchorInvoicesComponent` | Anchor Buyer approval queue |
| `/batch-upload` | `BatchUploadComponent` | CSV invoice upload |
| `/financing` | `FinancingComponent` | Submit/track financing |
| `/limits` | `LimitsComponent` | View approved limits |
| `/loans/:id` | `LoanDetailComponent` | Loan detail with repayment |
| `/repayment` | `RepaymentComponent` | M-Pesa STK Push or bank transfer |
| `/offer-letters` | `OfferLetterComponent` | View/accept/reject offers |
| `/invite-dealers` | `InviteDealersComponent` | Anchors invite dealers |
| `/transactions` | `TransactionsComponent` | Transaction history |
| `/profile` | `EntityProfileComponent` | Entity profile |
| `/notifications` | `NotificationsComponent` | Notification center |
| `/ledger` | `LedgerComponent` | Journal entries |
| `/data-export` | `DataExportComponent` | CSV export |

### 4.7 Developer Docs (Static Angular App)

Stripe-docs-inspired layout with:
- Fixed top nav ("trove docs" + ⌘K search)
- Left sidebar with collapsible sections
- Main content area (max-w-3xl)
- Code blocks with syntax highlighting (use `ngx-highlightjs`)
- Sections: Getting Started, Products (6), API Reference (8), Guides (5)

### 4.8 Marketing Brochure

Single-page Angular app with:
- Hero section with CTA → Customer Portal
- 6 product cards
- How it works (4 steps)
- Platform capabilities
- Footer with links

---

## 5. CRITICAL BUSINESS RULES

### 5.1 Segregation of Duties (Regulatory Requirement)
- **Onboarding review:** Checker ≠ Maker (compared by name string stored in `maker_reviewed_by` / `checker_reviewed_by`)
- **Limit proposals:** Approver ≠ Assessor
- **Financing requests:** Approver ≠ Assessor
- **Enforce in backend services, not just UI**

```java
@Service
public class SegregationValidator {
    public void validateSegregation(String assessor, String approver) {
        if (assessor != null && assessor.equals(approver)) {
            throw new SegregationOfDutiesViolation(
                "The approver cannot be the same person who assessed this item"
            );
        }
    }
}
```

### 5.2 Double-Entry Accounting
- Every journal entry must balance: `SUM(debit_amount) == SUM(credit_amount)`
- Validate before saving any journal entry
- Disbursement journal: Debit Loans Receivable, Credit Cash/Bank + Fee Revenue + Interest Revenue
- Repayment journal: Debit Cash/Bank, Credit Loans Receivable + Interest Revenue

### 5.3 Currency
- All monetary values in **KES** (Kenyan Shilling)
- 2 decimal places
- Format: `KES 1,000,000.50`

### 5.4 Percent Storage
- Stored as decimals: `0.5 = 50%`, `1.0 = 100%`, `0.001 = 0.1%`
- Display with % symbol in UI

### 5.5 Default Classification Bands (Loans)
| Band | Days Overdue | Action |
|------|-------------|--------|
| Watch | 1-30 | Monitor closely |
| Special Mention | 31-60 | Increase provisions |
| Substandard | 61-90 | Restrict new lending |
| Doubtful | 91-180 | Write-down assessment |
| Loss | 180+ | Full write-off consideration |

### 5.6 Daily Penalty Calculation
```java
// For each overdue loan:
BigDecimal dailyRate = fiPricing != null ? fiPricing.getPastDueDailyRate() : new BigDecimal("0.001"); // 0.1% default
BigDecimal dailyPenalty = loan.getOutstandingBalance().multiply(dailyRate);
loan.setPenaltyAmount(loan.getPenaltyAmount().add(dailyPenalty));
```

### 5.7 Code Formats
- Invitation: `TRV-YYYY-NNNN` (e.g. TRV-2026-0042)
- Invoice: `INV-YYYY-NNNNN` (e.g. INV-2026-00153)
- Loan: `LN-NNNNN` (e.g. LN-00201)
- Transaction (Disbursement): `TXN-D-NNNNN`
- Transaction (Repayment): `TXN-R-NNNNN`
- Journal Entry (Disbursement): `JE-DISB-NNNNN`
- Journal Entry (Repayment): `JE-RPMT-NNNNN`

---

## 6. INTER-SERVICE EVENTS (Message Broker)

Use RabbitMQ or Kafka for async communication:

| Event | Producer | Consumers |
|-------|----------|-----------|
| `entity.kyc.updated` | entity-service | notification-service, risk-service |
| `onboarding.stage.changed` | onboarding-service | notification-service |
| `onboarding.approved` | onboarding-service | entity-service (update KYC), notification-service |
| `limit.approved` | financing-service | entity-service (update approvedLimit), notification-service |
| `financing.approved` | financing-service | notification-service |
| `loan.disbursed` | financing-service | accounting-service (post journal), notification-service |
| `loan.overdue` | financing-service (scheduled) | risk-service, notification-service |
| `repayment.received` | financing-service | accounting-service (post journal), notification-service |
| `risk.alert.created` | risk-service | notification-service |
| `credit.score.computed` | risk-service | notification-service |

---

## 7. SCHEDULED JOBS (Spring `@Scheduled`)

```java
@Component
public class TroveScheduledJobs {

    @Scheduled(cron = "0 0 2 * * *") // Daily at 2 AM EAT
    public void calculateDailyPenalties() {
        // Accrue penalties on all overdue loans
    }

    @Scheduled(cron = "0 0 3 * * *") // Daily at 3 AM EAT
    public void updateOverdueLoanStatus() {
        // Mark active loans past maturity as Overdue, update days_overdue
    }

    @Scheduled(cron = "0 0 4 * * MON") // Weekly Monday 4 AM
    public void runAnomalyScan() {
        // Detect payment pattern shifts and credit score declines
    }

    @Scheduled(cron = "0 0 5 * * MON") // Weekly Monday 5 AM
    public void computeCreditScores() {
        // Recompute all entity credit scores
    }

    @Scheduled(cron = "0 0 6 * * *") // Daily at 6 AM
    public void expireInvitations() {
        // Mark expired invitations
    }

    @Scheduled(cron = "0 0 7 * * *") // Daily at 7 AM
    public void expireOfferLetters() {
        // Mark expired offer letters
    }
}
```

---

## 8. TESTING STRATEGY

### 8.1 Unit Tests
- JUnit 5 + Mockito for service layer
- Test every segregation-of-duties validation
- Test journal entry balance validation
- Test penalty calculation logic
- Test credit score algorithm

### 8.2 Integration Tests
- Testcontainers for PostgreSQL + RabbitMQ
- Test full onboarding pipeline (17 stages)
- Test disbursement → journal entry flow
- Test M-Pesa callback → loan balance update

### 8.3 E2E Tests
- Cypress or Playwright for Angular apps
- Test role-based routing
- Test Maker → Checker → FI review flow

### 8.4 API Tests
- Spring Boot `@WebMvcTest` for controller tests
- Test API Gateway routing
- Test JWT validation

---

## 9. DEPLOYMENT

### 9.1 Recommended
- **Container orchestration:** Kubernetes (EKS/GKE) or Docker Compose for staging
- **Database:** Amazon RDS for PostgreSQL or Google Cloud SQL
- **Message broker:** Amazon MQ (RabbitMQ) or Confluent Cloud (Kafka)
- **Cache:** ElastiCache (Redis)
- **CDN:** CloudFront for Angular static assets
- **CI/CD:** GitHub Actions → Build → Test → Docker → Deploy
- **Monitoring:** Prometheus + Grafana, or Datadog
- **Logging:** ELK Stack or CloudWatch
- **API Docs:** Springdoc OpenAPI (auto-generated Swagger per service)

### 9.2 Environment Variables

```env
# All services
DB_URL=jdbc:postgresql://localhost:5432/trove
DB_USERNAME=trove
DB_PASSWORD=***
JWT_SECRET=***
RABBITMQ_HOST=localhost
REDIS_HOST=localhost

# Auth service (Keycloak — or swap for Logto/Zitadel equivalents)
KEYCLOAK_REALM_URL=http://keycloak:8180/realms/trove
KEYCLOAK_CLIENT_ID=trove-api
KEYCLOAK_CLIENT_SECRET=***
# Optional: Google social login is configured inside Keycloak/Logto/Zitadel admin UI

# AI service
GEMINI_API_KEY=***

# M-Pesa service
MPESA_CONSUMER_KEY=***
MPESA_CONSUMER_SECRET=***
MPESA_PASSKEY=***
MPESA_SHORTCODE=***
MPESA_CALLBACK_URL=https://api.trove.co.ke/mpesa/callback
```

---

## 10. SEED DATA SPECIFICATION

Replicate the same phased seeding approach:

**Phase 1:** 16 GL Accounts + 3 FIs (KCB, Equity Bank, Co-op Bank) + 8 Programs + 6 FI Pricing + ~48 Entities + ~40 Owners + Onboardings across all 17 stages + Documents + 40 Invitations

**Phase 2:** ~500 Invoices across 18 months

**Phase 3:** 200 Loans + 200 Financing Requests + Transactions

**Phase 4:** Journal Entries for first 100 loans (disbursement + repayment)

**Phase 5:** Credit Scores + Risk Alerts + Limit Proposals + Offer Letters

All seed data should be idempotent (use `ON CONFLICT DO NOTHING` or check-before-insert).

---

## 11. MIGRATION CHECKLIST

- [ ] Set up Nx/Angular CLI monorepo with 4 apps + shared libs
- [ ] Set up Maven multi-module project with 11 microservices + commons
- [ ] Create Flyway migrations (V1-V6)
- [ ] Implement `trove-auth-service` with Google OAuth2 + magic link
- [ ] Implement `trove-entity-service` with KYC workflow
- [ ] Implement `trove-onboarding-service` with 17-stage pipeline
- [ ] Implement `trove-financing-service` with full loan lifecycle
- [ ] Implement `trove-accounting-service` with double-entry ledger
- [ ] Implement `trove-risk-service` with credit scoring
- [ ] Implement `trove-partner-service` with API key management
- [ ] Implement `trove-notification-service` with templates
- [ ] Implement `trove-ai-service` with Gemini streaming
- [ ] Implement `trove-report-service` with PDF generation
- [ ] Implement `trove-mpesa-service` with Daraja integration
- [ ] Set up API Gateway with JWT validation + rate limiting
- [ ] Set up RabbitMQ event bus with all inter-service events
- [ ] Build all Angular Backoffice pages (40+ components)
- [ ] Build all Angular Customer Portal pages (20+ components)
- [ ] Build Angular Developer Docs site
- [ ] Build Angular Marketing Brochure site
- [ ] Implement scheduled jobs
- [ ] Write unit + integration + E2E tests
- [ ] Set up CI/CD pipeline
- [ ] Run seed data
- [ ] Deploy to staging → production
