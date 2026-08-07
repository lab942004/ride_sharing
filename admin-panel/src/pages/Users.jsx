import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import DataTable from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { RefreshCw, UserCheck, UserX, Ban, Shield, Key, Plus, X } from 'lucide-react';

const statusBadge = (user) => {
  if (user.isBanned) return <Badge variant="destructive">Banned</Badge>;
  if (user.isSuspended) return <Badge variant="secondary">Suspended</Badge>;
  if (user.isVerified) return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Active</Badge>;
  return <Badge variant="outline">Unverified</Badge>;
};

export default function Users() {
  const { admin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const isSuperAdmin = admin?.role === 'SUPER_ADMIN';
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [domains, setDomains] = useState([]);
  const [form, setForm] = useState({ name: '', rollNo: '', email: '', password: '', phone: '', domain: '' });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (search) params.search = search;
      const res = await api.getUsers(params);
      setUsers(res.data.users);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, search]);

  const openAddModal = async () => {
    try {
      const res = await api.getDomains();
      setDomains(res.data.domains || []);
    } catch (e) { /* ignore */ }
    setForm({ name: '', rollNo: '', email: '', password: '', phone: '', domain: '' });
    setShowAddModal(true);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!form.name || !form.rollNo || !form.email || !form.password || !form.domain) {
      alert('Name, roll number, email, password, and domain are required');
      return;
    }
    setSubmitting(true);
    try {
      await api.createUser(form);
      setShowAddModal(false);
      fetchUsers();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (id, action) => {
    try {
      await action(id);
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const columns = [
    { key: 'name', label: 'Name', render: (row) => (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
          {row.name?.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.email}</p>
        </div>
      </div>
    )},
    { key: 'rollNo', label: 'Roll No' },
    { key: 'domain', label: 'Domain' },
    { key: 'status', label: 'Status', render: (row) => statusBadge(row) },
    { key: 'createdAt', label: 'Joined', render: (row) => new Date(row.createdAt).toLocaleDateString() },
    { key: 'actions', label: 'Actions', render: (row) => (
      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
        {row.isSuspended ? (
          <Button size="sm" variant="ghost" onClick={() => handleAction(row.id, (id) => api.activateUser(id))} title="Activate">
            <UserCheck className="w-4 h-4 text-emerald-500" />
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => handleAction(row.id, (id) => api.suspendUser(id))} title="Suspend">
            <UserX className="w-4 h-4 text-amber-500" />
          </Button>
        )}
        {!row.isVerified && (
          <Button size="sm" variant="ghost" onClick={() => handleAction(row.id, (id) => api.verifyUser(id))} title="Verify">
            <Shield className="w-4 h-4 text-blue-500" />
          </Button>
        )}
        {isSuperAdmin && !row.isBanned && (
          <Button size="sm" variant="ghost" onClick={() => handleAction(row.id, (id) => api.banUser(id))} title="Ban">
            <Ban className="w-4 h-4 text-destructive" />
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => handleAction(row.id, (id) => api.resetUserPassword(id))} title="Reset Password">
          <Key className="w-4 h-4 text-muted-foreground" />
        </Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground mt-1">
            {isSuperAdmin ? 'Manage all platform users' : `Manage users in ${admin?.domain}`}
          </p>
        </div>
        <div className="flex gap-2">
          {isSuperAdmin && <Button onClick={openAddModal} size="sm"><Plus className="w-4 h-4 mr-2" /> Add User</Button>}
          <Button onClick={fetchUsers} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      <Card className="glass border-border/50">
        <CardContent className="p-6">
          <DataTable
            columns={columns}
            data={users}
            loading={loading}
            pagination={pagination}
            onPageChange={setPage}
            onSearch={setSearch}
            searchPlaceholder="Search by name, email, or roll number..."
          />
        </CardContent>
      </Card>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-background/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-border/50">
              <h2 className="text-xl font-semibold">Add New User</h2>
              <Button size="sm" variant="ghost" onClick={() => setShowAddModal(false)}><X className="w-5 h-5" /></Button>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Full Name *</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Roll Number *</label>
                <Input value={form.rollNo} onChange={(e) => setForm({ ...form, rollNo: e.target.value })} placeholder="e.g. 21CS001" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="student@college.ac.in" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password *</label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Optional" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Domain *</label>
                <select
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                >
                  <option value="">Select domain</option>
                  {domains.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create User'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}