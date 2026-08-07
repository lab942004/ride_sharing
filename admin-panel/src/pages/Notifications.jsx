import { useState, useEffect } from 'react';
import api from '@/lib/api';
import DataTable from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Plus, Send, Save, X, Trash2, Bell } from 'lucide-react';

export default function Notifications() {
  const [announcements, setAnnouncements] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [showPushForm, setShowPushForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', type: 'GLOBAL', domain: '', scheduledAt: '' });
  const [pushForm, setPushForm] = useState({ userId: '', title: '', content: '' });
  const [bulkForm, setBulkForm] = useState({ userIds: '', title: '', content: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [annRes, notifRes] = await Promise.all([
        api.getAnnouncements({ page, limit: 10 }),
        api.getUserNotifications({ page: 1, limit: 10 }),
      ]);
      setAnnouncements(annRes.data.announcements || []);
      setNotifications(notifRes.data.notifications || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [page]);

  const handleCreateAnnouncement = async () => {
    try {
      await api.createAnnouncement(form);
      setShowForm(false);
      setForm({ title: '', content: '', type: 'GLOBAL', domain: '', scheduledAt: '' });
      fetchData();
    } catch (err) { alert(err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this announcement?')) return;
    try { await api.deleteAnnouncement(id); fetchData(); } catch (err) { alert(err.message); }
  };

  const handleSendPush = async () => {
    try {
      await api.sendNotification(pushForm);
      setShowPushForm(false);
      setPushForm({ userId: '', title: '', content: '' });
      alert('Notification sent');
    } catch (err) { alert(err.message); }
  };

  const handleSendBulk = async () => {
    try {
      const userIds = bulkForm.userIds.split(',').map(s => s.trim()).filter(Boolean);
      await api.sendBulkNotifications({ userIds, title: bulkForm.title, content: bulkForm.content });
      setBulkForm({ userIds: '', title: '', content: '' });
      alert('Bulk notifications sent');
    } catch (err) { alert(err.message); }
  };

  const columns = [
    { key: 'title', label: 'Title' },
    { key: 'type', label: 'Type', render: (row) => <Badge variant={row.type === 'GLOBAL' ? 'default' : 'secondary'}>{row.type}</Badge> },
    { key: 'status', label: 'Status', render: (row) => {
      const variants = { ACTIVE: 'default', INACTIVE: 'secondary', SCHEDULED: 'outline' };
      return <Badge className={variants[row.status]}>{row.status}</Badge>;
    }},
    { key: 'domain', label: 'Domain', render: (row) => row.domain || '—' },
    { key: 'createdAt', label: 'Created', render: (row) => new Date(row.createdAt).toLocaleDateString() },
    { key: 'actions', label: 'Actions', render: (row) => (
      <Button size="sm" variant="ghost" onClick={() => handleDelete(row.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notifications & Announcements</h1>
          <p className="text-muted-foreground mt-1">Create announcements and push notifications to users</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowPushForm(true)} size="sm" variant="outline">
            <Send className="w-4 h-4 mr-2" /> Push Notification
          </Button>
          <Button onClick={() => setShowForm(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" /> New Announcement
          </Button>
          <Button onClick={fetchData} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
        </div>
      </div>

      {/* Create Announcement Form */}
      {showForm && (
        <Card className="glass border-border/50">
          <CardHeader><CardTitle className="flex justify-between">New Announcement <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}><X className="w-4 h-4" /></Button></CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} placeholder="Announcement title" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Content</label>
              <textarea className="w-full min-h-[100px] rounded-lg border border-border bg-background px-3 py-2 text-sm" value={form.content} onChange={(e) => setForm({...form, content: e.target.value})} placeholder="Announcement content" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={form.type} onChange={(e) => setForm({...form, type: e.target.value})}>
                  <option value="GLOBAL">Global</option>
                  <option value="DOMAIN">Domain</option>
                  <option value="SCHEDULED">Scheduled</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Domain (for DOMAIN type)</label>
                <Input value={form.domain} onChange={(e) => setForm({...form, domain: e.target.value})} placeholder="domain name" />
              </div>
            </div>
            {form.type === 'SCHEDULED' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Schedule Date</label>
                <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({...form, scheduledAt: e.target.value})} />
              </div>
            )}
            <Button onClick={handleCreateAnnouncement}><Save className="w-4 h-4 mr-2" /> Create</Button>
          </CardContent>
        </Card>
      )}

      {/* Push Notification Form */}
      {showPushForm && (
        <Card className="glass border-border/50">
          <CardHeader><CardTitle className="flex justify-between">Send Push Notification <Button variant="ghost" size="sm" onClick={() => setShowPushForm(false)}><X className="w-4 h-4" /></Button></CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Single User</label>
              <Input value={pushForm.userId} onChange={(e) => setPushForm({...pushForm, userId: e.target.value})} placeholder="User ID" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input value={pushForm.title} onChange={(e) => setPushForm({...pushForm, title: e.target.value})} placeholder="Notification title" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Content</label>
              <textarea className="w-full min-h-[80px] rounded-lg border border-border bg-background px-3 py-2 text-sm" value={pushForm.content} onChange={(e) => setPushForm({...pushForm, content: e.target.value})} placeholder="Notification content" />
            </div>
            <Button onClick={handleSendPush}><Send className="w-4 h-4 mr-2" /> Send</Button>

            <hr className="border-border" />
            <h3 className="font-medium">Bulk Send</h3>
            <div className="space-y-2">
              <label className="text-sm font-medium">User IDs (comma-separated)</label>
              <Input value={bulkForm.userIds} onChange={(e) => setBulkForm({...bulkForm, userIds: e.target.value})} placeholder="user1, user2, user3" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input value={bulkForm.title} onChange={(e) => setBulkForm({...bulkForm, title: e.target.value})} placeholder="Notification title" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Content</label>
              <textarea className="w-full min-h-[80px] rounded-lg border border-border bg-background px-3 py-2 text-sm" value={bulkForm.content} onChange={(e) => setBulkForm({...bulkForm, content: e.target.value})} placeholder="Notification content" />
            </div>
            <Button onClick={handleSendBulk}><Send className="w-4 h-4 mr-2" /> Send to All</Button>
          </CardContent>
        </Card>
      )}

      {/* Announcements Table */}
      <Card className="glass border-border/50">
        <CardHeader><CardTitle>Announcements</CardTitle></CardHeader>
        <CardContent className="p-6">
          <DataTable columns={columns} data={announcements} loading={loading} pagination={{ page, pages: Math.ceil(announcements.length / 10), total: announcements.length }} onPageChange={setPage} />
        </CardContent>
      </Card>
    </div>
  );
}