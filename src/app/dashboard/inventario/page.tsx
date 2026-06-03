'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatFecha, formatMoneda, getBadgeClass, getColorEstado, calcularDiasRestantes } from '@/lib/utils'
import {
  Package, Plus, Search, Eye, Edit2, Trash2, X, CheckCircle,
  Lock, Unlock, AlertTriangle, RefreshCw, MoreVertical, Copy, EyeOff
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const ESTADOS = ['disponible','parcial','llena','vencida','reportada','suspendida']

export default function InventarioPage() {
  const [cuentas, setCuentas]   = useState<any[]>([])
  const [plataformas, setPlats] = useState<any[]>([])
  const [proveedores, setProvs] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [busqueda, setBusq]     = useState('')
  const [filtroPlat, setFPlat]  = useState('')
  const [filtroEst, setFEst]    = useState('')
  const [modalOpen, setModal]   = useState(false)
  const [editando, setEdit]     = useState<any|null>(null)
  const [verPerfiles, setVP]    = useState<any|null>(null)
  const [perfilesCuenta, setPC] = useState<any[]>([])
  const [showPass, setShowPass] = useState<Record<string,boolean>>({})
  const [editPerfil, setEditP]  = useState<any|null>(null)

  const [form, setForm] = useState({
    plataforma_id:'', proveedor_id:'', correo:'', contrasena:'', pin:'',
    tipo:'completa', max_perfiles:5,
    fecha_compra: new Date().toISOString().split('T')[0],
    fecha_vencimiento:'', costo:'', estado:'disponible', notas:''
  })

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data:c },{ data:p },{ data:pr }] = await Promise.all([
      supabase.from('cuentas')
        .select('*, plataformas(nombre,icono,color), proveedores(nombre)')
        .order('created_at',{ ascending:false }),
      supabase.from('plataformas').select('*').eq('activo',true).order('nombre'),
      supabase.from('proveedores').select('*').eq('activo',true).order('nombre'),
    ])
    setCuentas(c||[])
    setPlats(p||[])
    setProvs(pr||[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ──────────────────────────────────────────────────────────
  // FIX CRÍTICO: Al abrir perfiles recalculamos desde DB
  // ──────────────────────────────────────────────────────────
  async function abrirPerfiles(cuenta: any) {
    setVP(cuenta)
    const { data } = await supabase
      .from('perfiles')
      .select(`*, ventas(id,estado,fecha_vencimiento,nombre_perfil_asignado,clientes(nombre))`)
      .eq('cuenta_id', cuenta.id)
      .order('numero_perfil')
    setPC(data || [])
  }

  // ──────────────────────────────────────────────────────────
  // Guardar cuenta con lógica corregida de perfiles
  // ──────────────────────────────────────────────────────────
  async function guardarCuenta() {
    if (!form.plataforma_id || !form.correo || !form.contrasena || !form.fecha_vencimiento)
      return toast.error('Completa los campos requeridos: plataforma, correo, contraseña y vencimiento.')

    // Lógica de perfiles:
    // - tipo "perfil_individual" => SIEMPRE 1 perfil
    // - tipo "completa"         => usa el número que el usuario ingresó
    const numPerfiles = form.tipo === 'perfil_individual' ? 1 : Math.max(1, Number(form.max_perfiles))

    const tid = toast.loading(editando ? 'Actualizando...' : 'Guardando cuenta...')
    try {
      const payload = {
        plataforma_id:   form.plataforma_id,
        proveedor_id:    form.proveedor_id || null,
        correo:          form.correo,
        contrasena:      form.contrasena,
        pin:             form.pin || null,
        tipo:            form.tipo,
        max_perfiles:    numPerfiles,
        perfiles_disponibles: numPerfiles,
        perfiles_ocupados: 0,
        fecha_compra:    form.fecha_compra,
        fecha_vencimiento: form.fecha_vencimiento,
        costo:           Number(form.costo)||0,
        estado:          form.estado,
        notas:           form.notas || null,
      }

      if (editando) {
        // Al editar NO recreamos perfiles (datos existentes)
        const { max_perfiles: _, perfiles_disponibles: __, perfiles_ocupados: ___, ...editPayload } = payload
        const { error } = await supabase.from('cuentas').update(editPayload).eq('id', editando.id)
        if (error) throw error
        toast.success('Cuenta actualizada ✅', { id: tid })
      } else {
        // Al crear, el trigger DB crea exactamente numPerfiles perfiles
        const { error } = await supabase.from('cuentas').insert(payload)
        if (error) throw error
        const plat = plataformas.find(p=>p.id===form.plataforma_id)
        await supabase.from('movimientos').insert({
          tipo:'cuenta_agregada',
          descripcion:`Nueva cuenta ${plat?.nombre||''}: ${form.correo} (${numPerfiles} perfil${numPerfiles>1?'es':''})`,
          entidad_tipo:'cuenta'
        })
        toast.success(`Cuenta creada con ${numPerfiles} perfil${numPerfiles>1?'es':''} ✅`, { id: tid })
      }

      setModal(false)
      setEdit(null)
      resetForm()
      load()
    } catch(e:any) {
      toast.error(e.message||'Error', { id: tid })
    }
  }

  // Eliminar cuenta con confirmación
  async function eliminarCuenta(id: string, correo: string) {
    if (!confirm(`¿Eliminar la cuenta "${correo}"?\n\nSe eliminarán sus perfiles. Si tiene ventas activas no podrá eliminarse.`)) return
    const { error } = await supabase.from('cuentas').delete().eq('id', id)
    if (error) return toast.error('No se puede eliminar: tiene ventas activas asociadas.')
    toast.success('Cuenta eliminada')
    load()
  }

  // Eliminar perfil individual
  async function eliminarPerfil(perfilId: string) {
    if (!confirm('¿Eliminar este perfil? Solo si no tiene ventas activas.')) return
    const { error } = await supabase.from('perfiles').delete().eq('id', perfilId)
    if (error) return toast.error('No se puede eliminar: tiene ventas activas.')
    toast.success('Perfil eliminado')
    // Actualizar contadores de la cuenta
    if (verPerfiles) {
      const remaining = perfilesCuenta.filter(p=>p.id!==perfilId)
      setPC(remaining)
      const libres = remaining.filter(p=>p.estado==='libre').length
      const ocupados = remaining.filter(p=>p.estado==='ocupado').length
      await supabase.from('cuentas').update({
        max_perfiles: remaining.length,
        perfiles_disponibles: libres,
        perfiles_ocupados: ocupados,
        estado: libres===0&&ocupados===0?'disponible': ocupados===remaining.length?'llena':'parcial'
      }).eq('id', verPerfiles.id)
      load()
    }
  }

  // Editar nombre de perfil
  async function guardarNombrePerfil(perfil: any, nuevoNombre: string) {
    await supabase.from('perfiles').update({ nombre_perfil: nuevoNombre }).eq('id', perfil.id)
    toast.success('Nombre actualizado')
    setEditP(null)
    abrirPerfiles(verPerfiles)
  }

  // Liberar perfil manualmente
  async function liberarPerfil(perfil: any) {
    if (!confirm('¿Liberar este perfil manualmente? Úsalo solo si la venta ya terminó o fue cancelada.')) return
    await supabase.from('perfiles').update({ estado:'libre' }).eq('id', perfil.id)
    // Actualizar contadores de cuenta
    const cuenta = cuentas.find(c=>c.id===perfil.cuenta_id)
    if (cuenta) {
      const nuevosDisp = (cuenta.perfiles_disponibles||0)+1
      const nuevosOcup = Math.max(0,(cuenta.perfiles_ocupados||0)-1)
      await supabase.from('cuentas').update({
        perfiles_disponibles: nuevosDisp,
        perfiles_ocupados: nuevosOcup,
        estado: nuevosOcup===0?'disponible':'parcial'
      }).eq('id',perfil.cuenta_id)
    }
    toast.success('Perfil liberado')
    abrirPerfiles(verPerfiles)
    load()
  }

  function resetForm() {
    setForm({ plataforma_id:'',proveedor_id:'',correo:'',contrasena:'',pin:'',
      tipo:'completa',max_perfiles:5,
      fecha_compra:new Date().toISOString().split('T')[0],
      fecha_vencimiento:'',costo:'',estado:'disponible',notas:'' })
  }

  function abrirEditar(c: any) {
    setEdit(c)
    setForm({
      plataforma_id:c.plataforma_id, proveedor_id:c.proveedor_id||'',
      correo:c.correo, contrasena:c.contrasena, pin:c.pin||'',
      tipo:c.tipo, max_perfiles:c.max_perfiles,
      fecha_compra:c.fecha_compra, fecha_vencimiento:c.fecha_vencimiento,
      costo:String(c.costo), estado:c.estado, notas:c.notas||''
    })
    setModal(true)
  }

  function copiar(texto: string, que: string) {
    navigator.clipboard.writeText(texto)
    toast.success(`${que} copiado ✓`)
  }

  const filtradas = cuentas.filter(c => {
    const b = busqueda.toLowerCase()
    const mb = !busqueda||c.correo?.toLowerCase().includes(b)||(c.plataformas as any)?.nombre?.toLowerCase().includes(b)
    const mp = !filtroPlat||c.plataforma_id===filtroPlat
    const me = !filtroEst||c.estado===filtroEst
    return mb&&mp&&me
  })

  const stats = {
    total: cuentas.length,
    disp: cuentas.filter(c=>c.estado==='disponible').length,
    parc: cuentas.filter(c=>c.estado==='parcial').length,
    llenas: cuentas.filter(c=>c.estado==='llena').length,
    venc: cuentas.filter(c=>c.estado==='vencida').length,
    libres: cuentas.reduce((s,c)=>s+(c.perfiles_disponibles||0),0),
  }

  // Color del estado
  const colorEst: Record<string,string> = {
    disponible:'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    parcial:'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    llena:'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    vencida:'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    reportada:'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    suspendida:'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    libre:'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    ocupado:'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <Package className="w-5 h-5" style={{color:'var(--brand)'}} />
            Inventario de Cuentas
          </h1>
          <p className="text-sm mt-0.5" style={{color:'var(--text-3)'}}>
            {cuentas.length} cuentas · {stats.libres} perfiles libres
          </p>
        </div>
        <button className="btn-primary" onClick={()=>{resetForm();setEdit(null);setModal(true)}}>
          <Plus size={15}/> Nueva cuenta
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 stagger-children">
        {[
          {l:'Total',v:stats.total,c:'#8040e0'},
          {l:'Disponibles',v:stats.disp,c:'#10b981'},
          {l:'Parciales',v:stats.parc,c:'#f59e0b'},
          {l:'Llenas',v:stats.llenas,c:'#ef4444'},
          {l:'Vencidas',v:stats.venc,c:'#6b7280'},
          {l:'Perfiles libres',v:stats.libres,c:'#3b82f6'},
        ].map(s=>(
          <div key={s.l} className="card p-3 text-center">
            <p className="text-2xl font-bold" style={{color:s.c}}>{s.v}</p>
            <p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>{s.l}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color:'var(--text-3)'}}/>
          <input className="input pl-9" placeholder="Buscar correo, plataforma..." value={busqueda} onChange={e=>setBusq(e.target.value)}/>
        </div>
        <select className="select w-full sm:w-48" value={filtroPlat} onChange={e=>setFPlat(e.target.value)}>
          <option value="">Todas las plataformas</option>
          {plataformas.map(p=><option key={p.id} value={p.id}>{p.icono} {p.nombre}</option>)}
        </select>
        <select className="select w-full sm:w-36" value={filtroEst} onChange={e=>setFEst(e.target.value)}>
          <option value="">Todos</option>
          {ESTADOS.map(e=><option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Plataforma</th>
              <th>Credenciales</th>
              <th>Tipo</th>
              <th>Perfiles</th>
              <th>Proveedor</th>
              <th>Vencimiento</th>
              <th>Costo</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-12" style={{color:'var(--text-3)'}}>Cargando...</td></tr>
            ) : filtradas.length===0 ? (
              <tr><td colSpan={9} className="text-center py-12" style={{color:'var(--text-3)'}}>Sin cuentas</td></tr>
            ) : filtradas.map(c=>{
              const dias = calcularDiasRestantes(c.fecha_vencimiento)
              const plat = c.plataformas as any
              return (
                <tr key={c.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                        style={{backgroundColor:`${plat?.color}25`}}>
                        {plat?.icono}
                      </div>
                      <span className="font-semibold text-sm">{plat?.nombre}</span>
                    </div>
                  </td>
                  <td>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1">
                        <p className="text-xs font-mono">{c.correo}</p>
                        <button onClick={()=>copiar(c.correo,'Correo')} className="btn-ghost p-0.5 opacity-50 hover:opacity-100"><Copy size={10}/></button>
                      </div>
                      <div className="flex items-center gap-1">
                        <p className="text-xs font-mono">{showPass[c.id] ? c.contrasena : '••••••••'}</p>
                        <button onClick={()=>setShowPass(p=>({...p,[c.id]:!p[c.id]}))} className="btn-ghost p-0.5 opacity-50 hover:opacity-100">
                          {showPass[c.id] ? <EyeOff size={10}/> : <Eye size={10}/>}
                        </button>
                        {showPass[c.id] && <button onClick={()=>copiar(c.contrasena,'Contraseña')} className="btn-ghost p-0.5 opacity-50 hover:opacity-100"><Copy size={10}/></button>}
                      </div>
                      {c.pin && <p className="text-xs text-pink-500">PIN: {c.pin}</p>}
                    </div>
                  </td>
                  <td>
                    <span className="text-xs font-semibold" style={{color:'var(--text-2)'}}>
                      {c.tipo==='perfil_individual' ? '👤 Perfil' : '🗂 Completa'}
                    </span>
                  </td>
                  <td>
                    <div className="space-y-1">
                      <div className="flex gap-0.5">
                        {Array.from({length:c.max_perfiles}).map((_,i)=>(
                          <div key={i} className={clsx('w-3 h-3 rounded-sm border',
                            i<c.perfiles_ocupados
                              ?'bg-pink-400 border-pink-500'
                              :'border-gray-300 dark:border-gray-600'
                          )}/>
                        ))}
                      </div>
                      <p className="text-xs" style={{color:'var(--text-3)'}}>
                        {c.perfiles_disponibles} libre / {c.max_perfiles} total
                      </p>
                    </div>
                  </td>
                  <td className="text-xs" style={{color:'var(--text-2)'}}>{(c.proveedores as any)?.nombre||'—'}</td>
                  <td>
                    <span className={clsx('text-xs font-semibold', dias<=7?'text-red-500':dias<=14?'text-yellow-500':'')}>
                      {formatFecha(c.fecha_vencimiento)}
                      {dias<=14&&<span className="ml-1">({dias}d)</span>}
                    </span>
                  </td>
                  <td className="font-semibold text-sm">{formatMoneda(c.costo)}</td>
                  <td>
                    <span className={`badge ${colorEst[c.estado]||'bg-gray-100 text-gray-600'}`}>{c.estado}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button className="btn-ghost p-1.5" onClick={()=>abrirPerfiles(c)} title="Ver perfiles"><Eye size={14}/></button>
                      <button className="btn-ghost p-1.5" onClick={()=>abrirEditar(c)} title="Editar"><Edit2 size={14}/></button>
                      <button className="btn-ghost p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={()=>eliminarCuenta(c.id,c.correo)} title="Eliminar"><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── MODAL CREAR/EDITAR ── */}
      {modalOpen && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal-content animate-slide-up">
            <div className="modal-header">
              <h2 className="text-lg font-bold" style={{color:'var(--text)'}}>
                {editando?'Editar cuenta':'Nueva cuenta de inventario'}
              </h2>
              <button className="btn-ghost p-1.5" onClick={()=>setModal(false)}><X size={18}/></button>
            </div>
            <div className="modal-body">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tipo primero — determina lógica de perfiles */}
                <div className="sm:col-span-2">
                  <label className="label">Tipo de acceso que compraste *</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {v:'completa',l:'🗂 Cuenta completa',d:'Tienes todos los perfiles disponibles para vender'},
                      {v:'perfil_individual',l:'👤 Solo 1 perfil',d:'Solo compraste/tienes acceso a 1 perfil'},
                    ].map(op=>(
                      <button key={op.v} onClick={()=>setForm(f=>({...f,tipo:op.v,max_perfiles:op.v==='perfil_individual'?1:f.max_perfiles}))}
                        className={clsx('p-3 rounded-xl border-2 text-left transition-all',
                          form.tipo===op.v
                            ?'border-pink-400 bg-pink-50 dark:bg-pink-900/20'
                            :'border-[var(--border)] hover:border-pink-200')}>
                        <p className="font-bold text-sm" style={{color:'var(--text)'}}>{op.l}</p>
                        <p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>{op.d}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label">Plataforma *</label>
                  <select className="select" value={form.plataforma_id} onChange={e=>{
                    const plat=plataformas.find(p=>p.id===e.target.value)
                    setForm(f=>({...f,plataforma_id:e.target.value,
                      max_perfiles:form.tipo==='perfil_individual'?1:(plat?.max_perfiles||5)
                    }))
                  }}>
                    <option value="">Seleccionar...</option>
                    {plataformas.map(p=><option key={p.id} value={p.id}>{p.icono} {p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Proveedor</label>
                  <select className="select" value={form.proveedor_id} onChange={e=>setForm(f=>({...f,proveedor_id:e.target.value}))}>
                    <option value="">Sin proveedor</option>
                    {proveedores.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>

                {/* Cantidad de perfiles — solo visible si es cuenta completa */}
                {form.tipo==='completa' && (
                  <div className="sm:col-span-2">
                    <label className="label">¿Cuántos perfiles tiene esta cuenta?</label>
                    <input className="input" type="number" min={1} max={20}
                      value={form.max_perfiles}
                      onChange={e=>setForm(f=>({...f,max_perfiles:Math.max(1,Number(e.target.value))}))}/>
                    <p className="text-xs mt-1" style={{color:'var(--text-3)'}}>
                      Se crearán exactamente {form.max_perfiles} perfil{form.max_perfiles>1?'es':''} en el sistema.
                    </p>
                  </div>
                )}
                {form.tipo==='perfil_individual' && (
                  <div className="sm:col-span-2 alert-info text-xs">
                    👤 Se creará <strong>1 solo perfil</strong> para esta cuenta ya que compraste acceso individual.
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="label">Correo de la cuenta *</label>
                  <input className="input font-mono" placeholder="correo@ejemplo.com" value={form.correo} onChange={e=>setForm(f=>({...f,correo:e.target.value}))}/>
                </div>
                <div>
                  <label className="label">Contraseña *</label>
                  <input className="input font-mono" placeholder="Contraseña" value={form.contrasena} onChange={e=>setForm(f=>({...f,contrasena:e.target.value}))}/>
                </div>
                <div>
                  <label className="label">PIN (opcional)</label>
                  <input className="input font-mono" placeholder="PIN de acceso" value={form.pin} onChange={e=>setForm(f=>({...f,pin:e.target.value}))}/>
                </div>
                <div>
                  <label className="label">Fecha de compra</label>
                  <input className="input" type="date" value={form.fecha_compra} onChange={e=>setForm(f=>({...f,fecha_compra:e.target.value}))}/>
                </div>
                <div>
                  <label className="label">Vencimiento de la cuenta *</label>
                  <input className="input" type="date" value={form.fecha_vencimiento} onChange={e=>setForm(f=>({...f,fecha_vencimiento:e.target.value}))}/>
                </div>
                <div>
                  <label className="label">Costo de compra (MXN)</label>
                  <input className="input" type="number" step="0.01" placeholder="0.00" value={form.costo} onChange={e=>setForm(f=>({...f,costo:e.target.value}))}/>
                </div>
                <div>
                  <label className="label">Estado</label>
                  <select className="select" value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value}))}>
                    {ESTADOS.map(e=><option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Notas</label>
                  <textarea className="input" rows={2} placeholder="Observaciones..." value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))}/>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={()=>setModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={guardarCuenta}>
                <CheckCircle size={15}/>{editando?'Actualizar':'Guardar cuenta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL PERFILES ── */}
      {verPerfiles && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setVP(null)}>
          <div className="modal-content animate-slide-up">
            <div className="modal-header">
              <div>
                <h2 className="text-lg font-bold" style={{color:'var(--text)'}}>
                  {(verPerfiles.plataformas as any)?.icono} {(verPerfiles.plataformas as any)?.nombre} — Perfiles
                </h2>
                <p className="text-xs font-mono mt-0.5" style={{color:'var(--text-3)'}}>{verPerfiles.correo}</p>
                <div className="flex gap-1 mt-1">
                  <button onClick={()=>copiar(verPerfiles.correo,'Correo')} className="text-xs underline" style={{color:'var(--brand)'}}>copiar correo</button>
                  <span style={{color:'var(--text-3)'}}>·</span>
                  <button onClick={()=>copiar(verPerfiles.contrasena,'Contraseña')} className="text-xs underline" style={{color:'var(--brand)'}}>copiar contraseña</button>
                  {verPerfiles.pin&&<><span style={{color:'var(--text-3)'}}>·</span>
                  <button onClick={()=>copiar(verPerfiles.pin,'PIN')} className="text-xs underline" style={{color:'var(--brand)'}}>copiar PIN</button></>}
                </div>
              </div>
              <button className="btn-ghost p-1.5" onClick={()=>setVP(null)}><X size={18}/></button>
            </div>

            <div className="p-6 space-y-3">
              {perfilesCuenta.length===0 && (
                <div className="text-center py-8" style={{color:'var(--text-3)'}}>
                  <Package size={32} className="mx-auto mb-2 opacity-30"/>
                  <p className="text-sm">No hay perfiles en esta cuenta</p>
                  <p className="text-xs mt-1">Puede que el trigger no haya corrido. Contacta soporte.</p>
                </div>
              )}
              {perfilesCuenta.map(p=>{
                const ventaActiva = (p.ventas||[]).find((v:any)=>v.estado==='activa'||v.estado==='renovada')
                const dias = ventaActiva ? calcularDiasRestantes(ventaActiva.fecha_vencimiento) : null
                return (
                  <div key={p.id} className={clsx(
                    'flex items-center gap-3 p-3 rounded-xl border',
                    p.estado==='libre'
                      ?'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10'
                      :'border-pink-200 dark:border-pink-800 bg-pink-50 dark:bg-pink-900/10'
                  )}>
                    <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0',
                      p.estado==='libre'?'bg-emerald-100 text-emerald-700':'bg-pink-100 text-pink-700')}>
                      {p.numero_perfil}
                    </div>
                    <div className="flex-1 min-w-0">
                      {editPerfil?.id===p.id ? (
                        <div className="flex gap-2">
                          <input className="input py-1 text-xs" defaultValue={p.nombre_perfil||''} id={`ep-${p.id}`}/>
                          <button className="btn-primary py-1 text-xs px-2" onClick={()=>{
                            const val=(document.getElementById(`ep-${p.id}`) as HTMLInputElement)?.value||''
                            guardarNombrePerfil(p,val)
                          }}>✓</button>
                          <button className="btn-secondary py-1 text-xs px-2" onClick={()=>setEditP(null)}>✕</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">{p.nombre_perfil||`Perfil ${p.numero_perfil}`}</p>
                          <button onClick={()=>setEditP(p)} className="opacity-40 hover:opacity-100"><Edit2 size={11}/></button>
                        </div>
                      )}
                      {ventaActiva ? (
                        <div>
                          <p className="text-xs" style={{color:'var(--text-2)'}}>
                            👤 {(ventaActiva.clientes as any)?.nombre}
                            {ventaActiva.nombre_perfil_asignado&&` · ${ventaActiva.nombre_perfil_asignado}`}
                          </p>
                          <p className={clsx('text-xs font-semibold',dias!==null&&dias<=3?'text-red-500':'text-gray-400')}>
                            {dias===0?'Vence hoy':dias!==null?`${dias} días restantes`:''}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-emerald-600">✅ Disponible</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`badge text-xs ${colorEst[p.estado]||''}`}>{p.estado}</span>
                      <div className="flex gap-1">
                        {p.estado==='ocupado' && (
                          <button className="text-xs underline text-amber-600" onClick={()=>liberarPerfil(p)}>liberar</button>
                        )}
                        <button className="text-xs underline text-red-500" onClick={()=>eliminarPerfil(p.id)}>eliminar</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
