'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatFecha, formatMoneda, getBadgeClass, getColorEstado, calcularDiasRestantes } from '@/lib/utils'
import {
  ShoppingCart, Plus, Search, Eye, RefreshCw, X, CheckCircle,
  AlertTriangle, DollarSign, Clock, Edit2, Copy, MoreHorizontal, Users, User
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { addDays, format, parseISO } from 'date-fns'

const METODOS_PAGO = ['efectivo','transferencia','tarjeta','mercadopago','paypal','otro']
const COLOR_PAGO: Record<string,string> = {
  pagado:'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  pendiente:'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  parcial:'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  sin_cobrar:'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

export default function VentasPage() {
  const [ventas, setVentas]         = useState<any[]>([])
  const [clientes, setClientes]     = useState<any[]>([])
  const [plataformas, setPlats]     = useState<any[]>([])
  const [cuentasPlat, setCuentasPl] = useState<any[]>([])
  const [perfilesDisp, setPerfsD]   = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [busqueda, setBusq]         = useState('')
  const [filtroEst, setFEst]        = useState('')
  const [filtroPago, setFPago]      = useState('')

  // modals
  const [modalNueva, setMNueva]         = useState(false)
  const [modalRepos, setMRepos]         = useState<any|null>(null)
  const [modalRenov, setMRenov]         = useState<any|null>(null)
  const [modalPago, setMPago]           = useState<any|null>(null)
  const [modalDetalle, setMDetalle]     = useState<any|null>(null)
  const [cuentasRepos, setCuentasRepos] = useState<any[]>([])
  const [perfsRepos, setPerfsRepos]     = useState<any[]>([])

  // form nueva venta
  const hoy = new Date().toISOString().split('T')[0]
  const [fv, setFv] = useState({
    cliente_id:'', plataforma_id:'', cuenta_id:'', perfil_id:'',
    tipo_venta: 'perfil' as 'perfil' | 'cuenta_completa',
    nombre_perfil_asignado:'', dias:'30', dias_custom:'',
    fecha_inicio: hoy, precio_venta:'', costo_real:'',
    garantia:true, estado_pago:'pendiente', metodo_pago:'efectivo',
    notas:'', es_venta_pasada:false
  })

  // form reposición
  const [fr, setFr] = useState({ cuenta_nueva_id:'', perfil_nuevo_id:'', notas:'' })
  // form renovación
  const [frn, setFrn] = useState({ dias_extendidos:'30', precio_renovacion:'', costo_renovacion:'', notas:'' })
  // form pago
  const [fp, setFp] = useState({ estado_pago:'pagado', metodo_pago:'efectivo', monto:'', notas:'' })

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data:v },{ data:c },{ data:p }] = await Promise.all([
      supabase.from('ventas')
        .select(`*, clientes(nombre,telefono,whatsapp),
          plataformas(nombre,icono,color),
          cuentas(correo,contrasena,pin),
          perfiles(numero_perfil,nombre_perfil)`)
        .order('created_at',{ ascending:false }),
      supabase.from('clientes').select('id,nombre').order('nombre'),
      supabase.from('plataformas').select('*').eq('activa',true).order('nombre'),
    ])
    setVentas(v||[])
    setClientes(c||[])
    setPlats(p||[])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function cargarCuentasPlat(platId: string) {
    const { data } = await supabase
      .from('cuentas')
      .select('*, perfiles(*)')
      .eq('plataforma_id', platId)
      .in('estado',['disponible','parcial'])
    setCuentasPl(data||[])
  }

  async function cargarPerfs(cuentaId: string, destino:'nueva'|'repos'='nueva') {
    const { data } = await supabase
      .from('perfiles').select('*')
      .eq('cuenta_id',cuentaId).eq('estado','libre')
    if (destino==='nueva') setPerfsD(data||[])
    else setPerfsRepos(data||[])
  }

  // Perfiles libres de la cuenta seleccionada (para venta cuenta completa)
  const perfilesLibresCuenta = fv.cuenta_id
    ? (cuentasPlat.find(c => c.id === fv.cuenta_id)?.perfiles || []).filter((p: any) => p.estado === 'libre')
    : []

  // ── CREAR VENTA ──────────────────────────────────────────
  async function crearVenta() {
    const diasNum = fv.dias==='custom' ? Number(fv.dias_custom) : Number(fv.dias)

    if (!fv.cliente_id || !fv.plataforma_id || !fv.cuenta_id)
      return toast.error('Completa: cliente, plataforma y cuenta')

    if (fv.tipo_venta === 'perfil' && !fv.perfil_id)
      return toast.error('Selecciona el perfil a vender')

    if (fv.tipo_venta === 'cuenta_completa' && perfilesLibresCuenta.length === 0)
      return toast.error('Esta cuenta no tiene perfiles libres para vender')

    if (!fv.precio_venta) return toast.error('Indica el precio de venta')
    if (diasNum < 1) return toast.error('Días debe ser mayor a 0')

    const fechaVenc = format(addDays(parseISO(fv.fecha_inicio), diasNum), 'yyyy-MM-dd')
    const tid = toast.loading('Creando venta...')

    try {
      const cl = clientes.find(c => c.id === fv.cliente_id)
      const pl = plataformas.find(p => p.id === fv.plataforma_id)
      const cuenta = cuentasPlat.find(c => c.id === fv.cuenta_id)

      if (fv.tipo_venta === 'cuenta_completa') {
        // ── Venta de cuenta completa: crear una venta por cada perfil libre ──
        const ventasCreadas: any[] = []

        for (const perfil of perfilesLibresCuenta) {
          const { data: venta, error: ev } = await supabase.from('ventas').insert({
            cliente_id: fv.cliente_id,
            plataforma_id: fv.plataforma_id,
            cuenta_id: fv.cuenta_id,
            perfil_id: perfil.id,
            nombre_perfil_asignado: perfil.nombre_perfil || null,
            fecha_inicio: fv.fecha_inicio,
            fecha_vencimiento: fechaVenc,
            duracion_dias: diasNum,
            dias_consumidos: 0,
            precio_venta: Number(fv.precio_venta),
            costo_real: Number(fv.costo_real) || 0,
            garantia_activa: fv.garantia,
            estado: 'activa',
            estado_pago: fv.estado_pago,
            metodo_pago: fv.metodo_pago || null,
            notas: fv.notas ? `[Cuenta completa] ${fv.notas}` : '[Cuenta completa]'
          }).select().single()

          if (ev) throw ev
          ventasCreadas.push(venta)

          // Ocupar cada perfil
          await supabase.from('perfiles').update({
            estado: 'ocupado',
            nombre_perfil: perfil.nombre_perfil || null
          }).eq('id', perfil.id)
        }

        // Marcar la cuenta como llena
        await supabase.from('cuentas').update({
          perfiles_ocupados: (cuenta?.perfiles_totales || perfilesLibresCuenta.length),
          perfiles_disponibles: 0,
          estado: 'llena'
        }).eq('id', fv.cuenta_id)

        // Movimiento general
        await supabase.from('movimientos').insert({
          tipo: 'venta_creada',
          descripcion: `Venta cuenta completa: ${cl?.nombre} — ${pl?.nombre} (${perfilesLibresCuenta.length} perfiles) ${diasNum}d | ${formatMoneda(Number(fv.precio_venta))}`,
          entidad_tipo: 'venta',
          entidad_id: ventasCreadas[0]?.id,
          cliente_id: fv.cliente_id
        })

        toast.success(`¡Cuenta completa vendida! ${perfilesLibresCuenta.length} perfiles asignados ✅`, { id: tid })

      } else {
        // ── Venta de perfil individual ──
        const { data: venta, error: ev } = await supabase.from('ventas').insert({
          cliente_id: fv.cliente_id,
          plataforma_id: fv.plataforma_id,
          cuenta_id: fv.cuenta_id,
          perfil_id: fv.perfil_id,
          nombre_perfil_asignado: fv.nombre_perfil_asignado || null,
          fecha_inicio: fv.fecha_inicio,
          fecha_vencimiento: fechaVenc,
          duracion_dias: diasNum,
          dias_consumidos: 0,
          precio_venta: Number(fv.precio_venta),
          costo_real: Number(fv.costo_real) || 0,
          garantia_activa: fv.garantia,
          estado: 'activa',
          estado_pago: fv.estado_pago,
          metodo_pago: fv.metodo_pago || null,
          notas: fv.notas || null
        }).select().single()
        if (ev) throw ev

        // Ocupar perfil
        await supabase.from('perfiles').update({
          estado: 'ocupado',
          nombre_perfil: fv.nombre_perfil_asignado || null
        }).eq('id', fv.perfil_id)

        // Actualizar contadores cuenta
        if (cuenta) {
          const ocp = (cuenta.perfiles_ocupados || 0) + 1
          const dis = (cuenta.perfiles_disponibles || 0) - 1
          await supabase.from('cuentas').update({
            perfiles_ocupados: ocp,
            perfiles_disponibles: dis,
            estado: dis === 0 ? 'llena' : 'parcial'
          }).eq('id', fv.cuenta_id)
        }

        // Movimiento
        await supabase.from('movimientos').insert({
          tipo: 'venta_creada',
          descripcion: `Venta: ${cl?.nombre} — ${pl?.nombre} ${diasNum}d | ${formatMoneda(Number(fv.precio_venta))}`,
          entidad_tipo: 'venta',
          entidad_id: venta.id,
          cliente_id: fv.cliente_id
        })

        toast.success('¡Venta creada! ✅', { id: tid })
      }

      setMNueva(false)
      resetFv()
      load()
    } catch(e: any) { toast.error(e.message || 'Error', { id: tid }) }
  }

  // ── REPOSICIÓN (preserva días restantes) ─────────────────
  async function procesarReposicion() {
    if (!fr.cuenta_nueva_id||!fr.perfil_nuevo_id) return toast.error('Selecciona cuenta y perfil nuevos')
    const v = modalRepos
    const hoyDate = new Date()
    const inicio = parseISO(v.fecha_inicio)
    const diasCons = Math.max(0, Math.floor((hoyDate.getTime()-inicio.getTime())/(86400000)))
    const diasRest = Math.max(0, v.duracion_dias - diasCons)
    const nuevaFecha = format(addDays(hoyDate, diasRest), 'yyyy-MM-dd')
    const tid = toast.loading('Procesando reposición...')
    try {
      const { data:rpt } = await supabase.from('reportes').insert({
        venta_id:v.id, cliente_id:v.cliente_id, cuenta_id:v.cuenta_id,
        tipo:'reposicion_manual',
        descripcion:`Reposición. Días consumidos:${diasCons}, restantes:${diasRest}`,
        estado:'solucionado', fecha_solucion:new Date().toISOString(), dias_pausados:0
      }).select().single()

      const { data:vNueva } = await supabase.from('ventas').insert({
        cliente_id:v.cliente_id, plataforma_id:v.plataforma_id,
        cuenta_id:fr.cuenta_nueva_id, perfil_id:fr.perfil_nuevo_id,
        nombre_perfil_asignado:v.nombre_perfil_asignado,
        fecha_inicio:hoyDate.toISOString().split('T')[0],
        fecha_vencimiento:nuevaFecha,
        duracion_dias:diasRest, dias_consumidos:0,
        precio_venta:0, costo_real:0, garantia_activa:true,
        estado:'repuesta', estado_pago:'pagado',
        notas:`Reposición desde venta ${v.id}. ${fr.notas||''}`
      }).select().single()

      await supabase.from('reposiciones').insert({
        reporte_id:(rpt as any).id, venta_original_id:v.id, venta_nueva_id:(vNueva as any).id,
        cuenta_anterior_id:v.cuenta_id, cuenta_nueva_id:fr.cuenta_nueva_id,
        perfil_anterior_id:v.perfil_id, perfil_nuevo_id:fr.perfil_nuevo_id,
        dias_restantes:diasRest, dias_pausados:0,
        fecha_reposicion:new Date().toISOString(), estado:'completada', notas:fr.notas||null
      })
      await supabase.from('ventas').update({ estado:'repuesta' }).eq('id',v.id)
      await supabase.from('perfiles').update({ estado:'libre' }).eq('id',v.perfil_id)
      await supabase.from('perfiles').update({ estado:'ocupado', nombre_perfil:v.nombre_perfil_asignado||null }).eq('id',fr.perfil_nuevo_id)
      await supabase.from('cuentas').update({ estado:'reportada' }).eq('id',v.cuenta_id)
      await supabase.from('movimientos').insert({
        tipo:'reposicion_completada',
        descripcion:`Reposición: ${diasRest}d continuados. Nueva fecha: ${nuevaFecha}`,
        entidad_tipo:'venta', entidad_id:(vNueva as any).id, cliente_id:v.cliente_id
      })
      toast.success(`Reposición lista: ${diasRest} días hasta ${nuevaFecha} ✅`, { id:tid })
      setMRepos(null)
      setFr({ cuenta_nueva_id:'', perfil_nuevo_id:'', notas:'' })
      load()
    } catch(e:any) { toast.error(e.message||'Error', { id:tid }) }
  }

  // ── RENOVACIÓN ───────────────────────────────────────────
  async function procesarRenovacion() {
    if (!frn.precio_renovacion) return toast.error('Indica precio de renovación')
    const v = modalRenov
    const diasE = Number(frn.dias_extendidos)
    const nuevaFecha = format(addDays(parseISO(v.fecha_vencimiento), diasE), 'yyyy-MM-dd')
    const tid = toast.loading('Renovando...')
    try {
      await supabase.from('ventas').update({
        fecha_vencimiento:nuevaFecha,
        duracion_dias:v.duracion_dias+diasE,
        estado:'renovada'
      }).eq('id',v.id)
      await supabase.from('renovaciones').insert({
        venta_id:v.id, cliente_id:v.cliente_id,
        cuenta_id:v.cuenta_id, perfil_id:v.perfil_id,
        dias_renovados:diasE, fecha_anterior_vencimiento:v.fecha_vencimiento,
        nueva_fecha_vencimiento:nuevaFecha,
        precio_renovacion:Number(frn.precio_renovacion),
        costo_renovacion:Number(frn.costo_renovacion)||0,
        fecha_nueva_vencimiento:nuevaFecha, notas:frn.notas||null
      })
      await supabase.from('movimientos').insert({
        tipo:'renovacion_realizada',
        descripcion:`Renovación +${diasE}d → ${nuevaFecha} | ${formatMoneda(Number(frn.precio_renovacion))}`,
        entidad_tipo:'venta', entidad_id:v.id, cliente_id:v.cliente_id
      })
      toast.success(`Renovado hasta ${nuevaFecha} ✅`, { id:tid })
      setMRenov(null)
      load()
    } catch(e:any) { toast.error(e.message||'Error', { id:tid }) }
  }

  // ── REGISTRAR PAGO ───────────────────────────────────────
  async function registrarPago() {
    const v = modalPago
    const tid = toast.loading('Guardando pago...')
    try {
      await supabase.from('ventas').update({
        estado_pago:fp.estado_pago, metodo_pago:fp.metodo_pago,
        fecha_pago: fp.estado_pago==='pagado'?new Date().toISOString():null
      }).eq('id',v.id)
      await supabase.from('movimientos').insert({
        tipo:'pago_registrado',
        descripcion:`Pago registrado: ${fp.estado_pago} via ${fp.metodo_pago}. ${fp.notas||''}`,
        entidad_tipo:'venta', entidad_id:v.id, cliente_id:v.cliente_id
      })
      toast.success('Pago actualizado ✅', { id:tid })
      setMPago(null)
      load()
    } catch(e:any) { toast.error(e.message||'Error', { id:tid }) }
  }

  function resetFv() {
    setFv({
      cliente_id:'', plataforma_id:'', cuenta_id:'', perfil_id:'',
      tipo_venta: 'perfil',
      nombre_perfil_asignado:'', dias:'30', dias_custom:'',
      fecha_inicio: hoy, precio_venta:'', costo_real:'',
      garantia:true, estado_pago:'pendiente', metodo_pago:'efectivo',
      notas:'', es_venta_pasada:false
    })
    setPerfsD([]); setCuentasPl([])
  }

  const ventasFilt = ventas.filter(v => {
    const b = busqueda.toLowerCase()
    const mb = !busqueda || (v.clientes as any)?.nombre?.toLowerCase().includes(b) || (v.plataformas as any)?.nombre?.toLowerCase().includes(b)
    const me = !filtroEst || v.estado === filtroEst
    const mp = !filtroPago || v.estado_pago === filtroPago
    return mb && me && mp
  })

  const diasVenta = () => fv.dias === 'custom' ? Number(fv.dias_custom) : Number(fv.dias)
  const fechaVencCalc = fv.fecha_inicio && diasVenta() > 0
    ? format(addDays(parseISO(fv.fecha_inicio), diasVenta()), 'dd/MM/yyyy') : '—'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" style={{color:'var(--brand)'}}/>
            Ventas
          </h1>
          <p className="text-sm mt-0.5" style={{color:'var(--text-3)'}}>
            {ventas.filter(v=>v.estado==='activa'||v.estado==='renovada').length} activas · {ventas.length} total
          </p>
        </div>
        <button className="btn-primary" onClick={()=>{resetFv();setMNueva(true)}}>
          <Plus size={15}/> Nueva venta
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color:'var(--text-3)'}}/>
          <input className="input pl-9" placeholder="Buscar cliente, plataforma..." value={busqueda} onChange={e=>setBusq(e.target.value)}/>
        </div>
        <select className="select w-full sm:w-36" value={filtroEst} onChange={e=>setFEst(e.target.value)}>
          <option value="">Todos estados</option>
          {['activa','vencida','en_garantia','repuesta','renovada','cancelada'].map(e=>(
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select className="select w-full sm:w-36" value={filtroPago} onChange={e=>setFPago(e.target.value)}>
          <option value="">Todos pagos</option>
          <option value="pagado">Pagado</option>
          <option value="pendiente">Pendiente</option>
          <option value="sin_cobrar">Sin cobrar</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Plataforma</th>
              <th>Perfil</th>
              <th>Credenciales</th>
              <th>Periodo</th>
              <th>Días</th>
              <th>Precio</th>
              <th>Pago</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="text-center py-12" style={{color:'var(--text-3)'}}>Cargando...</td></tr>
            ) : ventasFilt.length===0 ? (
              <tr><td colSpan={10} className="text-center py-12" style={{color:'var(--text-3)'}}>Sin ventas</td></tr>
            ) : ventasFilt.map(v=>{
              const dias = calcularDiasRestantes(v.fecha_vencimiento)
              const plat = v.plataformas as any
              const cl   = v.clientes   as any
              const perf = v.perfiles   as any
              const cta  = v.cuentas    as any
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
                        {cl?.whatsapp&&<p className="text-xs" style={{color:'var(--text-3)'}}>{cl.whatsapp}</p>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{backgroundColor:`${plat?.color}25`}}>{plat?.icono}</span>
                      <span className="font-medium text-sm">{plat?.nombre}</span>
                    </div>
                  </td>
                  <td>
                    <p className="font-semibold text-sm">{v.nombre_perfil_asignado||`Perfil ${perf?.numero_perfil}`}</p>
                    <p className="text-xs" style={{color:'var(--text-3)'}}>{perf?.nombre_perfil}</p>
                  </td>
                  <td>
                    <p className="text-xs font-mono max-w-28 truncate" style={{color:'var(--text-2)'}}>{cta?.correo}</p>
                    {cta?.pin&&<p className="text-xs text-pink-500">PIN:{cta.pin}</p>}
                  </td>
                  <td>
                    <p className="text-xs" style={{color:'var(--text-3)'}}>{formatFecha(v.fecha_inicio)}</p>
                    <p className="text-xs font-semibold">{formatFecha(v.fecha_vencimiento)}</p>
                  </td>
                  <td>
                    {['activa','renovada'].includes(v.estado) ? (
                      <span className={clsx('text-sm font-bold',
                        dias===0?'text-red-600':dias<=3?'text-orange-500':dias<=7?'text-yellow-500':'text-emerald-600')}>
                        {dias===0?'¡Hoy!':dias<0?'Vencida':`${dias}d`}
                      </span>
                    ) : <span className="text-xs" style={{color:'var(--text-3)'}}>—</span>}
                  </td>
                  <td>
                    <p className="font-bold text-sm text-emerald-600">{formatMoneda(v.precio_venta)}</p>
                    <p className="text-xs" style={{color:'var(--text-3)'}}>costo:{formatMoneda(v.costo_real)}</p>
                  </td>
                  <td>
                    <span className={`badge text-xs ${COLOR_PAGO[v.estado_pago]||'bg-gray-100 text-gray-600'}`}>
                      {v.estado_pago||'—'}
                    </span>
                    {v.metodo_pago&&<p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>{v.metodo_pago}</p>}
                  </td>
                  <td>
                    <span className={`badge text-xs ${getBadgeClass(getColorEstado(v.estado))}`}>{v.estado}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button className="btn-ghost p-1.5" onClick={()=>setMDetalle(v)} title="Ver"><Eye size={13}/></button>
                      <button className="btn-ghost p-1.5 text-teal-600" onClick={()=>{setMPago(v);setFp({estado_pago:v.estado_pago||'pendiente',metodo_pago:v.metodo_pago||'efectivo',monto:String(v.precio_venta),notas:''})}} title="Pago"><DollarSign size={13}/></button>
                      {['activa','renovada'].includes(v.estado) && (<>
                        <button className="btn-ghost p-1.5 text-yellow-600" onClick={()=>{ setMRepos(v); cargarCuentasPlat(v.plataforma_id) }} title="Reposición"><AlertTriangle size={13}/></button>
                        <button className="btn-ghost p-1.5 text-indigo-600" onClick={()=>{setMRenov(v);setFrn({dias_extendidos:'30',precio_renovacion:'',costo_renovacion:'',notas:''})}} title="Renovar"><RefreshCw size={13}/></button>
                      </>)}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ─── MODAL NUEVA VENTA ─────────────────────────────── */}
      {modalNueva && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setMNueva(false)}>
          <div className="modal-content animate-slide-up max-w-2xl">
            <div className="modal-header">
              <h2 className="text-lg font-bold" style={{color:'var(--text)'}}>
                <ShoppingCart size={18} className="inline mr-2" style={{color:'var(--brand)'}}/>
                Nueva Venta
              </h2>
              <button className="btn-ghost p-1.5" onClick={()=>setMNueva(false)}><X size={18}/></button>
            </div>
            <div className="modal-body">

              {/* ── SELECTOR TIPO DE VENTA ── */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFv(f => ({ ...f, tipo_venta: 'perfil', perfil_id: '' }))}
                  className={clsx(
                    'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer',
                    fv.tipo_venta === 'perfil'
                      ? 'border-[var(--brand)] bg-[var(--brand)]/10'
                      : 'border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--brand)]/50'
                  )}
                >
                  <User size={22} className={fv.tipo_venta === 'perfil' ? 'text-[var(--brand)]' : ''} style={fv.tipo_venta !== 'perfil' ? {color:'var(--text-3)'} : {}}/>
                  <div className="text-center">
                    <p className={clsx('font-bold text-sm', fv.tipo_venta === 'perfil' ? 'text-[var(--brand)]' : '')} style={fv.tipo_venta !== 'perfil' ? {color:'var(--text-2)'} : {}}>
                      Venta de Perfil
                    </p>
                    <p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>1 perfil a la clienta</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFv(f => ({ ...f, tipo_venta: 'cuenta_completa', perfil_id: '' }))}
                  className={clsx(
                    'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer',
                    fv.tipo_venta === 'cuenta_completa'
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-[var(--border)] bg-[var(--surface-2)] hover:border-purple-400/50'
                  )}
                >
                  <Users size={22} className={fv.tipo_venta === 'cuenta_completa' ? 'text-purple-500' : ''} style={fv.tipo_venta !== 'cuenta_completa' ? {color:'var(--text-3)'} : {}}/>
                  <div className="text-center">
                    <p className={clsx('font-bold text-sm', fv.tipo_venta === 'cuenta_completa' ? 'text-purple-600' : '')} style={fv.tipo_venta !== 'cuenta_completa' ? {color:'var(--text-2)'} : {}}>
                      Cuenta Completa
                    </p>
                    <p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>Todos los perfiles libres</p>
                  </div>
                </button>
              </div>

              {/* Info según tipo de venta */}
              {fv.tipo_venta === 'cuenta_completa' && (
                <div className="rounded-xl p-3 text-sm" style={{background:'#f5f3ff', border:'1.5px solid #a78bfa'}}>
                  <p className="font-semibold text-purple-800">
                    🔒 Se asignarán automáticamente <strong>todos los perfiles libres</strong> de la cuenta seleccionada al cliente.
                  </p>
                </div>
              )}

              {/* Opción venta pasada */}
              <div className="flex items-center gap-3 p-3 rounded-xl border" style={{borderColor:'var(--border)',background:'var(--surface-2)'}}>
                <input type="checkbox" id="vp" checked={fv.es_venta_pasada} onChange={e=>setFv(f=>({...f,es_venta_pasada:e.target.checked}))} className="w-4 h-4"/>
                <label htmlFor="vp" className="text-sm cursor-pointer font-semibold" style={{color:'var(--text-2)'}}>
                  📅 Es venta pasada (puedo personalizar fecha de inicio y estado)
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label">Cliente *</label>
                  <select className="select" value={fv.cliente_id} onChange={e=>setFv(f=>({...f,cliente_id:e.target.value}))}>
                    <option value="">Seleccionar cliente...</option>
                    {clientes.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Plataforma *</label>
                  <select className="select" value={fv.plataforma_id} onChange={e=>{ setFv(f=>({...f,plataforma_id:e.target.value,cuenta_id:'',perfil_id:''})); cargarCuentasPlat(e.target.value) }}>
                    <option value="">Seleccionar...</option>
                    {plataformas.map(p=><option key={p.id} value={p.id}>{p.icono} {p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Cuenta disponible *</label>
                  <select className="select" value={fv.cuenta_id} onChange={e=>{
                    setFv(f=>({...f,cuenta_id:e.target.value,perfil_id:''}))
                    if (fv.tipo_venta === 'perfil') cargarPerfs(e.target.value)
                  }} disabled={!fv.plataforma_id}>
                    <option value="">Seleccionar cuenta...</option>
                    {cuentasPlat.map(c=><option key={c.id} value={c.id}>{c.correo} ({c.perfiles_disponibles} libre{c.perfiles_disponibles!==1?'s':''})</option>)}
                  </select>
                  {fv.plataforma_id&&cuentasPlat.length===0&&<p className="text-xs text-red-500 mt-1">Sin cuentas disponibles para esta plataforma</p>}
                </div>

                {/* Perfil: solo visible si tipo = perfil individual */}
                {fv.tipo_venta === 'perfil' && (<>
                  <div>
                    <label className="label">Perfil a asignar *</label>
                    <select className="select" value={fv.perfil_id} onChange={e=>setFv(f=>({...f,perfil_id:e.target.value}))} disabled={!fv.cuenta_id}>
                      <option value="">Seleccionar perfil...</option>
                      {perfilesDisp.map(p=><option key={p.id} value={p.id}>Perfil {p.numero_perfil} — {p.nombre_perfil||'Sin nombre'}</option>)}
                    </select>
                    {fv.cuenta_id&&perfilesDisp.length===0&&<p className="text-xs text-orange-500 mt-1">⚠️ Sin perfiles libres en esta cuenta</p>}
                  </div>
                  <div>
                    <label className="label">Nombre del perfil que le das al cliente</label>
                    <input className="input" placeholder="Ej: Rosa, #3, Mamá..." value={fv.nombre_perfil_asignado} onChange={e=>setFv(f=>({...f,nombre_perfil_asignado:e.target.value}))}/>
                  </div>
                </>)}

                {/* Vista previa perfiles si es cuenta completa */}
                {fv.tipo_venta === 'cuenta_completa' && fv.cuenta_id && (
                  <div className="sm:col-span-2 rounded-xl p-3 text-sm space-y-2" style={{background:'#f5f3ff',border:'1.5px solid #a78bfa'}}>
                    <p className="font-bold text-purple-800">
                      👥 Perfiles que se asignarán ({perfilesLibresCuenta.length}):
                    </p>
                    {perfilesLibresCuenta.length === 0 ? (
                      <p className="text-red-600 font-semibold">⚠️ No hay perfiles libres en esta cuenta</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {perfilesLibresCuenta.map((p: any) => (
                          <span key={p.id} className="px-2 py-1 rounded-lg text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                            Perfil {p.numero_perfil} {p.nombre_perfil ? `— ${p.nombre_perfil}` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Duración */}
                <div>
                  <label className="label">Duración *</label>
                  <select className="select" value={fv.dias} onChange={e=>setFv(f=>({...f,dias:e.target.value}))}>
                    <option value="30">30 días</option>
                    <option value="60">60 días</option>
                    <option value="90">90 días</option>
                    <option value="custom">Personalizado</option>
                  </select>
                  {fv.dias==='custom'&&<input className="input mt-2" type="number" placeholder="Número de días" min={1} value={fv.dias_custom} onChange={e=>setFv(f=>({...f,dias_custom:e.target.value}))}/>}
                </div>
                <div>
                  <label className="label">Fecha inicio {fv.es_venta_pasada?'(pasada)':''}</label>
                  <input className="input" type="date" value={fv.fecha_inicio} onChange={e=>setFv(f=>({...f,fecha_inicio:e.target.value}))}/>
                </div>

                {/* Info calculada */}
                <div className="sm:col-span-2 rounded-xl p-3 text-sm font-medium" style={{background:'var(--surface-2)',border:'1.5px solid var(--border)'}}>
                  📅 Vencimiento calculado: <strong style={{color:'var(--brand)'}}>{fechaVencCalc}</strong>
                </div>
                <div>
                  <label className="label">
                    Precio de venta (MXN) *
                    {fv.tipo_venta === 'cuenta_completa' && <span className="ml-1 text-xs text-purple-600 font-normal">(precio por perfil)</span>}
                  </label>
                  <input className="input" type="number" step="0.01" placeholder="0.00" value={fv.precio_venta} onChange={e=>setFv(f=>({...f,precio_venta:e.target.value}))}/>
                </div>
                <div>
                  <label className="label">Costo real (MXN)</label>
                  <input className="input" type="number" step="0.01" placeholder="0.00" value={fv.costo_real} onChange={e=>setFv(f=>({...f,costo_real:e.target.value}))}/>
                </div>
                {fv.precio_venta&&fv.costo_real&&(
                  <div className="sm:col-span-2 rounded-xl p-3 text-sm" style={{background:'#ecfdf5',border:'1px solid #a7f3d0'}}>
                    💰 Ganancia: <strong className="text-emerald-700">
                      {fv.tipo_venta === 'cuenta_completa' && perfilesLibresCuenta.length > 1
                        ? `${formatMoneda((Number(fv.precio_venta)-Number(fv.costo_real)) * perfilesLibresCuenta.length)} (${perfilesLibresCuenta.length} perfiles × ${formatMoneda(Number(fv.precio_venta)-Number(fv.costo_real))})`
                        : formatMoneda(Number(fv.precio_venta)-Number(fv.costo_real))
                      }
                    </strong>
                  </div>
                )}
                <div>
                  <label className="label">Estado de pago</label>
                  <select className="select" value={fv.estado_pago} onChange={e=>setFv(f=>({...f,estado_pago:e.target.value}))}>
                    <option value="pagado">✅ Pagado</option>
                    <option value="pendiente">⏳ Pendiente</option>
                    <option value="parcial">🔵 Parcial</option>
                    <option value="sin_cobrar">❌ Sin cobrar</option>
                  </select>
                </div>
                <div>
                  <label className="label">Método de pago</label>
                  <select className="select" value={fv.metodo_pago} onChange={e=>setFv(f=>({...f,metodo_pago:e.target.value}))}>
                    {METODOS_PAGO.map(m=><option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2 flex items-center gap-3 p-3 rounded-xl" style={{background:'var(--surface-2)',border:'1.5px solid var(--border)'}}>
                  <input type="checkbox" id="gtia" className="w-4 h-4" checked={fv.garantia} onChange={e=>setFv(f=>({...f,garantia:e.target.checked}))}/>
                  <label htmlFor="gtia" className="text-sm cursor-pointer font-semibold" style={{color:'var(--text-2)'}}>🛡 Incluir garantía</label>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Notas</label>
                  <textarea className="input" rows={2} placeholder="Observaciones..." value={fv.notas} onChange={e=>setFv(f=>({...f,notas:e.target.value}))}/>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={()=>setMNueva(false)}>Cancelar</button>
              <button className="btn-primary" onClick={crearVenta}><CheckCircle size={15}/>
                {fv.tipo_venta === 'cuenta_completa' ? `Vender cuenta completa (${perfilesLibresCuenta.length} perfiles)` : 'Crear venta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL REPOSICIÓN ─────────────────────────────── */}
      {modalRepos && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setMRepos(null)}>
          <div className="modal-content animate-slide-up max-w-lg">
            <div className="modal-header">
              <h2 className="text-lg font-bold" style={{color:'var(--text)'}}>
                <AlertTriangle size={18} className="inline mr-2 text-yellow-500"/>Reposición de garantía
              </h2>
              <button className="btn-ghost p-1.5" onClick={()=>setMRepos(null)}><X size={18}/></button>
            </div>
            <div className="p-6 space-y-4">
              {(()=>{
                const diasCons = Math.max(0,Math.floor((Date.now()-parseISO(modalRepos.fecha_inicio).getTime())/86400000))
                const diasRest = Math.max(0, modalRepos.duracion_dias - diasCons)
                const nuevaF = format(addDays(new Date(), diasRest),'dd/MM/yyyy')
                return (
                  <div className="rounded-xl p-4 space-y-2 text-sm" style={{background:'#fefce8',border:'1.5px solid #fbbf24'}}>
                    <p className="font-bold text-amber-800">📊 Cálculo automático de días restantes</p>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {[['Contratados',modalRepos.duracion_dias+'d'],['Consumidos',diasCons+'d'],['Restantes ✅',diasRest+'d']].map(([l,v])=>(
                        <div key={l} className="bg-[var(--bg-card)] rounded-lg p-2 text-center border border-amber-200">
                          <p className="text-lg font-bold text-amber-700">{v}</p>
                          <p className="text-xs text-amber-600">{l}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-amber-800 font-semibold">📅 Nueva fecha fin: <strong>{nuevaF}</strong></p>
                  </div>
                )
              })()}
              <div>
                <label className="label">Nueva cuenta *</label>
                <select className="select" value={fr.cuenta_nueva_id} onChange={e=>{ setFr(f=>({...f,cuenta_nueva_id:e.target.value,perfil_nuevo_id:''})); cargarPerfs(e.target.value,'repos') }}>
                  <option value="">Seleccionar cuenta...</option>
                  {cuentasRepos.length>0
                    ? cuentasRepos.map(c=><option key={c.id} value={c.id}>{c.correo} ({c.perfiles_disponibles} libres)</option>)
                    : cuentasPlat.map(c=><option key={c.id} value={c.id}>{c.correo} ({c.perfiles_disponibles} libres)</option>)
                  }
                </select>
              </div>
              <div>
                <label className="label">Nuevo perfil *</label>
                <select className="select" value={fr.perfil_nuevo_id} onChange={e=>setFr(f=>({...f,perfil_nuevo_id:e.target.value}))} disabled={!fr.cuenta_nueva_id}>
                  <option value="">Seleccionar...</option>
                  {perfsRepos.map(p=><option key={p.id} value={p.id}>Perfil {p.numero_perfil} — {p.nombre_perfil}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Notas / motivo</label>
                <textarea className="input" rows={2} placeholder="Motivo de la falla..." value={fr.notas} onChange={e=>setFr(f=>({...f,notas:e.target.value}))}/>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={()=>setMRepos(null)}>Cancelar</button>
              <button className="btn-warning" onClick={procesarReposicion}><CheckCircle size={15}/>Procesar reposición</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL RENOVACIÓN ─────────────────────────────── */}
      {modalRenov && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setMRenov(null)}>
          <div className="modal-content animate-slide-up max-w-md">
            <div className="modal-header">
              <h2 className="text-lg font-bold" style={{color:'var(--text)'}}><RefreshCw size={18} className="inline mr-2" style={{color:'var(--brand)'}}/>Renovar servicio</h2>
              <button className="btn-ghost p-1.5" onClick={()=>setMRenov(null)}><X size={18}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-xl p-4 text-sm" style={{background:'var(--surface-2)',border:'1.5px solid var(--border)'}}>
                <p className="font-bold">{(modalRenov.clientes as any)?.nombre}</p>
                <p style={{color:'var(--text-2)'}}>Vence: {formatFecha(modalRenov.fecha_vencimiento)} · {calcularDiasRestantes(modalRenov.fecha_vencimiento)}d restantes</p>
              </div>
              <div>
                <label className="label">Días a extender</label>
                <select className="select" value={frn.dias_extendidos} onChange={e=>setFrn(f=>({...f,dias_extendidos:e.target.value}))}>
                  <option value="30">30 días</option><option value="60">60 días</option>
                  <option value="90">90 días</option><option value="15">15 días</option>
                </select>
              </div>
              <div className="rounded-xl p-3 text-sm font-semibold" style={{background:'#ecfdf5',border:'1px solid #a7f3d0'}}>
                📅 Nueva fecha: <span className="text-emerald-700">{format(addDays(parseISO(modalRenov.fecha_vencimiento),Number(frn.dias_extendidos)),'dd/MM/yyyy')}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Precio renovación *</label>
                  <input className="input" type="number" step="0.01" placeholder="0.00" value={frn.precio_renovacion} onChange={e=>setFrn(f=>({...f,precio_renovacion:e.target.value}))}/>
                </div>
                <div>
                  <label className="label">Costo real</label>
                  <input className="input" type="number" step="0.01" placeholder="0.00" value={frn.costo_renovacion} onChange={e=>setFrn(f=>({...f,costo_renovacion:e.target.value}))}/>
                </div>
              </div>
              <div>
                <label className="label">Notas</label>
                <textarea className="input" rows={2} value={frn.notas} onChange={e=>setFrn(f=>({...f,notas:e.target.value}))}/>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={()=>setMRenov(null)}>Cancelar</button>
              <button className="btn-primary" onClick={procesarRenovacion}><CheckCircle size={15}/>Renovar</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL REGISTRAR PAGO ─────────────────────────── */}
      {modalPago && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setMPago(null)}>
          <div className="modal-content animate-slide-up max-w-md">
            <div className="modal-header">
              <h2 className="text-lg font-bold" style={{color:'var(--text)'}}><DollarSign size={18} className="inline mr-2 text-teal-500"/>Registrar pago</h2>
              <button className="btn-ghost p-1.5" onClick={()=>setMPago(null)}><X size={18}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-xl p-3 text-sm" style={{background:'var(--surface-2)',border:'1.5px solid var(--border)'}}>
                <p className="font-bold">{(modalPago.clientes as any)?.nombre} — {(modalPago.plataformas as any)?.nombre}</p>
                <p style={{color:'var(--text-2)'}}>Precio venta: <strong>{formatMoneda(modalPago.precio_venta)}</strong></p>
                <p style={{color:'var(--text-3)'}}>Estado actual: <strong>{modalPago.estado_pago||'—'}</strong></p>
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
                  {METODOS_PAGO.map(m=><option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Notas</label>
                <textarea className="input" rows={2} placeholder="Comprobante, referencia..." value={fp.notas} onChange={e=>setFp(f=>({...f,notas:e.target.value}))}/>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={()=>setMPago(null)}>Cancelar</button>
              <button className="btn-success" onClick={registrarPago}><CheckCircle size={15}/>Guardar pago</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
