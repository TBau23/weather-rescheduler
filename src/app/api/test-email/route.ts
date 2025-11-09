import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email-service';

/**
 * GET /api/test-email?to=email@example.com
 * Simple test endpoint to verify email service is working
 * Uses the email-service module which includes demo mode support
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const toEmail = searchParams.get('to');

  const apiKey = process.env.RESEND_API_KEY;
  const demoEmail = process.env.DEMO_EMAIL;
  const isDemoMode = process.env.NODE_ENV === 'development';

  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: 'RESEND_API_KEY not configured in .env.local'
    }, { status: 500 });
  }

  // If no toEmail provided, use DEMO_EMAIL or return error
  const recipient = toEmail || demoEmail;
  
  if (!recipient) {
    return NextResponse.json({
      success: false,
      error: 'Please provide a "to" email parameter: /api/test-email?to=your@email.com',
      hint: 'Or set DEMO_EMAIL in your .env.local file'
    }, { status: 400 });
  }

  try {
    console.log('Testing email service...');
    console.log('Demo mode:', isDemoMode);
    console.log('Demo email:', demoEmail);
    console.log('Recipient:', recipient);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
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
          .content {
            background: white;
            padding: 30px 20px;
            border: 1px solid #e5e7eb;
            border-top: none;
          }
          .success-box {
            background: #F0FDF4;
            border: 2px solid #10B981;
            padding: 16px;
            border-radius: 4px;
            margin: 20px 0;
          }
          .info-box {
            background: #F3F4F6;
            padding: 16px;
            border-radius: 4px;
            margin: 16px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>✅ Email Test Successful!</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">Weather Rescheduler</p>
        </div>
        
        <div class="content">
          <div class="success-box">
            <strong>Your Resend integration is working correctly!</strong>
          </div>
          
          <p>This is a test email from the Weather Rescheduler application.</p>
          
          <div class="info-box">
            <p><strong>Configuration:</strong></p>
            <p>• Demo Mode: ${isDemoMode ? 'ENABLED' : 'DISABLED'}</p>
            <p>• Demo Email: ${demoEmail || 'Not set'}</p>
            <p>• From: ${process.env.FROM_EMAIL || 'onboarding@resend.dev'}</p>
            <p>• Sent at: ${new Date().toISOString()}</p>
          </div>
          
          <p>You're now ready to send weather alerts, reschedule options, and confirmation emails!</p>
          
          <h3>Next Steps:</h3>
          <ul>
            <li>Test weather alert: <code>POST /api/send-notification</code></li>
            <li>Test reschedule options: Generate with AI first</li>
            <li>View notifications: <code>GET /api/send-notification?bookingId=xxx</code></li>
          </ul>
        </div>
      </body>
      </html>
    `;

    const text = `
EMAIL TEST SUCCESSFUL

Your Resend integration is working correctly!

This is a test email from the Weather Rescheduler application.

Configuration:
• Demo Mode: ${isDemoMode ? 'ENABLED' : 'DISABLED'}
• Demo Email: ${demoEmail || 'Not set'}
• From: ${process.env.FROM_EMAIL || 'onboarding@resend.dev'}
• Sent at: ${new Date().toISOString()}

You're now ready to send weather alerts, reschedule options, and confirmation emails!

Next Steps:
- Test weather alert: POST /api/send-notification
- Test reschedule options: Generate with AI first
- View notifications: GET /api/send-notification?bookingId=xxx
    `.trim();

    // Use our email service (which includes demo mode support)
    const result = await sendEmail(
      recipient,
      'Weather Rescheduler - Email Test',
      html,
      text
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Email sent successfully!',
        emailId: result.messageId,
        recipient,
        demoMode: isDemoMode,
        demoEmail: demoEmail || null,
        note: isDemoMode && demoEmail 
          ? `Email redirected to ${demoEmail} (demo mode)` 
          : 'Email sent to specified recipient'
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Email test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

