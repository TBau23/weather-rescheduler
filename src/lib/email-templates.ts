import { Booking, WeatherCheck, RescheduleOption } from '@/types';

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

/**
 * Common email styles
 */
const emailStyles = `
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      background: white;
      padding: 30px 20px;
      border: 1px solid #e5e7eb;
      border-top: none;
    }
    .alert-box {
      background: #FEF2F2;
      border-left: 4px solid #DC2626;
      padding: 16px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .alert-box strong {
      color: #991B1B;
    }
    .info-box {
      background: #F3F4F6;
      padding: 16px;
      border-radius: 4px;
      margin: 16px 0;
    }
    .info-box p {
      margin: 8px 0;
    }
    .info-label {
      font-weight: bold;
      color: #4B5563;
      display: inline-block;
      width: 120px;
    }
    .cta-button {
      display: inline-block;
      background: #2563EB;
      color: white;
      padding: 12px 32px;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
      font-weight: 600;
    }
    .cta-button:hover {
      background: #1D4ED8;
    }
    .option-card {
      background: white;
      border: 2px solid #E5E7EB;
      border-radius: 8px;
      padding: 20px;
      margin: 16px 0;
    }
    .option-card.priority-1 {
      border-color: #10B981;
      background: #F0FDF4;
    }
    .option-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .option-time {
      font-size: 18px;
      font-weight: bold;
      color: #1F2937;
    }
    .priority-badge {
      background: #10B981;
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #6B7280;
      font-size: 14px;
      border-top: 1px solid #E5E7EB;
      margin-top: 20px;
    }
  </style>
`;

/**
 * Format date for email display
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/**
 * Format time for email display
 */
function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * Generate weather alert email
 */
