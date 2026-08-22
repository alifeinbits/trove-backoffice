import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPartnerDetail, updatePartner, generateApiKey, revokeApiKey } from 'zitejs/api';
import type { GetPartnerDetailOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Switch } from '@project/components/ui/switch';
import { Skeleton } from '@project/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@project/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import { toast } from 'sonner';
import { ArrowLeft, Copy, Key, Shield, Activity, Package, Loader2, Check, X, Globe, Building2, Cpu, Landmark, Eye, EyeOff } from 'lucide-react';

type PartnerData = GetPartnerDetailOutputType;

const PRODUCTS = [
  'Invoice Finance', 'Reverse Factoring', 'Invoice Discounting',
  'Blended Finance', 'Leasing', 'Warehouse Receipt',
];

const statusColors: Record<string, string> = {
  'Pending Approval': 'bg-amber-100 text-amber-800',
  Active: 'bg-emerald-100 text-emerald-800',
  Suspended: 'bg-orange-100 text-orange-800',
  Revoked: 'bg-red-100 text-red-800',
};

const envColors: Record<string, string> = {
  Sandbox: 'bg-amber-100 text-amber-800',
  Production: 'bg-emerald-100 text-emerald-800',
};

const methodColors: Record<string, string> = {
  GET: 'text-blue-600',
  POST: 'text-green-600',
  PUT: 'text-orange-600',
  DELETE: 'text-red-600',
};

