/**
 * Szemesi Pékség Kft. – Blokk / Nyugta generátor
 * Nyomtatható HTML blokkot generál, amit PDF-ként is el lehet menteni.
 */

// ─── Céges adatok ─────────────────────────────────────────────────────────────

const COMPANY = {
  name:       'Szemesi Pékség Kft.',
  address1:   '8636 Balatonszemes',
  address2:   'Szabadság u. 50.',
  taxNumber:  '12345678-2-42',
  regNumber:  '01-09-123456',
  email:      'info@szemesipekseg.hu',
  phone:      '+36 84 360 133',
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReceiptItem {
  name:       string
  quantity:   number
  unitPrice:  number   // Ft
  subtotal:   number   // Ft
  vatPct:     number   // pl. 27
  unit:       string
}

export interface ReceiptData {
  receiptNumber:  string          // pl. "2024-001234"
  date:           Date
  cashierName:    string
  items:          ReceiptItem[]
  subtotalNet:    number          // Ft, nettó összeg
  taxAmount:      number          // Ft, ÁFA
  total:          number          // Ft, bruttó végösszeg
  paymentMethod:  'cash' | 'card'
  amountPaid:     number          // Ft, befizetett összeg
  change:         number          // Ft, visszajáró
  success:        boolean
  failReason?:    string          // sikertelen esetén
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('hu-HU').format(Math.round(n)) + ' Ft'
}

function pad(s: string, width: number, right = false): string {
  const str = String(s)
  if (str.length >= width) return str
  const pad = ' '.repeat(width - str.length)
  return right ? pad + str : str + pad
}

function dateStr(d: Date): string {
  return d.toLocaleDateString('hu-HU', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
}

function timeStr(d: Date): string {
  return d.toLocaleTimeString('hu-HU', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

// ─── VAT breakdown ────────────────────────────────────────────────────────────

function groupVat(items: ReceiptItem[]): Map<number, { net: number; vat: number; gross: number }> {
  const map = new Map<number, { net: number; vat: number; gross: number }>()
  for (const item of items) {
    const pct = item.vatPct
    const gross = item.subtotal
    const vat = gross * pct / (100 + pct)
    const net = gross - vat
    const cur = map.get(pct) ?? { net: 0, vat: 0, gross: 0 }
    map.set(pct, { net: cur.net + net, vat: cur.vat + vat, gross: cur.gross + gross })
  }
  return map
}

// ─── HTML generálás ───────────────────────────────────────────────────────────

export function generateReceiptHTML(data: ReceiptData): string {
  const vatGroups = groupVat(data.items)

  const itemRows = data.items.map(item => {
    const nameMaxLen = 26
    const name = item.name.length > nameMaxLen ? item.name.substring(0, nameMaxLen - 1) + '…' : item.name
    return `
      <tr class="item-row">
        <td class="item-name">${escHtml(name)}</td>
        <td class="item-qty">${item.quantity}${item.unit !== 'db' ? ' ' + item.unit : ''}</td>
        <td class="item-price">${fmt(item.unitPrice)}</td>
        <td class="item-total">${fmt(item.subtotal)}</td>
      </tr>`
  }).join('')

  const vatRows = Array.from(vatGroups.entries())
    .sort(([a], [b]) => a - b)
    .map(([pct, v]) => `
      <tr class="vat-row">
        <td colspan="2">ÁFA ${pct}%</td>
        <td>Nettó: ${fmt(v.net)}</td>
        <td>ÁFA: ${fmt(v.vat)}</td>
      </tr>`).join('')

  const methodLabel = data.paymentMethod === 'cash' ? 'Készpénz' : 'Bankkártya'
  const methodIcon  = data.paymentMethod === 'cash' ? '💵' : '💳'

  const statusBlock = data.success ? `
    <div class="status-box success">
      <div class="status-icon">✓</div>
      <div class="status-text">SIKERES FIZETÉS</div>
    </div>` : `
    <div class="status-box failed">
      <div class="status-icon">✗</div>
      <div class="status-text">SIKERTELEN TRANZAKCIÓ</div>
      ${data.failReason ? `<div class="fail-reason">${escHtml(data.failReason)}</div>` : ''}
    </div>`

  const changeRow = data.paymentMethod === 'cash' && data.success ? `
    <tr class="payment-row">
      <td>Befizetett összeg</td>
      <td class="payment-val">${fmt(data.amountPaid)}</td>
    </tr>
    <tr class="payment-row change-row">
      <td>Visszajáró</td>
      <td class="payment-val">${fmt(data.change)}</td>
    </tr>` : ''

  return `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Blokk – ${COMPANY.name} – ${data.receiptNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@400;600;700&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Source Code Pro', 'Courier New', monospace;
      background: #f0ede8;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
      padding: 24px 16px;
    }

    .receipt {
      background: #fff;
      width: 380px;
      max-width: 100%;
      padding: 0;
      box-shadow: 0 4px 24px rgba(0,0,0,0.15), 0 1px 4px rgba(0,0,0,0.1);
      position: relative;
    }

    /* Fogaskerék effekt tetején */
    .receipt::before {
      content: '';
      display: block;
      height: 16px;
      background:
        radial-gradient(circle at 10px 0, transparent 10px, #f0ede8 10px) -10px 0 / 20px 16px,
        radial-gradient(circle at 0 0, transparent 10px, #f0ede8 10px) 0 0 / 20px 16px;
      background-color: #fff;
    }
    .receipt::after {
      content: '';
      display: block;
      height: 16px;
      background:
        radial-gradient(circle at 10px 16px, transparent 10px, #f0ede8 10px) -10px 0 / 20px 16px,
        radial-gradient(circle at 0 16px, transparent 10px, #f0ede8 10px) 0 0 / 20px 16px;
      background-color: #fff;
    }

    .receipt-inner {
      padding: 4px 24px 20px;
    }

    /* ── Fejléc ── */
    .header {
      text-align: center;
      padding: 16px 0 12px;
      border-bottom: 2px dashed #d4c9b8;
      margin-bottom: 14px;
    }

    .company-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 10px;
    }

    .company-name {
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: #2d1a06;
      text-transform: uppercase;
      line-height: 1.2;
      margin-bottom: 6px;
    }

    .company-info {
      font-size: 10px;
      color: #6b5941;
      line-height: 1.7;
    }

    /* ── Tranzakció fejléc ── */
    .tx-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      font-size: 10px;
      color: #6b5941;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px dashed #d4c9b8;
    }

    .tx-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #a0917f;
      display: block;
      margin-bottom: 2px;
    }

    .tx-value {
      font-weight: 600;
      color: #2d1a06;
      font-size: 11px;
    }

    .receipt-number {
      font-size: 13px;
      font-weight: 700;
      color: #2d1a06;
    }

    /* ── Tételek táblázat ── */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      font-size: 11px;
    }

    .items-table thead tr {
      border-bottom: 1px solid #d4c9b8;
    }

    .items-table thead th {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #a0917f;
      font-weight: 600;
      padding: 4px 2px 5px;
      text-align: left;
    }

    .items-table thead th:last-child,
    .items-table thead th:nth-child(3),
    .items-table thead th:nth-child(2) {
      text-align: right;
    }

    .item-row td {
      padding: 5px 2px;
      vertical-align: top;
      color: #2d1a06;
      border-bottom: 1px dotted #e8e0d4;
    }

    .item-name { font-weight: 600; max-width: 140px; word-break: break-word; }
    .item-qty  { text-align: right; white-space: nowrap; color: #6b5941; }
    .item-price { text-align: right; white-space: nowrap; color: #6b5941; }
    .item-total { text-align: right; white-space: nowrap; font-weight: 700; }

    /* ── ÁFA táblázat ── */
    .vat-section {
      border-top: 1px dashed #d4c9b8;
      padding-top: 8px;
      margin-top: 4px;
    }

    .vat-title {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #a0917f;
      margin-bottom: 4px;
    }

    .vat-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }

    .vat-row td {
      padding: 2px 2px;
      color: #6b5941;
    }

    .vat-row td:nth-child(3),
    .vat-row td:nth-child(4) {
      text-align: right;
    }

    /* ── Összegzés ── */
    .totals {
      border-top: 1px dashed #d4c9b8;
      border-bottom: 1px dashed #d4c9b8;
      margin: 10px 0;
      padding: 10px 0;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #6b5941;
      margin-bottom: 4px;
    }

    .total-row.grand {
      font-size: 16px;
      font-weight: 700;
      color: #2d1a06;
      margin-top: 6px;
      padding-top: 6px;
      border-top: 2px solid #2d1a06;
      margin-bottom: 0;
    }

    .total-row.grand .total-val {
      color: #7c4b12;
    }

    /* ── Fizetési infó ── */
    .payment-section {
      margin: 10px 0;
      padding: 10px 0;
      border-bottom: 1px dashed #d4c9b8;
    }

    .payment-title {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #a0917f;
      margin-bottom: 6px;
    }

    .payment-method-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #f5f0e8;
      border: 1px solid #d4c9b8;
      border-radius: 20px;
      padding: 3px 10px;
      font-size: 11px;
      font-weight: 600;
      color: #2d1a06;
      margin-bottom: 8px;
    }

    .payment-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }

    .payment-row td {
      padding: 3px 0;
      color: #6b5941;
    }

    .payment-val {
      text-align: right;
      font-weight: 600;
      color: #2d1a06;
    }

    .change-row td {
      font-size: 13px;
      font-weight: 700;
      color: #7c4b12;
      padding-top: 6px;
    }

    /* ── Státusz ── */
    .status-box {
      border-radius: 8px;
      padding: 14px;
      text-align: center;
      margin: 14px 0 10px;
    }

    .status-box.success {
      background: #f0faf0;
      border: 2px solid #4caf50;
    }

    .status-box.failed {
      background: #fff5f5;
      border: 2px solid #f44336;
    }

    .status-icon {
      font-size: 28px;
      line-height: 1;
      margin-bottom: 4px;
    }

    .status-box.success .status-icon { color: #4caf50; }
    .status-box.failed .status-icon  { color: #f44336; }

    .status-text {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.08em;
    }

    .status-box.success .status-text { color: #2e7d32; }
    .status-box.failed  .status-text { color: #c62828; }

    .fail-reason {
      font-size: 10px;
      color: #c62828;
      margin-top: 4px;
    }

    /* ── Lábléc ── */
    .footer {
      text-align: center;
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px dashed #d4c9b8;
    }

    .footer-tagline {
      font-size: 11px;
      font-weight: 600;
      color: #7c4b12;
      margin-bottom: 4px;
    }

    .footer-sub {
      font-size: 9px;
      color: #a0917f;
      line-height: 1.6;
    }

    .barcode-area {
      margin: 12px auto 4px;
      display: flex;
      justify-content: center;
      gap: 1px;
    }

    .barcode-area span {
      display: inline-block;
      height: 28px;
      background: #2d1a06;
      border-radius: 0.5px;
    }

    /* ── Print stílus ── */
    @media print {
      body {
        background: white;
        padding: 0;
      }

      .receipt {
        box-shadow: none;
        width: 100%;
        max-width: 380px;
      }

      .no-print { display: none !important; }
    }
  </style>
</head>
<body>

  <!-- Print gomb – nyomtatáskor elrejtve -->
  <div class="no-print" style="position:fixed;top:16px;right:16px;display:flex;gap:8px;z-index:999;">
    <button onclick="window.print()"
      style="background:#7c4b12;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(124,75,18,0.3);">
      🖨️ Nyomtat / PDF mentés
    </button>
    <button onclick="window.close()"
      style="background:#e8e0d4;color:#6b5941;border:none;border-radius:8px;padding:10px 16px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;">
      ✕ Bezárás
    </button>
  </div>

  <div class="receipt">
    <div class="receipt-inner">

      <!-- ── Fejléc ── -->
      <div class="header">
        <div class="company-logo"><img src="https://szemesipekseg.hu/logo.png" alt="Szemesi Pékség" style="width: 120px; height: auto; filter: brightness(0);"></div>
        <div class="company-name">${escHtml(COMPANY.name)}</div>
        <div class="company-info">
          ${escHtml(COMPANY.address1)}, ${escHtml(COMPANY.address2)}<br>
          Adószám: ${escHtml(COMPANY.taxNumber)}<br>
          Cégjegyzékszám: ${escHtml(COMPANY.regNumber)}<br>
          ${escHtml(COMPANY.phone)} · ${escHtml(COMPANY.email)}
        </div>
      </div>

      <!-- ── Tranzakció fejléc ── -->
      <div class="tx-header">
        <div>
          <span class="tx-label">Bizonylat száma</span>
          <span class="receipt-number">${escHtml(data.receiptNumber)}</span>
        </div>
        <div style="text-align:right;">
          <span class="tx-label">Dátum</span>
          <span class="tx-value">${dateStr(data.date)}</span><br>
          <span class="tx-value">${timeStr(data.date)}</span>
        </div>
      </div>

      <div style="font-size:10px;color:#6b5941;margin-bottom:12px;padding-bottom:10px;border-bottom:1px dashed #d4c9b8;">
        <span style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#a0917f;">Pénztáros</span><br>
        <span style="font-weight:600;color:#2d1a06;">${escHtml(data.cashierName)}</span>
      </div>

      <!-- ── Tételek ── -->
      <table class="items-table">
        <thead>
          <tr>
            <th>Megnevezés</th>
            <th style="text-align:right;">Db</th>
            <th style="text-align:right;">Egységár</th>
            <th style="text-align:right;">Összeg</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <!-- ── ÁFA részletezés ── -->
      <div class="vat-section">
        <div class="vat-title">ÁFA részletezés</div>
        <table class="vat-table">
          <tbody>
            ${vatRows}
          </tbody>
        </table>
      </div>

      <!-- ── Összegzés ── -->
      <div class="totals">
        <div class="total-row">
          <span>Nettó összeg</span>
          <span class="total-val">${fmt(data.subtotalNet)}</span>
        </div>
        <div class="total-row">
          <span>ÁFA összesen</span>
          <span class="total-val">${fmt(data.taxAmount)}</span>
        </div>
        <div class="total-row grand">
          <span>FIZETENDŐ</span>
          <span class="total-val">${fmt(data.total)}</span>
        </div>
      </div>

      <!-- ── Fizetési mód ── -->
      <div class="payment-section">
        <div class="payment-title">Fizetési mód</div>
        <div class="payment-method-badge">${methodIcon} ${methodLabel}</div>
        ${data.success ? `
        <table class="payment-table">
          <tbody>
            ${changeRow}
          </tbody>
        </table>` : ''}
      </div>

      <!-- ── Státusz ── -->
      ${statusBlock}

      <!-- ── Lábléc ── -->
      <div class="footer">
        <div class="footer-tagline">Köszönjük vásárlását!</div>
        <div class="footer-sub">
          Minden blokk jogszabálynak megfelelő bizonylat.<br>
          Szemesi Pékség – frissen sütve, szeretettel.
        </div>

        <!-- Dekoratív vonalkód mintázat -->
        <div class="barcode-area" aria-hidden="true">
          ${generateBarcodeSVG(data.receiptNumber)}
        </div>
        <div style="font-size:8px;color:#c4b8a8;margin-top:2px;letter-spacing:.06em;">
          ${escHtml(data.receiptNumber)}
        </div>
      </div>

    </div>
  </div>

</body>
</html>`
}

// ─── Dekoratív vonalkód SVG ──────────────────────────────────────────────────

function generateBarcodeSVG(seed: string): string {
  // Pszeudo-véletlenszerű vonalkód dekoráció a bizonylat számából
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  }
  const bars: string[] = []
  for (let i = 0; i < 48; i++) {
    const bit = (hash >> (i % 32)) & 1
    const w = (i % 7 === 0 ? 3 : i % 4 === 0 ? 2 : 1)
    const h = bit ? 28 : 18
    bars.push(`<span style="width:${w}px;height:${h}px;"></span>`)
    if (bit) hash = ((hash << 3) ^ hash ^ i) | 0
  }
  return bars.join('')
}

// ─── HTML escape ──────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ─── Publikus API ─────────────────────────────────────────────────────────────

/** Megnyit egy új ablakot a blokkkal és opcionálisan automatikusan nyomtat */

// ─── Szöveges blokk (IP nyomtatóhoz) ──────────────────────────────────────────

export function generateReceiptText(data: ReceiptData): string {
  const W = 42
  const line = (ch = '-') => ch.repeat(W)
  const center = (s: string) => { const p = Math.max(0, W - s.length); return ' '.repeat(Math.floor(p/2)) + s }
  const row = (left: string, right: string) => {
    const r = right
    const l = left.substring(0, W - r.length - 1)
    return l + ' '.repeat(W - l.length - r.length) + r
  }

  const lines: string[] = []
  lines.push(center(COMPANY.name))
  lines.push(center(COMPANY.address1 + ' ' + COMPANY.address2))
  lines.push(center('Adószám: ' + COMPANY.taxNumber))
  lines.push(center(COMPANY.phone))
  lines.push(line())
  lines.push(row('Bizonylat:', data.receiptNumber))
  lines.push(row('Dátum:', dateStr(data.date) + ' ' + timeStr(data.date)))
  lines.push(row('Pénztáros:', data.cashierName))
  lines.push(line())

  for (const item of data.items) {
    const nameStr = item.name.substring(0, 26)
    lines.push(nameStr)
    const qty = `${item.quantity} x ${fmt(item.unitPrice)}`
    lines.push(row('  ' + qty, fmt(item.subtotal)))
  }
  lines.push(line())
  lines.push(row('Nettó:', fmt(data.subtotalNet)))
  lines.push(row('ÁFA:', fmt(data.taxAmount)))
  lines.push(row('ÖSSZESEN:', fmt(data.total)))
  lines.push(line('='))
  const method = data.paymentMethod === 'card' ? 'Bankkártya' : 'Készpénz'
  lines.push(row('Fizetési mód:', method))
  if (data.paymentMethod === 'cash') {
    lines.push(row('Befizetés:', fmt(data.amountPaid)))
    lines.push(row('Visszajáró:', fmt(data.change)))
  }
  lines.push(line())
  lines.push(center(data.success ? 'KÖSZÖNJÜK A VÁSÁRLÁST!' : 'SIKERTELEN FIZETÉS'))
  if (data.failReason) lines.push(center(data.failReason))
  lines.push(line())
  lines.push('')

  return lines.join('\n')
}

export function openReceipt(data: ReceiptData, autoPrint = false): void {
  const html = generateReceiptHTML(data)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const win  = window.open(url, `receipt_${data.receiptNumber}`, 'width=480,height=750,scrollbars=yes')
  if (win && autoPrint) {
    win.onload = () => {
      setTimeout(() => { win.print() }, 400)
    }
  }
  // URL felszabadítása 60mp után
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Bizonylat sorszám generálása: ÉÉHH-xxxxxx */
export function generateReceiptNumber(): string {
  const now   = new Date()
  const year  = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const seq   = String(Math.floor(Math.random() * 900_000) + 100_000)
  return `${year}${month}-${seq}`
}