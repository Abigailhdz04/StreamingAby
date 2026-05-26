import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { count } = await supabase
    .from('reportes')
    .select('*', { count: 'exact', head: true })
    .eq('estado', 'pendiente')

  return NextResponse.json({ count: count || 0 })
}
