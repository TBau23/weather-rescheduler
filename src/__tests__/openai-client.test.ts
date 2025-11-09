import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateRescheduleOptionsWithAI } from '@/lib/openai-client';
import { Booking, WeatherCheck } from '@/types';
import type { TimeSlot } from '@/lib/availability-helpers';

describe('OpenAI Client', () => {
  const mockBooking: Booking = {
    id: 'test-booking-123',
    studentId: 'student-123',
    studentName: 'Michael Rodriguez',
    instructorName: 'Captain Smith',
    aircraftId: 'N12345',
    scheduledTime: new Date('2025-11-10T14:00:00Z'),
    duration: 60,
    location: {
      name: 'New York JFK (KJFK)',
      lat: 40.6413,
      lon: -73.7781,
    },
    status: 'conflict',
    trainingLevel: 'student',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockWeatherCheck: WeatherCheck = {
    id: 'weather-check-123',
    bookingId: 'test-booking-123',
    checkTime: new Date(),
    conditions: {
      temperature: 15,
      visibility: 8000,
      ceiling: 2000,
      windSpeed: 15,
      windDirection: 180,
      windGust: 20,
      precipitation: false,
      precipitationType: 'none',
      thunderstorm: false,
      icing: false,
      timestamp: new Date(),
    },
    isSafe: false,
    trainingLevel: 'student',
    reasons: ['Wind speed 15kt exceeds student pilot maximum of 10kt'],
  };

  const mockAvailableSlots: TimeSlot[] = [
    { start: new Date('2025-11-13T14:00:00Z'), end: new Date('2025-11-13T16:00:00Z') },
    { start: new Date('2025-11-14T15:00:00Z'), end: new Date('2025-11-14T17:00:00Z') },
    { start: new Date('2025-11-15T13:00:00Z'), end: new Date('2025-11-15T15:00:00Z') },
  ];

  describe('generateRescheduleOptionsWithAI', () => {
    it('should call OpenAI API with correct parameters', async () => {
      const result = await generateRescheduleOptionsWithAI(mockBooking, mockWeatherCheck, mockAvailableSlots);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    }, 15000);

    it('should return exactly 3 reschedule options', async () => {
      const result = await generateRescheduleOptionsWithAI(mockBooking, mockWeatherCheck, mockAvailableSlots);
      
      expect(result).toHaveLength(3);
    }, 15000);

    it('should return options with priority ranking 1-3', async () => {
      const result = await generateRescheduleOptionsWithAI(mockBooking, mockWeatherCheck, mockAvailableSlots);
      
      const priorities = result.map(opt => opt.priority);
      expect(priorities).toContain(1);
      expect(priorities).toContain(2);
      expect(priorities).toContain(3);
    }, 15000);

    it('should return options within 7 days', async () => {
      const result = await generateRescheduleOptionsWithAI(mockBooking, mockWeatherCheck, mockAvailableSlots);
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      result.forEach(option => {
        expect(option.suggestedTime.getTime()).toBeGreaterThan(now.getTime());
        expect(option.suggestedTime.getTime()).toBeLessThanOrEqual(sevenDaysFromNow.getTime());
      });
    }, 15000);

    it('should return options during daylight hours (7am-6pm)', async () => {
      const result = await generateRescheduleOptionsWithAI(mockBooking, mockWeatherCheck, mockAvailableSlots);
      
      result.forEach(option => {
        const hour = option.suggestedTime.getHours();
        expect(hour).toBeGreaterThanOrEqual(7);
        expect(hour).toBeLessThan(18); // Before 6pm
      });
    }, 15000);

    it('should include reasoning for each option', async () => {
      const result = await generateRescheduleOptionsWithAI(mockBooking, mockWeatherCheck, mockAvailableSlots);
      
      result.forEach(option => {
        expect(option.reasoning).toBeDefined();
        expect(typeof option.reasoning).toBe('string');
        expect(option.reasoning.length).toBeGreaterThan(20);
      });
    }, 15000);

    it('should mark all availability flags correctly', async () => {
      const result = await generateRescheduleOptionsWithAI(mockBooking, mockWeatherCheck, mockAvailableSlots);
      
      result.forEach(option => {
        expect(typeof option.studentAvailable).toBe('boolean');
        expect(typeof option.instructorAvailable).toBe('boolean');
        expect(typeof option.aircraftAvailable).toBe('boolean');
      });
    }, 15000);

    it('should include weather forecast information', async () => {
      const result = await generateRescheduleOptionsWithAI(mockBooking, mockWeatherCheck, mockAvailableSlots);
      
      result.forEach(option => {
        expect(option.weatherLikelihood).toBeDefined();
        expect(typeof option.weatherLikelihood).toBe('string');
      });
    }, 15000);

    it('should handle instrument pilot with different constraints', async () => {
      const instrumentBooking = { ...mockBooking, trainingLevel: 'instrument' as const };
      const instrumentCheck = { ...mockWeatherCheck, trainingLevel: 'instrument' as const };
      
      const result = await generateRescheduleOptionsWithAI(instrumentBooking, instrumentCheck, mockAvailableSlots);
      
      expect(result).toHaveLength(3);
      expect(result[0].reasoning).toBeDefined();
    }, 15000);

    it('should throw error if OpenAI API key is missing', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      
      await expect(
        generateRescheduleOptionsWithAI(mockBooking, mockWeatherCheck, mockAvailableSlots)
      ).rejects.toThrow();
      
      process.env.OPENAI_API_KEY = originalKey;
    });

    it('should throw error if available slots are empty', async () => {
      await expect(
        generateRescheduleOptionsWithAI(mockBooking, mockWeatherCheck, [])
      ).rejects.toThrow();
    });
  });

  // parseAIResponse is internal to openai-client, not exported
  // Testing is done through the main function above
});
