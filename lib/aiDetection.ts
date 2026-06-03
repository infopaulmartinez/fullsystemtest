// ─── CodeProject.AI Detection Service ─────────────────────────────────────
// API Reference: https://codeproject.github.io/codeproject.ai/api/api_reference.html

export interface DetectedObject {
  label: string
  confidence: number
  x_min: number
  y_min: number
  x_max: number
  y_max: number
}

export interface LicensePlate {
  plate: string
  confidence: number
  x_min: number
  y_min: number
  x_max: number
  y_max: number
}

export interface DetectionResult {
  success: boolean
  objects: DetectedObject[]
  plates: LicensePlate[]
  processMs?: number
  analysedMs?: number
  cameraName: string
  timestamp: Date
  imageDataUrl?: string
}

export interface AIConfig {
  serverUrl: string
  enabled: boolean
  intervalSeconds: number
  minConfidence: number
  alertOnPersons: boolean
  alertOnVehicles: boolean
  alertOnPlates: boolean
}

export const DEFAULT_AI_CONFIG: AIConfig = {
  serverUrl: 'http://localhost:32168',
  enabled: false,
  intervalSeconds: 15,
  minConfidence: 0.55,
  alertOnPersons: true,
  alertOnVehicles: true,
  alertOnPlates: true,
}

const AI_CONFIG_KEY = 'ai_detection_config_v1'

export function loadAIConfig(): AIConfig {
  try {
    const s = localStorage.getItem(AI_CONFIG_KEY)
    if (s) return { ...DEFAULT_AI_CONFIG, ...JSON.parse(s) }
  } catch {}
  return { ...DEFAULT_AI_CONFIG }
}

export function saveAIConfig(cfg: AIConfig): void {
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(cfg))
}

// Fetch image from Blue Iris proxy and convert to Blob
export async function fetchImageBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    return await res.blob()
  } catch {
    return null
  }
}

