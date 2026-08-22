import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { Badge } from '@project/components/ui/badge';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import { useCurrentRole } from '../components/RoleContext';
import { getPartnerDetail, generateApiKey, revokeApiKey } from 'zitejs/api';
import { Key, Copy, Trash2, Plus, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@project/components/ui/alert-dialog';

export default function PartnerApiKeysPage() {
  const { partnerId } = useCurrentRole();
  const [partner, setPartner] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const fetchPartner = () => {
    if (!partnerId) return;
    setLoading(true);
    getPartnerDetail({ id: partnerId }).then(setPartner).finally(() => setLoading(false));
  };

  useEffect(() => { fetchPartner(); }, [partnerId]);

  const handleGenerateKey = async (environment: 'Sandbox' | 'Production') => {
    if (!partnerId) return;
    setGenerating(true);
    try {
      const result = await generateApiKey({ partnerId, environment, label: `${environment} key` });
      setGeneratedKey(result.fullKey);
      setShowKey(true);
      toast.success(`${environment} API key generated`);
      fetchPartner();
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate key');
    } finally {
      setGenerating(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    try {
      await revokeApiKey({ keyId });
      toast.success('API key revoked');
      fetchPartner();
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke key');
    }
  };

  const copyKey = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      toast.success('Copied to clipboard');
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const keys = partner?.apiKeys || [];

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your sandbox and production API keys</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => handleGenerateKey('Sandbox')} disabled={generating} size="sm" variant="outline">
            <Plus className="w-4 h-4 mr-1" /> Sandbox Key
          </Button>
          {partner?.productionEnabled && (
            <Button onClick={() => handleGenerateKey('Production')} disabled={generating} size="sm">
              <Plus className="w-4 h-4 mr-1" /> Production Key
            </Button>
          )}
        </div>
      </div>

      {/* Display generated key */}
      {generatedKey && (
        <Card className="border-primary">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Key className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-primary">New API Key Generated</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Copy this key now — it won't be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded text-xs font-mono break-all">
                {showKey ? generatedKey : '•'.repeat(40)}
              </code>
              <Button size="icon" variant="ghost" onClick={() => setShowKey(!showKey)}>
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={copyKey}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Active Keys ({keys.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {keys.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 pb-6">No API keys. Generate one to get started.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">Key Prefix</th>
                  <th className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">Environment</th>
                  <th className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                  <th className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">Last Used</th>
                  <th className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">Created</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {keys.map((k: any) => (
                  <tr key={k.id}>
                    <td className="px-4 py-3 font-mono text-xs">{k.keyPrefix}••••••</td>
                    <td className="px-4 py-3">
                      <Badge variant={k.environment === 'Production' ? 'default' : 'secondary'} className="text-[10px]">
                        {k.environment}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={k.status === 'Active' ? 'default' : 'destructive'} className="text-[10px]">
                        {k.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {k.lastUsedAt ? format(new Date(k.lastUsedAt), 'MMM d, h:mm a') : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {k.createdAt ? format(new Date(k.createdAt), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {k.status === 'Active' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Revoke this key?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Any integration using this key will immediately stop working. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleRevokeKey(k.id)}>Revoke</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
