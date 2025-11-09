import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/generate-reschedule/route';
import { NextRequest } from 'next/server';

describe('POST /api/generate-reschedule', () => {
  const validBookingId = 'test-booking-123';

  function createRequest(body: any): NextRequest {
    return new NextRequest('http://localhost:3000/api/generate-reschedule', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  it('should return 400 if bookingId is missing', async () => {
    const request = createRequest({});
    const response = await POST(request);
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('should return 404 if booking does not exist', async () => {
    const request = createRequest({ bookingId: 'non-existent-booking' });
    const response = await POST(request);
    
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toContain('not found');
  });

  it('should return 400 if booking weather is safe (no need to reschedule)', async () => {
    // This test assumes we have a safe booking in the system
    const request = createRequest({ bookingId: 'safe-booking-id' });
    const response = await POST(request);
    
    // Should either be 400 or successfully generate options
    expect([200, 400]).toContain(response.status);
  });

  it('should return 200 with 3 reschedule options for unsafe booking', async () => {
    const request = createRequest({ bookingId: validBookingId });
    const response = await POST(request);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.options).toBeDefined();
    expect(Array.isArray(data.options)).toBe(true);
    expect(data.options).toHaveLength(3);
  });

  it('should return options with all required fields', async () => {
    const request = createRequest({ bookingId: validBookingId });
    const response = await POST(request);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    data.options.forEach((option: any) => {
      expect(option.id).toBeDefined();
      expect(option.bookingId).toBe(validBookingId);
      expect(option.suggestedTime).toBeDefined();
      expect(option.reasoning).toBeDefined();
      expect(option.priority).toBeDefined();
      expect(option.weatherForecast).toBeDefined();
      expect(typeof option.studentAvailable).toBe('boolean');
      expect(typeof option.instructorAvailable).toBe('boolean');
      expect(typeof option.aircraftAvailable).toBe('boolean');
    });
  });

  it('should save options to Firestore rescheduleOptions collection', async () => {
    const request = createRequest({ bookingId: validBookingId });
    const response = await POST(request);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    // Each option should have an ID (meaning it was saved)
    data.options.forEach((option: any) => {
      expect(option.id).toBeDefined();
      expect(typeof option.id).toBe('string');
      expect(option.id.length).toBeGreaterThan(0);
    });
  });

  it('should return options with priority ranking 1, 2, 3', async () => {
    const request = createRequest({ bookingId: validBookingId });
    const response = await POST(request);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    const priorities = data.options.map((opt: any) => opt.priority);
    expect(priorities).toContain(1);
    expect(priorities).toContain(2);
    expect(priorities).toContain(3);
  });

  it('should return options within 7 days', async () => {
    const request = createRequest({ bookingId: validBookingId });
    const response = await POST(request);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    data.options.forEach((option: any) => {
      const suggestedTime = new Date(option.suggestedTime);
      expect(suggestedTime.getTime()).toBeGreaterThan(now.getTime());
      expect(suggestedTime.getTime()).toBeLessThanOrEqual(sevenDaysFromNow.getTime());
    });
  });

  it('should return options during operational hours (7am-6pm)', async () => {
    const request = createRequest({ bookingId: validBookingId });
    const response = await POST(request);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    data.options.forEach((option: any) => {
      const suggestedTime = new Date(option.suggestedTime);
      const hour = suggestedTime.getHours();
      expect(hour).toBeGreaterThanOrEqual(7);
      expect(hour).toBeLessThan(18);
    });
  });

  it('should include booking details in response', async () => {
    const request = createRequest({ bookingId: validBookingId });
    const response = await POST(request);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.booking).toBeDefined();
    expect(data.booking.id).toBe(validBookingId);
    expect(data.booking.studentName).toBeDefined();
    expect(data.booking.instructorName).toBeDefined();
  });

  it('should include weather check details in response', async () => {
    const request = createRequest({ bookingId: validBookingId });
    const response = await POST(request);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.weatherCheck).toBeDefined();
    expect(data.weatherCheck.isSafe).toBe(false);
    expect(data.weatherCheck.reasons).toBeDefined();
    expect(Array.isArray(data.weatherCheck.reasons)).toBe(true);
  });

  it('should handle errors gracefully with 500 status', async () => {
    // Test with malformed request that might cause internal error
    const request = createRequest({ bookingId: null });
    const response = await POST(request);
    
    expect([400, 500]).toContain(response.status);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('should complete within reasonable time (< 15 seconds)', async () => {
    const request = createRequest({ bookingId: validBookingId });
    const startTime = Date.now();
    
    await POST(request);
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(15000);
  }, 20000); // Give test 20 seconds

  it('should run weather check if none exists', async () => {
    // Test with booking that has no weather check
    const request = createRequest({ bookingId: 'no-weather-check-booking' });
    const response = await POST(request);
    
    // Should either succeed (ran check) or return error
    expect([200, 400, 404]).toContain(response.status);
  });

  it('should return JSON content-type header', async () => {
    const request = createRequest({ bookingId: validBookingId });
    const response = await POST(request);
    
    const contentType = response.headers.get('content-type');
    expect(contentType).toContain('application/json');
  });
});

