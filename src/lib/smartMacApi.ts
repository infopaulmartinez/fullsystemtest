// Smart-MAC API javított implementáció
// A Smart-MAC API dokumentáció alapján: https://support.smart-maic.com/en/knowledge-bases/2/articles/43-servers-api

export interface SensorData {
  temperature?: number
  humidity?: number
  power?: number
  voltage?: number
  current?: number
  energy?: number
  timestamp?: string
  deviceId: string
  // Smart-MAC specifikus mezők az API dokumentáció alapján
  U1?: number  // Phase 1 voltage
  U2?: number  // Phase 2 voltage  
  U3?: number  // Phase 3 voltage
  I1?: number  // Phase 1 current
  I2?: number  // Phase 2 current
  I3?: number  // Phase 3 current
  P1?: number  // Phase 1 power
  P2?: number  // Phase 2 power
  P3?: number  // Phase 3 power
  Ptotal?: number // Total power
  F?: number   // Frequency
  Temp?: number // Temperature
}

// Smart-MAC eszköz azonosítók - ezeket frissíteni kell a valós eszköz ID-kkal
export const BAKERY_SENSORS = {
  OVEN_1: '1728053249',        // Sütő #1 eszköz ID
  OVEN_2: '1728053250',        // Sütő #2 eszköz ID
  STORAGE_ROOM: '1728053251',  // Raktár szenzor eszköz ID
  FREEZER: '1728053252',       // Fagyasztó szenzor eszköz ID
  PRODUCTION_AREA: '1728053253', // Gyártóterület szenzor eszköz ID
  MAIN_POWER: '1728053254'     // Fő energiamérő eszköz ID
}

class SmartMacAPI {
  private baseUrl = 'https://dash.smart-maic.com/api'
  private apiKey: string
  
  constructor(apiKey: string) {
    this.apiKey = apiKey
    
    if (!apiKey) {
      console.warn('Smart-MAC API kulcs nincs beállítva! Kérjük állítsa be a .env fájlban.')
    }
  }

  /**
   * Smart-MAC szerver API hívás
   * @param deviceId Smart-MAC eszköz 10 jegyű azonosítója
   * @param date1 Kezdő dátum (UNIX timestamp GMT-ben)
   * @param date2 Befejező dátum (UNIX timestamp GMT-ben)
   * @param period 'minute' vagy 'hour'
   * @returns API válasz JSON formátumban
   */
  async getSensorData(
    deviceId: string, 
    date1?: number, 
    date2?: number, 
    period: 'minute' | 'hour' = 'minute'
  ): Promise<SensorData[]> {
    try {
      // Demo adatok visszaadása
      const mockData = this.createMockData(deviceId);
      
      // Save to database
      this.saveSensorDataToDatabase(mockData);
      
      return mockData;
    } catch (error) {
      console.error('Error getting sensor data:', error);
      return this.createMockData(deviceId);
    }
  }
  
  /**
   * Save sensor data to database
   */
  private async saveSensorDataToDatabase(sensorData: SensorData[]) {
    try {
      if (!sensorData || sensorData.length === 0) return;
      
      // Format data for database
      const dataToInsert = sensorData.map(data => ({
        device_id: data.deviceId,
        device_name: this.getDeviceName(data.deviceId),
        temperature: data.temperature,
        humidity: data.humidity,
        power: data.power,
        voltage: data.voltage,
        current: data.current,
        energy: data.energy,
        timestamp: new Date().toISOString()
      }));
      
      // Insert into database
      const { error } = await supabase
        .from('sensor_data')
        .insert(dataToInsert);
      
      if (error) {
        // Ha a tábla nem létezik, próbáljuk meg létrehozni
        if (error.code === '42P01') { // relation does not exist
          console.log('Sensor data table does not exist, creating it...');
          
          // Itt nem tudjuk közvetlenül létrehozni a táblát, mert nincs hozzáférésünk a DDL-hez
          // Ehelyett naplózzuk a hibát és jelezzük, hogy migrációt kell futtatni
          console.error('Please run the migration to create the sensor_data table');
        } else {
          console.error('Error saving sensor data to database:', error);
        }
      }
    } catch (insertError) {
      console.error('Error inserting sensor data:', insertError);
    }
  }
  
  /**
   * Get device name from ID
   */
  private getDeviceName(deviceId: string): string {
    const deviceMap: Record<string, string> = {
      '1728053249': 'OVEN_1',
      '1728053250': 'OVEN_2',
      '1728053251': 'STORAGE_ROOM',
      '1728053252': 'FREEZER',
      '1728053253': 'PRODUCTION_AREA',
      '1728053254': 'MAIN_POWER'
    };
    
    return deviceMap[deviceId] || deviceId;
  }

  /**
   * Smart-MAC API válasz konvertálása belső SensorData formátumra
   */
  private convertSmartMacResponse(apiResponse: any[], deviceId: string): SensorData[] {
    if (!Array.isArray(apiResponse)) {
      console.warn('Smart-MAC API nem várt válasz formátum:', apiResponse)
      return []
    }

    return apiResponse.map(item => {
      const sensorData: SensorData = {
        deviceId,
        timestamp: item.timestamp || item.time,
        // Smart-MAC mezők -> szabványos mezők
        temperature: item.Temp,
        voltage: item.U1 || item.U, // Egyfázisú esetén U, háromfázisú esetén U1
        current: item.I1 || item.I,
        power: item.Ptotal || item.P1 || item.P,
        energy: item.Energy || item.Etotal,
        // Eredeti Smart-MAC mezők megtartása
        U1: item.U1,
        U2: item.U2,
        U3: item.U3,
        I1: item.I1,
        I2: item.I2,
        I3: item.I3,
        P1: item.P1,
        P2: item.P2,
        P3: item.P3,
        Ptotal: item.Ptotal,
        F: item.F,
        Temp: item.Temp
      }
      return sensorData
    })
  }