// Convert Blob to base64 data URL
export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Object Detection via CodeProject.AI
export async function detectObjects(
  imageBlob: Blob,
  serverUrl: string,
  minConfidence = 0.55
): Promise<DetectedObject[]> {
  try {
    const formData = new FormData()
    formData.append('image', imageBlob, 'snapshot.jpg')
    formData.append('min_confidence', String(minConfidence))

    const res = await fetch(`${serverUrl}/v1/vision/detection`, {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) return []
    const data = await res.json()

    if (!data.success || !Array.isArray(data.predictions)) return []

    return data.predictions.map((p: any) => ({
      label: p.label,
      confidence: p.confidence,
      x_min: p.x_min,
      y_min: p.y_min,
      x_max: p.x_max,
      y_max: p.y_max,
    }))
  } catch {
    return []
  }
}

// License Plate Recognition via CodeProject.AI
export async function detectLicensePlates(
  imageBlob: Blob,
  serverUrl: string
): Promise<LicensePlate[]> {
  try {
    const formData = new FormData()
    formData.append('image', imageBlob, 'snapshot.jpg')

    const res = await fetch(`${serverUrl}/v1/vision/alpr`, {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) return []
    const data = await res.json()

    if (!data.success) return []

    // ALPR response structure
    const predictions = data.predictions ?? data.plates ?? []
    return predictions.map((p: any) => ({
      plate: p.plate ?? p.label ?? '',
      confidence: p.confidence,
      x_min: p.x_min ?? 0,
      y_min: p.y_min ?? 0,
      x_max: p.x_max ?? 0,
      y_max: p.y_max ?? 0,
    })).filter((p: LicensePlate) => p.plate)
  } catch {
    return []
  }
}

// Full analysis: object detection + ALPR in parallel
export async function analyzeCamera(
  snapshotUrl: string,
  cameraName: string,
  config: AIConfig
): Promise<DetectionResult | null> {
  const blob = await fetchImageBlob(snapshotUrl)
  if (!blob) return null

  const dataUrl = await blobToDataUrl(blob)

  const [objects, plates] = await Promise.all([
    detectObjects(blob, config.serverUrl, config.minConfidence),
    config.alertOnPlates ? detectLicensePlates(blob, config.serverUrl) : Promise.resolve([]),
  ])

  return {
    success: true,
    objects,
    plates,
    cameraName,
    timestamp: new Date(),
    imageDataUrl: dataUrl,
  }
}

// Helper: filter relevant alerts from detection result
export function getAlerts(result: DetectionResult, config: AIConfig): string[] {
  const alerts: string[] = []

  if (config.alertOnPersons) {
    const persons = result.objects.filter(o =>
      o.label.toLowerCase() === 'person' && o.confidence >= config.minConfidence
    )
    if (persons.length > 0) {
      alerts.push(`${persons.length} személy észlelve (${Math.round(persons[0].confidence * 100)}% bizonyosság)`)
    }
  }

  if (config.alertOnVehicles) {
    const vehicles = result.objects.filter(o =>
      ['car', 'truck', 'bus', 'motorcycle', 'bicycle', 'vehicle'].includes(o.label.toLowerCase()) &&
      o.confidence >= config.minConfidence
    )
    if (vehicles.length > 0) {
      const types = [...new Set(vehicles.map(v => translateLabel(v.label)))]
      alerts.push(`Jármű észlelve: ${types.join(', ')}`)
    }
  }

  if (config.alertOnPlates && result.plates.length > 0) {
    const plates = result.plates.map(p => p.plate).join(', ')
    alerts.push(`Rendszám felismerve: ${plates}`)
  }

  return alerts
}

export function translateLabel(label: string): string {
  const map: Record<string, string> = {
    person: 'Személy',
    car: 'Személyautó',
    truck: 'Kamion',
    bus: 'Busz',
    motorcycle: 'Motor',
    bicycle: 'Kerékpár',
    dog: 'Kutya',
    cat: 'Macska',
    vehicle: 'Jármű',
    backpack: 'Hátizsák',
    handbag: 'Táska',
    suitcase: 'Bőrönd',
  }
  return map[label.toLowerCase()] ?? label
}

// Build HTML email body for admin alert
export function buildAlertEmail(
  cameraName: string,
  alerts: string[],
  result: DetectionResult,
  config: AIConfig
): string {
  const time = result.timestamp.toLocaleString('hu-HU')
  const objectRows = result.objects
    .filter(o => o.confidence >= config.minConfidence)
    .map(o => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #2d3748;">${translateLabel(o.label)}</td>
        <td style="padding:8px;border-bottom:1px solid #2d3748;">${Math.round(o.confidence * 100)}%</td>
      </tr>
    `).join('')

  const plateRows = result.plates.map(p => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #2d3748;font-family:monospace;font-size:16px;font-weight:bold;color:#f6ad55;">${p.plate}</td>
      <td style="padding:8px;border-bottom:1px solid #2d3748;">${Math.round(p.confidence * 100)}%</td>
    </tr>
  `).join('')

  return `
    <div style="font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;padding:20px;border-radius:12px;max-width:600px;">
      <div style="background:#1e3a5f;padding:16px;border-radius:8px;margin-bottom:20px;border-left:4px solid #f6ad55;">
        <h2 style="margin:0;color:#f6ad55;">🎯 Biztonsági riasztás</h2>
        <p style="margin:4px 0 0;color:#94a3b8;">Szemesi Pékség - Kamerarendszer</p>
      </div>

      <table style="width:100%;margin-bottom:16px;">
        <tr>
          <td style="padding:6px 0;color:#94a3b8;">📹 Kamera:</td>
          <td style="padding:6px 0;color:#f1f5f9;font-weight:bold;">${cameraName}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#94a3b8;">🕐 Időpont:</td>
          <td style="padding:6px 0;color:#f1f5f9;">${time}</td>
        </tr>
      </table>

      <div style="background:#1e293b;padding:14px;border-radius:8px;margin-bottom:16px;">
        <h3 style="margin:0 0 10px;color:#fbbf24;">⚠️ Észlelések:</h3>
        ${alerts.map(a => `<p style="margin:4px 0;color:#fcd34d;">• ${a}</p>`).join('')}
      </div>

      ${objectRows ? `
        <div style="margin-bottom:16px;">
          <h3 style="color:#60a5fa;margin-bottom:8px;">Észlelt objektumok:</h3>
          <table style="width:100%;border-collapse:collapse;background:#1e293b;border-radius:8px;overflow:hidden;">
            <thead>
              <tr style="background:#1e3a5f;">
                <th style="padding:8px;text-align:left;color:#93c5fd;">Típus</th>
                <th style="padding:8px;text-align:left;color:#93c5fd;">Bizonyosság</th>
              </tr>
            </thead>
            <tbody>${objectRows}</tbody>
          </table>
        </div>
      ` : ''}

      ${plateRows ? `
        <div style="margin-bottom:16px;">
          <h3 style="color:#f59e0b;margin-bottom:8px;">🚗 Felismert rendszámok:</h3>
          <table style="width:100%;border-collapse:collapse;background:#1e293b;border-radius:8px;overflow:hidden;">
            <thead>
              <tr style="background:#451a03;">
                <th style="padding:8px;text-align:left;color:#fbbf24;">Rendszám</th>
                <th style="padding:8px;text-align:left;color:#fbbf24;">Bizonyosság</th>
              </tr>
            </thead>
            <tbody>${plateRows}</tbody>
          </table>
        </div>
      ` : ''}

      <p style="color:#475569;font-size:12px;margin-top:20px;border-top:1px solid #1e293b;padding-top:12px;">
        Ez egy automatikus értesítés a Szemesi Pékség biztonsági rendszerétől.<br>
        CodeProject.AI alapú objektumfelismerő rendszer.
      </p>
    </div>
  `
}
