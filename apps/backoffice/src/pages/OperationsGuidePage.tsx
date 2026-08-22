import { useState } from 'react';
import { ChevronDown, ChevronRight, BookOpen, Shield, CreditCard, FileText, Building2, Users, Layers, Receipt, AlertTriangle, CheckCircle2, Landmark, Bot, Scale, Clock, ArrowRight } from 'lucide-react';
import { cn } from '@project/components/lib/utils';
import { Badge } from '@project/components/ui/badge';

type GuideSection = {
  id: string;
  icon: React.ElementType;
  title: string;
  badge?: string;
  content: React.ReactNode;
};

function SectionCard({ section }: { section: GuideSection }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 hover:bg-accent/50 transition-colors text-left"
      >
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <section.icon className="w-4.5 h-4.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-foreground">{section.title}</h3>
            {section.badge && <Badge variant="secondary" className="text-[10px]">{section.badge}</Badge>}
          </div>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0 text-sm text-muted-foreground leading-relaxed space-y-3 border-t border-border/60 mt-0 pt-4">
          {section.content}
        </div>
      )}
    </div>
  );
}

function FlowStep({ step, label, isLast }: { step: number; label: string; isLast?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">{step}</span>
      <span className="text-foreground font-medium text-xs">{label}</span>
      {!isLast && <ArrowRight className="w-3 h-3 text-muted-foreground mx-0.5" />}
    </span>
  );
}

