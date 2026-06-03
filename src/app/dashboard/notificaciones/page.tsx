'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatFecha, calcularDiasRestantes } from '@/lib/utils'
import { Bell, CheckCircle, Trash2, RefreshCw, AlertTriangle, Clock, X } from 'lucide-react'
import toast from 'react-hot-toast'

export default function NotificacionesPage() {
  const [notifs, setNotifs]   = useState<any[]>([])
  const [ventas, setVentas]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<'sistema'|'vencimientos'|'cobros'>('vencimientos')

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data:n },{ data:v }] = await Promise.all([
      supabase.from('notificaciones_sistema')
        .select('*, clientes(nombre)')
        .order('created_at',{ ascending:false })
        .limit(100),
      supabase.from('ventas')
        .select('*, clientes(nombre,whatsapp), plataformas(nombre,icono,color)')
        .eq('estado','activa')
        .order('fecha_vencimiento',{ ascending:true }),
    ])
    setNotifs(n||[])
    setVentas(v||[])
    setLoading(false)
  }, [])

  useEffect(()=>{ load() },[load])

  async function generarAlertas() {
    const tid = toast.loading('Generando alertas...')
    try {
      await supabase.rpc('generar_alertas_vencimiento')
      toast.success('Alertas generadas ✅',{ id:tid })
      load()
    } catch(e:any){
      // Si la función no existe, generamos manualmente
      const hoy = new Date().toISOString().split('T')[0]
      const mañana = new Date(Date.now()+86400000).toISOString().split('T')[0]
      const { data:vHoy } = await supabase.from('ventas')
        .select('*, clientes(nombre), plataformas(nombre)')
        .eq('estado','activa').eq('fecha_vencimiento',hoy)
      const { data:vMan } = await supabase.from('ventas')
        .select('*, clientes(nombre), plataformas(nombre)')
        .eq('estado','activa').eq('fecha_vencimiento',mañana)

      for (const v of [...(vHoy||[]),(vMan||[])]) {
        const tipo = v.fecha_vencimiento===hoy?'vence_hoy':'vence_manana'
        await supabase.from('notificaciones_sistema').insert({
          tipo, titulo:`${v.fecha_vencimiento===hoy?'⚠️':'🔔'} ${(v.clientes as any)?.nombre}`,
          mensaje:`${(v.plataformas as any)?.nombre} vence ${v.fecha_vencimiento===hoy?'HOY':'mañana'}`,
          entidad_tipo:'venta', entidad_id:v.id, cliente_id:v.cliente_id,
          urgente: v.fecha_vencimiento===hoy
        }).select()
      }
      toast.success('Alertas generadas ✅',{ id:tid })
      load()
    }
  }

  async function marcarLeida(id: string) {
    await supabase.from('notificaciones_sistema').update({ leida:true }).eq('id',id)
    setNotifs(n=>n.map(x=>x.id===id?{...x,leida:true}:x))
  }

  async function marcarTodasLeidas() {
    await supabase.from('notificaciones_sistema').update({ leida:true }).eq('leida',false)
    toast.success('Todas marcadas como leídas')
    load()
  }

  async function eliminarNotif(id: string) {
    await supabase.from('notificaciones_sistema').delete().eq('id',id)
    setNotifs(n=>n.filter(x=>x.id!==id))
  }

  // Clasificar ventas por urgencia
  const vHoy     = ventas.filter(v=>calcularDiasRestantes(v.fecha_vencimiento)===0)
  const vMañana  = ventas.filter(v=>calcularDiasRestantes(v.fecha_vencimiento)===1)
  const v3dias   = ventas.filter(v=>{ const d=calcularDiasRestantes(v.fecha_vencimiento); return d>1&&d<=3 })
  const v7dias   = ventas.filter(v=>{ const d=calcularDiasRestantes(v.fecha_vencimiento); return d>3&&d<=7 })

  // Cobros pendientes
  const { data:cobPend } = { data: null } // Lazy load

  const noLeidas = notifs.filter(n=>!n.leida).length

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <Bell className="w-5 h-5" style={{color:'var(--brand)'}}/> Centro de Alertas
            {noLeidas>0&&<span className="badge bg-pink-100 text-pink-700 ml-2">{noLeidas} nuevas</span>}
          </h1>
          <p className="text-sm mt-0.5" style={{color:'var(--text-3)'}}>Vencimientos, cobros y avisos del sistema</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-xs py-2" onClick={generarAlertas}>
            <RefreshCw size={13}/> Generar alertas
          </button>
          {noLeidas>0&&<button className="btn-secondary text-xs py-2" onClick={marcarTodasLeidas}>
            <CheckCircle size={13}/> Marcar leídas
          </button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b" style={{borderColor:'var(--border)'}}>
        {([
          ['vencimientos','⏰ Vencimientos'],
          ['sistema','🔔 Sistema'],
          ['cobros','💰 Cobros pendientes'],
        ] as const).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)}
            className="px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors"
            style={{borderColor:tab===t?'var(--brand)':'transparent',color:tab===t?'var(--brand)':'var(--text-3)'}}>
            {l}
          </button>
        ))}
      </div>

      {/* ── VENCIMIENTOS ── */}
      {tab==='vencimientos' && (
        <div className="space-y-5">
          {vHoy.length>0 && (
            <div>
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 ring-pulse inline-block"/>
                Vencen HOY ({vHoy.length})
              </h3>
              <div className="space-y-2">
                {vHoy.map(v=><VencimientoCard key={v.id} v={v} urgencia="rojo"/>)}
              </div>
            </div>
          )}
          {vMañana.length>0 && (
            <div>
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-orange-600">
                <AlertTriangle size={14}/> Vencen MAÑANA ({vMañana.length})
              </h3>
              <div className="space-y-2">
                {vMañana.map(v=><VencimientoCard key={v.id} v={v} urgencia="naranja"/>)}
              </div>
            </div>
          )}
          {v3dias.length>0 && (
            <div>
              <h3 className="font-bold text-sm mb-3" style={{color:'var(--text-2)'}}>
                ⏳ Vencen en 2–3 días ({v3dias.length})
              </h3>
              <div className="space-y-2">
                {v3dias.map(v=><VencimientoCard key={v.id} v={v} urgencia="amarillo"/>)}
              </div>
            </div>
          )}
          {v7dias.length>0 && (
            <div>
              <h3 className="font-bold text-sm mb-3" style={{color:'var(--text-3)'}}>
                📅 Vencen en 4–7 días ({v7dias.length})
              </h3>
              <div className="space-y-2">
                {v7dias.map(v=><VencimientoCard key={v.id} v={v} urgencia="verde"/>)}
              </div>
            </div>
          )}
          {vHoy.length===0&&vMañana.length===0&&v3dias.length===0&&v7dias.length===0 && (
            <div className="card p-12 text-center">
              <CheckCircle size={40} className="mx-auto mb-3 text-emerald-500 opacity-60"/>
              <p className="font-semibold" style={{color:'var(--text-2)'}}>¡Todo al día!</p>
              <p className="text-sm mt-1" style={{color:'var(--text-3)'}}>No hay vencimientos en los próximos 7 días</p>
            </div>
          )}
        </div>
      )}

      {/* ── SISTEMA ── */}
      {tab==='sistema' && (
        <div className="space-y-2">
          {loading ? (
            <div className="text-center py-12" style={{color:'var(--text-3)'}}>Cargando...</div>
          ) : notifs.length===0 ? (
            <div className="card p-12 text-center">
              <Bell size={40} className="mx-auto mb-3 opacity-20" style={{color:'var(--brand)'}}/>
              <p className="font-semibold" style={{color:'var(--text-2)'}}>Sin notificaciones</p>
              <p className="text-sm mt-1" style={{color:'var(--text-3)'}}>Haz clic en "Generar alertas" para crear alertas de vencimiento</p>
            </div>
          ) : notifs.map(n=>(
            <div key={n.id}
              className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${!n.leida?'border-pink-200 dark:border-pink-800':'border-[var(--border)]'}`}
              style={{background:!n.leida?'var(--brand-light)':'var(--surface)'}}>
              <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${n.urgente?'bg-red-500':!n.leida?'bg-pink-400':'bg-gray-300'}`}/>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm" style={{color:'var(--text)'}}>{n.titulo}</p>
                {n.mensaje&&<p className="text-xs mt-0.5" style={{color:'var(--text-2)'}}>{n.mensaje}</p>}
                <p className="text-xs mt-1" style={{color:'var(--text-3)'}}>{formatFecha(n.created_at,true)}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {!n.leida&&<button className="btn-ghost p-1.5 text-emerald-600" onClick={()=>marcarLeida(n.id)} title="Marcar leída"><CheckCircle size={14}/></button>}
                <button className="btn-ghost p-1.5 text-red-500" onClick={()=>eliminarNotif(n.id)} title="Eliminar"><Trash2 size={14}/></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── COBROS PENDIENTES ── */}
      {tab==='cobros' && <CobrosPendientesTab/>}
    </div>
  )
}

function VencimientoCard({ v, urgencia }: { v:any, urgencia:string }) {
  const cl = v.clientes as any
  const plat = v.plataformas as any
  const dias = calcularDiasRestantes(v.fecha_vencimiento)
  const bgMap: Record<string,string> = {
    rojo:'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10',
    naranja:'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/10',
    amarillo:'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/10',
    verde:'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10',
  }
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${bgMap[urgencia]||''}`}>
      <span className="text-xl flex-shrink-0">{plat?.icono}</span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm" style={{color:'var(--text)'}}>{cl?.nombre}</p>
        <p className="text-xs" style={{color:'var(--text-2)'}}>{plat?.nombre}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`font-bold text-sm ${urgencia==='rojo'?'text-red-600':urgencia==='naranja'?'text-orange-600':urgencia==='amarillo'?'text-yellow-600':'text-emerald-600'}`}>
          {dias===0?'¡HOY!':dias===1?'Mañana':`${dias} días`}
        </p>
        {cl?.whatsapp && (
          <a href={`https://wa.me/${cl.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
            className="text-xs text-emerald-600 hover:underline">WhatsApp →</a>
        )}
      </div>
    </div>
  )
}

