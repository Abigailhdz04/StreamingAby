'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, diasRestantes, getAlertaVencimiento, getAlertaColor } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  Users, Package, TrendingUp, AlertTriangle, CheckCircle,
  Clock, RefreshCw, Activity, DollarSign, ShoppingBag,
  Monitor, Building2, Layers, ArrowUpRight, Bell
} from 'lucide-react'
import Link from 'next/link'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts'

interface DashStats {
  clientesActivos: number
  cuentasActivas: number
  perfilesLibres: number
  ventasHoy: number
  gananciasHoy: number
  reportesPendientes: number
  proximosVencer: any[]
  ventasRecientes: any[]
  alertas: any[]
  gananciasMes: number
  totalVentas: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashStats>({
    clientesActivos: 0, cuentasActivas: 0, perfilesLibres: 0,
    ventasHoy: 0, gananciasHoy: 0, reportesPendientes: 0,
    proximosVencer: [], ventasRecientes: [], alertas: [],
    gananciasMes: 0, totalVentas: 0,
  })
  const [loading, setLoading] = useState(true)
  const [chartData, setChartData] = useState<any[]>([])

  useEffect(() => {
    fetchStats()
    fetchChartData()
  }, [])

  async function fetchStats() {
    try {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const manana = new Date(hoy)
      manana.setDate(manana.getDate() + 1)
      const en7dias = new Date(hoy)
      en7dias.setDate(en7dias.getDate() + 7)

      const [
        { count: clientesActivos },
        { count: cuentasActivas },
        { count: perfilesLibres },
        { count: reportesPendientes },
        { data: ventasHoyData },
        { data: proximosVencer },
        { data: ventasRecientes },
        { count: totalVentas },
      ] = await Promise.all([
        supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('estado', 'activo'),
        supabase.from('cuentas').select('*', { count: 'exact', head: true }).in('estado', ['disponible', 'parcial', 'llena']),
        supabase.from('perfiles').select('*', { count: 'exact', head: true }).eq('estado', 'libre'),
        supabase.from('reportes').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
        supabase.from('ventas').select('precio_venta, ganancia, created_at').gte('created_at', hoy.toISOString()).eq('estado', 'activa'),
        supabase.from('ventas')
          .select('*, clientes(nombre, whatsapp), plataformas(nombre, icono, color), perfiles(nombre_perfil)')
          .eq('estado', 'activa')
          .gte('fecha_vencimiento', hoy.toISOString())
          .lte('fecha_vencimiento', en7dias.toISOString())
          .order('fecha_vencimiento', { ascending: true })
          .limit(10),
        supabase.from('ventas')
          .select('*, clientes(nombre), plataformas(nombre, icono, color), perfiles(nombre_perfil)')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('ventas').select('*', { count: 'exact', head: true }),
      ])

      const ventasHoy = ventasHoyData?.length || 0
      const gananciasHoy = ventasHoyData?.reduce((sum, v) => sum + (v.ganancia || 0), 0) || 0

      // Ganancias del mes
      const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
      const { data: ventasMes } = await supabase
        .from('ventas')
        .select('ganancia')
        .gte('created_at', primerDiaMes.toISOString())
      const gananciasMes = ventasMes?.reduce((sum, v) => sum + (v.ganancia || 0), 0) || 0

      setStats({
        clientesActivos: clientesActivos || 0,
        cuentasActivas: cuentasActivas || 0,
        perfilesLibres: perfilesLibres || 0,
        ventasHoy,
        gananciasHoy,
        reportesPendientes: reportesPendientes || 0,
        proximosVencer: proximosVencer || [],
        ventasRecientes: ventasRecientes || [],
        alertas: [],
        gananciasMes,
        totalVentas: totalVentas || 0,
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchChartData() {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      d.setHours(0, 0, 0, 0)
      const next = new Date(d)
      next.setDate(next.getDate() + 1)
      const { data } = await supabase
        .from('ventas')
        .select('precio_venta, ganancia')
        .gte('created_at', d.toISOString())
        .lt('created_at', next.toISOString())
      days.push({
        dia: d.toLocaleDateString('es', { weekday: 'short' }),
        ventas: data?.reduce((s, v) => s + (v.precio_venta || 0), 0) || 0,
        ganancias: data?.reduce((s, v) => s + (v.ganancia || 0), 0) || 0,
        cantidad: data?.length || 0,
      })
    }
    setChartData(days)
  }

  const statCards = [
    { label: 'Clientes Activos', value: stats.clientesActivos, icon: Users, color: 'sky', href: '/dashboard/clientes' },
    { label: 'Cuentas en Stock', value: stats.cuentasActivas, icon: Package, color: 'purple', href: '/dashboard/inventario' },
    { label: 'Perfiles Libres', value: stats.perfilesLibres, icon: Layers, color: 'emerald', href: '/dashboard/perfiles' },
    { label: 'Ventas Hoy', value: stats.ventasHoy, icon: ShoppingBag, color: 'blue', href: '/dashboard/ventas' },
    { label: 'Ganancias Hoy', value: formatCurrency(stats.gananciasHoy), icon: DollarSign, color: 'emerald', href: '/dashboard/finanzas' },
    { label: 'Reportes Pendientes', value: stats.reportesPendientes, icon: AlertTriangle, color: 'red', href: '/dashboard/reportes' },
    { label: 'Ganancias del Mes', value: formatCurrency(stats.gananciasMes), icon: TrendingUp, color: 'cyan', href: '/dashboard/finanzas' },
    { label: 'Total Ventas', value: stats.totalVentas, icon: Activity, color: 'indigo', href: '/dashboard/ventas' },
  ]

  const colorMap: Record<string, { bg: string, icon: string, text: string }> = {
    sky: { bg: 'bg-sky-500/10', icon: 'text-sky-400', text: 'text-sky-300' },
    purple: { bg: 'bg-purple-500/10', icon: 'text-purple-400', text: 'text-purple-300' },
    emerald: { bg: 'bg-emerald-500/10', icon: 'text-emerald-400', text: 'text-emerald-300' },
    blue: { bg: 'bg-blue-500/10', icon: 'text-blue-400', text: 'text-blue-300' },
    red: { bg: 'bg-red-500/10', icon: 'text-red-400', text: 'text-red-300' },
    cyan: { bg: 'bg-cyan-500/10', icon: 'text-cyan-400', text: 'text-cyan-300' },
    indigo: { bg: 'bg-indigo-500/10', icon: 'text-indigo-400', text: 'text-indigo-300' },
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <span>Cargando dashboard...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">
          Dashboard <span className="gradient-text">StreamingAby</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => {
          const c = colorMap[card.color] || colorMap.sky
          return (
            <Link key={i} href={card.href} className="card-hover group">
              <div className="flex items-start justify-between mb-3">
                <div className={cn('stat-icon w-10 h-10 rounded-lg', c.bg)}>
                  <card.icon size={18} className={c.icon} />
                </div>
                <ArrowUpRight size={14} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
              </div>
              <div className={cn('text-xl font-bold', c.text)}>{card.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{card.label}</div>
            </Link>
          )
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Gráfico de ventas */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-slate-200">Ventas últimos 7 días</h2>
              <p className="text-xs text-slate-500 mt-0.5">Ingresos y ganancias diarias</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorGanancias" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d42" />
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{ background: '#131c2e', border: '1px solid #1e2d42', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(v: any, name: string) => [formatCurrency(v), name === 'ventas' ? 'Ventas' : 'Ganancias']}
              />
              <Area type="monotone" dataKey="ventas" stroke="#0ea5e9" fill="url(#colorVentas)" strokeWidth={2} />
              <Area type="monotone" dataKey="ganancias" stroke="#10b981" fill="url(#colorGanancias)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Próximos a vencer */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-200 flex items-center gap-2">
              <Bell size={15} className="text-yellow-400" />
              Próximos a vencer
            </h2>
            <Link href="/dashboard/ventas" className="text-xs text-sky-400 hover:text-sky-300">Ver todos</Link>
          </div>
          <div className="space-y-2.5">
            {stats.proximosVencer.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">Sin vencimientos próximos</p>
            ) : (
              stats.proximosVencer.map((v: any) => {
                const dias = diasRestantes(v.fecha_vencimiento)
                const tipo = getAlertaVencimiento(dias)
                return (
                  <div key={v.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-[#0f172a] border border-[#1e2d42]">
                    <span className="text-lg">{v.plataformas?.icono || '📺'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-300 truncate">{v.clientes?.nombre}</div>
                      <div className="text-[10px] text-slate-500">{v.plataformas?.nombre} · {v.nombre_perfil_asignado || v.perfiles?.nombre_perfil}</div>
                    </div>
                    <div className={cn('text-xs font-bold', getAlertaColor(tipo))}>
                      {dias < 0 ? 'Vencido' : dias === 0 ? 'Hoy' : `${dias}d`}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Ventas recientes */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-200">Ventas Recientes</h2>
          <Link href="/dashboard/ventas" className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1">
            Ver todas <ArrowUpRight size={12} />
          </Link>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Plataforma</th>
                <th>Perfil</th>
                <th>Precio</th>
                <th>Vencimiento</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {stats.ventasRecientes.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-slate-500 py-8">No hay ventas aún</td></tr>
              ) : (
                stats.ventasRecientes.map((v: any) => {
                  const dias = diasRestantes(v.fecha_vencimiento)
                  const tipo = getAlertaVencimiento(dias)
                  return (
                    <tr key={v.id}>
                      <td className="font-medium text-slate-200">{v.clientes?.nombre || '—'}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span>{v.plataformas?.icono}</span>
                          <span className="text-slate-400">{v.plataformas?.nombre}</span>
                        </div>
                      </td>
                      <td className="text-slate-400">{v.nombre_perfil_asignado || v.perfiles?.nombre_perfil || '—'}</td>
                      <td className="text-emerald-400 font-medium">{formatCurrency(v.precio_venta)}</td>
                      <td className={cn('font-medium', getAlertaColor(tipo))}>
                        {dias < 0 ? 'Vencido' : dias === 0 ? 'Hoy' : `${dias} días`}
                      </td>
                      <td>
                        <span className={cn('badge', v.estado === 'activa' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-500/20 text-slate-400 border-slate-500/30')}>
                          {v.estado}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
