import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    let organizations
    if (currentUser.role === 'admin') {
      organizations = await db.organization.findMany({
        include: { _count: { select: { users: true } } },
        orderBy: { createdAt: 'desc' },
      })
    } else {
      organizations = await db.organization.findMany({
        where: { id: currentUser.organizationId },
        include: { _count: { select: { users: true } } },
      })
    }

    return NextResponse.json({ organizations })
  } catch (error) {
    console.error('Get organizations error:', error)
    return NextResponse.json({ error: 'Error al obtener organizaciones' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const { name } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }

    const existingOrg = await db.organization.findUnique({
      where: { name },
    })

    if (existingOrg) {
      return NextResponse.json({ error: 'La organización ya existe' }, { status: 400 })
    }

    const organization = await db.organization.create({
      data: { name },
    })

    return NextResponse.json({ organization })
  } catch (error) {
    console.error('Create organization error:', error)
    return NextResponse.json({ error: 'Error al crear organización' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const { id, name } = await request.json()

    if (!id || !name) {
      return NextResponse.json({ error: 'ID y nombre son requeridos' }, { status: 400 })
    }

    const organization = await db.organization.update({
      where: { id },
      data: { name },
    })

    return NextResponse.json({ organization })
  } catch (error) {
    console.error('Update organization error:', error)
    return NextResponse.json({ error: 'Error al actualizar organización' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID de organización requerido' }, { status: 400 })
    }

    // Check if organization has users
    const usersCount = await db.user.count({ where: { organizationId: id } })
    if (usersCount > 0) {
      return NextResponse.json({ 
        error: 'No se puede eliminar una organización con usuarios asociados' 
      }, { status: 400 })
    }

    await db.organization.delete({ where: { id } })

    return NextResponse.json({ message: 'Organización eliminada exitosamente' })
  } catch (error) {
    console.error('Delete organization error:', error)
    return NextResponse.json({ error: 'Error al eliminar organización' }, { status: 500 })
  }
}
