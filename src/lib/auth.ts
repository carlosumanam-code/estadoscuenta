import { getIronSession, SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'
import { db } from './db'

export interface SessionData {
  userId?: string
  email?: string
  name?: string
  role?: string
  organizationId?: string
  isLoggedIn: boolean
}

export const defaultSession: SessionData = {
  isLoggedIn: false,
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long_for_security',
  cookieName: 'bank_statement_session',
  cookieOptions: {
    httpOnly: true,
    secure: false, // Always false for development
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: '/',
  },
}

export async function getSession() {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)
  
  if (!session.isLoggedIn) {
    session.isLoggedIn = false
  }
  
  return session
}

export async function getCurrentUser() {
  const session = await getSession()
  
  if (!session.isLoggedIn || !session.userId) {
    return null
  }
  
  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { organization: true },
  })
  
  return user
}

export async function requireAuth() {
  const user = await getCurrentUser()
  
  if (!user) {
    throw new Error('Unauthorized')
  }
  
  return user
}

export async function requireAdmin() {
  const user = await requireAuth()
  
  if (user.role !== 'admin') {
    throw new Error('Admin access required')
  }
  
  return user
}
