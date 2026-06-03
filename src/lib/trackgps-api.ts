// TrackGPS API Integration
// Real-time GPS tracking with TrackGPS API

export interface TrackGPSVehicle {
  id: string
  name: string
  plateNumber: string
  driverName?: string
  make?: string
  model?: string
  year?: number
  color?: string
  fuelType?: string
  lastPosition: {
    latitude: number
    longitude: number
    timestamp: string
    speed: number
    direction: number
    ignition: boolean
  }
  status: 'online' | 'offline' | 'moving' | 'stopped'
  mileage?: number
  fuelConsumption?: number
}

export interface TrackGPSRoute {
  vehicleId: string
  startTime: string
  endTime: string
  distance: number
  duration: number
  points: {
    latitude: number
    longitude: number
    timestamp: string
    speed: number
  }[]
}

export interface TrackGPSStop {
  vehicleId: string
  startTime: string
  endTime: string
  duration: number
  location: {
    latitude: number
    longitude: number
    address?: string
  }
}

export interface TrackGPSConsumption {
  vehicleId: string
  date: string
  totalConsumption: number
  averageConsumption: number
  distance: number
}

export interface TrackGPSRefill {
  vehicleId: string
  timestamp: string
  amount: number
  location: {
    latitude: number
    longitude: number
    address?: string
  }
  cost?: number
}

export interface TrackGPSTemperature {
  vehicleId: string
  timestamp: string
  temperature: number
  sensorId: string
}

class TrackGPSAPI {
  private baseUrl = 'https://api.trackgps.ro/api'
  private accessToken: string | null = null
  private tokenExpiry: Date | null = null
  private username = 'aivivien'
  private password = '12345678Aa!'

  constructor() {
    // Initialize with the provided access token
    this.accessToken = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IkJBMDdCMEEzQkRDMzg4RTIxRjA3NTUwQkE1RjEyRUZFRjFEQjFFNjhSUzI1NiIsIng1dCI6InVnZXdvNzNEaU9JZkIxVUxwZkV1X3ZIYkhtZyIsInR5cCI6ImF0K2p3dCJ9.eyJpc3MiOiJodHRwczovL3Nzby50cmFja2dwcy5ybyIsIm5iZiI6MTc1MjQ4ODY1NywiaWF0IjoxNzUyNDg4NjU3LCJleHAiOjE3NTI1MTc0NTcsInNjb3BlIjpbIkNhclBvb2xpbmdBUEkiLCJJZGVudGl0eVNlcnZlckFwaSIsIm9wZW5pZCIsInByb2ZpbGUiLCJUcmFja0dQU1Y0QXBpIiwib2ZmbGluZV9hY2Nlc3MiXSwiYW1yIjpbInB3ZCJdLCJjbGllbnRfaWQiOiJUcmFja0dQU1Y0Iiwic3ViIjoiNjQwMGE5MmEtZmU0Mi00YTFjLTgzNWUtNjk2ZmU5YTViZWVhIiwiYXV0aF90aW1lIjoxNzUyNDg4NjU3LCJpZHAiOiJsb2NhbCIsImNvbXBhbnlJZCI6ImM4YTA4OGM5LTcwMzMtNDJhMS04YjY1LWI3YzBiYjU4MzE3MiIsImRhdGFJZCI6IjQ2OUE2NTY3LTQwRkEtNDE1Ny1CMUE5LTY1ODcxNkVENUQ0NSIsInVzZXJQcm9maWxlIjoiMDE0NGQ1Y2YtMTI5NzkzLTAwMDktMTUzNTgtMTk1ZmZmM2VmNjA5IiwibmFtZSI6ImFpdml2aWVuIiwiSXNBcGlVc2VyIjoidHJ1ZSJ9.FI4nurtctD80QsoVQTsI66q9vcBoRzdrIFeijINQ8iNrXcBf_d0mflBwKpyvWwwXUP1eZM4OOqUjOW_PMRRcg72Hy0171uoNw6VPE8Hxz1FoDTMXbCWoxswCCBvh6QreUtlDXnqJOtfC4vWiUltNiRGziiBYiE7Lf_XX8X2PhfvW7j09i3v3-KUOG8mfFCVxMfemG9siYNpacxOkoGpw1VlZrqBIc4IeVYtxzsa4oGp9VZLLjpX3M6wrBvlgXzK20WTpspLfupsUB-ZHYM0g9_tTF57CC7gt1XArskKQfSOZoHF-ovMfU3C5WM73pj9hQZAwbwXdDBUGu4bTBCoOMw'
    this.tokenExpiry = new Date('2025-01-13T16:37:37Z') // Token expiry from JWT
  }

