'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import styles from './page.module.css';
import { setStoredSession } from '../../../lib/auth-session';
import { firebaseAuth, initFirebaseAnalytics, isFirebaseConfigured } from '../../../lib/firebase';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api-proxy';

export default function LoginPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void initFirebaseAnalytics();
  }, []);

  async function handleAuth(e: FormEvent) {
    e.preventDefault();
    setStatus('Authenticating...');
    setIsSubmitting(true);

    try {
      if (isFirebaseConfigured && firebaseAuth) {
        const authResult =
          authMode === 'login'
            ? await signInWithEmailAndPassword(firebaseAuth, email, password)
            : await createUserWithEmailAndPassword(firebaseAuth, email, password);

        const firebaseIdToken = await authResult.user.getIdToken();
        const exchangeRes = await fetch(`${API_BASE}/auth/firebase/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idToken: firebaseIdToken,
            phone: authMode === 'register' ? phone : undefined,
          }),
        });

        const exchangeBody = await exchangeRes.json().catch(() => ({}));
        if (!exchangeRes.ok) {
          const msg = Array.isArray(exchangeBody.message)
            ? exchangeBody.message[0]
            : exchangeBody.message;
          setStatus(`Error: ${msg || 'Firebase authentication failed'}`);
          return;
        }

        setStoredSession({
          token: firebaseIdToken,
          user: exchangeBody.user ?? null,
        });
        router.replace('/booking');
        return;
      }

      const endpoint = authMode === 'login' ? 'login' : 'register';
      const body: Record<string, string> = { email, password };
      if (authMode === 'register' && phone.trim()) {
        body.phone = phone.trim();
      }

      const res = await fetch(`${API_BASE}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const responseBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = Array.isArray(responseBody.message)
          ? responseBody.message[0]
          : responseBody.message;
        setStatus(`Error: ${msg || `Failed to ${authMode}`}`);
        return;
      }

      setStoredSession({
        token: responseBody.accessToken,
        user: responseBody.user ?? null,
      });
      router.replace('/booking');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown authentication error';
      const isNetworkError = /failed to fetch|networkerror|network error/i.test(message);
      setStatus(
        isNetworkError
          ? 'Cannot reach API. Ensure backend is running: npx nx run api:serve'
          : `Error: ${message}`,
      );
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
        <p className={styles.kicker}>HostPulse Booking Flow</p>
        <h1 className={styles.title}>Sign in to continue</h1>
        <p className={styles.subtitle}>
          Authentication first. Property selection and booking steps are unlocked after login.
        </p>

        <div className={styles.toggleRow}>
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setStatus(null);
            }}
            className={`${styles.toggleButton} ${authMode === 'login' ? styles.toggleActive : ''}`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('register');
              setStatus(null);
            }}
            className={`${styles.toggleButton} ${authMode === 'register' ? styles.toggleActive : ''}`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleAuth} className={styles.form}>
          <label className={styles.label}>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={styles.input}
              autoComplete="email"
            />
          </label>

          <label className={styles.label}>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className={styles.input}
              autoComplete="current-password"
            />
          </label>

          {authMode === 'register' && (
            <label className={styles.label}>
              Phone (optional)
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+254712345678"
                className={styles.input}
                autoComplete="tel"
              />
            </label>
          )}

          <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
            {isSubmitting ? 'Please wait...' : authMode === 'login' ? 'Continue to Booking' : 'Create account'}
          </button>
        </form>

        {status && <p className={statusClassName}>{status}</p>}
      </section>
    </main>
  );
}
