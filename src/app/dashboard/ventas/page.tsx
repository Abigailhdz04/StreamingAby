'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate, formatCurrency, diasRestantes, getAlertaVencimiento, getAlertaColor, getEstadoBadgeColor, cn } from '@/lib/utils'
import { ShoppingBag, Plus, Search, Eye, Edit, RefreshCw, X, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { addDays, format, parseISO } from 'date-fns'

interface Venta {
  id: string
  cliente_id: string
  cuenta_id: string
  perfil_id: string
  plataforma_id: string
  nombre_perfil_asignado: string
  duracion_dias: number
  fecha_inicio: string
  fecha_vencimiento: string
  precio_venta: number
  costo_real: number
  ganancia: number
  estado: string
  garantia_activa: boolean
  dias_consumidos: number
  dias_restantes: number
  notas: string
  clientes?: any
  cuentas?: any
  perfiles?: any
  plataformas?: any
}

export default function VentasPage() {
  const [ventas, setVentas] = useState<Venta[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroPlataforma, setFiltroPlataforma] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [selected, setSelected] = useState<Venta | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [clientes, setClientes] = useState<any[]>([])
  const [plataformas, setPlataformas] = useState<any[]>([])
  const [cuentasDisp, setCuentasDisp] = useState<any[]>([])
  const [perfilesDisp, setPerfilesDisp] = useState<any[]>([])
  const [form, setForm] = useState({
    cliente_id: '', plataforma_id: '', cuenta_id: '', perfil_id: '',
    nombre_perfil_asignado: '', duracion_dias: 30,
    fecha_inicio: new Date().toISOString().split('T')[0],
    precio_venta: 0, costo_real: 0, garantia_activa: true, notas: '',
    duracion_custom: false,
  })

  useEffect(() => { fetchVentas(); fetchCatalogos() }, [])

  const fetchVentas = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase.from('ventas')
        .select('*, clientes(nombre, whatsapp, telefono), cuentas(correo, contrasena), perfiles(nombre_perfil, numero_perfil), plataformas(nombre, icono, color)')
        .order('created_at', { ascending: false })
      if (filtroEstado) q = q.eq('estado', filtroEstado)
      if (search) {
        // Will search by client name via post-filter for now
      }
      const { data } = await q
      let filtered = data || []
      if (search) filtered = filtered.filter((v: any) => v.clientes?.nombre?.toLowerCase().includes(search.toLowerCase()))
      if (filtroPlataforma) filtered = filtered.filter((v: any) => v.plataforma_id === filtroPlataforma)
      setVentas(filtered)
    } finally {
      setLoading(false)
    }
  }, [search, filtroEstado, filtroPlataforma])

  useEffect(() => { fetchVentas() }, [fetchVentas])

  async function fetchCatalogos() {
    const [{ data: cls }, { data: plats }] = await Promise.all([
      supabase.from('clientes').select('*').eq('estado', 'activo').order('nombre'),
      supabase.from('plataformas').select('*').eq('activa', true).order('nombre'),
    ])
    setClientes(cls || [])
    setPlataformas(plats || [])
  }

  async function fetchCuentasDisponibles(plataforma_id: string) {
    const { data } = await supabase.from('cuentas')
      .select('*, plataformas(nombre, icono)')
      .eq('plataforma_id', plataforma_id)
      .in('estado', ['disponible', 'parcial'])
      .order('perfiles_disponibles', { ascending: false })
    setCuentasDisp(data || [])
  }

  async function fetchPerfilesDisponibles(cuenta_id: string) {
    const { data } = await supabase.from('perfiles')
      .select('*')
      .eq('cuenta_id', cuenta_id)
      .eq('estado', 'libre')
      .order('numero_perfil')
    setPerfilesDisp(data || [])
  }

  function calcularVencimiento() {
    const inicio = new Date(form.fecha_inicio + 'T12:00:00')
    return addDays(inicio, form.duracion_dias)
  }

  async function crearVenta() {
    if (!form.cliente_id) return toast.error('Selecciona un cliente')
    if (!form.cuenta_id) return toast.error('Selecciona una cuenta')
    if (!form.perfil_id) return toast.error('Selecciona un perfil')
    if (form.precio_venta <= 0) return toast.error('El precio de venta es requerido')

    setSaving(true)
    try {
      const fechaVencimiento = calcularVencimiento()
      const perfil = perfilesDisp.find(p => p.id === form.perfil_id)
      const cuenta = cuentasDisp.find(c => c.id === form.cuenta_id)
      const cliente = clientes.find(c => c.id === form.cliente_id)
      const plataforma = plataformas.find(p => p.id === form.plataforma_id)

      // Crear venta
      const { data: venta, error: ventaError } = await supabase.from('ventas').insert({
        cliente_id: form.cliente_id,
        cuenta_id: form.cuenta_id,
        perfil_id: form.perfil_id,
        plataforma_id: form.plataforma_id,
        nombre_perfil_asignado: form.nombre_perfil_asignado || perfil?.nombre_perfil,
        duracion_dias: form.duracion_dias,
        fecha_inicio: new Date(form.fecha_inicio + 'T12:00:00').toISOString(),
        fecha_vencimiento: fechaVencimiento.toISOString(),
        precio_venta: form.precio_venta,
        costo_real: form.costo_real,
        estado: 'activa',
        garantia_activa: form.garantia_activa,
        dias_restantes: form.duracion_dias,
        dias_consumidos: 0,
        notas: form.notas,
      }).select().single()

      if (ventaError) throw ventaError

      // Actualizar perfil - marcar como ocupado y asignar cliente
      const { error: perfilError } = await supabase.from('perfiles').update({
        estado: 'ocupado',
        cliente_id: form.cliente_id,
        nombre_perfil: form.nombre_perfil_asignado || perfil?.nombre_perfil,
        updated_at: new Date().toISOString(),
      }).eq('id', form.perfil_id)

      if (perfilError) throw perfilError

      // Actualizar estado cliente a activo
      await supabase.from('clientes').update({ estado: 'activo' }).eq('id', form.cliente_id)

      // Registrar movimiento
      await supabase.from('movimientos').insert({
        tipo: 'venta_creada',
        descripcion: `Venta: ${cliente?.nombre} → ${plataforma?.nombre} (${form.nombre_perfil_asignado || perfil?.nombre_perfil})`,
        entidad: 'ventas',
        entidad_id: venta.id,
        cliente_id: form.cliente_id,
        venta_id: venta.id,
        cuenta_id: form.cuenta_id,
        perfil_id: form.perfil_id,
        metadata: {
          cliente: cliente?.nombre,
          plataforma: plataforma?.nombre,
          perfil: form.nombre_perfil_asignado || perfil?.nombre_perfil,
          precio: form.precio_venta,
          vencimiento: fechaVencimiento.toISOString(),
        }
      })

      toast.success(`¡Venta creada! Vence el ${format(fechaVencimiento, 'dd/MM/yyyy')}`)
      setShowModal(false)
      setForm({ cliente_id: '', plataforma_id: '', cuenta_id: '', perfil_id: '', nombre_perfil_asignado: '', duracion_dias: 30, fecha_inicio: new Date().toISOString().split('T')[0], precio_venta: 0, costo_real: 0, garantia_activa: true, notas: '', duracion_custom: false })
      fetchVentas()
    } catch (e: any) {
      toast.error(e.message || 'Error al crear la venta')
    } finally {
      setSaving(false)
    }
  }

  async function cancelarVenta(v: Venta) {
    if (!confirm('¿Cancelar esta venta? El perfil quedará libre.')) return
    await supabase.from('ventas').update({ estado: 'cancelada' }).eq('id', v.id)
    await supabase.from('perfiles').update({ estado: 'libre', cliente_id: null }).eq('id', v.perfil_id)
    await supabase.from('movimientos').insert({ tipo: 'venta_cancelada', descripcion: `Venta cancelada: ${v.clientes?.nombre}`, entidad: 'ventas', entidad_id: v.id, cliente_id: v.cliente_id, venta_id: v.id })
    toast.success('Venta cancelada y perfil liberado')
    fetchVentas()
  }

  const vencimientoPreview = form.fecha_inicio && form.duracion_dias
    ? format(calcularVencimiento(), 'dd/MM/yyyy')
    : '—'

  return (
    <div className="space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title flex items-center gap-2"><ShoppingBag size={22} /> Ventas</h1>
          <p className="section-subtitle">{ventas.length} ventas · {ventas.filter(v => v.estado === 'activa').length} activas</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={16} /> Nueva Venta</button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Activas', count: ventas.filter(v => v.estado === 'activa').length, color: 'text-emerald-400' },
          { label: 'Vencidas', count: ventas.filter(v => v.estado === 'vencida').length, color: 'text-red-400' },
          { label: 'En Garantía', count: ventas.filter(v => v.estado === 'en_garantia').length, color: 'text-purple-400' },
          { label: 'Renovadas', count: ventas.filter(v => v.estado === 'renovada').length, color: 'text-blue-400' },
        ].map(s => (
          <div key={s.label} className="card text-center">
            <div className={cn('text-2xl font-bold', s.color)}>{s.count}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9" placeholder="Buscar por cliente..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select w-40" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos</option>
          {['activa', 'vencida', 'en_garantia', 'repuesta', 'renovada', 'cancelada'].map(e => <option key={e} value={e}>{e}</option>)}
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
              <th>Cliente</th>
              <th>Plataforma</th>
              <th>Perfil Asignado</th>
              <th>Cuenta</th>
              <th>Precio</th>
              <th>Ganancia</th>
              <th>Inicio</th>
              <th>Vencimiento</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="text-center py-12 text-slate-500">Cargando...</td></tr>
            ) : ventas.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-12 text-slate-500">No hay ventas</td></tr>
            ) : ventas.map(v => {
              const dias = diasRestantes(v.fecha_vencimiento)
              const tipo = getAlertaVencimiento(dias)
              return (
                <tr key={v.id}>
                  <td>
                    <div className="font-medium text-slate-200">{v.clientes?.nombre || '—'}</div>
                    {v.clientes?.whatsapp && (
                      <a href={`https://wa.me/${v.clientes.whatsapp}`} target="_blank" className="text-xs text-emerald-400 hover:underline">WhatsApp</a>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="text-base">{v.plataformas?.icono}</span>
                      <span className="text-xs text-slate-400">{v.plataformas?.nombre}</span>
                    </div>
                  </td>
                  <td className="text-slate-300 text-sm">{v.nombre_perfil_asignado || v.perfiles?.nombre_perfil || '—'}</td>
                  <td className="font-mono text-xs text-slate-500">{v.cuentas?.correo ? v.cuentas.correo.substring(0, 20) + '...' : '—'}</td>
                  <td className="text-emerald-400 font-medium">{formatCurrency(v.precio_venta)}</td>
                  <td className="text-sky-400 font-medium">{formatCurrency(v.ganancia)}</td>
                  <td className="text-xs text-slate-400">{formatDate(v.fecha_inicio)}</td>
                  <td className={cn('font-medium text-sm', getAlertaColor(tipo))}>
                    <div>{formatDate(v.fecha_vencimiento)}</div>
                    <div className="text-xs">
                      {dias < 0 ? 'Vencida' : dias === 0 ? '¡Hoy!' : `${dias} días`}
                    </div>
                  </td>
                  <td>
                    <span className={cn('badge text-[10px]', getEstadoBadgeColor(v.estado))}>{v.estado}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setSelected(v); setShowDetail(true) }} className="btn-ghost btn-sm btn-icon"><Eye size={13} /></button>
                      {v.estado === 'activa' && (
                        <button onClick={() => cancelarVenta(v)} className="btn-ghost btn-sm btn-icon text-red-400" title="Cancelar"><X size={13} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Nueva Venta */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-semibold text-slate-200">Nueva Venta</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200"><X size={18} /></button>
            </div>
            <div className="modal-body">
              {/* Cliente */}
              <div>
                <label className="label">Cliente *</label>
                <select className="select" value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}>
                  <option value="">Seleccionar cliente...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>

              {/* Plataforma */}
              <div>
                <label className="label">Plataforma *</label>
                <select className="select" value={form.plataforma_id} onChange={e => {
                  setForm(f => ({ ...f, plataforma_id: e.target.value, cuenta_id: '', perfil_id: '' }))
                  if (e.target.value) fetchCuentasDisponibles(e.target.value)
                  setCuentasDisp([])
                  setPerfilesDisp([])
                }}>
                  <option value="">Seleccionar plataforma...</option>
                  {plataformas.map(p => <option key={p.id} value={p.id}>{p.icono} {p.nombre}</option>)}
                </select>
              </div>

              {/* Cuenta */}
              {form.plataforma_id && (
                <div>
                  <label className="label">Cuenta disponible *</label>
                  {cuentasDisp.length === 0 ? (
                    <div className="alert alert-warning"><AlertTriangle size={16} /><span>No hay cuentas disponibles para esta plataforma</span></div>
                  ) : (
                    <select className="select" value={form.cuenta_id} onChange={e => {
                      const cuenta = cuentasDisp.find(c => c.id === e.target.value)
                      setForm(f => ({ ...f, cuenta_id: e.target.value, perfil_id: '', costo_real: cuenta?.costo / cuenta?.max_perfiles || 0 }))
                      if (e.target.value) fetchPerfilesDisponibles(e.target.value)
                      setPerfilesDisp([])
                    }}>
                      <option value="">Seleccionar cuenta...</option>
                      {cuentasDisp.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.correo} — {c.perfiles_disponibles}/{c.max_perfiles} libres
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Perfil */}
              {form.cuenta_id && (
                <div>
                  <label className="label">Perfil *</label>
                  {perfilesDisp.length === 0 ? (
                    <div className="alert alert-danger"><AlertTriangle size={16} /><span>No hay perfiles libres en esta cuenta</span></div>
                  ) : (
                    <select className="select" value={form.perfil_id} onChange={e => {
                      const p = perfilesDisp.find(p => p.id === e.target.value)
                      setForm(f => ({ ...f, perfil_id: e.target.value, nombre_perfil_asignado: p?.nombre_perfil || `Perfil ${p?.numero_perfil}` }))
                    }}>
                      <option value="">Seleccionar perfil...</option>
                      {perfilesDisp.map(p => <option key={p.id} value={p.id}>{p.nombre_perfil || `Perfil ${p.numero_perfil}`}</option>)}
                    </select>
                  )}
                </div>
              )}

              {/* Nombre perfil */}
              {form.perfil_id && (
                <div>
                  <label className="label">Nombre del perfil asignado</label>
                  <input
                    className="input"
                    placeholder="Ej: JUAN, 001, María, etc."
                    value={form.nombre_perfil_asignado}
                    onChange={e => setForm(f => ({ ...f, nombre_perfil_asignado: e.target.value }))}
                  />
                  <p className="text-xs text-slate-500 mt-1">Nombre o número con el que identificarás este perfil para el cliente</p>
                </div>
              )}

              {/* Duración */}
              <div>
                <label className="label">Duración</label>
                <div className="flex gap-2 mb-2">
                  {[30, 60, 90].map(d => (
                    <button
                      key={d}
                      onClick={() => setForm(f => ({ ...f, duracion_dias: d, duracion_custom: false }))}
                      className={cn('btn btn-sm flex-1', form.duracion_dias === d && !form.duracion_custom ? 'btn-primary' : 'btn-secondary')}
                    >
                      {d} días
                    </button>
                  ))}
                  <button
                    onClick={() => setForm(f => ({ ...f, duracion_custom: true }))}
                    className={cn('btn btn-sm flex-1', form.duracion_custom ? 'btn-primary' : 'btn-secondary')}
                  >
                    Custom
                  </button>
                </div>
                {form.duracion_custom && (
                  <input className="input" type="number" min="1" max="365" placeholder="Días personalizados" value={form.duracion_dias} onChange={e => setForm(f => ({ ...f, duracion_dias: parseInt(e.target.value) || 30 }))} />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Fecha inicio</label>
                  <input className="input" type="date" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} />
                </div>
                <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/20">
                  <div className="text-xs text-sky-400">Fecha vencimiento</div>
                  <div className="text-base font-bold text-sky-300 mt-1">{vencimientoPreview}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Precio de venta (MXN) *</label>
                  <input className="input" type="number" step="0.01" placeholder="0.00" value={form.precio_venta || ''} onChange={e => setForm(f => ({ ...f, precio_venta: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="label">Costo real (MXN)</label>
                  <input className="input" type="number" step="0.01" placeholder="0.00" value={form.costo_real || ''} onChange={e => setForm(f => ({ ...f, costo_real: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>

              {form.precio_venta > 0 && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-xs text-emerald-400">Ganancia estimada</div>
                  <div className="text-lg font-bold text-emerald-300">{formatCurrency(form.precio_venta - form.costo_real)}</div>
                </div>
              )}

              <div>
                <label className="label">Notas (opcional)</label>
                <textarea className="input resize-none" rows={2} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={crearVenta} disabled={saving} className="btn-primary">
                {saving ? 'Creando...' : '✓ Crear Venta'}
              </button>
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
                  <h2 className="font-semibold text-slate-200">{selected.clientes?.nombre}</h2>
                  <div className="text-xs text-slate-400">{selected.plataformas?.nombre} · {selected.nombre_perfil_asignado || selected.perfiles?.nombre_perfil}</div>
                </div>
              </div>
              <button onClick={() => setShowDetail(false)} className="text-slate-400 hover:text-slate-200"><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-[#0f172a] border border-[#1e2d42]">
                  <div className="text-xs text-slate-500">Cuenta</div>
                  <div className="text-sm font-mono text-slate-300">{selected.cuentas?.correo}</div>
                </div>
                <div className="p-3 rounded-lg bg-[#0f172a] border border-[#1e2d42]">
                  <div className="text-xs text-slate-500">Contraseña</div>
                  <div className="text-sm font-mono text-slate-300">{selected.cuentas?.contrasena}</div>
                </div>
                <div className="p-3 rounded-lg bg-[#0f172a] border border-[#1e2d42]">
                  <div className="text-xs text-slate-500">Inicio</div>
                  <div className="text-sm text-slate-300">{formatDate(selected.fecha_inicio)}</div>
                </div>
                <div className="p-3 rounded-lg bg-[#0f172a] border border-[#1e2d42]">
                  <div className="text-xs text-slate-500">Vencimiento</div>
                  <div className={cn('text-sm font-bold', getAlertaColor(getAlertaVencimiento(diasRestantes(selected.fecha_vencimiento))))}>
                    {formatDate(selected.fecha_vencimiento)}
                    <span className="text-xs ml-1">({diasRestantes(selected.fecha_vencimiento)} días)</span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[#0f172a] border border-[#1e2d42]">
                  <div className="text-xs text-slate-500">Precio venta</div>
                  <div className="text-sm text-emerald-400 font-medium">{formatCurrency(selected.precio_venta)}</div>
                </div>
                <div className="p-3 rounded-lg bg-[#0f172a] border border-[#1e2d42]">
                  <div className="text-xs text-slate-500">Ganancia</div>
                  <div className="text-sm text-sky-400 font-medium">{formatCurrency(selected.ganancia)}</div>
                </div>
              </div>
              {selected.notas && (
                <div className="p-3 rounded-lg bg-[#0f172a] border border-[#1e2d42]">
                  <div className="text-xs text-slate-500 mb-1">Notas</div>
                  <div className="text-sm text-slate-300">{selected.notas}</div>
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('badge', getEstadoBadgeColor(selected.estado))}>{selected.estado}</span>
                {selected.garantia_activa && <span className="badge bg-purple-500/20 text-purple-400 border-purple-500/30">Garantía activa</span>}
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
