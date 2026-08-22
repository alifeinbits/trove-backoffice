import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@project/components/ui/skeleton';
import { toast } from 'sonner';
import { getOverview, GetOverviewOutputType } from 'zitejs/api';
import {
  Users, Layers, CreditCard, AlertTriangle, Banknote, TrendingUp,
  FileText, Clock, ArrowRight, Shield, ClipboardCheck,
  CheckCircle2, Landmark, Download, Loader2,
} from 'lucide-react';
import { generateBrochurePdf, generatePitchDeckPdf } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { cn } from '@project/components/lib/utils';
import { MoneyFlowBadge } from '../components/MoneyFlow';

type Data = GetOverviewOutputType;

function formatKES(n: number) {
  return `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;
}

export default function OverviewPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingDeck, setGeneratingDeck] = useState(false);

  useEffect(() => {
    getOverview({})
      .then(setData)
      .catch(() => toast.error('Failed to load overview'))
      .finally(() => setLoading(false));
  }, []);

  const handleDownloadBrochure = async () => {
    setGeneratingPdf(true);
    try {
      const { url } = await generateBrochurePdf({});
      window.open(url, '_blank');
    } catch {
      toast.error('Failed to generate brochure');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleDownloadPitchDeck = async () => {
    setGeneratingDeck(true);
    try {
      const { url } = await generatePitchDeckPdf({});
      window.open(url, '_blank');
    } catch {
      toast.error('Failed to generate pitch deck');
    } finally {
      setGeneratingDeck(false);
    }
  };

  if (loading) return <DashboardSkeleton />;
  if (!data) return null;

  const totalQueue = data.makerEntityQueue + data.makerLimitQueue + data.makerFinancingQueue
    + data.checkerEntityQueue + data.checkerLimitQueue + data.checkerFinancingQueue + data.checkerInvoiceQueue;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Operations</p>
          <h1 className="text-[24px] font-bold text-foreground tracking-[-0.02em]">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {totalQueue > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/8 text-primary text-[13px] font-medium border border-primary/12">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-bold">{totalQueue}</span> pending
            </div>
          )}
          <Button variant="outline" size="sm" className="h-8 text-[13px]" onClick={handleDownloadBrochure} disabled={generatingPdf}>
            {generatingPdf ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
            Brochure
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-[13px]" onClick={handleDownloadPitchDeck} disabled={generatingDeck}>
            {generatingDeck ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
            Pitch Deck
          </Button>
        </div>
      </div>

      {/* Primary KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard icon={Users} label="Total Entities" value={data.totalEntities} color="primary" onClick={() => navigate('/entity-review')} />
        <KpiCard icon={Layers} label="Active Programs" value={data.activePrograms} color="gold" onClick={() => navigate('/programs')} />
        <KpiCard icon={CreditCard} label="Active Loans" value={data.activeLoans} color="teal" />
        <KpiCard icon={AlertTriangle} label="Overdue Loans" value={data.overdueLoans} color="destructive" onClick={() => navigate('/overdue-loans')} />
        <KpiCard icon={FileText} label="Pending Financing" value={data.pendingFinancing} color="blue" onClick={() => navigate('/financing')} />
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <FinCard icon={Banknote} label="Total Disbursed" value={formatKES(data.totalDisbursed)} />
        <FinCard icon={TrendingUp} label="Outstanding" value={formatKES(data.totalOutstanding)} />
        <FinCard icon={AlertTriangle} label="Accrued Penalties" value={formatKES(data.totalPenalties)} accent />
        <FinCard icon={Shield} label="Pending Onboardings" value={String(data.pendingOnboardings)} />
      </div>

      {/* Approval queues */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <QueueCard
          title="Maker Queues"
          subtitle="Assess & review"
          icon={ClipboardCheck}
          items={[
            { label: 'Entity Review', count: data.makerEntityQueue, to: '/entity-review' },
            { label: 'Limit Assessment', count: data.makerLimitQueue, to: '/limits' },
            { label: 'Financing Assessment', count: data.makerFinancingQueue, to: '/financing' },
          ]}
          navigate={navigate}
        />
        <QueueCard
          title="Checker Queues"
          subtitle="Approve & verify"
          icon={CheckCircle2}
          items={[
            { label: 'Entity Verification', count: data.checkerEntityQueue, to: '/checker/entities' },
            { label: 'Limit Approval', count: data.checkerLimitQueue, to: '/checker/limits' },
            { label: 'Financing Approval', count: data.checkerFinancingQueue, to: '/checker/financing' },
            { label: 'Invoice Verification', count: data.checkerInvoiceQueue, to: '/invoices' },
          ]}
          navigate={navigate}
        />
        <QueueCard
          title="FI Queues"
          subtitle="Financial institution actions"
          icon={Landmark}
          items={[
            { label: 'Limit Approval', count: data.fiLimitQueue, to: '/fi/limits' },
            { label: 'Financing Approval', count: data.fiFinancingQueue, to: '/fi/financing' },
          ]}
          navigate={navigate}
        />
      </div>

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent entities */}
        <div className="border border-border rounded-xl bg-card overflow-hidden">
          <PanelHeader title="Recent Entities" onViewAll={() => navigate('/entity-review')} />
          <div className="divide-y divide-border">
            {data.recentEntities.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => navigate(`/entities/${e.id}`)}>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground truncate">{e.name}</p>
                  <p className="text-[11px] text-muted-foreground">{e.entityType}</p>
                </div>
                <StatusBadge status={e.kycStatus} />
              </div>
            ))}
            {data.recentEntities.length === 0 && <EmptyRow label="No entities yet" />}
          </div>
        </div>

        {/* Recent financing */}
        <div className="border border-border rounded-xl bg-card overflow-hidden">
          <PanelHeader title="Recent Financing" onViewAll={() => navigate('/financing')} />
          <div className="divide-y divide-border">
            {data.recentFinancing.map((fr) => (
              <div key={fr.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-[13px] font-semibold text-foreground truncate">{fr.entityName}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground font-mono">#{fr.requestNumber}</span>
                    {fr.productType && <MoneyFlowBadge productType={fr.productType} />}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-[13px] font-bold text-foreground">{formatKES(fr.requestedAmount)}</p>
                  <StatusBadge status={fr.status} />
                </div>
              </div>
            ))}
            {data.recentFinancing.length === 0 && <EmptyRow label="No financing requests" />}
          </div>
        </div>

        {/* Portfolio breakdown */}
        <div className="border border-border rounded-xl bg-card overflow-hidden">
          <PanelHeader title="Portfolio" />
          <div className="p-4 space-y-5">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Loans by Product</p>
              {data.loansByProduct.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">No active loans</p>
              ) : data.loansByProduct.map((lp) => (
                <div key={lp.product} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-[13px] text-foreground">{lp.product}</span>
                    <span className="text-[11px] text-muted-foreground">({lp.count})</span>
                  </div>
                  <span className="text-[13px] font-bold font-mono">{formatKES(lp.outstanding)}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Entities by Type</p>
              {data.entityBreakdown.map((eb) => (
                <div key={eb.entityType} className="flex items-center justify-between py-1.5">
                  <span className="text-[13px] text-foreground">{eb.entityType}</span>
                  <span className="text-[13px] font-mono font-bold text-foreground">{eb.count}</span>
                </div>
              ))}
            </div>
            {data.programsByProduct.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Active Programs</p>
                {data.programsByProduct.map((pp) => (
                  <div key={pp.productType} className="flex items-center justify-between py-1.5">
                    <span className="text-[13px] text-foreground">{pp.productType}</span>
                    <span className="text-[13px] font-mono font-bold text-foreground">{pp.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function KpiCard({ icon: Icon, label, value, color, onClick }: {
  icon: React.ElementType; label: string; value: number; color: string; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} disabled={!onClick} className={cn(
      'border border-border rounded-xl p-4 bg-card text-left transition-all',
      onClick && 'hover:border-primary/40 hover:shadow-md cursor-pointer',
      !onClick && 'cursor-default'
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center',
          color === 'primary' && 'bg-primary/10 text-primary',
          color === 'gold' && 'bg-amber-500/10 text-amber-600',
          color === 'teal' && 'bg-teal-500/10 text-teal-600',
          color === 'blue' && 'bg-blue-500/10 text-blue-600',
          color === 'destructive' && 'bg-red-500/10 text-red-600',
        )}>
          <Icon className="w-[18px] h-[18px]" />
        </div>
        {onClick && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40" />}
      </div>
      <p className="text-[22px] font-bold text-foreground tracking-tight">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">{label}</p>
    </button>
  );
}

function FinCard({ icon: Icon, label, value, accent }: {
  icon: React.ElementType; label: string; value: string; accent?: boolean;
}) {
  return (
    <div className="border border-border rounded-xl p-4 bg-card">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={cn('w-3.5 h-3.5', accent ? 'text-red-500' : 'text-muted-foreground')} />
        <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn('text-lg font-bold tracking-tight', accent ? 'text-red-600' : 'text-foreground')}>{value}</p>
    </div>
  );
}

function QueueCard({ title, subtitle, icon: Icon, items, navigate }: {
  title: string; subtitle: string; icon: React.ElementType;
  items: { label: string; count: number; to: string }[];
  navigate: (to: string) => void;
}) {
  const total = items.reduce((s, i) => s + i.count, 0);
  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-[18px] h-[18px] text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-bold text-foreground">{title}</p>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        {total > 0 && (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-primary text-primary-foreground">{total}</span>
        )}
      </div>
      <div className="divide-y divide-border">
        {items.map((item) => (
          <button key={item.label} onClick={() => navigate(item.to)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left">
            <span className="text-[13px] font-medium text-foreground">{item.label}</span>
            <div className="flex items-center gap-2.5">
              {item.count > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-700">{item.count}</span>
              ) : (
                <span className="text-[11px] text-muted-foreground font-mono">0</span>
              )}
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function PanelHeader({ title, onViewAll }: { title: string; onViewAll?: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
      <h2 className="font-bold text-foreground text-[13px]">{title}</h2>
      {onViewAll && (
        <button onClick={onViewAll} className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium">
          View all <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Approved: 'bg-emerald-500/10 text-emerald-600',
    Active: 'bg-emerald-500/10 text-emerald-600',
    'In Review': 'bg-blue-500/10 text-blue-600',
    'Under Review': 'bg-blue-500/10 text-blue-600',
    Pending: 'bg-amber-500/10 text-amber-700',
    'Pending Approval': 'bg-amber-500/10 text-amber-700',
    Requested: 'bg-muted text-muted-foreground',
    Rejected: 'bg-red-500/10 text-red-600',
    Disbursed: 'bg-purple-500/10 text-purple-600',
  };
  return (
    <span className={cn('px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap', map[status] || 'bg-muted text-muted-foreground')}>
      {status}
    </span>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <p className="text-[13px] text-muted-foreground text-center py-8">{label}</p>;
}

function DashboardSkeleton() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
      </div>
    </div>
  );
}
