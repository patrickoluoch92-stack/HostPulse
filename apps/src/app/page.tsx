'use client';

import { useEffect, useState } from 'react';

// API proxy route (Next.js rewrites to backend) to avoid cross-origin issues.
const API_BASE = '/api-proxy';

export default function Index() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [showAuth, setShowAuth] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Auth form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [authStatus, setAuthStatus] = useState<string | null>(null);

  // Booking form state
  const [propertyId, setPropertyId] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [total, setTotal] = useState(10000);
  const [mpesaPhone, setMpesaPhone] = useState('+2547');
  const [bookingStatus, setBookingStatus] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('hostpulse_token');
    const storedUser = localStorage.getItem('hostpulse_user');
    if (stored) {
      setToken(stored);
      setUser(storedUser ? JSON.parse(storedUser) : null);
      setShowAuth(false);
    }
  }, []);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthStatus('Processing...');

    try {
      const endpoint = authMode === 'login' ? 'login' : 'register';
      const body: any = { email, password };
      if (authMode === 'register' && phone) {
        body.phone = phone;
      }

      const res = await fetch(`${API_BASE}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = Array.isArray(err.message) ? err.message[0] : err.message;
        setAuthStatus(`Error: ${msg || `Failed to ${authMode}`}`);
        return;
      }

      const data = await res.json();
      localStorage.setItem('hostpulse_token', data.accessToken);
      localStorage.setItem('hostpulse_user', JSON.stringify(data.user));
      setToken(data.accessToken);
      setUser(data.user);
      setShowAuth(false);
      setAuthStatus(`Successfully ${authMode === 'login' ? 'logged in' : 'registered'}!`);
    } catch (err: any) {
      const msg = err?.message || 'Unknown error';
      const isNetworkError = /failed to fetch|networkerror|network error/i.test(msg);
      setAuthStatus(
        isNetworkError
          ? 'Cannot reach API. Ensure the backend is running: npx nx run api:serve'
          : `Error: ${msg}`
      );
    }
  }

  function handleLogout() {
    localStorage.removeItem('hostpulse_token');
    localStorage.removeItem('hostpulse_user');
    setToken(null);
    setUser(null);
    setShowAuth(true);
    setAuthStatus(null);
  }

  async function handleBooking(e: React.FormEvent) {
    e.preventDefault();
    setBookingStatus('Creating booking...');

    if (!token) {
      setBookingStatus('Error: Please log in first');
      return;
    }

    try {
      const bookingRes = await fetch(`${API_BASE}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          propertyId,
          startDate,
          endDate,
          total,
        }),
      });

      if (!bookingRes.ok) {
        const err = await bookingRes.json().catch(() => ({}));
        setBookingStatus(`Error: ${err.message || 'Failed to create booking'}`);
        return;
      }

      const booking = await bookingRes.json();
      setBookingStatus(`Booking ${booking.id} created. Initiating M-PESA STK push...`);

      const payRes = await fetch(`${API_BASE}/payments/mpesa/stk-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          phone: mpesaPhone,
        }),
      });

      if (!payRes.ok) {
        const err = await payRes.json().catch(() => ({}));
        setBookingStatus(`Error: ${err.message || 'Failed to initiate M-PESA payment'}`);
        return;
      }

      const pay = await payRes.json();
      setBookingStatus(
        `✅ M-Pesa STK push initiated! Please check your phone (${mpesaPhone}) and enter your M-Pesa PIN to complete payment. Payment ID: ${pay.payment.id}, Transaction: ${pay.payment.mpesaTxId}`,
      );
      
      // Poll for payment status (optional - you can remove this if not needed)
      if (pay.payment.id) {
        setTimeout(async () => {
          try {
            const verifyRes = await fetch(`${API_BASE}/payments/mpesa/verify/${pay.payment.id}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
            });
            if (verifyRes.ok) {
              const verifyData = await verifyRes.json();
              if (verifyData.payment.status === 'success' || verifyData.payment.status === 'completed') {
                setBookingStatus(`✅ Payment completed successfully! Transaction: ${pay.payment.mpesaTxId}`);
              }
            }
          } catch (err) {
            // Silent fail for verification
          }
        }, 30000); // Check after 30 seconds
      }
    } catch (err: any) {
      setBookingStatus(`Error: ${err.message || 'Unknown error'}`);
    }
  }

  if (showAuth) {
    return (
      <main style={{ maxWidth: 400, margin: '2rem auto', padding: '1rem' }}>
        <h1>HostPulse - {authMode === 'login' ? 'Login' : 'Register'}</h1>

        <div style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setAuthStatus(null);
            }}
            style={{ marginRight: '0.5rem', fontWeight: authMode === 'login' ? 'bold' : 'normal' }}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('register');
              setAuthStatus(null);
            }}
            style={{ fontWeight: authMode === 'register' ? 'bold' : 'normal' }}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleAuth} style={{ display: 'grid', gap: '0.75rem' }}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </label>

          {authMode === 'register' && (
            <label>
              Phone (optional, +254 format)
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+254712345678"
                style={{ width: '100%', padding: '0.5rem' }}
              />
            </label>
          )}

          <button type="submit" style={{ padding: '0.75rem' }}>
            {authMode === 'login' ? 'Login' : 'Register'}
          </button>
        </form>

        {authStatus && (
          <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: authStatus.includes('Error') ? 'red' : 'green' }}>
            {authStatus}
          </p>
        )}
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: '2rem auto', padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>HostPulse Booking</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem' }}>Logged in as: {user?.email}</span>
          <button type="button" onClick={handleLogout} style={{ padding: '0.5rem' }}>
            Logout
          </button>
        </div>
      </div>

      <p style={{ fontSize: '0.9rem', color: '#555' }}>
        Create a booking (guestId from JWT), then initiate M-PESA payment stub.
      </p>

      <form onSubmit={handleBooking} style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
        <label>
          Property ID
          <input
            type="number"
            value={propertyId}
            onChange={(e) => setPropertyId(Number(e.target.value))}
            min={1}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </label>

        <label>
          Start date
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </label>

        <label>
          End date
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </label>

        <label>
          Total (KES)
          <input
            type="number"
            value={total}
            onChange={(e) => setTotal(Number(e.target.value))}
            min={1}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </label>

        <label>
          M-PESA Phone (+254)
          <input
            type="tel"
            value={mpesaPhone}
            onChange={(e) => setMpesaPhone(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </label>

        <button type="submit" style={{ padding: '0.75rem' }}>
          Create Booking &amp; Pay via M-PESA (Stub)
        </button>
      </form>

      {bookingStatus && (
        <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: bookingStatus.includes('Error') ? 'red' : 'inherit' }}>
          <strong>Status:</strong> {bookingStatus}
        </p>
      )}
    </main>
  );
}
