'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Tv, Plus, X, CheckCircle, Edit2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const ICONOS = ['🎬','🏰','🎭','⭐','📦','🎵','▶️','🍥','🍎','📡','🎮','🎲','📺','🌟','💫']
const COLORES = ['#E50914','#1E90FF','#5822A4','#0064FF','#00A8E0','#1DB954','#FF0000','#F47521','#555555','#FF6B00','#c044a0','#8040e0','#10b981','#f59e0b','#3b82f6']

export default function PlataformasPage() {
  const [plataformas, setPlats] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [modalOpen, setMOpen]   = useState(false)
  const [editando, setEdit]     = useState<any|null>(null)

  const [fp, setFp] = useState({
    nombre:'', icono:'🎬', color:'#c044a0',
    max_perfiles:5,  descripcion:'', activa:true
  })

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('plataformas').select('*').order('nombre')
    setPlats(data||[])
    setLoading(false)
  }, [])
  useEffect(()=>{ load() },[load])

  async function guardar() {
  if (!fp.nombre.trim()) return toast.error('Nombre requerido')

  const tid = toast.loading(editando ? 'Actualizando...' : 'Guardando...')

  try {
    const payload = {
      nombre: fp.nombre,
      icono: fp.icono,
      color: fp.color,
      max_perfiles: Number(fp.max_perfiles) || 5,
      descripcion: fp.descripcion || null,
      activa: fp.activa
    }

    console.log('PAYLOAD:', payload)

    if (editando) {
      const { data, error } = await supabase
        .from('plataformas')
        .update(payload)
        .eq('id', editando.id)
        .select()

      console.log('UPDATE:', data)
      console.log('ERROR:', error)

      if (error) throw error

      toast.success('Actualizada ✅', { id: tid })
    } else {
      const { error } = await supabase
        .from('plataformas')
        .insert(payload)

      if (error) throw error

      toast.success('Plataforma creada ✅', { id: tid })
    }

    await load()
    setMOpen(false)
    setEdit(null)
    reset()

  } catch (e: any) {
    console.error(e)
    toast.error(e.message || 'Error', { id: tid })
  }
}
  async function eliminar(id: string) {
    if (!confirm('¿Desactivar esta plataforma?')) return
    await supabase.from('plataformas').update({ activa:false }).eq('id',id)
    toast.success('Desactivada'); load()
  }

  function abrir(p?: any) {
    if (p) { setEdit(p); setFp({ nombre:p.nombre, icono:p.icono||'🎬', color:p.color||'#c044a0', max_perfiles:p.max_perfiles, descripcion:p.descripcion||'', activa:p.activa }) }
    else { reset(); setEdit(null) }
    setMOpen(true)
  }
  function reset() { setFp({ nombre:'', icono:'🎬', color:'#c044a0', max_perfiles:5, descripcion:'', activa:true }) }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <Tv className="w-5 h-5" style={{color:'var(--brand)'}}/> Plataformas
          </h1>
          <p className="text-sm mt-0.5" style={{color:'var(--text-3)'}}>{plataformas.filter(p=>p.activa).length} activas</p>
        </div>
        <button className="btn-primary" onClick={()=>abrir()}><Plus size={15}/> Nueva plataforma</button>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{color:'var(--text-3)'}}>Cargando...</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 stagger-children">
          {plataformas.map(p=>(
            <div key={p.id} className={`card-hover p-5 text-center space-y-3 ${!p.activa?'opacity-50':''}`}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-sm"
                style={{backgroundColor:`${p.color}25`}}>
                {p.icono}
              </div>
              <div>
                <h3 className="font-bold" style={{color:'var(--text)'}}>{p.nombre}</h3>
                <p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>
                  {p.max_perfiles} perfiles máx.
                </p>
                <div className="w-3 h-3 rounded-full mx-auto mt-2" style={{background:p.color}}/>
              </div>
              {!p.activo&&<span className="badge bg-gray-100 text-gray-500 text-xs">Inactiva</span>}
              <div className="flex justify-center gap-2 pt-1">
                <button className="btn-ghost p-1.5" onClick={()=>abrir(p)}><Edit2 size={13}/></button>
                <button className="btn-ghost p-1.5 text-red-500" onClick={()=>eliminar(p.id)}><Trash2 size={13}/></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setMOpen(false)}>
          <div className="modal-content animate-slide-up max-w-md">
            <div className="modal-header">
              <h2 className="text-lg font-bold" style={{color:'var(--text)'}}>{editando?'Editar plataforma':'Nueva plataforma'}</h2>
              <button className="btn-ghost p-1.5" onClick={()=>setMOpen(false)}><X size={18}/></button>
            </div>
            <div className="modal-body space-y-4">
              <div>
                <label className="label">Nombre *</label>
                <input className="input" placeholder="Netflix, Disney+..." value={fp.nombre} onChange={e=>setFp(f=>({...f,nombre:e.target.value}))}/>
              </div>
              <div>
                <label className="label">Ícono</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {ICONOS.map(ic=>(
                    <button key={ic} onClick={()=>setFp(f=>({...f,icono:ic}))}
                      className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center border-2 transition-all ${fp.icono===ic?'border-pink-400 scale-110':'border-transparent'}`}
                      style={{background:fp.icono===ic?'var(--brand-light)':'var(--surface-2)'}}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Color</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {COLORES.map(c=>(
                    <button key={c} onClick={()=>setFp(f=>({...f,color:c}))}
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${fp.color===c?'scale-110 border-white shadow-lg':'border-transparent'}`}
                      style={{background:c}}/>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Máx. perfiles</label>
                  <input className="input" type="number" min={1} max={20} value={fp.max_perfiles} onChange={e=>setFp(f=>({...f,max_perfiles:Number(e.target.value)}))}/>
                </div>
                <div>
                </div>
              </div>
              <div>
                <label className="label">Descripción</label>
                <textarea className="input" rows={2} placeholder="Reglas especiales, observaciones..." value={fp.descripcion} onChange={e=>setFp(f=>({...f,descripcion:e.target.value}))}/>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{background:'var(--surface-2)',border:'1px solid var(--border)'}}>
                <input type="checkbox" id="pact" className="w-4 h-4" checked={fp.activa} onChange={e=>setFp(f=>({...f,activa:e.target.checked}))}/>
                <label htmlFor="pact" className="text-sm cursor-pointer font-semibold" style={{color:'var(--text-2)'}}>Plataforma activa</label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={()=>setMOpen(false)}>Cancelar</button>
              <button className="btn-primary" onClick={guardar}><CheckCircle size={15}/>{editando?'Actualizar':'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
