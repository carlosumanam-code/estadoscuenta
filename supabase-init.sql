-- Ejecutar este SQL en Supabase SQL Editor
-- Para crear las tablas necesarias

-- Tabla Organization
CREATE TABLE IF NOT EXISTS "Organization" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT UNIQUE NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Tabla User
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT UNIQUE NOT NULL,
  "password" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT DEFAULT 'user',
  "organizationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Tabla Bank
CREATE TABLE IF NOT EXISTS "Bank" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT UNIQUE NOT NULL,
  "code" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Tabla BankStatement
CREATE TABLE IF NOT EXISTS "BankStatement" (
  "id" TEXT PRIMARY KEY,
  "bankId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "processedAt" TIMESTAMP DEFAULT NOW()
);

-- Tabla Transaction
CREATE TABLE IF NOT EXISTS "Transaction" (
  "id" TEXT PRIMARY KEY,
  "bankStatementId" TEXT NOT NULL,
  "date" TIMESTAMP NOT NULL,
  "amount" FLOAT NOT NULL,
  "month" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT DEFAULT 'credit',
  "createdAt" TIMESTAMP DEFAULT NOW()
);

-- Foreign Keys
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;
ALTER TABLE "BankStatement" ADD CONSTRAINT "BankStatement_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE CASCADE;
ALTER TABLE "BankStatement" ADD CONSTRAINT "BankStatement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_bankStatementId_fkey" FOREIGN KEY ("bankStatementId") REFERENCES "BankStatement"("id") ON DELETE CASCADE;

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS "User_organizationId_idx" ON "User"("organizationId");
CREATE INDEX IF NOT EXISTS "BankStatement_bankId_idx" ON "BankStatement"("bankId");
CREATE INDEX IF NOT EXISTS "BankStatement_organizationId_idx" ON "BankStatement"("organizationId");
CREATE INDEX IF NOT EXISTS "Transaction_bankStatementId_idx" ON "Transaction"("bankStatementId");

-- Insertar organización inicial
INSERT INTO "Organization" ("id", "name", "createdAt", "updatedAt") VALUES ('cmmv5aink0000nn3jxdldsbxh', 'FCRCAN', NOW(), NOW()) ON CONFLICT ("name") DO NOTHING;

-- Insertar usuario administrador (contraseña: Credit02₡)
INSERT INTO "User" ("id", "email", "password", "name", "role", "organizationId", "createdAt", "updatedAt") VALUES (
  'cmmv5aink0001nn3jxdldsbxh',
  'gestion@fundacioncostaricacanada.org',
  '$2b$10$Do1JNPJkEndIPz2G6DEy/uwHojU5c3nP6xIjkcYv434mzt31uRHmu',
  'Administrador',
  'admin',
  'cmmv5aink0000nn3jxdldsbxh',
  NOW(),
  NOW()
) ON CONFLICT ("email") DO NOTHING;

-- Insertar bancos
INSERT INTO "Bank" ("id", "name", "code", "createdAt", "updatedAt") VALUES
  ('cmmv5aipb0003nn3j98gfmv73', 'Banco Nacional de Costa Rica', 'BNCR', NOW(), NOW()),
  ('cmmv5aipd0004nn3j3xj6360f', 'Banco de Costa Rica', 'BCR', NOW(), NOW()),
  ('cmmv5aipe0005nn3jv4j8ffqg', 'Banco Popular', 'BPDC', NOW(), NOW()),
  ('cmmv5aipf0006nn3j2xruk24f', 'BAC Credomatic', 'BAC', NOW(), NOW()),
  ('cmmv5aipg0007nn3jkkxau3gp', 'Scotiabank Costa Rica', 'SCOT', NOW(), NOW()),
  ('cmmv5aiph0008nn3jb7ni761j', 'Davivienda Costa Rica', 'DAV', NOW(), NOW()),
  ('cmmv5aipi0009nn3jrujjkqjb', 'Grupo Mutual Alajuela', 'GMA', NOW(), NOW()),
  ('cmmv5aipi000ann3jadh24x90', 'Coopenae', 'CPN', NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;
