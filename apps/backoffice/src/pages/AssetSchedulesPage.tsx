import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@project/components/ui/skeleton';
import { Input } from '@project/components/ui/input';
import { toast } from 'sonner';
import { getAssetSchedules, GetAssetSchedulesOutputType } from 'zitejs/api';
import {
  Search, Car, Calendar, Wrench, ShieldCheck, AlertTriangle, ShieldX,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@project/components/ui/select';

type Asset = GetAssetSchedulesOutputType['assets'][0];

function formatKES(n: number) {
  return `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;
}

const statusColors: Record<string, string> = {
  Active: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  Returned: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'Written Off': 'bg-red-500/10 text-red-600 border-red-500/20',
  Pending: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
};

const categoryIcons: Record<string, React.ElementType> = {
  Vehicle: Car,
  Equipment: Wrench,
  Machinery: Wrench,
};

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-lg font-bold ${accent || 'text-foreground'}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function insuranceDaysLeft(expiry: string | null): number | null {
  if (!expiry) return null;
  return differenceInDays(new Date(expiry + 'T00:00:00'), new Date());
}

export default function AssetSchedulesPage() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    setLoading(true);
    getAssetSchedules({ status: statusFilter !== 'all' ? statusFilter : undefined })
      .then((r) => setAssets(r.assets))
      .catch(() => toast.error('Failed to load asset schedules'))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const filtered = useMemo(() => assets.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.assetReference?.toLowerCase().includes(q) ||
      a.entityName?.toLowerCase().includes(q) ||
      a.makeAndModel?.toLowerCase().includes(q) ||
      a.serialNumber?.toLowerCase().includes(q) ||
      a.assetCategory?.toLowerCase().includes(q) ||
      a.loanReference?.toLowerCase().includes(q) ||
      a.programName?.toLowerCase().includes(q)
    );
  }), [assets, search]);

  const stats = useMemo(() => {
    const active = filtered.filter((a) => a.status === 'Active').length;
    const totalValue = filtered.reduce((s, a) => s + (a.assetValue ?? 0), 0);
    const totalResidual = filtered.reduce((s, a) => s + (a.residualValue ?? 0), 0);
    const insuranceExpiring = filtered.filter((a) => {
      const d = insuranceDaysLeft(a.insuranceExpiry);
      return d !== null && d >= 0 && d <= 30;
    }).length;
    const noInsurance = filtered.filter((a) => a.status === 'Active' && !a.insurancePolicyNumber).length;
    return { active, totalValue, totalResidual, insuranceExpiring, noInsurance, total: filtered.length };
  }, [filtered]);

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Car className="w-5 h-5 text-primary" /> Asset Schedules
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Leased assets management — {assets.length} asset{assets.length !== 1 ? 's' : ''} on record
          </p>
        </div>
      </div>

      {/* Summary stats */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          <StatCard label="Total" value={String(stats.total)} />
          <StatCard label="Active" value={String(stats.active)} accent="text-emerald-600" />
          <StatCard label="Asset Value" value={formatKES(stats.totalValue)} />
          <StatCard label="Residual Value" value={formatKES(stats.totalResidual)} />
          <StatCard
            label="Insurance Expiring"
            value={String(stats.insuranceExpiring)}
            accent={stats.insuranceExpiring > 0 ? 'text-amber-600' : 'text-muted-foreground'}
            sub="within 30 days"
          />
          <StatCard
            label="No Insurance"
            value={String(stats.noInsurance)}
            accent={stats.noInsurance > 0 ? 'text-red-600' : 'text-muted-foreground'}
            sub="active assets"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search assets, entities, serial numbers, loans…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Returned">Returned</SelectItem>
            <SelectItem value="Written Off">Written Off</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Car className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No asset schedules found</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground text-left">
                  <th className="py-2.5 px-4 font-medium">Asset Ref</th>
                  <th className="py-2.5 px-4 font-medium">Entity</th>
                  <th className="py-2.5 px-4 font-medium">Category</th>
                  <th className="py-2.5 px-4 font-medium">Make & Model</th>
                  <th className="py-2.5 px-4 font-medium text-right">Asset Value</th>
                  <th className="py-2.5 px-4 font-medium text-right">Residual</th>
                  <th className="py-2.5 px-4 font-medium">Lease Period</th>
                  <th className="py-2.5 px-4 font-medium">Insurance</th>
                  <th className="py-2.5 px-4 font-medium text-center">Status</th>
                  <th className="py-2.5 px-4 font-medium">Loan</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const CatIcon = categoryIcons[a.assetCategory || ''] || Wrench;
                  const insDays = insuranceDaysLeft(a.insuranceExpiry);
                  const insExpiringSoon = insDays !== null && insDays >= 0 && insDays <= 30;
                  const insExpired = insDays !== null && insDays < 0;
                  const noInsurance = a.status === 'Active' && !a.insurancePolicyNumber;

                  return (
                    <tr key={a.id} className={`border-b border-border last:border-0 hover:bg-muted/20 transition-colors ${noInsurance ? 'bg-red-500/[0.03]' : insExpiringSoon ? 'bg-amber-500/[0.03]' : ''}`}>
                      <td className="py-3 px-4 font-mono text-xs font-medium">{a.assetReference || '—'}</td>
                      <td className="py-3 px-4">
                        {a.entityId ? (
                          <button onClick={() => navigate(`/entities/${a.entityId}`)} className="text-primary hover:underline text-left text-sm">
                            {a.entityName || '—'}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">{a.entityName || '—'}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <CatIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span>{a.assetCategory || '—'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <span className="text-foreground">{a.makeAndModel || '—'}</span>
                          {a.yearOfManufacture && (
                            <span className="text-xs text-muted-foreground ml-1">({a.yearOfManufacture})</span>
                          )}
                        </div>
                        {a.serialNumber && (
                          <p className="text-xs text-muted-foreground font-mono">S/N: {a.serialNumber}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {a.assetValue != null ? formatKES(a.assetValue) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right text-xs text-muted-foreground">
                        {a.residualValue != null ? formatKES(a.residualValue) : '—'}
                        {a.depreciationRate != null && (
                          <p className="text-[10px]">{(a.depreciationRate * 100).toFixed(1)}%/yr</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {a.leaseStartDate && a.leaseEndDate ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                            <span>{format(new Date(a.leaseStartDate + 'T00:00:00'), 'MMM yy')}</span>
                            <span className="text-muted-foreground">→</span>
                            <span>{format(new Date(a.leaseEndDate + 'T00:00:00'), 'MMM yy')}</span>
                          </div>
                        ) : a.leaseTermMonths ? (
                          <span>{a.leaseTermMonths} months</span>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {noInsurance ? (
                          <div className="flex items-center gap-1 text-red-600">
                            <ShieldX className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="font-medium">No policy</span>
                          </div>
                        ) : a.insurancePolicyNumber ? (
                          <div>
                            <div className="flex items-center gap-1">
                              <ShieldCheck className={`w-3 h-3 flex-shrink-0 ${insExpired ? 'text-red-500' : insExpiringSoon ? 'text-amber-500' : 'text-emerald-500'}`} />
                              <span className="truncate max-w-[80px]" title={a.insurancePolicyNumber}>{a.insurancePolicyNumber}</span>
                            </div>
                            {a.insuranceExpiry && (
                              <p className={`text-[10px] flex items-center gap-0.5 ${insExpired ? 'text-red-600 font-medium' : insExpiringSoon ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
                                {(insExpiringSoon || insExpired) && <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" />}
                                {insExpired ? 'Expired ' : insExpiringSoon ? `${insDays}d left — ` : 'Exp: '}
                                {format(new Date(a.insuranceExpiry + 'T00:00:00'), 'dd MMM yy')}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[a.status || ''] || 'bg-muted text-muted-foreground border-border'}`}>
                          {a.status || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {a.loanReference ? (
                          <span className="font-mono text-xs text-primary">{a.loanReference}</span>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
