import { ReactNode } from 'react';
import { AuthOnly } from '../../components/route-guards';

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AuthOnly>{children}</AuthOnly>;
}
