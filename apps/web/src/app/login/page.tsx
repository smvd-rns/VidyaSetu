'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState, Suspense, useEffect } from 'react';
import { login, getMe } from '@/lib/auth';
import { Logo } from '@/components/Logo';
import { Card, ErrorBanner, FormField } from '@/components/ui';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if user has an active session and redirect automatically
    async function checkExistingAuth() {
      try {
        const user = await getMe();
        if (user) {
          if (redirect) {
            router.push(redirect);
          } else if (user.globalRole === 'SUPER_ADMIN') {
            router.push('/super-admin');
          } else {
            router.push('/dashboard');
          }
        }
      } catch (err) {
        // Not authenticated, user stays on login page
      }
    }
    checkExistingAuth();
  }, [router, redirect]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { user } = await login(email, password);
      if (redirect) {
        router.push(redirect);
      } else if (user.globalRole === 'SUPER_ADMIN') {
        router.push('/super-admin');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError((err as { message?: string }).message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border">
      <h1 className="font-display text-center text-2xl font-bold text-maroon">Welcome back</h1>
      <p className="mt-2 text-center text-sm text-slate-500">Enter your account to continue learning</p>
      <div className="divider-ornament my-6 text-center text-amber-500">✦</div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <FormField label="Email address" required>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-devotional"
            placeholder="you@example.com"
          />
        </FormField>
        <FormField label="Password" required>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-devotional"
            placeholder="••••••••"
          />
        </FormField>
        <button type="submit" disabled={loading} className="btn-primary w-full py-3">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        New here?{' '}
        <Link href={`/register${redirect ? '?redirect=' + encodeURIComponent(redirect) : ''}`} className="font-semibold text-saffron hover:text-saffron-dark">
          Create account
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-slate-500">
        Running a center?{' '}
        <Link href="/apply-center" className="font-semibold text-maroon hover:text-saffron">
          Apply here
        </Link>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 bg-slate-50 min-h-screen">
      <div className="mb-8 text-center animate-fadeIn flex justify-center">
        <Logo size="md" showTagline hideIcon className="justify-center" />
      </div>
      <Suspense fallback={<div className="text-slate-400">Loading form...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
