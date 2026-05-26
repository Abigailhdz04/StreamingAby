'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { TrendingUp, DollarSign, TrendingDown, BarChart2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

export default function FinanzasPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalIngresos: 0, totalGanancias: 0, totalCostos: 0, totalPerdidas: 0,
    ventasMes: [] as any[], topPlataformas: [] as any[], reposicionesTotal: 0,
  })
  const [rangoMeses, setRangoMeses] = useState(3)

  useEffect(() => { fetchFinanzas() }, [rangoMeses])

  async function fetchFinanzas() {
    setLoading(true)
    try {
      const fechaDesde = new Date()
      fechaDesde.setMonth(fechaDesde.getMonth() - rangoMeses)

      const { data: ventas } = await supabase.from('ventas')
        .select('precio_venta, costo_real, ganancia, created_at, plataforma_id, plataformas(nombre, icono, color)')
        .gte('created_at', fechaDesde.toISOString())
        .order('created_at', { ascending: true })

      const { count: reposicionesTotal } = await supabase.from('reposiciones')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', fechaDesde.toISOString())

      // Totales
      const totalIngresos = ventas?.reduce((s, v) => s + (v.precio_venta || 0), 0) || 0
      const totalCostos = ventas?.reduce((s, v) => s + (v.costo_real || 0), 0) || 0
      const totalGanancias = ventas?.reduce((s, v) => s + (v.ganancia || 0), 0) || 0

      // Agrupar por mes
      const mesMap: Record<string, { mes: string, ingresos: number, ganancias: number, cantidad: number }> = {}
      ventas?.forEach(v => {
        const fecha = new Date(v.created_at)
        const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
        const label = fecha.toLocaleDateString('es', { month: 'short', year: '2-digit' })
        if (!mesMap[key]) mesMap[key] = { mes: label, ingresos: 0, ganancias: 0, cantidad: 0 }
        mesMap[key].ingresos += v.precio_venta || 0
        mesMap[key].ganancias += v.ganancia || 0
        mesMap[key].cantidad++
      })
      const ventasMes = Object.values(mesMap)

      // Top plataformas
      const platMap: Record<string, { nombre: string, icono: string, color: string, total: number, cantidad: number }> = {}
      ventas?.forEach(v => {
        const plat = (v as any).plataformas
        if (!plat) return
        if (!platMap[v.plataforma_id]) platMap[v.plataforma_id] = { nombre: plat.nombre, icono: plat.icono, color: plat.color || '#0ea5e9', total: 0, cantidad: 0 }
        platMap[v.plataforma_id].total += v.ganancia || 0
        platMap[v.plataforma_id].cantidad++
      })
      const topPlataformas = Object.values(platMap).sort((a, b) => b.total - a.total).slice(0, 6)

      setStats({ totalIngresos, totalGanancias, totalCostos, totalPerdidas: reposicionesTotal ? totalCostos * 0.1 : 0, ventasMes, topPlataformas, reposicionesTotal: reposicionesTotal || 0 })
    } finally {
      setLoading(false)
    }
  }

  const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899']

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title flex items-center gap-2"><TrendingUp size={22} /> Finanzas</h1>
          <p className="section-subtitle">Control financiero y rentabilidad</p>
        </div>
        <select className="select w-36" value={rangoMeses} onChange={e => setRangoMeses(parseInt(e.target.value))}>
          <option value={1}>Último mes</option>
          <option value={3}>3 meses</option>
          <option value={6}>6 meses</option>
          <option value={12}>12 meses</option>
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Ingresos Totales', value: formatCurrency(stats.totalIngresos), icon: DollarSign, color: 'sky', sub: 'Total cobrado' },
          { label: 'Ganancias Netas', value: formatCurrency(stats.totalGanancias), icon: TrendingUp, color: 'emerald', sub: 'Ingresos - Costos' },
          { label: 'Costo Total', value: formatCurrency(stats.totalCostos), icon: TrendingDown, color: 'orange', sub: 'Lo que pagaste' },
          { label: 'Reposiciones', value: stats.reposicionesTotal, icon: BarChart2, color: 'red', sub: 'Garantías usadas' },
        ].map((k, i) => (
          <div key={i} className="card">
            <div className="flex items-center gap-3 mb-2">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center',
                k.color === 'sky' ? 'bg-sky-500/10' : k.color === 'emerald' ? 'bg-emerald-500/10' : k.color === 'orange' ? 'bg-orange-500/10' : 'bg-red-500/10'
              )}>
                <k.icon size={18} className={cn(k.color === 'sky' ? 'text-sky-400' : k.color === 'emerald' ? 'text-emerald-400' : k.color === 'orange' ? 'text-orange-400' : 'text-red-400')} />
              </div>
              <div className="text-xs text-slate-500">{k.label}</div>
            </div>
            <div className={cn('text-2xl font-bold', k.color === 'sky' ? 'text-sky-400' : k.color === 'emerald' ? 'text-emerald-400' : k.color === 'orange' ? 'text-orange-400' : 'text-red-400')}>{k.value}</div>
            <div className="text-xs text-slate-600 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Ingresos por mes */}
        <div className="card">
          <h2 className="font-semibold text-slate-200 mb-4">Ingresos y Ganancias por Mes</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.ventasMes}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d42" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip
                contentStyle={{ background: '#131c2e', border: '1px solid #1e2d42', borderRadius: '8px', fontSize: '12px' }}
                formatter={(v: any, name: string) => [formatCurrency(v), name === 'ingresos' ? 'Ingresos' : 'Ganancias']}
              />
              <Bar dataKey="ingresos" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ganancias" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top plataformas */}
        <div className="card">
          <h2 className="font-semibold text-slate-200 mb-4">Ganancias por Plataforma</h2>
          {stats.topPlataformas.length === 0 ? (
            <div className="text-center py-12 text-slate-500">Sin datos</div>
          ) : (
            <div className="space-y-3">
              {stats.topPlataformas.map((p, i) => {
                const maxTotal = stats.topPlataformas[0].total
                const pct = maxTotal > 0 ? (p.total / maxTotal) * 100 : 0
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <span>{p.icono}</span>{p.nombre}
                        <span className="text-xs text-slate-500">({p.cantidad} ventas)</span>
                      </div>
                      <span className="text-sm font-bold text-emerald-400">{formatCurrency(p.total)}</span>
                    </div>
                    <div className="h-1.5 bg-[#1e2d42] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Margen de ganancia */}
      <div className="card">
        <h2 className="font-semibold text-slate-200 mb-3">Resumen Financiero</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#0f172a] border border-[#1e2d42] text-center">
            <div className="text-2xl font-bold text-sky-400">{formatCurrency(stats.totalIngresos)}</div>
            <div className="text-xs text-slate-500 mt-1">Total Cobrado</div>
          </div>
          <div className="p-4 rounded-xl bg-[#0f172a] border border-[#1e2d42] text-center">
            <div className="text-2xl font-bold text-orange-400">{formatCurrency(stats.totalCostos)}</div>
            <div className="text-xs text-slate-500 mt-1">Total Gastado</div>
          </div>
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
            <div className="text-2xl font-bold text-emerald-400">{formatCurrency(stats.totalGanancias)}</div>
            <div className="text-xs text-emerald-500 mt-1">Ganancia Neta</div>
            {stats.totalIngresos > 0 && (
              <div className="text-xs text-emerald-600 mt-0.5">
                {Math.round((stats.totalGanancias / stats.totalIngresos) * 100)}% de margen
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
