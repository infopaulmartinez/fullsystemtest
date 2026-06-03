// lib/blueIrisApi.ts
class BlueIrisAPI {
  constructor() {
    this.config = {
      serverUrl: '/bi-proxy', // Use Vite proxy in dev, actual URL in prod
      username: 'admin',
      password: 'admin123'
    }
    this.session = null
    this.isConnected = false
    this.lastLoginAttempt = 0
  }

  setConfig(config) {
    this.config = { ...this.config, ...config }
    this.isConnected = false
    this.session = null
  }

  getConnectionStatus() {
    return {
      connected: this.isConnected,
      serverUrl: this.config.serverUrl
    }
  }

  // Login to BlueIris and get session
  async login() {
    try {
      console.log('[BlueIrisAPI] Attempting login to', this.config.serverUrl)
      
      // Prevent login spam
      const now = Date.now()
      if (this.lastLoginAttempt && now - this.lastLoginAttempt < 5000) {
        console.warn('[BlueIrisAPI] Login attempt throttled')
        return { success: false, error: 'Login attempt throttled' }
      }
      this.lastLoginAttempt = now

      const response = await fetch(`${this.config.serverUrl}/json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cmd: 'login',
          user: this.config.username,
          pass: this.config.password
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('[BlueIrisAPI] Login response:', data)
      
      if (data.result === 'success' && data.session) {
        this.session = data.session
        this.isConnected = true
        console.log('[BlueIrisAPI] Login successful, session:', this.session)
        return { success: true }
      } else {
        throw new Error(data.message || 'Login failed')
      }
    } catch (error) {
      console.error('[BlueIrisAPI] Login error:', error)
      this.isConnected = false
      this.session = null
      return { success: false, error: error.message }
    }
  }

  // Test connection to BlueIris server
  async testConnection() {
    try {
      console.log('[BlueIrisAPI] Testing connection to', this.config.serverUrl)
      
      const response = await fetch(`${this.config.serverUrl}/json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cmd: 'status'
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('[BlueIrisAPI] Connection test successful:', data)
      this.isConnected = true
      return { success: true }
    } catch (error) {
      console.error('[BlueIrisAPI] Connection test failed:', error)
      this.isConnected = false
      return { success: false, error: error.message }
    }
  }

  // Get list of cameras
  async getCameras() {
    try {
      if (!this.session) {
        const loginResult = await this.login()
        if (!loginResult.success) {
          throw new Error('Failed to login')
        }
      }

      const response = await fetch(`${this.config.serverUrl}/json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cmd: 'cameralist',
          session: this.session
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('[BlueIrisAPI] Camera list:', data)
      
      if (data.result === 'success' && data.cameras) {
        return data.cameras.map((cam: any) => ({
          id: cam.index,
          name: cam.name || `Camera ${cam.index}`,
          isOnline: cam.status !== 'Offline',
          isRecording: cam.recording === 'Yes',
          ptz: cam.ptz === 'Yes',
          streamUrl: this.getCameraStreamUrl(cam.index),
          snapshotUrl: this.getCameraSnapshotUrl(cam.index)
        }))
      }
      return []
    } catch (error) {
      console.error('[BlueIrisAPI] Error getting cameras:', error)
      // Fallback to mock data
      return this.getMockCameras()
    }
  }

  // Get mock cameras for demo/fallback mode
  getMockCameras() {
    return [
      { 
        id: 'cam1', 
        name: 'Bejárat', 
        isOnline: true, 
        isRecording: true, 
        ptz: false, 
        streamUrl: '/bi-proxy/mjpg/1/video.mjpg', 
        snapshotUrl: '/bi-proxy/image/1?q=50&s=100' 
      },
      { 
        id: 'cam2', 
        name: 'Kert', 
        isOnline: true, 
        isRecording: true, 
        ptz: true, 
        streamUrl: '/bi-proxy/mjpg/2/video.mjpg', 
        snapshotUrl: '/bi-proxy/image/2?q=50&s=100' 
      },
      { 
        id: 'cam3', 
        name: 'Garázs', 
        isOnline: true, 
        isRecording: false, 
        ptz: false, 
        streamUrl: '/bi-proxy/mjpg/3/video.mjpg', 
        snapshotUrl: '/bi-proxy/image/3?q=50&s=100' 
      },
      { 
        id: 'cam4', 
        name: 'Hátsó udvar', 
        isOnline: true, 
        isRecording: true, 
        ptz: true, 
        streamUrl: '/bi-proxy/mjpg/4/video.mjpg', 
        snapshotUrl: '/bi-proxy/image/4?q=50&s=100' 
      },
      { 
        id: 'cam5', 
        name: 'Előszoba', 
        isOnline: false, 
        isRecording: false, 
        ptz: false, 
        streamUrl: '/bi-proxy/mjpg/5/video.mjpg', 
        snapshotUrl: '/bi-proxy/image/5?q=50&s=100' 
      },
      { 
        id: 'cam6', 
        name: 'Pékség', 
        isOnline: false, 
        isRecording: false, 
        ptz: false, 
        streamUrl: '/bi-proxy/mjpg/6/video.mjpg', 
        snapshotUrl: '/bi-proxy/image/6?q=50&s=100' 
      }
    ]
  }

  // PTZ Control
  async ptzControl(cameraId, command) {
    try {
      if (!this.session) {
        const loginResult = await this.login()
        if (!loginResult.success) {
          throw new Error('Failed to login')
        }
      }

      const ptzCommands = {
        'up': 0,
        'down': 1,
        'left': 2,
        'right': 3,
        'zoom_in': 4,
        'zoom_out': 5,
        'home': 6
      }

      console.log(`[BlueIrisAPI] PTZ control: ${command} on camera ${cameraId}`)

      const response = await fetch(`${this.config.serverUrl}/json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cmd: 'ptz',
          session: this.session,
          camera: cameraId,
          button: ptzCommands[command]
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data.result === 'success'
    } catch (error) {
      console.error('[BlueIrisAPI] PTZ control error:', error)
      return false
    }
  }

  // Get camera snapshot
  getCameraSnapshotUrl(cameraId) {
    return `${this.config.serverUrl}/image/${cameraId}?q=50&s=100&timestamp=${Date.now()}`
  }

  // Get camera stream URL
  getCameraStreamUrl(cameraId) {
    return `${this.config.serverUrl}/mjpg/${cameraId}/video.mjpg`
  }

  // Get camera recording clips
  async getRecordings(cameraId, date) {
    try {
      if (!this.session) {
        const loginResult = await this.login()
        if (!loginResult.success) {
          throw new Error('Failed to login')
        }
      }

      console.log(`[BlueIrisAPI] Getting recordings for camera ${cameraId} on ${date}`)

      const response = await fetch(`${this.config.serverUrl}/json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cmd: 'clips',
          session: this.session,
          camera: cameraId,
          date: date
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data.result === 'success' ? data.data : []
    } catch (error) {
      console.error('[BlueIrisAPI] Error getting recordings:', error)
      return []
    }
  }
}

// Create and export singleton instance
export const blueIrisApi = new BlueIrisAPI()