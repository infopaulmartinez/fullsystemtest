// Weather API wrapper for the WeatherAPI.com service
import axios from 'axios';
import { supabase } from './supabase';

// Get API key from environment variable or settings table
const getApiKey = async (): Promise<string> => {
  try {
    // Try to get API key from settings table
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('category', 'weather')
      .eq('key', 'api_key')
      .single();
    
    if (error || !data) {
      console.warn('Could not get API key from settings, using environment variable');
      return import.meta.env.VITE_WEATHER_API_KEY || 'b1b15e88fa797225412429c1c50c122a';
    }
    
    // Parse the value (it's stored as a JSON string)
    try {
      const apiKey = JSON.parse(data.value);
      return apiKey;
    } catch (e) {
      // If parsing fails, return the raw value
      return data.value;
    }
  } catch (error) {
    console.error('Error getting API key:', error);
    return import.meta.env.VITE_WEATHER_API_KEY || 'b1b15e88fa797225412429c1c50c122a';
  }
};

/**
 * Get current weather and forecast for a location
 * @param location Location name or coordinates
 * @param days Number of days for forecast (1-10)
 * @returns Weather data or error
 */
export const getWeather = async (location: string, days: number = 5) => {
  try {
    const apiKey = await getApiKey();

    if (!apiKey) {
      throw new Error('Hiányzó API kulcs');
    }

    // Mock data for development to avoid API calls
    return {
      success: true,
      data: {
        location: {
          name: location,
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
          uv: 5
        },
        forecast: {
          forecastday: Array(days).fill(0).map((_, i) => ({
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
    };
  } catch (error: any) {
    console.error('Weather API error:', error);
    
    // Handle different error types
    if (error.response) {
      // The server responded with an error status
      return {
        success: false,
        error: `API hiba: ${error.response.status} - ${error.response.data?.error?.message || 'Ismeretlen hiba'}`
      };
    } else if (error.request) {
      // The request was made but no response was received
      return {
        success: false,
        error: 'Nem érkezett válasz a szervertől. Ellenőrizze az internetkapcsolatot.'
      };
    } else {
      // Something else happened
      return {
        success: false,
        error: `Hiba: ${error.message}`
      };
    }
  }
};

/**
 * Get weather alerts for a location
 * @param location Location name or coordinates
 * @returns Weather alerts or error
 */
export const getWeatherAlerts = async (location: string) => {
  try {
    const apiKey = await getApiKey();
    
    if (!apiKey) {
      throw new Error('Hiányzó API kulcs');
    }
    
    const response = await axios.get('https://api.weatherapi.com/v1/forecast.json', {
      params: {
        key: apiKey,
        q: location,
        days: 1,
        aqi: 'no',
        alerts: 'yes'
      }
    });
    
    return {
      success: true,
      alerts: response.data.alerts
    };
  } catch (error: any) {
    console.error('Weather API error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};