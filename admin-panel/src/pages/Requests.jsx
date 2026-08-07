import { useState, useEffect } from 'react';
import api from '@/lib/api';
import DataTable from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Check, X } from 'lucide-react';

export default function Requests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.getRequests({ page, limit: 10 });
      setRequests(res.data.requests);
      setPagination(res.data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRequests(); }, [page]);

  const handleAction = async (id, action) => {
    try { await action(id); fetchRequests(); }
    catch (err) { alert(err.message); }
  };

  const columns = [
    { key: 'ride', label: 'Ride', render: (row) => (
      <div>
        <p className="font-medium">{row.ride?.from} → {row.ride?.to}</p>
        <p className="text-xs text-muted-foreground">{new Date(row.ride?.date).toLocaleDateString()}</p>
      </div>
    )},
    { key: 'requester', label: 'Requester', render: (row) => row.requester?.name || 'N/A' },
    { key: 'status', label: 'Status', render: (row) => {
      const variants = { PENDING: 'default', ACCEPTED: 'bg-emerald-500/10 text-emerald-500', REJECTED: 'destructive' };
      return <Badge className={variants[row.status]}>{row.status}</Badge>;
    }},
    { key: 'createdAt', label: 'Date', render: (row) => new Date(row.createdAt).toLocaleDateString() },
    { key: 'actions', label: 'Actions', render: (row) => row.status === 'PENDING' && (
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => handleAction(row.id, api.approveRequest)}>
          <Check className="w-4 h-4 text-emerald-500" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => handleAction(row.id, api.rejectRequest)}>
          <X className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ride Requests</h1>
          <p className="text-muted-foreground mt-1">Manage ride requests</p>
        </div>
        <Button onClick={fetchRequests} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
      </div>
      <Card className="glass border-border/50"><CardContent className="p-6">
        <DataTable columns={columns} data={requests} loading={loading} pagination={pagination} onPageChange={setPage} />
      </CardContent></Card>
    </div>
  );
}