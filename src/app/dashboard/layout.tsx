'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, Package, ShoppingBag, AlertTriangle,
  Building2, Monitor, TrendingUp, Menu, X, Bell, Settings,
  ChevronRight, RefreshCw, History, Layers
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/ventas', label: 'Ventas' },
  { href: '/dashboard/clientes', label: 'Clientes' },
  { href: '/dashboard/combos', label: 'Combos' },
  { href: '/dashboard/peliculas', label: 'Películas' },
  { href: '/dashboard/gaming', label: 'Gaming' },
  { href: '/dashboard/cobros', label: 'Cobros y Deudas' },
  { href: '/dashboard/notificaciones', label: 'Notificaciones' },
  { href: '/dashboard/inventario', label: 'Inventario' },
  { href: '/dashboard/perfiles', label: 'Perfiles' },
  { href: '/dashboard/reportes', label: 'Reportes' },
  { href: '/dashboard/reposiciones', label: 'Reposiciones' },
  { href: '/dashboard/proveedores', label: 'Proveedores' },
  { href: '/dashboard/plataformas', label: 'Plataformas' },
  { href: '/dashboard/movimientos', label: 'Movimientos' },
  { href: '/dashboard/finanzas', label: 'Finanzas' },
]
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [alerts, setAlerts] = useState(0)

  useEffect(() => {
    // Fetch alert count
    const fetchAlerts = async () => {
      try {
        const res = await fetch('/api/dashboard/alerts-count')
        const data = await res.json()
        setAlerts(data.count || 0)
      } catch {}
    }
    fetchAlerts()
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex">
      {/* Overlay móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed top-0 left-0 h-full w-64 bg-[#0f172a] border-r border-[#1e2d42] z-50 flex flex-col transition-transform duration-300',
        'lg:translate-x-0 lg:static lg:z-auto',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-[#1e2d42]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-sky-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
              SA
            </div>
            <div>
              <div className="font-bold text-[var(--text)] text-sm">StreamingAby</div>
              <div className="text-[10px] text-[var(--text-3)]">Panel de Gestión</div>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-[var(--text-3)] hover:text-[var(--text)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(item => {
  const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))

  return (
    <Link
      key={item.href}
      href={item.href}
      onClick={() => setSidebarOpen(false)}
      className={cn('sidebar-link', active && 'active')}
    >
      <span>{item.label}</span>

      {item.href === '/dashboard/reportes' && alerts > 0 && (
        <span className="ml-auto bg-red-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center">
          {alerts > 9 ? '9+' : alerts}
        </span>
      )}

      {active && <ChevronRight size={14} className="ml-auto opacity-50" />}
    </Link>
  )
})}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-[#1e2d42]">
          <Link href="/dashboard/configuracion" className="sidebar-link">
            <Settings size={17} />
            <span>Configuración</span>
          </Link>
          <div className="mt-3 px-3 py-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20">
            <div className="text-xs text-sky-400 font-medium">Sistema activo</div>
            <div className="text-[10px] text-[var(--text-3)] mt-0.5">Todos los módulos OK</div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 bg-[#0f172a] border-b border-[#1e2d42] flex items-center px-4 gap-4 sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-[var(--text-3)] hover:text-[var(--text)] p-1"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          {/* Alerts bell */}
          <button className="relative p-2 text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[#1e2d42] rounded-lg transition-colors">
            <Bell size={18} />
            {alerts > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">
              A
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-medium text-[var(--text-2)]">Admin</div>
              <div className="text-[10px] text-[var(--text-3)]">Administrador</div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto animate-fade-up">
          {children}
        </main>
      </div>
    </div>
  )
}
