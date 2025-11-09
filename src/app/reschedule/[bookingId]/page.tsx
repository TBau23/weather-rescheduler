'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

interface RescheduleOption {
  id: string;
  suggestedTime: Date;
  reasoning: string;
  priority: number;
  weatherForecast: string;
  studentAvailable: boolean;
  instructorAvailable: boolean;
  aircraftAvailable: boolean;
}

interface Booking {
  id: string;
  studentName: string;
  instructorName: string;
  aircraftId: string;
  scheduledTime: string;
  location: {
    name: string;
  };
  trainingLevel: string;
  status: string;
}

interface PageState {
  loading: boolean;
  error: string | null;
  booking: Booking | null;
  options: RescheduleOption[];
  accepting: string | null;
  accepted: boolean;
}

export default function ReschedulePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const bookingId = params.bookingId as string;
  const token = searchParams.get('token');

  const [state, setState] = useState<PageState>({
    loading: true,
    error: null,
    booking: null,
    options: [],
    accepting: null,
    accepted: false,
  });

  useEffect(() => {
    if (!token) {
      setState(prev => ({ ...prev, loading: false, error: 'Invalid or missing token' }));
      return;
    }

    fetchBookingAndOptions();
  }, [bookingId, token]);

  async function fetchBookingAndOptions() {
    try {
      // Import Firestore functions
      const { collection, doc, getDoc, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      
      // Fetch booking from Firestore
      const bookingRef = doc(db, 'bookings', bookingId as string);
      const bookingSnap = await getDoc(bookingRef);
      
      if (!bookingSnap.exists()) {
        throw new Error('Booking not found');
      }
      
      const bookingData = bookingSnap.data();
      const booking: Booking = {
        id: bookingSnap.id,
        studentId: bookingData.studentId,
        studentName: bookingData.studentName,
        instructorName: bookingData.instructorName,
        aircraftId: bookingData.aircraftId,
        scheduledTime: bookingData.scheduledTime.toDate().toISOString(),
        duration: bookingData.duration,
        location: bookingData.location,
        trainingLevel: bookingData.trainingLevel,
        status: bookingData.status,
      };

      // Fetch reschedule options from Firestore with token validation
      const optionsQuery = query(
        collection(db, 'rescheduleOptions'),
        where('bookingId', '==', bookingId),
        where('token', '==', token)
      );
      
      const optionsSnap = await getDocs(optionsQuery);
      
      if (optionsSnap.empty) {
        throw new Error('No reschedule options found or invalid token');
      }
      
      const bookingOptions = optionsSnap.docs
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            bookingId: data.bookingId,
            suggestedTime: data.suggestedTime.toDate(),
            reasoning: data.reasoning,
            priority: data.priority,
            weatherForecast: data.weatherForecast,
            studentAvailable: data.studentAvailable,
            instructorAvailable: data.instructorAvailable,
            aircraftAvailable: data.aircraftAvailable,
          };
        })
        .sort((a: any, b: any) => a.priority - b.priority);

      setState({
        loading: false,
        error: null,
        booking,
        options: bookingOptions,
        accepting: null,
        accepted: false,
      });
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to load reschedule options',
      }));
    }
  }

  async function acceptOption(optionId: string) {
    if (!token) return;

    setState(prev => ({ ...prev, accepting: optionId }));

    try {
      const response = await fetch('/api/accept-reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, optionId, token }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to accept reschedule');
      }

      setState(prev => ({ ...prev, accepting: null, accepted: true }));
    } catch (error: any) {
      alert(`Error: ${error.message}`);
      setState(prev => ({ ...prev, accepting: null }));
    }
  }

  function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  }

  function formatTime(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  }

  if (state.loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading reschedule options...</p>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="text-center">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
            <p className="text-gray-600">{state.error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (state.accepted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="text-green-500 text-6xl mb-4">✅</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Flight Confirmed!</h1>
            <p className="text-lg text-gray-700 mb-2">
              Your flight has been rescheduled.
            </p>
            <p className="text-gray-600">
              A confirmation email has been sent with all the details.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!state.booking || state.options.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="text-center">
            <p className="text-gray-600">No reschedule options available</p>
          </div>
        </div>
      </div>
    );
  }

  const originalTime = new Date(state.booking.scheduledTime);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Reschedule Your Flight
            </h1>
            <p className="text-gray-600">
              Select a new time for your cancelled flight
            </p>
          </div>

          {/* Original Booking Info */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-red-800 mb-2">
              CANCELLED FLIGHT
            </h2>
            <div className="space-y-1 text-sm text-gray-700">
              <p><strong>Student:</strong> {state.booking.studentName}</p>
              <p><strong>Original Time:</strong> {formatDate(originalTime)} at {formatTime(originalTime)}</p>
              <p><strong>Location:</strong> {state.booking.location.name}</p>
              <p><strong>Instructor:</strong> {state.booking.instructorName}</p>
              <p><strong>Aircraft:</strong> {state.booking.aircraftId}</p>
              <p className="text-red-600 font-medium mt-2">
                Cancelled due to unsafe weather conditions
              </p>
            </div>
          </div>
        </div>

        {/* Reschedule Options */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Available Times
          </h2>

          {state.options.map((option, index) => {
            const optionDate = option.suggestedTime;
            const isRecommended = option.priority === 1;
            const isAccepting = state.accepting === option.id;

            return (
              <div
                key={option.id}
                className={`bg-white rounded-lg shadow-md p-6 border-2 ${
                  isRecommended ? 'border-green-500' : 'border-gray-200'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl font-bold text-gray-900">
                        Option {index + 1}
                      </h3>
                      {isRecommended && (
                        <span className="inline-block bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                          RECOMMENDED
                        </span>
                      )}
                    </div>
                    <p className="text-2xl font-semibold text-indigo-600">
                      {formatDate(optionDate)}
                    </p>
                    <p className="text-xl text-indigo-600">
                      {formatTime(optionDate)}
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-gray-700 leading-relaxed">
                    {option.reasoning}
                  </p>
                </div>

                <div className="mb-4 space-y-2 text-sm text-gray-600">
                  <p>✓ {state.booking.instructorName} available</p>
                  <p>✓ Aircraft {state.booking.aircraftId} available</p>
                  <p>✓ Weather forecast: {option.weatherForecast}</p>
                </div>

                <button
                  onClick={() => acceptOption(option.id)}
                  disabled={!!state.accepting}
                  className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors ${
                    isAccepting
                      ? 'bg-gray-400 cursor-not-allowed'
                      : isRecommended
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {isAccepting ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Confirming...
                    </span>
                  ) : (
                    'Accept This Time'
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Questions? Contact your instructor {state.booking.instructorName} or
            our scheduling team.
          </p>
        </div>
      </div>
    </div>
  );
}

