'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatMoneda, formatFecha, calcularDiasRestantes } from '@/lib/utils'
import { DollarSign, CheckCircle, Clock, AlertTriangle, Search, TrendingUp, TrendingDown, X } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CobrosPage() {
  const [ventas, setVentas]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusq]   = useState('')
  const [filtroPago, setFP]   = useState('')
  const [modalPago, setMP]    = useState<any|null>(null)
  const [fp, setFp]           = useState({ estado_pago:'pagado', metodo_pago:'efectivo', notas:'' })

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('ventas')
      .select(`*, clientes(nombre,telefono,whatsapp),
               plataformas(nombre,icono,color)`)
      .order('created_at',{ ascending:false })
    setVentas(data||[])
    setLoading(false)
  }, [])
  useEffect(()=>{ load() },[load])

  async function actualizarPago() {
    const v = modalPago
    const tid = toast.loading('Actualizando...')
    try {
      await supabase.from('ventas').update({
        estado_pago:fp.estado_pago, metodo_pago:fp.metodo_pago,
        fecha_pago: fp.estado_pago==='pagado' ? new Date().toISOString() : null
      }).eq('id',v.id)
      await supabase.from('movimientos').insert({
        tipo:'pago_actualizado',
        descripcion:`Pago: ${fp.estado_pago} via ${fp.metodo_pago}. ${fp.notas||''}`,
        entidad_tipo:'venta', entidad_id:v.id, cliente_id:v.cliente_id
      })
      toast.success('Pago actualizado ✅',{ id:tid })
      setMP(null)
      load()
    } catch(e:any){ toast.error(e.message||'Error',{ id:tid }) }
  }

  const ventasFilt = ventas.filter(v=>{
    const b=busqueda.toLowerCase()
    const mb=!busqueda||(v.clientes as any)?.nombre?.toLowerCase().includes(b)
    const mp=!filtroPago||v.estado_pago===filtroPago
    return mb&&mp
  })

  // Stats financieras
  const ventasActivas = ventas.filter(v=>['activa','renovada'].includes(v.estado))
  const totalCobrado   = ventasActivas.filter(v=>v.estado_pago==='pagado').reduce((s:number,v:any)=>s+(v.precio_venta||0),0)
  const totalPendiente = ventasActivas.filter(v=>v.estado_pago==='pendiente').reduce((s:number,v:any)=>s+(v.precio_venta||0),0)
  const totalSinCobrar = ventasActivas.filter(v=>v.estado_pago==='sin_cobrar').reduce((s:number,v:any)=>s+(v.precio_venta||0),0)
 const clientesPend = Array.from(
  new Set(
    ventasActivas
      .filter(v => v.estado_pago !== 'pagado')
      .map((v:any) => v.cliente_id)
  )
).length
  const COLOR_PAGO: Record<string,string> = {
    pagado:'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    pendiente:'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    parcial:'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    sin_cobrar:'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <DollarSign className="w-5 h-5" style={{color:'var(--brand)'}}/> Control de Cobros
          </h1>
          <p className="text-sm mt-0.5" style={{color:'var(--text-3)'}}>
            Seguimiento de pagos pendientes y realizados
          </p>
        </div>
      </div>

      {/* Stats de cobros */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        {[
          { l:'Total cobrado',    v:formatMoneda(totalCobrado),   c:'emerald', icon:'✅', sub:'Ventas activas pagadas' },
          { l:'Pendiente cobrar', v:formatMoneda(totalPendiente), c:'yellow',  icon:'⏳', sub:`${ventasActivas.filter(v=>v.estado_pago==='pendiente').length} ventas` },
          { l:'Sin cobrar',       v:formatMoneda(totalSinCobrar), c:'red',     icon:'❌', sub:`${ventasActivas.filter(v=>v.estado_pago==='sin_cobrar').length} ventas` },
          { l:'Clientes deben',   v:clientesPend,                 c:'purple',  icon:'👥', sub:'Con pagos pendientes' },
        ].map(s=>(
          <div key={s.l} className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{s.icon}</span>
              <p className="text-xs font-bold uppercase tracking-wider" style={{color:'var(--text-3)'}}>{s.l}</p>
            </div>
            <p className={`text-xl font-bold text-${s.c}-600 dark:text-${s.c}-400`}>{s.v}</p>
            <p className="text-xs mt-1" style={{color:'var(--text-3)'}}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Alert de pendientes */}
      {totalPendiente > 0 && (
        <div className="alert-warning">
          <AlertTriangle className="w-4 h-4 flex-shrink-0"/>
          <span>Tienes <strong>{formatMoneda(totalPendiente)}</strong> pendientes de cobro en {ventasActivas.filter(v=>v.estado_pago==='pendiente').length} ventas activas.</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color:'var(--text-3)'}}/>
          <input className="input pl-9" placeholder="Buscar cliente..." value={busqueda} onChange={e=>setBusq(e.target.value)}/>
        </div>
        <select className="select w-full sm:w-44" value={filtroPago} onChange={e=>setFP(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="pagado">✅ Pagado</option>
          <option value="pendiente">⏳ Pendiente</option>
          <option value="parcial">🔵 Parcial</option>
          <option value="sin_cobrar">❌ Sin cobrar</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Plataforma</th>
              <th>Precio</th>
              <th>Estado pago</th>
              <th>Método</th>
              <th>Fecha venta</th>
              <th>Días restantes</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12" style={{color:'var(--text-3)'}}>Cargando...</td></tr>
            ) : ventasFilt.length===0 ? (
              <tr><td colSpan={8} className="text-center py-12" style={{color:'var(--text-3)'}}>Sin resultados</td></tr>
            ) : ventasFilt.map(v=>{
              const cl   = v.clientes   as any
              const plat = v.plataformas as any
              const dias = calcularDiasRestantes(v.fecha_vencimiento)
              return (
                <tr key={v.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{background:'linear-gradient(135deg,#c044a0,#8040e0)'}}>
                        {cl?.nombre?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{cl?.nombre}</p>
                        {cl?.whatsapp&&(
                          <a href={`https://wa.me/${cl.whatsapp?.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                            className="text-xs text-emerald-600 hover:underline">{cl.whatsapp}</a>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{plat?.icono}</span>
                      <span className="text-sm font-medium">{plat?.nombre}</span>
                    </div>
                  </td>
                  <td className="font-bold text-emerald-600">{formatMoneda(v.precio_venta)}</td>
                  <td>
                    <span className={`badge text-xs ${COLOR_PAGO[v.estado_pago]||'bg-gray-100 text-gray-600'}`}>
                      {v.estado_pago||'—'}
                    </span>
                  </td>
                  <td className="text-xs" style={{color:'var(--text-2)'}}>{v.metodo_pago||'—'}</td>
                  <td className="text-xs" style={{color:'var(--text-3)'}}>{formatFecha(v.created_at)}</td>
                  <td>
                    {['activa','renovada'].includes(v.estado) ? (
                      <span className={`text-sm font-bold ${dias===0?'text-red-600':dias<=3?'text-orange-500':dias<=7?'text-yellow-500':'text-emerald-600'}`}>
                        {dias===0?'¡Hoy!':dias<0?'Vencida':`${dias}d`}
                      </span>
                    ) : <span className="text-xs" style={{color:'var(--text-3)'}}>{v.estado}</span>}
                  </td>
                  <td>
                    {v.estado_pago!=='pagado' ? (
                      <button className="btn-success text-xs py-1 px-3"
                        onClick={()=>{ setMP(v); setFp({ estado_pago:'pagado', metodo_pago:v.metodo_pago||'efectivo', notas:'' }) }}>
                        <CheckCircle size={12}/> Marcar pagado
                      </button>
                    ) : (
                      <button className="btn-secondary text-xs py-1 px-3"
                        onClick={()=>{ setMP(v); setFp({ estado_pago:v.estado_pago, metodo_pago:v.metodo_pago||'efectivo', notas:'' }) }}>
                        Cambiar
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal actualizar pago */}
      {modalPago && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setMP(null)}>
          <div className="modal-content animate-slide-up max-w-sm">
            <div className="modal-header">
              <h2 className="text-base font-bold" style={{color:'var(--text)'}}>
                <DollarSign size={16} className="inline mr-1 text-teal-500"/>Actualizar pago
              </h2>
              <button className="btn-ghost p-1.5" onClick={()=>setMP(null)}><X size={16}/></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="rounded-xl p-3 text-sm" style={{background:'var(--surface-2)',border:'1px solid var(--border)'}}>
                <p className="font-bold">{(modalPago.clientes as any)?.nombre}</p>
                <p style={{color:'var(--text-2)'}}>{(modalPago.plataformas as any)?.nombre} · <strong>{formatMoneda(modalPago.precio_venta)}</strong></p>
              </div>
              <div>
                <label className="label">Estado de pago</label>
                <select className="select" value={fp.estado_pago} onChange={e=>setFp(f=>({...f,estado_pago:e.target.value}))}>
                  <option value="pagado">✅ Pagado</option>
                  <option value="pendiente">⏳ Pendiente</option>
                  <option value="parcial">🔵 Pago parcial</option>
                  <option value="sin_cobrar">❌ Sin cobrar</option>
                </select>
              </div>
              <div>
                <label className="label">Método de pago</label>
                <select className="select" value={fp.metodo_pago} onChange={e=>setFp(f=>({...f,metodo_pago:e.target.value}))}>
                  {['efectivo','transferencia','tarjeta','mercadopago','paypal','otro'].map(m=>(
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Notas</label>
                <textarea className="input" rows={2} placeholder="Referencia, comprobante..." value={fp.notas} onChange={e=>setFp(f=>({...f,notas:e.target.value}))}/>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={()=>setMP(null)}>Cancelar</button>
              <button className="btn-success" onClick={actualizarPago}><CheckCircle size={14}/>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
