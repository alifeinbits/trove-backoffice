import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { Badge } from '@project/components/ui/badge';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import { Users, FileText, Landmark, Receipt, Key, Activity, Plus } from 'lucide-react';
import { useCurrentRole } from '../components/RoleContext';
import { getPartnerOverview, GetPartnerOverviewOutputType } from 'zitejs/api';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import CreateProgramDialog from '../components/CreateProgramDialog';

type OverviewData = GetPartnerOverviewOutputType;

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatCurrency(v: number) {
  return `KES ${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function PartnerDashboardPage() {
  const { partnerId, partnerName } = useCurrentRole();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  const load = () => {
    if (!partnerId) return;
    setLoading(true);
    getPartnerOverview({ partnerId }).then(setData).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [partnerId]);

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Partner Portal</p>
          <h1 className="text-[24px] font-bold tracking-[-0.02em]">Welcome back, {partnerName}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data.partner?.partnerType} ·{' '}
            <Badge variant={data.partner?.status === 'Active' ? 'default' : 'secondary'} className="text-[10px]">
              {data.partner?.status}
            </Badge>
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" /> Create Program</Button>
      </div>

      <CreateProgramDialog open={showCreate} onOpenChange={setShowCreate} partnerId={partnerId ?? undefined} onCreated={load} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Entities" value={data.entityCount} />
        <StatCard icon={FileText} label="Invoices" value={data.invoiceCount} />
        <StatCard icon={Landmark} label="Loans" value={data.loanCount} sub={`${formatCurrency(data.totalOutstanding)} outstanding`} />
        <StatCard icon={Key} label="Active API Keys" value={data.apiKeyCount} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Entities */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              Recent Entities
              <button onClick={() => navigate('/partner/entities')} className="text-xs text-primary font-medium hover:underline">
                View all
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentEntities.length === 0 ? (
              <p className="text-sm text-muted-foreground px-6 pb-6">No entities yet. Create one via the API.</p>
            ) : (
              <div className="divide-y">
                {data.recentEntities.map((e: any) => (
                  <button
                    key={e.id}
                    onClick={() => navigate(`/entities/${e.id}`)}
                    className="w-full flex items-center justify-between px-6 py-3 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{e.name}</p>
                      <p className="text-xs text-muted-foreground">{e.entityType}</p>
                    </div>
                    <Badge variant={e.kycStatus === 'Approved' ? 'default' : 'secondary'} className="text-[10px]">
                      {e.kycStatus}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent API Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              Recent API Activity
              <button onClick={() => navigate('/partner/activity')} className="text-xs text-primary font-medium hover:underline">
                View all
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground px-6 pb-6">No API calls yet.</p>
            ) : (
              <div className="divide-y">
                {data.recentActivity.map((a: any) => (
                  <div key={a.id} className="px-6 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-mono">{a.method}</Badge>
                        <span className="text-xs font-mono text-muted-foreground">{a.endpoint}</span>
                      </div>
                      <Badge variant={a.statusCode < 300 ? 'default' : 'destructive'} className="text-[10px]">
                        {a.statusCode}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{a.requestSummary}</p>
                    {a.createdAt && (
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {format(new Date(a.createdAt), 'MMM d, h:mm a')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Enabled Products */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Enabled Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(data.partner?.enabledProducts || []).map((p: string) => (
              <Badge key={p} variant="outline">{p}</Badge>
            ))}
            {(!data.partner?.enabledProducts || data.partner.enabledProducts.length === 0) && (
              <p className="text-sm text-muted-foreground">No products enabled yet.</p>
            )}
          </div>
          <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
            <span>Sandbox: {data.partner?.sandboxEnabled ? '✅ Enabled' : '❌ Disabled'}</span>
            <span>Production: {data.partner?.productionEnabled ? '✅ Enabled' : '❌ Disabled'}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
