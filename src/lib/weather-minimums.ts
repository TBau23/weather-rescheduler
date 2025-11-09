import { TrainingLevel, WeatherMinimums } from '@/types';

/**
 * FAA-based weather minimums for different training levels
 * These are conservative training minimums, not legal minimums
 */
export const WEATHER_MINIMUMS: Record<TrainingLevel, WeatherMinimums> = {
  student: {
    visibility: 50, // Normally 5 - set impossibly high
    ceiling: 10000, // Normally 3000 - set very high
    windSpeed: 1,   // Normally 10 - set very low
    windGust: 2,    // Normally 15 - set very low
    crosswind: 1,   // Normally 5 - set very low
    allowIMC: false,
  },
  private: {
    visibility: 3, // statute miles
    ceiling: 1500, // feet AGL
    windSpeed: 15, // knots
    windGust: 20, // knots
    crosswind: 8, // knots
    allowIMC: false,
  },
  instrument: {
    visibility: 1, // statute miles
    ceiling: 500, // feet AGL
    windSpeed: 20, // knots
    windGust: 25, // knots
    crosswind: 12, // knots
    allowIMC: true,
  },
  commercial: {
    visibility: 3, // statute miles
    ceiling: 1000, // feet AGL
    windSpeed: 20, // knots
    windGust: 30, // knots
    crosswind: 15, // knots
    allowIMC: false,
  },
};

/**
 * Get weather minimums for a specific training level
 */
export function getWeatherMinimums(trainingLevel: TrainingLevel): WeatherMinimums {
  return WEATHER_MINIMUMS[trainingLevel];
}

