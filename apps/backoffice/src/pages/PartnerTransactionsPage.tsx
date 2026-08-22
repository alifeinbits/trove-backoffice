import { useEffect, useState } from 'react';
import { Card, CardContent } from '@project/components/ui/card';
import { Badge } from '@project/components/ui/badge';
import { Input } from '@project/components/ui/input';
import { Skeleton } from '@project/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Receipt, Search } from 'lucide-react';
import { useCurrentRole } from '../components/RoleContext';
import { getPartnerTransactions } from 'zitejs/api';
import { format } from 'date-fns';

function formatCurrency(v: number) {
  return `KES ${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const typeColor: Record<string, string> = {
  Disbursement: 'bg-emerald-100 text-emerald-700',
  Repayment: 'bg-blue-100 text-blue-700',
  Fee: 'bg-amber-100 text-amber-700',
  Penalty: 'bg-red-100 text-red-700',
};

export default function PartnerTransactionsPage() {
  const { partnerId } = useCurrentRole();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    if (!partnerId) return;
    setLoading(true);
    getPartnerTransactions({
      partnerId,
      search: search.trim() || undefined,
      type: typeFilter !== 'all' ? typeFilter : undefined,
    })
      .then(res => setTransactions(res.transactions))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [partnerId, search, typeFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Transactions</h1>
        <p className="text-sm text-muted-foreground mt-1">Transactions for your entities</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search transactions..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Disbursement">Disbursement</SelectItem>
            <SelectItem value="Repayment">Repayment</SelectItem>
            <SelectItem value="Fee">Fee</SelectItem>
            <SelectItem value="Penalty">Penalty</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
      ) : transactions.length === 0 ? (
        <Card><CardContent className="p-12 text-center">
          <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">No transactions found</p>
          <p className="text-sm text-muted-foreground mt-1">Transactions for your entities will appear here.</p>
        </CardContent></Card>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Reference</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Entity</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Channel</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium font-mono text-xs">{t.referenceNumber}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.entityName}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(t.amount)}</td>
                  <td className="px-4 py-3">
                    <Badge className={typeColor[t.type] || ''} variant="secondary">{t.type}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{t.channel || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.createdAt ? format(new Date(t.createdAt), 'dd MMM yyyy') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
