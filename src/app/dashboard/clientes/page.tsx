'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate, formatCurrency, diasRestantes, getEstadoBadgeColor, getAlertaVencimiento, getAlertaColor, cn } from '@/lib/utils'
import { Users, Plus, Search, Phone, Mail, MessageSquare, Eye, Edit, Trash2, X, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

interface Cliente {
  id: string
  nombre: string
  telefono: string
  whatsapp: string
  correo: string
  notas: string
  estado: string
  fecha_registro: string
  ventas?: any[]
}

const defaultForm = { nombre: '', telefono: '', whatsapp: '', correo: '', notas: '', estado: 'activo' }

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [editing, setEditing] = useState<Cliente | null>(null)
  const [selected, setSelected] = useState<Cliente | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)
  const [clienteVentas, setClienteVentas] = useState<any[]>([])

  const fetchClientes = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase.from('clientes').select('*').order('created_at', { ascending: false })
      if (filtroEstado) q = q.eq('estado', filtroEstado)
      if (search) q = q.ilike('nombre', `%${search}%`)
      const { data } = await q
      setClientes(data || [])
    } finally {
      setLoading(false)
    }
  }, [search, filtroEstado])

  useEffect(() => { fetchClientes() }, [fetchClientes])

  async function openDetail(cliente: Cliente) {
    setSelected(cliente)
    setShowDetail(true)
    const { data } = await supabase
      .from('ventas')
      .select('*, plataformas(nombre, icono, color), perfiles(nombre_perfil), cuentas(correo)')
      .eq('cliente_id', cliente.id)
      .order('created_at', { ascending: false })
    setClienteVentas(data || [])
  }

  function openNew() {
    setEditing(null)
    setForm(defaultForm)
    setShowModal(true)
  }

  function openEdit(c: Cliente) {
    setEditing(c)
    setForm({ nombre: c.nombre, telefono: c.telefono || '', whatsapp: c.whatsapp || '', correo: c.correo || '', notas: c.notas || '', estado: c.estado })
    setShowModal(true)
  }

  async function save() {
    if (!form.nombre.trim()) return toast.error('El nombre es requerido')
    setSaving(true)
    try {
      if (editing) {
        const { error } = await supabase.from('clientes').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editing.id)
        if (error) throw error
        await supabase.from('movimientos').insert({ tipo: 'cliente_editado', descripcion: `Cliente ${form.nombre} editado`, entidad: 'clientes', entidad_id: editing.id, cliente_id: editing.id })
        toast.success('Cliente actualizado')
      } else {
        const { data, error } = await supabase.from('clientes').insert({ ...form }).select().single()
        if (error) throw error
        await supabase.from('movimientos').insert({ tipo: 'cliente_creado', descripcion: `Nuevo cliente: ${form.nombre}`, entidad: 'clientes', entidad_id: data.id, cliente_id: data.id })
        toast.success('Cliente creado')
      }
      setShowModal(false)
      fetchClientes()
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function deleteCliente(c: Cliente) {
    if (!confirm(`¿Eliminar a ${c.nombre}?`)) return
    const { error } = await supabase.from('clientes').delete().eq('id', c.id)
    if (error) return toast.error('No se puede eliminar (tiene ventas asociadas)')
    toast.success('Cliente eliminado')
    fetchClientes()
  }

  const estados = ['activo', 'vencido', 'suspendido', 'pendiente']

  return (
    <div className="space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title flex items-center gap-2"><Users size={22} /> Clientes</h1>
          <p className="section-subtitle">{clientes.length} clientes registrados</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus size={16} /> Nuevo Cliente
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
          <input
            className="input pl-9"
            placeholder="Buscar cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="select w-40" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos</option>
          {estados.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Contacto</th>
              <th>Estado</th>
              <th>Registro</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-12 text-[var(--text-3)]">Cargando...</td></tr>
            ) : clientes.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-[var(--text-3)]">No hay clientes</td></tr>
            ) : clientes.map(c => (
              <tr key={c.id}>
                <td>
                  <div className="font-medium text-[var(--text)]">{c.nombre}</div>
                  {c.correo && <div className="text-xs text-[var(--text-3)]">{c.correo}</div>}
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    {c.telefono && (
                      <a href={`tel:${c.telefono}`} className="text-[var(--text-3)] hover:text-sky-400">
                        <Phone size={14} />
                      </a>
                    )}
                    {c.whatsapp && (
                      <a href={`https://wa.me/${c.whatsapp}`} target="_blank" rel="noopener" className="text-[var(--text-3)] hover:text-emerald-400">
                        <MessageSquare size={14} />
                      </a>
                    )}
                    <span className="text-xs text-[var(--text-3)]">{c.telefono || c.whatsapp || '—'}</span>
                  </div>
                </td>
                <td>
                  <span className={cn('badge', getEstadoBadgeColor(c.estado))}>{c.estado}</span>
                </td>
                <td className="text-[var(--text-3)] text-xs">{formatDate(c.fecha_registro)}</td>
                <td>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openDetail(c)} className="btn-ghost btn-sm btn-icon" title="Ver detalle">
                      <Eye size={14} />
                    </button>
                    <button onClick={() => openEdit(c)} className="btn-ghost btn-sm btn-icon" title="Editar">
                      <Edit size={14} />
                    </button>
                    <button onClick={() => deleteCliente(c)} className="btn-ghost btn-sm btn-icon text-red-400 hover:text-red-300" title="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Crear/Editar */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-semibold text-[var(--text)]">{editing ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
              <button onClick={() => setShowModal(false)} className="text-[var(--text-3)] hover:text-[var(--text)]"><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div>
                <label className="label">Nombre *</label>
                <input className="input" placeholder="Nombre completo" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
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
                <input className="input" type="email" placeholder="correo@ejemplo.com" value={form.correo} onChange={e => setForm(f => ({ ...f, correo: e.target.value }))} />
              </div>
              <div>
                <label className="label">Estado</label>
                <select className="select" value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                  {estados.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Notas</label>
                <textarea className="input resize-none" rows={3} placeholder="Notas adicionales..." value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={save} disabled={saving} className="btn-primary">
                {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear Cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle Cliente */}
      {showDetail && selected && (
        <div className="modal-overlay" onClick={() => setShowDetail(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="font-semibold text-[var(--text)]">{selected.nombre}</h2>
                <span className={cn('badge mt-1', getEstadoBadgeColor(selected.estado))}>{selected.estado}</span>
              </div>
              <button onClick={() => setShowDetail(false)} className="text-[var(--text-3)] hover:text-[var(--text)]"><X size={18} /></button>
            </div>
            <div className="modal-body">
              {/* Info */}
              <div className="grid grid-cols-2 gap-3">
                {selected.telefono && (
                  <div className="p-3 rounded-lg bg-[#0f172a] border border-[#1e2d42]">
                    <div className="text-xs text-[var(--text-3)]">Teléfono</div>
                    <div className="text-sm text-[var(--text-2)] mt-0.5">{selected.telefono}</div>
                  </div>
                )}
                {selected.whatsapp && (
                  <div className="p-3 rounded-lg bg-[#0f172a] border border-[#1e2d42]">
                    <div className="text-xs text-[var(--text-3)]">WhatsApp</div>
                    <a href={`https://wa.me/${selected.whatsapp}`} target="_blank" className="text-sm text-emerald-400 mt-0.5 block hover:underline">{selected.whatsapp}</a>
                  </div>
                )}
                {selected.correo && (
                  <div className="p-3 rounded-lg bg-[#0f172a] border border-[#1e2d42] col-span-2">
                    <div className="text-xs text-[var(--text-3)]">Correo</div>
                    <div className="text-sm text-[var(--text-2)] mt-0.5">{selected.correo}</div>
                  </div>
                )}
              </div>
              {selected.notas && (
                <div className="p-3 rounded-lg bg-[#0f172a] border border-[#1e2d42]">
                  <div className="text-xs text-[var(--text-3)] mb-1">Notas</div>
                  <div className="text-sm text-[var(--text-2)]">{selected.notas}</div>
                </div>
              )}
              {/* Historial ventas */}
              <div>
                <h3 className="font-medium text-[var(--text-2)] mb-3">Historial de Ventas ({clienteVentas.length})</h3>
                <div className="space-y-2">
                  {clienteVentas.length === 0 ? (
                    <p className="text-sm text-[var(--text-3)] text-center py-4">Sin ventas registradas</p>
                  ) : clienteVentas.map(v => {
                    const dias = diasRestantes(v.fecha_vencimiento)
                    const tipo = getAlertaVencimiento(dias)
                    return (
                      <div key={v.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#0f172a] border border-[#1e2d42]">
                        <span className="text-xl">{v.plataformas?.icono}</span>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-[var(--text-2)]">{v.plataformas?.nombre}</div>
                          <div className="text-xs text-[var(--text-3)]">{v.nombre_perfil_asignado || v.perfiles?.nombre_perfil} · Vence: {formatDate(v.fecha_vencimiento)}</div>
                        </div>
                        <div className="text-right">
                          <div className={cn('text-sm font-bold', getAlertaColor(tipo))}>
                            {dias < 0 ? 'Vencida' : dias === 0 ? 'Hoy' : `${dias}d`}
                          </div>
                          <span className={cn('badge text-[10px]', getEstadoBadgeColor(v.estado))}>{v.estado}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => { setShowDetail(false); openEdit(selected) }} className="btn-secondary">
                <Edit size={14} /> Editar
              </button>
              <button onClick={() => setShowDetail(false)} className="btn-primary">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
