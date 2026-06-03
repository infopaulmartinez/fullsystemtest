import React, { useState, useEffect, useRef } from 'react'
import { 
  Database, 
  Server, 
  Cpu, 
  HardDrive, 
  Layers, 
  Activity, 
  Users, 
  Zap, 
  Cloud, 
  RefreshCw,
  Lock,
  Globe,
  Wifi,
  Smartphone,
  Truck,
  ChefHat,
  ShoppingCart,
  Settings,
  Bot,
  AlertTriangle
} from 'lucide-react'
import { supabase } from '../lib/supabase'

interface SystemNode {
  id: string
  name: string
  type: 'database' | 'server' | 'service' | 'client' | 'sensor' | 'user' | 'vehicle' | 'location'
  status: 'online' | 'offline' | 'warning' | 'error'
  connections: string[]
  metrics?: {
    cpu?: number
    memory?: number
    disk?: number
    network?: number
    temperature?: number
    battery?: number
  }
  position?: {
    x: number
    y: number
  }
  details?: Record<string, any>
}

export default function SystemVisualization() {
  const [nodes, setNodes] = useState<SystemNode[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState<SystemNode | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>(0)

  useEffect(() => {
    loadSystemData()
    
    if (autoRefresh) {
      const interval = setInterval(loadSystemData, 30000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  useEffect(() => {
    if (nodes.length > 0) {
      if (viewMode === '2d') {
        renderCanvas2D()
      } else {
        renderCanvas3D()
      }
    }
    
    return () => {
      cancelAnimationFrame(animationRef.current)
    }
  }, [nodes, viewMode, selectedNode])

  const loadSystemData = async () => {
    try {
      setLoading(true)
      
      // Valós alkalmazásban itt lenne az adatbázis lekérdezés
      // Most példa adatokkal dolgozunk
      
      // Adatbázis statisztikák lekérdezése
      const { data: dbStats, error: dbError } = await supabase
        .from('settings')
        .select('*')
        .limit(1)
      
      // Felhasználók számának lekérdezése
      const { count: userCount, error: userError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
      
      // Termékek számának lekérdezése
      const { count: productCount, error: productError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
      
      // Rendelések számának lekérdezése
      const { count: orderCount, error: orderError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
      
      // Példa rendszer csomópontok
      const systemNodes: SystemNode[] = [
        {
          id: 'db-main',
          name: 'Fő adatbázis',
          type: 'database',
          status: dbError ? 'error' : 'online',
          connections: ['server-api', 'server-auth'],
          metrics: {
            cpu: 35 + Math.random() * 15,
            memory: 42 + Math.random() * 10,
            disk: 68 + Math.random() * 5
          },
          details: {
            type: 'PostgreSQL',
            version: '15.3',
            tables: 15,
            size: '1.2 GB',
            connections: 24,
            uptime: '14 nap 6 óra'
          }
        },
        {
          id: 'server-api',
          name: 'API Szerver',
          type: 'server',
          status: 'online',
          connections: ['service-auth', 'service-storage', 'client-web', 'client-mobile'],
          metrics: {
            cpu: 28 + Math.random() * 20,
            memory: 45 + Math.random() * 15,
            network: 62 + Math.random() * 10
          },
          details: {
            type: 'Node.js',
            version: '18.16.0',
            endpoints: 42,
            requests: '1.2k/perc',
            uptime: '14 nap 6 óra'
          }
        },
        {
          id: 'server-auth',
          name: 'Autentikációs Szerver',
          type: 'server',
          status: 'online',
          connections: ['service-auth', 'client-web', 'client-mobile'],
          metrics: {
            cpu: 15 + Math.random() * 10,
            memory: 30 + Math.random() * 10,
            network: 25 + Math.random() * 15
          },
          details: {
            type: 'Supabase Auth',
            activeUsers: userCount || 24,
            loginRate: '15/óra',
            providers: ['email', 'google'],
            uptime: '14 nap 6 óra'
          }
        },
        {
          id: 'service-auth',
          name: 'Autentikációs Szolgáltatás',
          type: 'service',
          status: 'online',
          connections: ['client-web', 'client-mobile'],
          metrics: {
            cpu: 12 + Math.random() * 8,
            memory: 25 + Math.random() * 10
          },
          details: {
            type: 'Microservice',
            framework: 'Express',
            activeTokens: 156,
            refreshRate: '10/perc'
          }
        },
        {
          id: 'service-storage',
          name: 'Fájltároló Szolgáltatás',
          type: 'service',
          status: 'online',
          connections: ['client-web', 'client-mobile'],
          metrics: {
            cpu: 8 + Math.random() * 5,
            memory: 15 + Math.random() * 8,
            disk: 45 + Math.random() * 10
          },
          details: {
            type: 'Supabase Storage',
            buckets: 3,
            totalFiles: 128,
            totalSize: '256 MB'
          }
        },
        {
          id: 'service-ai',
          name: 'AI Szolgáltatás',
          type: 'service',
          status: 'online',
          connections: ['client-web', 'client-mobile', 'service-analytics'],
          metrics: {
            cpu: 65 + Math.random() * 25,
            memory: 75 + Math.random() * 15
          },
          details: {
            type: 'Machine Learning',
            model: 'GPT-4',
            requests: '50/óra',
            avgResponseTime: '1.2s'
          }
        },
        {
          id: 'service-analytics',
          name: 'Analitikai Szolgáltatás',
          type: 'service',
          status: 'online',
          connections: ['client-web', 'client-mobile'],
          metrics: {
            cpu: 45 + Math.random() * 15,
            memory: 55 + Math.random() * 10
          },
          details: {
            type: 'Data Analytics',
            dataPoints: '1.2M',
            reports: 15,
            processingRate: '10k/perc'
          }
        },
        {
          id: 'client-web',
          name: 'Web Alkalmazás',
          type: 'client',
          status: 'online',
          connections: [],
          metrics: {
            cpu: 0,
            memory: 0
          },
          details: {
            type: 'React',
            version: '18.3.1',
            activeUsers: 45,
            avgLoadTime: '1.8s'
          }
        },
        {
          id: 'client-mobile',
          name: 'Mobil Alkalmazás',
          type: 'client',
          status: 'online',
          connections: [],
          metrics: {
            cpu: 0,
            memory: 0
          },
          details: {
            type: 'React Native',
            version: '0.72.0',
            activeUsers: 28,
            platforms: ['iOS', 'Android']
          }
        },
        {
          id: 'sensor-oven1',
          name: 'Sütő #1 Szenzor',
          type: 'sensor',
          status: 'online',
          connections: ['service-analytics'],
          metrics: {
            temperature: 185 + Math.random() * 10
          },
          details: {
            type: 'Smart-MAC',
            deviceId: '1728053249',
            dataPoints: '1/perc',
            lastReading: new Date().toLocaleTimeString()
          }
        },
        {
          id: 'sensor-oven2',
          name: 'Sütő #2 Szenzor',
          type: 'sensor',
          status: 'warning',
          connections: ['service-analytics'],
          metrics: {
            temperature: 210 + Math.random() * 15
          },
          details: {
            type: 'Smart-MAC',
            deviceId: '1728053250',
            dataPoints: '1/perc',
            lastReading: new Date().toLocaleTimeString()
          }
        },
        {
          id: 'sensor-freezer',
          name: 'Fagyasztó Szenzor',
          type: 'sensor',
          status: 'online',
          connections: ['service-analytics'],
          metrics: {
            temperature: -18 + Math.random() * 3
          },
          details: {
            type: 'Smart-MAC',
            deviceId: '1728053252',
            dataPoints: '1/perc',
            lastReading: new Date().toLocaleTimeString()
          }
        },
        {
          id: 'vehicle-1',
          name: 'Szállító jármű #1',
          type: 'vehicle',
          status: 'online',
          connections: ['service-analytics'],
          metrics: {
            battery: 75 + Math.random() * 10
          },
          details: {
            type: 'Ford Transit',
            licensePlate: 'ABC-123',
            driver: 'Tóth Gábor',
            location: 'Balatonszemes',
            lastUpdate: new Date().toLocaleTimeString()
          }
        },
        {
          id: 'vehicle-2',
          name: 'Szállító jármű #2',
          type: 'vehicle',
          status: 'offline',
          connections: ['service-analytics'],
          metrics: {
            battery: 0
          },
          details: {
            type: 'Mercedes Sprinter',
            licensePlate: 'DEF-456',
            driver: 'Kiss László',
            location: 'Garázs',
            lastUpdate: '10:15'
          }
        },
        {
          id: 'location-1',
          name: 'Központi Üzlet',
          type: 'location',
          status: 'online',
          connections: ['service-analytics'],
          metrics: {
            temperature: 22 + Math.random() * 2
          },
          details: {
            type: 'Üzlet',
            address: 'Balatonszemes, Fő u. 12.',
            manager: 'Nagy Péter',
            openingHours: '06:00-20:00',
            activeEmployees: 5
          }
        },
        {
          id: 'location-2',
          name: 'Gyártóüzem',
          type: 'location',
          status: 'online',
          connections: ['service-analytics', 'sensor-oven1', 'sensor-oven2', 'sensor-freezer'],
          metrics: {
            temperature: 24 + Math.random() * 3
          },
          details: {
            type: 'Gyártóhely',
            address: 'Balatonszemes, Ipari u. 5.',
            manager: 'Kovács János',
            activeEmployees: 8,
            activeBatches: 3
          }
        }
      ]
      
      // Pozíciók kiszámítása
      // Calculate center position
      const centerX = 400;
      const centerY = 300;
      const radius = 300
      
      // Csomópontok csoportosítása típus szerint
      const groupedNodes: Record<string, SystemNode[]> = {}
      systemNodes.forEach(node => {
        if (!groupedNodes[node.type]) {
          groupedNodes[node.type] = []
        }
        groupedNodes[node.type].push(node)
      })
      
      // Pozíciók kiosztása csoportonként a kiszámított középpont körül
      let angleOffset = 0
      Object.entries(groupedNodes).forEach(([type, nodes]) => {
        const groupAngleSpan = (Math.PI * 2) * (nodes.length / systemNodes.length)
        const groupStartAngle = angleOffset
        
        nodes.forEach((node, index) => {
          const angle = groupStartAngle + (index * groupAngleSpan / nodes.length)
          node.position = {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle)
          }
        })
        
        angleOffset += groupAngleSpan
      })
      
      setNodes(systemNodes)
    } catch (error) {
      console.error('Hiba a rendszeradatok betöltésekor:', error)
    } finally {
      setLoading(false)
    }
  }

  const renderCanvas2D = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return 

    // Canvas méretének beállítása
    if (containerRef.current) {
      canvas.width = containerRef.current.clientWidth
      canvas.height = containerRef.current.clientHeight
    }

    // Háttér törlése
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Use the center of the canvas
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Kapcsolatok rajzolása
    ctx.lineWidth = 2
    nodes.forEach(node => {
      if (node.connections && node.connections.length > 0) {
        node.connections.forEach(targetId => {
          const targetNode = nodes.find(n => n.id === targetId)
          if (targetNode && node.position && targetNode.position) {
            // Kapcsolat színének beállítása
            if (selectedNode && (selectedNode.id === node.id || selectedNode.id === targetId)) {
              ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)' // Kiemelt kapcsolat
            } else {
              ctx.strokeStyle = 'rgba(156, 163, 175, 0.3)' // Normál kapcsolat
            }
            
            // Kapcsolat rajzolása
            ctx.beginPath()
            ctx.moveTo(node.position.x, node.position.y)
            ctx.lineTo(targetNode.position.x, targetNode.position.y)
            ctx.stroke()
            
            // Nyíl rajzolása
            const angle = Math.atan2(
              targetNode.position.y - node.position.y,
              targetNode.position.x - node.position.x
            )
            const arrowLength = 10
            const arrowX = targetNode.position.x - 20 * Math.cos(angle)
            const arrowY = targetNode.position.y - 20 * Math.sin(angle)
            
            ctx.beginPath()
            ctx.moveTo(arrowX, arrowY)
            ctx.lineTo(
              arrowX - arrowLength * Math.cos(angle - Math.PI / 6),
              arrowY - arrowLength * Math.sin(angle - Math.PI / 6)
            )
            ctx.lineTo(
              arrowX - arrowLength * Math.cos(angle + Math.PI / 6),
              arrowY - arrowLength * Math.sin(angle + Math.PI / 6)
            )
            ctx.closePath()
            ctx.fillStyle = ctx.strokeStyle
            ctx.fill()
          }
        })
      }
    })
    
    // Csomópontok rajzolása
    nodes.forEach(node => {
      if (node.position) {
        // Csomópont színének beállítása
        let fillColor = 'rgba(59, 130, 246, 0.8)' // Alapértelmezett kék
        let strokeColor = 'rgba(37, 99, 235, 1)'
        
        switch (node.status) {
          case 'online':
            fillColor = 'rgba(16, 185, 129, 0.8)' // Zöld
            strokeColor = 'rgba(5, 150, 105, 1)'
            break
          case 'warning':
            fillColor = 'rgba(245, 158, 11, 0.8)' // Sárga
            strokeColor = 'rgba(217, 119, 6, 1)'
            break
          case 'error':
            fillColor = 'rgba(239, 68, 68, 0.8)' // Piros
            strokeColor = 'rgba(220, 38, 38, 1)'
            break
          case 'offline':
            fillColor = 'rgba(156, 163, 175, 0.8)' // Szürke
            strokeColor = 'rgba(107, 114, 128, 1)'
            break
        }
        
        // Kijelölt csomópont kiemelése
        if (selectedNode && selectedNode.id === node.id) {
          ctx.shadowColor = 'rgba(59, 130, 246, 0.5)'
          ctx.shadowBlur = 15
        } else {
          ctx.shadowBlur = 0
        }
        
        // Csomópont körének rajzolása
        ctx.beginPath()
        ctx.arc(node.position.x, node.position.y, 20, 0, Math.PI * 2)
        ctx.fillStyle = fillColor
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = strokeColor
        ctx.stroke()
        
        // Csomópont ikonjának rajzolása
        ctx.fillStyle = 'white'
        ctx.font = '14px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        
        let icon = '?'
        switch (node.type) {
          case 'database':
            icon = 'DB'
            break
          case 'server':
            icon = 'SV'
            break
          case 'service':
            icon = 'SV'
            break
          case 'client':
            icon = 'CL'
            break
          case 'sensor':
            icon = 'SE'
            break
          case 'user':
            icon = 'US'
            break
          case 'vehicle':
            icon = 'VE'
            break
          case 'location':
            icon = 'LO'
            break
        }
        
        ctx.fillText(icon, node.position.x, node.position.y)
        
        // Csomópont nevének rajzolása
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
        ctx.font = '12px sans-serif'
        ctx.fillText(node.name, node.position.x, node.position.y + 35)
      }
    })
  }

  const renderCanvas3D = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Canvas méretének beállítása
    if (containerRef.current) {
      canvas.width = containerRef.current.clientWidth
      canvas.height = containerRef.current.clientHeight
    }

    // Háttér törlése
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Use the center of the canvas
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // 3D effect - draw connections with perspective
    ctx.lineWidth = 2
    nodes.forEach(node => {
      if (node.connections && node.connections.length > 0 && node.position) {
        node.connections.forEach(targetId => {
          const targetNode = nodes.find(n => n.id === targetId)
          if (targetNode && targetNode.position) {
            // Kapcsolat színének beállítása
            if (selectedNode && (selectedNode.id === node.id || selectedNode.id === targetId)) {
              ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)' // Kiemelt kapcsolat
            } else {
              ctx.strokeStyle = 'rgba(156, 163, 175, 0.3)' // Normál kapcsolat
            }
            
            // Add 3D perspective effect
            const startX = node.position.x;
            const startY = node.position.y;
            const endX = targetNode.position.x;
            const endY = targetNode.position.y;
            
            // Calculate distance from center for 3D effect
            const startDistFromCenter = Math.sqrt(Math.pow(startX - centerX, 2) + Math.pow(startY - centerY, 2));
            const endDistFromCenter = Math.sqrt(Math.pow(endX - centerX, 2) + Math.pow(endY - centerY, 2));
            
            // Apply 3D perspective
            const perspectiveStart = 1 - (startDistFromCenter / (canvas.width * 0.8)) * 0.3;
            const perspectiveEnd = 1 - (endDistFromCenter / (canvas.width * 0.8)) * 0.3;
            
            const start3DX = centerX + (startX - centerX) * perspectiveStart;
            const start3DY = centerY + (startY - centerY) * perspectiveStart;
            const end3DX = centerX + (endX - centerX) * perspectiveEnd;
            const end3DY = centerY + (endY - centerY) * perspectiveEnd;
            
            // Draw connection with 3D effect
            ctx.beginPath();
            ctx.moveTo(start3DX, start3DY);
            ctx.lineTo(end3DX, end3DY);
            ctx.stroke();
          }
        });
      }
    });
    
    // Draw nodes with 3D effect
    nodes.forEach(node => {
      if (node.position) {
        // Calculate distance from center for 3D effect
        const distFromCenter = Math.sqrt(Math.pow(node.position.x - centerX, 2) + Math.pow(node.position.y - centerY, 2));
        const perspective = 1 - (distFromCenter / (canvas.width * 0.8)) * 0.3;
        
        // Apply 3D perspective
        const x3D = centerX + (node.position.x - centerX) * perspective;
        const y3D = centerY + (node.position.y - centerY) * perspective;
        
        // Node size based on perspective
        const nodeSize = 20 * perspective;
        
        // Csomópont színének beállítása
        let fillColor = 'rgba(59, 130, 246, 0.8)' // Alapértelmezett kék
        let strokeColor = 'rgba(37, 99, 235, 1)'
        
        switch (node.status) {
          case 'online':
            fillColor = 'rgba(16, 185, 129, 0.8)' // Zöld
            strokeColor = 'rgba(5, 150, 105, 1)'
            break
          case 'warning':
            fillColor = 'rgba(245, 158, 11, 0.8)' // Sárga
            strokeColor = 'rgba(217, 119, 6, 1)'
            break
          case 'error':
            fillColor = 'rgba(239, 68, 68, 0.8)' // Piros
            strokeColor = 'rgba(220, 38, 38, 1)'
            break
          case 'offline':
            fillColor = 'rgba(156, 163, 175, 0.8)' // Szürke
            strokeColor = 'rgba(107, 114, 128, 1)'
            break
        }
        
        // Add shadow for 3D effect
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;
        
        // Kijelölt csomópont kiemelése
        if (selectedNode && selectedNode.id === node.id) {
          ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';
          ctx.shadowBlur = 15;
        }
        
        // Draw node with 3D effect
        ctx.beginPath();
        ctx.arc(x3D, y3D, nodeSize, 0, Math.PI * 2);
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = strokeColor;
        ctx.stroke();
        
        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        // Draw node icon
        ctx.fillStyle = 'white';
        ctx.font = `${14 * perspective}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        let icon = '?';
        switch (node.type) {
          case 'database':
            icon = 'DB';
            break;
          case 'server':
            icon = 'SV';
            break;
          case 'service':
            icon = 'SV';
            break;
          case 'client':
            icon = 'CL';
            break;
          case 'sensor':
            icon = 'SE';
            break;
          case 'user':
            icon = 'US';
            break;
          case 'vehicle':
            icon = 'VE';
            break;
          case 'location':
            icon = 'LO';
            break;
        }
        
        ctx.fillText(icon, x3D, y3D);
        
        // Draw node name with 3D effect
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = `${12 * perspective}px sans-serif`;
        ctx.fillText(node.name, x3D, y3D + 35 * perspective);
      }
    });
    
    // Request animation frame for continuous rendering
    animationRef.current = requestAnimationFrame(renderCanvas3D);
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // Kattintott csomópont keresése
    let clickedNode: SystemNode | null = null
    for (const node of nodes) {
      if (node.position) {
        const dx = node.position.x - x
        const dy = node.position.y - y
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        if (distance <= 20) {
          clickedNode = node
          break
        }
      }
    }
    
    if (clickedNode) {
      setSelectedNode(clickedNode)
      setShowDetails(true)
    } else {
      setSelectedNode(null)
      setShowDetails(false)
    }
  }

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'database':
        return <Database className="h-6 w-6 text-blue-500" />
      case 'server':
        return <Server className="h-6 w-6 text-purple-500" />
      case 'service':
        return <Cpu className="h-6 w-6 text-indigo-500" />
      case 'client':
        return <Smartphone className="h-6 w-6 text-green-500" />
      case 'sensor':
        return <Activity className="h-6 w-6 text-amber-500" />
      case 'user':
        return <Users className="h-6 w-6 text-pink-500" />
      case 'vehicle':
        return <Truck className="h-6 w-6 text-red-500" />
      case 'location':
        return <Globe className="h-6 w-6 text-cyan-500" />
      default:
        return <HardDrive className="h-6 w-6 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'offline':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online':
        return 'Online'
      case 'warning':
        return 'Figyelmeztetés'
      case 'error':
        return 'Hiba'
      case 'offline':
        return 'Offline'
      default:
        return status
    }
  }

  const getSystemOverview = () => {
    const totalNodes = nodes.length
    const onlineNodes = nodes.filter(node => node.status === 'online').length
    const warningNodes = nodes.filter(node => node.status === 'warning').length
    const errorNodes = nodes.filter(node => node.status === 'error').length
    const offlineNodes = nodes.filter(node => node.status === 'offline').length
    
    const databaseNodes = nodes.filter(node => node.type === 'database').length
    const serverNodes = nodes.filter(node => node.type === 'server').length
    const serviceNodes = nodes.filter(node => node.type === 'service').length
    const clientNodes = nodes.filter(node => node.type === 'client').length
    const sensorNodes = nodes.filter(node => node.type === 'sensor').length
    const vehicleNodes = nodes.filter(node => node.type === 'vehicle').length
    const locationNodes = nodes.filter(node => node.type === 'location').length
    
    return {
      totalNodes,
      onlineNodes,
      warningNodes,
      errorNodes,
      offlineNodes,
      databaseNodes,
      serverNodes,
      serviceNodes,
      clientNodes,
      sensorNodes,
      vehicleNodes,
      locationNodes,
      healthPercentage: Math.round((onlineNodes / totalNodes) * 100)
    }
  }

  const systemOverview = getSystemOverview()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <Layers className="h-8 w-8 mr-3 text-blue-600" />
            Rendszer Vizualizáció
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Valós idejű áttekintés a teljes rendszer működéséről
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setViewMode(viewMode === '2d' ? '3d' : '2d')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Layers className="h-5 w-5 mr-2" />
            {viewMode === '2d' ? '3D Nézet' : '2D Nézet'}
          </button>
          <button
            onClick={loadSystemData}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 transition-all duration-200 shadow-lg shadow-blue-500/25"
          >
            <RefreshCw className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Frissítés
          </button>
        </div>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 p-3">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Rendszer állapot</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{systemOverview.healthPercentage}%</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 p-3">
              <Layers className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Összes csomópont</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{systemOverview.totalNodes}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 p-3">
              <Wifi className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Online eszközök</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{systemOverview.onlineNodes}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-red-500 to-pink-600 p-3">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Figyelmeztetések</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{systemOverview.warningNodes + systemOverview.errorNodes}</p>
            </div>
          </div>
        </div>
      </div>

      {/* System Visualization */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Rendszer Architektúra</h2>
          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Automatikus frissítés</span>
            </label>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Utolsó frissítés: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
        
        <div className="flex">
          {/* Left sidebar - Node types */}
          <div className="w-64 border-r border-gray-200 dark:border-gray-700 p-4 space-y-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Csomópont típusok</h3>
            
            <div className="space-y-2">
              <div className="flex items-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <Database className="h-5 w-5 text-blue-500 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Adatbázisok</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{systemOverview.databaseNodes} csomópont</p>
                </div>
              </div>
              
              <div className="flex items-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <Server className="h-5 w-5 text-purple-500 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Szerverek</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{systemOverview.serverNodes} csomópont</p>
                </div>
              </div>
              
              <div className="flex items-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <Cpu className="h-5 w-5 text-indigo-500 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Szolgáltatások</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{systemOverview.serviceNodes} csomópont</p>
                </div>
              </div>
              
              <div className="flex items-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <Smartphone className="h-5 w-5 text-green-500 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Kliensek</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{systemOverview.clientNodes} csomópont</p>
                </div>
              </div>
              
              <div className="flex items-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <Activity className="h-5 w-5 text-amber-500 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Szenzorok</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{systemOverview.sensorNodes} csomópont</p>
                </div>
              </div>
              
              <div className="flex items-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <Truck className="h-5 w-5 text-red-500 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Járművek</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{systemOverview.vehicleNodes} csomópont</p>
                </div>
              </div>
              
              <div className="flex items-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <Globe className="h-5 w-5 text-cyan-500 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Helyszínek</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{systemOverview.locationNodes} csomópont</p>
                </div>
              </div>
            </div>
            
            <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Állapot jelmagyarázat</h3>
              
              <div className="space-y-2">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Online ({systemOverview.onlineNodes})</span>
                </div>
                
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Figyelmeztetés ({systemOverview.warningNodes})</span>
                </div>
                
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Hiba ({systemOverview.errorNodes})</span>
                </div>
                
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-gray-500 mr-2"></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Offline ({systemOverview.offlineNodes})</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Main visualization area */}
          <div className="flex-1 relative" ref={containerRef}>
            <canvas 
              ref={canvasRef} 
              className="w-full h-[600px]"
              onClick={handleCanvasClick}
            ></canvas>
            
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 dark:bg-gray-800 dark:bg-opacity-70">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>
          
          {/* Right sidebar - Node details */}
          {showDetails && selectedNode && (
            <div className="w-80 border-l border-gray-200 dark:border-gray-700 p-4">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center">
                  {getNodeIcon(selectedNode.type)}
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white ml-2">{selectedNode.name}</h3>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedNode.status)}`}>
                  {getStatusText(selectedNode.status)}
                </span>
              </div>
              
              <div className="space-y-4">
                {selectedNode.metrics && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Metrikák</h4>
                    <div className="space-y-2">
                      {selectedNode.metrics.cpu !== undefined && (
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500 dark:text-gray-400">CPU</span>
                            <span className="text-gray-700 dark:text-gray-300">{Math.round(selectedNode.metrics.cpu)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div 
                              className="bg-blue-600 h-1.5 rounded-full"
                              style={{ width: `${selectedNode.metrics.cpu}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                      
                      {selectedNode.metrics.memory !== undefined && (
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500 dark:text-gray-400">Memória</span>
                            <span className="text-gray-700 dark:text-gray-300">{Math.round(selectedNode.metrics.memory)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div 
                              className="bg-purple-600 h-1.5 rounded-full"
                              style={{ width: `${selectedNode.metrics.memory}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                      
                      {selectedNode.metrics.disk !== undefined && (
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500 dark:text-gray-400">Lemez</span>
                            <span className="text-gray-700 dark:text-gray-300">{Math.round(selectedNode.metrics.disk)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div 
                              className="bg-amber-600 h-1.5 rounded-full"
                              style={{ width: `${selectedNode.metrics.disk}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                      
                      {selectedNode.metrics.network !== undefined && (
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500 dark:text-gray-400">Hálózat</span>
                            <span className="text-gray-700 dark:text-gray-300">{Math.round(selectedNode.metrics.network)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div 
                              className="bg-green-600 h-1.5 rounded-full"
                              style={{ width: `${selectedNode.metrics.network}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                      
                      {selectedNode.metrics.temperature !== undefined && (
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500 dark:text-gray-400">Hőmérséklet</span>
                            <span className="text-gray-700 dark:text-gray-300">{selectedNode.metrics.temperature.toFixed(1)}°C</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div 
                              className={`h-1.5 rounded-full ${
                                selectedNode.metrics.temperature > 100 ? 'bg-red-600' : 'bg-blue-600'
                              }`}
                              style={{ width: `${Math.min(100, selectedNode.metrics.temperature / 2)}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                      
                      {selectedNode.metrics.battery !== undefined && (
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500 dark:text-gray-400">Akkumulátor</span>
                            <span className="text-gray-700 dark:text-gray-300">{Math.round(selectedNode.metrics.battery)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div 
                              className={`h-1.5 rounded-full ${
                                selectedNode.metrics.battery > 20 ? 'bg-green-600' : 'bg-red-600'
                              }`}
                              style={{ width: `${selectedNode.metrics.battery}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {selectedNode.details && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Részletek</h4>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                      {Object.entries(selectedNode.details).map(([key, value]) => (
                        <div key={key} className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-600 last:border-0">
                          <span className="text-xs text-gray-500 dark:text-gray-400">{key}</span>
                          <span className="text-xs font-medium text-gray-900 dark:text-white">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {selectedNode.connections && selectedNode.connections.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Kapcsolatok</h4>
                    <div className="space-y-1">
                      {selectedNode.connections.map(connId => {
                        const connNode = nodes.find(n => n.id === connId)
                        return connNode ? (
                          <div 
                            key={connId}
                            className="flex items-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                            onClick={() => {
                              setSelectedNode(connNode)
                              setShowDetails(true)
                            }}
                          >
                            {getNodeIcon(connNode.type)}
                            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{connNode.name}</span>
                          </div>
                        ) : null
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* System Modules */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Rendszer Modulok</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-100 dark:border-blue-800">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Database className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <h3 className="font-medium text-gray-900 dark:text-white">Adatbázis</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">PostgreSQL + Supabase</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Központi adattárolás, felhasználók, termékek, rendelések és egyéb üzleti adatok kezelése.
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-6 border border-purple-100 dark:border-purple-800">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                <Lock className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <h3 className="font-medium text-gray-900 dark:text-white">Autentikáció</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Supabase Auth</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Felhasználói bejelentkezés, regisztráció, jogosultságkezelés és biztonság.
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-6 border border-green-100 dark:border-green-800">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                <ChefHat className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <h3 className="font-medium text-gray-900 dark:text-white">Termelés</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Gyártási folyamatok</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Receptek, gyártási tételek, minőségbiztosítás és termelési folyamatok kezelése.
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-6 border border-amber-100 dark:border-amber-800">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
                <ShoppingCart className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <h3 className="font-medium text-gray-900 dark:text-white">Értékesítés</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">POS és rendelések</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Értékesítési rendszer, rendelések kezelése, számlázás és készletkezelés.
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 rounded-xl p-6 border border-red-100 dark:border-red-800">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl flex items-center justify-center">
                <Truck className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <h3 className="font-medium text-gray-900 dark:text-white">Logisztika</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Szállítás és flotta</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Járművek, útvonalak, szállítások és logisztikai folyamatok kezelése.
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-sky-50 to-cyan-50 dark:from-sky-900/20 dark:to-cyan-900/20 rounded-xl p-6 border border-sky-100 dark:border-sky-800">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-cyan-600 rounded-xl flex items-center justify-center">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <h3 className="font-medium text-gray-900 dark:text-white">Monitoring</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Szenzorok és adatgyűjtés</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Szenzorok, IoT eszközök, valós idejű adatgyűjtés és elemzés.
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20 rounded-xl p-6 border border-indigo-100 dark:border-indigo-800">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <h3 className="font-medium text-gray-900 dark:text-white">AI Rendszer</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Mesterséges intelligencia</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Prediktív analitika, optimalizálás, automatizálás és döntéstámogatás.
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20 rounded-xl p-6 border border-gray-100 dark:border-gray-800">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-gray-500 to-slate-600 rounded-xl flex items-center justify-center">
                <Settings className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <h3 className="font-medium text-gray-900 dark:text-white">Adminisztráció</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Rendszerbeállítások</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Rendszerbeállítások, felhasználókezelés, jogosultságok és naplózás.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}