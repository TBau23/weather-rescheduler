import { TrainingLevel, WeatherConditions, WeatherMinimums } from '@/types';
import { getWeatherMinimums } from './weather-minimums';
import { calculateCrosswind } from './weather-api';

/**
 * Evaluation result with detailed reasoning
 */
export interface EvaluationResult {
  isSafe: boolean;
  violations: string[];
  hazards: string[];
  reasoning: string;
  minimums: WeatherMinimums;
  actual: {
    visibility: number; // miles
    ceiling: number | null; // feet
    windSpeed: number; // knots
    windGust: number | null; // knots
    crosswind: number; // knots
  };
}

/**
 * Evaluate weather safety based on training level minimums
 */
export function evaluateSafety(
  weather: WeatherConditions,
  trainingLevel: TrainingLevel,
  runwayHeading: number = 360
): EvaluationResult {
  const minimums = getWeatherMinimums(trainingLevel);
  const violations: string[] = [];
  const hazards: string[] = [];

  // Convert visibility from meters to statute miles (1 meter = 0.000621371 miles)
  const visibilityMiles = (weather.visibility * 0.000621371).toFixed(1);
  const visibilityNum = parseFloat(visibilityMiles);

  // Calculate crosswind component
  const crosswind = calculateCrosswind(
    weather.windDirection,
    weather.windSpeed,
    runwayHeading
  );

  // Check critical hazards first (always unsafe)
  if (weather.thunderstorm) {
    hazards.push('Thunderstorm in area - flight prohibited for all training levels');
  }

  if (weather.icing) {
    hazards.push(
      `Icing conditions detected (${weather.temperature.toFixed(1)}°C with visible moisture)`
    );
  }

  // Check visibility
  if (visibilityNum < minimums.visibility) {
    violations.push(
      `Visibility ${visibilityMiles}mi is below minimum ${minimums.visibility}mi`
    );
  }

  // Check ceiling (if present)
  if (weather.ceiling !== null && weather.ceiling < minimums.ceiling) {
    violations.push(
      `Ceiling ${weather.ceiling}ft is below minimum ${minimums.ceiling}ft`
    );
  }

  // Check IMC conditions
  const isIMC = visibilityNum < 3 || (weather.ceiling !== null && weather.ceiling < 1000);
  if (isIMC && !minimums.allowIMC) {
    violations.push(
      `IMC conditions present (${trainingLevel} pilot not authorized for IMC flight)`
    );
  }

  // Check wind speed
  if (weather.windSpeed > minimums.windSpeed) {
    violations.push(
      `Wind speed ${weather.windSpeed}kt exceeds maximum ${minimums.windSpeed}kt`
    );
  }

  // Check gusts
  if (weather.windGust !== null && weather.windGust > minimums.windGust) {
    violations.push(
      `Wind gust ${weather.windGust}kt exceeds maximum ${minimums.windGust}kt`
    );
  }

  // Check crosswind
  if (crosswind > minimums.crosswind) {
    violations.push(
      `Crosswind component ${crosswind}kt exceeds maximum ${minimums.crosswind}kt`
    );
  }

  // Check precipitation
  if (weather.precipitation) {
    if (weather.precipitationType === 'snow' || weather.precipitationType === 'ice') {
      hazards.push(`Active precipitation: ${weather.precipitationType}`);
    }
  }

  // Determine if safe
  const isSafe = violations.length === 0 && hazards.length === 0;

  // Generate reasoning
  const reasoning = generateReasoning(
    isSafe,
    trainingLevel,
    violations,
    hazards,
    minimums,
    {
      visibility: visibilityNum,
      ceiling: weather.ceiling,
      windSpeed: weather.windSpeed,
      windGust: weather.windGust,
      crosswind,
    }
  );

  return {
    isSafe,
    violations,
    hazards,
    reasoning,
    minimums,
    actual: {
      visibility: visibilityNum,
      ceiling: weather.ceiling,
      windSpeed: weather.windSpeed,
      windGust: weather.windGust,
      crosswind,
    },
  };
}

/**
 * Generate human-readable reasoning for the evaluation
 */
function generateReasoning(
  isSafe: boolean,
  trainingLevel: TrainingLevel,
  violations: string[],
  hazards: string[],
  minimums: WeatherMinimums,
  actual: {
    visibility: number;
    ceiling: number | null;
    windSpeed: number;
    windGust: number | null;
    crosswind: number;
  }
): string {
  if (isSafe) {
    return `Flight is SAFE for ${trainingLevel} pilot. Conditions are within acceptable limits: ` +
      `Visibility ${actual.visibility}mi (min ${minimums.visibility}mi), ` +
      `Ceiling ${actual.ceiling ? actual.ceiling + 'ft' : 'unlimited'} (min ${minimums.ceiling}ft), ` +
      `Wind ${actual.windSpeed}kt${actual.windGust ? `G${actual.windGust}kt` : ''} (max ${minimums.windSpeed}kt), ` +
      `Crosswind ${actual.crosswind}kt (max ${minimums.crosswind}kt).`;
  }

  let reasoning = `Flight is UNSAFE for ${trainingLevel} pilot. `;

  if (hazards.length > 0) {
    reasoning += `Critical hazards: ${hazards.join('; ')}. `;
  }

  if (violations.length > 0) {
    reasoning += `Weather minimums exceeded: ${violations.join('; ')}.`;
  }

  return reasoning;
}

/**
 * Quick check if conditions are safe (without detailed evaluation)
 */
export function isFlightSafe(
  weather: WeatherConditions,
  trainingLevel: TrainingLevel,
  runwayHeading: number = 360
): boolean {
  const evaluation = evaluateSafety(weather, trainingLevel, runwayHeading);
  return evaluation.isSafe;
}

/**
 * Get weather summary for display purposes
 */
export function getWeatherSummary(weather: WeatherConditions): string {
  const visibilityMiles = (weather.visibility * 0.000621371).toFixed(1);
  const ceilingStr = weather.ceiling ? `${weather.ceiling}ft` : 'unlimited';
  const gustStr = weather.windGust ? `G${weather.windGust}kt` : '';
  const precipStr = weather.precipitation
    ? `, ${weather.precipitationType}`
    : '';

  return `Vis: ${visibilityMiles}mi, Ceiling: ${ceilingStr}, Wind: ${weather.windSpeed}kt${gustStr} @ ${weather.windDirection}°${precipStr}`;
}

