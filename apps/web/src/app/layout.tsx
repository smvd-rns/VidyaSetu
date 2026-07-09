import type { Metadata } from 'next';
import { Cormorant_Garamond, Lato } from 'next/font/google';
import './globals.css';
import { KeepAlive } from '@/components/KeepAlive';

const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
});

const lato = Lato({
  variable: '--font-lato',
  subsets: ['latin'],
  weight: ['400', '700'],
});

export const metadata: Metadata = {
  title: 'VidyaSetu — Bridge of Knowledge',
  description: 'Devotional education platform for coaching institutes',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'VidyaSetu',
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
    <html lang="en" className={`${cormorant.variable} ${lato.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-devotional antialiased">
        <KeepAlive />
        {children}
      </body>
    </html>
  );
}
