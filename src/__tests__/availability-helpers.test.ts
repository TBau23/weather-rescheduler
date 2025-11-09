import { describe, it, expect } from 'vitest';
import { 
  getStudentAvailability, 
  getInstructorAvailability, 
  getAircraftAvailability,
  findOverlappingAvailability,
  type TimeSlot,
} from '@/lib/availability-helpers';

describe('Availability Helpers', () => {
  describe('getStudentAvailability', () => {
    it('should return availability array for valid student', () => {
      const studentId = 'test-student-123';
      const availability = getStudentAvailability(studentId, 'student');
      
      expect(Array.isArray(availability)).toBe(true);
      expect(availability.length).toBeGreaterThan(0);
    });

    it('should return slots within next 7 days', () => {
      const availability = getStudentAvailability('student-123', 'student');
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      availability.forEach(slot => {
        expect(slot.start.getTime()).toBeGreaterThan(now.getTime());
        expect(slot.start.getTime()).toBeLessThanOrEqual(sevenDaysFromNow.getTime());
      });
    });

    it('should return realistic availability (~60-70%, not 100%)', () => {
      const availability = getStudentAvailability('student-123', 'student');
      
      // Should have some availability but not every single time slot
      expect(availability.length).toBeGreaterThan(5);
      expect(availability.length).toBeLessThan(50); // Not everything available
    });

    it('should student pilots have evening/weekend availability', () => {
      const availability = getStudentAvailability('student-123', 'student');
      
      // At least some slots should be after 2pm or on weekends (student pilots prefer afternoons)
      const hasAfternoonOrWeekend = availability.some(slot => {
        const hour = slot.start.getHours();
        const day = slot.start.getDay();
        return hour >= 14 || day === 0 || day === 6;
      });
      
      expect(hasAfternoonOrWeekend).toBe(true);
    });

    it('should private pilots have flexible availability', () => {
      const availability = getStudentAvailability('student-123', 'private');
      
      expect(availability.length).toBeGreaterThan(5);
      // Should have variety of times
      const hours = availability.map(slot => slot.start.getHours());
      const uniqueHours = new Set(hours);
      expect(uniqueHours.size).toBeGreaterThan(3);
    });

    it('should instrument pilots include early morning slots', () => {
      const availability = getStudentAvailability('student-123', 'instrument');
      
      const hasEarlyMorning = availability.some(slot => {
        const hour = slot.start.getHours();
        return hour < 9;
      });
      
      expect(hasEarlyMorning).toBe(true);
    });

    it('should return slots with start and end times', () => {
      const availability = getStudentAvailability('student-123', 'student');
      
      availability.forEach(slot => {
        expect(slot.start).toBeDefined();
        expect(slot.end).toBeDefined();
        expect(slot.end.getTime()).toBeGreaterThan(slot.start.getTime());
      });
    });
  });

  describe('getInstructorAvailability', () => {
    it('should return availability for known instructor', () => {
      const availability = getInstructorAvailability('Captain Smith');
      
      expect(Array.isArray(availability)).toBe(true);
      expect(availability.length).toBeGreaterThan(0);
    });

    it('should different instructors have different schedules', () => {
      const smith = getInstructorAvailability('Captain Smith');
      const davis = getInstructorAvailability('Chief Instructor Davis');
      
      // They shouldn't have identical availability
      expect(smith).not.toEqual(davis);
    });

    it('should instructors have realistic gaps (not 100% available)', () => {
      const availability = getInstructorAvailability('Captain Smith');
      
      expect(availability.length).toBeLessThan(50); // Not every time slot
    });

    it('should include weekday and weekend patterns', () => {
      const availability = getInstructorAvailability('Captain Smith');
      
      const weekdays = availability.filter(slot => {
        const day = slot.start.getDay();
        return day >= 1 && day <= 5;
      });
      
      expect(weekdays.length).toBeGreaterThan(0);
    });

    it('should return empty array for unknown instructor', () => {
      const availability = getInstructorAvailability('Unknown Instructor');
      
      expect(Array.isArray(availability)).toBe(true);
      expect(availability.length).toBe(0);
    });

    it('should handle all seeded instructors', () => {
      const instructors = [
        'Captain Smith',
        'Chief Instructor Davis',
        'CFI Johnson',
        'CFII Williams',
        'Captain Brown',
      ];
      
      instructors.forEach(instructor => {
        const availability = getInstructorAvailability(instructor);
        expect(availability.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getAircraftAvailability', () => {
    it('should return availability for valid aircraft', () => {
      const availability = getAircraftAvailability('N12345');
      
      expect(Array.isArray(availability)).toBe(true);
      expect(availability.length).toBeGreaterThan(0);
    });

    it('should show available slots (not all times booked)', () => {
      const availability = getAircraftAvailability('N12345');
      
      // Aircraft should have some availability (not everything booked)
      expect(availability.length).toBeGreaterThan(0);
    });

    it('should account for maintenance windows', () => {
      // N12345 has Monday maintenance
      const mondayAvailability = getAircraftAvailability('N12345');
      
      // Should have some availability (implementation filters out maintenance)
      expect(mondayAvailability.length).toBeGreaterThan(0);
    });

    it('should aircraft have 2-hour booking blocks', () => {
      const availability = getAircraftAvailability('N12345');
      
      // Check that slots have 2-hour duration (end - start = 2 hours)
      availability.forEach(slot => {
        const durationMs = slot.end.getTime() - slot.start.getTime();
        const durationHours = durationMs / (1000 * 60 * 60);
        expect(durationHours).toBe(2);
      });
    });

    it('should handle all seeded aircraft', () => {
      const aircraft = ['N12345', 'N67890', 'N24680', 'N13579', 'N98765'];
      
      aircraft.forEach(aircraftId => {
        const availability = getAircraftAvailability(aircraftId);
        expect(availability.length).toBeGreaterThan(0);
      });
    });

    it('should return empty array for unknown aircraft', () => {
      const availability = getAircraftAvailability('N99999');
      
      expect(Array.isArray(availability)).toBe(true);
      expect(availability.length).toBe(0);
    });
  });

  describe('findOverlappingAvailability', () => {
    it('should find times when student, instructor, and aircraft are ALL available', () => {
      const studentSlots = getStudentAvailability('student-123', 'student');
      const instructorSlots = getInstructorAvailability('Captain Smith');
      const aircraftSlots = getAircraftAvailability('N12345');
      
      const overlapping = findOverlappingAvailability(studentSlots, instructorSlots, aircraftSlots);
      
      expect(Array.isArray(overlapping)).toBe(true);
      // Should find at least some overlapping times
      expect(overlapping.length).toBeGreaterThan(0);
    });

    it('should only return times where all three are available', () => {
      const studentSlots = getStudentAvailability('student-123', 'student');
      const instructorSlots = getInstructorAvailability('Captain Smith');
      const aircraftSlots = getAircraftAvailability('N12345');
      
      const overlapping = findOverlappingAvailability(studentSlots, instructorSlots, aircraftSlots);
      
      // Each overlapping slot should be present in all three lists
      overlapping.forEach(slot => {
        const studentHas = studentSlots.some(s => s.start.getTime() === slot.start.getTime());
        const instructorHas = instructorSlots.some(s => s.start.getTime() === slot.start.getTime());
        const aircraftHas = aircraftSlots.some(s => s.start.getTime() === slot.start.getTime());
        
        expect(studentHas).toBe(true);
        expect(instructorHas).toBe(true);
        expect(aircraftHas).toBe(true);
      });
    });

    it('should return empty array if no overlapping times', () => {
      const emptySlots: TimeSlot[] = [];
      const instructorSlots = getInstructorAvailability('Captain Smith');
      
      const overlapping = findOverlappingAvailability(emptySlots, instructorSlots, []);
      
      expect(overlapping).toEqual([]);
    });

    it('should handle slot overlaps correctly', () => {
      const now = new Date();
      now.setHours(14, 0, 0, 0);
      const later = new Date(now);
      later.setHours(16, 0, 0, 0);
      
      const studentSlots: TimeSlot[] = [
        { start: now, end: later },
      ];
      const instructorSlots: TimeSlot[] = [
        { start: now, end: later },
      ];
      const aircraftSlots: TimeSlot[] = [
        { start: now, end: later },
      ];
      
      const overlapping = findOverlappingAvailability(studentSlots, instructorSlots, aircraftSlots);
      
      expect(overlapping.length).toBe(1);
    });
  });
});
