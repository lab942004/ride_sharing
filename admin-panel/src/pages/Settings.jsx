import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { RefreshCw, Save } from 'lucide-react';

export default function Settings() {
  const { admin } = useAuth();
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (admin?.role !== 'SUPER_ADMIN') return;
    api.getSystemSettings().then(res => setSettings(res.data.settings || {})).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async (key, value) => {
    try { await api.updateSystemSetting(key, value); }
    catch (err) { alert(err.message); }
  };

  if (admin?.role !== 'SUPER_ADMIN') {
    return <p className="text-muted-foreground">Access denied. Super Admin only.</p>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">System Settings</h1>
      <Card className="glass border-border/50">
        <CardHeader><CardTitle>Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="h-20 skeleton rounded" />
          ) : (
            <p className="text-muted-foreground">System settings management interface. Configure platform-wide settings here.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}