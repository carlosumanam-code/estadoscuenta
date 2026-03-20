import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function POST() {
  try {
    const session = await getSession()
    session.destroy()
    
    return NextResponse.json({ message: 'Sesión cerrada exitosamente' })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Error al cerrar sesión' },
      { status: 500 }
    )
  }
}
