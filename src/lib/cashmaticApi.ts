/**
 * Cashmatic API – server.js proxy közvetítőn keresztül (port 3002)
 * Multi-kassza támogatással: minden függvény fogad opcionális deviceId paramétert.
 */

function getDefaultCashmaticServer(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    const protocol = window.location.protocol
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `${protocol}//${host}:3002/api`
    }
  }
  return 'http://localhost:3002/api'
}

const SERVER = import.meta.env.VITE_CASHMATIC_PROXY_URL
  ? `${import.meta.env.VITE_CASHMATIC_PROXY_URL}/api`
  : getDefaultCashmaticServer()

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeviceConfig {
  id: string
  name: string
  ip: string
  port: string
  protocol: string
  username: string
}

export interface CashmaticPaymentRequest {
  amount: number        // fillérben (cents)! 540 Ft = 54000 fillér
  currency?: string
  description?: string
}

export type CashmaticStatus =
  | 'idle' | 'pending' | 'waiting_cash' | 'completed'
  | 'failed' | 'cancelled' | 'timeout'

export interface CashmaticPaymentResponse {
  transactionId: string
  status: CashmaticStatus
  amountRequested: number
  amountPaid?: number
  change?: number
  error?: string
}

export interface CashmaticStatusResponse {
  transactionId: string
  status: CashmaticStatus
  amountPaid?: number
  change?: number
  error?: string
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function apiPost(endpoint: string, data?: object, deviceId = 'default'): Promise<any> {
  const qs = deviceId !== 'default' ? `?deviceId=${encodeURIComponent(deviceId)}` : ''
  const res = await fetch(`${SERVER}/${endpoint}${qs}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    data ? JSON.stringify(data) : undefined,
  })
  const json = await res.json()
  console.log(`[Cashmatic] POST ${endpoint}:`, json)
  return json
}

async function apiGet(endpoint: string, deviceId = 'default'): Promise<any> {
  const qs = deviceId !== 'default' ? `?deviceId=${encodeURIComponent(deviceId)}` : ''
  const res  = await fetch(`${SERVER}/${endpoint}${qs}`)
  const json = await res.json()
  console.log(`[Cashmatic] GET ${endpoint}:`, json)
  return json
}

async function apiGetRaw(endpoint: string, deviceId = 'default'): Promise<string> {
  const qs = deviceId !== 'default' ? `?deviceId=${encodeURIComponent(deviceId)}` : ''
  const res = await fetch(`${SERVER}/${endpoint}${qs}`)
  return await res.text()
}

export async function cashmaticGetClosureAmount(deviceId = 'default'): Promise<string> {
  return apiGetRaw('closure-amount', deviceId)
}

// ─── Device config API ────────────────────────────────────────────────────────

export async function getDevices(): Promise<DeviceConfig[]> {
  const r = await apiGet('devices')
  return r.success ? r.data : []
}

export async function addDevice(cfg: {
  id: string; name: string; ip: string; port: string
  protocol?: string; username: string; password: string
}): Promise<{ success: boolean; message?: string }> {
  const r = await apiPost('devices', cfg)
  return r
}

export async function updateDevice(id: string, cfg: Partial<{
  name: string; ip: string; port: string; protocol: string; username: string; password: string
}>): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${SERVER}/devices/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg),
  })
  return await res.json()
}

export async function deleteDevice(id: string): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${SERVER}/devices/${id}`, { method: 'DELETE' })
  return await res.json()
}

export async function testDevice(id: string, cfg?: {
  ip: string; port: string; protocol: string; username: string; password: string
}): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${SERVER}/devices/${id}/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg ?? {}),
  })
  return await res.json()
}

// ─── Payment API ──────────────────────────────────────────────────────────────

export async function cashmaticPing(deviceId = 'default'): Promise<boolean> {
  try {
    const r = await apiGet(`session-status`, deviceId)
    return r.isLoggedIn === true
  } catch {
    return false
  }
}

/** Fizetés indítása – amount fillérben (54000 = 540 Ft) */
export async function cashmaticStartPayment(
  req: CashmaticPaymentRequest,
  deviceId = 'default'
): Promise<CashmaticPaymentResponse> {
  const r = await apiPost('start-payment', { amount: req.amount }, deviceId)
  if (!r.success) throw new Error(r.message || `Cashmatic hiba: ${JSON.stringify(r)}`)
  return {
    transactionId:   r.transactionId ?? String(Date.now()),
    status:          'waiting_cash',
    amountRequested: req.amount,
  }
}

/** Tranzakció státusz (polling)
 * @param hasSeenTransaction - true ha már kaptunk legalább 1 waiting_cash választ
 *   (megakadályozza a false-positive completed-et az első 404-nél)
 */
export async function cashmaticGetStatus(
  transactionId: string,
  deviceId = 'default',
  hasSeenTransaction = false
): Promise<CashmaticStatusResponse> {
  const r = await apiGet('active-transaction', deviceId)
  return {
    transactionId,
    status:     mapStatus(r, hasSeenTransaction),
    amountPaid: r.data?.inserted      ?? r.data?.amount_paid    ??
                r.data?.amountInserted ?? r.data?.insertedAmount ??
                r.data?.creditAmount   ?? r.data?.credit        ?? undefined,
    change:     r.data?.dispensed     ?? r.data?.dispensedAmount ??
                r.data?.amountDispensed ?? r.data?.change        ??
                r.data?.resto         ?? undefined,
    error:      r.message ?? undefined,
  }
}