export function generateWeatherAlertEmail(
  booking: Booking,
  weatherCheck: WeatherCheck
): EmailTemplate {
  const date = formatDate(booking.scheduledTime);
  const time = formatTime(booking.scheduledTime);
  const conditions = weatherCheck.conditions;

  const subject = `Flight Cancelled - Weather Below Minimums`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${emailStyles}
    </head>
    <body>
      <div class="header">
        <h1>⚠️ Flight Cancelled</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.9;">Weather Below Safety Minimums</p>
      </div>
      
      <div class="content">
        <p>Hello ${booking.studentName},</p>
        
        <div class="alert-box">
          <strong>Your flight scheduled for ${date} at ${time} has been cancelled due to unsafe weather conditions.</strong>
        </div>
        
        <h2 style="color: #1F2937; margin-top: 24px;">Flight Details</h2>
        <div class="info-box">
          <p><span class="info-label">Location:</span> ${booking.location.name}</p>
          <p><span class="info-label">Aircraft:</span> ${booking.aircraftId}</p>
          <p><span class="info-label">Instructor:</span> ${booking.instructorName}</p>
          <p><span class="info-label">Duration:</span> ${booking.duration} minutes</p>
        </div>
        
        <h2 style="color: #1F2937; margin-top: 24px;">Current Weather Conditions</h2>
        <div class="info-box">
          <p><span class="info-label">Visibility:</span> ${(conditions.visibility / 1609).toFixed(1)} miles</p>
          <p><span class="info-label">Ceiling:</span> ${conditions.ceiling ? conditions.ceiling + ' feet' : 'Clear'}</p>
          <p><span class="info-label">Wind:</span> ${conditions.windSpeed} knots${conditions.windGust ? ` gusting to ${conditions.windGust} knots` : ''} at ${conditions.windDirection}°</p>
          <p><span class="info-label">Temperature:</span> ${Math.round((conditions.temperature * 9/5) + 32)}°F</p>
          ${conditions.precipitation ? `<p><span class="info-label">Conditions:</span> ${conditions.precipitationType}</p>` : ''}
          ${conditions.thunderstorm ? `<p style="color: #DC2626; font-weight: bold;">⚡ Thunderstorms in area</p>` : ''}
        </div>
        
        <h2 style="color: #1F2937; margin-top: 24px;">Safety Assessment</h2>
        <div class="info-box">
          ${weatherCheck.reasons.map(reason => `<p>• ${reason}</p>`).join('')}
        </div>
        
        <p style="margin-top: 24px;">
          We'll send you alternative scheduling options shortly based on improved weather forecasts and availability.
        </p>
        
        <p style="margin-top: 16px;">
          <strong>Questions?</strong> Contact your instructor ${booking.instructorName} or our scheduling team.
        </p>
      </div>
      
      <div class="footer">
        <p>Weather Rescheduler - Automated Flight Safety System</p>
        <p style="margin-top: 8px; font-size: 12px;">
          This is an automated notification. Weather checks are performed hourly.
        </p>
      </div>
    </body>
    </html>
  `;

  const text = `
FLIGHT CANCELLED - Weather Below Safety Minimums

Hello ${booking.studentName},

Your flight scheduled for ${date} at ${time} has been cancelled due to unsafe weather conditions.

FLIGHT DETAILS:
- Location: ${booking.location.name}
- Aircraft: ${booking.aircraftId}
- Instructor: ${booking.instructorName}
- Duration: ${booking.duration} minutes

CURRENT WEATHER CONDITIONS:
- Visibility: ${(conditions.visibility / 1609).toFixed(1)} miles
- Ceiling: ${conditions.ceiling ? conditions.ceiling + ' feet' : 'Clear'}
- Wind: ${conditions.windSpeed} knots${conditions.windGust ? ` gusting to ${conditions.windGust} knots` : ''} at ${conditions.windDirection}°
- Temperature: ${Math.round((conditions.temperature * 9/5) + 32)}°F
${conditions.precipitation ? `- Conditions: ${conditions.precipitationType}` : ''}
${conditions.thunderstorm ? '- WARNING: Thunderstorms in area' : ''}

SAFETY ASSESSMENT:
${weatherCheck.reasons.map(reason => `• ${reason}`).join('\n')}

We'll send you alternative scheduling options shortly based on improved weather forecasts and availability.

Questions? Contact your instructor ${booking.instructorName} or our scheduling team.

---
Weather Rescheduler - Automated Flight Safety System
This is an automated notification. Weather checks are performed hourly.
  `.trim();

  return { subject, html, text };
}

/**
 * Generate reschedule options email
 */
export function generateRescheduleOptionsEmail(
  booking: Booking,
  options: RescheduleOption[]
): EmailTemplate {
  const subject = `Reschedule Options Available for Your Cancelled Flight`;

  const optionsHtml = options
    .sort((a, b) => a.priority - b.priority)
    .map((option, index) => {
      const date = formatDate(option.suggestedTime);
      const time = formatTime(option.suggestedTime);
      const isPriority = option.priority === 1;
      
      return `
        <div class="option-card ${isPriority ? 'priority-1' : ''}">
          <div class="option-header">
            <div class="option-time">Option ${index + 1}: ${date} at ${time}</div>
            ${isPriority ? '<span class="priority-badge">RECOMMENDED</span>' : ''}
          </div>
          
          <p style="margin: 12px 0; color: #4B5563;">
            ${option.reasoning}
          </p>
          
          <div style="font-size: 14px; color: #6B7280; margin-top: 12px;">
            <p style="margin: 4px 0;">✓ ${booking.instructorName} available</p>
            <p style="margin: 4px 0;">✓ Aircraft ${booking.aircraftId} available</p>
            <p style="margin: 4px 0;">✓ Weather forecast: ${option.weatherForecast}</p>
          </div>
        </div>
      `;
    })
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${emailStyles}
    </head>
    <body>
      <div class="header">
        <h1>📅 Reschedule Options Available</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.9;">We've found alternative times for your flight</p>
      </div>
      
      <div class="content">
        <p>Hello ${booking.studentName},</p>
        
        <p>
          Based on weather forecasts and availability, we've identified the following options 
          to reschedule your cancelled flight:
        </p>
        
        <div style="margin: 24px 0;">
          ${optionsHtml}
        </div>
        
        <p style="margin-top: 24px;">
          <strong>To accept an option:</strong> Please contact your instructor ${booking.instructorName} 
          or reply to this email with your preferred time.
        </p>
        
        <p style="margin-top: 16px; color: #6B7280; font-size: 14px;">
          <em>These options are generated based on current availability and weather forecasts. 
          Please confirm as soon as possible to secure your preferred time.</em>
        </p>
      </div>
      
      <div class="footer">
        <p>Weather Rescheduler - Automated Flight Safety System</p>
        <p style="margin-top: 8px; font-size: 12px;">
          Options generated using AI-powered scheduling optimization
        </p>
      </div>
    </body>
    </html>
  `;

  const optionsText = options
    .sort((a, b) => a.priority - b.priority)
    .map((option, index) => {
      const date = formatDate(option.suggestedTime);
      const time = formatTime(option.suggestedTime);
      
      return `
OPTION ${index + 1}${option.priority === 1 ? ' (RECOMMENDED)' : ''}: ${date} at ${time}

${option.reasoning}

✓ ${booking.instructorName} available
✓ Aircraft ${booking.aircraftId} available
✓ Weather forecast: ${option.weatherForecast}
      `.trim();
    })
    .join('\n\n---\n\n');

  const text = `
RESCHEDULE OPTIONS AVAILABLE

Hello ${booking.studentName},

Based on weather forecasts and availability, we've identified the following options to reschedule your cancelled flight:

${optionsText}

TO ACCEPT AN OPTION: Please contact your instructor ${booking.instructorName} or reply to this email with your preferred time.

Note: These options are generated based on current availability and weather forecasts. Please confirm as soon as possible to secure your preferred time.

---
Weather Rescheduler - Automated Flight Safety System
Options generated using AI-powered scheduling optimization
  `.trim();

  return { subject, html, text };
}