const guideSections: GuideSection[] = [
  {
    id: 'roles',
    icon: Users,
    title: 'Roles & Permissions',
    badge: '6 roles',
    content: (
      <>
        <p>The backoffice enforces role-based access control. Each user is assigned exactly one role:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
          {[
            { role: 'Super Admin', desc: 'Full access to all sections, user management, and system settings.' },
            { role: 'Maker', desc: 'Entity review, limit assessment, financing assessment. Cannot approve their own work.' },
            { role: 'Checker', desc: 'Entity verification, limit & financing approval, invoice verification. Cannot approve items they assessed.' },
            { role: 'FI Admin', desc: 'FI entity screening, FI limit & financing approval.' },
            { role: 'FI Checker', desc: 'Secondary FI approval queue.' },
            { role: 'Program Owner Admin', desc: 'Program management, invitations, onboarding oversight.' },
          ].map((r) => (
            <div key={r.role} className="bg-muted/50 rounded-lg p-3">
              <p className="font-semibold text-foreground text-xs">{r.role}</p>
              <p className="text-[11px] mt-0.5">{r.desc}</p>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    id: 'segregation',
    icon: Shield,
    title: 'Segregation of Duties',
    badge: 'Enforced',
    content: (
      <>
        <p>The system enforces <strong className="text-foreground">Maker ≠ Checker</strong> on every approval flow. If a Maker assesses a record, a different person must approve or reject it.</p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li><strong className="text-foreground">Onboarding Review:</strong> The Checker who approves/rejects cannot be the same user who performed the Maker review.</li>
          <li><strong className="text-foreground">Limit Proposals:</strong> The person who approves a limit cannot be the same person who assessed it.</li>
          <li><strong className="text-foreground">Financing Requests:</strong> The person who approves a financing request cannot be the same person who assessed it.</li>
        </ul>
        <p className="mt-2 text-xs bg-destructive/10 text-destructive rounded-lg px-3 py-2 font-medium">⚠️ The system will block the action and show an error if a user attempts to approve their own assessment.</p>
      </>
    ),
  },
  {
    id: 'onboarding',
    icon: Shield,
    title: 'Onboarding Pipeline',
    content: (
      <>
        <p>The full onboarding flow for a new entity:</p>
        <div className="flex flex-wrap items-center gap-1 mt-2">
          <FlowStep step={1} label="Invitation Sent" />
          <FlowStep step={2} label="Entity Signs Up" />
          <FlowStep step={3} label="Portal Onboarding (8 steps)" />
          <FlowStep step={4} label="Submitted for Review" />
          <FlowStep step={5} label="Maker Review" />
          <FlowStep step={6} label="Checker Review" />
          <FlowStep step={7} label="Sent to FI" />
          <FlowStep step={8} label="FI Screening" />
          <FlowStep step={9} label="Offer Generated" />
          <FlowStep step={10} label="Offer Accepted" />
          <FlowStep step={11} label="Completed" isLast />
        </div>
        <p className="mt-3">At any review stage, rejection sends the onboarding back with notes for correction. The entity's KYC status and onboarding status are updated automatically.</p>
      </>
    ),
  },
  {
    id: 'products',
    icon: Layers,
    title: 'Product Types',
    badge: '6 products',
    content: (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[
            { name: 'Invoice Finance', desc: 'Seller uploads invoices against a Buyer program. Finance is disbursed against verified invoices.' },
            { name: 'Reverse Factoring', desc: 'Buyer confirms payables. Supplier gets early payment, Buyer pays at maturity.' },
            { name: 'Invoice Discounting', desc: 'Similar to invoice finance but the supplier\'s credit is the primary risk factor.' },
            { name: 'Blended Finance', desc: 'Combines development-finance capital with commercial capital for favorable rates.' },
            { name: 'Leasing', desc: 'Asset-based financing. Requires Asset Schedule tracking (make, model, serial, depreciation, insurance).' },
            { name: 'Warehouse Receipt', desc: 'Commodity-backed financing. Requires Warehouse Receipt tracking (commodity, grade, collateral manager).' },
          ].map((p) => (
            <div key={p.name} className="bg-muted/50 rounded-lg p-3">
              <p className="font-semibold text-foreground text-xs">{p.name}</p>
              <p className="text-[11px] mt-0.5">{p.desc}</p>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    id: 'limits',
    icon: CreditCard,
    title: 'Limit Proposals & Approval',
    content: (
      <>
        <p>Limit proposals flow through a two-step approval process:</p>
        <div className="flex flex-wrap items-center gap-1 mt-2">
          <FlowStep step={1} label="Entity submits limit proposal" />
          <FlowStep step={2} label="Maker assesses (Pending → Assessed)" />
          <FlowStep step={3} label="Checker/FI approves with amount" />
          <FlowStep step={4} label="Entity limit updated" isLast />
        </div>
        <p className="mt-2">Approved limits set the entity's maximum financing capacity for the linked program. The approved amount may differ from the proposed amount.</p>
      </>
    ),
  },
  {
    id: 'financing',
    icon: FileText,
    title: 'Financing Requests & Disbursement',
    content: (
      <>
        <p>Financing request approval and disbursement flow:</p>
        <div className="flex flex-wrap items-center gap-1 mt-2">
          <FlowStep step={1} label="Entity submits financing request with invoices" />
          <FlowStep step={2} label="Maker assesses (Requested → Pending Approval)" />
          <FlowStep step={3} label="Checker approves" />
          <FlowStep step={4} label="Loan created & disbursed" />
          <FlowStep step={5} label="Repayment tracked" isLast />
        </div>
        <p className="mt-2">On disbursement, journal entries are posted automatically (DR Loans Receivable, CR Bank/FI). Repayments reverse these entries.</p>
      </>
    ),
  },
  {
    id: 'invoices',
    icon: FileText,
    title: 'Invoice Lifecycle',
    content: (
      <>
        <p>Invoices progress through these statuses:</p>
        <div className="flex flex-wrap items-center gap-1 mt-2">
          <FlowStep step={1} label="Uploaded" />
          <FlowStep step={2} label="Pending Verification" />
          <FlowStep step={3} label="Verified" />
          <FlowStep step={4} label="Finance Eligible" />
          <FlowStep step={5} label="Finance Requested" />
          <FlowStep step={6} label="Financing Approved" />
          <FlowStep step={7} label="Fully Financed" isLast />
        </div>
        <p className="mt-2">Batch upload is supported. Checkers verify invoices before they become eligible for financing. The Document Intelligence feature can auto-extract invoice fields using AI.</p>
      </>
    ),
  },
  {
    id: 'fi-screening',
    icon: Landmark,
    title: 'FI Entity Screening',
    content: (
      <>
        <p>After Checker approval, onboardings are sent to the Financial Institution for final screening:</p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>FI Admins see a queue of onboardings in "Sent to FI" / "Pending FI Review" status.</li>
          <li>They review entity documents, business details, and owner information.</li>
          <li>Approval advances the onboarding to "Offer Generated" stage.</li>
          <li>Rejection returns it to "FI Document Review" stage with notes.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'transactions',
    icon: Receipt,
    title: 'Transactions & M-Pesa',
    content: (
      <>
        <p>Transactions record all money movement — disbursements, repayments, penalties, interest, and fees.</p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li><strong className="text-foreground">Payment Methods:</strong> M-Pesa, Bank Transfer, System.</li>
          <li><strong className="text-foreground">M-Pesa:</strong> Currently simulated. Real Daraja integration is planned — the system captures phone numbers and M-Pesa receipt codes for reconciliation.</li>
          <li><strong className="text-foreground">Bank Accounts:</strong> Each entity can register bank accounts for disbursement routing (Account Name, Bank, Branch, Account Number, Swift Code).</li>
        </ul>
      </>
    ),
  },
  {
    id: 'ledger',
    icon: Scale,
    title: 'General Ledger & Journal Entries',
    content: (
      <>
        <p>The system maintains a double-entry ledger with GL Accounts and Journal Entries:</p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>Journal entries are posted automatically on disbursement and repayment events.</li>
          <li>Each entry has debit and credit journal lines linked to GL accounts.</li>
          <li>Entries can be Draft, Posted, or Reversed.</li>
          <li>GL accounts cover Asset, Liability, Equity, Revenue, and Expense types.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'risk',
    icon: AlertTriangle,
    title: 'Risk Management & Credit Scoring',
    content: (
      <>
        <p>The risk module provides proactive risk monitoring:</p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li><strong className="text-foreground">Credit Scores:</strong> Computed from payment timeliness, trade volume, default rates, entity age, and product diversity. Rated A+ through D.</li>
          <li><strong className="text-foreground">Risk Alerts:</strong> Automated detection of invoice volume spikes, payment pattern shifts, credit score declines, rapid financing requests, potential duplicate invoices, and limit breach attempts.</li>
          <li><strong className="text-foreground">Anomaly Scan:</strong> On-demand scan for irregular patterns across the portfolio.</li>
          <li><strong className="text-foreground">AI Assistant:</strong> Gemini-powered assistant for risk analysis questions, portfolio queries, and compliance guidance.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'overdue',
    icon: Clock,
    title: 'Overdue Loans & Collections',
    content: (
      <>
        <p>Overdue loan monitoring:</p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>Loans past their maturity date are automatically flagged as "Overdue".</li>
          <li>Days overdue and penalty amounts are tracked on each loan record.</li>
          <li>Overdue loans surface in the dedicated Overdue Loans view and in Risk Alerts.</li>
          <li>Penalty transactions can be posted against overdue loans.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'leasing-wrf',
    icon: Building2,
    title: 'Leasing & Warehouse Receipt Financing',
    badge: 'New',
    content: (
      <>
        <p>Specialized tables now support these two product types:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="font-semibold text-foreground text-xs mb-1">Asset Schedules (Leasing)</p>
            <p className="text-[11px]">Track leased assets with category, serial number, make/model, year of manufacture, asset value, residual value, lease term, depreciation rate, and insurance details.</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="font-semibold text-foreground text-xs mb-1">Warehouse Receipts (WRF)</p>
            <p className="text-[11px]">Track warehouse receipts with commodity type, grade, quantity, unit price, total value, warehouse name/location, collateral manager, and receipt documents.</p>
          </div>
        </div>
        <p className="mt-2">Both are linked to Entities, Programs, and Loans for full traceability.</p>
      </>
    ),
  },
  {
    id: 'bank-accounts',
    icon: Landmark,
    title: 'Bank Accounts & Disbursement Routing',
    badge: 'New',
    content: (
      <>
        <p>Each entity can register one or more bank accounts for disbursement and repayment routing:</p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>Supports Current, Savings, and Mobile Money account types.</li>
          <li>Stores bank name, branch, account number, bank code, branch code, Swift code.</li>
          <li>One account can be marked as Primary and verified status is tracked.</li>
          <li>Currencies supported: KES, USD, EUR.</li>
        </ul>
      </>
    ),
  },
];

export default function OperationsGuidePage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Operations Guide</h1>
          <p className="text-sm text-muted-foreground">How to use the Trove Backoffice — roles, workflows, and features</p>
        </div>
      </div>

      <div className="space-y-2">
        {guideSections.map((section) => (
          <SectionCard key={section.id} section={section} />
        ))}
      </div>
    </div>
  );
}
