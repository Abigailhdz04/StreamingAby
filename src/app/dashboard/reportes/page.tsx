'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate, formatDateTime, getEstadoBadgeColor, cn, diasRestantes } from '@/lib/utils'
import { AlertTriangle, Plus, Search, Eye, CheckCircle, X, Clock, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { differenceInDays, parseISO } from 'date-fns'

const TIPOS_REPORTE = [
  'contrasena_cambiada', 'pantalla_llena', 'perfil_eliminado', 'correo_cambiado',
  'pin_cambiado', 'bloqueo', 'region_incorrecta', 'cuenta_caida', 'error_plataforma',
  'usuario_expulsado', 'otro'
]

export default function ReportesPage() {
  const [reportes, setReportes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showReposicion, setShowReposicion] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  // Catálogos
  const [ventas, setVentas] = useState<any[]>([])
  const [cuentasDisp, setCuentasDisp] = useState<any[]>([])
  const [perfilesDisp, setPerfilesDisp] = useState<any[]>([])

  const [form, setForm] = useState({
    venta_id: '', tipo: 'cuenta_caida', descripcion: '', evidencia: '',
    fecha_falla: new Date().toISOString().split('T')[0],
  })

  const [reposForm, setReposForm] = useState({
    cuenta_nueva_id: '', perfil_nuevo_id: '', nombre_perfil_nuevo: '', notas: ''
  })

  const fetchReportes = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase.from('reportes')
        .select('*, clientes(nombre, whatsapp), cuentas(correo), perfiles(nombre_perfil), plataformas(nombre, icono), proveedores(nombre), ventas(fecha_inicio, fecha_vencimiento, duracion_dias, dias_restantes)')
        .order('created_at', { ascending: false })
      if (filtroEstado) q = q.eq('estado', filtroEstado)
      const { data } = await q
      let filtered = data || []
      if (search) filtered = filtered.filter((r: any) => r.clientes?.nombre?.toLowerCase().includes(search.toLowerCase()))
      setReportes(filtered)
    } finally {
      setLoading(false)
    }
  }, [search, filtroEstado])

  useEffect(() => { fetchReportes() }, [fetchReportes])

  useEffect(() => {
    const fetchVentas = async () => {
      const { data } = await supabase.from('ventas')
        .select('*, clientes(nombre), plataformas(nombre, icono), cuentas(correo), perfiles(nombre_perfil)')
        .eq('estado', 'activa')
        .order('created_at', { ascending: false })
      setVentas(data || [])
    }
    fetchVentas()
  }, [])

  async function crearReporte() {
    if (!form.venta_id) return toast.error('Selecciona una venta')
    if (!form.tipo) return toast.error('Selecciona el tipo de reporte')
    setSaving(true)
    try {
      const venta = ventas.find(v => v.id === form.venta_id)
      const fechaFalla = new Date(form.fecha_falla + 'T12:00:00')
      const fechaInicio = parseISO(venta.fecha_inicio)
      const diasConsumidos = Math.max(0, differenceInDays(fechaFalla, fechaInicio))
      const diasRestantesVal = Math.max(0, (venta.duracion_dias || 30) - diasConsumidos)

      // Crear reporte
      const { data: reporte, error } = await supabase.from('reportes').insert({
        venta_id: form.venta_id,
        cliente_id: venta.cliente_id,
        cuenta_id: venta.cuenta_id,
        perfil_id: venta.perfil_id,
        plataforma_id: venta.plataforma_id,
        proveedor_id: null,
        tipo: form.tipo,
        descripcion: form.descripcion,
        evidencia: form.evidencia,
        fecha_falla: fechaFalla.toISOString(),
        fecha_reporte: new Date().toISOString(),
        dias_consumidos_al_fallo: diasConsumidos,
        dias_restantes_al_fallo: diasRestantesVal,
        estado: 'pendiente',
      }).select().single()

      if (error) throw error

      // Actualizar venta a en_garantia y pausar
      await supabase.from('ventas').update({
        estado: 'en_garantia',
        fecha_pausa: new Date().toISOString(),
        dias_consumidos: diasConsumidos,
        dias_restantes: diasRestantesVal,
      }).eq('id', form.venta_id)

      // Marcar perfil como reportado
      if (venta.perfil_id) {
        await supabase.from('perfiles').update({ estado: 'reportado' }).eq('id', venta.perfil_id)
      }

      await supabase.from('movimientos').insert({
        tipo: 'reporte_creado',
        descripcion: `Reporte creado: ${form.tipo} — ${venta.clientes?.nombre} (${diasRestantesVal} días restantes)`,
        entidad: 'reportes', entidad_id: reporte.id,
        cliente_id: venta.cliente_id, venta_id: form.venta_id,
        metadata: { tipo: form.tipo, diasRestantes: diasRestantesVal, diasConsumidos }
      })

      toast.success(`Reporte creado. ${diasRestantesVal} días restantes para reposición.`)
      setShowModal(false)
      setForm({ venta_id: '', tipo: 'cuenta_caida', descripcion: '', evidencia: '', fecha_falla: new Date().toISOString().split('T')[0] })
      fetchReportes()
    } catch (e: any) {
      toast.error(e.message || 'Error al crear reporte')
    } finally {
      setSaving(false)
    }
  }

  async function abrirReposicion(reporte: any) {
    setSelected(reporte)
    setReposForm({ cuenta_nueva_id: '', perfil_nuevo_id: '', nombre_perfil_nuevo: '', notas: '' })
    // Cargar cuentas disponibles de la misma plataforma
    const { data } = await supabase.from('cuentas')
      .select('*, plataformas(nombre)')
      .eq('plataforma_id', reporte.plataformas?.id || '')
      .in('estado', ['disponible', 'parcial'])
    // If no plataforma_id on report, load all
    if (!data || data.length === 0) {
      const { data: all } = await supabase.from('cuentas').select('*, plataformas(nombre)').in('estado', ['disponible', 'parcial'])
      setCuentasDisp(all || [])
    } else {
      setCuentasDisp(data)
    }
    setShowReposicion(true)
  }

  async function ejecutarReposicion() {
    if (!reposForm.cuenta_nueva_id || !reposForm.perfil_nuevo_id) return toast.error('Selecciona cuenta y perfil para la reposición')
    setSaving(true)
    try {
      const venta = selected.ventas
      const diasRestantesVal = selected.dias_restantes_al_fallo
      const ahora = new Date()

      // Calcular días pausados
      const fechaPausa = venta?.fecha_pausa ? parseISO(venta.fecha_pausa) : ahora
      const diasPausados = Math.max(0, differenceInDays(ahora, fechaPausa))

      // Nueva fecha vencimiento = hoy + días restantes
      const nuevaFechaVencimiento = new Date()
      nuevaFechaVencimiento.setDate(nuevaFechaVencimiento.getDate() + diasRestantesVal)

      // Liberar perfil anterior
      if (selected.perfil_id) {
        await supabase.from('perfiles').update({ estado: 'libre', cliente_id: null }).eq('id', selected.perfil_id)
      }

      // Ocupar nuevo perfil
      await supabase.from('perfiles').update({
        estado: 'ocupado',
        cliente_id: selected.cliente_id,
        nombre_perfil: reposForm.nombre_perfil_nuevo || undefined,
      }).eq('id', reposForm.perfil_nuevo_id)

      // Actualizar venta
      await supabase.from('ventas').update({
        estado: 'repuesta',
        cuenta_id: reposForm.cuenta_nueva_id,
        perfil_id: reposForm.perfil_nuevo_id,
        nombre_perfil_asignado: reposForm.nombre_perfil_nuevo || undefined,
        fecha_vencimiento: nuevaFechaVencimiento.toISOString(),
        fecha_pausa: null,
        total_dias_pausados: diasPausados,
      }).eq('id', selected.venta_id)

      // Crear reposición
      const { data: repos } = await supabase.from('reposiciones').insert({
        reporte_id: selected.id,
        venta_original_id: selected.venta_id,
        cliente_id: selected.cliente_id,
        cuenta_anterior_id: selected.cuenta_id,
        cuenta_nueva_id: reposForm.cuenta_nueva_id,
        perfil_anterior_id: selected.perfil_id,
        perfil_nuevo_id: reposForm.perfil_nuevo_id,
        dias_restantes: diasRestantesVal,
        dias_pausados: diasPausados,
        fecha_falla: selected.fecha_falla,
        fecha_reposicion: ahora.toISOString(),
        nueva_fecha_vencimiento: nuevaFechaVencimiento.toISOString(),
        notas: reposForm.notas,
      }).select().single()

      // Marcar reporte como solucionado
      await supabase.from('reportes').update({ estado: 'solucionado', fecha_solucion: ahora.toISOString() }).eq('id', selected.id)

      await supabase.from('movimientos').insert({
        tipo: 'reposicion_realizada',
        descripcion: `Reposición: ${selected.clientes?.nombre} — ${diasRestantesVal} días restantes. Nueva fecha: ${nuevaFechaVencimiento.toLocaleDateString('es')}`,
        entidad: 'reposiciones', entidad_id: repos?.id,
        cliente_id: selected.cliente_id, venta_id: selected.venta_id,
        metadata: { diasRestantes: diasRestantesVal, diasPausados, nuevaFecha: nuevaFechaVencimiento.toISOString() }
      })

      toast.success(`✅ Reposición exitosa. Nueva fecha de vencimiento: ${nuevaFechaVencimiento.toLocaleDateString('es')}`)
      setShowReposicion(false)
      fetchReportes()
    } catch (e: any) {
      toast.error(e.message || 'Error en reposición')
    } finally {
      setSaving(false)
    }
  }

  async function cancelarReporte(reporte: any) {
    if (!confirm('¿Cancelar este reporte?')) return
    await supabase.from('reportes').update({ estado: 'cancelado' }).eq('id', reporte.id)
    // Reactivar venta
    if (reporte.venta_id) {
      await supabase.from('ventas').update({ estado: 'activa', fecha_pausa: null }).eq('id', reporte.venta_id)
      if (reporte.perfil_id) await supabase.from('perfiles').update({ estado: 'ocupado' }).eq('id', reporte.perfil_id)
    }
    toast.success('Reporte cancelado')
    fetchReportes()
  }

  return (
    <div className="space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title flex items-center gap-2"><AlertTriangle size={22} /> Reportes</h1>
          <p className="section-subtitle">{reportes.filter(r => r.estado === 'pendiente').length} pendientes</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={16} /> Nuevo Reporte</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pendientes', count: reportes.filter(r => r.estado === 'pendiente').length, color: 'text-yellow-400', icon: Clock },
          { label: 'Solucionados', count: reportes.filter(r => r.estado === 'solucionado').length, color: 'text-emerald-400', icon: CheckCircle },
          { label: 'Cancelados', count: reportes.filter(r => r.estado === 'cancelado').length, color: 'text-slate-400', icon: X },
        ].map(s => (
          <div key={s.label} className="card flex items-center gap-3">
            <s.icon size={20} className={s.color} />
            <div>
              <div className={cn('text-xl font-bold', s.color)}>{s.count}</div>
              <div className="text-xs text-slate-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9" placeholder="Buscar por cliente..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select w-36" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos</option>
          <option value="pendiente">Pendiente</option>
          <option value="solucionado">Solucionado</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Plataforma</th>
              <th>Tipo</th>
              <th>Días restantes</th>
              <th>Fecha reporte</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-500">Cargando...</td></tr>
            ) : reportes.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-500">No hay reportes</td></tr>
            ) : reportes.map(r => (
              <tr key={r.id}>
                <td>
                  <div className="font-medium text-slate-200">{r.clientes?.nombre || '—'}</div>
                  {r.clientes?.whatsapp && <a href={`https://wa.me/${r.clientes.whatsapp}`} target="_blank" className="text-xs text-emerald-400">WhatsApp</a>}
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <span>{r.plataformas?.icono}</span>
                    <span className="text-xs text-slate-400">{r.plataformas?.nombre}</span>
                  </div>
                </td>
                <td>
                  <span className="text-xs text-slate-300 bg-[#1e2d42] px-2 py-1 rounded">{r.tipo.replace(/_/g, ' ')}</span>
                </td>
                <td>
                  <span className="text-yellow-400 font-bold">{r.dias_restantes_al_fallo} días</span>
                </td>
                <td className="text-xs text-slate-400">{formatDate(r.fecha_reporte)}</td>
                <td>
                  <span className={cn('badge text-[10px]', getEstadoBadgeColor(r.estado))}>{r.estado}</span>
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    {r.estado === 'pendiente' && (
                      <>
                        <button onClick={() => abrirReposicion(r)} className="btn-success btn-sm" title="Hacer reposición">
                          <RefreshCw size={13} /> Reponer
                        </button>
                        <button onClick={() => cancelarReporte(r)} className="btn-ghost btn-sm btn-icon text-red-400"><X size={13} /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Nuevo Reporte */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-semibold text-slate-200">Nuevo Reporte</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200"><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div>
                <label className="label">Venta afectada *</label>
                <select className="select" value={form.venta_id} onChange={e => setForm(f => ({ ...f, venta_id: e.target.value }))}>
                  <option value="">Seleccionar venta activa...</option>
                  {ventas.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.clientes?.nombre} — {v.plataformas?.icono} {v.plataformas?.nombre} ({v.perfiles?.nombre_perfil})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Tipo de problema *</label>
                <select className="select" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                  {TIPOS_REPORTE.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Fecha de la falla</label>
                <input className="input" type="date" value={form.fecha_falla} onChange={e => setForm(f => ({ ...f, fecha_falla: e.target.value }))} />
              </div>
              <div>
                <label className="label">Descripción</label>
                <textarea className="input resize-none" rows={3} placeholder="Describe el problema..." value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
              </div>
              <div className="alert alert-warning">
                <AlertTriangle size={16} />
                <span>Al crear el reporte, la venta quedará <strong>en garantía</strong> y el tiempo se congelará hasta la reposición.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={crearReporte} disabled={saving} className="btn-primary">{saving ? 'Creando...' : 'Crear Reporte'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reposición */}
      {showReposicion && selected && (
        <div className="modal-overlay" onClick={() => setShowReposicion(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-semibold text-slate-200">Hacer Reposición</h2>
              <button onClick={() => setShowReposicion(false)} className="text-slate-400 hover:text-slate-200"><X size={18} /></button>
            </div>
            <div className="modal-body">
              {/* Info del reporte */}
              <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 space-y-1">
                <div className="text-sm font-medium text-yellow-300">Detalles del reporte</div>
                <div className="text-xs text-yellow-400">Cliente: <strong>{selected.clientes?.nombre}</strong></div>
                <div className="text-xs text-yellow-400">Cuenta anterior: <strong className="font-mono">{selected.cuentas?.correo}</strong></div>
                <div className="text-xs text-yellow-400">Días restantes: <strong>{selected.dias_restantes_al_fallo} días</strong></div>
                <div className="text-xs text-yellow-400 mt-2 font-medium">
                  ⚠️ La nueva cuenta tendrá exactamente {selected.dias_restantes_al_fallo} días (NO 30 nuevos)
                </div>
              </div>

              {/* Nueva cuenta */}
              <div>
                <label className="label">Nueva cuenta *</label>
                {cuentasDisp.length === 0 ? (
                  <div className="alert alert-danger"><AlertTriangle size={16} /><span>No hay cuentas disponibles de la misma plataforma</span></div>
                ) : (
                  <select className="select" value={reposForm.cuenta_nueva_id} onChange={async e => {
                    setReposForm(f => ({ ...f, cuenta_nueva_id: e.target.value, perfil_nuevo_id: '' }))
                    if (e.target.value) {
                      const { data } = await supabase.from('perfiles').select('*').eq('cuenta_id', e.target.value).eq('estado', 'libre').order('numero_perfil')
                      setPerfilesDisp(data || [])
                    }
                  }}>
                    <option value="">Seleccionar cuenta...</option>
                    {cuentasDisp.map(c => <option key={c.id} value={c.id}>{c.correo} — {c.perfiles_disponibles} libres</option>)}
                  </select>
                )}
              </div>

              {/* Nuevo perfil */}
              {reposForm.cuenta_nueva_id && (
                <div>
                  <label className="label">Nuevo perfil *</label>
                  {perfilesDisp.length === 0 ? (
                    <div className="alert alert-danger"><AlertTriangle size={16} /><span>No hay perfiles libres</span></div>
                  ) : (
                    <select className="select" value={reposForm.perfil_nuevo_id} onChange={e => setReposForm(f => ({ ...f, perfil_nuevo_id: e.target.value }))}>
                      <option value="">Seleccionar perfil...</option>
                      {perfilesDisp.map(p => <option key={p.id} value={p.id}>{p.nombre_perfil || `Perfil ${p.numero_perfil}`}</option>)}
                    </select>
                  )}
                </div>
              )}

              {/* Nombre perfil */}
              <div>
                <label className="label">Nombre del nuevo perfil</label>
                <input className="input" placeholder="Ej: JUAN, 001..." value={reposForm.nombre_perfil_nuevo} onChange={e => setReposForm(f => ({ ...f, nombre_perfil_nuevo: e.target.value }))} />
              </div>

              <div>
                <label className="label">Notas</label>
                <textarea className="input resize-none" rows={2} value={reposForm.notas} onChange={e => setReposForm(f => ({ ...f, notas: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowReposicion(false)} className="btn-secondary">Cancelar</button>
              <button onClick={ejecutarReposicion} disabled={saving} className="btn-success">
                {saving ? 'Procesando...' : '✓ Ejecutar Reposición'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
