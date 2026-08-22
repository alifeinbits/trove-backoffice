import { ArrowRight, Building2, Users, Landmark, Banknote } from 'lucide-react';
import { cn } from '@project/components/lib/utils';

type FlowStep = { label: string; icon: React.ElementType; color: string };

const FLOWS: Record<string, { title: string; description: string; steps: FlowStep[] }> = {
  'Invoice Finance': {
    title: 'Invoice Finance Flow',
    description: 'Seller invoices the Buyer, FI finances the invoice',
    steps: [
      { label: 'Seller', icon: Users, color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
      { label: 'Invoices', icon: ArrowRight, color: '' },
      { label: 'Buyer', icon: Building2, color: 'bg-purple-500/10 text-purple-600 border-purple-200' },
      { label: 'Approves Invoice', icon: ArrowRight, color: '' },
      { label: 'FI', icon: Landmark, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
      { label: 'Disburses to Seller', icon: ArrowRight, color: '' },
      { label: 'Seller', icon: Banknote, color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
    ],
  },
  'Reverse Factoring': {
    title: 'Reverse Factoring Flow',
    description: 'Buyer approves supplier invoice, FI pays supplier early',
    steps: [
      { label: 'Supplier', icon: Users, color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
      { label: 'Invoices', icon: ArrowRight, color: '' },
      { label: 'Buyer', icon: Building2, color: 'bg-purple-500/10 text-purple-600 border-purple-200' },
      { label: 'Approves', icon: ArrowRight, color: '' },
      { label: 'FI', icon: Landmark, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
      { label: 'Early Payment', icon: ArrowRight, color: '' },
      { label: 'Supplier', icon: Banknote, color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
    ],
  },
  'Invoice Discounting': {
    title: 'Invoice Discounting Flow',
    description: 'Seller discounts invoice with FI at a fee, Buyer pays at maturity',
    steps: [
      { label: 'Seller', icon: Users, color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
      { label: 'Submits Invoice', icon: ArrowRight, color: '' },
      { label: 'FI', icon: Landmark, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
      { label: 'Discounted Payment', icon: ArrowRight, color: '' },
      { label: 'Seller', icon: Banknote, color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
      { label: 'Pays at Maturity', icon: ArrowRight, color: '' },
      { label: 'Buyer', icon: Building2, color: 'bg-purple-500/10 text-purple-600 border-purple-200' },
    ],
  },
  'Blended Finance': {
    title: 'Blended Finance Flow',
    description: 'Multiple funding sources blend to finance supplier invoices',
    steps: [
      { label: 'Supplier', icon: Users, color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
      { label: 'Submits', icon: ArrowRight, color: '' },
      { label: 'Buyer', icon: Building2, color: 'bg-purple-500/10 text-purple-600 border-purple-200' },
      { label: 'Blended Funding', icon: ArrowRight, color: '' },
      { label: 'FI + DFI', icon: Landmark, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
      { label: 'Disburses', icon: ArrowRight, color: '' },
      { label: 'Supplier', icon: Banknote, color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
    ],
  },
  'Leasing': {
    title: 'Leasing Flow',
    description: 'FI purchases asset and leases it to the lessee',
    steps: [
      { label: 'Lessee', icon: Users, color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
      { label: 'Requests Asset', icon: ArrowRight, color: '' },
      { label: 'FI', icon: Landmark, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
      { label: 'Purchases Asset', icon: ArrowRight, color: '' },
      { label: 'Lessor', icon: Building2, color: 'bg-purple-500/10 text-purple-600 border-purple-200' },
      { label: 'Lease Payments', icon: ArrowRight, color: '' },
      { label: 'FI', icon: Banknote, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
    ],
  },
  'Warehouse Receipt': {
    title: 'Warehouse Receipt Flow',
    description: 'Goods stored in warehouse, receipt used as collateral for financing',
    steps: [
      { label: 'Depositor', icon: Users, color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
      { label: 'Stores Goods', icon: ArrowRight, color: '' },
      { label: 'Warehouse', icon: Building2, color: 'bg-purple-500/10 text-purple-600 border-purple-200' },
      { label: 'Issues Receipt', icon: ArrowRight, color: '' },
      { label: 'FI', icon: Landmark, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
      { label: 'Finances Against Receipt', icon: ArrowRight, color: '' },
      { label: 'Depositor', icon: Banknote, color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
    ],
  },
};

export function MoneyFlowDiagram({ productType }: { productType: string }) {
  const flow = FLOWS[productType];
  if (!flow) return null;

  return (
    <div className="border border-border rounded-lg bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-1">{flow.title}</h3>
      <p className="text-xs text-muted-foreground mb-4">{flow.description}</p>

      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
        {flow.steps.map((step, i) => {
          if (!step.color) {
            return (
              <div key={i} className="flex flex-col items-center shrink-0">
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">{step.label}</span>
              </div>
            );
          }
          const Icon = step.icon;
          return (
            <div key={i} className={cn('flex flex-col items-center gap-1.5 shrink-0 px-3 py-2.5 rounded-lg border', step.color)}>
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium whitespace-nowrap">{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Compact inline flow indicator for financing requests / transactions */
export function MoneyFlowBadge({ productType }: { productType: string }) {
  const shortFlows: Record<string, string> = {
    'Invoice Finance': 'FI → Seller',
    'Reverse Factoring': 'FI → Supplier',
    'Invoice Discounting': 'FI → Seller',
    'Blended Finance': 'FI+DFI → Supplier',
    'Leasing': 'FI → Lessee',
    'Warehouse Receipt': 'FI → Depositor',
  };
  const label = shortFlows[productType] || productType;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/8 text-primary border border-primary/15">
      <Banknote className="w-2.5 h-2.5" /> {label}
    </span>
  );
}
