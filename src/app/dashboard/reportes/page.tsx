'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatFecha, getBadgeClass, getColorEstado } from '@/lib/utils'
import { Flag, Plus, X, CheckCircle, Search, Eye, Trash2, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

const TIPOS_REPORTE = [
  'contraseña cambiada','pantalla llena','perfil eliminado','correo cambiado',
  'PIN cambiado','bloqueo de cuenta','región incorrecta','cuenta caída',
  'error de plataforma','usuario expulsado','cuenta suspendida',
  'fallo de pago','calidad baja','otro'
]

export default function ReportesPage() {
  const [reportes, setReportes]   = useState<any[]>([])
  const [ventas, setVentas]       = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [busqueda, setBusq]       = useState('')
  const [filtroEst, setFEst]      = useState('')
  const [modalOpen, setMOpen]     = useState(false)
  const [verDetalle, setVerD]     = useState<any|null>(null)

  const [fr, setFr] = useState({
    venta_id:'', tipo:'cuenta caída', descripcion:'', evidencia_url:'', dias_pausados:0
  })

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data:r },{ data:v }] = await Promise.all([
      supabase.from('reportes')
        .select('*, clientes(nombre,whatsapp), cuentas(correo), ventas(fecha_inicio,fecha_vencimiento,duracion_dias,plataformas(nombre,icono))')
        .order('created_at',{ ascending:false }),
      supabase.from('ventas')
        .select('id, clientes(nombre), plataformas(nombre,icono), cuentas(correo)')
        .in('estado',['activa','renovada'])
        .order('created_at',{ ascending:false }),
    ])
    setReportes(r||[])
    setVentas(v||[])
    setLoading(false)
  }, [])
  useEffect(()=>{ load() },[load])

  async function crearReporte() {
    if (!fr.venta_id||!fr.tipo) return toast.error('Selecciona venta y tipo de reporte')
    const venta = ventas.find(v=>v.id===fr.venta_id)
    if (!venta) return
    const tid = toast.loading('Creando reporte...')
    try {
      const { error } = await supabase.from('reportes').insert({
        venta_id:fr.venta_id, cliente_id:(venta as any).cliente_id,
        cuenta_id:(venta as any).cuenta_id, tipo:fr.tipo,
        descripcion:fr.descripcion||null, evidencia_url:fr.evidencia_url||null,
        estado:'pendiente', dias_pausados:Number(fr.dias_pausados)||0
      })
      if (error) throw error
      // Marcar venta en garantía
      await supabase.from('ventas').update({ estado:'en_garantia' }).eq('id',fr.venta_id)
      await supabase.from('movimientos').insert({
        tipo:'reporte_creado',
        descripcion:`Reporte: ${fr.tipo} en venta ${fr.venta_id}`,
        entidad_tipo:'reporte', cliente_id:(venta as any).cliente_id
      })
      toast.success('Reporte creado ✅',{ id:tid })
      setMOpen(false)
      setFr({ venta_id:'',tipo:'cuenta caída',descripcion:'',evidencia_url:'',dias_pausados:0 })
      load()
    } catch(e:any){ toast.error(e.message||'Error',{ id:tid }) }
  }

  async function cambiarEstado(id: string, nuevoEstado: string) {
    const tid = toast.loading('Actualizando...')
    try {
      const upd: any = { estado:nuevoEstado }
      if (nuevoEstado==='solucionado') upd.fecha_solucion=new Date().toISOString()
      await supabase.from('reportes').update(upd).eq('id',id)
      toast.success(`Estado: ${nuevoEstado} ✅`,{ id:tid })
      load()
    } catch(e:any){ toast.error(e.message||'Error',{ id:tid }) }
  }

  async function eliminarReporte(id: string) {
    if (!confirm('¿Eliminar este reporte?')) return
    await supabase.from('reportes').delete().eq('id',id)
    toast.success('Reporte eliminado')
    load()
  }

  const reportesFilt = reportes.filter(r=>{
    const b=busqueda.toLowerCase()
    const mb=!busqueda||(r.clientes as any)?.nombre?.toLowerCase().includes(b)||r.tipo?.toLowerCase().includes(b)
    const me=!filtroEst||r.estado===filtroEst
    return mb&&me
  })

  const stats = {
    pendientes:  reportes.filter(r=>r.estado==='pendiente').length,
    solucionados:reportes.filter(r=>r.estado==='solucionado').length,
    cancelados:  reportes.filter(r=>r.estado==='cancelado').length,
  }

  const COLOR_EST: Record<string,string> = {
    pendiente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    solucionado:'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    cancelado:  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <Flag className="w-5 h-5" style={{color:'var(--brand)'}}/> Reportes
          </h1>
          <p className="text-sm mt-0.5" style={{color:'var(--text-3)'}}>
            {stats.pendientes} pendientes · {stats.solucionados} solucionados
          </p>
        </div>
        <button className="btn-primary" onClick={()=>setMOpen(true)}>
          <Plus size={15}/> Nuevo reporte
        </button>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { l:'Pendientes',  v:stats.pendientes,   c:'#f59e0b' },
          { l:'Solucionados',v:stats.solucionados, c:'#10b981' },
          { l:'Cancelados',  v:stats.cancelados,   c:'#6b7280' },
        ].map(s=>(
          <div key={s.l} className="card p-4 text-center">
            <p className="text-2xl font-bold" style={{color:s.c}}>{s.v}</p>
            <p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>{s.l}</p>
          </div>
        ))}
      </div>

      {stats.pendientes>0&&(
        <div className="alert-warning">
          <AlertTriangle className="w-4 h-4 flex-shrink-0"/>
          <span>Hay <strong>{stats.pendientes} reporte{stats.pendientes>1?'s':''} pendiente{stats.pendientes>1?'s':''}</strong> que requieren atención.</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color:'var(--text-3)'}}/>
          <input className="input pl-9" placeholder="Buscar cliente, tipo..." value={busqueda} onChange={e=>setBusq(e.target.value)}/>
        </div>
        <select className="select w-full sm:w-36" value={filtroEst} onChange={e=>setFEst(e.target.value)}>
          <option value="">Todos</option>
          <option value="pendiente">⏳ Pendiente</option>
          <option value="solucionado">✅ Solucionado</option>
          <option value="cancelado">❌ Cancelado</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Cuenta</th>
              <th>Descripción</th>
              <th>Días pausados</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12" style={{color:'var(--text-3)'}}>Cargando...</td></tr>
            ) : reportesFilt.length===0 ? (
              <tr><td colSpan={8} className="text-center py-12" style={{color:'var(--text-3)'}}>
                {filtroEst||busqueda ? 'Sin resultados' : '✅ Sin reportes registrados'}
              </td></tr>
            ) : reportesFilt.map(r=>{
              const cl  = r.clientes as any
              const venta = r.ventas  as any
              return (
                <tr key={r.id}>
                  <td>
                    <p className="font-semibold text-sm">{cl?.nombre}</p>
                    {cl?.whatsapp&&<p className="text-xs" style={{color:'var(--text-3)'}}>{cl.whatsapp}</p>}
                  </td>
                  <td>
                    <span className="badge bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 text-xs">{r.tipo}</span>
                  </td>
                  <td className="text-xs font-mono" style={{color:'var(--text-2)'}}>{(r.cuentas as any)?.correo||'—'}</td>
                  <td className="text-xs max-w-32 truncate" style={{color:'var(--text-2)'}}>{r.descripcion||'—'}</td>
                  <td className="text-center font-semibold">{r.dias_pausados||0}</td>
                  <td className="text-xs" style={{color:'var(--text-3)'}}>{formatFecha(r.fecha_reporte||r.created_at,true)}</td>
                  <td>
                    <span className={`badge text-xs ${COLOR_EST[r.estado]||''}`}>{r.estado}</span>
                    {r.fecha_solucion&&<p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>Sol: {formatFecha(r.fecha_solucion)}</p>}
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button className="btn-ghost p-1.5" onClick={()=>setVerD(r)} title="Ver"><Eye size={13}/></button>
                      {r.estado==='pendiente'&&(
                        <>
                          <button className="btn-ghost p-1.5 text-emerald-600" onClick={()=>cambiarEstado(r.id,'solucionado')} title="Solucionar"><CheckCircle size={13}/></button>
                          <button className="btn-ghost p-1.5 text-gray-500" onClick={()=>cambiarEstado(r.id,'cancelado')} title="Cancelar"><X size={13}/></button>
                        </>
                      )}
                      <button className="btn-ghost p-1.5 text-red-500" onClick={()=>eliminarReporte(r.id)} title="Eliminar"><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL NUEVO REPORTE */}
      {modalOpen && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setMOpen(false)}>
          <div className="modal-content animate-slide-up max-w-lg">
            <div className="modal-header">
              <h2 className="text-lg font-bold" style={{color:'var(--text)'}}><Flag size={16} className="inline mr-2" style={{color:'var(--brand)'}}/>Nuevo reporte</h2>
              <button className="btn-ghost p-1.5" onClick={()=>setMOpen(false)}><X size={18}/></button>
            </div>
            <div className="modal-body">
              <div className="space-y-4">
                <div>
                  <label className="label">Venta afectada *</label>
                  <select className="select" value={fr.venta_id} onChange={e=>setFr(f=>({...f,venta_id:e.target.value}))}>
                    <option value="">Seleccionar venta activa...</option>
                    {ventas.map(v=>(
                      <option key={v.id} value={v.id}>
                        {(v.clientes as any)?.nombre} — {(v.plataformas as any)?.icono} {(v.plataformas as any)?.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Tipo de problema *</label>
                  <select className="select" value={fr.tipo} onChange={e=>setFr(f=>({...f,tipo:e.target.value}))}>
                    {TIPOS_REPORTE.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Descripción del problema</label>
                  <textarea className="input" rows={3} placeholder="Describe qué ocurrió..." value={fr.descripcion} onChange={e=>setFr(f=>({...f,descripcion:e.target.value}))}/>
                </div>
                <div>
                  <label className="label">Link de evidencia (captura, etc.)</label>
                  <input className="input" type="url" placeholder="https://..." value={fr.evidencia_url} onChange={e=>setFr(f=>({...f,evidencia_url:e.target.value}))}/>
                </div>
                <div>
                  <label className="label">Días pausados (tiempo sin servicio)</label>
                  <input className="input" type="number" min={0} value={fr.dias_pausados} onChange={e=>setFr(f=>({...f,dias_pausados:Number(e.target.value)}))}/>
                  <p className="text-xs mt-1" style={{color:'var(--text-3)'}}>Estos días se descontarán del tiempo consumido del cliente</p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={()=>setMOpen(false)}>Cancelar</button>
              <button className="btn-primary" onClick={crearReporte}><CheckCircle size={15}/>Crear reporte</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE REPORTE */}
      {verDetalle && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setVerD(null)}>
          <div className="modal-content animate-slide-up max-w-lg">
            <div className="modal-header">
              <h2 className="text-base font-bold" style={{color:'var(--text)'}}>Detalle del reporte</h2>
              <button className="btn-ghost p-1.5" onClick={()=>setVerD(null)}><X size={18}/></button>
            </div>
            <div className="p-6 space-y-4">
              {[
                ['Cliente',   (verDetalle.clientes as any)?.nombre],
                ['Tipo',      verDetalle.tipo],
                ['Cuenta',    (verDetalle.cuentas as any)?.correo],
                ['Descripción',verDetalle.descripcion||'—'],
                ['Días pausados',verDetalle.dias_pausados||0],
                ['Fecha reporte',formatFecha(verDetalle.fecha_reporte||verDetalle.created_at,true)],
                ['Fecha solución',verDetalle.fecha_solucion?formatFecha(verDetalle.fecha_solucion,true):'Pendiente'],
                ['Estado',    verDetalle.estado],
              ].map(([l,v])=>(
                <div key={l as string} className="flex gap-3">
                  <p className="w-32 text-xs font-bold uppercase tracking-wider flex-shrink-0" style={{color:'var(--text-3)'}}>{l}</p>
                  <p className="text-sm" style={{color:'var(--text)'}}>{String(v)}</p>
                </div>
              ))}
              {verDetalle.evidencia_url&&(
                <div className="flex gap-3">
                  <p className="w-32 text-xs font-bold uppercase tracking-wider flex-shrink-0" style={{color:'var(--text-3)'}}>Evidencia</p>
                  <a href={verDetalle.evidencia_url} target="_blank" rel="noreferrer" className="text-sm underline" style={{color:'var(--accent)'}}>Ver evidencia →</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
