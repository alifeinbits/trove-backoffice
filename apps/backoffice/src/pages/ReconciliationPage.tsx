import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getReconciliation, GetReconciliationOutputType, reconcileBankStatement, ReconcileBankStatementOutputType } from 'zitejs/api';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { Badge } from '@project/components/ui/badge';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Skeleton } from '@project/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@project/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import {
  AlertTriangle, CheckCircle2, XCircle, Upload, ArrowRightLeft,
  FileText, DollarSign, TrendingDown, Search, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

type ReconcData = GetReconciliationOutputType;
type StatementResult = ReconcileBankStatementOutputType;

function fmt(n: number) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function issueBadge(issue: string) {
  const color = issue.includes('Failed') || issue.includes('Overpayment') || issue.includes('mismatch')
    ? 'destructive' : issue.includes('Pending') || issue.includes('Overdue')
    ? 'outline' : 'secondary';
  return <Badge variant={color} className="text-xs">{issue}</Badge>;
}

function confidenceBadge(c: string) {
  if (c === 'exact') return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-200 text-xs">Exact</Badge>;
  if (c === 'likely') return <Badge className="bg-amber-500/15 text-amber-700 border-amber-200 text-xs">Likely</Badge>;
  return <Badge variant="outline" className="text-xs">Partial</Badge>;
}

