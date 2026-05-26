'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Monitor, Plus, Edit, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'

const defaultForm = { nombre: '', icono: '📺', color: '#0ea5e9', max_perfiles: 5, descripcion: '', activa: true }

export default function PlataformasPage() {
  const [plataformas, setPlataformas] = useState<any[]>([])
  const [stats, setStats] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)

  async function fetchPlataformas() {
    setLoading(true)
    const { data } = await supabase.from('plataformas').select('*').order('nombre')
    setPlataformas(data || [])
    if (data) {
      const obj: Record<string, any> = {}
      await Promise.all(data.map(async (p: any) => {
        const [{ count: cuentas }, { count: ventas }] = await Promise.all([
          supabase.from('cuentas').select('*', { count: 'exact', head: true }).eq('plataforma_id', p.id),
          supabase.from('ventas').select('*', { count: 'exact', head: true }).eq('plataforma_id', p.id).eq('estado', 'activa'),
        ])
        obj[p.id] = { cuentas: cuentas || 0, ventas: ventas || 0 }
      }))
      setStats(obj)
    }
    setLoading(false)
  }

  useEffect(() => { fetchPlataformas() }, [])

  function openNew() { setEditing(null); setForm(defaultForm); setShowModal(true) }
  function openEdit(p: any) {
    setEditing(p)
    setForm({ nombre: p.nombre, icono: p.icono || '📺', color: p.color || '#0ea5e9', max_perfiles: p.max_perfiles, descripcion: p.descripcion || '', activa: p.activa })
    setShowModal(true)
  }

  async function save() {
    if (!form.nombre.trim()) return toast.error('El nombre es requerido')
    setSaving(true)
    try {
      if (editing) {
        await supabase.from('plataformas').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editing.id)
        toast.success('Plataforma actualizada')
      } else {
        await supabase.from('plataformas').insert({ ...form })
        toast.success('Plataforma creada')
      }
      setShowModal(false)
      fetchPlataformas()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function deletePlataforma(p: any) {
    if (!confirm(`¿Eliminar ${p.nombre}?`)) return
    const { error } = await supabase.from('plataformas').delete().eq('id', p.id)
    if (error) return toast.error('No se puede eliminar (tiene cuentas/ventas asociadas)')
    toast.success('Plataforma eliminada')
    fetchPlataformas()
  }

  const ICONOS = ['🎬', '✨', '🎭', '📦', '🎵', '▶️', '⭐', '⚔️', '🍎', '📡', '🎮', '📺', '🎶', '🏆', '🌟']

  return (
    <div className="space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title flex items-center gap-2"><Monitor size={22} /> Plataformas</h1>
          <p className="section-subtitle">{plataformas.length} plataformas configuradas</p>
        </div>
        <button onClick={openNew} className="btn-primary"><Plus size={16} /> Nueva Plataforma</button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-slate-500">Cargando...</div>
        ) : plataformas.map(p => {
          const s = stats[p.id] || { cuentas: 0, ventas: 0 }
          return (
            <div key={p.id} className="card-hover group">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: p.color + '20', border: `1px solid ${p.color}40` }}>
                    {p.icono}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-200">{p.nombre}</div>
                    <div className="text-xs text-slate-500">{p.max_perfiles} perfiles máx.</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                  <button onClick={() => openEdit(p)} className="btn-ghost btn-sm btn-icon"><Edit size={13} /></button>
                  <button onClick={() => deletePlataforma(p)} className="btn-ghost btn-sm btn-icon text-red-400"><Trash2 size={13} /></button>
                </div>
              </div>
              {p.descripcion && <p className="text-xs text-slate-500 mb-3">{p.descripcion}</p>}
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center p-2 rounded-lg bg-[#0f172a]">
                  <div className="text-sm font-bold text-sky-400">{s.cuentas}</div>
                  <div className="text-[10px] text-slate-500">Cuentas</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-[#0f172a]">
                  <div className="text-sm font-bold text-emerald-400">{s.ventas}</div>
                  <div className="text-[10px] text-slate-500">Ventas activas</div>
                </div>
              </div>
              {!p.activa && <div className="mt-2 text-xs text-red-400 text-center">Inactiva</div>}
            </div>
          )
        })}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-semibold text-slate-200">{editing ? 'Editar Plataforma' : 'Nueva Plataforma'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200"><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div>
                <label className="label">Nombre *</label>
                <input className="input" placeholder="Netflix, Disney+..." value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div>
                <label className="label">Ícono</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {ICONOS.map(ic => (
                    <button key={ic} onClick={() => setForm(f => ({ ...f, icono: ic }))}
                      className={cn('w-9 h-9 rounded-lg text-xl flex items-center justify-center transition-all', form.icono === ic ? 'bg-sky-500/30 border-2 border-sky-500' : 'bg-[#1e2d42] hover:bg-[#243447]')}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="w-10 h-10 rounded-lg border-0 bg-transparent cursor-pointer" />
                    <input className="input flex-1" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="label">Máx. perfiles</label>
                  <input className="input" type="number" min="1" max="10" value={form.max_perfiles} onChange={e => setForm(f => ({ ...f, max_perfiles: parseInt(e.target.value) || 1 }))} />
                </div>
              </div>
              <div>
                <label className="label">Descripción</label>
                <input className="input" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.activa} onChange={e => setForm(f => ({ ...f, activa: e.target.checked }))} className="accent-sky-500" />
                <span className="text-sm text-slate-300">Plataforma activa</span>
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
