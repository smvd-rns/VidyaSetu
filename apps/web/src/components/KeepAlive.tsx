'use client';

/**
 * KeepAlive — prevents Render free-tier cold starts.
 *
 * Pings GET /api/v1/health every PING_INTERVAL_MS while the page is visible.
 * Uses the Page Visibility API so it pauses when the tab/app is backgrounded
 * (saves battery on mobile, no wasted requests).
 *
 * Mount this once inside the root layout so it runs on every page.
 */

import { useEffect } from 'react';

// 10 minutes — well under Render's 15-minute sleep threshold
const PING_INTERVAL_MS = 10 * 60 * 1000;

function getApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }
  return 'http://localhost:3001';
}

async function ping() {
  try {
    await fetch(`${getApiBase()}/api/v1/health`, {
      method: 'GET',
      cache: 'no-store',
      // Don't send credentials — this is a fire-and-forget wake-up call
    });
  } catch {
    // Silently ignore — server may still be waking up
  }
}

export function KeepAlive() {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    // Ping immediately on mount so the server is warm right away
    ping();

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startInterval = () => {
      if (intervalId) return;
      intervalId = setInterval(ping, PING_INTERVAL_MS);
    };

    const stopInterval = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    // Start/stop based on page visibility (saves resources when app is backgrounded)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        ping(); // Ping immediately when user returns to the tab
        startInterval();
      } else {
        stopInterval();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    startInterval(); // Start right away

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopInterval();
    };
  }, []);

  // Renders nothing — purely behavioural
  return null;
}
