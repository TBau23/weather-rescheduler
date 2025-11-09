import OpenAI from 'openai';
import { Booking, WeatherCheck } from '@/types';
import type { TimeSlot } from '@/lib/availability-helpers';
import { buildReschedulePrompt } from '@/lib/prompts/reschedule-prompt';

/**
 * Initialize OpenAI client
 */
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  
  return new OpenAI({
    apiKey: apiKey,
  });
}

/**
 * AI-generated reschedule option structure
 */
export interface AIRescheduleOption {
  suggestedTime: Date;
  reasoning: string;
  weatherLikelihood: string;
  priority: number;
  studentAvailable: boolean;
  instructorAvailable: boolean;
  aircraftAvailable: boolean;
}

/**
 * Response from OpenAI API
 */
interface OpenAIRescheduleResponse {
  options: Array<{
    suggestedTime: string;
    reasoning: string;
    weatherLikelihood: string;
    priority: number;
    studentAvailable: boolean;
    instructorAvailable: boolean;
    aircraftAvailable: boolean;
  }>;
}

/**
 * Generate reschedule options using OpenAI GPT-4o-mini
 * 
 * @param booking - The booking that needs rescheduling
 * @param weatherCheck - The weather check that deemed the original time unsafe
 * @param availableSlots - Time slots where student, instructor, and aircraft are all available
 * @returns Array of 3 AI-generated reschedule options
 */
export async function generateRescheduleOptionsWithAI(
  booking: Booking,
  weatherCheck: WeatherCheck,
  availableSlots: TimeSlot[]
): Promise<AIRescheduleOption[]> {
  if (!booking) {
    throw new Error('Booking is required');
  }
  
  if (!weatherCheck) {
    throw new Error('Weather check is required');
  }
  
  if (availableSlots.length === 0) {
    throw new Error('No available time slots provided. Cannot generate reschedule options.');
  }
  
  const client = getOpenAIClient();
  const prompt = buildReschedulePrompt(booking, weatherCheck, availableSlots);
  
  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7, // Balance creativity with consistency
      messages: [
        {
          role: 'system',
          content: 'You are an expert flight school scheduler. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' }, // Enable JSON mode
      max_tokens: 1000,
    });
    
    const responseContent = completion.choices[0]?.message?.content;
    
    if (!responseContent) {
      throw new Error('No response content from OpenAI');
    }
    
    // Parse AI response
    const parsedResponse = JSON.parse(responseContent) as OpenAIRescheduleResponse;
    
    if (!parsedResponse.options || !Array.isArray(parsedResponse.options)) {
      throw new Error('Invalid response format from OpenAI - missing options array');
    }
    
    if (parsedResponse.options.length !== 3) {
      throw new Error(`Expected 3 options, got ${parsedResponse.options.length}`);
    }
    
    // Convert to typed format with Date objects
    const options: AIRescheduleOption[] = parsedResponse.options.map((option, index) => {
      // Validate required fields
      if (!option.suggestedTime) {
        throw new Error(`Option ${index + 1} missing suggestedTime`);
      }
      
      if (!option.reasoning) {
        throw new Error(`Option ${index + 1} missing reasoning`);
      }
      
      if (typeof option.priority !== 'number' || option.priority < 1 || option.priority > 3) {
        throw new Error(`Option ${index + 1} has invalid priority: ${option.priority}`);
      }
      
      // Parse ISO timestamp
      let suggestedDate: Date;
      try {
        suggestedDate = new Date(option.suggestedTime);
        if (isNaN(suggestedDate.getTime())) {
          throw new Error('Invalid date');
        }
      } catch (error) {
        throw new Error(`Option ${index + 1} has invalid timestamp: ${option.suggestedTime}`);
      }
      
      // Validate suggested time is in the future
      const now = new Date();
      if (suggestedDate < now) {
        throw new Error(`Option ${index + 1} suggests a time in the past: ${suggestedDate.toISOString()}`);
      }
      
      // Validate suggested time is within 7 days
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      if (suggestedDate > sevenDaysFromNow) {
        throw new Error(`Option ${index + 1} suggests a time beyond 7 days: ${suggestedDate.toISOString()}`);
      }
      
      return {
        suggestedTime: suggestedDate,
        reasoning: option.reasoning,
        weatherLikelihood: option.weatherLikelihood || 'Unknown',
        priority: option.priority,
        studentAvailable: option.studentAvailable !== false, // Default to true
        instructorAvailable: option.instructorAvailable !== false,
        aircraftAvailable: option.aircraftAvailable !== false,
      };
    });
    
    // Sort by priority to ensure correct order
    options.sort((a, b) => a.priority - b.priority);
    
    return options;
    
  } catch (error) {
    if (error instanceof Error) {
      // Add context to error message
      throw new Error(`Failed to generate reschedule options with AI: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Test OpenAI connection
 */
export async function testOpenAIConnection(): Promise<boolean> {
  try {
    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say "OK"' }],
      max_tokens: 5,
    });
    
    return completion.choices[0]?.message?.content !== undefined;
  } catch (error) {
    console.error('OpenAI connection test failed:', error);
    return false;
  }
}

