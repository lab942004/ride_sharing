import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import DataTable from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw, Plus, Trash2, Edit, Save, X,
} from 'lucide-react';

const TABS = ['banners', 'carousel', 'featured'];

export default function HomeManagement() {
  const { admin } = useAuth();
  const isSuperAdmin = admin?.role === 'SUPER_ADMIN';
  const [activeTab, setActiveTab] = useState('banners');
  const [banners, setBanners] = useState([]);
  const [carousel, setCarousel] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', subtitle: '', imageUrl: '', linkUrl: '', order: 0 });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bRes, cRes, fRes] = await Promise.all([
        api.getBanners(),
        api.getCarouselItems(),
        api.getFeaturedCards(),
      ]);
      setBanners(bRes.data.banners || []);
      setCarousel(cRes.data.carouselItems || []);
      setFeatured(fRes.data.featuredCards || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const resetForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm({ title: '', subtitle: '', imageUrl: '', linkUrl: '', order: 0 });
  };

  const handleEdit = (item) => {
    setEditing(item);
    setForm({ title: item.title || '', subtitle: item.subtitle || '', imageUrl: item.imageUrl || '', linkUrl: item.linkUrl || '', order: item.order || 0 });
    setShowForm(true);
  };

  const handleSave = async () => {
    try {
      const data = { ...form };
      if (activeTab === 'banners') {
        if (editing) await api.updateBanner(editing.id, data);
        else await api.createBanner(data);
      } else if (activeTab === 'carousel') {
        if (editing) await api.updateCarouselItem(editing.id, data);
        else await api.createCarouselItem(data);
      } else if (activeTab === 'featured') {
        if (editing) await api.updateFeaturedCard(editing.id, data);
        else await api.createFeaturedCard(data);
      }
      resetForm();
      fetchData();
    } catch (err) { alert(err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure?')) return;
    try {
      if (activeTab === 'banners') await api.deleteBanner(id);
      else if (activeTab === 'carousel') await api.deleteCarouselItem(id);
      else if (activeTab === 'featured') await api.deleteFeaturedCard(id);
      fetchData();
    } catch (err) { alert(err.message); }
  };

  const getData = () => {
    if (activeTab === 'banners') return banners;
    if (activeTab === 'carousel') return carousel;
    return featured;
  };

  const columns = [
    { key: 'title', label: 'Title' },
    { key: 'subtitle', label: 'Subtitle' },
    { key: 'isActive', label: 'Status', render: (row) => row.isActive ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge> },
    { key: 'order', label: 'Order' },
    { key: 'actions', label: 'Actions', render: (row) => isSuperAdmin ? (
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => handleEdit(row)}><Edit className="w-4 h-4" /></Button>
        <Button size="sm" variant="ghost" onClick={() => handleDelete(row.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
      </div>
    ) : null },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Home Management</h1>
          <p className="text-muted-foreground mt-1">Manage homepage banners, carousel, and featured cards</p>
        </div>
        <div className="flex gap-2">
          {isSuperAdmin && (
            <Button onClick={() => { resetForm(); setShowForm(true); }} size="sm">
              <Plus className="w-4 h-4 mr-2" /> Add New
            </Button>
          )}
          <Button onClick={fetchData} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab ? 'bg-primary/10 text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Form Modal — super admin only */}
      {isSuperAdmin && showForm && (
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {editing ? 'Edit Item' : `Add New ${activeTab.slice(0, -1)}`}
              <Button variant="ghost" size="sm" onClick={resetForm}><X className="w-4 h-4" /></Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Subtitle</label>
              <Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Subtitle (optional)" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Image URL</label>
              <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://example.com/image.jpg" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Link URL</label>
              <Input value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} placeholder="Link (optional)" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Order</label>
              <Input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })} />
            </div>
            <Button onClick={handleSave}><Save className="w-4 h-4 mr-2" /> Save</Button>
          </CardContent>
        </Card>
      )}

      {/* Data Table */}
      <Card className="glass border-border/50">
        <CardContent className="p-6">
          <DataTable columns={columns} data={getData()} loading={loading} />
        </CardContent>
      </Card>
    </div>
  );
}