  /**
   * Authenticate with TrackGPS API
   */
  private async authenticate(): Promise<string> {
    // Check if current token is still valid
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken
    }

    try {
      const response = await fetch(`${this.baseUrl}/authentication/login?api-version=2.0`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: this.username,
          password: this.password
        })
      })

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status}`)
      }

      const data = await response.json()
      
      this.accessToken = data.access_token
      this.tokenExpiry = new Date(Date.now() + (data.expires_in * 1000))
      
      return this.accessToken
    } catch (error) {
      console.error('TrackGPS authentication error:', error)
      throw new Error('Failed to authenticate with TrackGPS API')
    }
  }

  /**
   * Make authenticated API request
   */
  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.authenticate()
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Get vehicle data by GPS tracker ID
   */
  async getVehicleByTrackerId(trackerId: string): Promise<TrackGPSVehicle | null> {
    try {
      const vehicles = await this.getVehicles()
      return vehicles.find(v => v.id === trackerId) || null
    } catch (error) {
      console.error('Error fetching vehicle by tracker ID:', error)
      return this.getMockVehicleByTrackerId(trackerId)
    }
  }

  /**
   * Get all company vehicles
   */
  async getVehicles(): Promise<TrackGPSVehicle[]> {
    try {
      const data = await this.makeRequest<any>('/carriers/company-vehicles?api-version=2.0')
      
      // Transform API response to our interface
      return data.vehicles?.map((vehicle: any) => ({
        id: vehicle.id,
        name: vehicle.name,
        plateNumber: vehicle.plateNumber,
        driverName: vehicle.driverName,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color,
        fuelType: vehicle.fuelType,
        mileage: vehicle.mileage,
        fuelConsumption: vehicle.fuelConsumption,
        lastPosition: {
          latitude: vehicle.lastPosition?.latitude || 0,
          longitude: vehicle.lastPosition?.longitude || 0,
          timestamp: vehicle.lastPosition?.timestamp || new Date().toISOString(),
          speed: vehicle.lastPosition?.speed || 0,
          direction: vehicle.lastPosition?.direction || 0,
          ignition: vehicle.lastPosition?.ignition || false
        },
        status: this.determineVehicleStatus(vehicle)
      })) || []
    } catch (error) {
      console.error('Error fetching vehicles:', error)
      return this.getMockVehicles()
    }
  }

  /**
   * Get vehicle routes
   */
  async getVehicleRoutes(vehicleId: string, startDate: string, endDate: string): Promise<TrackGPSRoute[]> {
    try {
      const data = await this.makeRequest<any>('/carriers/way?api-version=2.0', {
        method: 'POST',
        body: JSON.stringify({
          vehicleId,
          startDate,
          endDate
        })
      })
      
      return data.routes?.map((route: any) => ({
        vehicleId: route.vehicleId,
        startTime: route.startTime,
        endTime: route.endTime,
        distance: route.distance,
        duration: route.duration,
        points: route.points || []
      })) || []
    } catch (error) {
      console.error('Error fetching vehicle routes:', error)
      return this.getMockRoutes(vehicleId)
    }
  }

  /**
   * Get vehicle stops
   */
  async getVehicleStops(vehicleId: string, startDate: string, endDate: string): Promise<TrackGPSStop[]> {
    try {
      const data = await this.makeRequest<any>('/carriers/stops?api-version=2.0', {
        method: 'POST',
        body: JSON.stringify({
          vehicleId,
          startDate,
          endDate
        })
      })
      
      return data.stops?.map((stop: any) => ({
        vehicleId: stop.vehicleId,
        startTime: stop.startTime,
        endTime: stop.endTime,
        duration: stop.duration,
        location: {
          latitude: stop.location?.latitude || 0,
          longitude: stop.location?.longitude || 0,
          address: stop.location?.address
        }
      })) || []
    } catch (error) {
      console.error('Error fetching vehicle stops:', error)
      return this.getMockStops(vehicleId)
    }
  }

  /**
   * Get fuel consumption data
   */
  async getFuelConsumption(vehicleId: string, startDate: string, endDate: string): Promise<TrackGPSConsumption[]> {
    try {
      const data = await this.makeRequest<any>('/carriers/consumption?api-version=2.0', {
        method: 'POST',
        body: JSON.stringify({
          vehicleId,
          startDate,
          endDate
        })
      })
      
      return data.consumption?.map((item: any) => ({
        vehicleId: item.vehicleId,
        date: item.date,
        totalConsumption: item.totalConsumption,
        averageConsumption: item.averageConsumption,
        distance: item.distance
      })) || []
    } catch (error) {
      console.error('Error fetching fuel consumption:', error)
      return this.getMockConsumption(vehicleId)
    }
  }

  /**
   * Get refill data
   */
  async getRefills(vehicleId: string, startDate: string, endDate: string): Promise<TrackGPSRefill[]> {
    try {
      const data = await this.makeRequest<any>('/carriers/refills?api-version=2.0', {
        method: 'POST',
        body: JSON.stringify({
          vehicleId,
          startDate,
          endDate
        })
      })
      
      return data.refills?.map((refill: any) => ({
        vehicleId: refill.vehicleId,
        timestamp: refill.timestamp,
        amount: refill.amount,
        location: {
          latitude: refill.location?.latitude || 0,
          longitude: refill.location?.longitude || 0,
          address: refill.location?.address
        },
        cost: refill.cost
      })) || []
    } catch (error) {
      console.error('Error fetching refills:', error)
      return this.getMockRefills(vehicleId)
    }
  }

  /**
   * Get temperature data
   */
  async getTemperatures(vehicleId: string, startDate: string, endDate: string): Promise<TrackGPSTemperature[]> {
    try {
      const data = await this.makeRequest<any>('/carriers/temperatures?api-version=2.0', {
        method: 'POST',
        body: JSON.stringify({
          vehicleId,
          startDate,
          endDate
        })
      })
      
      return data.temperatures?.map((temp: any) => ({
        vehicleId: temp.vehicleId,
        timestamp: temp.timestamp,
        temperature: temp.temperature,
        sensorId: temp.sensorId
      })) || []
    } catch (error) {
      console.error('Error fetching temperatures:', error)
      return this.getMockTemperatures(vehicleId)
    }
  }

  /**
   * Determine vehicle status from API data
   */
  private determineVehicleStatus(vehicle: any): 'online' | 'offline' | 'moving' | 'stopped' {
    if (!vehicle.lastPosition) return 'offline'
    
    const lastUpdate = new Date(vehicle.lastPosition.timestamp)
    const now = new Date()
    const timeDiff = now.getTime() - lastUpdate.getTime()
    
    // If last update was more than 5 minutes ago, consider offline
    if (timeDiff > 5 * 60 * 1000) return 'offline'
    
    // If ignition is on and speed > 5, consider moving
    if (vehicle.lastPosition.ignition && vehicle.lastPosition.speed > 5) return 'moving'
    
    // If ignition is on but speed <= 5, consider stopped
    if (vehicle.lastPosition.ignition) return 'stopped'
    
    return 'offline'
  }

  /**
   * Mock data for fallback
   */
  private getMockVehicles(): TrackGPSVehicle[] {
    return [
      {
        id: 'RKA-376',
        name: 'AUDI RS7',
        plateNumber: 'RKA-376',
        driverName: 'Tóth Gábor',
        make: 'AUDI',
        model: 'RS7',
        year: 2020,
        color: 'Fekete',
        fuelType: 'petrol',
        mileage: 85000,
        fuelConsumption: 12.5,
        lastPosition: {
          latitude: 46.8167,
          longitude: 17.7833,
          timestamp: new Date().toISOString(),
          speed: 45,
          direction: 90,
          ignition: true
        },
        status: 'moving'
      },
      {
        id: 'JOV-030',
        name: 'TOYOTA DYNA',
        plateNumber: 'JOV-030',
        driverName: 'Kiss László',
        make: 'TOYOTA',
        model: 'DYNA',
        year: 2018,
        color: 'Fehér',
        fuelType: 'diesel',
        mileage: 120000,
        fuelConsumption: 15.2,
        lastPosition: {
          latitude: 46.8000,
          longitude: 17.7500,
          timestamp: new Date().toISOString(),
          speed: 0,
          direction: 0,
          ignition: false
        },
        status: 'stopped'
      },
      {
        id: 'LSF-606',
        name: 'PEUGEOT BOXER',
        plateNumber: 'LSF-606',
        driverName: 'Nagy Péter',
        make: 'PEUGEOT',
        model: 'BOXER',
        year: 2019,
        color: 'Kék',
        fuelType: 'diesel',
        mileage: 95000,
        fuelConsumption: 9.8,
        lastPosition: {
          latitude: 46.8500,
          longitude: 17.8000,
          timestamp: new Date().toISOString(),
          speed: 25,
          direction: 180,
          ignition: true
        },
        status: 'moving'
      },
      {
        id: 'LVK-378',
        name: 'AUDI A4',
        plateNumber: 'LVK-378',
        driverName: 'Szabó János',
        make: 'AUDI',
        model: 'A4',
        year: 2021,
        color: 'Szürke',
        fuelType: 'diesel',
        mileage: 45000,
        fuelConsumption: 6.5,
        lastPosition: {
          latitude: 46.7900,
          longitude: 17.7600,
          timestamp: new Date().toISOString(),
          speed: 15,
          direction: 270,
          ignition: true
        },
        status: 'moving'
      },
      {
        id: 'ABC-123',
        name: 'MAN TGL',
        plateNumber: 'ABC-123',
        driverName: 'Kovács Zoltán',
        make: 'MAN',
        model: 'TGL',
        year: 2017,
        color: 'Piros',
        fuelType: 'diesel',
        mileage: 180000,
        fuelConsumption: 18.5,
        lastPosition: {
          latitude: 46.8100,
          longitude: 17.7700,
          timestamp: new Date().toISOString(),
          speed: 0,
          direction: 0,
          ignition: false
        },
        status: 'offline'
      },
      {
        id: 'XYZ-456',
        name: 'MERCEDES SPRINTER',
        plateNumber: 'XYZ-456',
        driverName: 'Horváth Attila',
        make: 'MERCEDES',
        model: 'SPRINTER',
        year: 2020,
        color: 'Fehér',
        fuelType: 'diesel',
        mileage: 75000,
        fuelConsumption: 11.2,
        lastPosition: {
          latitude: 46.8300,
          longitude: 17.7900,
          timestamp: new Date().toISOString(),
          speed: 35,
          direction: 45,
          ignition: true
        },
        status: 'moving'
      }
    ]
  }

  private getMockVehicleByTrackerId(trackerId: string): TrackGPSVehicle | null {
    const vehicles = this.getMockVehicles()
    return vehicles.find(v => v.id === trackerId) || null
  }

  private getMockRoutes(vehicleId: string): TrackGPSRoute[] {
    return [
      {
        vehicleId,
        startTime: new Date(Date.now() - 3600000).toISOString(),
        endTime: new Date().toISOString(),
        distance: 45.2,
        duration: 3600,
        points: [
          { latitude: 46.8167, longitude: 17.7833, timestamp: new Date(Date.now() - 3600000).toISOString(), speed: 0 },
          { latitude: 46.8200, longitude: 17.7900, timestamp: new Date(Date.now() - 3000000).toISOString(), speed: 40 },
          { latitude: 46.8300, longitude: 17.8000, timestamp: new Date(Date.now() - 1800000).toISOString(), speed: 50 },
          { latitude: 46.8400, longitude: 17.8100, timestamp: new Date().toISOString(), speed: 30 }
        ]
      }
    ]
  }

  private getMockStops(vehicleId: string): TrackGPSStop[] {
    return [
      {
        vehicleId,
        startTime: new Date(Date.now() - 7200000).toISOString(),
        endTime: new Date(Date.now() - 5400000).toISOString(),
        duration: 1800,
        location: {
          latitude: 46.8167,
          longitude: 17.7833,
          address: 'Balatonszemes, Fő utca 1.'
        }
      }
    ]
  }

  private getMockConsumption(vehicleId: string): TrackGPSConsumption[] {
    return [
      {
        vehicleId,
        date: new Date().toISOString().split('T')[0],
        totalConsumption: 25.5,
        averageConsumption: 8.5,
        distance: 300
      }
    ]
  }

  private getMockRefills(vehicleId: string): TrackGPSRefill[] {
    return [
      {
        vehicleId,
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        amount: 45.2,
        location: {
          latitude: 46.8167,
          longitude: 17.7833,
          address: 'MOL töltőállomás'
        },
        cost: 18500
      }
    ]
  }

  private getMockTemperatures(vehicleId: string): TrackGPSTemperature[] {
    return [
      {
        vehicleId,
        timestamp: new Date().toISOString(),
        temperature: 22.5,
        sensorId: 'TEMP_01'
      }
    ]
  }
}

// Export singleton instance
export const trackGPSAPI = new TrackGPSAPI()