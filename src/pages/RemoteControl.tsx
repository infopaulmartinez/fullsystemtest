import React, { useState, useEffect } from 'react'
import { 
  Monitor, Users, Play, X, RefreshCw, Maximize, Minimize, 
  MessageSquare, Mic, MicOff, Video, VideoOff, Share, Lock, 
  Unlock, User, Search, AlertTriangle, Loader, Shield
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { useRole } from '../contexts/RoleContext'

interface RemoteSession {
  id: string
  user_id: string
  user_name: string
  status: 'available' | 'connected' | 'busy'
  last_active: Date
  ip_address?: string
  browser?: string
  os?: string
}

export default function RemoteControl() {
  const [sessions, setSessions] = useState<RemoteSession[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeSession, setActiveSession] = useState<RemoteSession | null>(null)
  const [showChat, setShowChat] = useState(false)
  const [chatMessages, setChatMessages] = useState<{sender: string, message: string, time: Date}[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [screenShared, setScreenShared] = useState(false)
  const [sessionLocked, setSessionLocked] = useState(false)
  const { user } = useAuth()
  const { role } = useRole() 
  const videoRef = React.useRef<HTMLVideoElement>(null)
  
  useEffect(() => {
    if (role === 'admin') {
      loadSessions()
    } else {
      registerSession()
    }
    
    // Set up interval to update session status
    const interval = setInterval(() => {
      // Update session status
      const updatedSessions = sessions.map(session => ({
        ...session,
        isOnline: Math.random() > 0.5 // Randomly set online status for demo
      }))
      setSessions(updatedSessions)
    }, 10000)
    
    // Cleanup on unmount
    return () => {
      if (activeSession) {
        disconnectSession()
      }
      clearInterval(interval)
    }
  }, [role])
  
  const loadSessions = async () => {
    try {
      setLoading(true)

      // In a real implementation, this would fetch active sessions from the database
      // For demo purposes, we'll use mock data
      const mockSessions: RemoteSession[] = [
        {
          id: '1',
          user_id: '1',
          user_name: 'Kovács János',
          status: 'offline',
          last_active: new Date(),
          ip_address: '192.168.1.101',
          browser: 'Chrome',
          os: 'Windows 10'
        },
        {
          id: '2',
          user_id: '2',
          user_name: 'Nagy Péter',
          status: 'available',
          last_active: new Date(),
          ip_address: '192.168.1.102',
          browser: 'Firefox',
          os: 'macOS'
        },
        {
          id: '3', 
          user_id: '3', 
          user_name: 'Szabó Anna',
          status: 'offline',
          last_active: new Date(),
          ip_address: '192.168.1.104',
          browser: 'Safari',
          os: 'iOS'
        }
      ]
      
      // Fetch real users from database
      const { data: realUsers, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, status, created_at')
        .order('created_at', { ascending: false })
      
      if (!error && realUsers && realUsers.length > 0) {
        // Replace mock data with real users
        const realSessions = realUsers.map((user, index) => ({
          id: user.id,
          user_id: user.id,
          user_name: user.full_name || user.email,
          status: index === 0 ? 'offline' : index % 3 === 0 ? 'busy' : 'available',
          last_active: new Date(),
          ip_address: `192.168.1.${100 + index}`,
          browser: index % 2 === 0 ? 'Chrome' : 'Firefox',
          os: index % 3 === 0 ? 'Windows 11' : index % 3 === 1 ? 'macOS' : 'Linux'
        }));
        setSessions(realSessions);
      } else {
        setSessions(mockSessions)
      }
    } catch (error) {
      console.error('Hiba a munkamenetek betöltésekor:', error)
      toast.error('Hiba a munkamenetek betöltésekor')
    } finally {
      setLoading(false)
    }
  }
  
  const registerSession = async () => {
    try {
      setLoading(true)
      
      // Valós implementációban ez regisztrálná a jelenlegi felhasználó munkamenetét
      // For demo purposes, we'll just create a mock session
      const mockSession: RemoteSession = {
        id: '5',
        user_id: user?.id || '5',
        user_name: user?.user_metadata?.full_name || 'Jelenlegi felhasználó',
        status: 'available',
        last_active: new Date(),
        ip_address: '192.168.1.105', 
        browser: 'Chrome',
        os: 'Windows 10'
      }
      
      setActiveSession(mockSession)
      
      // Notify the user that their session is available for remote control
      toast.success('Távoli irányítás engedélyezve. Az adminisztrátorok most csatlakozhatnak a munkamenetéhez.')
    } catch (error) {
      console.error('Hiba a munkamenet regisztrálásakor:', error)
      toast.error('Hiba a távoli irányítás engedélyezésekor')
    } finally {
      setLoading(false)
    }
  }
  
  const connectToSession = async (session: RemoteSession) => {
    try {
      setConnecting(true)
      
      // Valós implementációban ez létrehozna egy WebRTC kapcsolatot
      // For demo purposes, we'll just simulate a connection
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Update session status
      const updatedSession = { ...session, status: 'connected' as const }
      setSessions(prev => prev.map(s => s.id === session.id ? updatedSession : s))
      setActiveSession(updatedSession)
      
      // Képernyőmegosztás szimulálása
      if (videoRef.current) {
        // In a real implementation, this would be a WebRTC video stream
        // For demo purposes, we'll just show a placeholder
        videoRef.current.poster = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMjEyMTIxIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iI2ZmZmZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkZlbGhhc3puw6Fsw7MgS8OpcGVybnnFkWplPC90ZXh0Pjwvc3ZnPg=="
      }
      
      setScreenShared(true)
      toast.success(`Kapcsolódva ${session.user_name} munkamenetéhez`) 
    } catch (error) {
      console.error('Hiba a kapcsolódáskor:', error)
      toast.error('Hiba a kapcsolódáskor')
    } finally {
      setConnecting(false)
    }
  }
  
  const disconnectSession = async () => {
    try {
      if (!activeSession) return
      
      // Valós implementációban ez lezárná a WebRTC kapcsolatot
      // For demo purposes, we'll just simulate disconnection
      
      // Update session status
      if (role === 'admin') {
        const updatedSession = { ...activeSession, status: 'available' as const }
        setSessions(prev => prev.map(s => s.id === activeSession.id ? updatedSession : s))
      }
      
      setActiveSession(null)
      setScreenShared(false)
      setShowChat(false)
      setChatMessages([])
      
      toast.success('Kapcsolat bontva')
    } catch (error) {
      console.error('Hiba a kapcsolat bontásakor:', error)
      toast.error('Hiba a kapcsolat bontásakor')
    }
  }
  
  const sendChatMessage = () => {
    if (!messageInput.trim()) return
    
    const newMessage = {
      sender: 'admin', 
      message: messageInput,
      time: new Date()
    }
    
    setChatMessages(prev => [...prev, newMessage])
    setMessageInput('')
    
    // Válasz szimulálása a felhasználótól
    setTimeout(() => {
      const responseMessage = {
        sender: 'user',
        message: 'Rendben, köszönöm a segítséget!',
        time: new Date()
      }
      setChatMessages(prev => [...prev, responseMessage])
    }, 2000)
  }
  
  const toggleAudio = () => {
    setAudioEnabled(!audioEnabled) 
    toast.success(`Hang ${audioEnabled ? 'kikapcsolva' : 'bekapcsolva'}`)
  }
  
  const toggleVideo = () => {
    setVideoEnabled(!videoEnabled)
    toast.success(`Videó ${videoEnabled ? 'kikapcsolva' : 'bekapcsolva'}`)
  }
  
  const toggleLock = () => {
    setSessionLocked(!sessionLocked) 
    toast.success(`Munkamenet ${sessionLocked ? 'feloldva' : 'zárolva'}`)
  }
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'connected': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'busy': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }
  
  const getStatusText = (status: string) => {
    switch (status) {
      case 'available': return 'Elérhető'
      case 'connected': return 'Kapcsolódva'
      case 'busy': return 'Foglalt'
      default: return status
    }
  }
  
  // Filter sessions based on search term
  const filteredSessions = sessions.filter(session => 
    session.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    session.ip_address?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    session.browser?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    session.os?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading && !activeSession) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // User view (non-admin)
  if (role !== 'admin') {
    return (
      <div className="space-y-6"> 
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
              <Monitor className="h-8 w-8 mr-3 text-blue-600" />
              Távoli irányítás
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Engedélyezze az adminisztrátoroknak, hogy csatlakozzanak a munkamenetéhez
            </p>
          </div>
        </div>

        {/* Session Status */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-6"> 
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center mr-4">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{activeSession?.user_name}</h2>
                <div className="flex items-center mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(activeSession?.status || 'available')}`}> 
                    {getStatusText(activeSession?.status || 'available')}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={activeSession ? disconnectSession : registerSession}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white ${
                activeSession 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-green-600 hover:bg-green-700'
              } transition-all duration-200 shadow-lg`}
            >
              {activeSession ? (
                <>
                  <X className="h-5 w-5 mr-2" />
                  Távoli irányítás letiltása
                </>
              ) : (
                <> 
                  <Play className="h-5 w-5 mr-2" />
                  Távoli irányítás engedélyezése
                </>
              )}
            </button>
          </div>
          
          {activeSession && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4"> 
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3" />
                <div>
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    A távoli irányítás engedélyezve van. Az adminisztrátorok most csatlakozhatnak a munkamenetéhez és láthatják a képernyőjét.
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-300 mt-2">
                    Munkamenet adatok: {activeSession.browser} böngésző, {activeSession.os} operációs rendszer, IP cím: {activeSession.ip_address}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {activeSession && activeSession.status === 'connected' && (
            <div className="mt-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4"> 
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 mr-3" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    Egy adminisztrátor jelenleg csatlakozva van a munkamenetéhez!
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                    A képernyője most meg van osztva, és az adminisztrátor láthatja, amit Ön lát.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {showChat && (
            <div className="mt-6 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"> 
              <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">Chat az adminisztrátorral</h3>
              </div>
              <div className="p-4 h-64 overflow-y-auto bg-white dark:bg-gray-800">
                {chatMessages.map((msg, index) => (
                  <div key={index} className={`mb-3 flex ${msg.sender === 'admin' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-xs rounded-lg px-4 py-2 ${
                      msg.sender === 'admin'  
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' 
                        : 'bg-blue-600 text-white'
                    }`}>
                      <p className="text-sm">{msg.message}</p>
                      <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
                        {msg.time.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Írjon üzenetet..."
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button 
                  onClick={sendChatMessage}
                  className="px-4 py-2 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700"
                >
                  Küldés
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Admin view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <Monitor className="h-8 w-8 mr-3 text-blue-600" />
            Távoli irányítás
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Csatlakozzon a felhasználók munkamenetéhez és nyújtson támogatást
          </p>
        </div>
        <button
          onClick={loadSessions}
          disabled={loading}
          className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Frissítés
        </button>
      </div>

      {/* Active Session View */}
      {activeSession ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"> 
          {/* Session Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center mr-3">
                <User className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">{activeSession.user_name}</h3> 
                <div className="flex items-center mt-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(activeSession.status)}`}>
                    {getStatusText(activeSession.status)}
                  </span>
                  <span className="mx-2 text-gray-400">•</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {activeSession.ip_address} • {activeSession.browser} • {activeSession.os}
                  </span>
                </div> 
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowChat(!showChat)}
                className={`p-2 rounded-lg ${
                  showChat 
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'  
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}
              >
                <MessageSquare className="h-5 w-5" />
              </button>
              <button
                onClick={toggleAudio}
                className={`p-2 rounded-lg ${
                  audioEnabled 
                    ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400'  
                    : 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                }`}
              >
                {audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </button>
              <button
                onClick={toggleVideo}
                className={`p-2 rounded-lg ${
                  videoEnabled 
                    ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400'  
                    : 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                }`}
              >
                {videoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </button>
              <button
                onClick={toggleLock}
                className={`p-2 rounded-lg ${
                  sessionLocked 
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'  
                    : 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                }`}
              >
                {sessionLocked ? <Lock className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
              </button>
              <button
                onClick={disconnectSession}
                className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          {/* Screen Share and Chat */}
          <div className="flex flex-col lg:flex-row"> 
            {/* Screen Share */}
            <div className={`flex-1 ${showChat ? 'lg:border-r border-gray-200 dark:border-gray-700' : ''}`}>
              <div className="relative bg-black aspect-video">
                {screenShared ? (
                  <video
                    ref={videoRef}
                    className="w-full h-full object-contain"
                    poster="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMjEyMTIxIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iI2ZmZmZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkZlbGhhc3puw6Fsw7MgS8OpcGVybnnFkWplPC90ZXh0Pjwvc3ZnPg=="
                    autoPlay
                    muted
                  ></video>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-white">Képernyőmegosztás nincs engedélyezve</p>
                  </div>
                )}
                
                {/* Control Overlay */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 rounded-full px-4 py-2 flex space-x-4">
                  <button className="text-white hover:text-blue-400">
                    <Maximize className="h-5 w-5" />
                  </button> 
                  <button className="text-white hover:text-blue-400">
                    <Minimize className="h-5 w-5" />
                  </button>
                  <button 
                    className={`${screenShared ? 'text-green-400' : 'text-white'} hover:text-green-400`}
                    onClick={() => {
                      setScreenShared(!screenShared)
                      toast.success(screenShared ? 'Képernyőmegosztás leállítva' : 'Képernyőmegosztás elindítva')
                    }} 
                  >
                    <Share className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              {/* Control Panel */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center"> 
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">Távoli irányítás</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Kapcsolódva: {activeSession.user_name} • {new Date().toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"> 
                      Képernyőkép
                    </button>
                    <button className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
                      Fájl küldése
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Chat Panel */}
            {showChat && (
              <div className="w-full lg:w-80 flex flex-col border-t border-gray-200 dark:border-gray-700 lg:border-t-0"> 
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">Chat</h3>
                </div>
                <div className="flex-1 p-4 overflow-y-auto h-64 lg:h-auto">
                  {chatMessages.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500 dark:text-gray-400"> 
                        Nincs üzenet. Kezdjen el chattelni a felhasználóval.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {chatMessages.map((msg, index) => (
                        <div key={index} className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-xs rounded-lg px-4 py-2 ${
                            msg.sender === 'admin'  
                              ? 'bg-blue-600 text-white' 
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                          }`}>
                            <p className="text-sm">{msg.message}</p>
                            <p className="text-xs mt-1 text-gray-300 dark:text-gray-400">
                              {msg.time.toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex"> 
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                      placeholder="Írjon üzenetet..."
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    /> 
                    <button
                      onClick={sendChatMessage}
                      className="px-4 py-2 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700"
                    >
                      Küldés
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Keresés és szűrők */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Keresés név, IP cím vagy böngésző alapján..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Sessions List */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Aktív munkamenetek</h2>
            </div>
            
            {filteredSessions.length === 0 ? (
              <div className="text-center py-12">
                <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Nincsenek aktív munkamenetek</h3>
                <p className="text-gray-500 dark:text-gray-400"> 
                  Jelenleg nincs olyan felhasználó, aki engedélyezte a távoli irányítást.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredSessions.map((session) => (
                  <div key={session.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <div className="flex justify-between items-start"> 
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center mr-3">
                          <User className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">{session.user_name}</h3>
                          <div className="flex items-center mt-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}> 
                              {getStatusText(session.status)}
                            </span>
                            <span className="mx-2 text-gray-400">•</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              Utolsó aktivitás: {session.last_active.toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1"> 
                            {session.ip_address} • {session.browser} • {session.os}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => connectToSession(session)}
                        disabled={connecting || session.status !== 'available'}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" 
                      >
                        {connecting ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Kapcsolódás...
                          </>
                        ) : (
                          <> 
                            <Play className="h-4 w-4 mr-2" />
                            Kapcsolódás
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}