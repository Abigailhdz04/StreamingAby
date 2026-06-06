'use client'

import { useState } from 'react'
import { Settings, Moon, Sun, Bell, Database, Shield, Download, RefreshCw, CheckCircle } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function ConfiguracionPage() {
  const { darkMode, toggleDarkMode } = useAppStore()
  const [exportando, setExportando] = useState(false)
  const [limpiando, setLimpiando]   = useState(false)

  async function exportarDatos() {
    setExportando(true)
    try {
      const [{ data:v },{ data:c },{ data:cl },{ data:ct }] = await Promise.all([
        supabase.from('ventas').select('*, clientes(nombre), plataformas(nombre), cuentas(correo)'),
        supabase.from('clientes').select('*'),
        supabase.from('cuentas').select('*, plataformas(nombre), proveedores(nombre)'),
        supabase.from('cobros_pendientes').select('*').limit(1).maybeSingle(),
      ])
      const data = { ventas:v, clientes:c, cuentas:cl, exportado:new Date().toISOString() }
      const blob = new Blob([JSON.stringify(data,null,2)],{ type:'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href=url; a.download=`streaming_backup_${new Date().toISOString().split('T')[0]}.json`; a.click()
      toast.success('Datos exportados ✅')
    } catch(e) {
      toast.error('Error al exportar')
    } finally { setExportando(false) }
  }

  async function exportarCSVVentas() {
    const { data:v } = await supabase.from('ventas')
      .select('*, clientes(nombre,whatsapp), plataformas(nombre), cuentas(correo)')
      .order('created_at',{ ascending:false })
    if (!v) return toast.error('Sin datos')
    const headers = ['Fecha','Cliente','WhatsApp','Plataforma','Correo cuenta','Perfil asignado','Días','Inicio','Vencimiento','Precio','Costo','Ganancia','Estado','Pago']
    const rows = v.map(r=>[
      new Date(r.created_at).toLocaleDateString('es-MX'),
      (r.clientes as any)?.nombre||'',
      (r.clientes as any)?.whatsapp||'',
      (r.plataformas as any)?.nombre||'',
      (r.cuentas as any)?.correo||'',
      r.nombre_perfil_asignado||'',
      r.duracion_dias,
      r.fecha_inicio,
      r.fecha_vencimiento,
      r.precio_venta,
      r.costo_real,
      (r.precio_venta||0)-(r.costo_real||0),
      r.estado,
      r.estado_pago||'—'
    ])
    const csv = [headers,...rows].map(r=>r.map((c:any)=>`"${c}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff'+csv],{ type:'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download=`ventas_${new Date().toISOString().split('T')[0]}.csv`; a.click()
    toast.success('CSV exportado ✅')
  }

  async function limpiarNotificaciones() {
    if (!confirm('¿Eliminar todas las notificaciones leídas?')) return
    setLimpiando(true)
    await supabase.from('notificaciones_sistema').delete().eq('leida',true)
    toast.success('Notificaciones limpiadas ✅')
    setLimpiando(false)
  }

  const secciones = [
    {
      titulo:'Apariencia',
      icono:<Sun size={18}/>,
      items:[
        {
          titulo: darkMode?'Cambiar a modo claro':'Cambiar a modo oscuro',
          desc:'Alterna entre el tema claro y oscuro',
          accion:<button className="btn-secondary text-xs py-2" onClick={toggleDarkMode}>
            {darkMode?<><Sun size={13}/> Modo claro</>:<><Moon size={13}/> Modo oscuro</>}
          </button>
        }
      ]
    },
    {
      titulo:'Exportar datos',
      icono:<Download size={18}/>,
      items:[
        {
          titulo:'Exportar ventas CSV',
          desc:'Descarga todas tus ventas en formato Excel/CSV',
          accion:<button className="btn-primary text-xs py-2" onClick={exportarCSVVentas}><Download size={13}/> Exportar CSV</button>
        },
        {
          titulo:'Backup JSON completo',
          desc:'Exporta todos los datos en formato JSON',
          accion:<button className="btn-secondary text-xs py-2" onClick={exportarDatos} disabled={exportando}>
            {exportando?<><RefreshCw size={13} className="animate-spin"/> Exportando...</>:<><Download size={13}/> Backup</>}
          </button>
        }
      ]
    },
    {
      titulo:'Mantenimiento',
      icono:<Database size={18}/>,
      items:[
        {
          titulo:'Limpiar notificaciones leídas',
          desc:'Elimina las notificaciones que ya marcaste como leídas',
          accion:<button className="btn-secondary text-xs py-2" onClick={limpiarNotificaciones} disabled={limpiando}>
            <RefreshCw size={13} className={limpiando?'animate-spin':''}/> Limpiar
          </button>
        }
      ]
    },
    {
      titulo:'Información del sistema',
      icono:<Shield size={18}/>,
      items:[
        { titulo:'Versión', desc:'StreamingAdmin v2.0 — by Aby', accion:null },
        { titulo:'Base de datos', desc:'Supabase PostgreSQL — Gestión de ventas Aby', accion:null },
        { titulo:'Módulos activos', desc:'Ventas · Inventario · Combos · Películas · Gaming · Cobros · Notificaciones', accion:null },
      ]
    }
  ]

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="section-title flex items-center gap-2">
          <Settings className="w-5 h-5" style={{color:'var(--brand)'}}/> Configuración
        </h1>
        <p className="text-sm mt-0.5" style={{color:'var(--text-3)'}}>Personaliza y administra tu sistema</p>
      </div>

      {secciones.map(sec=>(
        <div key={sec.titulo} className="card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b" style={{borderColor:'var(--border)',background:'var(--surface-2)'}}>
            <span style={{color:'var(--brand)'}}>{sec.icono}</span>
            <h2 className="font-bold text-sm" style={{color:'var(--text)'}}>{sec.titulo}</h2>
          </div>
          <div className="divide-y" style={{borderColor:'var(--border)'}}>
            {sec.items.map(item=>(
              <div key={item.titulo} className="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="font-semibold text-sm" style={{color:'var(--text)'}}>{item.titulo}</p>
                  <p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>{item.desc}</p>
                </div>
                {item.accion&&<div className="flex-shrink-0">{item.accion}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
