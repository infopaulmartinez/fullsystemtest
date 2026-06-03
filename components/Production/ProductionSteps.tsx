import React, { useState, useEffect, useRef } from 'react'
import { 
  CheckCircle, 
  Clock, 
  Thermometer, 
  Droplets,
  Timer,
  Save,
  ArrowRight,
  Trophy,
  AlertOctagon,
  Volume2,
  X,
  AlertTriangle,
  FileText
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast } from 'react-hot-toast'

interface ProductionStepsProps {
  batch: any
  steps: any[]
  loading: boolean
  onClose: () => void
  onStepUpdate: () => void
}

export default function ProductionSteps({ batch, steps, onClose, onStepUpdate }: ProductionStepsProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [stepData, setStepData] = useState({ actual_temp: '', actual_hum: '', notes: '' })
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [isOverdue, setIsOverdue] = useState(false)
  const [startedAt, setStartedAt] = useState<string>(new Date().toISOString())
  
  // Fontos: ellenőrizzük, hogy vannak-e lépések
  const currentStep = steps && steps.length > 0 ? steps[currentStepIndex] : null
  
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const voiceAlertRef = useRef<boolean>(false)
  const audioAlertRef = useRef<HTMLAudioElement | null>(null)

  // Riasztás lejátszása (MP3 + Beszéd)
  const playAlert = () => {
    if (!currentStep) return;

    if (!audioAlertRef.current) {
      audioAlertRef.current = new Audio('/figyelem.mp3')
    }
    audioAlertRef.current.play().catch(e => console.error("Audio hiba:", e))

    setTimeout(() => {
      if ('speechSynthesis' in window) {
        const msg = new SpeechSynthesisUtterance(`Figyelem! A ${currentStep.title} fázis ideje lejárt! Kérem intézkedjen!`)
        msg.lang = 'hu-HU'
        msg.rate = 0.9
        window.speechSynthesis.speak(msg)
      }
    }, 1200)
  }

  // Időzítő logika
  useEffect(() => {
    if (currentStep) {
      setTimeLeft(currentStep.duration_minutes * 60)
      setIsOverdue(false)
      voiceAlertRef.current = false
      setStartedAt(new Date().toISOString())
    }

    if (timerRef.current) clearInterval(timerRef.current)

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          if (!voiceAlertRef.current && currentStep) {
            playAlert()
            voiceAlertRef.current = true
            setIsOverdue(true)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [currentStepIndex, currentStep])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  const handleNextStep = async () => {
    if (!currentStep) return
    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('production_progress').insert({
        batch_id: batch.id,
        recipe_step_id: currentStep.id,
        actual_temperature: stepData.actual_temp ? parseFloat(stepData.actual_temp) : null,
        actual_humidity: stepData.actual_hum ? parseFloat(stepData.actual_hum) : null,
        notes: stepData.notes,
        started_at: startedAt,
        recorded_at: new Date().toISOString()
      })

      if (error) throw error

      if (currentStepIndex < steps.length - 1) {
        toast.success(`${currentStep.title} kész!`)
        setCurrentStepIndex(prev => prev + 1)
        setStepData({ actual_temp: '', actual_hum: '', notes: '' })
      } else {
        // Gyártás lezárása
        await supabase.from('production_batches')
          .update({ status: 'completed', end_time: new Date().toISOString() })
          .eq('id', batch.id)
        
        toast.success('Gratulálok! A gyártás sikeresen befejeződött.')
        onStepUpdate()
        onClose()
      }
    } catch (e) {
      toast.error('Hiba a mentéskor')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!steps || steps.length === 0) {
    return (
      <div className="text-center py-20 bg-gray-900 border-2 border-dashed border-gray-800 rounded-[3rem]">
        <AlertTriangle className="mx-auto h-16 w-16 text-gray-700 mb-4" />
        <h3 className="text-2xl font-bold text-white uppercase tracking-widest">Nincsenek technológiai lépések</h3>
        <button onClick={onClose} className="mt-8 bg-gray-800 px-10 py-3 rounded-2xl text-white font-black uppercase">Bezárás</button>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-700">
      {/* Haladás jelző */}
      <div className="flex gap-4">
        {steps.map((_, idx) => (
          <div key={idx} className={`h-4 flex-1 rounded-full transition-all duration-700 ${idx <= currentStepIndex ? 'bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.4)]' : 'bg-gray-800'}`} />
        ))}
      </div>

      <div className={`p-12 rounded-[4rem] border-4 transition-all duration-500 ${isOverdue ? 'bg-red-950/20 border-red-500 shadow-[0_0_60px_rgba(239,68,68,0.2)] animate-pulse' : 'bg-gray-900 border-gray-800 shadow-2xl'}`}>
        <div className="flex flex-col lg:flex-row justify-between gap-12">
          
          <div className="flex-1 space-y-8">
            <div className="flex items-center gap-4">
              <span className="bg-amber-500 text-black px-6 py-2 rounded-full font-black text-sm uppercase tracking-widest shadow-lg">{currentStepIndex + 1}. FÁZIS</span>
              {isOverdue && <span className="text-red-500 font-black flex items-center gap-3 uppercase tracking-tighter animate-bounce"><AlertOctagon size={24}/> IDŐTÚLLÉPÉS! BEAVATKOZÁS KELL!</span>}
            </div>
            <h3 className="text-8xl font-black text-white tracking-tighter uppercase leading-[0.9]">{currentStep.title}</h3>
            <p className="text-3xl text-gray-400 leading-relaxed font-medium italic">"{currentStep.description}"</p>
          </div>

          <div className="flex flex-col items-center justify-center p-12 bg-black/60 rounded-[4rem] border-2 border-gray-800 min-w-[400px] shadow-inner">
            <p className="text-gray-500 font-black uppercase text-xs mb-6 tracking-[0.5em]">Fázis időzítő</p>
            <div className={`text-[120px] font-black font-mono tracking-tighter leading-none ${isOverdue ? 'text-red-500' : 'text-white'}`}>
              {formatTime(timeLeft)}
            </div>
            <div className="mt-10 flex items-center gap-4 py-4 px-8 bg-gray-900 rounded-[2rem] border border-gray-800 shadow-2xl">
               <Volume2 size={32} className={isOverdue ? 'text-red-500 animate-pulse' : 'text-amber-500'}/>
               <span className="text-[12px] font-black uppercase tracking-[0.2em] text-gray-400">Vivien Audio AI Online</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
          <div className="space-y-4">
            <label className="text-[12px] font-black text-gray-500 uppercase ml-6 tracking-widest">Mért paraméter (°C)</label>
            <input 
              type="number" placeholder="0" 
              value={stepData.actual_temp} onChange={e => setStepData({...stepData, actual_temp: e.target.value})}
              className="w-full bg-black/50 border-2 border-gray-800 rounded-[2.5rem] p-10 text-white text-7xl font-black text-center focus:border-amber-500 transition-all outline-none shadow-inner" 
            />
          </div>
          <div className="md:col-span-2 space-y-4">
            <label className="text-[12px] font-black text-gray-500 uppercase ml-6 tracking-widest">Pék észrevételei</label>
            <textarea 
              placeholder="Pl. a tészta állaga, környezet..." 
              value={stepData.notes} onChange={e => setStepData({...stepData, notes: e.target.value})}
              className="w-full h-full bg-black/50 border-2 border-gray-800 rounded-[2.5rem] p-10 text-white text-2xl font-bold outline-none focus:border-amber-500 transition-all shadow-inner"
              rows={2}
            />
          </div>
        </div>

        <button 
          onClick={handleNextStep}
          disabled={isSubmitting}
          className={`w-full mt-12 py-12 rounded-[3rem] font-black text-5xl uppercase transition-all shadow-[0_20px_60px_rgba(0,0,0,0.4)] active:scale-[0.97] ${isOverdue ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-amber-600 hover:bg-amber-500 text-black'}`}
        >
          {isSubmitting ? 'SZINKRONIZÁLÁS...' : (currentStepIndex < steps.length - 1 ? 'LÉPÉS BEFEJEZÉSE' : 'GYÁRTÁS LEZÁRÁSA')}
        </button>
      </div>
    </div>
  )
}