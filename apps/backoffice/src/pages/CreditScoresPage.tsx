import { useState, useEffect, useMemo } from 'react';
import { getCreditScores, computeCreditScores } from 'zitejs/api';
import { Badge } from '@project/components/ui/badge';
import { Button } from '@project/components/ui/button';
import { Card, CardContent } from '@project/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Skeleton } from '@project/components/ui/skeleton';
import { RefreshCw, Filter, BarChart3, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';

type CreditScore = {
  id: string; entityName: string; entityId: string; entityType: string;
  score: number; rating: string;
  paymentTimelinessScore: number; tradeVolumeScore: number; defaultRateScore: number;
  entityAgeScore: number; productDiversityScore: number;
  onTimePercent: number; totalTradeVolume: number; defaultRate: number;
  aiSummary: string | null; computedAt: string | null;
};

function ratingColor(rating: string) {
  switch (rating) {
    case 'A+': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'A': return 'bg-green-100 text-green-800 border-green-200';
    case 'B': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'C': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'D': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-muted text-muted-foreground';
  }
}

function ScoreBar({ label, value, max = 20 }: { label: string; value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value.toFixed(1)}/{max}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DetailDialog({ score, open, onClose }: { score: CreditScore | null; open: boolean; onClose: () => void }) {
  if (!score) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {score.entityName}
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${ratingColor(score.rating)}`}>
              {score.rating}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Overall Score</span>
            <span className="text-3xl font-bold">{score.score}<span className="text-sm text-muted-foreground">/100</span></span>
          </div>
          <div className="space-y-3">
            <ScoreBar label="Payment Timeliness" value={score.paymentTimelinessScore} />
            <ScoreBar label="Trade Volume" value={score.tradeVolumeScore} />
            <ScoreBar label="Default Rate" value={score.defaultRateScore} />
            <ScoreBar label="Entity Age" value={score.entityAgeScore} />
            <ScoreBar label="Product Diversity" value={score.productDiversityScore} />
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2 border-t">
            <div className="text-center">
              <div className="text-lg font-semibold">{(score.onTimePercent * 100).toFixed(0)}%</div>
              <div className="text-xs text-muted-foreground">On-Time</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">KES {(score.totalTradeVolume / 1000000).toFixed(1)}M</div>
              <div className="text-xs text-muted-foreground">Trade Vol</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">{(score.defaultRate * 100).toFixed(0)}%</div>
              <div className="text-xs text-muted-foreground">Default Rate</div>
            </div>
          </div>
          {score.computedAt && (
            <p className="text-xs text-muted-foreground">Last computed: {new Date(score.computedAt).toLocaleString()}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CreditScoresPage() {
  const [scores, setScores] = useState<CreditScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [ratingFilter, setRatingFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [selectedScore, setSelectedScore] = useState<CreditScore | null>(null);

  const loadScores = async () => {
    setLoading(true);
    try {
      const data = await getCreditScores({
        rating: ratingFilter || undefined,
        entityType: typeFilter || undefined,
        sortDir,
      });
      setScores(data.scores);
    } catch { toast.error('Failed to load credit scores'); }
    setLoading(false);
  };

  useEffect(() => { loadScores(); }, [ratingFilter, typeFilter, sortDir]);

  const handleRecompute = async () => {
    setComputing(true);
    try {
      const result = await computeCreditScores({});
      toast.success(`Recomputed ${result.computed} credit scores`);
      loadScores();
    } catch { toast.error('Failed to recompute'); }
    setComputing(false);
  };

  const showFilters = ratingFilter || typeFilter;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Credit Scores
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Entity risk profiles computed from ledger and transaction data</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={ratingFilter} onValueChange={v => setRatingFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-32">
              <Filter className="w-3 h-3 mr-1" />
              <SelectValue placeholder="Rating" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ratings</SelectItem>
              {['A+', 'A', 'B', 'C', 'D'].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={v => setTypeFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Entity Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {['Supplier', 'Dealer', 'Anchor Buyer'].map(t => {
                const label = t === 'Dealer' ? 'Seller' : t === 'Anchor Buyer' ? 'Buyer' : t;
                return <SelectItem key={t} value={t}>{label}</SelectItem>;
              })}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}>
            <ArrowUpDown className="w-3.5 h-3.5 mr-1" />
            {sortDir === 'desc' ? 'High→Low' : 'Low→High'}
          </Button>
          <Button onClick={handleRecompute} disabled={computing} size="sm">
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${computing ? 'animate-spin' : ''}`} />
            {computing ? 'Computing...' : 'Recompute All'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      ) : scores.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          No credit scores found. Click "Recompute All" to generate scores.
        </CardContent></Card>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium">Entity</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-center px-4 py-3 font-medium">Score</th>
                <th className="text-center px-4 py-3 font-medium">Rating</th>
                <th className="text-center px-4 py-3 font-medium">On-Time %</th>
                <th className="text-right px-4 py-3 font-medium">Trade Vol</th>
                <th className="text-center px-4 py-3 font-medium">Default Rate</th>
                <th className="text-right px-4 py-3 font-medium">Last Computed</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {scores.map(s => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{s.entityName}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">{s.entityType}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-bold text-base">{s.score}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center justify-center w-8 h-6 rounded text-xs font-bold border ${ratingColor(s.rating)}`}>
                      {s.rating}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">{(s.onTimePercent * 100).toFixed(0)}%</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">KES {(s.totalTradeVolume / 1000000).toFixed(1)}M</td>
                  <td className="px-4 py-3 text-center">{(s.defaultRate * 100).toFixed(0)}%</td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                    {s.computedAt ? new Date(s.computedAt).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="outline" size="sm" onClick={() => setSelectedScore(s)}>Details</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DetailDialog score={selectedScore} open={!!selectedScore} onClose={() => setSelectedScore(null)} />
    </div>
  );
}
