import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import DataTable from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, XCircle, CheckCircle2, Trash2 } from 'lucide-react';

export default function Rides() {
  const { admin } = useAuth();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const fetchRides = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (search) params.search = search;
      const res = await api.getRides(params);
      setRides(res.data.rides);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRides(); }, [page, search]);

  const handleAction = async (id, action) => {
    if (!confirm('Are you sure?')) return;
    try {
      await action(id);
      fetchRides();
    } catch (err) { alert(err.message); }
  };

  const columns = [
    { key: 'route', label: 'Route', render: (row) => (
      <div>
        <p className="font-medium">{row.from} → {row.to}</p>
        <p className="text-xs text-muted-foreground">{new Date(row.date).toLocaleDateString()} at {row.time}</p>
      </div>
    )},
    { key: 'createdBy', label: 'Creator', render: (row) => row.createdBy?.name || 'N/A' },
    { key: 'domain', label: 'Domain' },
    { key: 'availableSeats', label: 'Seats', render: (row) => row.isFull ? <Badge variant="secondary">Full</Badge> : row.availableSeats },
    { key: 'vehicleType', label: 'Vehicle' },
    { key: 'status', label: 'Status', render: (row) => {
      if (row.isCancelled) return <Badge variant="destructive">Cancelled</Badge>;
      if (row.isExpired) return <Badge variant="secondary">Expired</Badge>;
      return <Badge className="bg-emerald-500/10 text-emerald-500">Active</Badge>;
    }},
    { key: '_count', label: 'Requests', render: (row) => row._count?.requests || 0 },
    { key: 'actions', label: 'Actions', render: (row) => (
      <div className="flex gap-1">
        {!row.isCancelled && !row.isExpired && (
          <>
            <Button size="sm" variant="ghost" onClick={() => handleAction(row.id, api.cancelRide)} title="Cancel">
              <XCircle className="w-4 h-4 text-amber-500" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => handleAction(row.id, api.completeRide)} title="Complete">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </Button>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={() => handleAction(row.id, api.deleteRide)} title="Delete">
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ride Management</h1>
          <p className="text-muted-foreground mt-1">View and manage all rides</p>
        </div>
        <Button onClick={fetchRides} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>
      <Card className="glass border-border/50">
        <CardContent className="p-6">
          <DataTable
            columns={columns}
            data={rides}
            loading={loading}
            pagination={pagination}
            onPageChange={setPage}
            onSearch={setSearch}
            searchPlaceholder="Search routes..."
          />
        </CardContent>
      </Card>
    </div>
  );
}