function GenerateKeyDialog({ open, onClose, partnerId, productionEnabled, onGenerated }: {
  open: boolean; onClose: () => void; partnerId: string; productionEnabled: boolean; onGenerated: () => void;
}) {
  const [env, setEnv] = useState<'Sandbox' | 'Production'>('Sandbox');
  const [label, setLabel] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await generateApiKey({ partnerId, environment: env, label: label || undefined });
      setGeneratedKey(res.fullKey);
      onGenerated();
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate key');
    } finally {
      setGenerating(false);
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setGeneratedKey('');
    setLabel('');
    setEnv('Sandbox');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{generatedKey ? 'API Key Generated' : 'Generate API Key'}</DialogTitle>
        </DialogHeader>
        {generatedKey ? (
          <div className="space-y-4 py-2">
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
              <p className="text-sm font-medium text-destructive mb-1">⚠ Copy this key now</p>
              <p className="text-xs text-muted-foreground">This is the only time the full key will be shown. Store it securely.</p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted rounded-lg px-3 py-2 text-xs font-mono break-all">{generatedKey}</code>
              <Button variant="outline" size="sm" onClick={copyKey}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div>
              <Label>Environment</Label>
              <Select value={env} onValueChange={(v) => setEnv(v as 'Sandbox' | 'Production')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sandbox">Sandbox (sk_test_...)</SelectItem>
                  {productionEnabled && <SelectItem value="Production">Production (sk_live_...)</SelectItem>}
                </SelectContent>
              </Select>
              {!productionEnabled && (
                <p className="text-xs text-muted-foreground mt-1">Production access must be enabled first</p>
              )}
            </div>
            <div>
              <Label>Label (optional)</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Production Server 1" />
            </div>
          </div>
        )}
        <DialogFooter>
          {generatedKey ? (
            <Button onClick={handleClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Generating…</> : 'Generate Key'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OverviewTab({ data, onRefresh }: { data: PartnerData; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(data.partner);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePartner({
        id: data.partner.id,
        partnerName: form.partnerName,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        companyRegistration: form.companyRegistration,
        country: form.country,
        website: form.website,
        notes: form.notes,
      });
      toast.success('Partner updated');
      setEditing(false);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updatePartner({ id: data.partner.id, status: newStatus });
      toast.success(`Partner ${newStatus.toLowerCase()}`);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    }
  };

  const p = data.partner;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Partner Information</h3>
        <div className="flex gap-2">
          {p.status === 'Pending Approval' && (
            <Button size="sm" onClick={() => handleStatusChange('Active')}>
              <Check className="w-4 h-4 mr-1" />Approve
            </Button>
          )}
          {p.status === 'Active' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="text-orange-600">Suspend</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Suspend partner?</AlertDialogTitle>
                  <AlertDialogDescription>This will revoke all active API keys. The partner will not be able to make any API calls.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleStatusChange('Suspended')}>Suspend</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {p.status === 'Suspended' && (
            <Button size="sm" onClick={() => handleStatusChange('Active')}>Reactivate</Button>
          )}
          {!editing ? (
            <Button size="sm" variant="outline" onClick={() => { setForm(p); setEditing(true); }}>Edit</Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
        {editing ? (
          <>
            <div><Label>Partner Name</Label><Input value={form.partnerName} onChange={(e) => setForm({ ...form, partnerName: e.target.value })} /></div>
            <div><Label>Contact Name</Label><Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></div>
            <div><Label>Contact Email</Label><Input value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></div>
            <div><Label>Contact Phone</Label><Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></div>
            <div><Label>Company Registration</Label><Input value={form.companyRegistration} onChange={(e) => setForm({ ...form, companyRegistration: e.target.value })} /></div>
            <div><Label>Country</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
            <div className="col-span-2"><Label>Website</Label><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
            <div className="col-span-2"><Label>Notes</Label><textarea className="w-full border border-border rounded-lg p-2 text-sm bg-background" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </>
        ) : (
          <>
            <InfoRow label="Partner Name" value={p.partnerName} />
            <InfoRow label="Type" value={p.partnerType} />
            <InfoRow label="Contact Name" value={p.contactName} />
            <InfoRow label="Contact Email" value={p.contactEmail} />
            <InfoRow label="Contact Phone" value={p.contactPhone || '—'} />
            <InfoRow label="Company Registration" value={p.companyRegistration || '—'} />
            <InfoRow label="Country" value={p.country || '—'} />
            <InfoRow label="Website" value={p.website ? <a href={p.website} target="_blank" rel="noreferrer" className="text-primary underline">{p.website}</a> : '—'} />
            <InfoRow label="Created" value={p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'} />
            <InfoRow label="Last Updated" value={p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : '—'} />
            {p.notes && <div className="col-span-2"><Label className="text-muted-foreground text-xs">Notes</Label><p className="text-sm mt-0.5">{p.notes}</p></div>}
          </>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value}</p>
    </div>
  );
}

function ProductsTab({ data, onRefresh }: { data: PartnerData; onRefresh: () => void }) {
  const [saving, setSaving] = useState(false);
  const enabled = data.partner.enabledProducts as string[] || [];

  const toggle = async (product: string) => {
    const current = [...enabled];
    const idx = current.indexOf(product);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(product);
    setSaving(true);
    try {
      await updatePartner({ id: data.partner.id, enabledProducts: current });
      toast.success('Products updated');
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleProd = async (val: boolean) => {
    setSaving(true);
    try {
      await updatePartner({ id: data.partner.id, productionEnabled: val });
      toast.success(val ? 'Production access enabled' : 'Production access disabled');
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Environment Access</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Control sandbox and production access</p>
          </div>
        </div>
        <div className="flex items-center justify-between py-2 border-t border-border">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-amber-100 text-amber-800">Sandbox</Badge>
            <span className="text-sm">Always enabled for active partners</span>
          </div>
          <Switch checked={true} disabled />
        </div>
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">Production</Badge>
            <span className="text-sm">Enable production API access</span>
          </div>
          <Switch checked={data.partner.productionEnabled} onCheckedChange={toggleProd} disabled={saving} />
        </div>
      </div>

      <div className="border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-1">Enabled Products</h3>
        <p className="text-xs text-muted-foreground mb-4">Select which products this partner can use via the API</p>
        <div className="grid grid-cols-2 gap-3">
          {PRODUCTS.map((product) => (
            <button
              key={product}
              onClick={() => toggle(product)}
              disabled={saving}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                enabled.includes(product)
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30'
              }`}
            >
              <span className="text-sm font-medium">{product}</span>
              {enabled.includes(product) ? (
                <Check className="w-4 h-4 text-primary" />
              ) : (
                <div className="w-4 h-4 rounded border border-border" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function KeysTab({ data, onRefresh }: { data: PartnerData; onRefresh: () => void }) {
  const [genOpen, setGenOpen] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const handleRevoke = async (keyId: string) => {
    setRevoking(keyId);
    try {
      await revokeApiKey({ keyId });
      toast.success('Key revoked');
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    } finally {
      setRevoking(null);
    }
  };

  const sandboxKeys = data.keys.filter((k) => k.environment === 'Sandbox');
  const prodKeys = data.keys.filter((k) => k.environment === 'Production');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">API Keys</h3>
        <Button size="sm" onClick={() => setGenOpen(true)} disabled={data.partner.status !== 'Active'}>
          <Key className="w-4 h-4 mr-1.5" />Generate Key
        </Button>
      </div>

      {data.keys.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-8 text-center">
          <Key className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No API keys generated yet</p>
        </div>
      ) : (
        <>
          {[{ label: 'Sandbox Keys', keys: sandboxKeys }, { label: 'Production Keys', keys: prodKeys }]
            .filter((g) => g.keys.length > 0)
            .map((group) => (
              <div key={group.label}>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">{group.label}</h4>
                <div className="space-y-2">
                  {group.keys.map((k) => (
                    <div key={k.id} className="flex items-center justify-between border border-border rounded-lg px-4 py-3">
                      <div className="flex items-center gap-3">
                        <code className="text-xs font-mono bg-muted px-2 py-1 rounded">{k.keyPrefix}…{k.keyHint}</code>
                        <span className="text-sm text-muted-foreground">{k.label}</span>
                        <Badge variant="secondary" className={k.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>
                          {k.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        {k.lastUsedAt && (
                          <span className="text-xs text-muted-foreground">Last used {new Date(k.lastUsedAt).toLocaleDateString()}</span>
                        )}
                        {k.status === 'Active' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                {revoking === k.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Revoke'}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Revoke this API key?</AlertDialogTitle>
                                <AlertDialogDescription>The partner will no longer be able to authenticate with this key. This cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleRevoke(k.id)}>Revoke Key</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </>
      )}

      <GenerateKeyDialog
        open={genOpen}
        onClose={() => setGenOpen(false)}
        partnerId={data.partner.id}
        productionEnabled={data.partner.productionEnabled}
        onGenerated={onRefresh}
      />
    </div>
  );
}

function ActivityTab({ data }: { data: PartnerData }) {
  if (data.recentActivity.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-xl p-8 text-center">
        <Activity className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No API activity yet</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Timestamp</th>
            <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Method</th>
            <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Endpoint</th>
            <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
            <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Environment</th>
          </tr>
        </thead>
        <tbody>
          {data.recentActivity.map((a) => (
            <tr key={a.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2.5 text-sm text-muted-foreground">{a.createdAt ? new Date(a.createdAt).toLocaleString() : '—'}</td>
              <td className="px-4 py-2.5"><span className={`text-xs font-mono font-semibold ${methodColors[a.method] || ''}`}>{a.method}</span></td>
              <td className="px-4 py-2.5 text-sm font-mono">{a.endpoint}</td>
              <td className="px-4 py-2.5">
                <Badge variant="secondary" className={a.statusCode >= 200 && a.statusCode < 300 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>
                  {a.statusCode}
                </Badge>
              </td>
              <td className="px-4 py-2.5"><Badge variant="secondary" className={envColors[a.environment] || ''}>{a.environment}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<PartnerData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await getPartnerDetail({ id });
      setData(res);
    } catch {
      toast.error('Partner not found');
      navigate('/partners');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const p = data.partner;
  const TypeIcon = p.partnerType === 'FI' ? Landmark : p.partnerType === 'Master Anchor' ? Building2 : Cpu;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/partners')}>
          <ArrowLeft className="w-4 h-4 mr-1" />Back
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
            <TypeIcon className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{p.partnerName}</h1>
              <Badge variant="secondary" className={statusColors[p.status] || ''}>{p.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{p.partnerType} · {p.contactEmail}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Entities Onboarded</p>
            <p className="text-xl font-bold">{data.entityCount}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Active Keys</p>
            <p className="text-xl font-bold">{data.keys.filter((k) => k.status === 'Active').length}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="keys">API Keys ({data.keys.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity ({data.recentActivity.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <OverviewTab data={data} onRefresh={fetchData} />
        </TabsContent>
        <TabsContent value="products" className="mt-4">
          <ProductsTab data={data} onRefresh={fetchData} />
        </TabsContent>
        <TabsContent value="keys" className="mt-4">
          <KeysTab data={data} onRefresh={fetchData} />
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <ActivityTab data={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