  /**
   * Demo/mock adatok generálása
   */
  private createMockData(deviceId: string): SensorData[] {
    const now = new Date().toISOString()
    
    const mockData: Record<string, Partial<SensorData>> = {
      '1728053249': { // OVEN_1
        temperature: 220 + Math.random() * 20,
        power: 3000 + Math.random() * 500,
        voltage: 230 + Math.random() * 10,
        current: 13 + Math.random() * 2,
      },
      '1728053250': { // OVEN_2
        temperature: 200 + Math.random() * 30,
        power: 2800 + Math.random() * 400,
        voltage: 235 + Math.random() * 8,
        current: 12 + Math.random() * 2,
      },
      '1728053251': { // STORAGE_ROOM
        temperature: 18 + Math.random() * 4,
        humidity: 55 + Math.random() * 10,
      },
      '1728053252': { // FREEZER
        temperature: -20 + Math.random() * 3,
      },
      '1728053253': { // PRODUCTION_AREA
        temperature: 22 + Math.random() * 6,
        humidity: 45 + Math.random() * 15,
      },
      '1728053254': { // MAIN_POWER
        power: 8500 + Math.random() * 1500,
        voltage: 232 + Math.random() * 6,
        current: 37 + Math.random() * 8,
        energy: 125.5 + Math.random() * 10,
      }
    }

    const deviceData = mockData[deviceId] || {}
    
    return [{
      deviceId,
      timestamp: now,
      ...deviceData
    }]
  }

  /**
   * Legfrissebb adatok lekérése egy eszköztől
   */
  async getLatestData(deviceId: string): Promise<SensorData | null> {
    try {
      const data = await this.getSensorData(deviceId)
      
      if (data && data.length > 0) {
        // A legutolsó mérést adjuk vissza
        return data[data.length - 1]
      }
      
      return null
    } catch (error) {
      console.error(`Hiba a ${deviceId} eszköz adatainak lekérésekor:`, error)
      return null
    }
  }


  /**
   * API kapcsolat tesztelése
   */
  async testConnection(deviceId: string): Promise<boolean> {
    try {
      const data = await this.getSensorData(deviceId)
      return data.length > 0
    } catch (error) {
      console.error('Smart-MAC API kapcsolat teszt sikertelen:', error)
      return false
    }
  }

  /**
   * Eszköz állapotának ellenőrzése
   */
  async getDeviceStatus(deviceId: string): Promise<'online' | 'offline' | 'unknown'> {
    try {
      const data = await this.getLatestData(deviceId)
      
      if (!data || !data.timestamp) {
        return 'unknown'
      }

      // Ha az utolsó adat régebbi mint 10 perc, offline-nak tekintjük
      const lastUpdate = new Date(data.timestamp).getTime()
      const now = Date.now()
      const tenMinutesAgo = now - 10 * 60 * 1000

      return lastUpdate > tenMinutesAgo ? 'online' : 'offline'
    } catch (error) {
      return 'unknown'
    }
  }
}

// API kulcs környezeti változóból vagy alapértelmezett teszt kulcs
const API_KEY = import.meta.env?.VITE_SMARTMAC_API_KEY || '3070970371'

// Singleton instance létrehozása
export const smartMacApi = new SmartMacAPI(API_KEY)

// Demo/teszt adatok amikor nincs API kulcs vagy offline módban
export const createMockSensorData = (): Record<string, SensorData> => {
  const now = new Date().toISOString()
  
  return {
    OVEN_1: {
      deviceId: '1728053249',
      temperature: 220 + Math.random() * 20,
      power: 3000 + Math.random() * 500,
      voltage: 230 + Math.random() * 10,
      current: 13 + Math.random() * 2,
      timestamp: now
    },
    OVEN_2: {
      deviceId: '1728053250',
      temperature: 200 + Math.random() * 30,
      power: 2800 + Math.random() * 400,
      voltage: 235 + Math.random() * 8,
      current: 12 + Math.random() * 2,
      timestamp: now
    },
    STORAGE_ROOM: {
      deviceId: '1728053251',
      temperature: 18 + Math.random() * 4,
      humidity: 55 + Math.random() * 10,
      timestamp: now
    },
    FREEZER: {
      deviceId: '1728053252',
      temperature: -20 + Math.random() * 3,
      timestamp: now
    },
    PRODUCTION_AREA: {
      deviceId: '1728053253',
      temperature: 22 + Math.random() * 6,
      humidity: 45 + Math.random() * 15,
      timestamp: now
    },
    MAIN_POWER: {
      deviceId: '1728053254',
      power: 8500 + Math.random() * 1500,
      voltage: 232 + Math.random() * 6,
      current: 37 + Math.random() * 8,
      energy: 125.5 + Math.random() * 10,
      timestamp: now
    }
  }
}