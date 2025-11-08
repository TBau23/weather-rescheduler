import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const toEmail = searchParams.get('to');

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: 'RESEND_API_KEY not configured'
    }, { status: 500 });
  }

  if (!toEmail) {
    return NextResponse.json({
      success: false,
      error: 'Please provide a "to" email parameter: /api/test-email?to=your@email.com'
    }, { status: 400 });
  }

  try {
    const resend = new Resend(apiKey);

    const data = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: toEmail,
      subject: 'Weather Rescheduler - Email Test',
      html: `
        <h1>Email API Test Successful!</h1>
        <p>This is a test email from the Weather Rescheduler application.</p>
        <p>If you're seeing this, your Resend integration is working correctly.</p>
        <hr />
        <p><small>Sent at: ${new Date().toISOString()}</small></p>
      `,
    });

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully!',
      emailId: data.id,
      recipient: toEmail
    });
  } catch (error) {
    console.error('Resend test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

