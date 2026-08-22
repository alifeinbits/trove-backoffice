import { useState, useEffect } from 'react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { toast } from 'sonner';
import { getBackofficeUsers, updateBackofficeUserRole, getSystemSettings, updateSystemSetting, getPartnersList, GetBackofficeUsersOutputType } from 'zitejs/api';
import { Search, Plus } from 'lucide-react';

type BackofficeUser = GetBackofficeUsersOutputType['users'][0];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'team' | 'defaults' | 'fi'>('team');

  return (
    <div className="p-8">
      <h1 className="text-xl font-bold text-foreground mb-6">Settings</h1>
      <div className="flex gap-4 mb-6 border-b border-border">
        {[
          { key: 'team' as const, label: 'Team & Roles' },
          { key: 'defaults' as const, label: 'System Defaults' },
          { key: 'fi' as const, label: 'FI Configuration' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'text-primary border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'team' && <TeamTab />}
      {activeTab === 'defaults' && <SystemDefaultsTab />}
      {activeTab === 'fi' && <FIConfigTab />}
    </div>
  );
}

function TeamTab() {
  const [users, setUsers] = useState<BackofficeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editUser, setEditUser] = useState<BackofficeUser | null>(null);
  const [newRole, setNewRole] = useState('');
  const [newPartnerId, setNewPartnerId] = useState('');
  const [partners, setPartners] = useState<any[]>([]);

  useEffect(() => {
    getBackofficeUsers({})
      .then((r) => setUsers(r.users))
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false));
    getPartnersList({}).then((r) => setPartners(r.partners || [])).catch(() => {});
  }, []);

  const filtered = users.filter((u) =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSaveRole = async () => {
    if (!editUser || !newRole) return;
    if (newRole === 'Partner Admin' && !newPartnerId) {
      toast.error('Please select a partner');
      return;
    }
    try {
      await updateBackofficeUserRole({
        id: editUser.id,
        role: newRole,
        partnerId: newRole === 'Partner Admin' ? newPartnerId : undefined,
      });
      setUsers((prev) => prev.map((u) => (u.id === editUser.id ? { ...u, role: newRole } : u)));
      toast.success('Role updated');
      setEditUser(null);
    } catch {
      toast.error('Failed to update role');
    }
  };

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      'Super Admin': 'bg-primary/10 text-primary',
      'Maker': 'bg-accent text-accent-foreground',
      'Checker': 'bg-blue-50 text-blue-700',
      'FI Admin': 'bg-amber-50 text-amber-700',
      'Master Anchor Admin': 'bg-purple-50 text-purple-700',
      'Partner Admin': 'bg-emerald-50 text-emerald-700',
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[role] || 'bg-muted text-muted-foreground'}`}>{role === 'Master Anchor Admin' ? 'Program Owner Admin' : role}</span>;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-56" />
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-left bg-muted/30">
              <th className="py-2.5 px-4 font-medium">Name</th>
              <th className="py-2.5 px-4 font-medium">Email</th>
              <th className="py-2.5 px-4 font-medium">Role</th>
              <th className="py-2.5 px-4 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="py-12 text-center text-muted-foreground">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="py-12 text-center text-muted-foreground">No users found</td></tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="py-3 px-4 font-medium text-foreground">{u.name || '—'}</td>
                  <td className="py-3 px-4 text-muted-foreground">{u.email || '—'}</td>
                  <td className="py-3 px-4">{roleBadge(u.role || '')}</td>
                  <td className="py-3 px-4">
                    {u.role !== 'Super Admin' ? (
                      <Button variant="ghost" size="sm" onClick={() => { setEditUser(u); setNewRole(u.role || ''); setNewPartnerId(''); }}>
                        Edit Role
                      </Button>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Edit Role — {editUser?.name}</DialogTitle></DialogHeader>
          <div className="py-2">
            <Label>Role</Label>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Maker">Maker</SelectItem>
                <SelectItem value="Checker">Checker</SelectItem>
                <SelectItem value="FI Admin">FI Admin</SelectItem>
                <SelectItem value="Master Anchor Admin">Program Owner Admin</SelectItem>
                <SelectItem value="Partner Admin">Partner Admin</SelectItem>
              </SelectContent>
            </Select>
            {newRole === 'Partner Admin' && (
              <div className="mt-3">
                <Label>Linked Partner</Label>
                <Select value={newPartnerId} onValueChange={setNewPartnerId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select partner..." /></SelectTrigger>
                  <SelectContent>
                    {partners.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.partnerName} ({p.partnerType})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">This user will only see data belonging to this partner.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleSaveRole}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SystemDefaultsTab() {
  const [settings, setSettings] = useState<{ key: string; value: string; description: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSystemSettings({})
      .then((r) => setSettings(r.settings))
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleUpdate = async (key: string, value: string) => {
    try {
      await updateSystemSetting({ key, value });
      setSettings((prev) => prev.map((s) => (s.key === key ? { ...s, value } : s)));
      toast.success('Setting updated');
    } catch {
      toast.error('Failed to update');
    }
  };

  if (loading) return <div className="text-muted-foreground py-8 text-center">Loading...</div>;

  return (
    <div className="max-w-2xl">
      {settings.length === 0 ? (
        <p className="text-muted-foreground text-sm">No system settings configured.</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-left bg-muted/30">
                <th className="py-2.5 px-4 font-medium">Setting</th>
                <th className="py-2.5 px-4 font-medium">Value</th>
                <th className="py-2.5 px-4 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {settings.map((s) => (
                <tr key={s.key} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="py-3 px-4 font-medium text-foreground font-mono text-xs">{s.key}</td>
                  <td className="py-3 px-4">
                    <Input
                      defaultValue={s.value}
                      className="h-8 w-36 text-xs"
                      onBlur={(e) => {
                        if (e.target.value !== s.value) handleUpdate(s.key, e.target.value);
                      }}
                    />
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">{s.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FIConfigTab() {
  return (
    <div className="max-w-lg">
      <div className="border border-border rounded-lg p-6 bg-card text-center">
        <p className="text-muted-foreground text-sm">
          FI bank account details and M-Pesa shortcodes are configured per program.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Go to Programs → select a program → FI Pricing to manage bank details and shortcodes.
        </p>
      </div>
    </div>
  );
}
