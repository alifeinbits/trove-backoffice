import { useState, useEffect } from 'react';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { toast } from 'sonner';
import { getFiLedger, GetFiLedgerOutputType } from 'zitejs/api';
import { BookOpen, ChevronDown, ChevronRight, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@project/components/lib/utils';

type Entry = GetFiLedgerOutputType['entries'][0];

function formatKES(n: number) {
  return `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function FiLedgerPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState<GetFiLedgerOutputType['summary'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getFiLedger({
      status: statusFilter,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    })
      .then((r) => { setEntries(r.entries); setSummary(r.summary); })
      .catch(() => toast.error('Failed to load ledger'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">FI — Ledger & Journal Entries</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Double-entry accounting records for all transactions</p>
        </div>
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[140px] h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[140px] h-8 text-xs" />
          </div>
          <Button size="sm" variant="outline" onClick={load} className="h-8">Filter</Button>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Posted">Posted</SelectItem>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Reversed">Reversed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">Journal Entries</p>
            <p className="text-2xl font-bold text-foreground">{summary.entryCount}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-1.5">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
              <p className="text-xs text-muted-foreground">Total Debits</p>
            </div>
            <p className="text-lg font-bold text-foreground">{formatKES(summary.totalDebits)}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-1.5">
              <ArrowDownRight className="w-3.5 h-3.5 text-blue-600" />
              <p className="text-xs text-muted-foreground">Total Credits</p>
            </div>
            <p className="text-lg font-bold text-foreground">{formatKES(summary.totalCredits)}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      ) : entries.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center bg-card">
          <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No journal entries found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const isExpanded = expandedId === entry.id;
            return (
              <div key={entry.id} className="border border-border rounded-lg bg-card overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="w-full px-4 py-3 flex items-center gap-4 text-left hover:bg-muted/20 transition-colors"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                  <div className="flex-1 min-w-0 grid grid-cols-[80px_1fr_120px_120px_80px] gap-3 items-center text-sm">
                    <span className="font-mono text-xs text-muted-foreground">#{entry.entryNumber}</span>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{entry.description}</p>
                      <p className="text-xs text-muted-foreground truncate">{entry.reference} · {entry.entityName} · {entry.loanReference}</p>
                    </div>
                    <span className="text-right font-medium">{formatKES(entry.totalAmount)}</span>
                    <span className="text-xs text-muted-foreground">{entry.entryDate ? format(new Date(entry.entryDate.slice(0, 10) + 'T00:00:00'), 'dd MMM yyyy') : ''}</span>
                    <StatusPill status={entry.status} />
                  </div>
                </button>

                {isExpanded && entry.lines.length > 0 && (
                  <div className="border-t border-border bg-muted/10 px-4 py-3">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted-foreground">
                          <th className="text-left py-1 font-medium w-[100px]">GL Account</th>
                          <th className="text-left py-1 font-medium">Account Name</th>
                          <th className="text-left py-1 font-medium">Narration</th>
                          <th className="text-right py-1 font-medium w-[120px]">Debit (KES)</th>
                          <th className="text-right py-1 font-medium w-[120px]">Credit (KES)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entry.lines.map((line) => (
                          <tr key={line.id} className="border-t border-border/50">
                            <td className="py-2 font-mono">{line.glAccountNumber}</td>
                            <td className="py-2 text-foreground">{line.glAccountName}</td>
                            <td className="py-2 text-muted-foreground">{line.narration}</td>
                            <td className={cn("py-2 text-right font-mono", line.debitAmount > 0 && "text-emerald-600 font-medium")}>
                              {line.debitAmount > 0 ? formatKES(line.debitAmount) : '—'}
                            </td>
                            <td className={cn("py-2 text-right font-mono", line.creditAmount > 0 && "text-blue-600 font-medium")}>
                              {line.creditAmount > 0 ? formatKES(line.creditAmount) : '—'}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t border-border font-medium">
                          <td colSpan={3} className="py-2 text-right text-muted-foreground">Totals</td>
                          <td className="py-2 text-right font-mono text-emerald-600">
                            {formatKES(entry.lines.reduce((s, l) => s + l.debitAmount, 0))}
                          </td>
                          <td className="py-2 text-right font-mono text-blue-600">
                            {formatKES(entry.lines.reduce((s, l) => s + l.creditAmount, 0))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    Posted: 'bg-emerald-500/10 text-emerald-600',
    Draft: 'bg-yellow-500/10 text-yellow-700',
    Reversed: 'bg-red-500/10 text-red-600',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  );
}
