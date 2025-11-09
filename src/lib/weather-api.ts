import { WeatherConditions } from '@/types';

/**
 * OpenWeatherMap API Integration
 * Free tier: 1000 calls/day
 * API docs: 
 *   - Current: https://openweathermap.org/current
 *   - Forecast: https://openweathermap.org/forecast5
 */

const OPENWEATHER_API_KEY = process.env.OPENWEATHERMAP_API_KEY;
const OPENWEATHER_CURRENT_URL = 'https://api.openweathermap.org/data/2.5/weather';
const OPENWEATHER_FORECAST_URL = 'https://api.openweathermap.org/data/2.5/forecast';

// Cache for weather responses (10 minute TTL)
const weatherCache = new Map<string, { data: WeatherConditions; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

interface OpenWeatherResponse {
  coord: { lat: number; lon: number };
  weather: Array<{
    id: number;
    main: string;
    description: string;
  }>;
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
  };
  visibility: number; // meters
  wind: {
    speed: number; // meters/sec
    deg: number; // degrees
    gust?: number; // meters/sec
  };
  clouds: {
    all: number; // percentage
  };
  dt: number; // timestamp
}

interface OpenWeatherForecastResponse {
  list: Array<{
    dt: number; // timestamp
    main: {
      temp: number;
      feels_like: number;
      temp_min: number;
      temp_max: number;
      pressure: number;
      humidity: number;
    };
    weather: Array<{
      id: number;
      main: string;
      description: string;
    }>;
    clouds: {
      all: number; // percentage
    };
    wind: {
      speed: number; // meters/sec
      deg: number; // degrees
      gust?: number; // meters/sec
    };
    visibility: number; // meters
    pop: number; // probability of precipitation
    dt_txt: string; // "2024-01-01 12:00:00"
  }>;
}

/**
 * Fetch weather conditions for a location at a specific time
 * If targetTime is provided and is in the future, fetches forecast data
 * Otherwise fetches current weather
 * 
 * @param lat - Latitude
 * @param lon - Longitude  
 * @param targetTime - Optional target time for the flight (uses forecast if future)
 */
export async function fetchWeather(
  lat: number,
  lon: number,
  targetTime?: Date
): Promise<WeatherConditions> {
  if (!OPENWEATHER_API_KEY) {
    throw new Error('OPENWEATHER_API_KEY is not configured');
  }

  const now = new Date();
  const isFutureBooking = targetTime && targetTime > now;
  
  // Use forecast API if booking is in the future (up to 5 days)
  if (isFutureBooking) {
    const hoursAhead = (targetTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursAhead <= 120) { // 5 days = 120 hours
      console.log(`[Weather API] Fetching FORECAST for ${hoursAhead.toFixed(1)}h ahead at ${lat}, ${lon}`);
      return fetchForecastWeather(lat, lon, targetTime);
    } else {
      console.log(`[Weather API] Booking too far in future (${hoursAhead.toFixed(0)}h), using current weather`);
    }
  }

  // Check cache first for current weather
  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const cached = weatherCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[Weather API] Cache hit for ${cacheKey}`);
    return cached.data;
  }

  // Fetch current weather from API
  const url = new URL(OPENWEATHER_CURRENT_URL);
  url.searchParams.append('lat', lat.toString());
  url.searchParams.append('lon', lon.toString());
  url.searchParams.append('appid', OPENWEATHER_API_KEY);
  url.searchParams.append('units', 'metric'); // Celsius

  console.log(`[Weather API] Fetching CURRENT weather for ${lat}, ${lon}`);

  // Add 10 second timeout to prevent hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenWeather API error: ${response.status} - ${error}`);
    }

    const data: OpenWeatherResponse = await response.json();
    const conditions = parseWeatherResponse(data);
    
    // Cache the result
    weatherCache.set(cacheKey, { data: conditions, timestamp: Date.now() });
    
    return conditions;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OpenWeather API request timed out after 10 seconds');
    }
    throw error;
  }
}

/**
 * Fetch forecast weather for a specific time
 * Uses 5-day/3-hour forecast API and finds closest time slot
 */
