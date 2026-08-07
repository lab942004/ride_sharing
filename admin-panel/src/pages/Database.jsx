import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Database as DatabaseIcon, Users, Car, MessageSquare, ClipboardList, Building2, ShieldCheck, FileText } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function Database() {
  const { admin } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    if (admin?.role !== 'SUPER_ADMIN') return;
    setLoading(true);
    try {
      const res = await api.getDatabaseStats();
      setStats(res.data.stats);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStats(); }, []);

  if (admin?.role !== 'SUPER_ADMIN') {
    return <p className="text-muted-foreground">Access denied. Super Admin only.</p>;
  }

  const statCards = [
    { key: 'users', label: 'Users', icon: Users, color: 'from-blue-500 to-blue-600' },
    { key: 'rides', label: 'Rides', icon: Car, color: 'from-violet-500 to-violet-600' },
    { key: 'requests', label: 'Requests', icon: ClipboardList, color: 'from-rose-500 to-rose-600' },
    { key: 'chats', label: 'Chats', icon: MessageSquare, color: 'from-cyan-500 to-cyan-600' },
    { key: 'messages', label: 'Messages', icon: MessageSquare, color: 'from-teal-500 to-teal-600' },
    { key: 'admins', label: 'Admins', icon: ShieldCheck, color: 'from-indigo-500 to-indigo-600' },
    { key: 'domains', label: 'Domains', icon: Building2, color: 'from-purple-500 to-purple-600' },
    { key: 'reports', label: 'Reports', icon: FileText, color: 'from-amber-500 to-amber-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Database</h1>
          <p className="text-muted-foreground mt-1">Database statistics and record counts</p>
        </div>
        <Button onClick={fetchStats} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.key} className="glass border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="text-3xl font-bold mt-1">{stats?.[card.key] || 0}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg`}>
                  <card.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}