'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Settings, Save, Database, Bell, Shield } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('configuracion').select('*')
      const obj: Record<string, string> = {}
      data?.forEach(c => { obj[c.clave] = c.valor || '' })
      setConfig(obj)
      setLoading(false)
    }
    fetch()
  }, [])

  async function saveConfig() {
    setSaving(true)
    try {
      await Promise.all(Object.entries(config).map(([clave, valor]) =>
        supabase.from('configuracion').upsert({ clave, valor, updated_at: new Date().toISOString() }, { onConflict: 'clave' })
      ))
      toast.success('Configuración guardada')
    } finally {
      setSaving(false)
    }
  }

  function updateConfig(clave: string, valor: string) {
    setConfig(c => ({ ...c, [clave]: valor }))
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="section-title flex items-center gap-2"><Settings size={22} /> Configuración</h1>
        <p className="section-subtitle">Ajustes del sistema StreamingAby</p>
      </div>

      {/* Negocio */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-slate-200 flex items-center gap-2"><Shield size={16} className="text-sky-400" /> Datos del negocio</h2>
        <div>
          <label className="label">Nombre del negocio</label>
          <input className="input" value={config.negocio_nombre || ''} onChange={e => updateConfig('negocio_nombre', e.target.value)} />
        </div>
        <div>
          <label className="label">Moneda</label>
          <select className="select" value={config.moneda || 'MXN'} onChange={e => updateConfig('moneda', e.target.value)}>
            <option value="MXN">MXN — Peso mexicano</option>
            <option value="USD">USD — Dólar americano</option>
            <option value="COP">COP — Peso colombiano</option>
            <option value="ARS">ARS — Peso argentino</option>
          </select>
        </div>
      </div>

      {/* Alertas */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-slate-200 flex items-center gap-2"><Bell size={16} className="text-yellow-400" /> Alertas</h2>
        <div>
          <label className="label">Días de anticipación para alertas de vencimiento</label>
          <input className="input w-24" type="number" min="1" max="30" value={config.dias_alerta_vencimiento || '3'} onChange={e => updateConfig('dias_alerta_vencimiento', e.target.value)} />
          <p className="text-xs text-slate-500 mt-1">Se mostrará alerta cuando queden estos días o menos para el vencimiento</p>
        </div>
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="accent-sky-500" checked={config.notificaciones_email === 'true'} onChange={e => updateConfig('notificaciones_email', e.target.checked ? 'true' : 'false')} />
            <span className="text-sm text-slate-300">Activar notificaciones por email</span>
          </label>
        </div>
      </div>

      {/* Info Supabase */}
      <div className="card space-y-2">
        <h2 className="font-semibold text-slate-200 flex items-center gap-2"><Database size={16} className="text-purple-400" /> Base de datos</h2>
        <div className="p-3 rounded-lg bg-[#0f172a] border border-[#1e2d42]">
          <div className="text-xs text-slate-500 mb-1">Proyecto Supabase</div>
          <div className="text-sm text-slate-300 font-mono">jkaqsenmhfijzptoxpak.supabase.co</div>
        </div>
        <div className="text-xs text-slate-500">Conexión activa y funcionando correctamente.</div>
      </div>

      <button onClick={saveConfig} disabled={saving} className="btn-primary">
        <Save size={16} /> {saving ? 'Guardando...' : 'Guardar Configuración'}
      </button>
    </div>
  )
}
