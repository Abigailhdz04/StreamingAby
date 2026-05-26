'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate, formatCurrency, cn } from '@/lib/utils'
import { Building2, Plus, Search, Eye, Edit, Trash2, X, Star, Phone, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'

const defaultForm = { nombre: '', telefono: '', whatsapp: '', correo: '', notas: '', calidad: 8, activo: true }

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<any[]>([])
  const [stats, setStats] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [selected, setSelected] = useState<any>(null)
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)

  const fetchProveedores = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase.from('proveedores').select('*').order('nombre')
      if (search) q = q.ilike('nombre', `%${search}%`)
      const { data } = await q
      setProveedores(data || [])

      // Fetch stats per proveedor
      if (data && data.length > 0) {
        const statsObj: Record<string, any> = {}
        await Promise.all(data.map(async (p: any) => {
          const [{ count: cuentas }, { count: reportes }] = await Promise.all([
            supabase.from('cuentas').select('*', { count: 'exact', head: true }).eq('proveedor_id', p.id),
            supabase.from('reportes').select('*', { count: 'exact', head: true }).eq('proveedor_id', p.id),
          ])
          statsObj[p.id] = { cuentas: cuentas || 0, reportes: reportes || 0 }
        }))
        setStats(statsObj)
      }
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { fetchProveedores() }, [fetchProveedores])

  function openNew() { setEditing(null); setForm(defaultForm); setShowModal(true) }
  function openEdit(p: any) {
    setEditing(p)
    setForm({ nombre: p.nombre, telefono: p.telefono || '', whatsapp: p.whatsapp || '', correo: p.correo || '', notas: p.notas || '', calidad: p.calidad, activo: p.activo })
    setShowModal(true)
  }

  async function openDetail(p: any) {
    setSelected(p)
    setShowDetail(true)
  }

  async function save() {
    if (!form.nombre.trim()) return toast.error('El nombre es requerido')
    setSaving(true)
    try {
      if (editing) {
        const { error } = await supabase.from('proveedores').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editing.id)
        if (error) throw error
        toast.success('Proveedor actualizado')
      } else {
        const { error } = await supabase.from('proveedores').insert({ ...form })
        if (error) throw error
        toast.success('Proveedor creado')
      }
      setShowModal(false)
      fetchProveedores()
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function deleteProveedor(p: any) {
    if (!confirm(`¿Eliminar proveedor ${p.nombre}?`)) return
    const { error } = await supabase.from('proveedores').delete().eq('id', p.id)
    if (error) return toast.error('No se puede eliminar (tiene cuentas asociadas)')
    toast.success('Proveedor eliminado')
    fetchProveedores()
  }

  function getCalidadColor(calidad: number) {
    if (calidad >= 8) return 'text-emerald-400'
    if (calidad >= 5) return 'text-yellow-400'
    return 'text-red-400'
  }

  function getFallaPct(provId: string) {
    const s = stats[provId]
    if (!s || s.cuentas === 0) return 0
    return Math.round((s.reportes / s.cuentas) * 100)
  }

  return (
    <div className="space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title flex items-center gap-2"><Building2 size={22} /> Proveedores</h1>
          <p className="section-subtitle">{proveedores.length} proveedores registrados</p>
        </div>
        <button onClick={openNew} className="btn-primary"><Plus size={16} /> Nuevo Proveedor</button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className="input pl-9" placeholder="Buscar proveedor..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Cards grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-slate-500">Cargando...</div>
        ) : proveedores.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-500">No hay proveedores</div>
        ) : proveedores.map(p => {
          const s = stats[p.id] || { cuentas: 0, reportes: 0 }
          const fallaPct = getFallaPct(p.id)
          return (
            <div key={p.id} className="card-hover group">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-200">{p.nombre}</h3>
                  {!p.activo && <span className="badge bg-red-500/20 text-red-400 border-red-500/30 text-[10px] mt-1">Inactivo</span>}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openDetail(p)} className="btn-ghost btn-sm btn-icon opacity-0 group-hover:opacity-100"><Eye size={13} /></button>
                  <button onClick={() => openEdit(p)} className="btn-ghost btn-sm btn-icon opacity-0 group-hover:opacity-100"><Edit size={13} /></button>
                  <button onClick={() => deleteProveedor(p)} className="btn-ghost btn-sm btn-icon text-red-400 opacity-0 group-hover:opacity-100"><Trash2 size={13} /></button>
                </div>
              </div>

              {/* Calidad */}
              <div className="flex items-center gap-2 mb-3">
                <Star size={14} className={getCalidadColor(p.calidad)} />
                <span className={cn('text-sm font-bold', getCalidadColor(p.calidad))}>{p.calidad}/10</span>
                <div className="flex-1 h-1.5 bg-[#1e2d42] rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full', p.calidad >= 8 ? 'bg-emerald-500' : p.calidad >= 5 ? 'bg-yellow-500' : 'bg-red-500')} style={{ width: `${p.calidad * 10}%` }} />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center p-2 rounded-lg bg-[#0f172a]">
                  <div className="text-sm font-bold text-sky-400">{s.cuentas}</div>
                  <div className="text-[10px] text-slate-500">Cuentas</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-[#0f172a]">
                  <div className="text-sm font-bold text-orange-400">{s.reportes}</div>
                  <div className="text-[10px] text-slate-500">Reportes</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-[#0f172a]">
                  <div className={cn('text-sm font-bold', fallaPct > 20 ? 'text-red-400' : fallaPct > 10 ? 'text-yellow-400' : 'text-emerald-400')}>{fallaPct}%</div>
                  <div className="text-[10px] text-slate-500">Fallas</div>
                </div>
              </div>

              {/* Contacto */}
              <div className="flex items-center gap-2">
                {p.telefono && (
                  <a href={`tel:${p.telefono}`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-sky-400">
                    <Phone size={12} />{p.telefono}
                  </a>
                )}
                {p.whatsapp && (
                  <a href={`https://wa.me/${p.whatsapp}`} target="_blank" className="flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-400">
                    <MessageSquare size={12} />WA
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal Crear/Editar */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-semibold text-slate-200">{editing ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200"><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div>
                <label className="label">Nombre *</label>
                <input className="input" placeholder="Nombre del proveedor" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Teléfono</label>
                  <input className="input" placeholder="55 1234 5678" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
                </div>
                <div>
                  <label className="label">WhatsApp</label>
                  <input className="input" placeholder="521234567890" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Correo</label>
                <input className="input" type="email" value={form.correo} onChange={e => setForm(f => ({ ...f, correo: e.target.value }))} />
              </div>
              <div>
                <label className="label">Calidad del servicio: <span className={cn('font-bold', getCalidadColor(form.calidad))}>{form.calidad}/10</span></label>
                <input className="w-full accent-sky-500" type="range" min="1" max="10" value={form.calidad} onChange={e => setForm(f => ({ ...f, calidad: parseInt(e.target.value) }))} />
              </div>
              <div>
                <label className="label">Notas</label>
                <textarea className="input resize-none" rows={3} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} className="accent-sky-500" />
                <span className="text-sm text-slate-300">Proveedor activo</span>
              </label>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
