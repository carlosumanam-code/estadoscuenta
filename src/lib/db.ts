import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set!')
    return undefined
  }

  let finalUrl = url

  // Add pgbouncer=true for Supabase connection pooler if not already present
  // This is required for serverless environments to avoid prepared statement errors
  if (url.includes('supabase') && !url.includes('pgbouncer=true')) {
    const separator = url.includes('?') ? '&' : '?'
    finalUrl = `${finalUrl}${separator}pgbouncer=true`
  }

  // Add connection_limit for serverless if not present
  // This is CRITICAL for Netlify functions to avoid connection pool exhaustion
  if (!url.includes('connection_limit')) {
    const separator = finalUrl.includes('?') ? '&' : '?'
    finalUrl = `${finalUrl}${separator}connection_limit=1`
  }

  console.log('Database URL configured with pooler and connection limit')
  return finalUrl
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = getDatabaseUrl()

  console.log('Creating Prisma client with database URL pattern:',
    databaseUrl ? databaseUrl.substring(0, 30) + '...' : 'undefined')

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    // CRITICAL: Limit connections for serverless environments
    // Netlify functions have limited connections available
    // With Supabase pooler (pgbouncer), we only need 1 connection per function instance
  })
}

// In serverless (Netlify), we need to reuse the connection across invocations
// This singleton pattern prevents creating new connections on every function call
export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}

// Helper function to ensure database connection is established
export async function ensureConnection(): Promise<void> {
  try {
    await db.$connect()
    console.log('Database connection established')
  } catch (error) {
    console.error('Failed to connect to database:', error)
    throw error
  }
}

// Helper function for batch inserts - more efficient for serverless
export async function withTransaction<T>(
  fn: (tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>
): Promise<T> {
  return db.$transaction(fn)
}