async function fetchForecastWeather(
  lat: number,
  lon: number,
  targetTime: Date
): Promise<WeatherConditions> {
  const url = new URL(OPENWEATHER_FORECAST_URL);
  url.searchParams.append('lat', lat.toString());
  url.searchParams.append('lon', lon.toString());
  url.searchParams.append('appid', OPENWEATHER_API_KEY);
  url.searchParams.append('units', 'metric');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenWeather Forecast API error: ${response.status} - ${error}`);
    }

    const data: OpenWeatherForecastResponse = await response.json();
    
    // Find forecast entry closest to target time
    const targetTimestamp = targetTime.getTime();
    let closestEntry = data.list[0];
    let smallestDiff = Math.abs((closestEntry.dt * 1000) - targetTimestamp);

    for (const entry of data.list) {
      const diff = Math.abs((entry.dt * 1000) - targetTimestamp);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        closestEntry = entry;
      }
    }

    const hoursDiff = smallestDiff / (1000 * 60 * 60);
    console.log(`[Weather API] Found forecast ${hoursDiff.toFixed(1)}h from target time`);

    // Convert forecast entry to weather response format
    const weatherResponse: OpenWeatherResponse = {
      coord: { lat, lon },
      weather: closestEntry.weather,
      main: closestEntry.main,
      visibility: closestEntry.visibility,
      wind: closestEntry.wind,
      clouds: closestEntry.clouds,
      dt: closestEntry.dt,
    };

    return parseWeatherResponse(weatherResponse);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OpenWeather Forecast API request timed out after 10 seconds');
    }
    throw error;
  }
}

/**
 * Parse OpenWeatherMap API response into our WeatherConditions format
 */
function parseWeatherResponse(data: OpenWeatherResponse): WeatherConditions {
  // Convert wind speed from m/s to knots (1 m/s = 1.94384 knots)
  const windSpeedKnots = data.wind.speed * 1.94384;
  const windGustKnots = data.wind.gust ? data.wind.gust * 1.94384 : null;

  // Determine ceiling based on cloud coverage
  const ceiling = estimateCeiling(data.clouds.all);

  // Determine precipitation type
  const weatherMain = data.weather[0]?.main.toLowerCase() || 'clear';
  const { precipitationType, hasPrecipitation, hasThunderstorm } =
    categorizePrecipitation(weatherMain, data.main.temp);

  // Check for icing conditions (temperature near freezing + visible moisture)
  const hasIcing = checkIcingConditions(
    data.main.temp,
    data.main.humidity,
    hasPrecipitation
  );

  return {
    temperature: data.main.temp,
    visibility: data.visibility, // meters
    ceiling,
    windSpeed: Math.round(windSpeedKnots),
    windDirection: data.wind.deg,
    windGust: windGustKnots ? Math.round(windGustKnots) : null,
    precipitation: hasPrecipitation,
    precipitationType,
    thunderstorm: hasThunderstorm,
    icing: hasIcing,
    timestamp: new Date(data.dt * 1000),
  };
}

/**
 * Estimate ceiling based on cloud coverage percentage
 * This is an approximation since OpenWeatherMap doesn't provide exact cloud base
 */
function estimateCeiling(cloudCoverage: number): number | null {
  if (cloudCoverage < 10) {
    return null; // Clear skies (>10,000 ft)
  } else if (cloudCoverage < 50) {
    return 3500; // Scattered
  } else if (cloudCoverage < 90) {
    return 2000; // Broken
  } else {
    return 1000; // Overcast
  }
}

/**
 * Categorize precipitation type based on weather condition and temperature
 */
function categorizePrecipitation(
  weatherMain: string,
  temperature: number
): {
  precipitationType: 'none' | 'rain' | 'snow' | 'ice';
  hasPrecipitation: boolean;
  hasThunderstorm: boolean;
} {
  const hasThunderstorm = weatherMain.includes('thunderstorm');

  if (weatherMain === 'clear' || weatherMain === 'clouds') {
    return { precipitationType: 'none', hasPrecipitation: false, hasThunderstorm };
  }

  if (hasThunderstorm) {
    return { precipitationType: 'rain', hasPrecipitation: true, hasThunderstorm };
  }

  if (weatherMain.includes('snow')) {
    return { precipitationType: 'snow', hasPrecipitation: true, hasThunderstorm };
  }

  if (weatherMain.includes('rain') || weatherMain.includes('drizzle')) {
    return { precipitationType: 'rain', hasPrecipitation: true, hasThunderstorm };
  }

  // Freezing rain or sleet
  if (temperature < 0 && weatherMain.includes('rain')) {
    return { precipitationType: 'ice', hasPrecipitation: true, hasThunderstorm };
  }

  return { precipitationType: 'none', hasPrecipitation: false, hasThunderstorm };
}

/**
 * Check for icing conditions
 * Icing occurs when temperature is between 0-10°C with visible moisture
 */
function checkIcingConditions(
  temperature: number,
  humidity: number,
  hasPrecipitation: boolean
): boolean {
  const inIcingTemperatureRange = temperature >= -10 && temperature <= 10;
  const hasVisibleMoisture = humidity > 80 || hasPrecipitation;

  return inIcingTemperatureRange && hasVisibleMoisture;
}

/**
 * Calculate crosswind component given wind direction, speed, and runway heading
 * Returns crosswind in knots
 */
export function calculateCrosswind(
  windDirection: number,
  windSpeed: number,
  runwayHeading: number
): number {
  // Calculate angular difference
  let angleDiff = Math.abs(windDirection - runwayHeading);

  // Normalize to 0-180 degrees
  if (angleDiff > 180) {
    angleDiff = 360 - angleDiff;
  }

  // Crosswind component = wind speed * sin(angle)
  const crosswind = Math.abs(windSpeed * Math.sin((angleDiff * Math.PI) / 180));

  return Math.round(crosswind);
}

/**
 * Get predominant runway heading for common airports
 * In production, this would come from booking data
 */
export function getRunwayHeading(airportCode: string): number {
  const runways: Record<string, number> = {
    KJFK: 310, // Runway 31L
    KLAX: 240, // Runway 24R
    KORD: 280, // Runway 28R
    KDFW: 180, // Runway 18R
  };

  return runways[airportCode] || 360; // Default to north
}

