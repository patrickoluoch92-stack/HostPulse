import { ReactNode } from 'react';
import { GuestOnly } from '../../components/route-guards';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <GuestOnly>{children}</GuestOnly>;
}
