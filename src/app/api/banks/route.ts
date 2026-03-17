import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

// GET - List all banks (global)
export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Banks are global, no organization filter
    const banks = await db.bank.findMany({
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ banks })
  } catch (error) {
    console.error('Get banks error:', error)
    return NextResponse.json({ error: 'Error al obtener bancos' }, { status: 500 })
  }
}

// POST - Create a new bank (admin only)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Only admins can create banks
    if (currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores pueden crear bancos' }, { status: 403 })
    }

    const { name, code } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }

    // Check if bank with same name already exists
    const existingBank = await db.bank.findUnique({
      where: { name },
    })

    if (existingBank) {
      return NextResponse.json({ error: 'Ya existe un banco con ese nombre' }, { status: 400 })
    }

    const bank = await db.bank.create({
      data: {
        name,
        code,
      },
    })

    return NextResponse.json({ bank })
  } catch (error) {
    console.error('Create bank error:', error)
    return NextResponse.json({ error: 'Error al crear banco' }, { status: 500 })
  }
}

// PUT - Update a bank (admin only)
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Only admins can update banks
    if (currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores pueden editar bancos' }, { status: 403 })
    }

    const { id, name, code } = await request.json()

    if (!id || !name) {
      return NextResponse.json({ error: 'ID y nombre son requeridos' }, { status: 400 })
    }

    // Check if bank exists
    const existingBank = await db.bank.findUnique({ where: { id } })
    if (!existingBank) {
      return NextResponse.json({ error: 'Banco no encontrado' }, { status: 404 })
    }

    // Check if another bank with same name exists
    const duplicateBank = await db.bank.findFirst({
      where: {
        name,
        NOT: { id },
      },
    })

    if (duplicateBank) {
      return NextResponse.json({ error: 'Ya existe otro banco con ese nombre' }, { status: 400 })
    }

    const bank = await db.bank.update({
      where: { id },
      data: { name, code },
    })

    return NextResponse.json({ bank })
  } catch (error) {
    console.error('Update bank error:', error)
    return NextResponse.json({ error: 'Error al actualizar banco' }, { status: 500 })
  }
}

// DELETE - Delete a bank (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Only admins can delete banks
    if (currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores pueden eliminar bancos' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID de banco requerido' }, { status: 400 })
    }

    // Check if bank exists
    const bank = await db.bank.findUnique({ 
      where: { id },
      include: { bankStatements: true },
    })
    
    if (!bank) {
      return NextResponse.json({ error: 'Banco no encontrado' }, { status: 404 })
    }

    // Check if bank has associated statements
    if (bank.bankStatements.length > 0) {
      return NextResponse.json({ 
        error: 'No se puede eliminar el banco porque tiene estados de cuenta asociados' 
      }, { status: 400 })
    }

    await db.bank.delete({ where: { id } })

    return NextResponse.json({ message: 'Banco eliminado exitosamente' })
  } catch (error) {
    console.error('Delete bank error:', error)
    return NextResponse.json({ error: 'Error al eliminar banco' }, { status: 500 })
  }
}
