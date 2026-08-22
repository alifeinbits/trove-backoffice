import { useEffect, useState } from 'react';
import { Card, CardContent } from '@project/components/ui/card';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { useCurrentRole } from '../components/RoleContext';
import { getPartnerOverview } from 'zitejs/api';
import { format } from 'date-fns';

export default function PartnerActivityPage() {
  const { partnerId } = useCurrentRole();
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!partnerId) return;
    setLoading(true);
    getPartnerOverview({ partnerId })
      .then((r) => setActivity(r.recentActivity || []))
      .finally(() => setLoading(false));
  }, [partnerId]);

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API Activity</h1>
        <p className="text-sm text-muted-foreground mt-1">Recent API calls made with your keys</p>
      </div>

      {activity.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">No API activity yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Method</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Endpoint</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Summary</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {activity.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-[10px] font-mono">{a.method}</Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{a.endpoint}</td>
                    <td className="px-4 py-3">
                      <Badge variant={a.statusCode < 300 ? 'default' : 'destructive'} className="text-[10px]">
                        {a.statusCode}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{a.requestSummary}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {a.createdAt ? format(new Date(a.createdAt), 'MMM d, h:mm a') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