// KPI Card
function KpiCard({ title, value, sub, icon: Icon, variant = 'default' }: {
  title: string; value: string; sub?: string;
  icon: React.ElementType; variant?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const colors = {
    default: 'bg-primary/10 text-primary',
    success: 'bg-emerald-500/10 text-emerald-600',
    warning: 'bg-amber-500/10 text-amber-600',
    danger: 'bg-destructive/10 text-destructive',
  };
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[variant]}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Bank statement upload section
function BankStatementTab() {
  const [result, setResult] = useState<StatementResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const text = await file.text();
      const lines = text.trim().split('\n');
      if (lines.length < 2) { toast.error('CSV file must have a header row and data'); return; }

      const header = lines[0].toLowerCase();
      const dateIdx = header.split(',').findIndex(h => h.includes('date'));
      const descIdx = header.split(',').findIndex(h => h.includes('desc') || h.includes('narration') || h.includes('particular'));
      const amtIdx = header.split(',').findIndex(h => h.includes('amount') || h.includes('credit'));
      const refIdx = header.split(',').findIndex(h => h.includes('ref') || h.includes('receipt'));

      const entries = lines.slice(1).filter(l => l.trim()).map(line => {
        const cols = line.split(',').map(c => c.replace(/"/g, '').trim());
        return {
          date: cols[dateIdx >= 0 ? dateIdx : 0] || '',
          description: cols[descIdx >= 0 ? descIdx : 1] || '',
          amount: Math.abs(parseFloat(cols[amtIdx >= 0 ? amtIdx : 2] || '0')),
          reference: refIdx >= 0 ? cols[refIdx] : undefined,
          type: 'credit' as const,
        };
      }).filter(e => e.amount > 0);

      if (entries.length === 0) { toast.error('No valid entries found in CSV'); return; }

      const data = await reconcileBankStatement({ entries });
      setResult(data);
      toast.success(`Processed ${entries.length} entries: ${data.summary.matchedCount} matched, ${data.summary.unmatchedCount} unmatched`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to process file');
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, []);

  const filteredMatched = useMemo(() => {
    if (!result) return [];
    if (!search) return result.matched;
    const s = search.toLowerCase();
    return result.matched.filter(m =>
      m.entryDescription.toLowerCase().includes(s) ||
      m.transactionRef.toLowerCase().includes(s)
    );
  }, [result, search]);

  const filteredUnmatched = useMemo(() => {
    if (!result) return [];
    if (!search) return result.unmatched;
    const s = search.toLowerCase();
    return result.unmatched.filter(m =>
      m.entryDescription.toLowerCase().includes(s)
    );
  }, [result, search]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Upload Bank Statement</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Upload a CSV file with columns: Date, Description/Narration, Amount, Reference (optional).
                The system will auto-match entries against existing transactions.
              </p>
            </div>
            <div>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleUpload} />
              <Button onClick={() => fileRef.current?.click()} disabled={loading}>
                <Upload className="w-4 h-4 mr-2" />
                {loading ? 'Processing…' : 'Upload CSV'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KpiCard title="Total Entries" value={String(result.summary.totalEntries)} icon={FileText} />
            <KpiCard title="Matched" value={String(result.summary.matchedCount)} icon={CheckCircle2} variant="success" sub={fmt(result.summary.matchedTotal)} />
            <KpiCard title="Unmatched" value={String(result.summary.unmatchedCount)} icon={XCircle} variant="danger" sub={fmt(result.summary.unmatchedTotal)} />
            <KpiCard title="Match Rate" value={`${result.summary.totalEntries > 0 ? Math.round((result.summary.matchedCount / result.summary.totalEntries) * 100) : 0}%`} icon={ArrowRightLeft} variant={result.summary.matchedCount >= result.summary.unmatchedCount ? 'success' : 'warning'} />
          </div>

          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search entries…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
          </div>

          {filteredMatched.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Matched Entries ({filteredMatched.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bank Entry</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>System Transaction</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMatched.map(m => (
                      <TableRow key={m.entryIndex}>
                        <TableCell>
                          <div className="font-medium text-sm">{m.entryDescription}</div>
                          <div className="text-xs text-muted-foreground">{m.entryDate}</div>
                        </TableCell>
                        <TableCell className="font-medium">{fmt(m.entryAmount)}</TableCell>
                        <TableCell>
                          <div className="text-sm">{m.transactionRef}</div>
                        </TableCell>
                        <TableCell>{confidenceBadge(m.matchConfidence)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{m.transactionStatus}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {filteredUnmatched.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-destructive" /> Unmatched Entries ({filteredUnmatched.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Suggested Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUnmatched.map(m => (
                      <TableRow key={m.entryIndex}>
                        <TableCell className="font-medium text-sm">{m.entryDescription}</TableCell>
                        <TableCell className="font-medium">{fmt(m.entryAmount)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{m.entryDate}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{m.suggestedAction}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default function ReconciliationPage() {
  const [data, setData] = useState<ReconcData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await getReconciliation({ tab: 'overview' });
      setData(d);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load reconciliation data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!data) return null;

  const { kpis } = data;

  const filteredTxnDisc = search
    ? data.transactionDiscrepancies.filter(t =>
        t.reference.toLowerCase().includes(search.toLowerCase()) ||
        t.issue.toLowerCase().includes(search.toLowerCase())
      )
    : data.transactionDiscrepancies;

  const filteredInvDisc = search
    ? data.invoiceDiscrepancies.filter(i =>
        i.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
        i.issue.toLowerCase().includes(search.toLowerCase())
      )
    : data.invoiceDiscrepancies;

  const filteredLoanMismatches = search
    ? data.loanBalanceMismatches.filter(l =>
        l.loanReference.toLowerCase().includes(search.toLowerCase()) ||
        (l.entityName || '').toLowerCase().includes(search.toLowerCase())
      )
    : data.loanBalanceMismatches;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reconciliation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Match transactions, verify invoices, and reconcile bank statements
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">
            Transactions
            {kpis.unmatchedTransactions > 0 && (
              <Badge variant="destructive" className="ml-2 text-[10px] px-1.5 py-0">{kpis.unmatchedTransactions}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="invoices">
            Invoices
            {data.invoiceDiscrepancies.length > 0 && (
              <Badge variant="destructive" className="ml-2 text-[10px] px-1.5 py-0">{data.invoiceDiscrepancies.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="loans">
            Loan Balances
            {data.loanBalanceMismatches.length > 0 && (
              <Badge variant="destructive" className="ml-2 text-[10px] px-1.5 py-0">{data.loanBalanceMismatches.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="statements">Bank Statements</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard title="Total Transactions" value={String(kpis.totalTransactions)} sub={fmt(kpis.totalTransactionAmount)} icon={ArrowRightLeft} />
            <KpiCard title="Matched" value={String(kpis.matchedTransactions)} sub={fmt(kpis.matchedAmount)} icon={CheckCircle2} variant="success" />
            <KpiCard title="Unmatched" value={String(kpis.unmatchedTransactions)} sub={fmt(kpis.unmatchedAmount)} icon={AlertTriangle} variant="warning" />
            <KpiCard title="Discrepancies" value={String(kpis.discrepancyCount)} icon={XCircle} variant={kpis.discrepancyCount > 0 ? 'danger' : 'success'} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KpiCard title="Total Invoices" value={String(kpis.totalInvoices)} sub={fmt(kpis.invoiceAmountTotal)} icon={FileText} />
            <KpiCard title="Financed Invoices" value={String(kpis.financedInvoices)} sub={fmt(kpis.financedAmountTotal)} icon={DollarSign} variant="success" />
            <KpiCard title="Unfinanced" value={String(kpis.unfinancedInvoices)} sub={fmt(kpis.invoiceAmountTotal - kpis.financedAmountTotal)} icon={TrendingDown} variant="warning" />
          </div>

          {/* Quick view of top discrepancies */}
          {data.transactionDiscrepancies.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Recent Transaction Issues</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.transactionDiscrepancies.slice(0, 5).map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium text-sm">{t.reference || '—'}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{t.type}</Badge></TableCell>
                        <TableCell className="font-medium">{fmt(t.amount)}</TableCell>
                        <TableCell>{issueBadge(t.issue)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{fmtDate(t.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {data.loanBalanceMismatches.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Loan Balance Variances</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Loan</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Expected Balance</TableHead>
                      <TableHead>Actual Balance</TableHead>
                      <TableHead>Variance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.loanBalanceMismatches.slice(0, 5).map(l => (
                      <TableRow key={l.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/loans/${l.id}`)}>
                        <TableCell className="font-medium text-sm">{l.loanReference}</TableCell>
                        <TableCell className="text-sm">{l.entityName || '—'}</TableCell>
                        <TableCell>{fmt(l.expectedBalance)}</TableCell>
                        <TableCell>{fmt(l.outstandingBalance)}</TableCell>
                        <TableCell className="font-semibold text-destructive">{fmt(l.variance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by reference or issue…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Loan</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTxnDisc.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                      No transaction discrepancies found
                    </TableCell></TableRow>
                  ) : filteredTxnDisc.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium text-sm">{t.reference || '—'}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{t.type}</Badge></TableCell>
                      <TableCell className="font-medium">{fmt(t.amount)}</TableCell>
                      <TableCell><Badge variant={t.status === 'Failed' ? 'destructive' : 'outline'} className="text-xs">{t.status}</Badge></TableCell>
                      <TableCell className="text-sm">{t.loanReference || '—'}</TableCell>
                      <TableCell>{issueBadge(t.issue)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(t.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by invoice number or issue…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issuer</TableHead>
                    <TableHead>Financing</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvDisc.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                      No invoice discrepancies found
                    </TableCell></TableRow>
                  ) : filteredInvDisc.map(i => (
                    <TableRow key={i.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/invoices/${i.id}`)}>
                      <TableCell className="font-medium text-sm">{i.invoiceNumber}</TableCell>
                      <TableCell className="font-medium">{fmt(i.amount)}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{i.status}</Badge></TableCell>
                      <TableCell className="text-sm">{i.issuerName || '—'}</TableCell>
                      <TableCell>
                        {i.financingStatus
                          ? <Badge variant="outline" className="text-xs">{i.financingStatus} {i.financedAmount != null && `· ${fmt(i.financedAmount)}`}</Badge>
                          : <span className="text-xs text-muted-foreground">None</span>
                        }
                      </TableCell>
                      <TableCell>{issueBadge(i.issue)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(i.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loans" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by loan or entity…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loan Reference</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Principal</TableHead>
                    <TableHead>Total Repayments</TableHead>
                    <TableHead>Expected Balance</TableHead>
                    <TableHead>Actual Balance</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLoanMismatches.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                      All loan balances are reconciled
                    </TableCell></TableRow>
                  ) : filteredLoanMismatches.map(l => (
                    <TableRow key={l.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/loans/${l.id}`)}>
                      <TableCell className="font-medium text-sm">{l.loanReference}</TableCell>
                      <TableCell className="text-sm">{l.entityName || '—'}</TableCell>
                      <TableCell>{fmt(l.principal)}</TableCell>
                      <TableCell>{fmt(l.totalRepayments)}</TableCell>
                      <TableCell>{fmt(l.expectedBalance)}</TableCell>
                      <TableCell>{fmt(l.outstandingBalance)}</TableCell>
                      <TableCell className="text-right font-semibold text-destructive">{fmt(l.variance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statements" className="mt-4">
          <BankStatementTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
