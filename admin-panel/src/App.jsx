import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AuthProvider } from '@/context/AuthContext';
import AdminLayout from '@/layouts/AdminLayout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Users from '@/pages/Users';
import Rides from '@/pages/Rides';
import Requests from '@/pages/Requests';
import Chats from '@/pages/Chats';
import Domains from '@/pages/Domains';
import Admins from '@/pages/Admins';
import Profile from '@/pages/Profile';
import Settings from '@/pages/Settings';
import Notifications from '@/pages/Notifications';
import ActivityLogs from '@/pages/ActivityLogs';
import Analytics from '@/pages/Analytics';
import Reports from '@/pages/Reports';
import HomeManagement from '@/pages/HomeManagement';
import Storage from '@/pages/Storage';
import Security from '@/pages/Security';
import Database from '@/pages/Database';
import ApiMonitor from '@/pages/ApiMonitor';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="users" element={<Users />} />
            <Route path="rides" element={<Rides />} />
            <Route path="requests" element={<Requests />} />
            <Route path="chats" element={<Chats />} />
            <Route path="domains" element={<Domains />} />
            <Route path="admins" element={<Admins />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="activity-logs" element={<ActivityLogs />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="reports" element={<Reports />} />
            <Route path="home-management" element={<HomeManagement />} />
            <Route path="storage" element={<Storage />} />
            <Route path="security" element={<Security />} />
            <Route path="database" element={<Database />} />
            <Route path="api-monitor" element={<ApiMonitor />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}