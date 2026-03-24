import { NavLink } from 'react-router-dom'
import { Map, Cpu, Bell, BarChart2, Settings } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useAlerts } from '../../hooks/queries/useAlerts'
import { cn } from '../../lib/utils'

const NAV = [
  { icon: Map,       label: 'Mapa',        path: '/' },
  { icon: Cpu,       label: 'Dispositivos', path: '/devices' },
  { icon: Bell,      label: 'Alertas',     path: '/alerts' },
  { icon: BarChart2, label: 'Analytics',   path: '/analytics' },
  { icon: Settings,  label: 'Config',      path: '/settings' },
]

export function Sidebar() {
  const { sidebarCollapsed, activeVertical, setVertical } = useAppStore()
  const { data: alerts } = useAlerts(false)
  const unreadCount = alerts?.filter((a) => !a.acknowledged).length ?? 0

  return (
    <aside
      className={cn(
        'bg-bg-surface border-r border-bg-border flex flex-col shrink-0 transition-all duration-200',
        sidebarCollapsed ? 'w-16' : 'w-56',
      )}
    >
      {/* Nav links */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {NAV.map(({ icon: Icon, label, path }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors relative',
                isActive
                  ? 'bg-bg-elevated text-txt-primary font-medium'
                  : 'text-txt-secondary hover:bg-bg-elevated hover:text-txt-primary',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span className="truncate">{label}</span>}
            {/* Alert badge on Alerts link */}
            {label === 'Alertas' && unreadCount > 0 && (
              <span className={cn(
                'flex items-center justify-center rounded-full bg-status-crit text-white text-[10px] font-bold',
                sidebarCollapsed
                  ? 'absolute -top-1 -right-1 h-4 w-4'
                  : 'ml-auto h-5 w-5',
              )}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Vertical filter */}
      {!sidebarCollapsed && (
        <div className="px-3 py-4 border-t border-bg-border">
          <p className="text-txt-muted text-xs mb-2 uppercase tracking-wide">Vertical</p>
          <div className="space-y-1">
            {[
              { value: 'all',     label: 'Todos',   icon: '🔲' },
              { value: 'agro',    label: 'Agro',    icon: '🌱' },
              { value: 'energia', label: 'Energía', icon: '⚡' },
            ].map(({ value, label, icon }) => (
              <button
                key={value}
                onClick={() => setVertical(value as typeof activeVertical)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
                  activeVertical === value
                    ? 'bg-bg-elevated text-txt-primary font-medium'
                    : 'text-txt-secondary hover:bg-bg-elevated',
                )}
              >
                <span>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Collapsed vertical icons */}
      {sidebarCollapsed && (
        <div className="px-2 py-4 border-t border-bg-border space-y-1">
          {[
            { value: 'all',     icon: '🔲' },
            { value: 'agro',    icon: '🌱' },
            { value: 'energia', icon: '⚡' },
          ].map(({ value, icon }) => (
            <button
              key={value}
              onClick={() => setVertical(value as typeof activeVertical)}
              className={cn(
                'w-full flex items-center justify-center py-2 rounded-md text-base transition-colors',
                activeVertical === value ? 'bg-bg-elevated' : 'hover:bg-bg-elevated',
              )}
            >
              {icon}
            </button>
          ))}
        </div>
      )}
    </aside>
  )
}