/**
 * Generate combined weather alert + reschedule options email
 * This is the primary notification sent when a flight is cancelled due to weather
 */
export function generateWeatherAlertWithRescheduleEmail(
  booking: Booking,
  weatherCheck: WeatherCheck,
  options: RescheduleOption[]
): EmailTemplate {
  const date = formatDate(booking.scheduledTime);
  const time = formatTime(booking.scheduledTime);
  const conditions = weatherCheck.conditions;

  const subject = `Flight Cancelled - Weather Below Minimums (Reschedule Options Included)`;

  // Generate reschedule options HTML
  const optionsHtml = options
    .sort((a, b) => a.priority - b.priority)
    .map((option, index) => {
      const optionDate = formatDate(option.suggestedTime);
      const optionTime = formatTime(option.suggestedTime);
      const isPriority = option.priority === 1;
      
      return `
        <div class="option-card ${isPriority ? 'priority-1' : ''}">
          <div class="option-header">
            <div class="option-time">Option ${index + 1}: ${optionDate} at ${optionTime}</div>
            ${isPriority ? '<span class="priority-badge">RECOMMENDED</span>' : ''}
          </div>
          
          <p style="margin: 12px 0; color: #4B5563;">
            ${option.reasoning}
          </p>
          
          <div style="font-size: 14px; color: #6B7280; margin-top: 12px;">
            <p style="margin: 4px 0;">✓ ${booking.instructorName} available</p>
            <p style="margin: 4px 0;">✓ Aircraft ${booking.aircraftId} available</p>
            <p style="margin: 4px 0;">✓ Weather forecast: ${option.weatherForecast}</p>
          </div>
        </div>
      `;
    })
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${emailStyles}
    </head>
    <body>
      <div class="header">
        <h1>⚠️ Flight Cancelled - Reschedule Options Available</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.9;">Weather Below Safety Minimums</p>
      </div>
      
      <div class="content">
        <p>Hello ${booking.studentName},</p>
        
        <div class="alert-box">
          <strong>Your flight scheduled for ${date} at ${time} has been cancelled due to unsafe weather conditions.</strong>
        </div>
        
        <h2 style="color: #1F2937; margin-top: 24px;">Flight Details</h2>
        <div class="info-box">
          <p><span class="info-label">Location:</span> ${booking.location.name}</p>
          <p><span class="info-label">Aircraft:</span> ${booking.aircraftId}</p>
          <p><span class="info-label">Instructor:</span> ${booking.instructorName}</p>
          <p><span class="info-label">Duration:</span> ${booking.duration} minutes</p>
        </div>
        
        <h2 style="color: #1F2937; margin-top: 24px;">Current Weather Conditions</h2>
        <div class="info-box">
          <p><span class="info-label">Visibility:</span> ${(conditions.visibility / 1609).toFixed(1)} miles</p>
          <p><span class="info-label">Ceiling:</span> ${conditions.ceiling ? conditions.ceiling + ' feet' : 'Clear'}</p>
          <p><span class="info-label">Wind:</span> ${conditions.windSpeed} knots${conditions.windGust ? ` gusting to ${conditions.windGust} knots` : ''} at ${conditions.windDirection}°</p>
          <p><span class="info-label">Temperature:</span> ${Math.round((conditions.temperature * 9/5) + 32)}°F</p>
          ${conditions.precipitation ? `<p><span class="info-label">Conditions:</span> ${conditions.precipitationType}</p>` : ''}
          ${conditions.thunderstorm ? `<p style="color: #DC2626; font-weight: bold;">⚡ Thunderstorms in area</p>` : ''}
        </div>
        
        <h2 style="color: #1F2937; margin-top: 24px;">Safety Assessment</h2>
        <div class="info-box">
          ${weatherCheck.reasons.map(reason => `<p>• ${reason}</p>`).join('')}
        </div>
        
        <h2 style="color: #1F2937; margin-top: 32px;">📅 Recommended Reschedule Options</h2>
        <p>
          Based on weather forecasts and availability, we've identified the following options 
          to reschedule your flight:
        </p>
        
        <div style="margin: 24px 0;">
          ${optionsHtml}
        </div>
        
        <p style="margin-top: 24px;">
          <strong>To accept an option:</strong> Please contact your instructor ${booking.instructorName} 
          or reply to this email with your preferred time.
        </p>
        
        <p style="margin-top: 16px; color: #6B7280; font-size: 14px;">
          <em>These options are generated based on current availability and weather forecasts. 
          Please confirm as soon as possible to secure your preferred time.</em>
        </p>
      </div>
      
      <div class="footer">
        <p>Weather Rescheduler - Automated Flight Safety System</p>
        <p style="margin-top: 8px; font-size: 12px;">
          This is an automated notification. Weather checks are performed hourly.
        </p>
      </div>
    </body>
    </html>
  `;

  // Generate reschedule options text
  const optionsText = options
    .sort((a, b) => a.priority - b.priority)
    .map((option, index) => {
      const optionDate = formatDate(option.suggestedTime);
      const optionTime = formatTime(option.suggestedTime);
      
      return `
OPTION ${index + 1}${option.priority === 1 ? ' (RECOMMENDED)' : ''}: ${optionDate} at ${optionTime}

${option.reasoning}

✓ ${booking.instructorName} available
✓ Aircraft ${booking.aircraftId} available
✓ Weather forecast: ${option.weatherForecast}
      `.trim();
    })
    .join('\n\n---\n\n');

  const text = `
FLIGHT CANCELLED - Weather Below Safety Minimums

Hello ${booking.studentName},

Your flight scheduled for ${date} at ${time} has been cancelled due to unsafe weather conditions.

FLIGHT DETAILS:
- Location: ${booking.location.name}
- Aircraft: ${booking.aircraftId}
- Instructor: ${booking.instructorName}
- Duration: ${booking.duration} minutes

CURRENT WEATHER CONDITIONS:
- Visibility: ${(conditions.visibility / 1609).toFixed(1)} miles
- Ceiling: ${conditions.ceiling ? conditions.ceiling + ' feet' : 'Clear'}
- Wind: ${conditions.windSpeed} knots${conditions.windGust ? ` gusting to ${conditions.windGust} knots` : ''} at ${conditions.windDirection}°
- Temperature: ${Math.round((conditions.temperature * 9/5) + 32)}°F
${conditions.precipitation ? `- Conditions: ${conditions.precipitationType}` : ''}
${conditions.thunderstorm ? '- WARNING: Thunderstorms in area' : ''}

SAFETY ASSESSMENT:
${weatherCheck.reasons.map(reason => `• ${reason}`).join('\n')}

RECOMMENDED RESCHEDULE OPTIONS:

${optionsText}

TO ACCEPT AN OPTION: Please contact your instructor ${booking.instructorName} or reply to this email with your preferred time.

Note: These options are generated based on current availability and weather forecasts. Please confirm as soon as possible to secure your preferred time.

---
Weather Rescheduler - Automated Flight Safety System
This is an automated notification. Weather checks are performed hourly.
  `.trim();

  return { subject, html, text };
}

/**
 * Generate confirmation email
 */
export function generateConfirmationEmail(booking: Booking): EmailTemplate {
  const date = formatDate(booking.scheduledTime);
  const time = formatTime(booking.scheduledTime);

  const subject = `Flight Confirmed - ${date} at ${time}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${emailStyles}
    </head>
    <body>
      <div class="header">
        <h1>✅ Flight Confirmed</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.9;">Your rescheduled flight is confirmed</p>
      </div>
      
      <div class="content">
        <p>Hello ${booking.studentName},</p>
        
        <p>Great news! Your flight has been confirmed for:</p>
        
        <div style="background: #F0FDF4; border: 2px solid #10B981; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #065F46; margin-bottom: 8px;">
            ${date}
          </div>
          <div style="font-size: 20px; color: #047857;">
            ${time}
          </div>
        </div>
        
        <h2 style="color: #1F2937; margin-top: 24px;">Flight Details</h2>
        <div class="info-box">
          <p><span class="info-label">Location:</span> ${booking.location.name}</p>
          <p><span class="info-label">Aircraft:</span> ${booking.aircraftId}</p>
          <p><span class="info-label">Instructor:</span> ${booking.instructorName}</p>
          <p><span class="info-label">Duration:</span> ${booking.duration} minutes</p>
        </div>
        
        <h2 style="color: #1F2937; margin-top: 24px;">Before Your Flight</h2>
        <div class="info-box">
          <p>✓ Arrive 15 minutes early for pre-flight briefing</p>
          <p>✓ Bring your logbook and required documents</p>
          <p>✓ Check weather conditions before departure</p>
          <p>✓ Contact ${booking.instructorName} if you have any questions</p>
        </div>
        
        <p style="margin-top: 24px;">
          We'll continue monitoring weather conditions and notify you if any changes are needed.
        </p>
        
        <p style="margin-top: 16px;">
          <strong>See you in the sky! ✈️</strong>
        </p>
      </div>
      
      <div class="footer">
        <p>Weather Rescheduler - Automated Flight Safety System</p>
        <p style="margin-top: 8px; font-size: 12px;">
          Automated weather monitoring is active for your flight
        </p>
      </div>
    </body>
    </html>
  `;

  const text = `
FLIGHT CONFIRMED

Hello ${booking.studentName},

Great news! Your flight has been confirmed for:

${date} at ${time}

FLIGHT DETAILS:
- Location: ${booking.location.name}
- Aircraft: ${booking.aircraftId}
- Instructor: ${booking.instructorName}
- Duration: ${booking.duration} minutes

BEFORE YOUR FLIGHT:
✓ Arrive 15 minutes early for pre-flight briefing
✓ Bring your logbook and required documents
✓ Check weather conditions before departure
✓ Contact ${booking.instructorName} if you have any questions

We'll continue monitoring weather conditions and notify you if any changes are needed.

See you in the sky! ✈️

---
Weather Rescheduler - Automated Flight Safety System
Automated weather monitoring is active for your flight
  `.trim();

  return { subject, html, text };
}

