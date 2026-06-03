import React, { useState, useEffect } from 'react'
import { 
  Cloud, 
  Thermometer, 
  Droplets, 
  Wind, 
  Sun, 
  Moon, 
  CloudRain, 
  CloudSnow, 
  CloudLightning, 
  CloudFog, 
  Umbrella, 
  AlertTriangle, 
  MapPin,
  Calendar,
  RefreshCw,
  Search,
  Truck,
  Route,
  Clock,
  ChefHat
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { supabase } from '../lib/supabase'

interface WeatherData {
  location: {
    name: string
    region: string
    country: string
    lat: number
    lon: number
    localtime: string
  }
  current: {
    temp_c: number
    condition: {
      text: string
      icon: string
      code: number
    }
    wind_kph: number
    wind_dir: string
    pressure_mb: number
    precip_mm: number
    humidity: number
    cloud: number
    feelslike_c: number
    vis_km: number
    uv: number
    gust_kph: number
  }
  forecast: {
    forecastday: Array<{
      date: string
      day: {
        maxtemp_c: number
        mintemp_c: number
        avgtemp_c: number
        maxwind_kph: number
        totalprecip_mm: number
        totalsnow_cm: number
        avgvis_km: number
        avghumidity: number
        daily_will_it_rain: number
        daily_chance_of_rain: number
        daily_will_it_snow: number
        daily_chance_of_snow: number
        condition: {
          text: string
          icon: string
          code: number
        }
        uv: number
      }
      astro: {
        sunrise: string
        sunset: string
        moonrise: string
        moonset: string
        moon_phase: string
        moon_illumination: string
      }
      hour: Array<{
        time: string
        temp_c: number
        condition: {
          text: string
          icon: string
          code: number
        }
        wind_kph: number
        wind_dir: string
        pressure_mb: number
        precip_mm: number
        humidity: number
        cloud: number
        feelslike_c: number
        windchill_c: number
        heatindex_c: number
        dewpoint_c: number
        will_it_rain: number
        chance_of_rain: number
        will_it_snow: number
        chance_of_snow: number
        vis_km: number
        gust_kph: number
        uv: number
      }>
    }>
  }
  alerts: {
    alert: Array<{
      headline: string
      severity: string
      urgency: string
      areas: string
      category: string
      certainty: string
      event: string
      note: string
      effective: string
      expires: string
      desc: string
      instruction: string
    }>
  }
}

interface Location {
  id: string
  name: string
  city: string
  address: string
  coordinates: {
    lat: number
    lng: number
  }
}

export default function Weather() {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [location, setLocation] = useState('Balatonszemes')
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>('Balatonszemes')
  const [deliveryImpact, setDeliveryImpact] = useState<'low' | 'medium' | 'high'>('low')
  const [productionImpact, setProductionImpact] = useState<'low' | 'medium' | 'high'>('low')
  const [alerts, setAlerts] = useState<any[]>([])
  const [apiKey, setApiKey] = useState<string>('4f8b9c2d1e6a3f7b8c9d0e1f2a3b4c5d')

  useEffect(() => {
    loadApiKey()
    loadLocations()
  }, [])

  useEffect(() => {
    if (apiKey) {
      loadWeatherData()
    }
  }, [selectedLocation, apiKey])

  const loadApiKey = async () => {
    try {
      // Try to get API key from settings table
      const { data: settingsData, error: settingsError } = await supabase
        .from('settings')
        .select('value')
        .eq('category', 'weather')
        .eq('key', 'api_key')
        .single()
      
      if (settingsError || !settingsData) {
        console.warn('Could not get API key from settings, using default');
        // Save the new API key to settings
        const { error: saveError } = await supabase
          .from('settings')
          .upsert({
            category: 'weather',
            key: 'api_key',
            value: JSON.stringify('4f8b9c2d1e6a3f7b8c9d0e1f2a3b4c5d'),
            is_public: false
          });
        
        if (saveError) {
          console.error('Error saving API key to settings:', saveError);
        }
        return
      }
      
      // Parse the value (it's stored as a JSON string)
      try {
        const apiKeyValue = JSON.parse(settingsData.value)
        setApiKey(apiKeyValue)
      } catch (e) {
        // If parsing fails, use the raw value
        setApiKey(settingsData.value)
      }
    } catch (error) {
      console.error('Error getting API key:', error)
    }
  }

  const loadLocations = async () => {
    try {
      // Load locations from database
      const { data, error } = await supabase
        .from('locations')
        .select('id, name, city, address, coordinates')
        .order('name')
      
      if (error) {
        console.error('Database error:', error)
        return
      }
      
      if (data) {
        setLocations(data)
      }
    } catch (error) {
      console.error('Hiba a helyszínek betöltésekor:', error)
    }
  }

  const loadWeatherData = async (loc = selectedLocation) => {
    try {
      setLoading(true)
      setError(null)

      // Check if API key is valid
      if (!apiKey) {
        throw new Error('API key is missing');
      }

      try {
        // Make API request to WeatherAPI.com
        const url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${loc}&days=5&aqi=no&alerts=yes`;
        // console.log('Fetching weather data from:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Weather API error response:', errorText);
          throw new Error(`Weather API error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json()
        // console.log('Weather data received:', data);
        
        setWeatherData(data)
        
        // Calculate impacts
        calculateImpacts(data)
        
        // Check for alerts
        if (data.alerts && data.alerts.alert && data.alerts.alert.length > 0) {
          setAlerts(data.alerts.alert)
        } else {
          setAlerts([])
        }
      } catch (apiError) {
        console.error('Error fetching from WeatherAPI:', apiError)
        // Use mock data if API fails
        console.log('Using mock weather data');
        const mockData = getMockWeatherData(loc)
        setWeatherData(mockData)
        calculateImpacts(mockData)
        setAlerts([])
        setError('Hiba az időjárási adatok lekérdezésekor. Próbálja újra később.')
      }
    } catch (error) {
      console.error('Hiba az időjárási adatok lekérdezésekor:', error)
      
      // Use mock data if API fails
      const mockData = getMockWeatherData(loc)
      console.log('Using mock weather data due to error');
      setWeatherData(mockData)
      try {
        calculateImpacts(mockData)
      } catch (calcError) {
        console.error('Error calculating impacts:', calcError)
      }
      setAlerts([])
      
      setError('Hiba történt az időjárási adatok lekérdezésekor. Ellenőrizze az internetkapcsolatot.')
    } finally {
      setLoading(false)
    }
  }

  const getMockWeatherData = (loc: string): WeatherData => {
    return {
      location: {
        name: loc || 'Balatonszemes',
        region: "Somogy",
        country: "Hungary",
        lat: 46.82,
        lon: 17.78,
        localtime: new Date().toISOString()
      },
      current: {
        temp_c: 22 + Math.random() * 5, 
        condition: {
          text: "Sunny",
          icon: "//cdn.weatherapi.com/weather/64x64/day/113.png",
          code: 1000
        },
        wind_kph: 10 + Math.random() * 10, 
        wind_dir: "NW",
        pressure_mb: 1015,
        precip_mm: 0,
        humidity: 60 + Math.random() * 20, 
        cloud: 10,
        feelslike_c: 23 + Math.random() * 5,
        vis_km: 10,
        uv: 5,
        gust_kph: 15 + Math.random() * 10
      },
      forecast: { 
        forecastday: Array(5).fill(0).map((_, i) => ({
          date: new Date(Date.now() + i * 86400000).toISOString().split('T')[0],
          day: {
            maxtemp_c: 24 + Math.random() * 5, 
            mintemp_c: 15 + Math.random() * 5, 
            avgtemp_c: 20 + Math.random() * 5, 
            maxwind_kph: 15 + Math.random() * 10, 
            totalprecip_mm: Math.random() * 5, 
            totalsnow_cm: 0,
            avgvis_km: 10,
            avghumidity: 65 + Math.random() * 15, 
            daily_will_it_rain: Math.random() > 0.7 ? 1 : 0, 
            daily_chance_of_rain: Math.random() > 0.7 ? Math.floor(Math.random() * 50) + 10 : 0, 
            daily_will_it_snow: 0,
            daily_chance_of_snow: 0,
            condition: {
              text: "Partly cloudy",
              icon: "//cdn.weatherapi.com/weather/64x64/day/116.png",
              code: 1003
            },
            uv: 5
          },
          astro: {
            sunrise: "05:30 AM",
            sunset: "08:30 PM",
            moonrise: "10:30 PM",
            moonset: "08:30 AM",
            moon_phase: "Waxing Gibbous",
            moon_illumination: "75"
          },
          hour: Array(24).fill(0).map((_, h) => ({ 
            time: `${new Date(Date.now() + i * 86400000).toISOString().split('T')[0]} ${h.toString().padStart(2, '0')}:00`,
            temp_c: 15 + Math.random() * 10 + (h > 6 && h < 18 ? 5 : 0),
            condition: {
              text: "Partly cloudy",
              icon: "//cdn.weatherapi.com/weather/64x64/day/116.png",
              code: 1003
            },
            wind_kph: 5 + Math.random() * 15,
            wind_dir: "NW",
            pressure_mb: 1015,
            precip_mm: Math.random() > 0.8 ? Math.random() * 2 : 0,
            humidity: 60 + Math.random() * 20,
            cloud: Math.floor(Math.random() * 100),
            feelslike_c: 16 + Math.random() * 10 + (h > 6 && h < 18 ? 5 : 0),
            windchill_c: 16 + Math.random() * 10,
            heatindex_c: 16 + Math.random() * 10,
            dewpoint_c: 10 + Math.random() * 5,
            will_it_rain: Math.random() > 0.8 ? 1 : 0,
            chance_of_rain: Math.random() > 0.8 ? Math.floor(Math.random() * 50) + 10 : 0,
            will_it_snow: 0,
            chance_of_snow: 0,
            vis_km: 10,
            gust_kph: 10 + Math.random() * 20,
            uv: 5
          }))
        }))
      },
      alerts: {
        alert: []
      }
    }
  }

  const calculateImpacts = (data: WeatherData) => {
    // Calculate delivery impact
    let deliveryImpactLevel: 'low' | 'medium' | 'high' = 'low'

    if (!data || !data.current) {
      setDeliveryImpact('low')
      setProductionImpact('low')
      return
    }
    
    // Check for severe weather conditions
    const conditionCode = data.current.condition.code
    const windSpeed = data.current.wind_kph
    const precipitation = data.current.precip_mm
    const visibility = data.current.vis_km
    
    // Severe weather codes (thunderstorms, heavy rain, snow, etc.)
    const severeWeatherCodes = [200, 201, 202, 230, 231, 232, 233, 300, 301, 302, 308, 389, 392, 395]
    
    if (severeWeatherCodes.includes(conditionCode) || windSpeed > 50 || precipitation > 10 || visibility < 2) {
      deliveryImpactLevel = 'high'
    } else if ((windSpeed > 30 && windSpeed <= 50) || (precipitation > 5 && precipitation <= 10) || (visibility >= 2 && visibility < 5)) {
      deliveryImpactLevel = 'medium'
    }
    
    setDeliveryImpact(deliveryImpactLevel)
    
    // Calculate production impact
    let productionImpactLevel: 'low' | 'medium' | 'high' = 'low'
    
    // Check for conditions that affect baking (humidity, temperature)
    const humidity = data.current.humidity
    const temperature = data.current.temp_c
    
    if (humidity > 85 || temperature > 35 || temperature < -10) {
      productionImpactLevel = 'high'
    } else if ((humidity > 75 && humidity <= 85) || (temperature > 30 && temperature <= 35) || (temperature >= -10 && temperature < 0)) {
      productionImpactLevel = 'medium'
    }
    
    setProductionImpact(productionImpactLevel)
  }

  const handleSearch = () => {
    loadWeatherData(selectedLocation)
  }
  
  // Retry loading weather data if it failed initially
  useEffect(() => {
    if (error && !loading) {
      console.log('Retrying weather data load after error');
      const retryTimer = setTimeout(() => {
        loadWeatherData(selectedLocation)
      }, 5000) // Retry after 5 seconds
      
      return () => clearTimeout(retryTimer)
    }
  }, [error, loading])

  const getWeatherIcon = (code: number, isDay: boolean = true) => {
    // Map weather condition codes to Lucide icons
    // Thunderstorm
    if ([200, 201, 202, 230, 231, 232, 233, 1087, 1273, 1276, 1279, 1282].includes(code)) {
      return <CloudLightning className="h-10 w-10 text-amber-500" />
    }
    // Drizzle or light rain
    else if ([300, 301, 302, 310, 311, 312, 313, 314, 321, 1150, 1153, 1168, 1171].includes(code)) {
      return <CloudRain className="h-10 w-10 text-blue-500" />
    }
    // Rain
    else if ([500, 501, 502, 503, 504, 511, 520, 521, 522, 531, 1180, 1183, 1186, 1189, 1192, 1195, 1198, 1201].includes(code)) {
      return <CloudRain className="h-10 w-10 text-blue-600" />
    }
    // Snow
    else if ([600, 601, 602, 611, 612, 613, 615, 616, 620, 621, 622, 1204, 1207, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1255, 1258, 1261, 1264].includes(code)) {
      return <CloudSnow className="h-10 w-10 text-blue-300" />
    }
    // Atmosphere (fog, mist, etc.)
    else if ([701, 711, 721, 731, 741, 751, 761, 762, 771, 781, 1030, 1135, 1147].includes(code)) {
      return <CloudFog className="h-10 w-10 text-gray-500" />
    }
    // Clear
    else if (code === 800 || code === 1000) {
      return isDay ? <Sun className="h-10 w-10 text-amber-500" /> : <Moon className="h-10 w-10 text-gray-300" />
    }
    // Clouds
    else if ([801, 802, 803, 804, 1003, 1006, 1009, 1030].includes(code)) {
      return <Cloud className="h-10 w-10 text-gray-500" />
    }
    // Default
    return <Cloud className="h-10 w-10 text-gray-500" />
  }

  const getImpactColor = (impact: 'low' | 'medium' | 'high') => {
    switch (impact) {
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'medium': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400'
      case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const getImpactText = (impact: 'low' | 'medium' | 'high') => {
    switch (impact) {
      case 'low': return 'Alacsony'
      case 'medium': return 'Közepes'
      case 'high': return 'Magas'
      default: return impact
    }
  }

  const getDeliveryRecommendation = (impact: 'low' | 'medium' | 'high') => {
    switch (impact) {
      case 'low':
        return 'Normál szállítási feltételek, nincs szükség különleges intézkedésekre.'
      case 'medium':
        return 'Megnövekedett szállítási idő várható. Javasolt a szállítások korábbi indítása és a sofőrök figyelmeztetése.'
      case 'high':
        return 'Jelentős szállítási nehézségek várhatók. Fontolóra kell venni a szállítások átütemezését vagy alternatív útvonalak használatát.'
      default:
        return 'Nincs elérhető ajánlás.'
    }
  }

  const getProductionRecommendation = (impact: 'low' | 'medium' | 'high') => {
    switch (impact) {
      case 'low':
        return 'Normál termelési feltételek, nincs szükség különleges intézkedésekre.'
      case 'medium':
        return 'A magas páratartalom vagy hőmérséklet befolyásolhatja a kelesztést. Javasolt a kelesztési idő és hőmérséklet módosítása.'
      case 'high':
        return 'Jelentős termelési nehézségek várhatók. Fontolóra kell venni a termelés átütemezését vagy a receptek módosítását.'
      default:
        return 'Nincs elérhető ajánlás.'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <Cloud className="h-8 w-8 mr-3 text-blue-600" />
            Időjárás
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Időjárási adatok és előrejelzések a szállítás és termelés tervezéséhez
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="Balatonszemes">Balatonszemes</option>
              <option value="Balatonszárszó">Balatonszárszó</option>
              <option value="Balatonföldvár">Balatonföldvár</option>
              <option value="Balatonmáriafürdő">Balatonmáriafürdő</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.city}>
                  {loc.city}
                </option>
              ))}
            </select>
            <button
              onClick={handleSearch}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Search className="h-5 w-5" />
            </button>
          </div>
          <button
            onClick={() => loadWeatherData(selectedLocation)}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 disabled:opacity-50 transition-all duration-200 shadow-lg shadow-blue-500/25"
          >
            <RefreshCw className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Frissítés
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-3" />
            <p className="text-red-800 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Current Weather */}
      {weatherData && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="flex items-center mb-4 md:mb-0">
              <div className="mr-4">
                {getWeatherIcon(weatherData.current.condition.code)}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {weatherData.location.name}, {weatherData.location.country}
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {new Date(weatherData.location.localtime).toLocaleString('hu-HU')}
                </p>
                <p className="text-lg font-medium text-gray-900 dark:text-white mt-1">
                  {weatherData.current.condition.text}
                </p>
              </div>
            </div>
            <div className="text-center md:text-right">
              <div className="text-4xl font-bold text-gray-900 dark:text-white">
                {weatherData.current.temp_c.toFixed(1)}°C
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Hőérzet: {weatherData.current.feelslike_c.toFixed(1)}°C
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 flex items-center">
              <Wind className="h-6 w-6 text-blue-600 mr-3" />
              <div>
                <p className="text-sm text-blue-800 dark:text-blue-300">Szél</p>
                <p className="text-lg font-medium text-blue-900 dark:text-blue-200">
                  {weatherData.current.wind_kph} km/h {weatherData.current.wind_dir}
                </p>
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 flex items-center">
              <Droplets className="h-6 w-6 text-blue-600 mr-3" />
              <div>
                <p className="text-sm text-blue-800 dark:text-blue-300">Páratartalom</p>
                <p className="text-lg font-medium text-blue-900 dark:text-blue-200">
                  {weatherData.current.humidity}%
                </p>
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 flex items-center">
              <Umbrella className="h-6 w-6 text-blue-600 mr-3" />
              <div>
                <p className="text-sm text-blue-800 dark:text-blue-300">Csapadék</p>
                <p className="text-lg font-medium text-blue-900 dark:text-blue-200">
                  {weatherData.current.precip_mm} mm
                </p>
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 flex items-center">
              <Sun className="h-6 w-6 text-blue-600 mr-3" />
              <div>
                <p className="text-sm text-blue-800 dark:text-blue-300">UV Index</p>
                <p className="text-lg font-medium text-blue-900 dark:text-blue-200">
                  {weatherData.current.uv}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Weather Alerts */}
      {alerts.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6">
          <div className="flex items-center mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600 mr-3" />
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-400">Időjárási figyelmeztetések</h3>
          </div>
          <div className="space-y-4">
            {alerts.map((alert, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-red-200 dark:border-red-800">
                <h4 className="font-medium text-red-800 dark:text-red-400">{alert.headline || alert.event}</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{alert.desc}</p>
                {alert.instruction && (
                  <p className="text-sm text-red-700 dark:text-red-300 mt-2">{alert.instruction}</p>
                )}
                <div className="flex justify-between items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>Érvényes: {new Date(alert.effective).toLocaleString('hu-HU')}</span>
                  <span>Lejár: {new Date(alert.expires).toLocaleString('hu-HU')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Impact Analysis */}
      {weatherData && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Hatáselemzés</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Truck className="h-6 w-6 text-blue-600 mr-3" />
                  <h4 className="font-medium text-gray-900 dark:text-white">Szállítási hatás</h4>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getImpactColor(deliveryImpact)}`}>
                  {getImpactText(deliveryImpact)}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {getDeliveryRecommendation(deliveryImpact)}
              </p>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <div className="flex items-center text-sm text-blue-800 dark:text-blue-300">
                  <Route className="h-4 w-4 mr-2" />
                  <span>
                    {deliveryImpact === 'high' 
                      ? 'Javasolt a szállítások átütemezése vagy alternatív útvonalak használata.' 
                      : deliveryImpact === 'medium'
                      ? 'Javasolt a szállítások korábbi indítása.'
                      : 'Normál szállítási feltételek.'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <ChefHat className="h-6 w-6 text-amber-600 mr-3" />
                  <h4 className="font-medium text-gray-900 dark:text-white">Termelési hatás</h4>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getImpactColor(productionImpact)}`}>
                  {getImpactText(productionImpact)}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {getProductionRecommendation(productionImpact)}
              </p>
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                <div className="flex items-center text-sm text-amber-800 dark:text-amber-300">
                  <Thermometer className="h-4 w-4 mr-2" />
                  <span>
                    {productionImpact === 'high' 
                      ? 'A szélsőséges időjárási körülmények jelentősen befolyásolhatják a termelést.' 
                      : productionImpact === 'medium'
                      ? 'A kelesztési és sütési paraméterek módosítása javasolt.'
                      : 'Normál termelési feltételek.'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Forecast */}
      {weatherData && weatherData.forecast && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">5 napos előrejelzés</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {weatherData.forecast.forecastday.map((day, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center">
                <p className="font-medium text-gray-900 dark:text-white mb-2">
                  {new Date(day.date).toLocaleDateString('hu-HU', { weekday: 'long' })}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  {new Date(day.date).toLocaleDateString('hu-HU')}
                </p>
                <div className="flex justify-center mb-3">
                  {getWeatherIcon(day.day.condition.code)}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {day.day.condition.text}
                </p>
                <div className="flex justify-center items-center space-x-2 mb-3">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{Math.round(day.day.maxtemp_c)}°</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{Math.round(day.day.mintemp_c)}°</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex flex-col items-center">
                    <Droplets className="h-3 w-3 text-blue-500 mb-1" />
                    <span className="text-gray-600 dark:text-gray-400">{day.day.daily_chance_of_rain}%</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Wind className="h-3 w-3 text-blue-500 mb-1" />
                    <span className="text-gray-600 dark:text-gray-400">{Math.round(day.day.maxwind_kph)} km/h</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delivery Planning */}
      {weatherData && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Szállítási tervezés</h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`p-4 rounded-xl ${
                deliveryImpact === 'low' 
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                  : deliveryImpact === 'medium'
                  ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className={`font-medium ${
                    deliveryImpact === 'low' 
                      ? 'text-green-800 dark:text-green-400' 
                      : deliveryImpact === 'medium'
                      ? 'text-amber-800 dark:text-amber-400'
                      : 'text-red-800 dark:text-red-400'
                  }`}>Mai szállítások</h4>
                  <Clock className={`h-5 w-5 ${
                    deliveryImpact === 'low' 
                      ? 'text-green-600 dark:text-green-400' 
                      : deliveryImpact === 'medium'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-red-600 dark:text-red-400'
                  }`} />
                </div>
                <p className={`text-sm ${
                  deliveryImpact === 'low' 
                    ? 'text-green-700 dark:text-green-300' 
                    : deliveryImpact === 'medium'
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-red-700 dark:text-red-300'
                }`}>
                  {deliveryImpact === 'low' 
                    ? 'Normál szállítási feltételek, nincs szükség különleges intézkedésekre.' 
                    : deliveryImpact === 'medium'
                    ? 'Megnövekedett szállítási idő várható. Javasolt a szállítások korábbi indítása.'
                    : 'Jelentős szállítási nehézségek várhatók. Fontolóra kell venni a szállítások átütemezését.'}
                </p>
              </div>
              
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-blue-800 dark:text-blue-400">Holnapi előrejelzés</h4>
                  <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                {weatherData.forecast.forecastday.length > 1 && (
                  <>
                    <div className="flex items-center mb-2">
                      {getWeatherIcon(weatherData.forecast.forecastday[1].day.condition.code, true)}
                      <div className="ml-2">
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                          {weatherData.forecast.forecastday[1].day.condition.text}
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-400">
                          {Math.round(weatherData.forecast.forecastday[1].day.maxtemp_c)}°C / {Math.round(weatherData.forecast.forecastday[1].day.mintemp_c)}°C
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      {weatherData.forecast.forecastday[1].day.daily_chance_of_rain > 50 
                        ? 'Esős időjárás várható, készüljön fel a szállítási nehézségekre.' 
                        : 'Normál szállítási feltételek várhatók.'}
                    </p>
                  </>
                )}
              </div>
              
              <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-purple-800 dark:text-purple-400">Útvonal ajánlások</h4>
                  <Route className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  {deliveryImpact === 'high'
                    ? 'Javasolt a főutak használata és a kisebb utak elkerülése a szélsőséges időjárás miatt.'
                    : 'Normál útvonalak használata javasolt, nincs szükség kerülőutakra.'}
                </p>
                <button className="mt-2 text-xs text-purple-600 dark:text-purple-400 hover:underline">
                  Útvonal optimalizálás megnyitása →
                </button>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Helyszínek időjárása</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {locations.slice(0, 4).map((loc, index) => (
                  <div key={loc.id} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-medium text-gray-900 dark:text-white">{loc.name}</h5>
                      <MapPin className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{loc.city}, {loc.address}</p>
                    <button
                      onClick={() => {
                        setSelectedLocation(loc.city)
                        loadWeatherData(loc.city)
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Időjárás megtekintése →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}