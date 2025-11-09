import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { Notification } from '@/types';

/**
 * Log a notification to Firestore
 */
export async function logNotification(
  notification: Omit<Notification, 'id' | 'createdAt'>
): Promise<string> {
  try {
    const notificationData = {
      ...notification,
      createdAt: Timestamp.now(),
      sentAt: notification.sentAt ? Timestamp.fromDate(notification.sentAt) : null,
    };

    const docRef = await addDoc(collection(db, 'notifications'), notificationData);
    
    console.log(`Notification logged to Firestore: ${docRef.id}`);
    
    return docRef.id;
  } catch (error) {
    console.error('Error logging notification to Firestore:', error);
    throw error;
  }
}

/**
 * Get all notifications for a specific booking
 */
export async function getNotificationsByBooking(bookingId: string): Promise<Notification[]> {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('bookingId', '==', bookingId)
    );

    const querySnapshot = await getDocs(q);
    
    const notifications: Notification[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      notifications.push({
        id: doc.id,
        bookingId: data.bookingId,
        studentId: data.studentId,
        type: data.type,
        recipientEmail: data.recipientEmail,
        subject: data.subject,
        htmlContent: data.htmlContent,
        textContent: data.textContent,
        status: data.status,
        resendMessageId: data.resendMessageId,
        error: data.error,
        sentAt: data.sentAt?.toDate(),
        createdAt: data.createdAt.toDate(),
      });
    });

    return notifications;
  } catch (error) {
    console.error('Error fetching notifications from Firestore:', error);
    throw error;
  }
}

/**
 * Get all notifications for a specific student
 */
export async function getNotificationsByStudent(studentId: string): Promise<Notification[]> {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('studentId', '==', studentId)
    );

    const querySnapshot = await getDocs(q);
    
    const notifications: Notification[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      notifications.push({
        id: doc.id,
        bookingId: data.bookingId,
        studentId: data.studentId,
        type: data.type,
        recipientEmail: data.recipientEmail,
        subject: data.subject,
        htmlContent: data.htmlContent,
        textContent: data.textContent,
        status: data.status,
        resendMessageId: data.resendMessageId,
        error: data.error,
        sentAt: data.sentAt?.toDate(),
        createdAt: data.createdAt.toDate(),
      });
    });

    return notifications;
  } catch (error) {
    console.error('Error fetching student notifications from Firestore:', error);
    throw error;
  }
}

/**
 * Update notification status
 */
export async function updateNotificationStatus(
  notificationId: string,
  status: 'sent' | 'failed' | 'bounced',
  error?: string
): Promise<void> {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    
    const updateData: any = {
      status,
      sentAt: status === 'sent' ? Timestamp.now() : null,
    };

    if (error) {
      updateData.error = error;
    }

    await updateDoc(notificationRef, updateData);
    
    console.log(`Notification ${notificationId} status updated to: ${status}`);
  } catch (error) {
    console.error('Error updating notification status:', error);
    throw error;
  }
}

/**
 * Get recent notifications (for dashboard)
 */
export async function getRecentNotifications(limit: number = 50): Promise<Notification[]> {
  try {
    const querySnapshot = await getDocs(collection(db, 'notifications'));
    
    const notifications: Notification[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      notifications.push({
        id: doc.id,
        bookingId: data.bookingId,
        studentId: data.studentId,
        type: data.type,
        recipientEmail: data.recipientEmail,
        subject: data.subject,
        htmlContent: data.htmlContent,
        textContent: data.textContent,
        status: data.status,
        resendMessageId: data.resendMessageId,
        error: data.error,
        sentAt: data.sentAt?.toDate(),
        createdAt: data.createdAt.toDate(),
      });
    });

    // Sort by creation date (newest first) and limit
    return notifications
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  } catch (error) {
    console.error('Error fetching recent notifications:', error);
    throw error;
  }
}

