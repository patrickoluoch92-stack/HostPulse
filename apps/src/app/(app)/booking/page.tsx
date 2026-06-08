'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import styles from './page.module.css';
import {
  clearStoredSession,
  getStoredSession,
  SessionUser,
} from '../../../lib/auth-session';
import { firebaseAuth } from '../../../lib/firebase';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api-proxy';

type PropertyOption = {
  id: number;
  name: string;
  price: number;
};

type BookingStep = 1 | 2 | 3;
const PAYMENT_VERIFY_ATTEMPTS = 6;
const PAYMENT_VERIFY_DELAY_MS = 10000;

export default function BookingPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [step, setStep] = useState<BookingStep>(1);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [total, setTotal] = useState(10000);
  const [mpesaPhone, setMpesaPhone] = useState('+2547');
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const session = getStoredSession();
    setToken(session?.token ?? null);
    setUser(session?.user ?? null);
  }, []);

  useEffect(() => {
    async function loadProperties(authToken: string) {
      setLoadingProperties(true);
      try {
        const res = await fetch(`${API_BASE}/bookings/properties`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
        });
        if (!res.ok) {
          setProperties([]);
          setStatus('Error: Could not load properties. Please refresh.');
          return;
        }
        const data = (await res.json()) as PropertyOption[];
        const safeData = Array.isArray(data) ? data : [];
        setProperties(safeData);
        setPropertyId((current) => current ?? (safeData[0]?.id ?? null));
      } catch {
        setProperties([]);
        setStatus('Error: Failed to load properties.');
      } finally {
        setLoadingProperties(false);
      }
    }

    if (token) {
      void loadProperties(token);
    }
  }, [token]);

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === propertyId) ?? null,
    [properties, propertyId],
  );

  function goNextStep() {
    if (step === 1 && !propertyId) {
      setStatus('Error: Select a property before continuing.');
      return;
    }
    if (step === 2 && (!startDate || !endDate || total <= 0)) {
      setStatus('Error: Provide travel dates and total amount.');
      return;
    }
    setStatus(null);
    setStep((prev) => (prev < 3 ? ((prev + 1) as BookingStep) : prev));
  }

  function goBackStep() {
    setStatus(null);
    setStep((prev) => (prev > 1 ? ((prev - 1) as BookingStep) : prev));
  }

  async function handleLogout() {
    clearStoredSession();
    if (firebaseAuth) {
      await signOut(firebaseAuth).catch(() => undefined);
    }
    router.replace('/login');
  }

  async function pollPaymentStatus(paymentId: number, authToken: string) {
    for (let attempt = 1; attempt <= PAYMENT_VERIFY_ATTEMPTS; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, PAYMENT_VERIFY_DELAY_MS));

      const verifyRes = await fetch(`${API_BASE}/payments/mpesa/verify/${paymentId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });

      const verifyBody = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) {
        continue;
      }

      const paymentStatus = verifyBody?.payment?.status;
      if (paymentStatus === 'success') {
        setStatus(`Success: Payment ${paymentId} confirmed. Booking is now paid and confirmed.`);
        return;
      }

      if (paymentStatus === 'failed') {
        const reason =
          verifyBody?.payment?.resultDesc ||
          verifyBody?.verification?.resultDesc ||
          'M-PESA reported a failed payment';
        setStatus(`Error: Payment ${paymentId} failed. ${reason}`);
        return;
      }

      setStatus(`STK sent. Waiting for callback confirmation... (check ${attempt}/${PAYMENT_VERIFY_ATTEMPTS})`);
    }

    setStatus(
      `STK initiated, but final confirmation is still pending. Use Payment ID to verify later in your dashboard.`,
    );
  }

  async function handleSubmitBooking(e: FormEvent) {
    e.preventDefault();

    if (!token || !propertyId) {
      setStatus('Error: Authentication or property selection missing.');
      return;
    }

    setIsSubmitting(true);
    setStatus('Creating booking...');

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

      const bookingBody = await bookingRes.json().catch(() => ({}));
      if (!bookingRes.ok) {
        const message = Array.isArray(bookingBody.message)
          ? bookingBody.message[0]
          : bookingBody.message;
        setStatus(`Error: ${message || 'Failed to create booking'}`);
        return;
      }

      setStatus('Booking created. Initiating M-PESA STK push...');
      const payRes = await fetch(`${API_BASE}/payments/mpesa/stk-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookingId: bookingBody.id,
          phone: mpesaPhone,
        }),
      });

      const payBody = await payRes.json().catch(() => ({}));
      if (!payRes.ok) {
        const message = Array.isArray(payBody.message) ? payBody.message[0] : payBody.message;
        setStatus(`Error: ${message || 'Failed to initiate M-PESA payment'}`);
        return;
      }

      setStatus(
        `Success: STK push sent to ${mpesaPhone}. Payment ID ${payBody.payment?.id ?? 'n/a'}.`,
      );
      const paymentId = Number(payBody.payment?.id);
      if (Number.isInteger(paymentId) && paymentId > 0) {
        setStatus(`STK push sent to ${mpesaPhone}. Waiting for M-PESA confirmation...`);
        await pollPaymentStatus(paymentId, token);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown booking error';
      setStatus(`Error: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  const statusClassName = status
    ? status.startsWith('Error')
      ? `${styles.status} ${styles.statusError}`
      : `${styles.status} ${styles.statusSuccess}`
    : '';

  return (
    <main className={styles.container}>
      <section className={styles.card}>
        <div className={styles.headerRow}>
          <div>
            <p className={styles.kicker}>Secure Booking Flow</p>
            <h1 className={styles.title}>Plan your stay</h1>
            <p className={styles.subtitle}>Logged in as {user?.email || 'authenticated user'}</p>
          </div>
          <button type="button" onClick={handleLogout} className={styles.secondaryButton}>
            Logout
          </button>
        </div>

        <ol className={styles.stepper}>
          <li className={step >= 1 ? styles.stepActive : styles.step}>1. Property</li>
          <li className={step >= 2 ? styles.stepActive : styles.step}>2. Dates & Price</li>
          <li className={step >= 3 ? styles.stepActive : styles.step}>3. Payment</li>
        </ol>

        <form onSubmit={handleSubmitBooking} className={styles.form}>
          {step === 1 && (
            <label className={styles.label}>
              Choose property
              <select
                value={propertyId ?? ''}
                onChange={(e) => setPropertyId(e.target.value ? Number(e.target.value) : null)}
                className={styles.input}
                required
              >
                {loadingProperties && <option value="">Loading properties...</option>}
                {!loadingProperties && properties.length === 0 && (
                  <option value="">No properties available</option>
                )}
                {!loadingProperties &&
                  properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      #{property.id} - {property.name} (KES {property.price})
                    </option>
                  ))}
              </select>
            </label>
          )}

          {step === 2 && (
            <>
              <label className={styles.label}>
                Check-in date
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={styles.input}
                  required
                />
              </label>
              <label className={styles.label}>
                Check-out date
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={styles.input}
                  required
                />
              </label>
              <label className={styles.label}>
                Total amount (KES)
                <input
                  type="number"
                  min={1}
                  value={total}
                  onChange={(e) => setTotal(Number(e.target.value))}
                  className={styles.input}
                  required
                />
              </label>
            </>
          )}

          {step === 3 && (
            <>
              <div className={styles.summary}>
                <p>
                  <strong>Property:</strong> {selectedProperty?.name || 'n/a'}
                </p>
                <p>
                  <strong>Dates:</strong> {startDate || 'n/a'} to {endDate || 'n/a'}
                </p>
                <p>
                  <strong>Total:</strong> KES {total}
                </p>
              </div>
              <label className={styles.label}>
                M-PESA phone number
                <input
                  type="tel"
                  value={mpesaPhone}
                  onChange={(e) => setMpesaPhone(e.target.value)}
                  className={styles.input}
                  required
                />
              </label>
            </>
          )}

          <div className={styles.actions}>
            {step > 1 && (
              <button type="button" onClick={goBackStep} className={styles.secondaryButton}>
                Back
              </button>
            )}
            {step < 3 && (
              <button type="button" onClick={goNextStep} className={styles.primaryButton}>
                Continue
              </button>
            )}
            {step === 3 && (
              <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
                {isSubmitting ? 'Processing...' : 'Confirm & Pay'}
              </button>
            )}
          </div>
        </form>

        {status && <p className={statusClassName}>{status}</p>}
      </section>
    </main>
  );
}
