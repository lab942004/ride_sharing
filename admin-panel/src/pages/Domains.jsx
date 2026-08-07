import { useState, useEffect } from 'react';
import api from '@/lib/api';
import DataTable from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { RefreshCw, Plus, Trash2, X, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function Domains() {
  const { admin } = useAuth();
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', isActive: true });

  const fetchDomains = async () => {
    setLoading(true);
    try {
      const res = await api.getDomains();
      setDomains(res.data.domains);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDomains(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Delete this domain?')) return;
    try { await api.deleteDomain(id); fetchDomains(); }
    catch (err) { alert(err.message); }
  };

  const handleToggleActive = async (domain) => {
    try {
      await api.updateDomain(domain.id, { isActive: !domain.isActive });
      fetchDomains();
    } catch (err) { alert(err.message); }
  };

  const handleCreateDomain = async (e) => {
    e.preventDefault();
    const cleanName = form.name.trim().replace(/^@/, '').toLowerCase();
    if (!cleanName) { alert('Domain name is required'); return; }
    setSubmitting(true);
    try {
      await api.createDomain({ ...form, name: cleanName });
      setShowAddModal(false);
      setForm({ name: '', description: '', isActive: true });
      fetchDomains();
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
    { key: 'name', label: 'Domain' },
    { key: 'description', label: 'Description', render: (row) => row.description || '—' },
    {
      key: 'isActive', label: 'Status', render: (row) => (
        <button onClick={() => handleToggleActive(row)} className="flex items-center gap-1 hover:opacity-80 transition-opacity" title={row.isActive ? 'Click to deactivate' : 'Click to activate'}>
          {row.isActive
            ? <><ToggleRight className="w-5 h-5 text-green-500" /><Badge>Active</Badge></>
            : <><ToggleLeft className="w-5 h-5 text-muted-foreground" /><Badge variant="secondary">Inactive</Badge></>}
        </button>
      )
    },
    { key: 'userCount', label: 'Users' },
    { key: 'rideCount', label: 'Rides' },
    { key: 'adminCount', label: 'Admins' },
    { key: 'actions', label: 'Actions', render: (row) => (
      <Button size="sm" variant="ghost" onClick={() => handleDelete(row.id)}>
        <Trash2 className="w-4 h-4 text-destructive" />
      </Button>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Domain Management</h1>
          <p className="text-muted-foreground mt-1">Manage platform domains</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAddModal(true)} size="sm"><Plus className="w-4 h-4 mr-2" /> Add Domain</Button>
          <Button onClick={fetchDomains} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
        </div>
      </div>
      <Card className="glass border-border/50"><CardContent className="p-6">
        <DataTable columns={columns} data={domains} loading={loading} />
      </CardContent></Card>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-background/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b border-border/50">
              <h2 className="text-xl font-semibold">Add New Domain</h2>
              <Button size="sm" variant="ghost" onClick={() => setShowAddModal(false)}><X className="w-5 h-5" /></Button>
            </div>
            <form onSubmit={handleCreateDomain} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Domain Name *</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. gmail.com or college.ac.in"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="isActive" className="text-sm font-medium">Allow registrations from this domain (Active)</label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create Domain'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
