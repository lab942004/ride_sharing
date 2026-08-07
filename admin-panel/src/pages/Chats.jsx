import { useState, useEffect } from 'react';
import api from '@/lib/api';
import DataTable from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Trash2 } from 'lucide-react';

export default function Chats() {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);

  const fetchChats = async () => {
    setLoading(true);
    try {
      const res = await api.getChats({ page, limit: 10 });
      setChats(res.data.chats);
      setPagination(res.data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchChats(); }, [page]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this conversation?')) return;
    try { await api.deleteConversation(id); fetchChats(); }
    catch (err) { alert(err.message); }
  };

  const columns = [
    { key: 'request', label: 'Ride', render: (row) => (
      <div>
        <p className="font-medium">{row.request?.ride?.from} → {row.request?.ride?.to}</p>
        <p className="text-xs text-muted-foreground">{row.request?.requester?.name}</p>
      </div>
    )},
    { key: 'status', label: 'Status', render: (row) => (
      <Badge variant={row.request?.status === 'ACCEPTED' ? 'default' : 'secondary'}>{row.request?.status}</Badge>
    )},
    { key: 'messages', label: 'Messages', render: (row) => row._count?.messages || 0 },
    { key: 'createdAt', label: 'Started', render: (row) => new Date(row.createdAt).toLocaleDateString() },
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
          <h1 className="text-3xl font-bold">Chat Moderation</h1>
          <p className="text-muted-foreground mt-1">Monitor and manage conversations</p>
        </div>
        <Button onClick={fetchChats} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
      </div>
      <Card className="glass border-border/50"><CardContent className="p-6">
        <DataTable columns={columns} data={chats} loading={loading} pagination={pagination} onPageChange={setPage} />
      </CardContent></Card>
    </div>
  );
}