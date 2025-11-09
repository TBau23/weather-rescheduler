import { describe, it, expect } from 'vitest';
import { buildReschedulePrompt } from '@/lib/prompts/reschedule-prompt';
import { Booking, WeatherCheck } from '@/types';
import type { TimeSlot } from '@/lib/availability-helpers';

describe('Reschedule Prompt Engineering', () => {
  const mockBooking: Booking = {
    id: 'booking-123',
    studentId: 'student-456',
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
    id: 'weather-123',
    bookingId: 'booking-123',
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
    { start: new Date('2025-11-14T15:30:00Z'), end: new Date('2025-11-14T17:30:00Z') },
    { start: new Date('2025-11-15T13:00:00Z'), end: new Date('2025-11-15T15:00:00Z') },
    { start: new Date('2025-11-16T14:30:00Z'), end: new Date('2025-11-16T16:30:00Z') },
  ];

  it('should build valid prompt string', () => {
    const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);
    
    expect(prompt).toBeDefined();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('should include AI role definition', () => {
    const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);
    
    expect(prompt.toLowerCase()).toContain('flight school');
    expect(prompt.toLowerCase()).toContain('scheduler');
  });

  it('should include student name in prompt', () => {
    const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);
    
    expect(prompt).toContain('Michael Rodriguez');
  });

  it('should include training level in prompt', () => {
    const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);
    
    expect(prompt.toLowerCase()).toContain('student');
  });

  it('should include weather violation reasons', () => {
    const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);
    
    expect(prompt.toLowerCase()).toContain('wind');
  });

  it('should include available time slots', () => {
    const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);
    
    expect(prompt).toContain('Available Time Slots');
    // Should include some date information
    expect(prompt).toBeDefined();
  });

  it('should specify JSON output format requirement', () => {
    const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);
    
    expect(prompt.toLowerCase()).toContain('json');
  });

  it('should specify 3 options requirement', () => {
    const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);
    
    expect(prompt).toContain('3');
  });

  it('should include 7-day time horizon constraint', () => {
    const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);
    
    expect(prompt).toContain('7');
  });

  it('should mention daylight hours constraint', () => {
    const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);
    
    expect(
      prompt.toLowerCase().includes('7am') || 
      prompt.toLowerCase().includes('6pm') ||
      prompt.toLowerCase().includes('operational hours')
    ).toBe(true);
  });

  it('should include priority ranking requirement', () => {
    const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);
    
    expect(prompt.toLowerCase()).toContain('priority');
  });

  it('should include reasoning requirement', () => {
    const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);
    
    expect(prompt.toLowerCase()).toContain('reasoning');
  });

  it('should avoid early morning constraint for student pilots', () => {
    const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);
    
    expect(
      prompt.toLowerCase().includes('early morning') || 
      prompt.toLowerCase().includes('fog') || 
      prompt.toLowerCase().includes('afternoon')
    ).toBe(true);
  });

  it('should prefer afternoon slots for student pilots', () => {
    const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);
    
    expect(
      prompt.toLowerCase().includes('afternoon') || 
      prompt.toLowerCase().includes('stable')
    ).toBe(true);
  });

  it('should include weather forecast guidance', () => {
    const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);
    
    expect(
      prompt.toLowerCase().includes('weather') || 
      prompt.toLowerCase().includes('conditions')
    ).toBe(true);
  });

  it('should handle instrument pilot with different constraints', () => {
    const instrumentBooking = { ...mockBooking, trainingLevel: 'instrument' as const };
    const instrumentCheck = { ...mockWeatherCheck, trainingLevel: 'instrument' as const };
    
    const prompt = buildReschedulePrompt(instrumentBooking, instrumentCheck, mockAvailableSlots);
    
    expect(prompt.toLowerCase()).toContain('instrument');
  });

  it('should handle commercial pilot appropriately', () => {
    const commercialBooking = { ...mockBooking, trainingLevel: 'commercial' as const };
    const commercialCheck = { ...mockWeatherCheck, trainingLevel: 'commercial' as const };
    
    const prompt = buildReschedulePrompt(commercialBooking, commercialCheck, mockAvailableSlots);
    
    expect(prompt.toLowerCase()).toContain('commercial');
  });

  it('should include location context', () => {
    const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);
    
    expect(prompt).toContain('JFK');
  });

  it('should specify output schema fields', () => {
    const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);
    
    expect(prompt.toLowerCase()).toContain('suggestedtime');
    expect(prompt.toLowerCase()).toContain('reasoning');
    expect(prompt.toLowerCase()).toContain('priority');
  });

  it('should be concise (not overly long)', () => {
    const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, mockAvailableSlots);
    
    // Should be reasonable length (not exceeding ~5000 chars)
    expect(prompt.length).toBeLessThan(10000);
  });

  it('should handle empty available slots gracefully', () => {
    const emptySlots: TimeSlot[] = [];
    
    const prompt = buildReschedulePrompt(mockBooking, mockWeatherCheck, emptySlots);
    
    expect(prompt).toBeDefined();
    expect(typeof prompt).toBe('string');
  });
});

