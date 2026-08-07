import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Trash2, HardDrive, Image, FileText } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function Storage() {
  const { admin } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    if (admin?.role !== 'SUPER_ADMIN') return;
    setLoading(true);
    try {
      const res = await api.getStorageStats();
      setStats(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStats(); }, []);

  if (admin?.role !== 'SUPER_ADMIN') {
    return <p className="text-muted-foreground">Access denied. Super Admin only.</p>;
  }

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Storage</h1>
          <p className="text-muted-foreground mt-1">Cloudinary storage management</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={async () => {
            if (!confirm('Clean up files older than 30 days?')) return;
            try { const res = await api.cleanupStorage(30); alert(`Deleted ${res.data.deletedCount} files`); fetchStats(); }
            catch (err) { alert(err.message); }
          }} variant="outline" size="sm">
            <Trash2 className="w-4 h-4 mr-2" /> Cleanup
          </Button>
          <Button onClick={fetchStats} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <HardDrive className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Files</p>
                <p className="text-2xl font-bold">{stats?.stats?.totalFiles || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                <Image className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Size</p>
                <p className="text-2xl font-bold">{formatBytes(stats?.stats?.totalBytes)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass border-border/50">
        <CardHeader><CardTitle>Recent Files</CardTitle></CardHeader>
        <CardContent>
          {stats?.recentFiles?.length === 0 ? (
            <p className="text-muted-foreground text-sm">No files uploaded yet</p>
          ) : (
            <div className="space-y-2">
              {stats?.recentFiles?.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/50">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium truncate max-w-[300px]">{file.url}</p>
                      <p className="text-xs text-muted-foreground">{new Date(file.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{file.format} • {file.bytes ? formatBytes(file.bytes) : 'N/A'}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}