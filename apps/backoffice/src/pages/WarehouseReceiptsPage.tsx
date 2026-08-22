import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import { Input } from '@project/components/ui/input';
import { toast } from 'sonner';
import { getWarehouseReceipts, GetWarehouseReceiptsOutputType } from 'zitejs/api';
import {
  Warehouse, Search, MapPin, Calendar, Package, AlertTriangle, ExternalLink,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@project/components/ui/select';

type Receipt = GetWarehouseReceiptsOutputType['receipts'][0];

function formatKES(n: number) {
  return `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;
}

const statusColors: Record<string, string> = {
  Active: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  Released: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  Expired: 'bg-red-500/10 text-red-600 border-red-500/20',
  Pledged: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
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

function daysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  return differenceInDays(new Date(expiryDate + 'T00:00:00'), new Date());
}

export default function WarehouseReceiptsPage() {
  const navigate = useNavigate();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    setLoading(true);
    getWarehouseReceipts({ status: statusFilter !== 'all' ? statusFilter : undefined })
      .then((r) => setReceipts(r.receipts))
      .catch(() => toast.error('Failed to load warehouse receipts'))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const filtered = useMemo(() => receipts.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.receiptNumber?.toLowerCase().includes(q) ||
      r.entityName?.toLowerCase().includes(q) ||
      r.commodityType?.toLowerCase().includes(q) ||
      r.warehouseName?.toLowerCase().includes(q) ||
      r.collateralManager?.toLowerCase().includes(q) ||
      r.loanReference?.toLowerCase().includes(q) ||
      r.programName?.toLowerCase().includes(q)
    );
  }), [receipts, search]);

  // Compute summary stats
  const stats = useMemo(() => {
    const active = filtered.filter((r) => r.status === 'Active');
    const pledged = filtered.filter((r) => r.status === 'Pledged');
    const totalValue = filtered.reduce((s, r) => s + (r.totalValue ?? 0), 0);
    const expiringSoon = filtered.filter((r) => {
      const d = daysUntilExpiry(r.expiryDate);
      return d !== null && d >= 0 && d <= 30;
    });
    return { active: active.length, pledged: pledged.length, totalValue, expiringSoon: expiringSoon.length, total: filtered.length };
  }, [filtered]);

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Warehouse className="w-5 h-5 text-primary" /> Warehouse Receipts
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage WRF collateral — {receipts.length} receipt{receipts.length !== 1 ? 's' : ''} on record
          </p>
        </div>
      </div>

      {/* Summary stats */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mb-5">
          <StatCard label="Total" value={String(stats.total)} />
          <StatCard label="Active" value={String(stats.active)} accent="text-emerald-600" />
          <StatCard label="Pledged" value={String(stats.pledged)} accent="text-amber-600" />
          <StatCard label="Total Value" value={formatKES(stats.totalValue)} />
          <StatCard
            label="Expiring ≤30d"
            value={String(stats.expiringSoon)}
            accent={stats.expiringSoon > 0 ? 'text-red-600' : 'text-muted-foreground'}
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search receipts, entities, commodities, loans…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Pledged">Pledged</SelectItem>
            <SelectItem value="Released">Released</SelectItem>
            <SelectItem value="Expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Warehouse className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No warehouse receipts found</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground text-left">
                  <th className="py-2.5 px-4 font-medium">Receipt #</th>
                  <th className="py-2.5 px-4 font-medium">Entity</th>
                  <th className="py-2.5 px-4 font-medium">Commodity</th>
                  <th className="py-2.5 px-4 font-medium">Warehouse</th>
                  <th className="py-2.5 px-4 font-medium text-right">Qty</th>
                  <th className="py-2.5 px-4 font-medium text-right">Total Value</th>
                  <th className="py-2.5 px-4 font-medium">Deposited</th>
                  <th className="py-2.5 px-4 font-medium">Expiry</th>
                  <th className="py-2.5 px-4 font-medium text-center">Status</th>
                  <th className="py-2.5 px-4 font-medium">Collateral Mgr</th>
                  <th className="py-2.5 px-4 font-medium">Loan</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const expiryDays = daysUntilExpiry(r.expiryDate);
                  const isExpiringSoon = expiryDays !== null && expiryDays >= 0 && expiryDays <= 30;
                  const isExpired = expiryDays !== null && expiryDays < 0;
                  return (
                    <tr key={r.id} className={`border-b border-border last:border-0 hover:bg-muted/20 transition-colors ${isExpiringSoon ? 'bg-amber-500/[0.03]' : ''} ${isExpired ? 'bg-red-500/[0.03]' : ''}`}>
                      <td className="py-3 px-4 font-mono text-xs font-medium">{r.receiptNumber || '—'}</td>
                      <td className="py-3 px-4">
                        {r.entityId ? (
                          <button onClick={() => navigate(`/entities/${r.entityId}`)} className="text-primary hover:underline text-left text-sm">
                            {r.entityName || '—'}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">{r.entityName || '—'}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span>{r.commodityType || '—'}</span>
                          {r.grade && <span className="text-xs text-muted-foreground">({r.grade})</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs truncate">{r.warehouseName || '—'}</p>
                            {r.warehouseLocation && <p className="text-[10px] text-muted-foreground truncate">{r.warehouseLocation}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs">
                        {r.quantity != null ? `${r.quantity.toLocaleString()} ${r.unitOfMeasure || ''}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {r.totalValue != null ? formatKES(r.totalValue) : '—'}
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        {r.dateDeposited ? format(new Date(r.dateDeposited + 'T00:00:00'), 'dd MMM yy') : '—'}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="flex items-center gap-1">
                          {isExpiringSoon && <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                          {isExpired && <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />}
                          <span className={isExpired ? 'text-red-600 font-medium' : isExpiringSoon ? 'text-amber-600 font-medium' : 'text-muted-foreground'}>
                            {r.expiryDate ? format(new Date(r.expiryDate + 'T00:00:00'), 'dd MMM yy') : '—'}
                          </span>
                        </div>
                        {isExpiringSoon && expiryDays !== null && (
                          <p className="text-[10px] text-amber-600 font-medium">{expiryDays}d remaining</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[r.status || ''] || 'bg-muted text-muted-foreground border-border'}`}>
                          {r.status || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground truncate max-w-[100px]" title={r.collateralManager || undefined}>
                        {r.collateralManager || '—'}
                      </td>
                      <td className="py-3 px-4">
                        {r.loanReference ? (
                          <button
                            onClick={() => {/* navigate to loan if we had ID */}}
                            className="font-mono text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            {r.loanReference}
                          </button>
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
