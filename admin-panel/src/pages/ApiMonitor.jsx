import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Activity, BarChart3, Clock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function ApiMonitor() {
  const { admin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (admin?.role !== 'SUPER_ADMIN') return;
    setLoading(true);
    try {
      const res = await api.getApiMonitorStats();
      setData(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  if (admin?.role !== 'SUPER_ADMIN') {
    return <p className="text-muted-foreground">Access denied. Super Admin only.</p>;
  }

  const actionCounts = data?.actionCounts || {};
  const recentActivity = data?.recentActivity || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Monitor</h1>
          <p className="text-muted-foreground mt-1">API activity monitoring and action tracking</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Actions</p>
                <p className="text-2xl font-bold">{data?.totalLoggedActions || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unique Actions</p>
                <p className="text-2xl font-bold">{Object.keys(actionCounts).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Recent (50)</p>
                <p className="text-2xl font-bold">{recentActivity.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass border-border/50">
          <CardHeader><CardTitle>Action Distribution</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(actionCounts).length === 0 ? (
              <p className="text-muted-foreground text-sm">No actions recorded yet</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(actionCounts).sort((a, b) => b[1] - a[1]).map(([action, count]) => (
                  <div key={action} className="flex items-center justify-between p-2 rounded-lg bg-accent/50">
                    <span className="text-sm font-medium">{action}</span>
                    <Badge>{count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-muted-foreground text-sm">No recent activity</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {recentActivity.slice(0, 20).map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-2 rounded-lg bg-accent/50">
                    <div>
                      <p className="text-sm font-medium">{log.action}</p>
                      <p className="text-xs text-muted-foreground">{log.adminName} • {new Date(log.createdAt).toLocaleString()}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{log.entity}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}