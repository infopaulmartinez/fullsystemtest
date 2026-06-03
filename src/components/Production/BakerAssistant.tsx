import React, { useState, useEffect } from 'react'
import { 
  X, 
  ChefHat, 
  MessageSquare, 
  Send, 
  Clock, 
  Thermometer, 
  CheckCircle, 
  AlertTriangle,
  ArrowRight,
  Loader
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface Message {
  id: string
  role: 'assistant' | 'user'
  content: string
  timestamp: Date
}

interface ProductionStep {
  id: number
  description: string
  duration: number
  temperature?: number
  humidity?: number
  completed: boolean
  current: boolean
}

interface BakerAssistantProps {
  onClose: () => void
}

export default function BakerAssistant({ onClose }: BakerAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Üdvözöllek! Én vagyok a pékségi AI asszisztensed. Segítek neked a mai termelési folyamatokban. Miben segíthetek?',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeBatch, setActiveBatch] = useState<any>(null)
  const [productionSteps, setProductionSteps] = useState<ProductionStep[]>([])
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Kezdeti adatok betöltése
    loadActiveBatch()
    
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadActiveBatch = async () => {
    try {
      // Valós alkalmazásban itt lenne az adatbázis lekérdezés
      // Példa adatokkal dolgozunk most
      const mockBatch = {
        id: 'B001',
        recipe_id: '1',
        recipe_name: 'Croissant',
        status: 'in_progress',
        start_time: new Date().toISOString(),
        temperature: 22,
        humidity: 65,
        next_step: 'Tészta dagasztása'
      }
      
      setActiveBatch(mockBatch)
      
      // Példa lépések betöltése
      const mockSteps: ProductionStep[] = [
        { 
          id: 1, 
          description: 'Alapanyagok kimérése a receptúra szerint', 
          duration: 300, 
          completed: true, 
          current: false 
        },
        { 
          id: 2, 
          description: 'Tészta dagasztása 10 percig', 
          duration: 600, 
          completed: false, 
          current: true 
        },
        { 
          id: 3, 
          description: 'Tészta pihentetése', 
          duration: 1800, 
          temperature: 24, 
          humidity: 70, 
          completed: false, 
          current: false 
        },
        { 
          id: 4, 
          description: 'Tészta hajtogatása', 
          duration: 300, 
          completed: false, 
          current: false 
        },
        { 
          id: 5, 
          description: 'Tészta nyújtása és formázása', 
          duration: 900, 
          completed: false, 
          current: false 
        },
        { 
          id: 6, 
          description: 'Kelesztés', 
          duration: 3600, 
          temperature: 28, 
          humidity: 80, 
          completed: false, 
          current: false 
        },
        { 
          id: 7, 
          description: 'Sütés', 
          duration: 900, 
          temperature: 190, 
          completed: false, 
          current: false 
        },
        { 
          id: 8, 
          description: 'Hűtés és csomagolás', 
          duration: 1200, 
          completed: false, 
          current: false 
        }
      ]
      
      setProductionSteps(mockSteps)
      setCurrentStepIndex(1) // A második lépés az aktuális (0-tól indexelve)
      setTimeRemaining(mockSteps[1].duration)
      
      // Timer indítása
      const newTimer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(newTimer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      
      setTimer(newTimer)
      
      // Üdvözlő üzenet hozzáadása
      addAssistantMessage(`Most a "${mockBatch.recipe_name}" recepten dolgozol. A következő lépés: ${mockSteps[1].description}. Segítek végigvezetni a folyamaton.`)
      
    } catch (error) {
      console.error('Hiba az aktív tétel betöltésekor:', error)
    }
  }

  const addAssistantMessage = (content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content,
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, newMessage])
  }

  const handleSendMessage = async () => {
    if (!input.trim()) return
    
    // Felhasználói üzenet hozzáadása
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)
    
    // AI válasz szimulálása
    setTimeout(() => {
      let response = ''
      
      // Egyszerű válaszok a gyakori kérdésekre
      const lowerInput = input.toLowerCase()
      
      if (lowerInput.includes('hőmérséklet') || lowerInput.includes('homerseklet')) {
        if (productionSteps[currentStepIndex].temperature) {
          response = `A jelenlegi lépéshez az ideális hőmérséklet ${productionSteps[currentStepIndex].temperature}°C. Ellenőrizd, hogy a helyiség vagy a berendezés hőmérséklete megfelelő-e.`
        } else {
          response = `A jelenlegi lépéshez nincs meghatározva speciális hőmérséklet. A normál szobahőmérséklet megfelelő.`
        }
      } else if (lowerInput.includes('következő lépés') || lowerInput.includes('kovetkezo lepes')) {
        const nextStep = currentStepIndex < productionSteps.length - 1 ? productionSteps[currentStepIndex + 1] : null
        if (nextStep) {
          response = `A következő lépés: ${nextStep.description}. ${nextStep.temperature ? `Ehhez ${nextStep.temperature}°C hőmérséklet szükséges.` : ''}`
        } else {
          response = `Ez az utolsó lépés a folyamatban.`
        }
      } else if (lowerInput.includes('idő') || lowerInput.includes('ido') || lowerInput.includes('mennyi')) {
        const minutes = Math.floor(timeRemaining / 60)
        const seconds = timeRemaining % 60
        response = `A jelenlegi lépésből (${productionSteps[currentStepIndex].description}) még ${minutes} perc és ${seconds} másodperc van hátra.`
      } else if (lowerInput.includes('kész') || lowerInput.includes('kesz') || lowerInput.includes('befejez')) {
        response = `Nagyszerű! Jelölöm, hogy befejezted a "${productionSteps[currentStepIndex].description}" lépést. Kérlek, folytasd a következő lépéssel: ${
          currentStepIndex < productionSteps.length - 1 ? productionSteps[currentStepIndex + 1].description : 'Ez volt az utolsó lépés.'
        }`
        
        // Lépés befejezése és következőre lépés
        completeCurrentStep()
      } else if (lowerInput.includes('recept') || lowerInput.includes('hozzávaló') || lowerInput.includes('hozzavalo')) {
        response = `A Croissant receptje:\n\nHozzávalók:\n- 500g liszt\n- 10g só\n- 50g cukor\n- 25g élesztő\n- 250ml tej\n- 250g vaj\n\nA részletes elkészítési útmutatót a receptek oldalon találod, vagy kérdezz rá konkrét lépésekre.`
      } else {
        response = `Értem. Most a "${activeBatch?.recipe_name}" recepten dolgozol, a jelenlegi lépés: ${productionSteps[currentStepIndex].description}. Miben segíthetek még?`
      }
      
      addAssistantMessage(response)
      setLoading(false)
    }, 1000)
  }

  const completeCurrentStep = () => {
    if (timer) clearInterval(timer)
    
    setProductionSteps(prev => {
      const newSteps = [...prev]
      // Jelenlegi lépés befejezése
      newSteps[currentStepIndex] = {
        ...newSteps[currentStepIndex],
        completed: true,
        current: false
      }
      
      // Ha van következő lépés, azt aktuálissá tesszük
      if (currentStepIndex < newSteps.length - 1) {
        newSteps[currentStepIndex + 1] = {
          ...newSteps[currentStepIndex + 1],
          current: true
        }
        
        // Új időzítő indítása
        setTimeRemaining(newSteps[currentStepIndex + 1].duration)
        const newTimer = setInterval(() => {
          setTimeRemaining(prev => {
            if (prev <= 1) {
              clearInterval(newTimer)
              return 0
            }
            return prev - 1
          })
        }, 1000)
        
        setTimer(newTimer)
      }
      
      return newSteps
    })
    
    setCurrentStepIndex(prev => 
      prev < productionSteps.length - 1 ? prev + 1 : prev
    )
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <ChefHat className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Pék AI Asszisztens</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Személyes termelési segéd</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        
        <div className="flex flex-1 overflow-hidden">
          {/* Bal oldali panel - Lépések */}
          <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
            <div className="mb-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Aktív tétel</h4>
              {activeBatch && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                  <div className="font-medium text-blue-800 dark:text-blue-400">{activeBatch.recipe_name}</div>
                  <div className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                    <div className="flex items-center">
                      <Thermometer className="h-4 w-4 mr-1" />
                      <span>Hőmérséklet: {activeBatch.temperature}°C</span>
                    </div>
                    <div className="flex items-center mt-1">
                      <Clock className="h-4 w-4 mr-1" />
                      <span>Kezdés: {new Date(activeBatch.start_time).toLocaleTimeString('hu-HU')}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Gyártási lépések</h4>
            <div className="space-y-3">
              {productionSteps.map((step, index) => (
                <div 
                  key={step.id} 
                  className={`p-3 rounded-lg border ${
                    step.current 
                      ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20' 
                      : step.completed 
                        ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20' 
                        : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mt-0.5">
                      {step.completed ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : step.current ? (
                        <div className="h-5 w-5 rounded-full border-2 border-amber-500 flex items-center justify-center">
                          <div className="h-2 w-2 bg-amber-500 rounded-full"></div>
                        </div>
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-600"></div>
                      )}
                    </div>
                    <div className="ml-3 flex-1">
                      <p className={`text-sm font-medium ${
                        step.current 
                          ? 'text-amber-800 dark:text-amber-400' 
                          : step.completed 
                            ? 'text-green-800 dark:text-green-400' 
                            : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {step.description}
                      </p>
                      {(step.temperature || step.humidity) && (
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {step.temperature && (
                            <div className="flex items-center">
                              <Thermometer className="h-3 w-3 mr-1" />
                              <span>{step.temperature}°C</span>
                            </div>
                          )}
                        </div>
                      )}
                      {step.current && (
                        <div className="mt-2">
                          <div className="text-xs text-amber-600 dark:text-amber-400">
                            Hátralévő idő: {formatTime(timeRemaining)}
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                            <div 
                              className="bg-amber-500 h-1.5 rounded-full"
                              style={{ width: `${100 - (timeRemaining / step.duration * 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Jobb oldali panel - Chat */}
          <div className="flex-1 flex flex-col">
            {/* Üzenetek */}
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="space-y-4">
                {messages.map(message => (
                  <div 
                    key={message.id} 
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        message.role === 'user' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                      }`}
                    >
                      <p className="whitespace-pre-line">{message.content}</p>
                      <p className={`text-xs mt-1 ${
                        message.role === 'user' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {message.timestamp.toLocaleTimeString('hu-HU')}
                      </p>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl px-4 py-3">
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
            
            {/* Gyors műveletek */}
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex space-x-2 overflow-x-auto pb-2">
                <button 
                  onClick={() => {
                    setInput('Mi a következő lépés?')
                    handleSendMessage()
                  }}
                  className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm whitespace-nowrap"
                >
                  Következő lépés
                </button>
                <button 
                  onClick={() => {
                    setInput('Mennyi idő van még hátra?')
                    handleSendMessage()
                  }}
                  className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm whitespace-nowrap"
                >
                  Hátralévő idő
                </button>
                <button 
                  onClick={() => {
                    setInput('Milyen hőmérséklet szükséges?')
                    handleSendMessage()
                  }}
                  className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm whitespace-nowrap"
                >
                  Hőmérséklet
                </button>
                <button 
                  onClick={() => {
                    setInput('Befejeztem ezt a lépést')
                    handleSendMessage()
                  }}
                  className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm whitespace-nowrap"
                >
                  Lépés befejezése
                </button>
                <button 
                  onClick={() => {
                    setInput('Mutasd a receptet')
                    handleSendMessage()
                  }}
                  className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm whitespace-nowrap"
                >
                  Recept mutatása
                </button>
              </div>
            </div>
            
            {/* Input */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Írd be a kérdésed vagy utasításod..."
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={loading || !input.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? <Loader className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}