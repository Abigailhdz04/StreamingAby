'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getEstadoBadgeColor, cn, formatDate, diasRestantes, getAlertaColor, getAlertaVencimiento } from '@/lib/utils'
import { Layers, Search, Eye, Edit, X } from 'lucide-react'
import toast from 'react-hot-toast'

export default function PerfilesPage() {
  const [perfiles, setPerfiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroPlataforma, setFiltroPlataforma] = useState('')
  const [plataformas, setPlataformas] = useState<any[]>([])
  const [showEdit, setShowEdit] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [nombreEdit, setNombreEdit] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchPerfiles = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase.from('perfiles')
        .select('*, cuentas(correo, plataforma_id, plataformas(nombre, icono, color)), clientes(nombre, whatsapp)')
        .order('created_at', { ascending: false })
      if (filtroEstado) q = q.eq('estado', filtroEstado)
      const { data } = await q

      let filtered = data || []
      if (search) filtered = filtered.filter((p: any) =>
        p.nombre_perfil?.toLowerCase().includes(search.toLowerCase()) ||
        p.clientes?.nombre?.toLowerCase().includes(search.toLowerCase()) ||
        p.cuentas?.correo?.toLowerCase().includes(search.toLowerCase())
      )
      if (filtroPlataforma) filtered = filtered.filter((p: any) => p.cuentas?.plataforma_id === filtroPlataforma)
      setPerfiles(filtered)
    } finally {
      setLoading(false)
    }
  }, [search, filtroEstado, filtroPlataforma])

  useEffect(() => { fetchPerfiles() }, [fetchPerfiles])

  useEffect(() => {
    supabase.from('plataformas').select('*').eq('activa', true).order('nombre').then(({ data }) => setPlataformas(data || []))
  }, [])

  async function saveNombre() {
    setSaving(true)
    try {
      await supabase.from('perfiles').update({ nombre_perfil: nombreEdit, updated_at: new Date().toISOString() }).eq('id', editing.id)
      toast.success('Nombre actualizado')
      setShowEdit(false)
      fetchPerfiles()
    } finally {
      setSaving(false)
    }
  }

  async function liberarPerfil(perfil: any) {
    if (!confirm('¿Liberar este perfil? Se desvinculará del cliente actual.')) return
    await supabase.from('perfiles').update({ estado: 'libre', cliente_id: null, updated_at: new Date().toISOString() }).eq('id', perfil.id)
    // También actualizar la venta correspondiente
    await supabase.from('ventas').update({ estado: 'vencida' }).eq('perfil_id', perfil.id).eq('estado', 'activa')
    await supabase.from('movimientos').insert({ tipo: 'perfil_liberado', descripcion: `Perfil ${perfil.nombre_perfil} liberado manualmente`, entidad: 'perfiles', entidad_id: perfil.id, cliente_id: perfil.cliente_id })
    toast.success('Perfil liberado')
    fetchPerfiles()
  }

  const stats = {
    libre: perfiles.filter(p => p.estado === 'libre').length,
    ocupado: perfiles.filter(p => p.estado === 'ocupado').length,
    bloqueado: perfiles.filter(p => p.estado === 'bloqueado').length,
    reportado: perfiles.filter(p => p.estado === 'reportado').length,
  }

  return (
    <div className="space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title flex items-center gap-2"><Layers size={22} /> Perfiles</h1>
          <p className="section-subtitle">{perfiles.length} perfiles en total</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Libres', count: stats.libre, color: 'text-emerald-400' },
          { label: 'Ocupados', count: stats.ocupado, color: 'text-blue-400' },
          { label: 'Reportados', count: stats.reportado, color: 'text-red-400' },
          { label: 'Bloqueados', count: stats.bloqueado, color: 'text-[var(--text-3)]' },
        ].map(s => (
          <div key={s.label} className="card text-center">
            <div className={cn('text-2xl font-bold', s.color)}>{s.count}</div>
            <div className="text-xs text-[var(--text-3)] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
          <input className="input pl-9" placeholder="Buscar perfil, cliente o cuenta..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select w-40" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos</option>
          <option value="libre">Libre</option>
          <option value="ocupado">Ocupado</option>
          <option value="reportado">Reportado</option>
          <option value="bloqueado">Bloqueado</option>
        </select>
        <select className="select w-44" value={filtroPlataforma} onChange={e => setFiltroPlataforma(e.target.value)}>
          <option value="">Todas las plataformas</option>
          {plataformas.map(p => <option key={p.id} value={p.id}>{p.icono} {p.nombre}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nombre perfil</th>
              <th>Plataforma</th>
              <th>Cuenta</th>
              <th>Cliente</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-[var(--text-3)]">Cargando...</td></tr>
            ) : perfiles.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-[var(--text-3)]">No hay perfiles</td></tr>
            ) : perfiles.map(p => (
              <tr key={p.id}>
                <td className="text-[var(--text-3)] text-xs">{p.numero_perfil}</td>
                <td className="font-medium text-[var(--text)]">{p.nombre_perfil || `Perfil ${p.numero_perfil}`}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <span>{p.cuentas?.plataformas?.icono}</span>
                    <span className="text-xs text-[var(--text-3)]">{p.cuentas?.plataformas?.nombre}</span>
                  </div>
                </td>
                <td className="font-mono text-xs text-[var(--text-3)]">{p.cuentas?.correo ? p.cuentas.correo.substring(0, 25) + '...' : '—'}</td>
                <td>
                  {p.clientes ? (
                    <div>
                      <div className="text-sm text-[var(--text-2)]">{p.clientes.nombre}</div>
                      {p.clientes.whatsapp && (
                        <a href={`https://wa.me/${p.clientes.whatsapp}`} target="_blank" className="text-xs text-emerald-400 hover:underline">WA</a>
                      )}
                    </div>
                  ) : (
                    <span className="text-[var(--text-3)]">—</span>
                  )}
                </td>
                <td>
                  <span className={cn('badge text-[10px]', getEstadoBadgeColor(p.estado))}>{p.estado}</span>
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditing(p); setNombreEdit(p.nombre_perfil || ''); setShowEdit(true) }} className="btn-ghost btn-sm btn-icon" title="Renombrar">
                      <Edit size={13} />
                    </button>
                    {p.estado === 'ocupado' && (
                      <button onClick={() => liberarPerfil(p)} className="btn-ghost btn-sm text-xs text-orange-400 hover:text-orange-300 px-2 py-1" title="Liberar perfil">
                        Liberar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Editar nombre */}
      {showEdit && editing && (
        <div className="modal-overlay" onClick={() => setShowEdit(false)}>
          <div className="modal max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-semibold text-[var(--text)]">Renombrar Perfil</h2>
              <button onClick={() => setShowEdit(false)} className="text-[var(--text-3)] hover:text-[var(--text)]"><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div>
                <label className="label">Nombre del perfil</label>
                <input
                  className="input"
                  placeholder="Ej: JUAN, 001, Cliente A..."
                  value={nombreEdit}
                  onChange={e => setNombreEdit(e.target.value)}
                  autoFocus
                />
              </div>
              <p className="text-xs text-[var(--text-3)]">Este es el nombre que aparece en la plataforma de streaming para identificar el perfil.</p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowEdit(false)} className="btn-secondary">Cancelar</button>
              <button onClick={saveNombre} disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
