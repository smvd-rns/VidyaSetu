'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getMe } from '@/lib/auth';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      try {
        const user = await getMe();
        if (user) {
          router.replace('/dashboard');
        } else {
          router.replace('/login');
        }
      } catch (err) {
        router.replace('/login');
      }
    }
    checkAuth();
  }, [router]);

  return (
    <div className="flex flex-1 items-center justify-center min-h-screen bg-slate-50">
      <div className="text-center space-y-3 animate-pulse">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
        <p className="text-slate-400 text-sm font-semibold">Connecting to VenuTube...</p>
      </div>
    </div>
  );
}
