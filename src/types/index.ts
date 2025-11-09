// Student Training Levels
export type TrainingLevel = 'student' | 'private' | 'instrument' | 'commercial';

// Booking Status
export type BookingStatus = 'scheduled' | 'conflict' | 'rescheduled' | 'confirmed' | 'cancelled';

// Student Interface
export interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  trainingLevel: TrainingLevel;
  createdAt: Date;
  updatedAt: Date;
}

// Booking Interface
export interface Booking {
  id: string;
  studentId: string;
  studentName: string;
  instructorName: string;
  aircraftId: string;
  scheduledTime: Date;
  duration: number; // in minutes
  location: {
    name: string;
    lat: number;
    lon: number;
  };
  status: BookingStatus;
  trainingLevel: TrainingLevel;
  createdAt: Date;
  updatedAt: Date;
}

// Weather Conditions
export interface WeatherConditions {
  temperature: number; // Celsius
  visibility: number; // meters
  ceiling: number | null; // feet (null if clear)
  windSpeed: number; // knots
  windDirection: number; // degrees
  windGust: number | null; // knots
  precipitation: boolean;
  precipitationType: 'none' | 'rain' | 'snow' | 'ice';
  thunderstorm: boolean;
  icing: boolean;
  timestamp: Date;
}

// Weather Check Result
export interface WeatherCheck {
  id: string;
  bookingId: string;
  checkTime: Date;
  conditions: WeatherConditions;
  isSafe: boolean;
  trainingLevel: TrainingLevel;
  reasons: string[];
}

// Reschedule Option
export interface RescheduleOption {
  id: string;
  bookingId: string;
  suggestedTime: Date;
  reasoning: string;
  priority: number; // 1 = highest, 3 = lowest
  studentAvailable: boolean;
  instructorAvailable: boolean;
  aircraftAvailable: boolean;
  weatherForecast: string;
  createdAt: Date;
}

// Notification
export interface Notification {
  id: string;
  bookingId: string;
  studentId: string;
  type: 'weather_alert' | 'reschedule_options' | 'confirmation';
  recipientEmail: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  status: 'pending' | 'sent' | 'failed' | 'bounced';
  resendMessageId?: string;
  error?: string;
  sentAt?: Date;
  createdAt: Date;
}

// Email Send Result
export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Weather Minimums by Training Level
export interface WeatherMinimums {
  visibility: number; // statute miles
  ceiling: number; // feet AGL
  windSpeed: number; // knots
  windGust: number; // knots
  crosswind: number; // knots
  allowIMC: boolean; // Instrument Meteorological Conditions
}

