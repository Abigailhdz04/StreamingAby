'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate, formatCurrency, diasRestantes, getAlertaVencimiento, getAlertaColor, cn } from '@/lib/utils'
import { RefreshCw, Plus, Search, X, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { addDays, format } from 'date-fns'

export default function RenovacionesPage() {
  const [ventas, setVentas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ dias: 30, precio: 0, costo: 0, notas: '', tipo: 'mismo_perfil' })
  const [nuevaCuenta, setNuevaCuenta] = useState('')
  const [nuevoPerfil, setNuevoPerfil] = useState('')
  const [cuentasDisp, setCuentasDisp] = useState<any[]>([])
  const [perfilesDisp, setPerfilesDisp] = useState<any[]>([])

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      const { data } = await supabase.from('ventas')
        .select('*, clientes(nombre, whatsapp, telefono), plataformas(nombre, icono, color), perfiles(nombre_perfil), cuentas(correo)')
        .in('estado', ['activa', 'vencida'])
        .order('fecha_vencimiento', { ascending: true })
      let filtered = data || []
      if (search) filtered = filtered.filter((v: any) => v.clientes?.nombre?.toLowerCase().includes(search.toLowerCase()))
      setVentas(filtered)
      setLoading(false)
    }
    fetch()
  }, [search])

  async function abrirRenovacion(venta: any) {
    setSelected(venta)
    setForm({ dias: 30, precio: venta.precio_venta || 0, costo: venta.costo_real || 0, notas: '', tipo: 'mismo_perfil' })
    setNuevaCuenta('')
    setNuevoPerfil('')
    // Cargar cuentas disponibles
    const { data } = await supabase.from('cuentas').select('*, plataformas(nombre)').eq('plataforma_id', venta.plataforma_id).in('estado', ['disponible', 'parcial'])
    setCuentasDisp(data || [])
    setShowModal(true)
  }

  async function ejecutarRenovacion() {
    if (form.precio <= 0) return toast.error('Ingresa el precio de renovación')
    setSaving(true)
    try {
      const venceActual = selected.fecha_vencimiento
      const base = new Date(venceActual)
      const ahora = new Date()
      // Si ya venció, extender desde hoy
      const baseReal = base < ahora ? ahora : base
      const nuevaFecha = addDays(baseReal, form.dias)

      const updates: any = {
        estado: 'renovada',
        fecha_vencimiento: nuevaFecha.toISOString(),
        duracion_dias: (selected.duracion_dias || 30) + form.dias,
        precio_venta: form.precio,
        costo_real: form.costo,
        dias_restantes: form.dias,
      }

      if (form.tipo === 'nueva_cuenta' && nuevoPerfil) {
        // Liberar perfil anterior
        if (selected.perfil_id) await supabase.from('perfiles').update({ estado: 'libre', cliente_id: null }).eq('id', selected.perfil_id)
        // Ocupar nuevo perfil
        await supabase.from('perfiles').update({ estado: 'ocupado', cliente_id: selected.cliente_id }).eq('id', nuevoPerfil)
        updates.cuenta_id = nuevaCuenta
        updates.perfil_id = nuevoPerfil
      }

      await supabase.from('ventas').update(updates).eq('id', selected.id)

      // Registrar renovación
      await supabase.from('renovaciones').insert({
        venta_id: selected.id,
        cliente_id: selected.cliente_id,
        cuenta_id: form.tipo === 'nueva_cuenta' ? nuevaCuenta : selected.cuenta_id,
        perfil_id: form.tipo === 'nueva_cuenta' ? nuevoPerfil : selected.perfil_id,
        plataforma_id: selected.plataforma_id,
        dias_renovados: form.dias,
        fecha_anterior_vencimiento: venceActual,
        nueva_fecha_vencimiento: nuevaFecha.toISOString(),
        precio_renovacion: form.precio,
        costo_real: form.costo,
        tipo: form.tipo,
        notas: form.notas,
      })

      await supabase.from('movimientos').insert({
        tipo: 'renovacion_realizada',
        descripcion: `Renovación: ${selected.clientes?.nombre} — ${selected.plataformas?.nombre} (+${form.dias} días)`,
        entidad: 'renovaciones',
        cliente_id: selected.cliente_id,
        venta_id: selected.id,
        metadata: { dias: form.dias, nuevaFecha: nuevaFecha.toISOString(), precio: form.precio }
      })

      toast.success(`✅ Renovación exitosa. Nueva fecha: ${format(nuevaFecha, 'dd/MM/yyyy')}`)
      setShowModal(false)
      // Refresh
      const { data } = await supabase.from('ventas')
        .select('*, clientes(nombre, whatsapp, telefono), plataformas(nombre, icono, color), perfiles(nombre_perfil), cuentas(correo)')
        .in('estado', ['activa', 'vencida']).order('fecha_vencimiento', { ascending: true })
      setVentas(data || [])
    } catch (e: any) {
      toast.error(e.message || 'Error en renovación')
    } finally {
      setSaving(false)
    }
  }

  const nuevaFechaPreview = selected && form.dias
    ? format(addDays(new Date(selected.fecha_vencimiento) < new Date() ? new Date() : new Date(selected.fecha_vencimiento), form.dias), 'dd/MM/yyyy')
    : '—'

  return (
    <div className="space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title flex items-center gap-2"><RefreshCw size={22} /> Renovaciones</h1>
          <p className="section-subtitle">Gestiona las renovaciones de clientes</p>
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
              <th>Plataforma</th>
              <th>Perfil</th>
              <th>Vencimiento</th>
              <th>Días restantes</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-[var(--text-3)]">Cargando...</td></tr>
            ) : ventas.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-[var(--text-3)]">No hay ventas</td></tr>
            ) : ventas.map(v => {
              const dias = diasRestantes(v.fecha_vencimiento)
              const tipo = getAlertaVencimiento(dias)
              return (
                <tr key={v.id}>
                  <td>
                    <div className="font-medium text-[var(--text)]">{v.clientes?.nombre}</div>
                    {v.clientes?.whatsapp && <a href={`https://wa.me/${v.clientes.whatsapp}`} target="_blank" className="text-xs text-emerald-400">WA</a>}
                  </td>
                  <td>
                    <span>{v.plataformas?.icono}</span>
                    <span className="text-xs text-[var(--text-3)] ml-1">{v.plataformas?.nombre}</span>
                  </td>
                  <td className="text-[var(--text-3)] text-sm">{v.perfiles?.nombre_perfil || '—'}</td>
                  <td className={cn('font-medium', getAlertaColor(tipo))}>{formatDate(v.fecha_vencimiento)}</td>
                  <td className={cn('font-bold', getAlertaColor(tipo))}>
                    {dias < 0 ? 'Vencida' : `${dias}d`}
                  </td>
                  <td>
                    <span className={cn('badge text-[10px]', v.estado === 'activa' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30')}>{v.estado}</span>
                  </td>
                  <td>
                    <button onClick={() => abrirRenovacion(v)} className="btn-primary btn-sm">
                      <RefreshCw size={13} /> Renovar
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showModal && selected && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="font-semibold text-[var(--text)]">Renovar — {selected.clientes?.nombre}</h2>
                <div className="text-xs text-[var(--text-3)] mt-0.5">{selected.plataformas?.icono} {selected.plataformas?.nombre} · {selected.perfiles?.nombre_perfil}</div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-[var(--text-3)] hover:text-[var(--text)]"><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div>
                <label className="label">Tipo de renovación</label>
                <div className="flex gap-2">
                  {[{ v: 'mismo_perfil', l: 'Mismo perfil' }, { v: 'nueva_cuenta', l: 'Nueva cuenta' }, { v: 'extension', l: 'Extensión' }].map(t => (
                    <button key={t.v} onClick={() => setForm(f => ({ ...f, tipo: t.v }))}
                      className={cn('btn btn-sm flex-1', form.tipo === t.v ? 'btn-primary' : 'btn-secondary')}>
                      {t.l}
                    </button>
                  ))}
                </div>
              </div>

              {form.tipo === 'nueva_cuenta' && (
                <>
                  <div>
                    <label className="label">Nueva cuenta</label>
                    <select className="select" value={nuevaCuenta} onChange={async e => {
                      setNuevaCuenta(e.target.value)
                      if (e.target.value) {
                        const { data } = await supabase.from('perfiles').select('*').eq('cuenta_id', e.target.value).eq('estado', 'libre').order('numero_perfil')
                        setPerfilesDisp(data || [])
                      }
                    }}>
                      <option value="">Seleccionar cuenta...</option>
                      {cuentasDisp.map(c => <option key={c.id} value={c.id}>{c.correo} — {c.perfiles_disponibles} libres</option>)}
                    </select>
                  </div>
                  {nuevaCuenta && (
                    <div>
                      <label className="label">Nuevo perfil</label>
                      <select className="select" value={nuevoPerfil} onChange={e => setNuevoPerfil(e.target.value)}>
                        <option value="">Seleccionar perfil...</option>
                        {perfilesDisp.map(p => <option key={p.id} value={p.id}>{p.nombre_perfil || `Perfil ${p.numero_perfil}`}</option>)}
                      </select>
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="label">Días a renovar</label>
                <div className="flex gap-2 mb-2">
                  {[30, 60, 90].map(d => (
                    <button key={d} onClick={() => setForm(f => ({ ...f, dias: d }))}
                      className={cn('btn btn-sm flex-1', form.dias === d ? 'btn-primary' : 'btn-secondary')}>
                      {d} días
                    </button>
                  ))}
                </div>
                <input className="input" type="number" min="1" value={form.dias} onChange={e => setForm(f => ({ ...f, dias: parseInt(e.target.value) || 30 }))} />
              </div>

              <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20">
                <div className="text-xs text-sky-400">Nueva fecha de vencimiento</div>
                <div className="text-lg font-bold text-sky-300">{nuevaFechaPreview}</div>
                <div className="text-xs text-sky-500 mt-0.5">
                  {diasRestantes(selected.fecha_vencimiento) > 0 ? `Extiende desde la fecha actual de vencimiento` : `Extiende desde hoy (ya estaba vencida)`}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Precio renovación</label>
                  <input className="input" type="number" step="0.01" value={form.precio} onChange={e => setForm(f => ({ ...f, precio: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="label">Costo</label>
                  <input className="input" type="number" step="0.01" value={form.costo} onChange={e => setForm(f => ({ ...f, costo: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>

              <div>
                <label className="label">Notas</label>
                <textarea className="input resize-none" rows={2} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={ejecutarRenovacion} disabled={saving} className="btn-primary">
                {saving ? 'Procesando...' : '✓ Confirmar Renovación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