function CobrosPendientesTab() {
  const [ventas, setVentas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    supabase.from('ventas')
      .select('*, clientes(nombre,whatsapp), plataformas(nombre,icono)')
      .neq('estado_pago','pagado')
      .in('estado',['activa','renovada'])
      .order('created_at',{ ascending:false })
      .then(({ data })=>{ setVentas(data||[]); setLoading(false) })
  },[])

  const total = ventas.reduce((s,v)=>s+(v.precio_venta||0),0)
  const { formatMoneda } = require('@/lib/utils')

  return (
    <div className="space-y-4">
      {!loading&&ventas.length>0&&(
        <div className="alert-warning">
          <AlertTriangle className="w-4 h-4"/>
          <span>Total pendiente: <strong>{formatMoneda(total)}</strong> en {ventas.length} ventas</span>
        </div>
      )}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr><th>Cliente</th><th>Plataforma</th><th>Precio</th><th>Estado pago</th><th>WhatsApp</th></tr>
          </thead>
          <tbody>
            {loading?<tr><td colSpan={5} className="text-center py-8">Cargando...</td></tr>
            :ventas.length===0?<tr><td colSpan={5} className="text-center py-8 text-emerald-600 font-semibold">✅ Todos los cobros al día</td></tr>
            :ventas.map(v=>{
              const cl=v.clientes as any; const plat=v.plataformas as any
              return (
                <tr key={v.id}>
                  <td className="font-semibold">{cl?.nombre}</td>
                  <td><span className="mr-1">{plat?.icono}</span>{plat?.nombre}</td>
                  <td className="font-bold text-emerald-600">{formatMoneda(v.precio_venta)}</td>
                  <td><span className={`badge text-xs ${v.estado_pago==='pendiente'?'bg-yellow-100 text-yellow-800':'bg-red-100 text-red-800'}`}>{v.estado_pago}</span></td>
                  <td>{cl?.whatsapp?<a href={`https://wa.me/${cl.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 hover:underline">📱 Cobrar</a>:'—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
