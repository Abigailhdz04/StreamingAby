'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatMoneda, formatFecha, calcularDiasRestantes } from '@/lib/utils'
import { Layers, Plus, X, CheckCircle, ShoppingCart, Eye, Trash2, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { addDays, format, parseISO } from 'date-fns'

export default function CombosPage() {
  const [combos, setCombos]         = useState<any[]>([])
  const [plataformas, setPlats]     = useState<any[]>([])
  const [clientes, setClientes]     = useState<any[]>([])
  const [cuentasPlat, setCuentasP]  = useState<Record<string,any[]>>({})
  const [perfilesC, setPerfilesC]   = useState<Record<string,any[]>>({})
  const [loading, setLoading]       = useState(true)
  const [modalCombo, setMCombo]     = useState(false)
  const [modalVenta, setMVenta]     = useState<any|null>(null)
  const [editando, setEdit]         = useState<any|null>(null)

  const [fCombo, setFC] = useState({ nombre:'', descripcion:'', precio_venta:'0', costo_total:'0' })
  const [items, setItems] = useState<any[]>([])

  const [fVenta, setFV] = useState({
    cliente_id:'', fecha_inicio: new Date().toISOString().split('T')[0],
    precio_venta:'', costo_real:'', estado_pago:'pendiente', metodo_pago:'efectivo', notas:''
  })
  const [itemsVenta, setItemsV] = useState<any[]>([]) // [{ plataforma_id, cuenta_id, perfil_id, dias }]

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data:co },{ data:pl },{ data:cl }] = await Promise.all([
      supabase.from('combos').select(`*, combo_items(*, plataformas(nombre,icono,color))`).order('created_at',{ ascending:false }),
      supabase.from('plataformas').select('*').eq('activo',true).order('nombre'),
      supabase.from('clientes').select('id,nombre').eq('estado','activo').order('nombre'),
    ])
    setCombos(co||[])
    setPlats(pl||[])
    setClientes(cl||[])
    setLoading(false)
  }, [])
  useEffect(()=>{ load() },[load])

  async function cargarCuentas(platId: string) {
    if (cuentasPlat[platId]) return
    const { data } = await supabase.from('cuentas')
      .select('*').eq('plataforma_id',platId).in('estado',['disponible','parcial'])
    setCuentasP(p=>({...p,[platId]:data||[]}))
  }
  async function cargarPerfiles(cuentaId: string) {
    if (perfilesC[cuentaId]) return
    const { data } = await supabase.from('perfiles')
      .select('*').eq('cuenta_id',cuentaId).eq('estado','libre')
    setPerfilesC(p=>({...p,[cuentaId]:data||[]}))
  }

  // Guardar definición del combo
  async function guardarCombo() {
    if (!fCombo.nombre.trim()||items.length===0)
      return toast.error('Nombre y al menos 1 plataforma requeridos')
    const tid = toast.loading(editando?'Actualizando...':'Guardando combo...')
    try {
      let comboId: string
      if (editando) {
        await supabase.from('combos').update({
          nombre:fCombo.nombre, descripcion:fCombo.descripcion||null,
          precio_venta:Number(fCombo.precio_venta), costo_total:Number(fCombo.costo_total)
        }).eq('id',editando.id)
        comboId = editando.id
        await supabase.from('combo_items').delete().eq('combo_id',comboId)
      } else {
        const { data:c } = await supabase.from('combos').insert({
          nombre:fCombo.nombre, descripcion:fCombo.descripcion||null,
          precio_venta:Number(fCombo.precio_venta), costo_total:Number(fCombo.costo_total)
        }).select().single()
        comboId = (c as any).id
      }
      for (const it of items) {
        await supabase.from('combo_items').insert({
          combo_id:comboId, plataforma_id:it.plataforma_id,
          tipo:it.tipo, dias_duracion:it.dias_duracion||30, notas:it.notas||null
        })
      }
      toast.success(editando?'Combo actualizado ✅':'Combo creado ✅',{ id:tid })
      setMCombo(false); setEdit(null); resetCombo(); load()
    } catch(e:any){ toast.error(e.message||'Error',{ id:tid }) }
  }

  // Vender combo
  async function venderCombo() {
    if (!fVenta.cliente_id) return toast.error('Selecciona un cliente')
    if (!fVenta.precio_venta) return toast.error('Indica el precio')
    const ok = itemsVenta.every(iv=>iv.perfil_id)
    if (!ok) return toast.error('Asigna cuenta y perfil a cada plataforma del combo')
    const tid = toast.loading('Procesando venta de combo...')
    try {
      const diasBase = 30
      const fechaV = format(addDays(parseISO(fVenta.fecha_inicio), diasBase),'yyyy-MM-dd')
      const { data:vc } = await supabase.from('ventas_combo').insert({
        combo_id:modalVenta.id, cliente_id:fVenta.cliente_id,
        fecha_inicio:fVenta.fecha_inicio, fecha_vencimiento:fechaV,
        precio_venta:Number(fVenta.precio_venta), costo_real:Number(fVenta.costo_real)||0,
        estado_pago:fVenta.estado_pago, metodo_pago:fVenta.metodo_pago,
        estado:'activa', notas:fVenta.notas||null
      }).select().single()

      // Crear una venta individual por cada item del combo
      for (const iv of itemsVenta) {
        const platItem = modalVenta.combo_items?.find((ci:any)=>ci.plataforma_id===iv.plataforma_id)
        const dias = platItem?.dias_duracion||30
        const fechaVItem = format(addDays(parseISO(fVenta.fecha_inicio),dias),'yyyy-MM-dd')
        await supabase.from('ventas').insert({
          cliente_id:fVenta.cliente_id, plataforma_id:iv.plataforma_id,
          cuenta_id:iv.cuenta_id, perfil_id:iv.perfil_id,
          nombre_perfil_asignado:iv.nombre_perfil||null,
          fecha_inicio:fVenta.fecha_inicio, fecha_vencimiento:fechaVItem,
          dias_contratados:dias, dias_consumidos:0,
          precio_venta:0, costo_real:0, garantia:true,
          estado:'activa', estado_pago:'pagado',
          notas:`Parte del combo: ${modalVenta.nombre}`
        })
        await supabase.from('perfiles').update({ estado:'ocupado', nombre_perfil:iv.nombre_perfil||null }).eq('id',iv.perfil_id)
        // Actualizar contadores cuenta
        const cta = (cuentasPlat[iv.plataforma_id]||[]).find((c:any)=>c.id===iv.cuenta_id)
        if (cta) {
          await supabase.from('cuentas').update({
            perfiles_ocupados:(cta.perfiles_ocupados||0)+1,
            perfiles_disponibles:(cta.perfiles_disponibles||1)-1,
            estado:cta.perfiles_disponibles<=1?'llena':'parcial'
          }).eq('id',iv.cuenta_id)
        }
      }
      await supabase.from('movimientos').insert({
        tipo:'venta_combo_creada',
        descripcion:`Combo "${modalVenta.nombre}" vendido. ${formatMoneda(Number(fVenta.precio_venta))}`,
        entidad_tipo:'combo', entidad_id:(vc as any).id, cliente_id:fVenta.cliente_id
      })
      toast.success('¡Combo vendido! ✅',{ id:tid })
      setMVenta(null); load()
    } catch(e:any){ toast.error(e.message||'Error',{ id:tid }) }
  }

  async function eliminarCombo(id: string) {
    if (!confirm('¿Eliminar este combo?')) return
    await supabase.from('combos').delete().eq('id',id)
    toast.success('Combo eliminado')
    load()
  }

  function addItem() {
    setItems(i=>[...i,{ plataforma_id:'',tipo:'perfil',dias_duracion:30,notas:'' }])
  }
  function removeItem(idx: number) { setItems(i=>i.filter((_,j)=>j!==idx)) }
  function updateItem(idx: number, key: string, val: any) {
    setItems(i=>i.map((it,j)=>j===idx?{...it,[key]:val}:it))
  }
  function resetCombo() {
    setFC({ nombre:'',descripcion:'',precio_venta:'0',costo_total:'0' })
    setItems([])
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <Layers className="w-5 h-5" style={{color:'var(--brand)'}}/> Combos
          </h1>
          <p className="text-sm mt-0.5" style={{color:'var(--text-3)'}}>Paquetes con múltiples plataformas</p>
        </div>
        <button className="btn-primary" onClick={()=>{resetCombo();setEdit(null);setMCombo(true)}}>
          <Plus size={15}/> Nuevo combo
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{color:'var(--text-3)'}}>Cargando...</div>
      ) : combos.length===0 ? (
        <div className="card p-12 text-center">
          <Layers size={40} className="mx-auto mb-3 opacity-20" style={{color:'var(--brand)'}}/>
          <p className="font-semibold" style={{color:'var(--text-2)'}}>Sin combos creados</p>
          <p className="text-sm mt-1" style={{color:'var(--text-3)'}}>Crea un combo para vender múltiples plataformas juntas</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
          {combos.map(combo=>(
            <div key={combo.id} className="card-hover p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-base" style={{color:'var(--text)'}}>{combo.nombre}</h3>
                  {combo.descripcion&&<p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>{combo.descripcion}</p>}
                </div>
                <div className="flex gap-1">
                  <button className="btn-ghost p-1.5" onClick={()=>{ setEdit(combo); setFC({nombre:combo.nombre,descripcion:combo.descripcion||'',precio_venta:String(combo.precio_venta),costo_total:String(combo.costo_total)}); setItems((combo.combo_items||[]).map((ci:any)=>({plataforma_id:ci.plataforma_id,tipo:ci.tipo,dias_duracion:ci.dias_duracion,notas:ci.notas||''}))); setMCombo(true) }} title="Editar"><Edit2 size={13}/></button>
                  <button className="btn-ghost p-1.5 text-red-500" onClick={()=>eliminarCombo(combo.id)} title="Eliminar"><Trash2 size={13}/></button>
                </div>
              </div>

              {/* Plataformas del combo */}
              <div className="flex flex-wrap gap-2">
                {(combo.combo_items||[]).map((ci:any)=>(
                  <div key={ci.id} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
                    style={{background:`${ci.plataformas?.color}20`,color:ci.plataformas?.color}}>
                    {ci.plataformas?.icono} {ci.plataformas?.nombre}
                    <span className="opacity-60">·{ci.dias_duracion}d</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t" style={{borderColor:'var(--border)'}}>
                <div>
                  <p className="text-lg font-bold" style={{color:'var(--brand)'}}>{formatMoneda(combo.precio_venta)}</p>
                  <p className="text-xs" style={{color:'var(--text-3)'}}>costo: {formatMoneda(combo.costo_total)}</p>
                </div>
                <button className="btn-primary text-xs py-1.5 px-3"
                  onClick={()=>{
                    setMVenta(combo)
                    setFV({ cliente_id:'',fecha_inicio:new Date().toISOString().split('T')[0],precio_venta:String(combo.precio_venta),costo_real:String(combo.costo_total),estado_pago:'pendiente',metodo_pago:'efectivo',notas:'' })
                    const iv = (combo.combo_items||[]).map((ci:any)=>({ plataforma_id:ci.plataforma_id,cuenta_id:'',perfil_id:'',nombre_perfil:'',dias:ci.dias_duracion||30 }))
                    setItemsV(iv)
                    iv.forEach((i:any)=>{ cargarCuentas(i.plataforma_id) })
                  }}>
                  <ShoppingCart size={13}/> Vender
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MODAL CREAR/EDITAR COMBO ── */}
      {modalCombo && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setMCombo(false)}>
          <div className="modal-content animate-slide-up">
            <div className="modal-header">
              <h2 className="text-lg font-bold" style={{color:'var(--text)'}}>{editando?'Editar combo':'Nuevo combo'}</h2>
              <button className="btn-ghost p-1.5" onClick={()=>setMCombo(false)}><X size={18}/></button>
            </div>
            <div className="modal-body">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Nombre del combo *</label>
                  <input className="input" placeholder="Ej: Pack Entretenimiento, Combo Familiar..." value={fCombo.nombre} onChange={e=>setFC(f=>({...f,nombre:e.target.value}))}/>
                </div>
                <div className="col-span-2">
                  <label className="label">Descripción</label>
                  <textarea className="input" rows={2} placeholder="Qué incluye el combo..." value={fCombo.descripcion} onChange={e=>setFC(f=>({...f,descripcion:e.target.value}))}/>
                </div>
                <div>
                  <label className="label">Precio de venta (MXN)</label>
                  <input className="input" type="number" step="0.01" value={fCombo.precio_venta} onChange={e=>setFC(f=>({...f,precio_venta:e.target.value}))}/>
                </div>
                <div>
                  <label className="label">Costo total (MXN)</label>
                  <input className="input" type="number" step="0.01" value={fCombo.costo_total} onChange={e=>setFC(f=>({...f,costo_total:e.target.value}))}/>
                </div>
              </div>

              {/* Items del combo */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="label mb-0">Plataformas incluidas</label>
                  <button className="btn-secondary text-xs py-1 px-3" onClick={addItem}><Plus size={12}/>Agregar</button>
                </div>
                <div className="space-y-3">
                  {items.map((it,idx)=>(
                    <div key={idx} className="grid grid-cols-3 gap-2 p-3 rounded-xl" style={{background:'var(--surface-2)',border:'1px solid var(--border)'}}>
                      <div>
                        <label className="label">Plataforma</label>
                        <select className="select text-xs" value={it.plataforma_id} onChange={e=>updateItem(idx,'plataforma_id',e.target.value)}>
                          <option value="">Seleccionar...</option>
                          {plataformas.map(p=><option key={p.id} value={p.id}>{p.icono} {p.nombre}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label">Tipo</label>
                        <select className="select text-xs" value={it.tipo} onChange={e=>updateItem(idx,'tipo',e.target.value)}>
                          <option value="perfil">👤 Perfil</option>
                          <option value="cuenta_completa">🗂 Completa</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">Días</label>
                        <div className="flex gap-1">
                          <input className="input text-xs" type="number" min={1} value={it.dias_duracion} onChange={e=>updateItem(idx,'dias_duracion',Number(e.target.value))}/>
                          <button className="btn-ghost p-1.5 text-red-500" onClick={()=>removeItem(idx)}><X size={12}/></button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {items.length===0&&<p className="text-sm text-center py-4" style={{color:'var(--text-3)'}}>Agrega al menos una plataforma</p>}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={()=>setMCombo(false)}>Cancelar</button>
              <button className="btn-primary" onClick={guardarCombo}><CheckCircle size={15}/>{editando?'Actualizar':'Crear combo'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL VENDER COMBO ── */}
      {modalVenta && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setMVenta(null)}>
          <div className="modal-content animate-slide-up max-w-2xl">
            <div className="modal-header">
              <h2 className="text-lg font-bold" style={{color:'var(--text)'}}>Vender: {modalVenta.nombre}</h2>
              <button className="btn-ghost p-1.5" onClick={()=>setMVenta(null)}><X size={18}/></button>
            </div>
            <div className="modal-body">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="col-span-2">
                  <label className="label">Cliente *</label>
                  <select className="select" value={fVenta.cliente_id} onChange={e=>setFV(f=>({...f,cliente_id:e.target.value}))}>
                    <option value="">Seleccionar cliente...</option>
                    {clientes.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Fecha inicio</label>
                  <input className="input" type="date" value={fVenta.fecha_inicio} onChange={e=>setFV(f=>({...f,fecha_inicio:e.target.value}))}/>
                </div>
                <div>
                  <label className="label">Precio venta (MXN)</label>
                  <input className="input" type="number" step="0.01" value={fVenta.precio_venta} onChange={e=>setFV(f=>({...f,precio_venta:e.target.value}))}/>
                </div>
                <div>
                  <label className="label">Estado pago</label>
                  <select className="select" value={fVenta.estado_pago} onChange={e=>setFV(f=>({...f,estado_pago:e.target.value}))}>
                    <option value="pagado">✅ Pagado</option>
                    <option value="pendiente">⏳ Pendiente</option>
                  </select>
                </div>
                <div>
                  <label className="label">Método pago</label>
                  <select className="select" value={fVenta.metodo_pago} onChange={e=>setFV(f=>({...f,metodo_pago:e.target.value}))}>
                    {['efectivo','transferencia','tarjeta','mercadopago','paypal','otro'].map(m=><option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Asignar cuenta/perfil por plataforma */}
              <h3 className="font-bold text-sm mb-3" style={{color:'var(--text)'}}>Asignar cuentas y perfiles:</h3>
              <div className="space-y-3">
                {itemsVenta.map((iv,idx)=>{
                  const platInfo = plataformas.find(p=>p.id===iv.plataforma_id)
                  const cuentasDisp = cuentasPlat[iv.plataforma_id]||[]
                  const perfsDisp   = (iv.cuenta_id&&perfilesC[iv.cuenta_id])||[]
                  return (
                    <div key={idx} className="p-3 rounded-xl space-y-2" style={{background:'var(--surface-2)',border:'1px solid var(--border)'}}>
                      <div className="flex items-center gap-2">
                        <span style={{backgroundColor:`${platInfo?.color}25`}} className="w-7 h-7 rounded-lg flex items-center justify-center text-sm">{platInfo?.icono}</span>
                        <p className="font-semibold text-sm" style={{color:'var(--text)'}}>{platInfo?.nombre} · {iv.dias}d</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="label">Cuenta</label>
                          <select className="select text-xs" value={iv.cuenta_id} onChange={e=>{
                            const nv=[...itemsVenta]; nv[idx]={...nv[idx],cuenta_id:e.target.value,perfil_id:''}; setItemsV(nv)
                            cargarPerfiles(e.target.value)
                          }}>
                            <option value="">Seleccionar...</option>
                            {cuentasDisp.map((c:any)=><option key={c.id} value={c.id}>{c.correo} ({c.perfiles_disponibles}l)</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="label">Perfil</label>
                          <select className="select text-xs" value={iv.perfil_id} onChange={e=>{ const nv=[...itemsVenta];nv[idx]={...nv[idx],perfil_id:e.target.value};setItemsV(nv) }} disabled={!iv.cuenta_id}>
                            <option value="">Seleccionar...</option>
                            {perfsDisp.map((p:any)=><option key={p.id} value={p.id}>#{p.numero_perfil} {p.nombre_perfil||''}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="label">Nombre perfil</label>
                          <input className="input text-xs" placeholder="Ej: Rosa" value={iv.nombre_perfil} onChange={e=>{ const nv=[...itemsVenta];nv[idx]={...nv[idx],nombre_perfil:e.target.value};setItemsV(nv) }}/>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={()=>setMVenta(null)}>Cancelar</button>
              <button className="btn-primary" onClick={venderCombo}><CheckCircle size={15}/>Vender combo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
