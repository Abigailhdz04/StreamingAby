'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatMoneda, formatFecha } from '@/lib/utils'
import { Film, Plus, X, CheckCircle, ShoppingCart, Eye, Edit2, Trash2, Search, ExternalLink, Copy } from 'lucide-react'
import toast from 'react-hot-toast'

export default function PeliculasPage() {
  const [peliculas, setPels]    = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [ventas, setVentas]     = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [busqueda, setBusq]     = useState('')
  const [tab, setTab]           = useState<'catalogo'|'ventas'>('catalogo')
  const [modalPel, setMPel]     = useState(false)
  const [modalVenta, setMVenta] = useState<any|null>(null)
  const [editando, setEdit]     = useState<any|null>(null)
  const [verDetalle, setVerD]   = useState<any|null>(null)

  const [fp, setFp] = useState({
    titulo:'', genero:'', año: new Date().getFullYear(), drive_url:'',
    descripcion:'', imagen_url:'', costo_compra:'0', precio_venta:'0',
    disponible:true, notas:''
  })
  const [fv, setFv] = useState({
    cliente_id:'', precio_venta:'', metodo_pago:'efectivo',
    estado_pago:'pendiente', drive_url_enviada:'', notas:''
  })

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data:p },{ data:c },{ data:v }] = await Promise.all([
      supabase.from('peliculas').select('*').order('titulo'),
      supabase.from('clientes').select('id,nombre').eq('estado','activo').order('nombre'),
      supabase.from('ventas_peliculas')
        .select('*, peliculas(titulo), clientes(nombre,whatsapp)')
        .order('created_at',{ ascending:false }),
    ])
    setPels(p||[])
    setClientes(c||[])
    setVentas(v||[])
    setLoading(false)
  }, [])
  useEffect(()=>{ load() },[load])

  async function guardarPelicula() {
    if (!fp.titulo.trim()) return toast.error('El título es requerido')
    const tid = toast.loading(editando?'Actualizando...':'Guardando...')
    try {
      const payload = {
        titulo:fp.titulo, genero:fp.genero||null, año:Number(fp.año)||null,
        drive_url:fp.drive_url||null, descripcion:fp.descripcion||null,
        imagen_url:fp.imagen_url||null,
        costo_compra:Number(fp.costo_compra)||0,
        precio_venta:Number(fp.precio_venta)||0,
        disponible:fp.disponible, notas:fp.notas||null
      }
      if (editando) {
        const { error } = await supabase.from('peliculas').update(payload).eq('id',editando.id)
        if (error) throw error
        toast.success('Película actualizada ✅',{ id:tid })
      } else {
        const { error } = await supabase.from('peliculas').insert(payload)
        if (error) throw error
        toast.success('Película agregada ✅',{ id:tid })
      }
      setMPel(false); setEdit(null); resetFp(); load()
    } catch(e:any){ toast.error(e.message||'Error',{ id:tid }) }
  }

  async function venderPelicula() {
    if (!fv.cliente_id) return toast.error('Selecciona un cliente')
    if (!fv.precio_venta) return toast.error('Indica el precio')
    const pel = modalVenta
    const tid = toast.loading('Registrando venta...')
    try {
      await supabase.from('ventas_peliculas').insert({
        pelicula_id:pel.id, cliente_id:fv.cliente_id,
        precio_venta:Number(fv.precio_venta),
        metodo_pago:fv.metodo_pago, estado_pago:fv.estado_pago,
        drive_url_enviada:fv.drive_url_enviada||pel.drive_url||null,
        notas:fv.notas||null
      })
      // Incrementar contador de ventas
      await supabase.from('peliculas').update({ veces_vendida:(pel.veces_vendida||0)+1 }).eq('id',pel.id)
      await supabase.from('movimientos').insert({
        tipo:'venta_pelicula',
        descripcion:`Película "${pel.titulo}" vendida. ${formatMoneda(Number(fv.precio_venta))}`,
        entidad_tipo:'pelicula', entidad_id:pel.id
      })
      toast.success('Venta registrada ✅',{ id:tid })
      setMVenta(null)
      setFv({ cliente_id:'',precio_venta:'',metodo_pago:'efectivo',estado_pago:'pendiente',drive_url_enviada:'',notas:'' })
      load()
    } catch(e:any){ toast.error(e.message||'Error',{ id:tid }) }
  }

  async function eliminarPelicula(id: string, titulo: string) {
    if (!confirm(`¿Eliminar "${titulo}"?`)) return
    await supabase.from('peliculas').delete().eq('id',id)
    toast.success('Película eliminada')
    load()
  }

  function resetFp() {
    setFp({ titulo:'',genero:'',año:new Date().getFullYear(),drive_url:'',descripcion:'',imagen_url:'',costo_compra:'0',precio_venta:'0',disponible:true,notas:'' })
  }
  function abrirEditar(p: any) {
    setEdit(p)
    setFp({ titulo:p.titulo,genero:p.genero||'',año:p.año||new Date().getFullYear(),drive_url:p.drive_url||'',descripcion:p.descripcion||'',imagen_url:p.imagen_url||'',costo_compra:String(p.costo_compra),precio_venta:String(p.precio_venta),disponible:p.disponible,notas:p.notas||'' })
    setMPel(true)
  }
  function copiar(txt: string, q: string) { navigator.clipboard.writeText(txt); toast.success(`${q} copiado`) }

  const pelsFilt = peliculas.filter(p=>{
    const b=busqueda.toLowerCase()
    return !busqueda||p.titulo?.toLowerCase().includes(b)||p.genero?.toLowerCase().includes(b)
  })

  const GENEROS = ['Acción','Comedia','Drama','Terror','Romance','Animación','Ciencia ficción','Thriller','Documental','Familia','Aventura','Fantasy','Otro']

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <Film className="w-5 h-5" style={{color:'var(--brand)'}}/> Películas
          </h1>
          <p className="text-sm mt-0.5" style={{color:'var(--text-3)'}}>
            {peliculas.filter(p=>p.disponible).length} disponibles · {ventas.length} ventas
          </p>
        </div>
        <button className="btn-primary" onClick={()=>{resetFp();setEdit(null);setMPel(true)}}>
          <Plus size={15}/> Agregar película
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b" style={{borderColor:'var(--border)'}}>
        {(['catalogo','ventas'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab===t?'border-pink-500 text-pink-600':'border-transparent'}`}
            style={{color:tab===t?'var(--brand)':'var(--text-3)'}}>
            {t==='catalogo'?'🎬 Catálogo':'🛒 Ventas'}
          </button>
        ))}
      </div>

      {tab==='catalogo' && (
        <>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color:'var(--text-3)'}}/>
            <input className="input pl-9" placeholder="Buscar título, género..." value={busqueda} onChange={e=>setBusq(e.target.value)}/>
          </div>

          {loading ? (
            <div className="text-center py-16" style={{color:'var(--text-3)'}}>Cargando...</div>
          ) : pelsFilt.length===0 ? (
            <div className="card p-12 text-center">
              <Film size={40} className="mx-auto mb-3 opacity-20" style={{color:'var(--brand)'}}/>
              <p className="font-semibold" style={{color:'var(--text-2)'}}>Sin películas en catálogo</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
              {pelsFilt.map(p=>(
                <div key={p.id} className="card-hover overflow-hidden">
                  {/* Poster / header */}
                  <div className="h-24 flex items-center justify-center text-5xl"
                    style={{background:p.disponible?'linear-gradient(135deg,#fde8f6,#e8d5f8)':'linear-gradient(135deg,#f1f5f9,#e2e8f0)'}}>
                    {p.imagen_url ? <img src={p.imagen_url} alt={p.titulo} className="h-full w-full object-cover"/> : '🎬'}
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-sm leading-tight" style={{color:'var(--text)'}}>{p.titulo}</h3>
                        <p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>{p.genero||'—'} {p.año?`· ${p.año}`:''}</p>
                      </div>
                      <span className={`badge text-xs flex-shrink-0 ${p.disponible?'bg-emerald-100 text-emerald-700':'bg-gray-100 text-gray-500'}`}>
                        {p.disponible?'✅ Disponible':'No disp.'}
                      </span>
                    </div>

                    {p.descripcion&&<p className="text-xs line-clamp-2" style={{color:'var(--text-3)'}}>{p.descripcion}</p>}

                    <div className="flex items-center justify-between text-xs pt-1">
                      <div>
                        <p className="font-bold text-base" style={{color:'var(--brand)'}}>{formatMoneda(p.precio_venta)}</p>
                        <p style={{color:'var(--text-3)'}}>costo: {formatMoneda(p.costo_compra)} · {p.veces_vendida}x vendida</p>
                      </div>
                    </div>

                    {p.drive_url&&(
                      <div className="flex items-center gap-2">
                        <a href={p.drive_url} target="_blank" rel="noreferrer"
                          className="text-xs underline flex items-center gap-1" style={{color:'var(--accent)'}}>
                          <ExternalLink size={11}/> Ver en Drive
                        </a>
                        <button onClick={()=>copiar(p.drive_url,'Link Drive')} className="text-xs" style={{color:'var(--text-3)'}}>
                          <Copy size={11}/>
                        </button>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button className="btn-primary flex-1 text-xs py-1.5"
                        onClick={()=>{ setMVenta(p); setFv({cliente_id:'',precio_venta:String(p.precio_venta),metodo_pago:'efectivo',estado_pago:'pendiente',drive_url_enviada:p.drive_url||'',notas:''}) }}>
                        <ShoppingCart size={12}/> Vender
                      </button>
                      <button className="btn-secondary py-1.5 px-2" onClick={()=>abrirEditar(p)}><Edit2 size={12}/></button>
                      <button className="btn-ghost py-1.5 px-2 text-red-500" onClick={()=>eliminarPelicula(p.id,p.titulo)}><Trash2 size={12}/></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab==='ventas' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Película</th>
                <th>Cliente</th>
                <th>Precio</th>
                <th>Pago</th>
                <th>Drive enviado</th>
                <th>Fecha</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12" style={{color:'var(--text-3)'}}>Cargando...</td></tr>
              ) : ventas.length===0 ? (
                <tr><td colSpan={7} className="text-center py-12" style={{color:'var(--text-3)'}}>Sin ventas de películas</td></tr>
              ) : ventas.map(v=>(
                <tr key={v.id}>
                  <td className="font-semibold text-sm">{(v.peliculas as any)?.titulo}</td>
                  <td>
                    <p className="font-semibold text-sm">{(v.clientes as any)?.nombre}</p>
                    <p className="text-xs" style={{color:'var(--text-3)'}}>{(v.clientes as any)?.whatsapp}</p>
                  </td>
                  <td className="font-bold text-emerald-600">{formatMoneda(v.precio_venta)}</td>
                  <td>
                    <div className="space-y-0.5">
                      <span className={`badge text-xs ${v.estado_pago==='pagado'?'bg-emerald-100 text-emerald-700':'bg-yellow-100 text-yellow-700'}`}>{v.estado_pago}</span>
                      <p className="text-xs" style={{color:'var(--text-3)'}}>{v.metodo_pago}</p>
                    </div>
                  </td>
                  <td>
                    {v.drive_url_enviada ? (
                      <div className="flex items-center gap-1">
                        <a href={v.drive_url_enviada} target="_blank" rel="noreferrer" className="text-xs underline" style={{color:'var(--accent)'}}>
                          <ExternalLink size={11}/> Drive
                        </a>
                        <button onClick={()=>copiar(v.drive_url_enviada,'Link')} className="opacity-50 hover:opacity-100"><Copy size={10}/></button>
                      </div>
                    ) : <span className="text-xs" style={{color:'var(--text-3)'}}>—</span>}
                  </td>
                  <td className="text-xs" style={{color:'var(--text-3)'}}>{formatFecha(v.created_at)}</td>
                  <td className="text-xs max-w-32 truncate" style={{color:'var(--text-3)'}}>{v.notas||'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MODAL AGREGAR/EDITAR PELÍCULA ── */}
      {modalPel && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setMPel(false)}>
          <div className="modal-content animate-slide-up">
            <div className="modal-header">
              <h2 className="text-lg font-bold" style={{color:'var(--text)'}}>{editando?'Editar película':'Nueva película'}</h2>
              <button className="btn-ghost p-1.5" onClick={()=>setMPel(false)}><X size={18}/></button>
            </div>
            <div className="modal-body">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label">Título *</label>
                  <input className="input" placeholder="Nombre de la película..." value={fp.titulo} onChange={e=>setFp(f=>({...f,titulo:e.target.value}))}/>
                </div>
                <div>
                  <label className="label">Género</label>
                  <select className="select" value={fp.genero} onChange={e=>setFp(f=>({...f,genero:e.target.value}))}>
                    <option value="">Seleccionar...</option>
                    {GENEROS.map(g=><option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Año</label>
                  <input className="input" type="number" placeholder="2024" value={fp.año} onChange={e=>setFp(f=>({...f,año:Number(e.target.value)}))}/>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Link de Google Drive (URL del video)</label>
                  <input className="input" type="url" placeholder="https://drive.google.com/..." value={fp.drive_url} onChange={e=>setFp(f=>({...f,drive_url:e.target.value}))}/>
                  <p className="text-xs mt-1" style={{color:'var(--text-3)'}}>Este link se enviará automáticamente al vender</p>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Descripción / sinopsis</label>
                  <textarea className="input" rows={2} placeholder="Breve descripción..." value={fp.descripcion} onChange={e=>setFp(f=>({...f,descripcion:e.target.value}))}/>
                </div>
                <div>
                  <label className="label">Costo de compra (MXN)</label>
                  <input className="input" type="number" step="0.01" value={fp.costo_compra} onChange={e=>setFp(f=>({...f,costo_compra:e.target.value}))}/>
                </div>
                <div>
                  <label className="label">Precio de venta (MXN)</label>
                  <input className="input" type="number" step="0.01" value={fp.precio_venta} onChange={e=>setFp(f=>({...f,precio_venta:e.target.value}))}/>
                </div>
                <div className="sm:col-span-2 flex items-center gap-3 p-3 rounded-xl" style={{background:'var(--surface-2)',border:'1px solid var(--border)'}}>
                  <input type="checkbox" id="disp" className="w-4 h-4" checked={fp.disponible} onChange={e=>setFp(f=>({...f,disponible:e.target.checked}))}/>
                  <label htmlFor="disp" className="text-sm cursor-pointer font-semibold" style={{color:'var(--text-2)'}}>✅ Disponible para venta</label>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Notas</label>
                  <textarea className="input" rows={2} placeholder="Calidad, formato, observaciones..." value={fp.notas} onChange={e=>setFp(f=>({...f,notas:e.target.value}))}/>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={()=>setMPel(false)}>Cancelar</button>
              <button className="btn-primary" onClick={guardarPelicula}><CheckCircle size={15}/>{editando?'Actualizar':'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL VENDER PELÍCULA ── */}
      {modalVenta && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setMVenta(null)}>
          <div className="modal-content animate-slide-up max-w-md">
            <div className="modal-header">
              <h2 className="text-lg font-bold" style={{color:'var(--text)'}}>🎬 Vender: {modalVenta.titulo}</h2>
              <button className="btn-ghost p-1.5" onClick={()=>setMVenta(null)}><X size={18}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-xl p-3 text-sm" style={{background:'var(--surface-2)',border:'1px solid var(--border)'}}>
                <p style={{color:'var(--text-3)'}}>Película: <strong style={{color:'var(--text)'}}>{modalVenta.titulo}</strong></p>
                <p style={{color:'var(--text-3)'}}>Vendida {modalVenta.veces_vendida}x veces · el cliente la conserva para siempre</p>
              </div>
              <div>
                <label className="label">Cliente *</label>
                <select className="select" value={fv.cliente_id} onChange={e=>setFv(f=>({...f,cliente_id:e.target.value}))}>
                  <option value="">Seleccionar cliente...</option>
                  {clientes.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Precio de venta (MXN)</label>
                <input className="input" type="number" step="0.01" value={fv.precio_venta} onChange={e=>setFv(f=>({...f,precio_venta:e.target.value}))}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Estado pago</label>
                  <select className="select" value={fv.estado_pago} onChange={e=>setFv(f=>({...f,estado_pago:e.target.value}))}>
                    <option value="pagado">✅ Pagado</option>
                    <option value="pendiente">⏳ Pendiente</option>
                  </select>
                </div>
                <div>
                  <label className="label">Método</label>
                  <select className="select" value={fv.metodo_pago} onChange={e=>setFv(f=>({...f,metodo_pago:e.target.value}))}>
                    {['efectivo','transferencia','tarjeta','mercadopago','otro'].map(m=><option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Link Drive a enviar al cliente</label>
                <input className="input text-xs font-mono" value={fv.drive_url_enviada} onChange={e=>setFv(f=>({...f,drive_url_enviada:e.target.value}))} placeholder="https://drive.google.com/..."/>
                <p className="text-xs mt-1" style={{color:'var(--text-3)'}}>Se prellenó con el link de la película. Puedes cambiarlo si es diferente.</p>
              </div>
              <div>
                <label className="label">Notas</label>
                <textarea className="input" rows={2} placeholder="Observaciones..." value={fv.notas} onChange={e=>setFv(f=>({...f,notas:e.target.value}))}/>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={()=>setMVenta(null)}>Cancelar</button>
              <button className="btn-primary" onClick={venderPelicula}><CheckCircle size={15}/>Registrar venta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
