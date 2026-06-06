'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate, formatCurrency, cn } from '@/lib/utils'
import { RefreshCw, Search } from 'lucide-react'

export default function ReposicionesPage() {
  const [reposiciones, setReposiciones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const fetchReposiciones = async () => {
      setLoading(true)
      const { data } = await supabase.from('reposiciones')
        .select('*, clientes(nombre, whatsapp), ventas_original:venta_original_id(plataformas(nombre, icono)), cuenta_anterior:cuenta_anterior_id(correo), cuenta_nueva:cuenta_nueva_id(correo)')
        .order('created_at', { ascending: false })
      let filtered = data || []
      if (search) filtered = filtered.filter((r: any) => r.clientes?.nombre?.toLowerCase().includes(search.toLowerCase()))
      setReposiciones(filtered)
      setLoading(false)
    }
    fetchReposiciones()
  }, [search])

  return (
    <div className="space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title flex items-center gap-2"><RefreshCw size={22} /> Reposiciones</h1>
          <p className="section-subtitle">{reposiciones.length} reposiciones realizadas</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
        <input className="input pl-9" placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Cuenta anterior</th>
              <th>Cuenta nueva</th>
              <th>Días restantes</th>
              <th>Días pausados</th>
              <th>Nueva fecha venc.</th>
              <th>Fecha reposición</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-[var(--text-3)]">Cargando...</td></tr>
            ) : reposiciones.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-[var(--text-3)]">No hay reposiciones</td></tr>
            ) : reposiciones.map(r => (
              <tr key={r.id}>
                <td className="font-medium text-[var(--text)]">{r.clientes?.nombre || '—'}</td>
                <td className="font-mono text-xs text-red-400">{r.cuenta_anterior?.correo || '—'}</td>
                <td className="font-mono text-xs text-emerald-400">{r.cuenta_nueva?.correo || '—'}</td>
                <td className="text-yellow-400 font-bold">{r.dias_restantes} días</td>
                <td className="text-[var(--text-3)]">{r.dias_pausados} días</td>
                <td className="text-sky-400">{formatDate(r.nueva_fecha_vencimiento)}</td>
                <td className="text-xs text-[var(--text-3)]">{formatDate(r.fecha_reposicion)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
