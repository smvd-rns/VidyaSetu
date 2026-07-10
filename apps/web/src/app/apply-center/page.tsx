'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getMe } from '@/lib/auth';
import { api } from '@/lib/api';
import { Navbar } from '@/components/Navbar';
import { Card, ErrorBanner, FormField, PageShell, SuccessBanner } from '@/components/ui';

export default function ApplyCenterPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    city: '',
    state: '',
    phone: '',
    email: '',
    message: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getMe()
      .then((me) => {
        setForm((prev) => ({ ...prev, email: me.email }));
        setReady(true);
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload: Record<string, string> = {
        name: form.name,
        description: form.description,
        city: form.city,
        state: form.state,
        message: form.message,
      };
      if (form.email.trim()) payload.email = form.email.trim();
      if (form.phone.trim()) payload.phone = form.phone.trim();

      await api('/centers/apply', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSuccess(true);
    } catch (err) {
      setError((err as { message?: string }).message ?? 'Application failed');
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-1 flex-col">
        <Navbar variant="app" onLogout={() => router.push('/login')} />
        <PageShell maxWidth="md">
          <SuccessBanner
            title="Application submitted with gratitude"
            message="The Super Admin will review your center. You will receive access once approved."
          />
          <Link href="/dashboard" className="btn-primary mx-auto mt-8 block w-fit">
            Return to dashboard
          </Link>
        </PageShell>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <Navbar variant="app" onLogout={() => router.push('/dashboard')} />

      <PageShell
        title="Apply for a center"
        subtitle="Share your institute details. Upon approval, you become the Center Admin and can guide your students."
        maxWidth="lg"
      >
        <Card>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <ErrorBanner message={error} />}

            <FormField label="Center name" required>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-devotional"
                placeholder="e.g. NVCC Pune"
              />
            </FormField>

            <FormField label="About your center" hint="Brief description of your institute">
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input-devotional resize-none"
                placeholder="What subjects or traditions do you teach?"
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="City">
                <input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="input-devotional"
                  placeholder="Pune"
                />
              </FormField>
              <FormField label="State">
                <input
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  className="input-devotional"
                  placeholder="Maharashtra"
                />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Contact email" hint="Optional — for center inquiries">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="input-devotional"
                  placeholder="center@example.com"
                />
              </FormField>
              <FormField label="Phone number" hint="Optional">
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="input-devotional"
                  placeholder="+91 ..."
                />
              </FormField>
            </div>

            <FormField label="Message to Super Admin" hint="Why do you wish to join VenuTube?">
              <textarea
                rows={3}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="input-devotional resize-none"
                placeholder="Share your vision..."
              />
            </FormField>

            <div className="flex flex-wrap gap-3 pt-2">
              <button type="submit" disabled={loading} className="btn-primary px-8 py-3">
                {loading ? 'Submitting…' : 'Submit application'}
              </button>
              <Link href="/dashboard" className="btn-outline px-8 py-3">
                Cancel
              </Link>
            </div>
          </form>
        </Card>
      </PageShell>
    </div>
  );
}
