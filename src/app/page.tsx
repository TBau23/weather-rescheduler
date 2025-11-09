'use client';

import React, { useState, useEffect } from 'react';
import { useBookings } from '@/lib/firebase-hooks';
import { Booking } from '@/types';
import { 
  Calendar, 
  Search, 
  AlertTriangle, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  CloudRain, 
  Loader,
  Info,
  CheckCircle2
} from 'lucide-react';

export default function AdminDashboard() {
  const { bookings, loading, error } = useBookings();
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [demoMode, setDemoMode] = useState(false); // Toggle for forcing conflicts

  const selectedBooking = selectedBookingId 
    ? bookings.find(b => b.id === selectedBookingId) 
    : null;

  // Auto-select first booking when data loads
  useEffect(() => {
    if (!selectedBookingId && bookings.length > 0) {
      setSelectedBookingId(bookings[0].id);
    }
  }, [bookings, selectedBookingId]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (bookings.length === 0) return;

      const currentIndex = bookings.findIndex(b => b.id === selectedBookingId);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = Math.min(currentIndex + 1, bookings.length - 1);
        const nextBookingId = bookings[nextIndex].id;
        setSelectedBookingId(nextBookingId);
        // Smooth scroll to selected item
        setTimeout(() => {
          document.getElementById(`booking-${nextBookingId}`)?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
          });
        }, 0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = Math.max(currentIndex - 1, 0);
        const prevBookingId = bookings[prevIndex].id;
        setSelectedBookingId(prevBookingId);
        // Smooth scroll to selected item
        setTimeout(() => {
          document.getElementById(`booking-${prevBookingId}`)?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
          });
        }, 0);
      } else if (e.key === 'Escape') {
        setSelectedBookingId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bookings, selectedBookingId]);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const runWeatherCheck = async () => {
    setRunning(true);
    showToast('Starting weather check workflow...', 'info');
    
    try {
      const response = await fetch('/api/run-weather-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forceConflict: demoMode, // Only force conflicts in demo mode
          hoursAhead: 48, // Check 48 hours ahead (within forecast range)
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setLastResult(data.result);
        const message = demoMode 
          ? `Demo mode: ${data.result.unsafeBookings} conflicts forced, ${data.result.emailsSent} emails sent.`
          : `Weather check complete! ${data.result.checkedBookings} checked, ${data.result.unsafeBookings} conflicts, ${data.result.emailsSent} emails sent.`;
        showToast(message, 'success');
      } else {
        showToast(`Error: ${data.error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Failed to run weather check: ${err.message}`, 'error');
    } finally {
      setRunning(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      scheduled: 'bg-green-100 text-green-800 border-green-200',
      checking: 'bg-yellow-100 text-yellow-800 border-yellow-200 animate-pulse',
      conflict: 'bg-red-100 text-red-800 border-red-200',
      rescheduled: 'bg-blue-100 text-blue-800 border-blue-200',
      confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    
    return badges[status as keyof typeof badges] || badges.scheduled;
  };

  const getStatusIcon = (status: string) => {
    const iconMap = {
      scheduled: Calendar,
      checking: Search,
      conflict: AlertTriangle,
      rescheduled: RefreshCw,
      confirmed: CheckCircle,
      cancelled: XCircle,
    };
    
    const IconComponent = iconMap[status as keyof typeof iconMap] || Calendar;
    return <IconComponent className="w-5 h-5" />;
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const getTrainingLevelBadge = (level: string) => {
    const badges = {
      student: 'bg-purple-100 text-purple-800 text-xs',
      private: 'bg-blue-100 text-blue-800 text-xs',
      instrument: 'bg-indigo-100 text-indigo-800 text-xs',
      commercial: 'bg-orange-100 text-orange-800 text-xs',
    };
    
    return badges[level as keyof typeof badges] || badges.student;
  };

  // Group bookings by status
  const groupedBookings = React.useMemo(() => {
    const groups = {
      conflict: [] as Booking[],
      checking: [] as Booking[],
      rescheduled: [] as Booking[],
      scheduled: [] as Booking[],
      confirmed: [] as Booking[],
      cancelled: [] as Booking[],
    };

    bookings.forEach(booking => {
      if (groups[booking.status as keyof typeof groups]) {
        groups[booking.status as keyof typeof groups].push(booking);
      } else {
        groups.scheduled.push(booking);
      }
    });

    return groups;
  }, [bookings]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 font-semibold text-lg mb-2">Error Loading Bookings</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
            <div className={`rounded-lg shadow-lg p-4 max-w-md border-l-4 ${
            toast.type === 'success' ? 'bg-green-50 border-green-500 text-green-800' :
            toast.type === 'error' ? 'bg-red-50 border-red-500 text-red-800' :
            'bg-blue-50 border-blue-500 text-blue-800'
          }`}>
            <div className="flex items-start gap-3">
              {toast.type === 'success' ? (
                <CheckCircle className="w-6 h-6 flex-shrink-0" />
              ) : toast.type === 'error' ? (
                <XCircle className="w-6 h-6 flex-shrink-0" />
              ) : (
                <Info className="w-6 h-6 flex-shrink-0" />
              )}
              <p className="font-medium">{toast.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Weather Rescheduler</h1>
              <p className="text-gray-600 text-sm mt-1">Flight scheduling with AI-powered weather monitoring</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={demoMode}
                  onChange={(e) => setDemoMode(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900">
                  Demo Mode (Force Conflicts)
                </span>
              </label>
              <button
                onClick={runWeatherCheck}
                disabled={running || loading}
                className={`px-5 py-2.5 rounded-lg font-semibold text-white transition-all ${
                  running || loading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg active:scale-95'
                }`}
              >
                {running ? (
                  <span className="flex items-center gap-2">
                    <Loader className="w-4 h-4 animate-spin" />
                    Running...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <CloudRain className="w-4 h-4" />
                    Run Weather Check
                  </span>
                )}
              </button>
            </div>
          </div>
          
          {lastResult && (
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="font-medium text-blue-900">
                  Last: {new Date(lastResult.timestamp).toLocaleTimeString()}
                </span>
                <span className="text-blue-700">{lastResult.checkedBookings} checked</span>
                <span className="text-blue-700">{lastResult.unsafeBookings} conflicts</span>
                <span className="text-blue-700">{lastResult.emailsSent} emails</span>
                <span className="text-blue-700">{(lastResult.duration / 1000).toFixed(1)}s</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Split Panel Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Bookings List */}
        <div className="w-2/5 bg-white border-r border-gray-200 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h2 className="font-semibold text-gray-900">
              Bookings ({bookings.length})
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader className="w-10 h-10 animate-spin text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 text-sm">Loading bookings...</p>
                </div>
              </div>
            ) : bookings.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-500">No bookings found</p>
                <p className="text-gray-400 text-sm mt-1">Run seed data script</p>
              </div>
            ) : (
              <div className="p-2">
                {/* Conflicts Group */}
                {groupedBookings.conflict.length > 0 && (
                  <BookingGroup
                    title="CONFLICTS"
                    icon="⚠️"
                    count={groupedBookings.conflict.length}
                    bookings={groupedBookings.conflict}
                    selectedBookingId={selectedBookingId}
                    setSelectedBookingId={setSelectedBookingId}
                    getStatusIcon={getStatusIcon}
                    getStatusBadge={getStatusBadge}
                    formatTime={formatTime}
                    getTrainingLevelBadge={getTrainingLevelBadge}
                  />
                )}

                {/* Checking Group */}
                {groupedBookings.checking.length > 0 && (
                  <BookingGroup
                    title="CHECKING"
                    icon="🔍"
                    count={groupedBookings.checking.length}
                    bookings={groupedBookings.checking}
                    selectedBookingId={selectedBookingId}
                    setSelectedBookingId={setSelectedBookingId}
                    getStatusIcon={getStatusIcon}
                    getStatusBadge={getStatusBadge}
                    formatTime={formatTime}
                    getTrainingLevelBadge={getTrainingLevelBadge}
                  />
                )}

                {/* Rescheduled Group */}
                {groupedBookings.rescheduled.length > 0 && (
                  <BookingGroup
                    title="RESCHEDULED"
                    icon="🔄"
                    count={groupedBookings.rescheduled.length}
                    bookings={groupedBookings.rescheduled}
                    selectedBookingId={selectedBookingId}
                    setSelectedBookingId={setSelectedBookingId}
                    getStatusIcon={getStatusIcon}
                    getStatusBadge={getStatusBadge}
                    formatTime={formatTime}
                    getTrainingLevelBadge={getTrainingLevelBadge}
                  />
                )}

                {/* Scheduled/Safe Group */}
                {groupedBookings.scheduled.length > 0 && (
                  <BookingGroup
                    title="SCHEDULED"
                    icon="✅"
                    count={groupedBookings.scheduled.length}
                    bookings={groupedBookings.scheduled}
                    selectedBookingId={selectedBookingId}
                    setSelectedBookingId={setSelectedBookingId}
                    getStatusIcon={getStatusIcon}
                    getStatusBadge={getStatusBadge}
                    formatTime={formatTime}
                    getTrainingLevelBadge={getTrainingLevelBadge}
                  />
                )}

                {/* Confirmed Group */}
                {groupedBookings.confirmed.length > 0 && (
                  <BookingGroup
                    title="CONFIRMED"
                    icon="☑️"
                    count={groupedBookings.confirmed.length}
                    bookings={groupedBookings.confirmed}
                    selectedBookingId={selectedBookingId}
                    setSelectedBookingId={setSelectedBookingId}
                    getStatusIcon={getStatusIcon}
                    getStatusBadge={getStatusBadge}
                    formatTime={formatTime}
                    getTrainingLevelBadge={getTrainingLevelBadge}
                  />
                )}

                {/* Cancelled Group */}
                {groupedBookings.cancelled.length > 0 && (
                  <BookingGroup
                    title="CANCELLED"
                    icon="❌"
                    count={groupedBookings.cancelled.length}
                    bookings={groupedBookings.cancelled}
                    selectedBookingId={selectedBookingId}
                    setSelectedBookingId={setSelectedBookingId}
                    getStatusIcon={getStatusIcon}
                    getStatusBadge={getStatusBadge}
                    formatTime={formatTime}
                    getTrainingLevelBadge={getTrainingLevelBadge}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Detail View */}
        <div className="flex-1 bg-gray-50 overflow-y-auto">
          {selectedBooking ? (
            <div key={selectedBooking.id} className="animate-fade-in">
              <BookingDetailPanel
                booking={selectedBooking}
                getStatusBadge={getStatusBadge}
                getTrainingLevelBadge={getTrainingLevelBadge}
                formatTime={formatTime}
                showToast={showToast}
              />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg">Select a booking to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Detail Panel Component
function BookingDetailPanel({
  booking,
  getStatusBadge,
  getTrainingLevelBadge,
  formatTime,
  showToast,
}: {
  booking: Booking;
  getStatusBadge: (status: string) => string;
  getTrainingLevelBadge: (level: string) => string;
  formatTime: (date: Date) => string;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [rescheduleOptions, setRescheduleOptions] = useState<any[]>([]);
  const [weatherCheck, setWeatherCheck] = useState<any>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  // Load reschedule options and weather check if conflict
  useEffect(() => {
    if (booking.status === 'conflict') {
      loadConflictData();
      
      // Poll for reschedule options if they don't exist yet (AI might still be generating)
      const pollInterval = setInterval(() => {
        loadConflictData();
      }, 3000); // Check every 3 seconds
      
      // Stop polling after 60 seconds or when options are loaded
      const timeout = setTimeout(() => clearInterval(pollInterval), 60000);
      
      return () => {
        clearInterval(pollInterval);
        clearTimeout(timeout);
      };
    } else {
      setRescheduleOptions([]);
      setWeatherCheck(null);
    }
  }, [booking.id, booking.status]);

  const loadConflictData = async () => {
    // Only show loading spinner on first load
    if (rescheduleOptions.length === 0) {
      setLoadingOptions(true);
    }
    
    try {
      const { collection, query, where, getDocs, orderBy, limit } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      
      // Get reschedule options
      const optionsQuery = query(
        collection(db, 'rescheduleOptions'),
        where('bookingId', '==', booking.id)
      );
      const optionsSnap = await getDocs(optionsQuery);
      
      const options = optionsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        suggestedTime: doc.data().suggestedTime.toDate(),
      })).sort((a: any, b: any) => a.priority - b.priority);
      
      setRescheduleOptions(options);
      
      // Get latest weather check
      const weatherQuery = query(
        collection(db, 'weatherChecks'),
        where('bookingId', '==', booking.id),
        orderBy('checkTime', 'desc'),
        limit(1)
      );
      const weatherSnap = await getDocs(weatherQuery);
      
      if (!weatherSnap.empty) {
        const weatherData = weatherSnap.docs[0].data();
        setWeatherCheck({
          ...weatherData,
          checkTime: weatherData.checkTime.toDate(),
        });
      }
    } catch (error: any) {
      console.error('Error loading conflict data:', error);
      showToast(`Failed to load conflict details: ${error.message}`, 'error');
    } finally {
      setLoadingOptions(false);
    }
  };

  const acceptReschedule = async (optionId: string) => {
    setAcceptingId(optionId);
    try {
      const option = rescheduleOptions.find(o => o.id === optionId);
      if (!option || !option.token) {
        throw new Error('Invalid option or missing token');
      }
      
      const response = await fetch('/api/accept-reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          optionId: optionId,
          token: option.token,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to accept reschedule');
      }

      showToast('Reschedule accepted! Booking updated.', 'success');
    } catch (error: any) {
      showToast(`Error: ${error.message}`, 'error');
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <div className="p-6 max-w-4xl">
      {/* Booking Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{booking.studentName}</h2>
            <div className="flex items-center gap-2 mt-2">
              <span className={`px-3 py-1 rounded-full border font-medium ${getStatusBadge(booking.status)}`}>
                {booking.status}
              </span>
              <span className={`px-3 py-1 rounded-full font-medium ${getTrainingLevelBadge(booking.trainingLevel)}`}>
                {booking.trainingLevel}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500 font-medium">Scheduled Time</p>
            <p className="text-gray-900">{formatTime(booking.scheduledTime)}</p>
          </div>
          <div>
            <p className="text-gray-500 font-medium">Duration</p>
            <p className="text-gray-900">{booking.duration} minutes</p>
          </div>
          <div>
            <p className="text-gray-500 font-medium">Location</p>
            <p className="text-gray-900">{booking.location.name}</p>
          </div>
          <div>
            <p className="text-gray-500 font-medium">Instructor</p>
            <p className="text-gray-900">{booking.instructorName}</p>
          </div>
          <div>
            <p className="text-gray-500 font-medium">Aircraft</p>
            <p className="text-gray-900">{booking.aircraftId}</p>
          </div>
        </div>
      </div>

      {/* Conflict Details */}
      {booking.status === 'conflict' && (
        <>
          {weatherCheck && (
            <div className="bg-red-50 rounded-lg border-2 border-red-200 p-6 mb-4">
              <h3 className="text-lg font-bold text-red-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Weather Conflict Detected
              </h3>
              <div className="space-y-2">
                {weatherCheck.reasons && weatherCheck.reasons.map((reason: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 text-sm text-red-800">
                    <span className="mt-0.5">•</span>
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-red-700 mt-3">
                Checked: {weatherCheck.checkTime ? new Date(weatherCheck.checkTime).toLocaleString() : 'N/A'}
              </p>
            </div>
          )}

          {/* Reschedule Options */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              AI-Generated Reschedule Options
            </h3>

            {loadingOptions ? (
              <div className="text-center py-8">
                <Loader className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600 text-sm">AI is generating reschedule options...</p>
                <p className="text-gray-400 text-xs mt-1">This may take 10-30 seconds</p>
              </div>
            ) : rescheduleOptions.length === 0 ? (
              <div className="text-center py-8">
                <Loader className="w-6 h-6 animate-spin text-blue-400 mx-auto mb-2" />
                <p className="text-gray-600 text-sm">Waiting for AI reschedule options...</p>
                <p className="text-gray-400 text-xs mt-1">Checking every 3 seconds</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rescheduleOptions.map((option: any) => (
                  <div
                    key={option.id}
                    className={`p-4 rounded-lg border-2 ${
                      option.priority === 1
                        ? 'border-green-300 bg-green-50'
                        : option.priority === 2
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-300 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">
                          Option {option.priority}
                        </span>
                        {option.priority === 1 && (
                          <span className="px-2 py-0.5 bg-green-600 text-white text-xs font-semibold rounded">
                            RECOMMENDED
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-lg font-semibold text-gray-900 mb-1">
                      {new Date(option.suggestedTime).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                    
                    <p className="text-sm text-gray-700 mb-3">{option.reasoning}</p>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-600 mb-3">
                      <span>✓ Student available</span>
                      <span>✓ Instructor available</span>
                      <span>✓ Aircraft available</span>
                    </div>
                    
                    <p className="text-xs text-gray-500 mb-3">
                      Weather: {option.weatherForecast || 'Typically favorable conditions'}
                    </p>
                    
                    <button
                      onClick={() => acceptReschedule(option.id)}
                      disabled={acceptingId !== null}
                      className={`w-full py-2 px-4 rounded-lg font-semibold transition-all ${
                        acceptingId === option.id
                          ? 'bg-gray-400 text-white cursor-wait'
                          : acceptingId !== null
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                      }`}
                    >
                      {acceptingId === option.id ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader className="w-4 h-4 animate-spin" />
                          Accepting...
                        </span>
                      ) : (
                        'Accept This Time'
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Safe Booking Message */}
      {(booking.status === 'scheduled' || booking.status === 'confirmed') && (
        <div className="bg-green-50 rounded-lg border-2 border-green-200 p-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <h3 className="text-lg font-bold text-green-900">Safe to Fly</h3>
              <p className="text-sm text-green-700">No weather conflicts detected for this booking</p>
            </div>
          </div>
        </div>
      )}

      {/* Rescheduled Message */}
      {booking.status === 'rescheduled' && (
        <div className="bg-blue-50 rounded-lg border-2 border-blue-200 p-6">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-8 h-8 text-blue-600" />
            <div>
              <h3 className="text-lg font-bold text-blue-900">Reschedule Confirmed</h3>
              <p className="text-sm text-blue-700">This booking has been successfully rescheduled</p>
            </div>
          </div>
        </div>
      )}

      {/* Checking Status */}
      {booking.status === 'checking' && (
        <div className="bg-yellow-50 rounded-lg border-2 border-yellow-200 p-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl animate-pulse">🔍</span>
            <div>
              <h3 className="text-lg font-bold text-yellow-900">Checking Weather...</h3>
              <p className="text-sm text-yellow-700">Weather evaluation in progress</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Booking Group Component with subheading
function BookingGroup({
  title,
  icon,
  count,
  bookings,
  selectedBookingId,
  setSelectedBookingId,
  getStatusIcon,
  getStatusBadge,
  formatTime,
  getTrainingLevelBadge,
}: {
  title: string;
  icon: string;
  count: number;
  bookings: Booking[];
  selectedBookingId: string | null;
  setSelectedBookingId: (id: string) => void;
  getStatusIcon: (status: string) => string;
  getStatusBadge: (status: string) => string;
  formatTime: (date: Date) => string;
  getTrainingLevelBadge: (level: string) => string;
}) {
  return (
    <div className="mb-4">
      {/* Group Header */}
      <div className="px-3 py-2 bg-gray-100 border-b border-gray-300 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <span className="font-semibold text-gray-900 text-sm">{title}</span>
          <span className="text-gray-600 text-xs">({count})</span>
        </div>
      </div>

      {/* Bookings in Group */}
      <div className="space-y-1 mt-1">
        {bookings.map((booking) => (
          <button
            key={booking.id}
            id={`booking-${booking.id}`}
            onClick={() => setSelectedBookingId(booking.id)}
            className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
              selectedBookingId === booking.id
                ? 'bg-blue-50 border-2 border-blue-500 shadow-sm scale-[1.02]'
                : 'bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm hover:scale-[1.01]'
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="text-lg">{getStatusIcon(booking.status)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900 truncate">
                    {booking.studentName}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTrainingLevelBadge(booking.trainingLevel)}`}>
                    {booking.trainingLevel}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  {formatTime(booking.scheduledTime)}
                </p>
                <p className="text-xs text-gray-500">
                  📍 {booking.location.name.replace(/\(K([A-Z]{3})\)/, '($1)')}
                </p>
                <p className="text-xs text-gray-500">
                  {booking.instructorName} • {booking.aircraftId}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
