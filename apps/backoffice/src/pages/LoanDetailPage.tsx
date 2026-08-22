import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import { toast } from 'sonner';
import { getLoanDetail, recordRepayment } from 'zitejs/api';
import {
  ArrowLeft, Building2, Calendar, CreditCard, AlertTriangle, CheckCircle2,
  Clock, ArrowUpRight, Banknote, TrendingUp, Bell, Receipt, ShieldAlert,
  PlusCircle, Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@project/components/ui/dialog';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@project/components/ui/select';

function formatKES(n: number) {
  return `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;
}

const statusColors: Record<string, string> = {
  Active: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  Overdue: 'bg-red-500/10 text-red-600 border-red-500/20',
  Settled: 'bg-muted text-muted-foreground border-border',
  'Written Off': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
};

const classColors: Record<string, string> = {
  Performing: 'bg-emerald-500/10 text-emerald-600',
  Watch: 'bg-yellow-500/10 text-yellow-700',
  'Special Mention': 'bg-amber-500/10 text-amber-700',
  Substandard: 'bg-orange-500/10 text-orange-700',
  Doubtful: 'bg-red-500/10 text-red-600',
  Loss: 'bg-red-600/20 text-red-700',
};

export default function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loan, setLoan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'transactions' | 'charges' | 'reminders'>('transactions');
  const [repayOpen, setRepayOpen] = useState(false);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayMethod, setRepayMethod] = useState<'Bank Transfer' | 'M-Pesa'>('Bank Transfer');
  const [repayReceipt, setRepayReceipt] = useState('');
  const [repayPhone, setRepayPhone] = useState('');
  const [repaySubmitting, setRepaySubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getLoanDetail({ loanId: id })
      .then((r) => setLoan(r.loan))
      .catch(() => toast.error('Failed to load loan'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!loan) return <div className="p-8 text-muted-foreground">Loan not found</div>;

  const handleRecordRepayment = async () => {
    const amt = parseFloat(repayAmount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    setRepaySubmitting(true);
    try {
      const res = await recordRepayment({
        loanId: id!,
        amount: amt,
        paymentMethod: repayMethod,
        mPesaReceipt: repayMethod === 'M-Pesa' ? repayReceipt : undefined,
        phoneNumber: repayMethod === 'M-Pesa' ? repayPhone : undefined,
        bankReference: repayMethod === 'Bank Transfer' ? repayReceipt : undefined,
      });
      toast.success(res.loanSettled ? 'Repayment recorded — Loan settled!' : `Repayment recorded. New balance: KES ${res.newOutstanding.toLocaleString()}`);
      setRepayOpen(false);
      setRepayAmount(''); setRepayReceipt(''); setRepayPhone('');
      // Reload loan
      getLoanDetail({ loanId: id! }).then((r) => setLoan(r.loan));
    } catch (e: any) {
      toast.error(e?.message || 'Failed to record repayment');
    } finally {
      setRepaySubmitting(false);
    }
  };

  const l = loan;
  const repaidAmount = l.principal - l.outstandingBalance;
  const repaidPct = l.principal > 0 ? (repaidAmount / l.principal) * 100 : 0;
  const pb = l.penaltyBreakdown;

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-foreground font-mono">{l.loanReference}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusColors[l.status] || 'bg-muted text-muted-foreground border-border'}`}>
              {l.status}
            </span>
            {l.classification && l.classification !== 'Performing' && (
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${classColors[l.classification] || ''}`}>
                {l.classification}
              </span>
            )}
            {l.daysOverdue > 0 && (
              <span className="text-xs font-semibold text-red-600 bg-red-500/10 px-2 py-0.5 rounded-full">
                {l.daysOverdue}d overdue
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{l.productType} &middot; {l.programName || '—'}</p>
        </div>
        <div className="flex items-center gap-2">
          {l.status !== 'Settled' && l.status !== 'Written Off' && (
            <Button size="sm" onClick={() => { setRepayAmount(String(l.outstandingBalance)); setRepayOpen(true); }}>
              <PlusCircle className="w-4 h-4 mr-1" /> Record Repayment
            </Button>
          )}
          {l.entityId && (
            <Button size="sm" variant="outline" onClick={() => navigate(`/entities/${l.entityId}`)}>
              <Building2 className="w-4 h-4 mr-1" /> {l.entityName || 'View Entity'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left */}
        <div className="lg:col-span-2 space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={Banknote} label="Principal" value={formatKES(l.principal)} />
            <KpiCard icon={TrendingUp} label="Outstanding" value={formatKES(l.outstandingBalance)} accent={l.outstandingBalance > 0 ? 'text-orange-600' : 'text-emerald-600'} />
            <KpiCard icon={CreditCard} label="Interest Rate" value={`${(l.interestRate * 100).toFixed(1)}%`} />
            <KpiCard icon={AlertTriangle} label="Penalty" value={formatKES(l.penaltyAmount)} accent={l.penaltyAmount > 0 ? 'text-red-600' : undefined} />
          </div>

          {/* Repayment progress */}
          <div className="border border-border rounded-xl p-5 bg-card">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Repayment Progress</span>
              <span className="text-sm font-bold text-foreground">{repaidPct.toFixed(0)}%</span>
            </div>
            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${repaidPct >= 100 ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${Math.min(100, repaidPct)}%` }} />
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>Repaid: {formatKES(repaidAmount)}</span>
              <span>Remaining: {formatKES(l.outstandingBalance)}</span>
            </div>
          </div>

          {/* Tabbed section */}
          <div className="border border-border rounded-xl bg-card overflow-hidden">
            <div className="flex border-b border-border">
              <TabButton active={tab === 'transactions'} onClick={() => setTab('transactions')} icon={<CreditCard className="w-3.5 h-3.5" />} label={`Transactions (${l.transactions?.length || 0})`} />
              <TabButton active={tab === 'charges'} onClick={() => setTab('charges')} icon={<Receipt className="w-3.5 h-3.5" />} label={`Charges (${l.chargesTimeline?.length || 0})`} />
              <TabButton active={tab === 'reminders'} onClick={() => setTab('reminders')} icon={<Bell className="w-3.5 h-3.5" />} label={`Reminders (${l.reminders?.length || 0})`} />
            </div>

            {tab === 'transactions' && <TransactionsTable transactions={l.transactions || []} />}
            {tab === 'charges' && <ChargesTimeline charges={l.chargesTimeline || []} />}
            {tab === 'reminders' && <RemindersSection reminders={l.reminders || []} />}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Penalty Breakdown */}
          {l.status === 'Overdue' && pb && (
            <div className="border border-red-200 rounded-xl bg-red-500/5">
              <div className="p-4 border-b border-red-200">
                <h3 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-red-500" /> Penalty Breakdown
                </h3>
              </div>
              <div className="p-4 space-y-3">
                <InfoItem label="Daily Rate" value={`${(pb.pastDueDailyRate * 100).toFixed(2)}%`} />
                <InfoItem label="Daily Penalty" value={formatKES(pb.estimatedDailyPenalty)} />
                <InfoItem label="Accrued Total" value={formatKES(pb.accruedPenalty)} accent="text-red-600 font-bold" />
                <div className="border-t border-red-200 pt-2 mt-2">
                  <p className="text-xs text-muted-foreground mb-1">Projected if unpaid</p>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">7 days</span>
                    <span className="font-medium text-foreground">{formatKES(pb.projectedWeekly)}</span>
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-muted-foreground">30 days</span>
                    <span className="font-medium text-foreground">{formatKES(pb.projectedMonthly)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loan details */}
          <div className="border border-border rounded-xl bg-card">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold text-foreground text-sm">Loan Details</h3>
            </div>
            <div className="p-4 space-y-3">
              <InfoItem label="Classification" value={l.classification} accent={l.classification !== 'Performing' ? 'text-red-600 font-medium' : undefined} />
              <InfoItem label="Disbursed" value={l.disbursedAt ? format(new Date(l.disbursedAt), 'dd MMM yyyy, HH:mm') : '—'} />
              <InfoItem label="Maturity" value={l.maturityDate ? format(new Date(l.maturityDate), 'dd MMM yyyy') : '—'} />
              <InfoItem label="Created" value={l.createdAt ? format(new Date(l.createdAt), 'dd MMM yyyy') : '—'} />
            </div>
          </div>

          {/* Parties */}
          <div className="border border-border rounded-xl bg-card">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-muted-foreground" /> Parties
              </h3>
            </div>
            <div className="p-4 space-y-4">
              {l.parties?.financialInstitution && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Financial Institution</p>
                    <p className="text-sm font-medium text-foreground">{l.parties.financialInstitution}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {l.productType === 'Reverse Factoring' ? 'Buyer' :
                     l.productType === 'Invoice Finance' ? 'Seller' :
                     l.productType === 'Invoice Discounting' ? 'Seller' :
                     l.productType === 'Leasing' ? 'Lessee' :
                     'Requesting Entity'}
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {l.parties?.requestingEntity?.name || l.entityName || '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">{l.parties?.requestingEntity?.type || l.entityType || ''}</p>
                </div>
              </div>
              {l.parties?.borrowerEntity?.name && l.parties.borrowerEntity.name !== (l.parties?.requestingEntity?.name || '') && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {l.productType === 'Reverse Factoring' ? 'Supplier / Borrower' :
                       l.productType === 'Invoice Finance' ? 'Buyer' :
                       l.productType === 'Invoice Discounting' ? 'Buyer' :
                       l.productType === 'Leasing' ? 'Lessor' :
                       'Borrower Entity'}
                    </p>
                    <p className="text-sm font-medium text-foreground">{l.parties.borrowerEntity.name}</p>
                    <p className="text-xs text-muted-foreground">{l.parties.borrowerEntity.type || ''}</p>
                  </div>
                </div>
              )}
              <div className="pt-1">
                <InfoItem label="Program" value={l.programName} />
              </div>
            </div>
          </div>

          {/* Financing Requests */}
          {l.financingRequests?.length > 0 && (
            <div className="border border-border rounded-xl bg-card">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold text-foreground text-sm">Financing Requests</h3>
              </div>
              <div className="divide-y divide-border">
                {l.financingRequests.map((fr: any) => (
                  <div key={fr.id} className="p-4">
                    <p className="text-sm font-medium">#{fr.requestNumber} — {fr.status}</p>
                    <p className="text-xs text-muted-foreground">{formatKES(fr.requestedAmount)} &middot; {fr.productType}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Record Repayment Dialog */}
      <Dialog open={repayOpen} onOpenChange={setRepayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Repayment — {l.loanReference}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex justify-between text-sm bg-muted/50 rounded-lg p-3">
              <span className="text-muted-foreground">Outstanding Balance</span>
              <span className="font-bold text-foreground">{formatKES(l.outstandingBalance)}</span>
            </div>
            <div className="space-y-1.5">
              <Label>Amount (KES)</Label>
              <Input type="number" placeholder="0.00" value={repayAmount} onChange={(e) => setRepayAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select value={repayMethod} onValueChange={(v) => setRepayMethod(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="M-Pesa">M-Pesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {repayMethod === 'M-Pesa' && (
              <div className="space-y-1.5">
                <Label>M-Pesa Receipt Code</Label>
                <Input placeholder="e.g. SJK4H2L8RQ" value={repayReceipt} onChange={(e) => setRepayReceipt(e.target.value)} />
                <Label className="mt-2">Phone Number</Label>
                <Input placeholder="+254..." value={repayPhone} onChange={(e) => setRepayPhone(e.target.value)} />
              </div>
            )}
            {repayMethod === 'Bank Transfer' && (
              <div className="space-y-1.5">
                <Label>Bank Reference</Label>
                <Input placeholder="Transaction reference" value={repayReceipt} onChange={(e) => setRepayReceipt(e.target.value)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRepayOpen(false)} disabled={repaySubmitting}>Cancel</Button>
            <Button onClick={handleRecordRepayment} disabled={repaySubmitting}>
              {repaySubmitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Confirm Repayment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
        active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon} {label}
    </button>
  );
}

function TransactionsTable({ transactions }: { transactions: any[] }) {
  const txIcon = (type: string) => {
    if (type === 'Repayment') return <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />;
    if (type === 'Disbursement') return <CreditCard className="w-3.5 h-3.5 text-blue-500" />;
    if (type === 'Penalty') return <AlertTriangle className="w-3.5 h-3.5 text-red-500" />;
    return <Clock className="w-3.5 h-3.5 text-orange-500" />;
  };

  if (transactions.length === 0) return <div className="p-6 text-center text-sm text-muted-foreground">No transactions yet</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground text-left bg-muted/30">
            <th className="py-2.5 px-4 font-medium">Type</th>
            <th className="py-2.5 px-4 font-medium">Reference</th>
            <th className="py-2.5 px-4 font-medium">Method</th>
            <th className="py-2.5 px-4 font-medium text-right">Amount</th>
            <th className="py-2.5 px-4 font-medium text-center">Status</th>
            <th className="py-2.5 px-4 font-medium text-right">Date</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx: any) => (
            <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/20">
              <td className="py-3 px-4">
                <div className="flex items-center gap-1.5">{txIcon(tx.type)}<span>{tx.type}</span></div>
              </td>
              <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{tx.mPesaReceipt || tx.reference}</td>
              <td className="py-3 px-4 text-muted-foreground text-xs">{tx.paymentMethod}</td>
              <td className={`py-3 px-4 text-right font-medium ${tx.type === 'Repayment' ? 'text-emerald-600' : ''}`}>
                {tx.type === 'Repayment' ? '-' : '+'}{formatKES(tx.amount)}
              </td>
              <td className="py-3 px-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  {tx.status === 'Completed' ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> :
                   tx.status === 'Pending' ? <Clock className="w-3 h-3 text-yellow-500" /> :
                   tx.status === 'Failed' ? <AlertTriangle className="w-3 h-3 text-red-500" /> : null}
                  <span className="text-xs">{tx.status}</span>
                </div>
              </td>
              <td className="py-3 px-4 text-right text-muted-foreground text-xs">
                {tx.createdAt ? format(new Date(tx.createdAt), 'dd MMM yy') : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChargesTimeline({ charges }: { charges: any[] }) {
  if (charges.length === 0) return <div className="p-6 text-center text-sm text-muted-foreground">No charges recorded</div>;

  const typeColors: Record<string, string> = {
    Penalty: 'bg-red-500',
    Interest: 'bg-amber-500',
    Fee: 'bg-blue-500',
  };

  return (
    <div className="p-4 space-y-0">
      {charges.map((c, i) => (
        <div key={c.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${typeColors[c.type] || 'bg-muted-foreground'}`} />
            {i < charges.length - 1 && <div className="w-px flex-1 bg-border" />}
          </div>
          <div className="pb-4 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{c.type}</span>
              <span className="text-sm font-semibold text-foreground">{formatKES(c.amount)}</span>
            </div>
            <p className="text-xs text-muted-foreground">{c.reference}</p>
            {c.date && <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(c.date), 'dd MMM yyyy, HH:mm')}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function RemindersSection({ reminders }: { reminders: any[] }) {
  if (reminders.length === 0) return <div className="p-6 text-center text-sm text-muted-foreground">No reminders sent for this loan</div>;

  return (
    <div className="divide-y divide-border">
      {reminders.map((r) => (
        <div key={r.id} className={`p-4 ${r.read ? 'opacity-60' : ''}`}>
          <div className="flex items-start gap-2">
            <Bell className={`w-3.5 h-3.5 mt-0.5 ${r.read ? 'text-muted-foreground' : 'text-amber-500'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{r.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.message}</p>
              {r.createdAt && <p className="text-xs text-muted-foreground mt-1">{format(new Date(r.createdAt), 'dd MMM yyyy, HH:mm')}</p>}
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${r.read ? 'bg-muted text-muted-foreground' : 'bg-amber-500/10 text-amber-600'}`}>
              {r.read ? 'Read' : 'Unread'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: string }) {
  return (
    <div className="border border-border rounded-xl p-4 bg-card">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-lg font-bold ${accent || 'text-foreground'}`}>{value}</p>
    </div>
  );
}

function InfoItem({ label, value, accent }: { label: string; value: string | null | undefined; accent?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${accent || 'text-foreground'}`}>{value || '—'}</p>
    </div>
  );
}
