import { Booking, WeatherCheck, TrainingLevel } from '@/types';
import type { TimeSlot } from '@/lib/availability-helpers';

/**
 * Format available time slots for inclusion in the prompt
 */
export function formatAvailableSlotsForPrompt(slots: TimeSlot[]): string {
  if (slots.length === 0) {
    return 'No available slots found where student, instructor, and aircraft are all available.';
  }
  
  const formattedSlots = slots.map((slot, index) => {
    const startStr = slot.start.toISOString();
    const endStr = slot.end.toISOString();
    const dayOfWeek = slot.start.toLocaleDateString('en-US', { weekday: 'long' });
    const date = slot.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const startTime = slot.start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const endTime = slot.end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    
    return `${index + 1}. ${dayOfWeek}, ${date} from ${startTime} to ${endTime} (ISO: ${startStr})`;
  }).join('\n');
  
  return `Available Time Slots (all have student, instructor, and aircraft available):\n${formattedSlots}`;
}

/**
 * Get training level specific guidance for the AI
 */
function getTrainingLevelGuidance(trainingLevel: TrainingLevel): string {
  switch (trainingLevel) {
    case 'student':
      return `
This is a STUDENT PILOT with strict weather limitations:
- Requires 3 statute miles visibility minimum
- Requires 3000ft ceiling minimum
- Maximum winds: 10 knots
- Maximum gusts: 15 knots
- NO crosswinds over 8 knots
- NO IMC (must be VFR)
- Prefer afternoon flights (more stable conditions)
- Avoid early mornings (fog/dew risk)
- Pattern work requires excellent visibility`;
    
    case 'private':
      return `
This is a PRIVATE PILOT with moderate weather requirements:
- Requires 3 statute miles visibility minimum (VFR)
- Requires 1500ft ceiling minimum
- Maximum winds: 15 knots
- Maximum gusts: 20 knots
- Maximum crosswind: 12 knots
- NO IMC (must be VFR)
- More flexible than student pilots but still VFR-only`;
    
    case 'instrument':
      return `
This is an INSTRUMENT RATED PILOT with more flexibility:
- Can operate in IMC conditions
- Minimum visibility: 1 statute mile
- Can handle lower ceilings (down to 500ft for approaches)
- Maximum winds: 20 knots
- Maximum gusts: 25 knots
- Maximum crosswind: 15 knots
- Can fly in early morning/evening
- Training may include actual IMC practice`;
    
    case 'commercial':
      return `
This is a COMMERCIAL PILOT candidate with highest proficiency:
- Can operate in most weather conditions
- Comfortable with IMC and challenging weather
- Maximum winds: 25 knots
- Maximum gusts: 30 knots
- Maximum crosswind: 18 knots
- Most flexible scheduling
- Should still avoid thunderstorms, icing, and severe conditions`;
  }
}

/**
 * Build the complete system prompt for rescheduling
 */
