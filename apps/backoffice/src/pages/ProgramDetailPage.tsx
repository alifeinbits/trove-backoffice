import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Skeleton } from '@project/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Label } from '@project/components/ui/label';
import { toast } from 'sonner';
import { getProgramDetail, saveFiPricing, getFinancialInstitutions } from 'zitejs/api';
import { ArrowLeft, Plus, Building2, Users, CreditCard, Banknote, Percent, Zap } from 'lucide-react';
import { Switch } from '@project/components/ui/switch';
import { MoneyFlowDiagram } from '../components/MoneyFlow';
import { format } from 'date-fns';

function formatKES(n: number) {
  return `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;
}

function Badge({ status, map }: { status: string; map: Record<string, string> }) {
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-muted text-muted-foreground'}`}>{status}</span>;
}

export default function ProgramDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [showPricingDialog, setShowPricingDialog] = useState(false);
  const [fiList, setFiList] = useState<any[]>([]);
  const [pricingForm, setPricingForm] = useState({
    fiId: '', productType: '', minLimit: '', maxLimit: '',
    transactionFeeRate: '', processingFeeFixed: '', penaltyFeeRate: '',
    interestRate: '', tenorDays: '',
    troveFeeRate: '', troveFeeFixed: '',
    fiChargeRate: '', fiChargeFixed: '',
    autoDisburse: false,
  });
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!id) return;
    setLoading(true);
    getProgramDetail({ programId: id })
      .then(r => setData(r.program))
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const openPricingDialog = async () => {
    try {
      const res = await getFinancialInstitutions({});
      setFiList(res.institutions);
      setPricingForm({ fiId: '', productType: data?.productType || '', minLimit: '', maxLimit: '', transactionFeeRate: '', processingFeeFixed: '', penaltyFeeRate: '', interestRate: '', tenorDays: '', troveFeeRate: '', troveFeeFixed: '', fiChargeRate: '', fiChargeFixed: '', autoDisburse: false });
      setShowPricingDialog(true);
    } catch { toast.error('Failed to load FIs'); }
  };

  const handleSavePricing = async () => {
    if (!id || !pricingForm.fiId || !pricingForm.minLimit || !pricingForm.maxLimit) {
      toast.error('Fill all required fields'); return;
    }
    setSaving(true);
    try {
      await saveFiPricing({
        programId: id,
        fiId: pricingForm.fiId,
        productType: pricingForm.productType || data?.productType || 'Invoice Finance',
        minLimit: Number(pricingForm.minLimit),
        maxLimit: Number(pricingForm.maxLimit),
        transactionFeeRate: Number(pricingForm.transactionFeeRate) || 0,
        processingFeeFixed: Number(pricingForm.processingFeeFixed) || 0,
        penaltyFeeRate: Number(pricingForm.penaltyFeeRate) || 0,
        interestRate: Number(pricingForm.interestRate) || 0,
        tenorDays: Number(pricingForm.tenorDays) || 0,
        troveFeeRate: Number(pricingForm.troveFeeRate) || 0,
        troveFeeFixed: Number(pricingForm.troveFeeFixed) || 0,
        fiChargeRate: Number(pricingForm.fiChargeRate) || 0,
        fiChargeFixed: Number(pricingForm.fiChargeFixed) || 0,
        autoDisburse: pricingForm.autoDisburse,
      });
      toast.success('Pricing saved');
      setShowPricingDialog(false);
      load();
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-8"><Skeleton className="h-8 w-64 mb-4" /><Skeleton className="h-64" /></div>;
  if (!data) return <div className="p-8 text-muted-foreground">Program not found</div>;

  const stats = data.stats || {};
  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'pricing', label: 'FI Pricing' },
    { key: 'entities', label: 'Entities' },
  ];

  return (
    <div className="p-8">
      <button onClick={() => navigate('/programs')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Programs
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">{data.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-muted-foreground">{data.productType}</span>
            <Badge status={data.status || 'Active'} map={{ Active: 'bg-emerald-500/10 text-emerald-600', Suspended: 'bg-yellow-500/10 text-yellow-700', Closed: 'bg-muted text-muted-foreground' }} />
          </div>
          {data.anchorName && <p className="text-xs text-muted-foreground mt-1">Program Owner: {data.anchorName}</p>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        <StatCard label="Entities" value={String(stats.entityCount)} icon={Users} />
        <StatCard label="Loans" value={String(stats.loanCount)} icon={CreditCard} />
        <StatCard label="Disbursed" value={formatKES(stats.totalDisbursed)} icon={Banknote} />
        <StatCard label="Outstanding" value={formatKES(stats.totalOutstanding)} icon={Banknote} />
        <StatCard label="Overdue" value={String(stats.overdueCount)} icon={CreditCard} />
        <StatCard label="Finance Req" value={String(stats.financingRequestCount)} icon={Percent} />
      </div>

      {/* Program details */}
      {data.description && <p className="text-sm text-muted-foreground mb-4">{data.description}</p>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {data.programSize != null && <MiniDetail label="Program Size" value={formatKES(data.programSize)} />}
        {data.creditPeriodDays != null && <MiniDetail label="Credit Period" value={`${data.creditPeriodDays} days`} />}
        {data.financePercentage != null && <MiniDetail label="Finance %" value={`${(data.financePercentage * 100).toFixed(0)}%`} />}
        {data.minParticipantLimit != null && <MiniDetail label="Min Limit" value={formatKES(data.minParticipantLimit)} />}
        {data.maxParticipantLimit != null && <MiniDetail label="Max Limit" value={formatKES(data.maxParticipantLimit)} />}
        {data.approvalDate && <MiniDetail label="Approval Date" value={format(new Date(data.approvalDate), 'dd MMM yyyy')} />}
        {data.renewalDate && <MiniDetail label="Renewal Date" value={format(new Date(data.renewalDate), 'dd MMM yyyy')} />}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${tab === t.key ? 'border-primary text-foreground font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
          {data.productType && <MoneyFlowDiagram productType={data.productType} />}
          <p className="text-sm text-muted-foreground">Program created {data.createdAt ? format(new Date(data.createdAt), 'dd MMM yyyy') : '—'}</p>
        </div>
      )}

      {tab === 'pricing' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-foreground text-sm">Attached FI Pricing</h3>
            <Button size="sm" onClick={openPricingDialog}><Plus className="w-3.5 h-3.5 mr-1" /> Add FI Pricing</Button>
          </div>
          {(data.fiPricing || []).length === 0 ? (
            <p className="text-muted-foreground text-sm">No FI pricing attached</p>
          ) : (data.fiPricing || []).map((p: any) => (
            <div key={p.id} className="border border-border rounded-lg bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-medium text-foreground flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> {p.fiName || p.fiTradingName || 'FI'}</p>
                  <p className="text-xs text-muted-foreground">{p.bankCode} • {p.swiftCode}</p>
                </div>
                <Badge status={p.status || 'Active'} map={{ Active: 'bg-emerald-500/10 text-emerald-600', Inactive: 'bg-muted text-muted-foreground' }} />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div><span className="text-muted-foreground">Limits:</span> <span className="text-foreground">{formatKES(Number(p.minLimit || 0))} – {formatKES(Number(p.maxLimit || 0))}</span></div>
                <div><span className="text-muted-foreground">Interest Rate:</span> <span className="text-foreground">{p.interestRate}%</span></div>
                <div><span className="text-muted-foreground">Tenor:</span> <span className="text-foreground">{p.tenorDays} days</span></div>
                <div><span className="text-muted-foreground">Txn Fee:</span> <span className="text-foreground">{p.transactionFeeRate}%</span></div>
                <div><span className="text-muted-foreground">Processing:</span> <span className="text-foreground">{formatKES(Number(p.processingFeeFixed || 0))}</span></div>
                <div><span className="text-muted-foreground">Penalty:</span> <span className="text-foreground">{p.penaltyFeeRate}%</span></div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs mt-2 pt-2 border-t border-border/50">
                <div><span className="text-muted-foreground">Trove Fee:</span> <span className="text-foreground">{p.troveFeeRate}% + {formatKES(Number(p.troveFeeFixed || 0))}</span></div>
                <div><span className="text-muted-foreground">FI Charge:</span> <span className="text-foreground">{p.fiChargeRate}% + {formatKES(Number(p.fiChargeFixed || 0))}</span></div>
                <div><span className="text-muted-foreground">Auto-Disburse:</span> <span className="text-foreground">{p.autoDisburse ? '✅ Enabled' : '—'}</span></div>
              </div>
              {p.tiers && p.tiers.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Pricing Tiers</p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="text-left font-medium py-1">Tier</th>
                        <th className="text-left font-medium py-1">Amount Range</th>
                        <th className="text-left font-medium py-1">Rate</th>
                        <th className="text-left font-medium py-1">Tenor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.tiers.map((t: any, i: number) => (
                        <tr key={i}>
                          <td className="py-1">{t.tierName || `Tier ${i + 1}`}</td>
                          <td className="py-1">{formatKES(t.minAmount)} – {formatKES(t.maxAmount)}</td>
                          <td className="py-1">{t.interestRate}%</td>
                          <td className="py-1">{t.tenorDays}d</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'entities' && (
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-left bg-muted/30">
                <th className="py-2.5 px-4 font-medium">Entity</th>
                <th className="py-2.5 px-4 font-medium">Type</th>
                <th className="py-2.5 px-4 font-medium">KYC</th>
                <th className="py-2.5 px-4 font-medium">Status</th>
                <th className="py-2.5 px-4 font-medium">Limit</th>
              </tr>
            </thead>
            <tbody>
              {(data.entities || []).map((e: any) => (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer" onClick={() => navigate(`/entities/${e.id}`)}>
                  <td className="py-3 px-4 font-medium text-foreground">{e.name}</td>
                  <td className="py-3 px-4 text-muted-foreground">{e.entityType}</td>
                  <td className="py-3 px-4"><Badge status={e.kycStatus || 'Pending'} map={{ Approved: 'bg-emerald-500/10 text-emerald-600', Pending: 'bg-yellow-500/10 text-yellow-700', 'In Review': 'bg-blue-500/10 text-blue-600', Rejected: 'bg-red-500/10 text-red-600' }} /></td>
                  <td className="py-3 px-4"><Badge status={e.onboardingStatus || '—'} map={{ Active: 'bg-emerald-500/10 text-emerald-600', 'In Progress': 'bg-blue-500/10 text-blue-600' }} /></td>
                  <td className="py-3 px-4 text-muted-foreground">{e.approvedLimit ? formatKES(Number(e.approvedLimit)) : '—'}</td>
                </tr>
              ))}
              {(data.entities || []).length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No entities in this program</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add FI Pricing Dialog */}
      <Dialog open={showPricingDialog} onOpenChange={setShowPricingDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add FI Pricing</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Financial Institution</Label>
              <Select value={pricingForm.fiId} onValueChange={v => setPricingForm({ ...pricingForm, fiId: v })}>
                <SelectTrigger><SelectValue placeholder="Select FI" /></SelectTrigger>
                <SelectContent>
                  {fiList.map(fi => <SelectItem key={fi.id} value={fi.id}>{fi.legalName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Min Limit (KES)</Label><Input type="number" value={pricingForm.minLimit} onChange={e => setPricingForm({ ...pricingForm, minLimit: e.target.value })} /></div>
              <div><Label className="text-xs">Max Limit (KES)</Label><Input type="number" value={pricingForm.maxLimit} onChange={e => setPricingForm({ ...pricingForm, maxLimit: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Txn Fee %</Label><Input type="number" step="0.1" value={pricingForm.transactionFeeRate} onChange={e => setPricingForm({ ...pricingForm, transactionFeeRate: e.target.value })} /></div>
              <div><Label className="text-xs">Processing Fee</Label><Input type="number" value={pricingForm.processingFeeFixed} onChange={e => setPricingForm({ ...pricingForm, processingFeeFixed: e.target.value })} /></div>
              <div><Label className="text-xs">Penalty %</Label><Input type="number" step="0.1" value={pricingForm.penaltyFeeRate} onChange={e => setPricingForm({ ...pricingForm, penaltyFeeRate: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Interest Rate %</Label><Input type="number" step="0.1" value={pricingForm.interestRate} onChange={e => setPricingForm({ ...pricingForm, interestRate: e.target.value })} /></div>
              <div><Label className="text-xs">Tenor (days)</Label><Input type="number" value={pricingForm.tenorDays} onChange={e => setPricingForm({ ...pricingForm, tenorDays: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Trove Fee %</Label><Input type="number" step="0.1" value={pricingForm.troveFeeRate} onChange={e => setPricingForm({ ...pricingForm, troveFeeRate: e.target.value })} /></div>
              <div><Label className="text-xs">Trove Fee Fixed (KES)</Label><Input type="number" value={pricingForm.troveFeeFixed} onChange={e => setPricingForm({ ...pricingForm, troveFeeFixed: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">FI Charge %</Label><Input type="number" step="0.1" value={pricingForm.fiChargeRate} onChange={e => setPricingForm({ ...pricingForm, fiChargeRate: e.target.value })} /></div>
              <div><Label className="text-xs">FI Charge Fixed (KES)</Label><Input type="number" value={pricingForm.fiChargeFixed} onChange={e => setPricingForm({ ...pricingForm, fiChargeFixed: e.target.value })} /></div>
            </div>
            <div className="flex items-center justify-between border border-border rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-600" />
                <div>
                  <p className="text-sm font-medium text-foreground">Auto-Disburse</p>
                  <p className="text-xs text-muted-foreground">Automatically flag approved requests for disbursement</p>
                </div>
              </div>
              <Switch checked={pricingForm.autoDisburse} onCheckedChange={v => setPricingForm({ ...pricingForm, autoDisburse: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPricingDialog(false)}>Cancel</Button>
            <Button onClick={handleSavePricing} disabled={saving}>{saving ? 'Saving...' : 'Save Pricing'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="border border-border rounded-lg p-3 bg-card">
      <div className="flex items-center gap-1.5 mb-1"><Icon className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground">{label}</span></div>
      <p className="text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}

function MiniDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs"><span className="text-muted-foreground">{label}:</span> <span className="text-foreground font-medium">{value}</span></div>
  );
}
