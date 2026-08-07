import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Shield, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import DataTable from '@/components/DataTable';

export default function Security() {
  const { admin } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);

  const fetchLogs = async () => {
    if (admin?.role !== 'SUPER_ADMIN') return;
    setLoading(true);
    try {
      const res = await api.getSecurityLogs({ page, limit: 20 });
      setLogs(res.data.logs || []);
      setPagination(res.data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(); }, [page]);

  if (admin?.role !== 'SUPER_ADMIN') {
    return <p className="text-muted-foreground">Access denied. Super Admin only.</p>;
  }

  const columns = [
    { key: 'email', label: 'Email' },
    { key: 'success', label: 'Status', render: (row) => row.success
      ? <Badge className="bg-emerald-500/10 text-emerald-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Success</Badge>
      : <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" /> Failed</Badge>
    },
    { key: 'ipAddress', label: 'IP Address', render: (row) => row.ipAddress || '—' },
    { key: 'createdAt', label: 'Date', render: (row) => new Date(row.createdAt).toLocaleString() },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Security</h1>
          <p className="text-muted-foreground mt-1">Login attempts, session management</p>
        </div>
        <Button onClick={fetchLogs} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
      </div>

      <Card className="glass border-border/50">
        <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Login Attempts</CardTitle></CardHeader>
        <CardContent className="p-6">
          <DataTable columns={columns} data={logs} loading={loading} pagination={pagination} onPageChange={setPage} />
        </CardContent>
      </Card>
    </div>
  );
}