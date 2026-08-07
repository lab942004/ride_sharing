import { useState, useEffect } from 'react';
import api from '@/lib/api';
import DataTable from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, XCircle, Trash2 } from 'lucide-react';

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (typeFilter) params.type = typeFilter;
      const res = await api.getReports(params);
      setReports(res.data.reports || []);
      setPagination(res.data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchReports(); }, [page, typeFilter]);

  const handleAction = async (id, action) => {
    if (!confirm('Are you sure?')) return;
    try { await action(id); fetchReports(); } catch (err) { alert(err.message); }
  };

  const columns = [
    { key: 'type', label: 'Type', render: (row) => {
      const variants = { USER: 'default', RIDE: 'secondary', CHAT: 'outline' };
      return <Badge className={variants[row.type]}>{row.type}</Badge>;
    }},
    { key: 'reason', label: 'Reason' },
    { key: 'reportedBy', label: 'Reported By', render: (row) => row.reportedBy?.name || 'Anonymous' },
    { key: 'status', label: 'Status', render: (row) => {
      const variants = { PENDING: 'default', RESOLVED: 'bg-emerald-500/10 text-emerald-500', CLOSED: 'secondary' };
      return <Badge className={variants[row.status]}>{row.status}</Badge>;
    }},
    { key: 'createdAt', label: 'Date', render: (row) => new Date(row.createdAt).toLocaleDateString() },
    { key: 'actions', label: 'Actions', render: (row) => (
      <div className="flex gap-1">
        {row.status === 'PENDING' && (
          <>
            <Button size="sm" variant="ghost" onClick={() => handleAction(row.id, api.resolveReport)} title="Resolve">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => handleAction(row.id, api.closeReport)} title="Close">
              <XCircle className="w-4 h-4 text-amber-500" />
            </Button>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={() => handleAction(row.id, api.deleteReport)}>
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground mt-1">Manage user, ride, and chat reports</p>
        </div>
        <div className="flex gap-2">
          <select
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Types</option>
            <option value="USER">User Reports</option>
            <option value="RIDE">Ride Reports</option>
            <option value="CHAT">Chat Reports</option>
          </select>
          <Button onClick={fetchReports} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
        </div>
      </div>
      <Card className="glass border-border/50"><CardContent className="p-6">
        <DataTable columns={columns} data={reports} loading={loading} pagination={pagination} onPageChange={setPage} />
      </CardContent></Card>
    </div>
  );
}