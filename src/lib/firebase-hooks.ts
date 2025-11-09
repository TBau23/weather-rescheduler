'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { Booking } from '@/types';

/**
 * Real-time hook for bookings collection
 * Subscribes to all bookings and provides live updates
 */
export function useBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('📡 Setting up real-time bookings listener...');
    
    // Create query for all bookings ordered by scheduled time
    const q = query(
      collection(db, 'bookings'),
      orderBy('scheduledTime', 'asc')
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log(`📡 Received ${snapshot.docs.length} bookings from Firestore`);
        
        const bookingsData: Booking[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            studentId: data.studentId,
            studentName: data.studentName,
            instructorName: data.instructorName,
            aircraftId: data.aircraftId,
            scheduledTime: (data.scheduledTime as Timestamp).toDate(),
            duration: data.duration,
            location: data.location,
            status: data.status,
            trainingLevel: data.trainingLevel,
            createdAt: (data.createdAt as Timestamp).toDate(),
            updatedAt: (data.updatedAt as Timestamp).toDate(),
          };
        });

        setBookings(bookingsData);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('❌ Error in bookings listener:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => {
      console.log('📡 Cleaning up bookings listener');
      unsubscribe();
    };
  }, []);

  return { bookings, loading, error };
}

/**
 * Hook to get reschedule options for a specific booking
 * Loads from Firestore with token validation
 */
export function useRescheduleOptions(bookingId: string, token: string) {
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId || !token) {
      setLoading(false);
      return;
    }

    console.log(`📡 Loading reschedule options for booking ${bookingId}...`);

    // Import Firestore functions
    const loadOptions = async () => {
      try {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const { db } = await import('./firebase');
        
        const q = query(
          collection(db, 'rescheduleOptions'),
          where('bookingId', '==', bookingId),
          where('token', '==', token)
        );

        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          setError('No reschedule options found or invalid token');
          setLoading(false);
          return;
        }

        const optionsData = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            suggestedTime: (data.suggestedTime as Timestamp).toDate(),
            createdAt: (data.createdAt as Timestamp).toDate(),
          };
        });

        setOptions(optionsData);
        setLoading(false);
        setError(null);
      } catch (err: any) {
        console.error('❌ Error loading reschedule options:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    loadOptions();
  }, [bookingId, token]);

  return { options, loading, error };
}

