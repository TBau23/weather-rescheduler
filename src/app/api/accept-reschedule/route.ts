import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { Booking, RescheduleOption } from '@/types';
import { generateConfirmationEmail } from '@/lib/email-templates';
import { sendConfirmation } from '@/lib/email-service';
import { logNotification } from '@/lib/notification-logger';

/**
 * POST /api/accept-reschedule
 * 
 * Accept a reschedule option and update the booking
 * 
 * Body: {
 *   bookingId: string,
 *   optionId: string,
 *   token: string
 * }
 * 
 * Returns: {
 *   success: true,
 *   booking: Booking,
 *   message: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { bookingId, optionId, token } = body;
    
    // Validate required fields
    if (!bookingId || typeof bookingId !== 'string') {
      return NextResponse.json(
        { error: 'bookingId is required and must be a string' },
        { status: 400 }
      );
    }
    
    if (!optionId || typeof optionId !== 'string') {
      return NextResponse.json(
        { error: 'optionId is required and must be a string' },
        { status: 400 }
      );
    }
    
    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'token is required and must be a string' },
        { status: 400 }
      );
    }
    
    console.log(`🎯 Accepting reschedule option ${optionId} for booking ${bookingId}`);
    
    // Step 1: Fetch the reschedule option
    const optionRef = doc(db, 'rescheduleOptions', optionId);
    const optionSnap = await getDoc(optionRef);
    
    if (!optionSnap.exists()) {
      console.error(`❌ Reschedule option ${optionId} not found`);
      return NextResponse.json(
        { error: `Reschedule option not found` },
        { status: 404 }
      );
    }
    
    const optionData = optionSnap.data();
    
    // Step 2: Validate token
    if (optionData.token !== token) {
      console.error(`❌ Invalid token for option ${optionId}`);
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 403 }
      );
    }
    
    // Step 3: Validate booking ID matches
    if (optionData.bookingId !== bookingId) {
      console.error(`❌ Option ${optionId} does not belong to booking ${bookingId}`);
      return NextResponse.json(
        { error: 'Option does not belong to this booking' },
        { status: 400 }
      );
    }
    
    console.log(`   ✓ Token validated`);
    
    // Step 4: Fetch the booking
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingRef);
    
    if (!bookingSnap.exists()) {
      console.error(`❌ Booking ${bookingId} not found`);
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }
    
    const bookingData = bookingSnap.data();
    const booking: Booking = {
      id: bookingSnap.id,
      studentId: bookingData.studentId,
      studentName: bookingData.studentName,
      instructorName: bookingData.instructorName,
      aircraftId: bookingData.aircraftId,
      scheduledTime: bookingData.scheduledTime.toDate(),
      duration: bookingData.duration,
      location: bookingData.location,
      status: bookingData.status,
      trainingLevel: bookingData.trainingLevel,
      createdAt: bookingData.createdAt.toDate(),
      updatedAt: bookingData.updatedAt.toDate(),
    };
    
    console.log(`   ✓ Booking found: ${booking.studentName}`);
    
    // Step 5: Update booking with new time and status
    const newScheduledTime = optionData.suggestedTime.toDate();
    
    await updateDoc(bookingRef, {
      scheduledTime: optionData.suggestedTime,
      status: 'confirmed',
      updatedAt: Timestamp.now(),
    });
    
    console.log(`   ✓ Booking updated to ${newScheduledTime.toLocaleString()}, status: confirmed`);
    
    // Create updated booking object for email
    const updatedBooking: Booking = {
      ...booking,
      scheduledTime: newScheduledTime,
      status: 'confirmed',
      updatedAt: new Date(),
    };
    
    // Step 6: Fetch student data for email
    const studentRef = doc(db, 'students', booking.studentId);
    const studentSnap = await getDoc(studentRef);
    
    if (!studentSnap.exists()) {
      console.error(`⚠️  Student ${booking.studentId} not found, skipping email`);
    } else {
      const studentData = studentSnap.data();
      const student = {
        id: studentSnap.id,
        name: studentData.name,
        email: studentData.email,
        phone: studentData.phone,
        trainingLevel: studentData.trainingLevel,
        createdAt: studentData.createdAt.toDate(),
        updatedAt: studentData.updatedAt.toDate(),
      };
      
      // Step 7: Send confirmation email
      console.log(`   📧 Sending confirmation email to ${student.email}...`);
      
      const emailTemplate = generateConfirmationEmail(updatedBooking);
      const sendResult = await sendConfirmation(student.email, student.name, emailTemplate);
      
      if (sendResult.success) {
        console.log(`   ✅ Confirmation email sent`);
        
        // Log notification
        await logNotification({
          bookingId: booking.id,
          studentId: student.id,
          type: 'confirmation',
          recipientEmail: student.email,
          subject: emailTemplate.subject,
          htmlContent: emailTemplate.html,
          textContent: emailTemplate.text,
          status: 'sent',
          resendMessageId: sendResult.messageId,
          sentAt: new Date(),
        });
      } else {
        console.error(`   ⚠️  Failed to send confirmation email: ${sendResult.error}`);
      }
    }
    
    console.log(`✅ Reschedule accepted successfully`);
    
    // Step 8: Return success response
    return NextResponse.json({
      success: true,
      booking: {
        id: updatedBooking.id,
        studentName: updatedBooking.studentName,
        scheduledTime: updatedBooking.scheduledTime.toISOString(),
        status: updatedBooking.status,
        location: updatedBooking.location,
        instructorName: updatedBooking.instructorName,
        aircraftId: updatedBooking.aircraftId,
      },
      message: `Flight rescheduled to ${newScheduledTime.toLocaleString()}`,
    });
    
  } catch (error: any) {
    console.error('❌ Error accepting reschedule:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to accept reschedule',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

