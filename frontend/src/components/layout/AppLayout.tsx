import { Outlet, Navigate } from 'react-router-dom'
import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'
import { useAppStore } from '../../stores/appStore'
import { useWebSocket } from '../../hooks/useWebSocket'

function WsConnector() {
  const { selectedOrgId } = useAppStore()
  useWebSocket(selectedOrgId)
  return null
}

export function AppLayout() {
  const { user } = useAppStore()

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg-base">
      <WsConnector />
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
