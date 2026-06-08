import './global.css';

export const metadata = {
  title: 'HostPulse',
  description: 'Trusted Kenyan hospitality bookings with secure M-Pesa checkout.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
