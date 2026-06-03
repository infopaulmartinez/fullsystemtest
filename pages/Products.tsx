import React, { useState, useEffect } from 'react'
import { 
  Bot, 
  Send, 
  Mic, 
  Paperclip, 
  BarChart3, 
  Package, 
  TrendingUp,
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  Database
} from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  suggestions?: string[]
}

export default function AIAssistant() {
  const [recipes, setRecipes] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [orderData, setOrderData] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'Üdvözlöm! Vivien vagyok, az AI Asszisztens. Hogyan segíthetek ma a pékség működésében?',
      timestamp: new Date(),
      suggestions: [
        'Készlet optimalizálás',
        'Termelési javaslatok',
        'Értékesítési elemzés',
        'Költség csökkentés'
      ]
    }])
  const [inputMessage, setInputMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  useEffect(() => {
    // Load all data from database at once
    loadAllData()
  }, [])

  const loadAllData = async () => {
    try {
      // Load all data in parallel
      await Promise.all([
        loadRecipes(),
        loadProducts(),
        loadInventory(),
        loadVehicles(),
        loadOrders(),
        loadLocations()
      ])
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const loadRecipes = async () => {
    try {
      // Try to load from recipes table
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .order('name')
      
      if (error) {
        console.error('Error loading recipes:', error)
        return
      }
      
      if (data && data.length > 0) {
        setRecipes(data)
      }
    } catch (error: any) {
      console.error('Error loading recipes:', error)
    }
  }

  const loadProducts = async () => {
    try {
      // Try to load from products table
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name')
      
      if (error) {
        console.error('Error loading products:', error)
        return
      }
      
      if (data && data.length > 0) {
        setProducts(data)
      }
    } catch (error: any) {
      console.error('Error loading products:', error)
    }
  }

  const loadInventory = async () => {
    try {
      // Try to load from inventory table
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('name')
      
      if (error) {
        console.error('Error loading inventory:', error)
        return
      }
      
      if (data && data.length > 0) {
        setInventory(data)
      }
    } catch (error: any) {
      console.error('Error loading inventory:', error)
    }
  }

  const loadVehicles = async () => {
    try {
      // Try to load from vehicles table
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('license_plate')
      
      if (error) {
        console.error('Error loading vehicles:', error)
        return
      }
      
      if (data && data.length > 0) {
        setVehicles(data)
      }
    } catch (error: any) {
      console.error('Error loading vehicles:', error)
    }
  }

  const loadOrders = async () => {
    try {
      // Try to load from orders table
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      
      if (error) {
        console.error('Error loading orders:', error)
        return
      }
      
      if (data && data.length > 0) {
        setOrders(data)
      }
    } catch (error: any) {
      console.error('Error loading orders:', error)
    }
  }

  const loadLocations = async () => {
    try {
      // Try to load from locations table
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name')
      
      if (error) {
        console.error('Error loading locations:', error)
        return
      }
      
      if (data && data.length > 0) {
        setLocations(data)
      }
    } catch (error: any) {
      console.error('Error loading locations:', error)
    }
  }

  const fetchOrderDetails = async (orderId: string) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, items, customer_name, customer_address, delivery_date, status, payment_status')
        .eq('order_number', orderId)
        .single();
      
      if (error) {
        console.error('Error fetching order:', error);
        return `Sajnos nem találtam a ${orderId} azonosítójú rendelést. Kérem ellenőrizze az azonosítót.`;
      }
      
      if (data) {
        setOrderData(data);
        return `A ${orderId} azonosítójú rendelés adatai:\n\nÜgyfél: ${data.customer_name}\nÁllapot: ${data.status}\nFizetési állapot: ${data.payment_status}\nÖsszeg: ${data.total_amount} Ft\nTermékek száma: ${data.items?.length || 0}\n\nSzeretne további részleteket vagy módosítani a rendelést?`;
      }
      
      return `Nem találtam információt a ${orderId} azonosítójú rendelésről.`;
    } catch (error) {
      console.error('Error processing order query:', error);
      return 'Sajnos hiba történt a rendelés lekérdezésekor.';
    }
  }

  const quickActions = [
    {
      title: 'Készlet elemzés',
      description: 'Készletszintek és újrarendelési javaslatok',
      icon: Package,
      color: 'from-blue-500 to-cyan-600'
    },
    {
      title: 'Értékesítési trend',
      description: 'Értékesítési adatok elemzése és előrejelzés',
      icon: TrendingUp,
      color: 'from-green-500 to-emerald-600'
    },
    {
      title: 'Termelési optimalizálás',
      description: 'Gyártási hatékonyság növelése',
      icon: BarChart3,
      color: 'from-purple-500 to-violet-600'
    },
    {
      title: 'Költség elemzés',
      description: 'Költségek optimalizálása és megtakarítási lehetőségek',
      icon: Lightbulb,
      color: 'from-amber-500 to-orange-600'
    }
  ]

  const insights = [
    {
      type: 'warning',
      title: 'Alacsony készlet',
      message: 'A liszt készlet kritikus szinten van. Javasolt újrarendelés 48 órán belül.',
      icon: AlertTriangle,
      color: 'text-amber-600'
    },
    {
      type: 'success',
      title: 'Optimalizálási lehetőség',
      message: 'A croissant gyártás 15%-kal hatékonyabb lenne reggel 5 órakor indítva.',
      icon: CheckCircle,
      color: 'text-green-600'
    },
    {
      type: 'info',
      title: 'Trend észlelés',
      message: 'A hétvégi muffin értékesítés 23%-kal nőtt az elmúlt hónapban.',
      icon: TrendingUp,
      color: 'text-blue-600'
    }
  ]

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setIsTyping(true)

    // Generate AI response
    let response = '';
    const generateResponse = (input: string) => {
      const lowerInput = input.toLowerCase()
      
      // Check for order ID pattern (e.g., ORD-123456)
      const orderIdMatch = input.match(/ORD-\d+/i);
      if (orderIdMatch) {
        const orderId = orderIdMatch[0];
        return fetchOrderDetails(orderId);
      }

      // Check if asking about the AI's name
      if (lowerInput.includes('hogy hívnak') || lowerInput.includes('mi a neved') || lowerInput.includes('ki vagy')) {
        return 'A nevem Vivien, a Szemesi Pékség AI asszisztense vagyok. Paul Martinez, az AIProcessPilot alapítója fejlesztett ki, hogy segítsek a pékség hatékony működtetésében. Miben segíthetek ma?';
      }

      // Check if asking about the creator
      if (lowerInput.includes('ki készített') || lowerInput.includes('ki fejlesztett') || lowerInput.includes('ki hozott létre')) {
        return 'Paul Martinez, az AIProcessPilot alapítója fejlesztett ki. A rendszer célja, hogy intelligens megoldásokkal segítse a pékségek működését, optimalizálja a termelést és növelje a hatékonyságot. Miben segíthetek ma?';
      }
      
      // Check if we have data from the database
      if (lowerInput.includes('jármű') || lowerInput.includes('autó') || lowerInput.includes('kocsi') || lowerInput.includes('rendszám')) {
        if (vehicles.length > 0) {
          let response = `A rendszerben a következő járművek találhatók:\n\n`
          vehicles.forEach((vehicle, index) => {
            response += `${index + 1}. ${vehicle.model || 'Ismeretlen modell'} (${vehicle.license_plate})\n`
          })
          response += `\nÖsszesen ${vehicles.length} jármű található a rendszerben.`
          return response
        } else {
          return `Sajnos nem találtam járműveket a rendszerben. Kérem, adjon hozzá néhányat a Flotta menüpont alatt.`
        }
      }
      else if (lowerInput.includes('recept') || lowerInput.includes('receptek')) {
        if (recipes.length > 0) {
          let response = `A rendszerben a következő receptek találhatók:\n\n`
          recipes.forEach((recipe, index) => {
            response += `${index + 1}. ${recipe.name} - ${recipe.category}\n`
          })
          response += `\nÖsszesen ${recipes.length} recept található a rendszerben.`
          return response
        } else if (products.length > 0) {
          let response = `A rendszerben a következő termékek találhatók:\n\n`
          products.forEach((product, index) => {
            response += `${index + 1}. ${product.name} - ${product.category}\n`
          })
          response += `\nÖsszesen ${products.length} termék található a rendszerben.`
          return response
        } else {
          return `Sajnos nem találtam recepteket a rendszerben. Kérem, adjon hozzá néhányat a Receptek menüpont alatt.`
        }
      } else if (lowerInput.includes('rendelés') || lowerInput.includes('rendelések')) {
        if (orders.length > 0) {
          let response = `A rendszerben a következő rendelések találhatók:\n\n`
          orders.slice(0, 10).forEach((order, index) => {
            response += `${index + 1}. ${order.order_number} - ${order.customer_name} - ${order.status} - ${order.total_amount} Ft\n`
          })
          response += `\nÖsszesen ${orders.length} rendelés található a rendszerben.`
          return response
        } else {
          return `Sajnos nem találtam rendeléseket a rendszerben. Kérem, adjon hozzá néhányat a Rendelések menüpont alatt.`
        }
      } else if (lowerInput.includes('helyszín') || lowerInput.includes('üzlet') || lowerInput.includes('bolt')) {
        if (locations.length > 0) {
          let response = `A rendszerben a következő helyszínek találhatók:\n\n`
          locations.forEach((location, index) => {
            response += `${index + 1}. ${location.name} - ${location.address}, ${location.city}\n`
          })
          response += `\nÖsszesen ${locations.length} helyszín található a rendszerben.`
          return response
        } else {
          return `Sajnos nem találtam helyszíneket a rendszerben. Kérem, adjon hozzá néhányat a Helyszínek menüpont alatt.`
        }
      }
      
      if (lowerInput.includes('készlet') || lowerInput.includes('alapanyag') || lowerInput.includes('inventory')) {
        if (inventory.length > 0) {
          let response = `A készleten a következő alapanyagok találhatók:\n\n`
          inventory.forEach((item, index) => {
            response += `${index + 1}. ${item.name}: ${item.current_stock} ${item.unit}\n`
          })
          
          const lowStockItems = inventory.filter(item => item.current_stock <= item.min_threshold)
          if (lowStockItems.length > 0) {
            response += `\nFIGYELEM! ${lowStockItems.length} alapanyag alacsony készleten van!`
          }
          return response
        } else {
          return 'A készlet elemzés alapján a következő javaslatokat tudom tenni:\n\n• Liszt: 15 kg újrarendelése szükséges\n• Cukor: Készlet megfelelő\n• Vaj: 8 kg rendelése javasolt\n• Tojás: Friss szállítmány érkezik holnap\n\nSzeretne részletes készlet jelentést?'
        }
      }
      
      if (lowerInput.includes('termelés')) {
        return 'A termelési adatok alapján:\n\n• Átlagos hatékonyság: 87%\n• Leghatékonyabb időszak: 05:00-09:00\n• Javasolt optimalizálás: Croissant gyártás korábbi indítása\n• Várható megtakarítás: 12% energia költség\n\nRészletes termelési tervet készítsek?'
      }
      
      if (lowerInput.includes('értékesítés')) {
        return 'Értékesítési trend elemzés:\n\n• Heti növekedés: +8.5%\n• Legnépszerűbb termék: Croissant (450 db/hét)\n• Csúcsidőszak: 07:00-09:00 és 17:00-19:00\n• Javasolt akció: Délutáni sütemény promóció\n\nRészletes értékesítési jelentést készítsek?'
      }
      
      return 'Értem a kérdését. A rendelkezésre álló adatok alapján részletes elemzést tudok készíteni. Milyen konkrét területre szeretne fókuszálni?'
    }

    const responsePromise = generateResponse(inputMessage);
    
    // Handle both synchronous and asynchronous responses
    if (responsePromise instanceof Promise) {
      responsePromise.then(asyncResponse => {
        response = asyncResponse;
        completeResponse();
      });
    } else {
      response = responsePromise;
      completeResponse();
    }
    
    setInputMessage('')

    function completeResponse() {
      // Simulate AI thinking time
      setTimeout(() => {
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: response,
          timestamp: new Date(),
          suggestions: [
            'Részletes elemzés',
            'Exportálás',
            'Riport készítése',
            'További javaslatok'
          ]
        }
        setMessages(prev => [...prev, aiResponse])
        setIsTyping(false)
      }, 1000 + Math.random() * 2000)
    }
  }

  const handleQuickAction = (action: string) => {
    setInputMessage(action)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center mr-4">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Asszisztens</h1>
            <p className="text-gray-600 dark:text-gray-400">Intelligens üzleti tanácsadó</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-6 overflow-y-auto">
          {/* Quick Actions */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Gyors műveletek</h3>
              <div className="flex items-center">
                <Database className="h-4 w-4 text-blue-500 mr-1" />
                <span className="text-xs text-blue-500">
                  {recipes.length > 0 ? `${recipes.length} recept` : 'Nincs adat'}
                </span>
              </div>
            </div>
            <div className="space-y-3">
              {quickActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickAction(action.title)}
                  className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200 text-left"
                >
                  <div className="flex items-center mb-2">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center mr-3`}>
                      <action.icon className="h-4 w-4 text-white" />
                    </div>
                    <h4 className="font-medium text-gray-900 dark:text-white">{action.title}</h4>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{action.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* AI Insights */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">AI Észrevételek</h3>
            <div className="space-y-3">
              {insights.map((insight, index) => (
                <div key={index} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700">
                  <div className="flex items-start">
                    <insight.icon className={`h-5 w-5 ${insight.color} mr-3 mt-0.5`} />
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white text-sm">{insight.title}</h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{insight.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-3xl ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
                  <div className={`flex items-start space-x-3 ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      message.type === 'user' 
                        ? 'bg-gradient-to-br from-blue-500 to-cyan-600' 
                        : 'bg-gradient-to-br from-purple-500 to-violet-600'
                    }`}>
                      {message.type === 'user' ? (
                        <span className="text-white text-sm font-medium">Te</span>
                      ) : (
                        <Bot className="h-4 w-4 text-white" />
                      )}
                    </div>
                    <div className={`rounded-2xl px-4 py-3 ${
                      message.type === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}>
                      <p className="whitespace-pre-line">{message.content}</p>
                      <p className={`text-xs mt-2 ${
                        message.type === 'user' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {message.timestamp.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  
                  {message.suggestions && message.type === 'assistant' && (
                    <div className="mt-3 ml-11">
                      <div className="flex flex-wrap gap-2">
                        {message.suggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => handleQuickAction(suggestion)}
                            className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl px-4 py-3">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center space-x-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Írja be kérdését vagy kérését..."
                  className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <Paperclip className="h-5 w-5" />
                </button>
              </div>
              <button className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700">
                <Mic className="h-5 w-5" />
              </button>
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim()}
                className="p-3 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-xl hover:from-purple-600 hover:to-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}