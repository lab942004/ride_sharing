import { useState, useEffect } from 'react';
import api from '@/lib/api';
import DataTable from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { RefreshCw, UserX, UserCheck, Key, Plus, X, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const selectClass = 'flex h-10 w-full rounded-lg border border-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function Admins() {
  const { admin } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTarget, setResetTarget] = useState(null); // { id, name }
  const [resetPw, setResetPw] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetting, setResetting] = useState(false);
  const [domains, setDomains] = useState([]);
  const [domainsLoading, setDomainsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'ADMIN', domain: '' });

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await api.getAdmins({ page, limit: 10 });
      setAdmins(res.data.admins);
      setPagination(res.data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAdmins(); }, [page]);

  const openAddModal = async () => {
    setForm({ name: '', email: '', password: '', phone: '', role: 'ADMIN', domain: '' });
    setShowAddModal(true);
    setDomainsLoading(true);
    try {
      const res = await api.getDomains();
      setDomains(res.data.domains || []);
    } catch (err) { console.error('Failed to fetch domains:', err); }
    finally { setDomainsLoading(false); }
  };

  const handleAction = async (id, actionFn) => {
    try { await actionFn(id); fetchAdmins(); }
    catch (err) { alert(err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this admin? This cannot be undone.')) return;
    try { await api.deleteAdmin(id); fetchAdmins(); }
    catch (err) { alert(err.message); }
  };

  const openResetModal = (row) => {
    setResetTarget({ id: row.id, name: row.name });
    setResetPw('');
    setResetConfirm('');
    setShowResetModal(true);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (resetPw !== resetConfirm) { alert('Passwords do not match'); return; }
    if (resetPw.length < 6) { alert('Password must be at least 6 characters'); return; }
    setResetting(true);
    try {
      await api.resetAdminPassword(resetTarget.id, resetPw);
      setShowResetModal(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setResetting(false);
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createAdmin(form);
      setShowAddModal(false);
      fetchAdmins();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (admin?.role !== 'SUPER_ADMIN') {
    return <p className="text-muted-foreground">Access denied. Super Admin only.</p>;
  }

  const columns = [
    { key: 'name', label: 'Name', render: (row) => (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
          {row.name?.charAt(0)}
        </div>
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.email}</p>
        </div>
      </div>
    )},
    { key: 'role', label: 'Role', render: (row) => (
      <Badge className={row.role === 'SUPER_ADMIN' ? 'bg-purple-500/10 text-purple-500' : ''}>{row.role}</Badge>
    )},
    { key: 'domain', label: 'Domain', render: (row) => row.domain || '—' },
    { key: 'status', label: 'Status', render: (row) => (
      row.status === 'ACTIVE' ? <Badge>Active</Badge> : <Badge variant="destructive">Suspended</Badge>
    )},
    { key: 'createdAt', label: 'Created', render: (row) => new Date(row.createdAt).toLocaleDateString() },
    { key: 'actions', label: 'Actions', render: (row) => {
      const isSelf = row.id === admin?.id;
      return (
        <div className="flex gap-1">
          {!isSelf && row.status === 'ACTIVE' && (
            <Button size="sm" variant="ghost" title="Suspend" onClick={() => handleAction(row.id, (id) => api.suspendAdmin(id))}>
              <UserX className="w-4 h-4 text-amber-500" />
            </Button>
          )}
          {!isSelf && row.status === 'SUSPENDED' && (
            <Button size="sm" variant="ghost" title="Activate" onClick={() => handleAction(row.id, (id) => api.activateAdmin(id))}>
              <UserCheck className="w-4 h-4 text-emerald-500" />
            </Button>
          )}
          <Button size="sm" variant="ghost" title="Reset Password" onClick={() => openResetModal(row)}>
            <Key className="w-4 h-4 text-muted-foreground" />
          </Button>
          {!isSelf && (
            <Button size="sm" variant="ghost" title="Delete" onClick={() => handleDelete(row.id)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          )}
        </div>
      );
    }},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Management</h1>
          <p className="text-muted-foreground mt-1">Manage platform administrators</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openAddModal} size="sm"><Plus className="w-4 h-4 mr-2" /> Add Admin</Button>
          <Button onClick={fetchAdmins} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
        </div>
      </div>
      <Card className="glass border-border/50"><CardContent className="p-6">
        <DataTable columns={columns} data={admins} loading={loading} pagination={pagination} onPageChange={setPage} />
      </CardContent></Card>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-semibold">Add New Admin</h2>
              <Button size="sm" variant="ghost" onClick={() => setShowAddModal(false)}><X className="w-5 h-5" /></Button>
            </div>
            <form onSubmit={handleCreateAdmin} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <Input name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <Input name="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="admin@example.com" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password *</label>
                <Input name="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <Input name="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Optional" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select name="role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={selectClass}>
                  <option value="ADMIN">Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Domain</label>
                <select name="domain" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} className={selectClass}>
                  <option value="">{domainsLoading ? 'Loading domains...' : 'No domain (global)'}</option>
                  {domains.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create Admin'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-semibold">Reset Password</h2>
              <Button size="sm" variant="ghost" onClick={() => setShowResetModal(false)}><X className="w-5 h-5" /></Button>
            </div>
            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">Setting new password for <span className="font-medium text-foreground">{resetTarget?.name}</span></p>
              <div>
                <label className="block text-sm font-medium mb-1">New Password *</label>
                <Input type="password" value={resetPw} onChange={(e) => setResetPw(e.target.value)} placeholder="Min 6 characters" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Confirm Password *</label>
                <Input type="password" value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)} placeholder="Repeat new password" required />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowResetModal(false)}>Cancel</Button>
                <Button type="submit" disabled={resetting}>{resetting ? 'Resetting...' : 'Reset Password'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
