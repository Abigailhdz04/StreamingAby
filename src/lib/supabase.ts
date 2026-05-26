import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  plataformas: {
    id: string
    nombre: string
    icono: string
    color: string
    max_perfiles: number
    descripcion: string
    activa: boolean
    created_at: string
  }
  proveedores: {
    id: string
    nombre: string
    telefono: string
    whatsapp: string
    correo: string
    notas: string
    calidad: number
    activo: boolean
    created_at: string
  }
  clientes: {
    id: string
    nombre: string
    telefono: string
    whatsapp: string
    correo: string
    notas: string
    estado: 'activo' | 'vencido' | 'suspendido' | 'pendiente'
    fecha_registro: string
    created_at: string
  }
  cuentas: {
    id: string
    plataforma_id: string
    proveedor_id: string
    correo: string
    contrasena: string
    pin: string
    tipo: 'completa' | 'perfil_individual'
    max_perfiles: number
    perfiles_disponibles: number
    perfiles_ocupados: number
    fecha_compra: string
    fecha_vencimiento: string
    costo: number
    estado: 'disponible' | 'parcial' | 'llena' | 'vencida' | 'reportada' | 'suspendida'
    notas: string
    created_at: string
  }
}
