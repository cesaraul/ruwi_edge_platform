import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/auth/LoginPage'
import { MapDashboard } from './pages/MapDashboard'
import { DevicesPage } from './pages/DevicesPage'
import { DeviceDetailPage } from './pages/DeviceDetailPage'
import { AlertsPage } from './pages/AlertsPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { SettingsPage } from './pages/SettingsPage'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true,              element: <MapDashboard /> },
      { path: 'devices',          element: <DevicesPage /> },
      { path: 'devices/:id',      element: <DeviceDetailPage /> },
      { path: 'alerts',           element: <AlertsPage /> },
      { path: 'analytics',        element: <AnalyticsPage /> },
      { path: 'settings',         element: <SettingsPage /> },
      { path: '*',                element: <Navigate to="/" replace /> },
    ],
  },
])
