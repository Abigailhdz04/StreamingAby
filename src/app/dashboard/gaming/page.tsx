'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatMoneda, formatFecha } from '@/lib/utils'
import { Gamepad2, Plus, X, CheckCircle, ShoppingCart, Edit2, Trash2, Search, Package } from 'lucide-react'
import toast from 'react-hot-toast'

const TIPOS = [
  { v:'pase_boyaah', l:'🎫 Pase Boyaah', d:'Pase de batalla Free Fire' },
  { v:'diamantes',   l:'💎 Diamantes',   d:'Recarga de diamantes Free Fire' },
  { v:'tarjeta',     l:'🃏 Tarjeta',      d:'Gift card / tarjeta de regalo' },
  { v:'otro',        l:'📦 Otro',         d:'Otro producto de gaming' },
]

export default function GamingPage() {
  const [productos, setProds]   = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [ventas, setVentas]     = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [busqueda, setBusq]     = useState('')
  const [tab, setTab]           = useState<'productos'|'ventas'>('productos')
  const [modalProd, setMProd]   = useState(false)
  const [modalVenta, setMVenta] = useState<any|null>(null)
  const [editando, setEdit]     = useState<any|null>(null)

  const [fp, setFp] = useState({
    nombre:'', tipo:'pase_boyaah', juego:'Free Fire',
    cantidad:1, precio_venta:'0', costo_compra:'0',
    stock_disponible:0, descripcion:'', activo:true
  })
  const [fv, setFv] = useState({
    cliente_id:'', cantidad:1, id_juego_cliente:'',
    nombre_juego_cliente:'', precio_venta:'', costo_real:'',
    metodo_pago:'efectivo', estado_pago:'pendiente', notas:''
  })

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data:p },{ data:c },{ data:v }] = await Promise.all([
      supabase.from('gaming_productos').select('*').order('nombre'),
      supabase.from('clientes').select('id,nombre').eq('estado','activo').order('nombre'),
      supabase.from('ventas_gaming')
        .select('*, gaming_productos(nombre,tipo), clientes(nombre,whatsapp)')
        .order('created_at',{ ascending:false }),
    ])
    setProds(p||[])
    setClientes(c||[])
    setVentas(v||[])
    setLoading(false)
  }, [])
  useEffect(()=>{ load() },[load])

  async function guardarProducto() {
    if (!fp.nombre.trim()) return toast.error('El nombre es requerido')
    const tid = toast.loading(editando?'Actualizando...':'Guardando...')
    try {
      const payload = {
        nombre:fp.nombre, tipo:fp.tipo, juego:fp.juego||'Free Fire',
        cantidad:Number(fp.cantidad)||1,
        precio_venta:Number(fp.precio_venta)||0,
        costo_compra:Number(fp.costo_compra)||0,
        stock_disponible:Number(fp.stock_disponible)||0,
        descripcion:fp.descripcion||null, activo:fp.activo
      }
      if (editando) {
        const { error } = await supabase.from('gaming_productos').update(payload).eq('id',editando.id)
        if (error) throw error
        toast.success('Producto actualizado ✅',{ id:tid })
      } else {
        const { error } = await supabase.from('gaming_productos').insert(payload)
        if (error) throw error
        toast.success('Producto creado ✅',{ id:tid })
      }
      setMProd(false); setEdit(null); resetFp(); load()
    } catch(e:any){ toast.error(e.message||'Error',{ id:tid }) }
  }

  async function venderProducto() {
    if (!fv.cliente_id) return toast.error('Selecciona un cliente')
    if (!fv.precio_venta) return toast.error('Indica el precio')
    const prod = modalVenta
    const tid = toast.loading('Registrando venta...')
    try {
      await supabase.from('ventas_gaming').insert({
        gaming_producto_id:prod.id, cliente_id:fv.cliente_id,
        cantidad:Number(fv.cantidad)||1,
        id_juego_cliente:fv.id_juego_cliente||null,
        nombre_juego_cliente:fv.nombre_juego_cliente||null,
        precio_venta:Number(fv.precio_venta),
        costo_real:Number(fv.costo_real)||0,
        metodo_pago:fv.metodo_pago, estado_pago:fv.estado_pago,
        notas:fv.notas||null
      })
      // Descontar stock si aplica
      if (prod.stock_disponible > 0) {
        await supabase.from('gaming_productos').update({
          stock_disponible: Math.max(0, prod.stock_disponible - Number(fv.cantidad))
        }).eq('id',prod.id)
      }
      await supabase.from('movimientos').insert({
        tipo:'venta_gaming',
        descripcion:`Gaming "${prod.nombre}" x${fv.cantidad}. ${formatMoneda(Number(fv.precio_venta))}`,
        entidad_tipo:'gaming',
      })
      toast.success('Venta registrada ✅',{ id:tid })
      setMVenta(null)
      setFv({ cliente_id:'',cantidad:1,id_juego_cliente:'',nombre_juego_cliente:'',precio_venta:'',costo_real:'',metodo_pago:'efectivo',estado_pago:'pendiente',notas:'' })
      load()
    } catch(e:any){ toast.error(e.message||'Error',{ id:tid }) }
  }

  async function eliminarProducto(id: string, nombre: string) {
    if (!confirm(`¿Eliminar "${nombre}"?`)) return
    await supabase.from('gaming_productos').delete().eq('id',id)
    toast.success('Producto eliminado')
    load()
  }

  function resetFp() {
    setFp({ nombre:'',tipo:'pase_boyaah',juego:'Free Fire',cantidad:1,precio_venta:'0',costo_compra:'0',stock_disponible:0,descripcion:'',activo:true })
  }
  function abrirEditar(p: any) {
    setEdit(p)
    setFp({ nombre:p.nombre,tipo:p.tipo,juego:p.juego||'Free Fire',cantidad:p.cantidad,precio_venta:String(p.precio_venta),costo_compra:String(p.costo_compra),stock_disponible:p.stock_disponible,descripcion:p.descripcion||'',activo:p.activo })
    setMProd(true)
  }

  const tipoInfo = (tipo: string) => TIPOS.find(t=>t.v===tipo)||TIPOS[3]
  const prodsFilt = productos.filter(p=>{
    const b=busqueda.toLowerCase()
    return !busqueda||p.nombre?.toLowerCase().includes(b)||p.tipo?.toLowerCase().includes(b)
  })

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <Gamepad2 className="w-5 h-5" style={{color:'var(--brand)'}}/> Gaming
          </h1>
          <p className="text-sm mt-0.5" style={{color:'var(--text-3)'}}>
            Pases Boyaah · Diamantes · Tarjetas · Free Fire
          </p>
        </div>
        <button className="btn-primary" onClick={()=>{resetFp();setEdit(null);setMProd(true)}}>
          <Plus size={15}/> Nuevo producto
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b" style={{borderColor:'var(--border)'}}>
        {(['productos','ventas'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className="px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors"
            style={{borderColor:tab===t?'var(--brand)':'transparent',color:tab===t?'var(--brand)':'var(--text-3)'}}>
            {t==='productos'?'🎮 Productos':'🛒 Ventas'}
          </button>
        ))}
      </div>

      {tab==='productos' && (
        <>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color:'var(--text-3)'}}/>
            <input className="input pl-9" placeholder="Buscar producto..." value={busqueda} onChange={e=>setBusq(e.target.value)}/>
          </div>

          {loading ? (
            <div className="text-center py-16" style={{color:'var(--text-3)'}}>Cargando...</div>
          ) : prodsFilt.length===0 ? (
            <div className="card p-12 text-center">
              <Gamepad2 size={40} className="mx-auto mb-3 opacity-20" style={{color:'var(--brand)'}}/>
              <p className="font-semibold" style={{color:'var(--text-2)'}}>Sin productos gaming</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
              {prodsFilt.map(p=>{
                const tipo = tipoInfo(p.tipo)
                return (
                  <div key={p.id} className="card-hover p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                          style={{background:'linear-gradient(135deg,#fde8f6,#e8d5f8)'}}>
                          {tipo.l.split(' ')[0]}
                        </div>
                        <div>
                          <h3 className="font-bold text-sm" style={{color:'var(--text)'}}>{p.nombre}</h3>
                          <p className="text-xs" style={{color:'var(--text-3)'}}>{tipo.l} · {p.juego}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button className="btn-ghost p-1.5" onClick={()=>abrirEditar(p)}><Edit2 size={12}/></button>
                        <button className="btn-ghost p-1.5 text-red-500" onClick={()=>eliminarProducto(p.id,p.nombre)}><Trash2 size={12}/></button>
                      </div>
                    </div>

                    {p.descripcion&&<p className="text-xs" style={{color:'var(--text-3)'}}>{p.descripcion}</p>}

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center p-2 rounded-lg" style={{background:'var(--surface-2)'}}>
                        <p className="font-bold text-base" style={{color:'var(--brand)'}}>{formatMoneda(p.precio_venta)}</p>
                        <p style={{color:'var(--text-3)'}}>precio</p>
                      </div>
                      <div className="text-center p-2 rounded-lg" style={{background:'var(--surface-2)'}}>
                        <p className="font-bold text-base text-emerald-600">{formatMoneda(p.precio_venta-p.costo_compra)}</p>
                        <p style={{color:'var(--text-3)'}}>ganancia</p>
                      </div>
                      <div className="text-center p-2 rounded-lg" style={{background:'var(--surface-2)'}}>
                        <p className="font-bold text-base" style={{color:p.stock_disponible<3?'#ef4444':'var(--text)'}}>{p.stock_disponible}</p>
                        <p style={{color:'var(--text-3)'}}>stock</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button className="btn-primary flex-1 text-xs py-1.5"
                        onClick={()=>{ setMVenta(p); setFv({...fv,precio_venta:String(p.precio_venta),costo_real:String(p.costo_compra)}) }}>
                        <ShoppingCart size={12}/> Vender
                      </button>
                      <span className={`badge text-xs ${p.activo?'bg-emerald-100 text-emerald-700':'bg-gray-100 text-gray-500'}`}>
                        {p.activo?'Activo':'Inactivo'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {tab==='ventas' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cliente</th>
                <th>ID en juego</th>
                <th>Cant.</th>
                <th>Precio</th>
                <th>Pago</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12" style={{color:'var(--text-3)'}}>Cargando...</td></tr>
              ) : ventas.length===0 ? (
                <tr><td colSpan={7} className="text-center py-12" style={{color:'var(--text-3)'}}>Sin ventas gaming</td></tr>
              ) : ventas.map(v=>(
                <tr key={v.id}>
                  <td>
                    <p className="font-semibold text-sm">{(v.gaming_productos as any)?.nombre}</p>
                    <p className="text-xs" style={{color:'var(--text-3)'}}>{tipoInfo((v.gaming_productos as any)?.tipo).l}</p>
                  </td>
                  <td>
                    <p className="font-semibold text-sm">{(v.clientes as any)?.nombre}</p>
                    <p className="text-xs" style={{color:'var(--text-3)'}}>{(v.clientes as any)?.whatsapp}</p>
                  </td>
                  <td>
                    <div>
                      <p className="text-sm font-mono font-semibold">{v.id_juego_cliente||'—'}</p>
                      {v.nombre_juego_cliente&&<p className="text-xs" style={{color:'var(--text-3)'}}>{v.nombre_juego_cliente}</p>}
                    </div>
                  </td>
                  <td className="font-semibold text-center">{v.cantidad}</td>
                  <td className="font-bold text-emerald-600">{formatMoneda(v.precio_venta)}</td>
                  <td>
                    <span className={`badge text-xs ${v.estado_pago==='pagado'?'bg-emerald-100 text-emerald-700':'bg-yellow-100 text-yellow-700'}`}>{v.estado_pago}</span>
                    <p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>{v.metodo_pago}</p>
                  </td>
                  <td className="text-xs" style={{color:'var(--text-3)'}}>{formatFecha(v.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MODAL CREAR/EDITAR PRODUCTO ── */}
      {modalProd && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setMProd(false)}>
          <div className="modal-content animate-slide-up max-w-lg">
            <div className="modal-header">
              <h2 className="text-lg font-bold" style={{color:'var(--text)'}}>{editando?'Editar producto':'Nuevo producto gaming'}</h2>
              <button className="btn-ghost p-1.5" onClick={()=>setMProd(false)}><X size={18}/></button>
            </div>
            <div className="modal-body">
              <div className="space-y-3">
                <div>
                  <label className="label">Tipo de producto *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {TIPOS.map(t=>(
                      <button key={t.v} onClick={()=>setFp(f=>({...f,tipo:t.v}))}
                        className={`p-2.5 rounded-xl border-2 text-left transition-all`}
                        style={{
                          borderColor:fp.tipo===t.v?'var(--brand)':'var(--border)',
                          background:fp.tipo===t.v?'var(--brand-light)':'transparent'
                        }}>
                        <p className="font-bold text-sm" style={{color:'var(--text)'}}>{t.l}</p>
                        <p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>{t.d}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">Nombre del producto *</label>
                  <input className="input" placeholder="Ej: Pase Boyaah Temporada 20, 100 Diamantes..." value={fp.nombre} onChange={e=>setFp(f=>({...f,nombre:e.target.value}))}/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Juego</label>
                    <input className="input" placeholder="Free Fire" value={fp.juego} onChange={e=>setFp(f=>({...f,juego:e.target.value}))}/>
                  </div>
                  <div>
                    <label className="label">Stock disponible</label>
                    <input className="input" type="number" min={0} value={fp.stock_disponible} onChange={e=>setFp(f=>({...f,stock_disponible:Number(e.target.value)}))}/>
                  </div>
                  <div>
                    <label className="label">Costo compra (MXN)</label>
                    <input className="input" type="number" step="0.01" value={fp.costo_compra} onChange={e=>setFp(f=>({...f,costo_compra:e.target.value}))}/>
                  </div>
                  <div>
                    <label className="label">Precio venta (MXN)</label>
                    <input className="input" type="number" step="0.01" value={fp.precio_venta} onChange={e=>setFp(f=>({...f,precio_venta:e.target.value}))}/>
                  </div>
                </div>
                <div>
                  <label className="label">Descripción</label>
                  <textarea className="input" rows={2} placeholder="Descripción del producto..." value={fp.descripcion} onChange={e=>setFp(f=>({...f,descripcion:e.target.value}))}/>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{background:'var(--surface-2)',border:'1px solid var(--border)'}}>
                  <input type="checkbox" id="actprod" className="w-4 h-4" checked={fp.activo} onChange={e=>setFp(f=>({...f,activo:e.target.checked}))}/>
                  <label htmlFor="actprod" className="text-sm cursor-pointer font-semibold" style={{color:'var(--text-2)'}}>✅ Producto activo</label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={()=>setMProd(false)}>Cancelar</button>
              <button className="btn-primary" onClick={guardarProducto}><CheckCircle size={15}/>{editando?'Actualizar':'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL VENDER ── */}
      {modalVenta && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setMVenta(null)}>
          <div className="modal-content animate-slide-up max-w-md">
            <div className="modal-header">
              <h2 className="text-lg font-bold" style={{color:'var(--text)'}}>
                {tipoInfo(modalVenta.tipo).l.split(' ')[0]} Vender: {modalVenta.nombre}
              </h2>
              <button className="btn-ghost p-1.5" onClick={()=>setMVenta(null)}><X size={18}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-xl p-3 text-sm" style={{background:'var(--surface-2)',border:'1px solid var(--border)'}}>
                <p style={{color:'var(--text-3)'}}>Tipo: <strong>{tipoInfo(modalVenta.tipo).l}</strong></p>
                <p style={{color:'var(--text-3)'}}>Juego: <strong style={{color:'var(--text)'}}>{modalVenta.juego}</strong></p>
                {modalVenta.stock_disponible>0&&<p style={{color:'var(--text-3)'}}>Stock: <strong>{modalVenta.stock_disponible}</strong> disponibles</p>}
              </div>
              <div>
                <label className="label">Cliente *</label>
                <select className="select" value={fv.cliente_id} onChange={e=>setFv(f=>({...f,cliente_id:e.target.value}))}>
                  <option value="">Seleccionar cliente...</option>
                  {clientes.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              {/* ID en el juego — campo clave para Free Fire */}
              <div>
                <label className="label">ID del cliente en el juego *</label>
                <input className="input font-mono" placeholder="Ej: 1234567890" value={fv.id_juego_cliente} onChange={e=>setFv(f=>({...f,id_juego_cliente:e.target.value}))}/>
                <p className="text-xs mt-1" style={{color:'var(--text-3)'}}>El ID de Free Fire / juego al que se enviará</p>
              </div>
              <div>
                <label className="label">Nombre del jugador (en el juego)</label>
                <input className="input" placeholder="Nombre en el juego..." value={fv.nombre_juego_cliente} onChange={e=>setFv(f=>({...f,nombre_juego_cliente:e.target.value}))}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Cantidad</label>
                  <input className="input" type="number" min={1} value={fv.cantidad} onChange={e=>setFv(f=>({...f,cantidad:Number(e.target.value)}))}/>
                </div>
                <div>
                  <label className="label">Precio venta (MXN)</label>
                  <input className="input" type="number" step="0.01" value={fv.precio_venta} onChange={e=>setFv(f=>({...f,precio_venta:e.target.value}))}/>
                </div>
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
                <label className="label">Notas</label>
                <textarea className="input" rows={2} placeholder="Observaciones..." value={fv.notas} onChange={e=>setFv(f=>({...f,notas:e.target.value}))}/>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={()=>setMVenta(null)}>Cancelar</button>
              <button className="btn-primary" onClick={venderProducto}><CheckCircle size={15}/>Registrar venta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
