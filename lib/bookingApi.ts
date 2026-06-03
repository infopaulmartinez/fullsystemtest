import axios from 'axios';

// API kulcs a WeatherAPI-hoz
const WEATHER_API_KEY = '5b301599e54040cea5100830252806';

// Booking.com API-hoz szükséges adatok
// Valós alkalmazásban ezeket környezeti változókból kellene betölteni
const BOOKING_API_URL = 'https://demandapi.booking.com/3.1';
const BOOKING_AFFILIATE_ID = '123456'; // Példa affiliate ID
const BOOKING_API_KEY = 'your_booking_api_key'; // Példa API kulcs

// Balaton déli part városai és azonosítóik
const BALATON_SOUTH_CITIES = [
  { id: -2140479, name: 'Balatonszemes' },
  { id: -2140480, name: 'Balatonszárszó' },
  { id: -2140481, name: 'Balatonföldvár' },
  { id: -2140482, name: 'Zamárdi' },
  { id: -2140483, name: 'Siófok' },
  { id: -2140484, name: 'Balatonlelle' },
  { id: -2140485, name: 'Balatonboglár' },
  { id: -2140486, name: 'Fonyód' }
];

// Időjárás adatok lekérése
export const getWeatherData = async (location: string) => {
  try {
    const response = await axios.get(`https://api.weatherapi.com/v1/forecast.json`, {
      params: {
        key: WEATHER_API_KEY,
        q: location,
        days: 5,
        aqi: 'no',
        alerts: 'yes'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Hiba az időjárás adatok lekérésekor:', error);
    throw error;
  }
};

// Szálláshelyek keresése a Booking.com API-n keresztül
export const searchAccommodations = async (cityId: number, checkin: string, checkout: string) => {
  try {
    // Valós alkalmazásban ez egy tényleges API hívás lenne
    // Itt most mock adatokat adunk vissza
    
    // Véletlenszerű foglaltsági adatok generálása
    const occupancyRate = Math.random() * 0.5 + 0.3; // 30-80% között
    const totalRooms = Math.floor(Math.random() * 500) + 200; // 200-700 szoba
    const bookedRooms = Math.floor(totalRooms * occupancyRate);
    
    // Véletlenszerű árak generálása
    const avgPrice = Math.floor(Math.random() * 15000) + 15000; // 15000-30000 Ft
    
    // Véletlenszerű változás az előző héthez képest
    const changeFromLastWeek = Math.random() * 0.4 - 0.1; // -10% és +30% között
    
    return {
      city: BALATON_SOUTH_CITIES.find(city => city.id === cityId)?.name || 'Ismeretlen',
      cityId,
      checkin,
      checkout,
      totalRooms,
      bookedRooms,
      occupancyRate,
      avgPrice,
      changeFromLastWeek,
      forecast: {
        occupancyTrend: Math.random() > 0.5 ? 'increasing' : 'stable',
        priceTrend: Math.random() > 0.7 ? 'increasing' : 'stable',
        highDemandDays: [
          new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
          new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
          new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0]
        ]
      }
    };
  } catch (error) {
    console.error('Hiba a szálláshelyek keresésekor:', error);
    throw error;
  }
};

// Több város foglaltsági adatainak lekérése
export const getMultiCityOccupancy = async (checkin: string, checkout: string) => {
  try {
    const promises = BALATON_SOUTH_CITIES.map(city => 
      searchAccommodations(city.id, checkin, checkout)
    );
    
    return await Promise.all(promises);
  } catch (error) {
    console.error('Hiba a több város foglaltsági adatainak lekérésekor:', error);
    throw error;
  }
};

// Termelési javaslatok generálása a foglaltsági adatok alapján
export const generateProductionRecommendations = (occupancyData: any[]) => {
  // Átlagos foglaltság kiszámítása
  const avgOccupancy = occupancyData.reduce((sum, city) => sum + city.occupancyRate, 0) / occupancyData.length;
  
  // Magas foglaltságú városok azonosítása
  const highOccupancyCities = occupancyData.filter(city => city.occupancyRate > 0.6);
  
  // Növekvő trenddel rendelkező városok
  const increasingTrendCities = occupancyData.filter(city => city.forecast.occupancyTrend === 'increasing');
  
  // Javaslatok generálása
  const recommendations = [];
  
  if (avgOccupancy > 0.7) {
    recommendations.push({
      type: 'high_demand',
      title: 'Magas kereslet várható',
      description: 'A Balaton déli partján átlagosan 70% feletti a foglaltság. Javasolt a termelés növelése minden üzletben.',
      impact: 'high'
    });
  } else if (avgOccupancy > 0.5) {
    recommendations.push({
      type: 'medium_demand',
      title: 'Közepes kereslet várható',
      description: 'A Balaton déli partján átlagosan 50-70% közötti a foglaltság. Javasolt a termelés enyhe növelése.',
      impact: 'medium'
    });
  }
  
  // Városspecifikus javaslatok
  highOccupancyCities.forEach(city => {
    recommendations.push({
      type: 'city_high_demand',
      title: `Magas kereslet - ${city.city}`,
      description: `${city.city} területén ${Math.round(city.occupancyRate * 100)}%-os a szálláshelyek foglaltsága. Javasolt a helyi üzlet készletének növelése.`,
      impact: 'high',
      city: city.city
    });
  });
  
  increasingTrendCities.forEach(city => {
    if (!highOccupancyCities.find(c => c.city === city.city)) {
      recommendations.push({
        type: 'city_increasing_trend',
        title: `Növekvő kereslet - ${city.city}`,
        description: `${city.city} területén növekvő foglaltsági trend figyelhető meg. Javasolt felkészülni a megnövekedett keresletre.`,
        impact: 'medium',
        city: city.city
      });
    }
  });
  
  // Időjárás alapú javaslat (példa)
  recommendations.push({
    type: 'weather_based',
    title: 'Időjárás alapú termelés',
    description: 'A hétvégére jó idő várható, ami növelheti a turizmust. Javasolt a fagylalt és hideg italok kínálatának bővítése.',
    impact: 'medium'
  });
  
  return recommendations;
};