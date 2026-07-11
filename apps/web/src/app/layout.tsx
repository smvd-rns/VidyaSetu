import type { Metadata } from 'next';
import './globals.css';
import { KeepAlive } from '@/components/KeepAlive';

export const metadata: Metadata = {
  title: 'VenuTube — Bridge of Knowledge',
  description: 'Devotional education platform for coaching institutes',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'VenuTube',
  },
  formatDetection: { telephone: false },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',   // ← unlocks env(safe-area-inset-*) in WebView
  themeColor: '#ffffff',
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-devotional antialiased">
        <KeepAlive />
        {children}
      </body>
    </html>
  );
}
