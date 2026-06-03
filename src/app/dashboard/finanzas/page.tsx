'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatMoneda } from '@/lib/utils'
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Download } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

export default function FinanzasPage() {
  const [ventas, setVentas]       = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [periodo, setPeriodo]     = useState<'7d'|'30d'|'90d'|'todo'>('30d')

  const load = useCallback(async () => {
    setLoading(true)
    const dias = periodo==='7d'?7:periodo==='30d'?30:periodo==='90d'?90:3650
    const desde = new Date(Date.now()-dias*86400000).toISOString()
    const { data } = await supabase
      .from('ventas')
      .select('*, plataformas(nombre,icono,color)')
      .gte('created_at', periodo==='todo'?'2020-01-01':desde)
      .order('created_at',{ ascending:true })
    setVentas(data||[])
    setLoading(false)
  }, [periodo])
  useEffect(()=>{ load() },[load])

  // Calcular stats
  const totalIngresos  = ventas.reduce((s,v)=>s+(v.precio_venta||0),0)
  const totalCostos    = ventas.reduce((s,v)=>s+(v.costo_real||0),0)
  const totalGanancia  = totalIngresos - totalCostos
  const margenPromedio = totalIngresos>0 ? Math.round((totalGanancia/totalIngresos)*100) : 0
  const pagadas        = ventas.filter(v=>v.estado_pago==='pagado')
  const pendientes     = ventas.filter(v=>v.estado_pago!=='pagado')
  const totalPagado    = pagadas.reduce((s,v)=>s+(v.precio_venta||0),0)
  const totalPorCobrar = pendientes.reduce((s,v)=>s+(v.precio_venta||0),0)

  // Agrupar por plataforma
  const porPlataforma = Object.values(
    ventas.reduce((acc:any,v:any)=>{
      const n=(v.plataformas as any)?.nombre||'Otras'
      const c=(v.plataformas as any)?.color||'#8040e0'
      if (!acc[n]) acc[n]={ nombre:n, color:c, ventas:0, ingresos:0, costos:0 }
      acc[n].ventas++
      acc[n].ingresos+=(v.precio_venta||0)
      acc[n].costos+=(v.costo_real||0)
      return acc
    },{})
  ) as any[]

  // Agrupar por semana (para gráfica de barras)
  const porSemana = ventas.reduce((acc:any,v:any)=>{
    const fecha=new Date(v.created_at)
    const semana=`${fecha.getDate()}/${fecha.getMonth()+1}`
    if (!acc[semana]) acc[semana]={ semana, ingresos:0, ganancia:0, ventas:0 }
    acc[semana].ingresos+=(v.precio_venta||0)
    acc[semana].ganancia+=(v.precio_venta||0)-(v.costo_real||0)
    acc[semana].ventas++
    return acc
  },{})
  const dataBarras = Object.values(porSemana).slice(-14) as any[]

  // Pie data
  const dataPie = porPlataforma.map(p=>({ name:p.nombre, value:p.ingresos, fill:p.color }))

  const PINK_GRADIENT = ['#e060c0','#c044a0','#a030c0','#8040e0','#6050e0','#4060e0','#3b82f6','#2563eb','#10b981','#f59e0b']

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <TrendingUp className="w-5 h-5" style={{color:'var(--brand)'}}/> Finanzas
          </h1>
          <p className="text-sm mt-0.5" style={{color:'var(--text-3)'}}>Resumen financiero de ventas</p>
        </div>
        <div className="flex gap-2">
          {(['7d','30d','90d','todo'] as const).map(p=>(
            <button key={p} onClick={()=>setPeriodo(p)}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${periodo===p?'text-white':'btn-secondary'}`}
              style={periodo===p?{background:'linear-gradient(135deg,#c044a0,#8040e0)'}:{}}>
              {p==='todo'?'Todo':p}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        {[
          { l:'Ingresos totales', v:formatMoneda(totalIngresos),  icon:'💰', color:'#10b981', sub:`${ventas.length} ventas` },
          { l:'Ganancia neta',    v:formatMoneda(totalGanancia),  icon:'📈', color:'#c044a0', sub:`${margenPromedio}% margen` },
          { l:'Cobrado',          v:formatMoneda(totalPagado),    icon:'✅', color:'#3b82f6', sub:`${pagadas.length} ventas pagadas` },
          { l:'Por cobrar',       v:formatMoneda(totalPorCobrar), icon:'⏳', color:'#f59e0b', sub:`${pendientes.length} pendientes` },
        ].map(s=>(
          <div key={s.l} className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{s.icon}</span>
              <p className="text-xs font-bold uppercase tracking-wider" style={{color:'var(--text-3)'}}>{s.l}</p>
            </div>
            <p className="text-xl font-bold" style={{color:s.color}}>{s.v}</p>
            <p className="text-xs mt-1" style={{color:'var(--text-3)'}}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Gráficas */}
      {!loading && ventas.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Barras: ingresos por fecha */}
          <div className="lg:col-span-2 card p-5">
            <h3 className="font-bold text-sm mb-4" style={{color:'var(--text)'}}>📊 Ingresos y ganancia por fecha</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dataBarras} margin={{ top:0, right:0, left:-20, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                <XAxis dataKey="semana" tick={{ fontSize:11, fill:'var(--text-3)' }}/>
                <YAxis tick={{ fontSize:11, fill:'var(--text-3)' }}/>
                <Tooltip
                  contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, fontSize:12 }}
                  formatter={(v:any)=>formatMoneda(v)}/>
                <Bar dataKey="ingresos" fill="#c044a0" radius={[6,6,0,0]} name="Ingresos"/>
                <Bar dataKey="ganancia" fill="#3b82f6" radius={[6,6,0,0]} name="Ganancia"/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie: por plataforma */}
          <div className="card p-5">
            <h3 className="font-bold text-sm mb-4" style={{color:'var(--text)'}}>🎬 Por plataforma</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={dataPie} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {dataPie.map((entry,i)=>(
                    <Cell key={i} fill={entry.fill||PINK_GRADIENT[i%PINK_GRADIENT.length]}/>
                  ))}
                </Pie>
                <Tooltip formatter={(v:any)=>formatMoneda(v)} contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, fontSize:12 }}/>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:11 }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tabla por plataforma */}
      {porPlataforma.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-5 border-b" style={{borderColor:'var(--border)'}}>
            <h3 className="font-bold text-sm" style={{color:'var(--text)'}}>Desglose por plataforma</h3>
          </div>
          <div className="table-container border-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Plataforma</th>
                  <th>Ventas</th>
                  <th>Ingresos</th>
                  <th>Costos</th>
                  <th>Ganancia</th>
                  <th>Margen</th>
                </tr>
              </thead>
              <tbody>
                {porPlataforma.sort((a:any,b:any)=>b.ingresos-a.ingresos).map((p:any)=>{
                  const gan=p.ingresos-p.costos
                  const mar=p.ingresos>0?Math.round((gan/p.ingresos)*100):0
                  return (
                    <tr key={p.nombre}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-8 rounded-full flex-shrink-0" style={{background:p.color}}/>
                          <span className="font-semibold">{p.nombre}</span>
                        </div>
                      </td>
                      <td className="font-semibold text-center">{p.ventas}</td>
                      <td className="font-bold text-emerald-600">{formatMoneda(p.ingresos)}</td>
                      <td className="text-red-500">{formatMoneda(p.costos)}</td>
                      <td className="font-bold" style={{color:'var(--brand)'}}>{formatMoneda(gan)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full" style={{background:'var(--border)'}}>
                            <div className="h-1.5 rounded-full" style={{width:`${Math.min(100,mar)}%`,background:p.color}}/>
                          </div>
                          <span className="text-xs font-bold w-8 text-right" style={{color:'var(--text-2)'}}>{mar}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                <tr className="font-bold" style={{background:'var(--surface-2)'}}>
                  <td>TOTAL</td>
                  <td className="text-center">{ventas.length}</td>
                  <td className="text-emerald-600">{formatMoneda(totalIngresos)}</td>
                  <td className="text-red-500">{formatMoneda(totalCostos)}</td>
                  <td style={{color:'var(--brand)'}}>{formatMoneda(totalGanancia)}</td>
                  <td className="font-bold">{margenPromedio}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && ventas.length===0 && (
        <div className="card p-12 text-center">
          <BarChart3 size={40} className="mx-auto mb-3 opacity-20" style={{color:'var(--brand)'}}/>
          <p className="font-semibold" style={{color:'var(--text-2)'}}>Sin datos para el período seleccionado</p>
        </div>
      )}
    </div>
  )
}