export function buildReschedulePrompt(
  booking: Booking,
  weatherCheck: WeatherCheck,
  availableSlots: TimeSlot[]
): string {
  const trainingLevelGuidance = getTrainingLevelGuidance(booking.trainingLevel);
  const formattedSlots = formatAvailableSlotsForPrompt(availableSlots);
  const originalTime = booking.scheduledTime.toLocaleString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
  
  return `You are an expert flight school scheduler with deep knowledge of aviation weather minimums and training requirements.

CONTEXT:
- Student: ${booking.studentName}
- Training Level: ${booking.trainingLevel.toUpperCase()}
- Instructor: ${booking.instructorName}
- Aircraft: ${booking.aircraftId}
- Original Booking: ${originalTime}
- Location: ${booking.location.name}
- Duration: ${booking.duration} minutes

CANCELLATION REASON:
The original booking was cancelled due to unsafe weather conditions:
${weatherCheck.reasons.map(r => `- ${r}`).join('\n')}

Current weather conditions:
- Visibility: ${weatherCheck.conditions.visibility} meters (${Math.round(weatherCheck.conditions.visibility / 1609.34 * 10) / 10} statute miles)
- Ceiling: ${weatherCheck.conditions.ceiling ? `${weatherCheck.conditions.ceiling}ft` : 'Clear'}
- Wind: ${weatherCheck.conditions.windSpeed}kt from ${weatherCheck.conditions.windDirection}°${weatherCheck.conditions.windGust ? `, gusting ${weatherCheck.conditions.windGust}kt` : ''}
- Precipitation: ${weatherCheck.conditions.precipitation ? `Yes (${weatherCheck.conditions.precipitationType})` : 'No'}
- Thunderstorms: ${weatherCheck.conditions.thunderstorm ? 'Yes' : 'No'}
- Icing: ${weatherCheck.conditions.icing ? 'Yes' : 'No'}

${trainingLevelGuidance}

${formattedSlots}

YOUR TASK:
Generate 3 alternative booking times that are BETTER than the original cancelled time. You MUST:

CONSTRAINTS:
1. ONLY suggest times from the "Available Time Slots" list above
2. ALL suggestions must be within the next 7 days
3. ALL suggestions must be during operational hours (7am-6pm local time)
4. Prioritize times with historically better weather conditions
5. Consider time-of-day weather patterns:
   - Early morning: Risk of fog, dew, low visibility
   - Mid-morning to early afternoon: Generally best conditions
   - Late afternoon: Can have developing weather, thermals
   - Evening: Visibility can deteriorate
6. For student pilots, prefer afternoon times (2pm-5pm) for stable conditions
7. For instrument pilots, early morning or evening can work well
8. Avoid suggesting times immediately after the original (weather may persist)

REASONING REQUIREMENTS:
For each suggestion, provide a CONCISE explanation (2-3 sentences max):
- State the specific availability facts (instructor, aircraft available)
- Mention if it's soon vs later in the week
- Note if it's a preferred time for this training level (e.g., student pilots prefer afternoon)
- DO NOT make up weather forecasts or generic claims like "Wednesday afternoons are better"
- Keep it factual and brief

OUTPUT FORMAT:
Return a JSON array with exactly 3 options. Each option must have:
{
  "suggestedTime": "ISO 8601 timestamp from the available slots",
  "reasoning": "Brief factual explanation (2-3 sentences) about availability and timing",
  "weatherLikelihood": "Simple description (e.g., 'Typically favorable conditions for VFR flight' or 'Good for instrument training')",
  "priority": 1 (best option), 2 (good alternative), or 3 (acceptable backup),
  "studentAvailable": true,
  "instructorAvailable": true,
  "aircraftAvailable": true
}

Priority 1 should be the BEST option with optimal weather and timing.
Priority 2 should be a solid alternative.
Priority 3 should be an acceptable backup option.

IMPORTANT: Only use timestamps that EXACTLY match the start times from the "Available Time Slots" list above. Do not invent new times.

Return ONLY valid JSON in this exact format (no additional text):
{
  "options": [
    {
      "suggestedTime": "2025-11-10T14:00:00.000Z",
      "reasoning": "Chief Instructor Davis and N98765 are both available. This is 2 days from the original time, allowing weather patterns to change. Afternoon slot is ideal for student pilot training.",
      "weatherLikelihood": "Typically favorable for VFR flight",
      "priority": 1,
      "studentAvailable": true,
      "instructorAvailable": true,
      "aircraftAvailable": true
    },
    ... two more options
  ]
}`;
}

/**
 * JSON schema for OpenAI structured output
 */
export const RESCHEDULE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    options: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          suggestedTime: {
            type: 'string',
            description: 'ISO 8601 timestamp'
          },
          reasoning: {
            type: 'string',
            description: 'Detailed explanation for this suggestion'
          },
          weatherLikelihood: {
            type: 'string',
            description: 'Expected weather conditions'
          },
          priority: {
            type: 'number',
            description: '1 (best), 2 (good), or 3 (acceptable)',
            enum: [1, 2, 3]
          },
          studentAvailable: {
            type: 'boolean'
          },
          instructorAvailable: {
            type: 'boolean'
          },
          aircraftAvailable: {
            type: 'boolean'
          }
        },
        required: [
          'suggestedTime',
          'reasoning',
          'weatherLikelihood',
          'priority',
          'studentAvailable',
          'instructorAvailable',
          'aircraftAvailable'
        ]
      },
      minItems: 3,
      maxItems: 3
    }
  },
  required: ['options']
};

