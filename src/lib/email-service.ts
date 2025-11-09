import { Resend } from 'resend';
import { SendResult } from '@/types';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Configuration
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';
const DEMO_MODE = process.env.NODE_ENV === 'development';
const DEMO_EMAIL = process.env.DEMO_EMAIL;

/**
 * Send an email via Resend with demo mode support
 * In demo mode, all emails are redirected to DEMO_EMAIL with a banner indicating the original recipient
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<SendResult> {
  try {
    // Validate Resend API key
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not configured');
      return {
        success: false,
        error: 'Email service not configured (missing RESEND_API_KEY)',
      };
    }

    // In demo mode, redirect all emails to DEMO_EMAIL
    const actualRecipient = DEMO_MODE && DEMO_EMAIL ? DEMO_EMAIL : to;
    
    // Add demo mode banner to email
    const demoNote = DEMO_MODE && DEMO_EMAIL
      ? `<div style="background-color: #FEF2F2; border-left: 4px solid #DC2626; padding: 16px; margin-bottom: 24px;">
           <p style="margin: 0; color: #991B1B; font-weight: bold;">📧 DEMO MODE</p>
           <p style="margin: 4px 0 0 0; color: #7F1D1D; font-size: 14px;">
             This email would normally be sent to: <strong>${to}</strong>
           </p>
         </div>`
      : '';
    
    const finalHtml = demoNote + html;
    const finalSubject = DEMO_MODE && DEMO_EMAIL ? `[DEMO] ${subject}` : subject;

    // Validate recipient
    if (!actualRecipient || !actualRecipient.includes('@')) {
      console.error('Invalid email recipient:', actualRecipient);
      return {
        success: false,
        error: `Invalid email recipient: ${actualRecipient}`,
      };
    }

    console.log(`Sending email to ${actualRecipient}${DEMO_MODE ? ` (original: ${to})` : ''}`);
    console.log(`Subject: ${finalSubject}`);

    // Send email via Resend
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: actualRecipient,
      subject: finalSubject,
      html: finalHtml,
      text: text,
    });

    console.log('Email sent successfully:', result.id);

    return {
      success: true,
      messageId: result.id,
    };
  } catch (error: any) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error: error.message || 'Unknown error sending email',
    };
  }
}

/**
 * Send email with retry logic for transient failures
 */
export async function sendEmailWithRetry(
  to: string,
  subject: string,
  html: string,
  text: string,
  maxRetries: number = 3
): Promise<SendResult> {
  let lastError: string = '';

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = await sendEmail(to, subject, html, text);

    if (result.success) {
      return result;
    }

    lastError = result.error || 'Unknown error';
    console.error(`Email send attempt ${attempt + 1}/${maxRetries} failed:`, lastError);

    // Check if error is retryable
    if (
      lastError.includes('Invalid email') ||
      lastError.includes('not configured') ||
      lastError.includes('401')
    ) {
      // Don't retry for non-retryable errors
      console.error('Non-retryable error, aborting:', lastError);
      break;
    }

    // Exponential backoff: 1s, 2s, 4s
    if (attempt < maxRetries - 1) {
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  return {
    success: false,
    error: lastError,
  };
}

/**
 * Helper function to sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send a weather alert email
 */
export async function sendWeatherAlert(
  recipient: string,
  studentName: string,
  emailContent: { subject: string; html: string; text: string }
): Promise<SendResult> {
  return sendEmailWithRetry(
    recipient,
    emailContent.subject,
    emailContent.html,
    emailContent.text
  );
}

/**
 * Send reschedule options email
 */
export async function sendRescheduleOptions(
  recipient: string,
  studentName: string,
  emailContent: { subject: string; html: string; text: string }
): Promise<SendResult> {
  return sendEmailWithRetry(
    recipient,
    emailContent.subject,
    emailContent.html,
    emailContent.text
  );
}

/**
 * Send confirmation email
 */
export async function sendConfirmation(
  recipient: string,
  studentName: string,
  emailContent: { subject: string; html: string; text: string }
): Promise<SendResult> {
  return sendEmailWithRetry(
    recipient,
    emailContent.subject,
    emailContent.html,
    emailContent.text
  );
}

