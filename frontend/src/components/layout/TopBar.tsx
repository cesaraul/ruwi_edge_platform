import { Bell, Menu, LogOut, Wifi, WifiOff } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useWsStore } from '../../stores/wsStore'
import { useAlerts } from '../../hooks/queries/useAlerts'
import { useNavigate } from 'react-router-dom'

export function TopBar() {
  const { user, logout, toggleSidebar } = useAppStore()
  const { connected } = useWsStore()
  const navigate = useNavigate()
  const { data: alerts } = useAlerts(false)
  const unreadCount = alerts?.filter((a) => !a.acknowledged).length ?? 0

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <header className="h-14 bg-bg-surface border-b border-bg-border flex items-center px-4 gap-4 shrink-0">
      {/* Left: hamburger + logo */}
      <button
        onClick={toggleSidebar}
        className="p-1.5 rounded-md hover:bg-bg-elevated text-txt-secondary transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-2">
        <span className="text-base font-bold text-txt-primary">Ruwi</span>
        <span className="text-xs text-txt-muted bg-bg-elevated px-1.5 py-0.5 rounded font-mono">IoT</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right: WS indicator, alerts, user */}
      <div className="flex items-center gap-3">

        {/* WebSocket status */}
        <div className="flex items-center gap-1.5 text-xs">
          {connected ? (
            <>
              <Wifi className="h-4 w-4 text-status-ok" />
              <span className="text-status-ok hidden sm:inline">Live</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-txt-muted" />
              <span className="text-txt-muted hidden sm:inline">Offline</span>
            </>
          )}
        </div>

        {/* Alerts bell */}
        <button
          onClick={() => navigate('/alerts')}
          className="relative p-1.5 rounded-md hover:bg-bg-elevated text-txt-secondary transition-colors"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-status-crit text-white
                             text-[10px] flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* User */}
        <div className="flex items-center gap-2 pl-3 border-l border-bg-border">
          <div className="h-7 w-7 rounded-full bg-energy-muted flex items-center justify-center text-xs text-energy-accent font-semibold">
            {user?.email?.charAt(0).toUpperCase() ?? 'U'}
          </div>
          <span className="text-txt-secondary text-sm hidden sm:inline truncate max-w-[120px]">
            {user?.email ?? 'Usuario'}
          </span>
          <button
            onClick={handleLogout}
            className="p-1 rounded hover:bg-bg-elevated text-txt-muted transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
