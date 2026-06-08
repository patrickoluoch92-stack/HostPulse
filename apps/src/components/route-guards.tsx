'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredSession } from '../lib/auth-session';

type GuardProps = {
  children: ReactNode;
};

export function GuestOnly({ children }: GuardProps) {
  const router = useRouter();
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    const session = getStoredSession();
    if (session?.token) {
      router.replace('/booking');
      return;
    }
    setIsAllowed(true);
  }, [router]);

  if (!isAllowed) {
    return null;
  }

  return <>{children}</>;
}

export function AuthOnly({ children }: GuardProps) {
  const router = useRouter();
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    const session = getStoredSession();
    if (!session?.token) {
      router.replace('/login');
      return;
    }
    setIsAllowed(true);
  }, [router]);

  if (!isAllowed) {
    return null;
  }

  return <>{children}</>;
}
