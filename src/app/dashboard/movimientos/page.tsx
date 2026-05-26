'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDateTime, cn } from '@/lib/utils'
import { History, Search, Activity, ShoppingBag, AlertTriangle, RefreshCw, Users, Package } from 'lucide-react'

const TIPO_ICONS: Record<string, any> = {
  venta_creada: { icon: ShoppingBag, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  venta_cancelada: { icon: ShoppingBag, color: 'text-red-400', bg: 'bg-red-500/10' },
  reporte_creado: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  reposicion_realizada: { icon: RefreshCw, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  cliente_creado: { icon: Users, color: 'text-sky-400', bg: 'bg-sky-500/10' },
  cliente_editado: { icon: Users, color: 'text-slate-400', bg: 'bg-slate-500/10' },
  cuenta_creada: { icon: Package, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  cuenta_editada: { icon: Package, color: 'text-slate-400', bg: 'bg-slate-500/10' },
  perfil_liberado: { icon: Activity, color: 'text-orange-400', bg: 'bg-orange-500/10' },
}

export default function MovimientosPage() {
  const [movimientos, setMovimientos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  const fetchMovimientos = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase.from('movimientos')
        .select('*, clientes(nombre)')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      if (filtroTipo) q = q.eq('tipo', filtroTipo)
      if (search) q = q.ilike('descripcion', `%${search}%`)
      const { data } = await q
      setMovimientos(data || [])
    } finally {
      setLoading(false)
    }
  }, [search, filtroTipo, page])

  useEffect(() => { fetchMovimientos() }, [fetchMovimientos])

  const tipos = [
    'venta_creada', 'venta_cancelada', 'reporte_creado', 'reposicion_realizada',
    'cliente_creado', 'cuenta_creada', 'perfil_liberado'
  ]

  return (
    <div className="space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title flex items-center gap-2"><History size={22} /> Movimientos</h1>
          <p className="section-subtitle">Log de todas las actividades del sistema</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9" placeholder="Buscar en actividad..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select w-48" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {tipos.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-12 text-slate-500">Cargando movimientos...</div>
        ) : movimientos.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No hay movimientos registrados</div>
        ) : movimientos.map(m => {
          const config = TIPO_ICONS[m.tipo] || { icon: Activity, color: 'text-slate-400', bg: 'bg-slate-500/10' }
          const IconComp = config.icon
          return (
            <div key={m.id} className="flex items-start gap-3 p-3 rounded-xl bg-[#131c2e] border border-[#1e2d42] hover:border-[#243447] transition-colors">
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', config.bg)}>
                <IconComp size={15} className={config.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-300">{m.descripcion}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-slate-600 bg-[#1e2d42] px-2 py-0.5 rounded">{m.tipo.replace(/_/g, ' ')}</span>
                  {m.clientes?.nombre && <span className="text-[10px] text-slate-500">{m.clientes.nombre}</span>}
                </div>
              </div>
              <div className="text-xs text-slate-600 whitespace-nowrap flex-shrink-0">{formatDateTime(m.created_at)}</div>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-center gap-3">
        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="btn-secondary btn-sm">
          ← Anterior
        </button>
        <span className="text-sm text-slate-400">Página {page + 1}</span>
        <button onClick={() => setPage(p => p + 1)} disabled={movimientos.length < PAGE_SIZE} className="btn-secondary btn-sm">
          Siguiente →
        </button>
      </div>
    </div>
  )
}
