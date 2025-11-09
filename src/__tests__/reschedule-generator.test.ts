import { describe, it, expect, beforeEach } from 'vitest';
import { generateRescheduleOptions } from '@/lib/reschedule-generator';
import { Booking, WeatherCheck } from '@/types';

describe('Reschedule Generator', () => {
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
    reasons: ['Wind speed 15kt exceeds student pilot maximum of 10kt', 'Ceiling 2000ft below student minimum of 3000ft'],
  };

  it('should generate exactly 3 reschedule options', async () => {
    const options = await generateRescheduleOptions(mockBooking, mockWeatherCheck);
    
    expect(options).toHaveLength(3);
  });

  it('should prioritize options 1, 2, 3', async () => {
    const options = await generateRescheduleOptions(mockBooking, mockWeatherCheck);
    
    expect(options[0].priority).toBe(1);
    expect(options[1].priority).toBe(2);
    expect(options[2].priority).toBe(3);
  });

  it('should include bookingId in all options', async () => {
    const options = await generateRescheduleOptions(mockBooking, mockWeatherCheck);
    
    options.forEach(option => {
      expect(option.bookingId).toBe(mockBooking.id);
    });
  });

  it('should generate times in the future', async () => {
    const options = await generateRescheduleOptions(mockBooking, mockWeatherCheck);
    const now = new Date();
    
    options.forEach(option => {
      expect(option.suggestedTime.getTime()).toBeGreaterThan(now.getTime());
    });
  });

  it('should generate times within 7 days', async () => {
    const options = await generateRescheduleOptions(mockBooking, mockWeatherCheck);
    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    options.forEach(option => {
      expect(option.suggestedTime.getTime()).toBeLessThanOrEqual(sevenDays.getTime());
    });
  });

  it('should generate times during operational hours (7am-6pm)', async () => {
    const options = await generateRescheduleOptions(mockBooking, mockWeatherCheck);
    
    options.forEach(option => {
      const hour = option.suggestedTime.getHours();
      expect(hour).toBeGreaterThanOrEqual(7);
      expect(hour).toBeLessThan(18);
    });
  });

  it('should include detailed reasoning for each option', async () => {
    const options = await generateRescheduleOptions(mockBooking, mockWeatherCheck);
    
    options.forEach(option => {
      expect(option.reasoning).toBeDefined();
      expect(typeof option.reasoning).toBe('string');
      expect(option.reasoning.length).toBeGreaterThan(30);
    });
  });

  it('should reasoning mention weather factors', async () => {
    const options = await generateRescheduleOptions(mockBooking, mockWeatherCheck);
    
    const hasWeatherMention = options.some(option => {
      const reasoning = option.reasoning.toLowerCase();
      return reasoning.includes('weather') || 
             reasoning.includes('wind') || 
             reasoning.includes('ceiling') ||
             reasoning.includes('condition');
    });
    
    expect(hasWeatherMention).toBe(true);
  });

  it('should reasoning mention training level for student pilots', async () => {
    const options = await generateRescheduleOptions(mockBooking, mockWeatherCheck);
    
    const hasTrainingLevelMention = options.some(option => {
      const reasoning = option.reasoning.toLowerCase();
      return reasoning.includes('student') || reasoning.includes('training');
    });
    
    expect(hasTrainingLevelMention).toBe(true);
  });

  it('should include weather forecast for each option', async () => {
    const options = await generateRescheduleOptions(mockBooking, mockWeatherCheck);
    
    options.forEach(option => {
      expect(option.weatherForecast).toBeDefined();
      expect(typeof option.weatherForecast).toBe('string');
      expect(option.weatherForecast.length).toBeGreaterThan(5);
    });
  });

  it('should mark availability flags for all options', async () => {
    const options = await generateRescheduleOptions(mockBooking, mockWeatherCheck);
    
    options.forEach(option => {
      expect(typeof option.studentAvailable).toBe('boolean');
      expect(typeof option.instructorAvailable).toBe('boolean');
      expect(typeof option.aircraftAvailable).toBe('boolean');
      
      // All should be available (that's how we generated them)
      expect(option.studentAvailable).toBe(true);
      expect(option.instructorAvailable).toBe(true);
      expect(option.aircraftAvailable).toBe(true);
    });
  });

  it('should handle instrument pilot bookings differently', async () => {
    const instrumentBooking = { 
      ...mockBooking, 
      trainingLevel: 'instrument' as const,
      studentName: 'Ryan Foster',
    };
    const instrumentCheck = { 
      ...mockWeatherCheck, 
      trainingLevel: 'instrument' as const 
    };
    
    const options = await generateRescheduleOptions(instrumentBooking, instrumentCheck);
    
    expect(options).toHaveLength(3);
    expect(options[0].reasoning).toBeDefined();
  });

  it('should handle commercial pilot bookings', async () => {
    const commercialBooking = { 
      ...mockBooking, 
      trainingLevel: 'commercial' as const,
      studentName: 'Brandon Scott',
    };
    const commercialCheck = { 
      ...mockWeatherCheck, 
      trainingLevel: 'commercial' as const 
    };
    
    const options = await generateRescheduleOptions(commercialBooking, commercialCheck);
    
    expect(options).toHaveLength(3);
  });

  it('should avoid early morning slots for student pilots', async () => {
    const options = await generateRescheduleOptions(mockBooking, mockWeatherCheck);
    
    // Most slots should not be very early (before 8am)
    const veryEarlySlots = options.filter(option => {
      const hour = option.suggestedTime.getHours();
      return hour < 8;
    });
    
    expect(veryEarlySlots.length).toBeLessThanOrEqual(1); // At most 1 early slot
  });

  it('should prefer afternoon slots for student pilots', async () => {
    const options = await generateRescheduleOptions(mockBooking, mockWeatherCheck);
    
    const afternoonSlots = options.filter(option => {
      const hour = option.suggestedTime.getHours();
      return hour >= 12 && hour < 17;
    });
    
    // Should have at least 1 afternoon option
    expect(afternoonSlots.length).toBeGreaterThanOrEqual(1);
  });

  it('should include createdAt timestamp', async () => {
    const options = await generateRescheduleOptions(mockBooking, mockWeatherCheck);
    
    options.forEach(option => {
      expect(option.createdAt).toBeDefined();
      expect(option.createdAt).toBeInstanceOf(Date);
    });
  });

  it('should throw error if booking has no weather check', async () => {
    const noWeatherCheck = null as any;
    
    await expect(
      generateRescheduleOptions(mockBooking, noWeatherCheck)
    ).rejects.toThrow();
  });

  it('should complete within 10 seconds', async () => {
    const startTime = Date.now();
    await generateRescheduleOptions(mockBooking, mockWeatherCheck);
    const duration = Date.now() - startTime;
    
    expect(duration).toBeLessThan(10000); // 10 seconds
  }, 15000); // Give test 15 seconds to complete
});
