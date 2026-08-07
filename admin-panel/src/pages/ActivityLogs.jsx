import { useState, useEffect } from 'react';
import api from '@/lib/api';
import DataTable from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, Activity } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function ActivityLogs() {
  const { admin } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);

  const fetchLogs = async () => {
    if (admin?.role !== 'SUPER_ADMIN') return;
    setLoading(true);
    try {
      const res = await api.getActivityLogs({ page, limit: 20 });
      setLogs(res.data.logs);
      setPagination(res.data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(); }, [page]);

  if (admin?.role !== 'SUPER_ADMIN') {
    return <p className="text-muted-foreground">Access denied. Super Admin only.</p>;
  }

  const columns = [
    { key: 'action', label: 'Action', render: (row) => (
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-primary" />
        <span className="font-medium">{row.action}</span>
      </div>
    )},
    { key: 'adminName', label: 'Admin' },
    { key: 'entity', label: 'Entity' },
    { key: 'details', label: 'Details', render: (row) => row.details ? JSON.stringify(row.details).slice(0, 50) : '—' },
    { key: 'createdAt', label: 'Date', render: (row) => new Date(row.createdAt).toLocaleString() },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Activity Logs</h1>
          <p className="text-muted-foreground mt-1">Track all admin actions</p>
        </div>
        <Button onClick={fetchLogs} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
      </div>
      <Card className="glass border-border/50"><CardContent className="p-6">
        <DataTable columns={columns} data={logs} loading={loading} pagination={pagination} onPageChange={setPage} />
      </CardContent></Card>
    </div>
  );
}