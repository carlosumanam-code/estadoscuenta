import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password, organizationId } = await request.json()

    if (!email || !password || !organizationId) {
      return NextResponse.json(
        { error: 'Organización, email y contraseña son requeridos' },
        { status: 400 }
      )
    }

    // Verify organization exists
    const organization = await db.organization.findUnique({
      where: { id: organizationId },
    })

    if (!organization) {
      return NextResponse.json(
        { error: 'Organización no válida' },
        { status: 401 }
      )
    }

    // Find user with matching email AND organization
    let user
    try {
      user = await db.user.findFirst({
        where: {
          email: email.toLowerCase(),
          organizationId: organizationId,
        },
        include: { organization: true },
      })
    } catch (dbError: any) {
      console.error('Database connection error:', dbError)
      return NextResponse.json(
        { error: 'Error de conexión a la base de datos. Verifique la configuración.' },
        { status: 500 }
      )
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      )
    }

    const passwordMatch = await bcrypt.compare(password, user.password)

    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      )
    }

    const session = await getSession()
    session.userId = user.id
    session.email = user.email
    session.name = user.name
    session.role = user.role
    session.organizationId = user.organizationId
    session.isLoggedIn = true
    await session.save()

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organization: user.organization,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
