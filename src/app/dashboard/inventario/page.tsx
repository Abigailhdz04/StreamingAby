'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate, formatCurrency, getEstadoBadgeColor, cn, diasRestantes, getAlertaColor, getAlertaVencimiento } from '@/lib/utils'
import { Package, Plus, Search, Eye, Edit, Trash2, X, Key, Shield } from 'lucide-react'
import toast from 'react-hot-toast'

interface Cuenta {
  id: string
  plataforma_id: string
  proveedor_id: string
  correo: string
  contrasena: string
  pin: string
  tipo: string
  max_perfiles: number
  perfiles_disponibles: number
  perfiles_ocupados: number
  fecha_compra: string
  fecha_vencimiento: string
  costo: number
  estado: string
  notas: string
  plataformas?: any
  proveedores?: any
  perfiles?: any[]
}

const defaultForm = {
  plataforma_id: '', proveedor_id: '', correo: '', contrasena: '', pin: '',
  tipo: 'completa', max_perfiles: 5, fecha_compra: new Date().toISOString().split('T')[0],
  fecha_vencimiento: '', costo: 0, notas: '', estado: 'disponible'
}

export default function InventarioPage() {
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [plataformas, setPlataformas] = useState<any[]>([])
  const [proveedores, setProveedores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroPlataforma, setFiltroPlataforma] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [editing, setEditing] = useState<Cuenta | null>(null)
  const [selected, setSelected] = useState<Cuenta | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)
  const [showPass, setShowPass] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
    fetchPlataformas()
    fetchProveedores()
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase
        .from('cuentas')
        .select('*, plataformas(nombre, icono, color), proveedores(nombre)')
        .order('created_at', { ascending: false })
      if (filtroPlataforma) q = q.eq('plataforma_id', filtroPlataforma)
      if (filtroEstado) q = q.eq('estado', filtroEstado)
      if (search) q = q.ilike('correo', `%${search}%`)
      const { data } = await q
      setCuentas(data || [])
    } finally {
      setLoading(false)
    }
  }, [search, filtroPlataforma, filtroEstado])

  useEffect(() => { fetchData() }, [fetchData])

  async function fetchPlataformas() {
    const { data } = await supabase.from('plataformas').select('*').eq('activa', true).order('nombre')
    setPlataformas(data || [])
  }
  async function fetchProveedores() {
    const { data } = await supabase.from('proveedores').select('*').eq('activo', true).order('nombre')
    setProveedores(data || [])
  }

  async function openDetail(c: Cuenta) {
    setSelected(c)
    const { data: perfiles } = await supabase
      .from('perfiles')
      .select('*, clientes(nombre)')
      .eq('cuenta_id', c.id)
      .order('numero_perfil')
    setSelected({ ...c, perfiles: perfiles || [] })
    setShowDetail(true)
  }

  function openNew() {
    setEditing(null)
    setForm(defaultForm)
    setShowModal(true)
  }

  function openEdit(c: Cuenta) {
    setEditing(c)
    setForm({
      plataforma_id: c.plataforma_id || '', proveedor_id: c.proveedor_id || '',
      correo: c.correo, contrasena: c.contrasena, pin: c.pin || '',
      tipo: c.tipo, max_perfiles: c.max_perfiles,
      fecha_compra: c.fecha_compra?.split('T')[0] || '',
      fecha_vencimiento: c.fecha_vencimiento?.split('T')[0] || '',
      costo: c.costo, notas: c.notas || '', estado: c.estado
    })
    setShowModal(true)
  }

  async function save() {
    if (!form.correo || !form.contrasena) return toast.error('Correo y contraseña son requeridos')
    if (!form.plataforma_id) return toast.error('Selecciona una plataforma')
    setSaving(true)
    try {
      // Auto-set max_perfiles from plataforma if creating new
      const plat = plataformas.find(p => p.id === form.plataforma_id)
      const maxPerfiles = editing ? form.max_perfiles : (plat?.max_perfiles || form.max_perfiles)

      if (editing) {
        const { error } = await supabase.from('cuentas').update({
          ...form, max_perfiles: maxPerfiles, updated_at: new Date().toISOString()
        }).eq('id', editing.id)
        if (error) throw error
        await supabase.from('movimientos').insert({ tipo: 'cuenta_editada', descripcion: `Cuenta ${form.correo} editada`, entidad: 'cuentas', entidad_id: editing.id })
        toast.success('Cuenta actualizada')
      } else {
        const { data, error } = await supabase.from('cuentas').insert({
          ...form, max_perfiles: maxPerfiles, perfiles_disponibles: maxPerfiles, perfiles_ocupados: 0
        }).select().single()
        if (error) throw error
        await supabase.from('movimientos').insert({ tipo: 'cuenta_creada', descripcion: `Nueva cuenta ${form.correo} (${plat?.nombre})`, entidad: 'cuentas', entidad_id: data.id, metadata: { plataforma: plat?.nombre, proveedor: proveedores.find(p => p.id === form.proveedor_id)?.nombre } })
        toast.success('Cuenta creada y perfiles generados automáticamente')
      }
      setShowModal(false)
      fetchData()
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function deleteCuenta(c: Cuenta) {
    if (!confirm(`¿Eliminar cuenta ${c.correo}? Esto eliminará también todos sus perfiles.`)) return
    const { error } = await supabase.from('cuentas').delete().eq('id', c.id)
    if (error) return toast.error('Error al eliminar: ' + error.message)
    toast.success('Cuenta eliminada')
    fetchData()
  }

  const estadoColors: Record<string, string> = {
    disponible: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    parcial: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    llena: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    vencida: 'bg-red-500/20 text-red-400 border-red-500/30',
    reportada: 'bg-red-500/20 text-red-400 border-red-500/30',
    suspendida: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  }

  return (
    <div className="space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title flex items-center gap-2"><Package size={22} /> Inventario de Cuentas</h1>
          <p className="section-subtitle">{cuentas.length} cuentas en stock</p>
        </div>
        <button onClick={openNew} className="btn-primary"><Plus size={16} /> Agregar Cuenta</button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {['disponible', 'parcial', 'llena', 'vencida'].map(estado => {
          const count = cuentas.filter(c => c.estado === estado).length
          return (
            <div key={estado} className="card text-center">
              <div className={cn('text-2xl font-bold', estado === 'disponible' ? 'text-emerald-400' : estado === 'parcial' ? 'text-blue-400' : estado === 'llena' ? 'text-orange-400' : 'text-red-400')}>{count}</div>
              <div className="text-xs text-slate-500 mt-0.5 capitalize">{estado}</div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9" placeholder="Buscar por correo..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select w-44" value={filtroPlataforma} onChange={e => setFiltroPlataforma(e.target.value)}>
          <option value="">Todas las plataformas</option>
          {plataformas.map(p => <option key={p.id} value={p.id}>{p.icono} {p.nombre}</option>)}
        </select>
        <select className="select w-36" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos</option>
          {['disponible', 'parcial', 'llena', 'vencida', 'reportada', 'suspendida'].map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Plataforma</th>
              <th>Correo</th>
              <th>Contraseña</th>
              <th>Proveedor</th>
              <th>Perfiles</th>
              <th>Vencimiento</th>
              <th>Costo</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-12 text-slate-500">Cargando...</td></tr>
            ) : cuentas.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-slate-500">No hay cuentas en inventario</td></tr>
            ) : cuentas.map(c => {
              const dias = diasRestantes(c.fecha_vencimiento)
              const tipoAlerta = getAlertaVencimiento(dias)
              return (
                <tr key={c.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{c.plataformas?.icono}</span>
                      <span className="text-slate-300 text-xs">{c.plataformas?.nombre}</span>
                    </div>
                  </td>
                  <td className="font-mono text-xs text-slate-300">{c.correo}</td>
                  <td>
                    <button
                      onClick={() => setShowPass(showPass === c.id ? null : c.id)}
                      className="font-mono text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
                    >
                      <Key size={12} />
                      {showPass === c.id ? c.contrasena : '••••••••'}
                    </button>
                  </td>
                  <td className="text-slate-400 text-xs">{c.proveedores?.nombre || '—'}</td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 rounded-full bg-[#1e2d42] w-16 overflow-hidden">
                        <div
                          className="h-full bg-sky-500 rounded-full"
                          style={{ width: `${(c.perfiles_ocupados / c.max_perfiles) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400">{c.perfiles_disponibles}/{c.max_perfiles}</span>
                    </div>
                  </td>
                  <td className={cn('text-xs', getAlertaColor(tipoAlerta))}>
                    {c.fecha_vencimiento ? formatDate(c.fecha_vencimiento) : '—'}
                  </td>
                  <td className="text-slate-400 text-xs">{formatCurrency(c.costo)}</td>
                  <td>
                    <span className={cn('badge text-[10px]', estadoColors[c.estado] || 'bg-slate-500/20 text-slate-400 border-slate-500/30')}>{c.estado}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openDetail(c)} className="btn-ghost btn-sm btn-icon"><Eye size={13} /></button>
                      <button onClick={() => openEdit(c)} className="btn-ghost btn-sm btn-icon"><Edit size={13} /></button>
                      <button onClick={() => deleteCuenta(c)} className="btn-ghost btn-sm btn-icon text-red-400"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Crear/Editar */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-semibold text-slate-200">{editing ? 'Editar Cuenta' : 'Nueva Cuenta'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200"><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Plataforma *</label>
                  <select className="select" value={form.plataforma_id} onChange={e => {
                    const plat = plataformas.find(p => p.id === e.target.value)
                    setForm(f => ({ ...f, plataforma_id: e.target.value, max_perfiles: plat?.max_perfiles || 5 }))
                  }}>
                    <option value="">Seleccionar...</option>
                    {plataformas.map(p => <option key={p.id} value={p.id}>{p.icono} {p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Proveedor</label>
                  <select className="select" value={form.proveedor_id} onChange={e => setForm(f => ({ ...f, proveedor_id: e.target.value }))}>
                    <option value="">Sin proveedor</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Correo de la cuenta *</label>
                <input className="input font-mono" placeholder="correo@ejemplo.com" value={form.correo} onChange={e => setForm(f => ({ ...f, correo: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Contraseña *</label>
                  <input className="input font-mono" placeholder="Contraseña" value={form.contrasena} onChange={e => setForm(f => ({ ...f, contrasena: e.target.value }))} />
                </div>
                <div>
                  <label className="label">PIN (opcional)</label>
                  <input className="input font-mono" placeholder="PIN" value={form.pin} onChange={e => setForm(f => ({ ...f, pin: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tipo</label>
                  <select className="select" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                    <option value="completa">Cuenta completa</option>
                    <option value="perfil_individual">Perfil individual</option>
                  </select>
                </div>
                <div>
                  <label className="label">Máx. perfiles</label>
                  <input className="input" type="number" min="1" max="10" value={form.max_perfiles} onChange={e => setForm(f => ({ ...f, max_perfiles: parseInt(e.target.value) || 1 }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Fecha compra</label>
                  <input className="input" type="date" value={form.fecha_compra} onChange={e => setForm(f => ({ ...f, fecha_compra: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Fecha vencimiento</label>
                  <input className="input" type="date" value={form.fecha_vencimiento} onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Costo (MXN)</label>
                  <input className="input" type="number" step="0.01" value={form.costo} onChange={e => setForm(f => ({ ...f, costo: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="label">Estado</label>
                  <select className="select" value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                    {['disponible', 'parcial', 'llena', 'vencida', 'reportada', 'suspendida'].map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Notas</label>
                <textarea className="input resize-none" rows={2} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
              </div>
              {!editing && (
                <div className="alert alert-info">
                  <Shield size={16} />
                  <span>Al crear la cuenta, se generarán automáticamente {form.max_perfiles} perfiles disponibles.</span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear Cuenta'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle */}
      {showDetail && selected && (
        <div className="modal-overlay" onClick={() => setShowDetail(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selected.plataformas?.icono}</span>
                <div>
                  <h2 className="font-semibold text-slate-200">{selected.plataformas?.nombre}</h2>
                  <div className="text-xs text-slate-400 font-mono">{selected.correo}</div>
                </div>
              </div>
              <button onClick={() => setShowDetail(false)} className="text-slate-400 hover:text-slate-200"><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-[#0f172a] border border-[#1e2d42]">
                  <div className="text-xs text-slate-500">Contraseña</div>
                  <div className="text-sm font-mono text-slate-300 mt-0.5">{selected.contrasena}</div>
                </div>
                {selected.pin && (
                  <div className="p-3 rounded-lg bg-[#0f172a] border border-[#1e2d42]">
                    <div className="text-xs text-slate-500">PIN</div>
                    <div className="text-sm font-mono text-slate-300 mt-0.5">{selected.pin}</div>
                  </div>
                )}
                <div className="p-3 rounded-lg bg-[#0f172a] border border-[#1e2d42]">
                  <div className="text-xs text-slate-500">Costo</div>
                  <div className="text-sm text-slate-300 mt-0.5">{formatCurrency(selected.costo)}</div>
                </div>
                <div className="p-3 rounded-lg bg-[#0f172a] border border-[#1e2d42]">
                  <div className="text-xs text-slate-500">Vencimiento</div>
                  <div className="text-sm text-slate-300 mt-0.5">{formatDate(selected.fecha_vencimiento)}</div>
                </div>
              </div>
              <div>
                <h3 className="font-medium text-slate-300 mb-3">Perfiles ({selected.perfiles?.length})</h3>
                <div className="grid grid-cols-2 gap-2">
                  {selected.perfiles?.map((p: any) => (
                    <div key={p.id} className={cn('p-3 rounded-lg border', p.estado === 'libre' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-[#0f172a] border-[#1e2d42]')}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-300">{p.nombre_perfil || `Perfil ${p.numero_perfil}`}</span>
                        <span className={cn('badge text-[10px]', getEstadoBadgeColor(p.estado))}>{p.estado}</span>
                      </div>
                      {p.clientes?.nombre && (
                        <div className="text-xs text-slate-500 mt-1">{p.clientes.nombre}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowDetail(false)} className="btn-secondary">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
