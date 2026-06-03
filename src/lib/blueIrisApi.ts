// lib/blueIrisApi.js
class BlueIrisAPI {
  constructor() {
    this.config = {
      serverUrl: '',
      username: 'admin',
      password: 'admin123'
    }
    this.session = 'demo-session-123456'
    this.isConnected = true
  }

  setConfig(config) {
    this.config = { ...this.config, ...config }
    this.isConnected = false
    this.session = 'demo-session-123456'
  }

  getConnectionStatus() {
    return {
      connected: true,
      serverUrl: this.config.serverUrl
    }
  }

  // Login to BlueIris and get session
  async login() {
    try {
      // Simulate successful login for demo
      this.session = 'demo-session-123456'
      this.isConnected = true
      return { success: true }
    } catch (error) {
      console.error('BlueIris login error:', error)
      this.isConnected = false
      return { success: false, error }
    }
  }

  // Test connection to BlueIris server
  async testConnection() {
    try {
      // Simulate successful connection for demo
      this.isConnected = true
      return { success: true }
    } catch (error) {
      console.error('BlueIris connection test failed:', error)
      this.isConnected = false
      return { success: false, error }
    }
  }

  // Get list of cameras
  async getCameras() {
    try {
      // Return mock cameras for demo
      return this.getMockCameras()
    } catch (error) {
      console.error('Error getting cameras:', error)
      return this.getMockCameras()
    }
  }

  // Get mock cameras for demo mode
  getMockCameras() {
    return [
      { 
        id: 'cam1', 
        name: 'Bejárat', 
        isOnline: true, 
        isRecording: true, 
        ptz: false, 
        streamUrl: 'https://demo.blueirissoftware.com/mjpg/birdfeeder/video.mjpg', 
        snapshotUrl: 'https://demo.blueirissoftware.com/mjpg/birdfeeder/video.mjpg' 
      },
      { 
        id: 'cam2', 
        name: 'Kert', 
        isOnline: true, 
        isRecording: true, 
        ptz: true, 
        streamUrl: 'https://demo.blueirissoftware.com/mjpg/front/video.mjpg', 
        snapshotUrl: 'https://demo.blueirissoftware.com/mjpg/front/video.mjpg' 
      },
      { 
        id: 'cam3', 
        name: 'Garázs', 
        isOnline: true, 
        isRecording: false, 
        ptz: false, 
        streamUrl: 'https://demo.blueirissoftware.com/mjpg/driveway/video.mjpg', 
        snapshotUrl: 'https://demo.blueirissoftware.com/mjpg/driveway/video.mjpg' 
      },
      { 
        id: 'cam4', 
        name: 'Hátsó udvar', 
        isOnline: true, 
        isRecording: true, 
        ptz: true, 
        streamUrl: 'https://demo.blueirissoftware.com/mjpg/backyard/video.mjpg', 
        snapshotUrl: 'https://demo.blueirissoftware.com/mjpg/backyard/video.mjpg' 
      },
      { 
        id: 'cam5', 
        name: 'Lángosos Cam2', 
        isOnline: false, 
        isRecording: false, 
        ptz: false, 
        streamUrl: 'https://demo.blueirissoftware.com/mjpg/basement/video.mjpg', 
        snapshotUrl: 'https://demo.blueirissoftware.com/mjpg/basement/video.mjpg' 
      },
      { 
        id: 'cam6', 
        name: 'Kelesztő', 
        isOnline: false, 
        isRecording: false, 
        ptz: false, 
        streamUrl: 'https://demo.blueirissoftware.com/mjpg/garage/video.mjpg', 
        snapshotUrl: 'https://demo.blueirissoftware.com/mjpg/garage/video.mjpg' 
      }
    ]
  }

  // PTZ Control
  async ptzControl(cameraId, command) {
    try {
      if (!this.isConnected) {
        await this.login()
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
      console.error('PTZ control error:', error)
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
      if (!this.isConnected) {
        await this.login()
      }

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
      console.error('Error getting recordings:', error)
      return []
    }
  }
}

// Create and export singleton instance
export const blueIrisApi = new BlueIrisAPI()