/** Fizetés megszakítása */
export async function cashmaticCancel(_transactionId: string, deviceId = 'default'): Promise<void> {
  await apiPost('cancel-payment', {}, deviceId)
}

/**
 * Fizetés jóváhagyása (CommitPayment)
 * Akkor hívandó, amikor a státusz 'completed' → jelzi a Cashmatic-nak,
 * hogy a POS elfogadta a tranzakciót és a pénz jóváírható.
 */
export async function cashmaticCommit(deviceId = 'default'): Promise<{ success: boolean; message?: string }> {
  try {
    const r = await apiPost('commit-payment', {}, deviceId)
    return { success: r.success ?? r.code === 0, message: r.message }
  } catch (err: any) {
    console.warn('[Cashmatic] commit-payment hiba (nem kritikus):', err.message)
    return { success: false, message: err.message }
  }
}

/** Kifizetés – gép pénzt ad ki
 *  amount fillérben! pl. 50000 = 500 Ft
 */
export async function cashmaticWithdrawal(
  amountInCents: number,
  reason = 'Kifizetés',
  deviceId = 'default'
): Promise<{ success: boolean; message?: string }> {
  const r = await apiPost('withdrawal', { amount: amountInCents, reason, reference: 'POS' }, deviceId)
  return r
}

// ─── Status mapping ───────────────────────────────────────────────────────────

/**
 * Cashmatic ActiveTransaction válaszából állapotot határoz meg.
 *
 * FONTOS: csak akkor hívjuk, ha már tudunk arról, hogy a tranzakció elindult
 * (hasSeenTransaction=true a POSSales polling loopban). Így elkerüljük, hogy
 * az első 404 (gép még nem regisztrálta a tx-et) false-positive 'completed'-et adjon.
 *
 * CommitPayment NEM kell normál fizetésnél – a gép auto-zárja.
 * CommitPayment csak akkor kell, ha a vevő KEVESEBBET fizetett be, és el akarjuk fogadni.
 */
function mapStatus(r: any, hasSeenTransaction = true): CashmaticStatus {
  // 404 vagy null data = nincs aktív tranzakció
  // → CSAK ha már láttuk a tx-et aktívan, akkor completed; különben pending
  if (r.code === 404 || r.code === -1) return hasSeenTransaction ? 'completed' : 'pending'
  if (r.data === null && !r.success)   return hasSeenTransaction ? 'completed' : 'pending'

  const status = (
    r.data?.status     ??
    r.data?.state      ??
    r.data?.Status     ??
    r.data?.State      ??
    r.data?.transactionStatus ??
    r.data?.txStatus   ??
    ''
  ).toString().toLowerCase()

  // Összeg mezők – minden lehetséges Cashmatic field neve
  const requested = r.data?.requested     ?? r.data?.amount        ??
                    r.data?.requestedAmount ?? r.data?.amountRequested ??
                    r.data?.totalAmount    ?? 0
  const inserted  = r.data?.inserted      ?? r.data?.amount_paid   ??
                    r.data?.amountInserted ?? r.data?.insertedAmount ??
                    r.data?.creditAmount   ?? r.data?.credit        ?? 0
  const dispensed = r.data?.dispensed     ?? r.data?.dispensedAmount ??
                    r.data?.amountDispensed ?? r.data?.change        ??
                    r.data?.resto         ?? 0

  // Ha már volt kifizetés (dispensed > 0) → completed
  if (dispensed > 0 && hasSeenTransaction) return 'completed'

  // Ha a befizetett összeg eléri a kért összeget → completed
  if (requested > 0 && inserted >= requested) return 'completed'

  // Státusz string alapján
  if (
    status.includes('complet') || status.includes('paid')    ||
    status.includes('success') || status.includes('done')    ||
    status.includes('closed')  || status.includes('close')   ||
    status.includes('finish')  || status.includes('ended')   ||
    status.includes('chiuso')  || status.includes('pagato')  || // olasz
    status.includes('ferme')   || status.includes('termine')    // olasz/francia
  ) return 'completed'

  if (
    status.includes('wait')    || status.includes('insert')  ||
    status.includes('attesa')  || status.includes('active')  ||
    status.includes('running') || status.includes('open')    ||
    status.includes('process') || status.includes('accept')  ||
    status.includes('dispens') // dispensing = még fut
  ) return 'waiting_cash'

  if (status.includes('cancel') || status.includes('abort') || status.includes('annull'))
    return 'cancelled'
  if (status.includes('fail') || status.includes('error') || status.includes('err'))
    return 'failed'
  if (status.includes('timeout') || status.includes('scadut') || status.includes('expired'))
    return 'timeout'

  // Fallback: ha van data és active transaction → várjuk
  if (r.success && r.data) return 'waiting_cash'
  return 'pending'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatHUF(amount: number): string {
  return new Intl.NumberFormat('hu-HU', {
    style: 'currency', currency: 'HUF',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount)
}

/** Forint → fillér (a Cashmatic fillérben kér összeget) */
export function toCents(amount: number): number {
  return Math.round(amount * 100)
}

/** Fillér → forint (megjelenítéshez) */
export function fromCents(cents: number): number {
  return cents / 100
}