// BCR (Banco de Costa Rica) PDF Parser
// Parses transaction data extracted from BCR PDF statements

export interface BCRTransaction {
  date: Date
  amount: number
  description: string
  type: 'credit' | 'debit'
  rawLine: string
}

export interface BCRParseResult {
  credits: BCRTransaction[]
  debits: BCRTransaction[]
  totalCredits: number
  totalDebits: number
}

// Parse amount string to number
function parseAmount(str: string): number {
  const cleaned = str.replace(/,/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

// Parse date string DD/MM/YY to Date
function parseDate(dateStr: string): Date | null {
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{2})/)
  if (!match) return null
  
  const day = parseInt(match[1])
  const month = parseInt(match[2])
  const year = parseInt(match[3]) + 2000
  
  return new Date(year, month - 1, day)
}

// Keywords that indicate CREDIT transactions (ingresos - dinero que ENTRA)
// IMPORTANTE: Solo transacciones donde el dinero ENTRA a la cuenta
const CREDIT_KEYWORDS = [
  'PIN ENTRANTE',        // SINPE entrante - dinero que RECIBO
  'ENTRANTE',            // Cualquier transferencia entrante
  'NC DEPOSITO',         // Nota de crédito por depósito
  'CREDITO POR DEP',     // Crédito por depósito
  'DEPOSITOS -',         // Depósitos recibidos
  'INTS GANADOS',        // Intereses ganados
  'DTR TIEMPOREAL',      // Transferencia recibida en tiempo real
]

// Keywords that indicate DEBIT transactions (gastos - dinero que SALE)
// IMPORTANTE: Transferencias SALIENTES aunque contengan "SINPE" o "TRANSFERENC"
const DEBIT_KEYWORDS = [
  // SINPE SALIENTE - transferencias a otras entidades
  'SINPE MOVIL OTRA ENT',   // SINPE móvil a OTRA entidad = SALIDA
  'SINPE MOVIL',            // SINPE móvil genérico = SALIDA (por defecto)
  'SINPE MÓVIL',            // Con acento

  // Compras y pagos
  'COMPRAS EN COMERCIOS',   // Débito por compras
  'DB AH PAGO',             // Débito ahorro por pago
  'ND AH',                  // Nota de débito ahorro
  'PG AH',                  // Pago desde ahorro
  'PAG SERV PUB',           // Pago servicios públicos
  'DEBITO COMPENSADO',      // Débito compensado

  // Otros gastos
  'TASACION',               // Tasación
  'COSEVI',                 // Pago COSEVI
  'PAGOFINALPAQUETE',       // Pago de paquete
  'DIEZMO',                 // Diezmo (donación)
  'HONORARIOS',             // Pagos de honorarios (salida)
  'PRESTAMO',               // Pago de préstamo (salida)
]

// Determine transaction type based on description
function getTransactionType(description: string): 'credit' | 'debit' {
  const upper = description.toUpperCase()

  // REGLA 1: Si contiene "ENTRANTE", es CRÉDITO (dinero que entra)
  // Esto tiene prioridad sobre todo lo demás
  if (upper.includes('ENTRANTE')) {
    return 'credit'
  }

  // REGLA 2: Verificar palabras clave de DÉBITO (salidas de dinero)
  // Esto debe ir ANTES de verificar créditos para evitar falsos positivos
  for (const keyword of DEBIT_KEYWORDS) {
    if (upper.includes(keyword)) {
      return 'debit'
    }
  }

  // REGLA 3: Verificar palabras clave de CRÉDITO (entradas de dinero)
  for (const keyword of CREDIT_KEYWORDS) {
    if (upper.includes(keyword)) {
      return 'credit'
    }
  }

  // REGLA 4: Si contiene "SINPE" sin "ENTRANTE", asumir DÉBITO
  // La mayoría de SINPEs son salientes
  if (upper.includes('SINPE') && !upper.includes('ENTRANTE')) {
    return 'debit'
  }

  // REGLA 5: Si contiene "TRANSFERENC" sin "ENTRANTE", asumir DÉBITO
  // Las transferencias salientes son más comunes en estados de cuenta
  if (upper.includes('TRANSFERENC') && !upper.includes('ENTRANTE')) {
    return 'debit'
  }

  // Por defecto: DÉBITO (más conservador)
  return 'debit'
}

