'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, ShoppingCart, Package, Building2,
  Flag, Tv, TrendingUp, Settings, Menu, X, Moon, Sun,
  Bell, ChevronRight, RefreshCw, Layers, Film, Gamepad2,
  DollarSign, Zap
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { supabase } from '@/lib/supabase'
import clsx from 'clsx'

const navItems = [
  { href: '/dashboard',                    label: 'Dashboard',      icon: LayoutDashboard, dot: 'bg-violet-400' },
  { href: '/dashboard/ventas',             label: 'Ventas',         icon: ShoppingCart,    dot: 'bg-emerald-400' },
  { href: '/dashboard/clientes',           label: 'Clientes',       icon: Users,           dot: 'bg-blue-400' },
  { href: '/dashboard/inventario',         label: 'Inventario',     icon: Package,         dot: 'bg-amber-400' },
  { href: '/dashboard/combos',             label: 'Combos',         icon: Layers,          dot: 'bg-pink-400' },
  { href: '/dashboard/peliculas',          label: 'Películas',      icon: Film,            dot: 'bg-red-400' },
  { href: '/dashboard/gaming',             label: 'Gaming',         icon: Gamepad2,        dot: 'bg-orange-400' },
  { href: '/dashboard/cobros',             label: 'Cobros',         icon: DollarSign,      dot: 'bg-teal-400' },
  { href: '/dashboard/proveedores',        label: 'Proveedores',    icon: Building2,       dot: 'bg-purple-400' },
  { href: '/dashboard/reportes',           label: 'Reportes',       icon: Flag,            dot: 'bg-rose-400' },
  { href: '/dashboard/plataformas',        label: 'Plataformas',    icon: Tv,              dot: 'bg-cyan-400' },
  { href: '/dashboard/finanzas',           label: 'Finanzas',       icon: TrendingUp,      dot: 'bg-lime-400' },
  { href: '/dashboard/notificaciones',     label: 'Alertas',        icon: Bell,            dot: 'bg-yellow-400' },
  { href: '/dashboard/configuracion',      label: 'Configuración',  icon: Settings,        dot: 'bg-gray-400' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { darkMode, toggleDarkMode, sidebarOpen, setSidebarOpen } = useAppStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifCount, setNotifCount] = useState(0)

  useEffect(() => { setMobileOpen(false) }, [pathname])
  useEffect(() => { cargarNotifs() }, [])

  async function cargarNotifs() {
    const { count } = await supabase
      .from('notificaciones_sistema')
      .select('id', { count: 'exact', head: true })
      .eq('leida', false)
    setNotifCount(count || 0)
  }

  const currentLabel = navItems.find(i => i.href === pathname)?.label || 'Dashboard'

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300',
        'lg:relative lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        sidebarOpen ? 'w-60' : 'w-16 hidden lg:flex'
      )} style={{ background: 'var(--sidebar-bg)' }}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
            style={{ background: 'linear-gradient(135deg,#e060c0,#8040e0)' }}>
            <Zap className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && (
            <div>
              <p className="font-bold text-white text-sm leading-tight">StreamingAdmin</p>
              <p className="text-xs leading-tight" style={{ color: 'var(--sidebar-text)', opacity: 0.7 }}>by Aby ✨</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {navItems.map(item => {
            const Icon = item.icon
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href}
                className={clsx('sidebar-item', active && 'sidebar-item-active')}
                title={!sidebarOpen ? item.label : undefined}>
                <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', item.dot, !active && 'opacity-60')} />
                <Icon size={17} className="flex-shrink-0" />
                {sidebarOpen && <span className="truncate text-xs">{item.label}</span>}
                {sidebarOpen && active && <ChevronRight size={12} className="ml-auto opacity-70" />}
              </Link>
            )
          })}
        </nav>

        {/* Dark toggle */}
        <div className="p-2 border-t border-white/10">
          <button onClick={toggleDarkMode}
            className="sidebar-item w-full">
            {darkMode
              ? <Sun size={17} className="text-amber-300 flex-shrink-0" />
              : <Moon size={17} className="text-violet-300 flex-shrink-0" />}
            {sidebarOpen && <span className="text-xs">{darkMode ? 'Modo claro' : 'Modo oscuro'}</span>}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="flex items-center gap-4 px-4 lg:px-6 py-3.5 border-b"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <button className="lg:hidden btn-ghost p-2" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </button>
          <button className="hidden lg:flex btn-ghost p-2" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu size={20} />
          </button>

          <div className="flex-1">
            <h1 className="text-base font-bold" style={{ color: 'var(--text)' }}>{currentLabel}</h1>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/dashboard/notificaciones" className="relative btn-ghost p-2" onClick={cargarNotifs}>
              <Bell size={18} />
              {notifCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 text-[10px] font-bold bg-pink-500 text-white rounded-full flex items-center justify-center ring-pulse">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </Link>
            <button onClick={toggleDarkMode} className="btn-ghost p-2">
              {darkMode ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
            </button>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold cursor-pointer"
              style={{ background: 'linear-gradient(135deg,#c044a0,#8040e0)' }}>
              A
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
