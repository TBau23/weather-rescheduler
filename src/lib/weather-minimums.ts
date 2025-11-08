import { TrainingLevel, WeatherMinimums } from '@/types';

/**
 * FAA-based weather minimums for different training levels
 * These are conservative training minimums, not legal minimums
 */
export const WEATHER_MINIMUMS: Record<TrainingLevel, WeatherMinimums> = {
  student: {
    visibility: 5, // statute miles
    ceiling: 3000, // feet AGL
    windSpeed: 10, // knots
    windGust: 15, // knots
    crosswind: 5, // knots
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