// Main BCR parser
export function parseBCRText(text: string): BCRParseResult {
  const credits: BCRTransaction[] = []
  const debits: BCRTransaction[] = []
  
  console.log('=== BCR Parser ===')
  console.log('Text length:', text.length)
  
  // Pattern 1: Format with tarjeta + documento (COMPRAS EN COMERCIOS)
  // DD/MM/YY DD/MM/YY TARJETA DOCUMENTO DESCRIPCION MONTO
  // Example: 29/08/24 02/09/24 1494 271671 COMPRAS EN COMERCIOS - ... 7,357.35
  const pattern1 = /(\d{2}\/\d{2}\/\d{2})\s+(\d{2}\/\d{2}\/\d{2})\s+(\d+)\s+(\d+)\s+(.+?)\s+(\d{1,3}(?:,\d{3})*\.\d{2})/g
  
  // Pattern 2: Format with single documento (SINPE, TRANSFERENCIAS)
  // DD/MM/YY DD/MM/YY DOCUMENTO DESCRIPCION MONTO
  // Example: 31/08/24 02/09/24 80998792 PIN ENTRANTE SINPE - ... 1,155,000.00
  const pattern2 = /(\d{2}\/\d{2}\/\d{2})\s+(\d{2}\/\d{2}\/\d{2})\s+(\d{7,})\s+(.+?)\s+(\d{1,3}(?:,\d{3})*\.\d{2})/g
  
  const processedLines = new Set<string>()
  let match
  
  // Process pattern 1 (with tarjeta + documento)
  while ((match = pattern1.exec(text)) !== null) {
    const dateStr = match[1]
    const description = match[5].trim()
    const amountStr = match[6]
    const lineKey = `${dateStr}|${amountStr}|${description.substring(0, 30)}`
    
    if (processedLines.has(lineKey)) continue
    processedLines.add(lineKey)
    
    const date = parseDate(dateStr)
    const amount = parseAmount(amountStr)
    
    if (!date || amount <= 0) continue
    
    const type = getTransactionType(description)
    
    const transaction: BCRTransaction = {
      date,
      amount,
      description: description.substring(0, 200),
      type,
      rawLine: match[0]
    }
    
    if (type === 'credit') {
      credits.push(transaction)
      console.log(`[CREDIT] ${dateStr} | ${amount} | ${description.substring(0, 40)}`)
    } else {
      debits.push(transaction)
    }
  }
  
  // Process pattern 2 (single documento - 7+ digits)
  while ((match = pattern2.exec(text)) !== null) {
    const dateStr = match[1]
    const description = match[4].trim()
    const amountStr = match[5]
    const lineKey = `${dateStr}|${amountStr}|${description.substring(0, 30)}`
    
    if (processedLines.has(lineKey)) continue
    processedLines.add(lineKey)
    
    const date = parseDate(dateStr)
    const amount = parseAmount(amountStr)
    
    if (!date || amount <= 0) continue
    
    const type = getTransactionType(description)
    
    const transaction: BCRTransaction = {
      date,
      amount,
      description: description.substring(0, 200),
      type,
      rawLine: match[0]
    }
    
    if (type === 'credit') {
      credits.push(transaction)
      console.log(`[CREDIT] ${dateStr} | ${amount} | ${description.substring(0, 40)}`)
    } else {
      debits.push(transaction)
    }
  }
  
  console.log('Credits found:', credits.length)
  console.log('Debits found:', debits.length)
  
  // Sort by date
  credits.sort((a, b) => a.date.getTime() - b.date.getTime())
  debits.sort((a, b) => a.date.getTime() - b.date.getTime())
  
  const totalCredits = credits.reduce((sum, t) => sum + t.amount, 0)
  const totalDebits = debits.reduce((sum, t) => sum + t.amount, 0)
  
  console.log('Total credits:', totalCredits)
  console.log('Total debits:', totalDebits)
  
  return {
    credits,
    debits,
    totalCredits,
    totalDebits
  }
}
