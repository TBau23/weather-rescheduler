import { describe, it, expect } from 'vitest';
import { buildReschedulePrompt, formatAvailableSlotsForPrompt } from '@/lib/prompts/reschedule-prompt';
import { Booking, WeatherCheck } from '@/types';
import type { TimeSlot } from '@/lib/availability-helpers';

describe('Reschedule Prompt Engineering', () => {
  const mockBooking: Booking = {
    id: 'booking-123',
    studentId: 'student-123',
    studentName: 'Michael Rodriguez',
    instructorName: 'Captain Smith',
    aircraftId: 'N12345',
    scheduledTime: new Date('2025-11-10T10:00:00Z'),
    duration: 60,
    location: {
      name: 'New York JFK (KJFK)',
      lat: 40.6413,
      lon: -73.7781
    },
    status: 'conflict',
    trainingLevel: 'student',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockWeatherCheck: WeatherCheck = {
    id: 'weather-123',
    bookingId: 'booking-123',
    checkTime: new Date(),
    conditions: {
      temperature: 20,
      visibility: 3000,
      ceiling: 2000,
      windSpeed: 15,
      windDirection: 270,
      windGust: 18,
      precipitation: false,
      precipitationType: 'none',
      thunderstorm: false,
      icing: false,
      timestamp: new Date()
    },
    isSafe: false,
    trainingLevel: 'student',
    reasons: ['Ceiling too low: 2000ft (minimum: 3000ft)', 'Wind too strong: 15kt (maximum: 10kt)']
  };

  const mockAvailableSlots: TimeSlot[] = [
    {
      start: new Date('2025-11-13T14:00:00Z'),
      end: new Date('2025-11-13T16:00:00Z')
    },
    {
      start: new Date('2025-11-14T15:30:00Z'),
      end: new Date('2025-11-14T17:30:00Z')
    }
  ];

  describe('buildReschedulePrompt', () => {
    it('should return a complete prompt string', () => {
      const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);

      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(100);
    });

    it('should include student name in prompt', () => {
      const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);

      expect(prompt).toContain('Michael Rodriguez');
    });

    it('should include training level in prompt', () => {
      const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);

      expect(prompt.toLowerCase()).toContain('student');
    });

    it('should include original booking time in prompt', () => {
      const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);

      // Should mention the original date/time
      expect(prompt).toContain('2025-11-10');
    });

    it('should include location in prompt', () => {
      const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);

      expect(prompt).toContain('JFK');
    });

    it('should include weather violations in prompt', () => {
      const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);

      expect(prompt).toContain('Ceiling too low');
      expect(prompt).toContain('Wind too strong');
    });

    it('should include instructor name in prompt', () => {
      const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);

      expect(prompt).toContain('Captain Smith');
    });

    it('should include aircraft ID in prompt', () => {
      const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);

      expect(prompt).toContain('N12345');
    });

    it('should include available time slots in prompt', () => {
      const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);

      expect(prompt).toContain('2025-11-13');
      expect(prompt).toContain('2025-11-14');
    });

    it('should specify 7-day window constraint', () => {
      const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);

      expect(prompt.toLowerCase()).toContain('7 day');
    });

    it('should specify need for 3 options', () => {
      const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);

      expect(prompt).toContain('3');
    });

    it('should mention JSON output format requirement', () => {
      const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);

      expect(prompt.toLowerCase()).toContain('json');
    });

    it('should include weather minimums context for student pilots', () => {
      const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);

      // Should mention typical student pilot limitations
      expect(prompt.toLowerCase()).toMatch(/ceiling|wind|visibility/);
    });

    it('should emphasize afternoon preference for student pilots', () => {
      const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);

      expect(prompt.toLowerCase()).toMatch(/afternoon|stable condition/);
    });

    it('should adapt prompt for instrument pilots', () => {
      const instrumentBooking: Booking = {
        ...mockBooking,
        trainingLevel: 'instrument',
        studentName: 'Ryan Foster'
      };

      const instrumentWeatherCheck: WeatherCheck = {
        ...mockWeatherCheck,
        trainingLevel: 'instrument'
      };

      const prompt = buildReschedulePrompt(instrumentBooking, instrumentWeatherCheck, mockAvailableSlots);

      expect(prompt).toContain('instrument');
      expect(prompt).toContain('Ryan Foster');
    });

    it('should include role definition for AI', () => {
      const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);

      expect(prompt.toLowerCase()).toMatch(/flight school|scheduler|aviation/);
    });

    it('should specify required output fields', () => {
      const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);

      expect(prompt).toContain('suggestedTime');
      expect(prompt).toContain('reasoning');
      expect(prompt).toContain('priority');
    });
  });

  describe('formatAvailableSlotsForPrompt', () => {
    it('should format time slots as readable text', () => {
      const formatted = formatAvailableSlotsForPrompt(mockAvailableSlots);

      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });

    it('should include all available slots', () => {
      const formatted = formatAvailableSlotsForPrompt(mockAvailableSlots);

      expect(formatted).toContain('2025-11-13');
      expect(formatted).toContain('2025-11-14');
    });

    it('should format times in readable format', () => {
      const formatted = formatAvailableSlotsForPrompt(mockAvailableSlots);

      // Should include time information
      expect(formatted).toMatch(/\d{2}:\d{2}/);
    });

    it('should handle empty slots array', () => {
      const formatted = formatAvailableSlotsForPrompt([]);

      expect(typeof formatted).toBe('string');
      expect(formatted).toContain('No available slots');
    });

    it('should show start and end times for each slot', () => {
      const formatted = formatAvailableSlotsForPrompt(mockAvailableSlots);

      // Should show time ranges
      expect(formatted.toLowerCase()).toMatch(/to|until|-/);
    });
  });

  describe('Prompt Quality', () => {
    it('should have clear instructions', () => {
      const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);

      // Prompt should be structured and clear
      expect(prompt).toContain('Context');
      expect(prompt).toContain('Constraints') || expect(prompt).toContain('Requirements');
    });

    it('should specify priority ranking meaning (1=best, 3=acceptable)', () => {
      const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);

      expect(prompt).toMatch(/priority.*1.*best|1.*highest/i);
    });

    it('should emphasize weather safety', () => {
      const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);

      expect(prompt.toLowerCase()).toMatch(/safe|weather|condition/);
    });

    it('should request reasoning for each option', () => {
      const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);

      expect(prompt.toLowerCase()).toMatch(/reasoning|explain|why/);
    });

    it('should mention time-of-day weather patterns', () => {
      const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);

      expect(prompt.toLowerCase()).toMatch(/morning|afternoon|time of day/);
    });

    it('should instruct AI to only suggest from available slots', () => {
      const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);

      expect(prompt.toLowerCase()).toMatch(/only.*available|available.*time|provided.*slot/);
    });
  });

  describe('Training Level Specificity', () => {
    it('should mention student pilot limitations clearly', () => {
      const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);

      expect(prompt.toLowerCase()).toMatch(/student pilot/);
    });

    it('should handle commercial pilot differently', () => {
      const commercialBooking: Booking = {
        ...mockBooking,
        trainingLevel: 'commercial',
        studentName: 'Brandon Scott'
      };

      const prompt = buildReschedulePrompt(commercialBooking, mockWeatherCheck, mockAvailableSlots);

      expect(prompt).toContain('commercial');
    });

    it('should handle private pilot certification level', () => {
      const privateBooking: Booking = {
        ...mockBooking,
        trainingLevel: 'private',
        studentName: 'Emily Johnson'
      };

      const prompt = buildReschedulePrompt(privateBooking, mockWeatherCheck, mockAvailableSlots);

      expect(prompt).toContain('private');
    });
  });
});

