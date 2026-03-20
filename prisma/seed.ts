import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  // Create master organization
  const org = await prisma.organization.upsert({
    where: { name: 'FCRCAN' },
    update: {},
    create: {
      name: 'FCRCAN',
    },
  })

  // Create master admin user
  const hashedPassword = await bcrypt.hash('Credit02₡', 10)
  
  const user = await prisma.user.upsert({
    where: { email: 'gestion@fundacioncostaricacanada.org' },
    update: {},
    create: {
      email: 'gestion@fundacioncostaricacanada.org',
      password: hashedPassword,
      name: 'Administrador',
      role: 'admin',
      organizationId: org.id,
    },
  })

  // Create default banks (GLOBAL - not tied to organization)
  const banks = [
    { name: 'Banco Nacional de Costa Rica', code: 'BNCR' },
    { name: 'Banco de Costa Rica', code: 'BCR' },
    { name: 'Banco Popular', code: 'BPDC' },
    { name: 'BAC Credomatic', code: 'BAC' },
    { name: 'Scotiabank Costa Rica', code: 'SCOT' },
    { name: 'Davivienda Costa Rica', code: 'DAV' },
    { name: 'Grupo Mutual Alajuela', code: 'GMA' },
    { name: 'Coopenae', code: 'CPN' },
  ]

  for (const bank of banks) {
    await prisma.bank.upsert({
      where: { name: bank.name },
      update: {},
      create: {
        name: bank.name,
        code: bank.code,
      },
    }).catch(() => {
      // Ignore errors for existing banks
    })
  }

  console.log('Seed completed!')
  console.log('Organization:', org)
  console.log('Admin user:', user.email)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
