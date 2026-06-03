'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatMoneda, formatFecha } from '@/lib/utils'
import { Building2, Plus, X, CheckCircle, Search, Eye, Edit2, Trash2, Star, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ProveedoresPage() {
  const [proveedores, setProvs] = useState<any[]>([])
  const [stats, setStats]       = useState<Record<string,any>>({})
  const [loading, setLoading]   = useState(true)
  const [busqueda, setBusq]     = useState('')
  const [modalOpen, setMOpen]   = useState(false)
  const [editando, setEdit]     = useState<any|null>(null)
  const [verDetalle, setVerD]   = useState<any|null>(null)
  const [detalleCuentas, setDC] = useState<any[]>([])

  const [fp, setFp] = useState({ nombre:'', telefono:'', whatsapp:'', notas:'' })

  const load = useCallback(async () => {
    setLoading(true)
    const { data:p } = await supabase.from('proveedores').select('*').eq('activo',true).order('nombre')
    setProvs(p||[])

    // Stats por proveedor
    if (p&&p.length>0) {
      const statsMap: Record<string,any> = {}
      for (const pr of p) {
        const [{ data:cuentas },{ count:reportes }] = await Promise.all([
          supabase.from('cuentas').select('id,costo').eq('proveedor_id',pr.id),
          supabase.from('reportes')
            .select('id',{ count:'exact',head:true })
            .in('cuenta_id',(await supabase.from('cuentas').select('id').eq('proveedor_id',pr.id)).data?.map((c:any)=>c.id)||[])
        ])
        const totalCuentas = cuentas?.length||0
        const totalInvertido = cuentas?.reduce((s:number,c:any)=>s+(c.costo||0),0)||0
        statsMap[pr.id] = {
          totalCuentas, totalInvertido,
          totalReportes: reportes||0,
          porcentajeFallas: totalCuentas>0?Math.round(((reportes||0)/totalCuentas)*100):0
        }
      }
      setStats(statsMap)
    }
    setLoading(false)
  }, [])
  useEffect(()=>{ load() },[load])

  async function abrirDetalle(prov: any) {
    setVerD(prov)
    const { data } = await supabase
      .from('cuentas')
      .select('*, plataformas(nombre,icono,color)')
      .eq('proveedor_id',prov.id)
      .order('created_at',{ ascending:false })
    setDC(data||[])
  }

  async function guardarProveedor() {
    if (!fp.nombre.trim()) return toast.error('El nombre es requerido')
    const tid = toast.loading(editando?'Actualizando...':'Guardando...')
    try {
      if (editando) {
        const { error } = await supabase.from('proveedores').update(fp).eq('id',editando.id)
        if (error) throw error
        toast.success('Proveedor actualizado ✅',{ id:tid })
      } else {
        const { error } = await supabase.from('proveedores').insert(fp)
        if (error) throw error
        toast.success('Proveedor registrado ✅',{ id:tid })
      }
      setMOpen(false); setEdit(null); resetFp(); load()
    } catch(e:any){ toast.error(e.message||'Error',{ id:tid }) }
  }

  async function eliminarProveedor(id: string, nombre: string) {
    if (!confirm(`¿Desactivar al proveedor "${nombre}"?`)) return
    await supabase.from('proveedores').update({ activo:false }).eq('id',id)
    toast.success('Proveedor desactivado')
    load()
  }

  function abrirEditar(p: any) {
    setEdit(p)
    setFp({ nombre:p.nombre, telefono:p.telefono||'', whatsapp:p.whatsapp||'', notas:p.notas||'' })
    setMOpen(true)
  }
  function resetFp() { setFp({ nombre:'', telefono:'', whatsapp:'', notas:'' }) }

  const provsFilt = proveedores.filter(p=>{
    const b=busqueda.toLowerCase()
    return !busqueda||p.nombre?.toLowerCase().includes(b)
  })

  // Ranking de proveedores
  const mejorProveedor = proveedores.reduce((best:any,p:any)=>{
    const s=stats[p.id]
    if (!s) return best
    const score=s.totalCuentas-(s.totalReportes*2)
    if (!best||score>(stats[best.id]?.totalCuentas-(stats[best.id]?.totalReportes*2)||0)) return p
    return best
  }, null)

  const peorProveedor = proveedores.reduce((worst:any,p:any)=>{
    const s=stats[p.id]
    if (!s||s.totalCuentas===0) return worst
    if (!worst||s.porcentajeFallas>(stats[worst.id]?.porcentajeFallas||0)) return p
    return worst
  }, null)

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <Building2 className="w-5 h-5" style={{color:'var(--brand)'}}/> Proveedores
          </h1>
          <p className="text-sm mt-0.5" style={{color:'var(--text-3)'}}>{proveedores.length} proveedores activos</p>
        </div>
        <button className="btn-primary" onClick={()=>{ resetFp(); setEdit(null); setMOpen(true) }}>
          <Plus size={15}/> Nuevo proveedor
        </button>
      </div>

      {/* Ranking cards */}
      {!loading && proveedores.length>1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {mejorProveedor && (
            <div className="card p-4 flex items-center gap-4" style={{border:'1.5px solid #34d399'}}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-emerald-50">⭐</div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Mejor proveedor</p>
                <p className="font-bold" style={{color:'var(--text)'}}>{mejorProveedor.nombre}</p>
                <p className="text-xs" style={{color:'var(--text-3)'}}>
                  {stats[mejorProveedor.id]?.totalCuentas||0} cuentas · {stats[mejorProveedor.id]?.porcentajeFallas||0}% fallas
                </p>
              </div>
            </div>
          )}
          {peorProveedor && peorProveedor.id!==mejorProveedor?.id && (
            <div className="card p-4 flex items-center gap-4" style={{border:'1.5px solid #f87171'}}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-red-50">⚠️</div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-red-500">Más problemático</p>
                <p className="font-bold" style={{color:'var(--text)'}}>{peorProveedor.nombre}</p>
                <p className="text-xs" style={{color:'var(--text-3)'}}>
                  {stats[peorProveedor.id]?.porcentajeFallas||0}% fallas · {stats[peorProveedor.id]?.totalReportes||0} reportes
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color:'var(--text-3)'}}/>
        <input className="input pl-9" placeholder="Buscar proveedor..." value={busqueda} onChange={e=>setBusq(e.target.value)}/>
      </div>

      {/* Grid de proveedores */}
      {loading ? (
        <div className="text-center py-16" style={{color:'var(--text-3)'}}>Cargando...</div>
      ) : provsFilt.length===0 ? (
        <div className="card p-12 text-center">
          <Building2 size={40} className="mx-auto mb-3 opacity-20" style={{color:'var(--brand)'}}/>
          <p className="font-semibold" style={{color:'var(--text-2)'}}>Sin proveedores registrados</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
          {provsFilt.map(p=>{
            const s = stats[p.id]||{}
            const fallas = s.porcentajeFallas||0
            return (
              <div key={p.id} className="card-hover p-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-lg"
                      style={{background:'linear-gradient(135deg,#c044a0,#8040e0)'}}>
                      {p.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold" style={{color:'var(--text)'}}>{p.nombre}</h3>
                      {p.whatsapp&&<p className="text-xs text-emerald-600">{p.whatsapp}</p>}
                      {p.telefono&&<p className="text-xs" style={{color:'var(--text-3)'}}>{p.telefono}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button className="btn-ghost p-1.5" onClick={()=>abrirDetalle(p)} title="Ver cuentas"><Eye size={13}/></button>
                    <button className="btn-ghost p-1.5" onClick={()=>abrirEditar(p)} title="Editar"><Edit2 size={13}/></button>
                    <button className="btn-ghost p-1.5 text-red-500" onClick={()=>eliminarProveedor(p.id,p.nombre)} title="Desactivar"><Trash2 size={13}/></button>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { l:'Cuentas', v:s.totalCuentas||0, c:'var(--brand)' },
                    { l:'Reportes', v:s.totalReportes||0, c:s.totalReportes>3?'#ef4444':'var(--text-2)' },
                    { l:'% Fallas', v:`${fallas}%`, c:fallas>30?'#ef4444':fallas>10?'#f59e0b':'#10b981' },
                  ].map(st=>(
                    <div key={st.l} className="text-center p-2 rounded-lg" style={{background:'var(--surface-2)'}}>
                      <p className="text-lg font-bold" style={{color:st.c}}>{st.v}</p>
                      <p className="text-xs" style={{color:'var(--text-3)'}}>{st.l}</p>
                    </div>
                  ))}
                </div>

                {/* Barra de confiabilidad */}
                <div>
                  <div className="flex justify-between mb-1">
                    <p className="text-xs font-semibold" style={{color:'var(--text-3)'}}>Confiabilidad</p>
                    <p className="text-xs font-bold" style={{color:fallas>30?'#ef4444':fallas>10?'#f59e0b':'#10b981'}}>
                      {100-fallas}%
                    </p>
                  </div>
                  <div className="h-2 rounded-full" style={{background:'var(--border)'}}>
                    <div className="h-2 rounded-full transition-all" style={{
                      width:`${Math.min(100,100-fallas)}%`,
                      background: fallas>30?'#ef4444':fallas>10?'#f59e0b':'#10b981'
                    }}/>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs" style={{color:'var(--text-3)'}}>
                    Invertido: <strong style={{color:'var(--text)'}}>{formatMoneda(s.totalInvertido||0)}</strong>
                  </p>
                  {p.notas&&<p className="text-xs max-w-24 truncate" style={{color:'var(--text-3)'}}>{p.notas}</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL CREAR/EDITAR */}
      {modalOpen && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setMOpen(false)}>
          <div className="modal-content animate-slide-up max-w-md">
            <div className="modal-header">
              <h2 className="text-lg font-bold" style={{color:'var(--text)'}}>{editando?'Editar proveedor':'Nuevo proveedor'}</h2>
              <button className="btn-ghost p-1.5" onClick={()=>setMOpen(false)}><X size={18}/></button>
            </div>
            <div className="modal-body">
              <div className="space-y-4">
                <div>
                  <label className="label">Nombre *</label>
                  <input className="input" placeholder="Nombre del proveedor" value={fp.nombre} onChange={e=>setFp(f=>({...f,nombre:e.target.value}))}/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Teléfono</label>
                    <input className="input" placeholder="+52 xxx xxx xxxx" value={fp.telefono} onChange={e=>setFp(f=>({...f,telefono:e.target.value}))}/>
                  </div>
                  <div>
                    <label className="label">WhatsApp</label>
                    <input className="input" placeholder="+52 xxx xxx xxxx" value={fp.whatsapp} onChange={e=>setFp(f=>({...f,whatsapp:e.target.value}))}/>
                  </div>
                </div>
                <div>
                  <label className="label">Notas</label>
                  <textarea className="input" rows={3} placeholder="Plataformas que vende, condiciones, observaciones..." value={fp.notas} onChange={e=>setFp(f=>({...f,notas:e.target.value}))}/>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={()=>setMOpen(false)}>Cancelar</button>
              <button className="btn-primary" onClick={guardarProveedor}><CheckCircle size={15}/>{editando?'Actualizar':'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE PROVEEDOR */}
      {verDetalle && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setVerD(null)}>
          <div className="modal-content animate-slide-up max-w-2xl">
            <div className="modal-header">
              <div>
                <h2 className="text-lg font-bold" style={{color:'var(--text)'}}>{verDetalle.nombre}</h2>
                <p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>
                  {detalleCuentas.length} cuentas registradas
                </p>
              </div>
              <button className="btn-ghost p-1.5" onClick={()=>setVerD(null)}><X size={18}/></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Info contacto */}
              <div className="grid grid-cols-2 gap-3">
                {verDetalle.telefono&&<div className="p-3 rounded-xl" style={{background:'var(--surface-2)'}}>
                  <p className="text-xs font-bold" style={{color:'var(--text-3)'}}>TELÉFONO</p>
                  <p className="text-sm font-semibold mt-1">{verDetalle.telefono}</p>
                </div>}
                {verDetalle.whatsapp&&<div className="p-3 rounded-xl" style={{background:'var(--surface-2)'}}>
                  <p className="text-xs font-bold" style={{color:'var(--text-3)'}}>WHATSAPP</p>
                  <a href={`https://wa.me/${verDetalle.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                    className="text-sm font-semibold text-emerald-600 hover:underline block mt-1">{verDetalle.whatsapp}</a>
                </div>}
                {verDetalle.notas&&<div className="p-3 rounded-xl col-span-2" style={{background:'var(--surface-2)'}}>
                  <p className="text-xs font-bold" style={{color:'var(--text-3)'}}>NOTAS</p>
                  <p className="text-sm mt-1">{verDetalle.notas}</p>
                </div>}
              </div>

              {/* Cuentas del proveedor */}
              <h3 className="font-bold text-sm" style={{color:'var(--text)'}}>Cuentas compradas ({detalleCuentas.length})</h3>
              {detalleCuentas.length===0 ? (
                <p className="text-sm text-center py-6" style={{color:'var(--text-3)'}}>Sin cuentas registradas</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {detalleCuentas.map(c=>(
                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl" style={{background:'var(--surface-2)'}}>
                      <span className="text-lg flex-shrink-0">{(c.plataformas as any)?.icono}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{c.correo}</p>
                        <p className="text-xs" style={{color:'var(--text-3)'}}>{(c.plataformas as any)?.nombre} · Vence: {formatFecha(c.fecha_vencimiento)}</p>
                      </div>
                      <div className="text-right">
                        <span className={`badge text-xs ${c.estado==='disponible'?'bg-emerald-100 text-emerald-700':c.estado==='reportada'?'bg-red-100 text-red-700':'bg-gray-100 text-gray-600'}`}>{c.estado}</span>
                        <p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>{formatMoneda(c.costo)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
