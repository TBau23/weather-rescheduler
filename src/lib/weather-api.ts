import { WeatherConditions } from '@/types';

/**
 * OpenWeatherMap API Integration
 * Free tier: 1000 calls/day
 * API docs: https://openweathermap.org/current
 */

const OPENWEATHER_API_KEY = process.env.OPENWEATHERMAP_API_KEY;
const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';

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

/**
 * Fetch current weather conditions for a location
 */
export async function fetchWeather(
  lat: number,
  lon: number
): Promise<WeatherConditions> {
  if (!OPENWEATHER_API_KEY) {
    throw new Error('OPENWEATHER_API_KEY is not configured');
  }

  // Check cache first
  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const cached = weatherCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[Weather API] Cache hit for ${cacheKey}`);
    return cached.data;
  }

  // Fetch from API
  const url = new URL(OPENWEATHER_BASE_URL);
  url.searchParams.append('lat', lat.toString());
  url.searchParams.append('lon', lon.toString());
  url.searchParams.append('appid', OPENWEATHER_API_KEY);
  url.searchParams.append('units', 'metric'); // Celsius

  console.log(`[Weather API] Fetching weather for ${lat}, ${lon}`);

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenWeather API error: ${response.status} - ${error}`);
  }

  const data: OpenWeatherResponse = await response.json();
  const conditions = parseWeatherResponse(data);

  // Cache the result
  weatherCache.set(cacheKey, { data: conditions, timestamp: Date.now() });

  return conditions;
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

