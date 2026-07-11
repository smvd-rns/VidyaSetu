'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState, Suspense, useRef, useEffect } from 'react';
import { register } from '@/lib/auth';
import { api } from '@/lib/api';
import { Logo } from '@/components/Logo';
import { Card, ErrorBanner, FormField } from '@/components/ui';

interface BatchOption {
  id: string;
  name: string;
  description?: string;
}

interface CenterLookupResult {
  id: string;
  name: string;
  batches: BatchOption[];
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');

  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });

  // Center join parameters on sign-up
  const [joinCode, setJoinCode] = useState('');
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [verifiedCenter, setVerifiedCenter] = useState<CenterLookupResult | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState('');

  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [codeError, setCodeError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const activeCodeRef = useRef('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prefill join parameters from URL on load
  useEffect(() => {
    const codeParam = searchParams.get('code');
    const batchParam = searchParams.get('batch');
    if (codeParam) {
      const upperCode = codeParam.toUpperCase();
      setJoinCode(upperCode);
      activeCodeRef.current = upperCode;
      setVerifyingCode(true);
      api<CenterLookupResult>(`/centers/by-code/${upperCode}`)
        .then((centerData) => {
          setVerifiedCenter(centerData);
          if (batchParam) {
            const matched = centerData.batches.find(
              (b) => b.id === batchParam || b.name.toLowerCase() === batchParam.toLowerCase()
            );
            if (matched) {
              setSelectedBatchId(matched.id);
            } else if (centerData.batches.length > 0) {
              setSelectedBatchId(centerData.batches[0].id);
            }
          } else if (centerData.batches.length > 0) {
            setSelectedBatchId(centerData.batches[0].id);
          }
          setVerifyingCode(false);
        })
        .catch(() => {
          setVerifiedCenter(null);
          setSelectedBatchId('');
          setCodeError('Center not found.');
          setVerifyingCode(false);
        });
    }
  }, [searchParams]);

  // Auto-verify code when user changes the input (debounced 400ms)
  function handleVerifyCode(codeVal: string) {
    const upperVal = codeVal.toUpperCase();
    setJoinCode(upperVal);
    setCodeError('');
    setVerifiedCenter(null);
    setSelectedBatchId('');
    activeCodeRef.current = upperVal.trim();

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!upperVal.trim()) return;

    debounceRef.current = setTimeout(async () => {
      const code = upperVal.trim();
      if (activeCodeRef.current !== code) return;
      setVerifyingCode(true);
      try {
        const centerData = await api<CenterLookupResult>(`/centers/by-code/${code}`);
        if (activeCodeRef.current === code) {
          setVerifiedCenter(centerData);
          setCodeError('');
          if (centerData.batches.length > 0) {
            setSelectedBatchId(centerData.batches[0].id);
          }
        }
      } catch {
        if (activeCodeRef.current === code) {
          setVerifiedCenter(null);
          setSelectedBatchId('');
          setCodeError('Center not found. Please check the code.');
        }
      } finally {
        if (activeCodeRef.current === code) {
          setVerifyingCode(false);
        }
      }
    }, 400);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (form.password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await register({
        ...form,
        joinCode: joinCode.trim() || undefined,
        batchId: selectedBatchId || undefined,
      });

      if (redirect) {
        router.push(redirect);
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError((err as { message?: string }).message ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border">
      <h1 className="font-display text-center text-2xl font-bold text-maroon">Begin your journey</h1>
      <p className="mt-2 text-center text-sm text-slate-500">Join as a student or future center owner</p>
      <div className="divider-ornament my-6 text-center text-amber-500">✦</div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorBanner message={error} />}

        {/* 1. Center / Org Join Code (Primary) */}
        <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 space-y-3">
          <FormField label="Center / Org Join Code (Optional)" hint="Provide code to link classroom instantly">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => handleVerifyCode(e.target.value)}
              className="input-devotional uppercase tracking-wider font-semibold bg-white"
              placeholder="e.g. COLLEGE2026"
            />
          </FormField>

          {verifyingCode && (
            <p className="text-[10px] text-indigo-400 mt-1 animate-pulse flex items-center gap-1">⏳ Verifying code...</p>
          )}

          {!verifyingCode && codeError && joinCode && (
            <p className="text-[10px] text-red-500 mt-1 font-semibold">❌ {codeError}</p>
          )}

          {verifiedCenter && (
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3 space-y-2">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Center Found</p>
                <p className="text-xs font-bold text-indigo-950">{verifiedCenter.name}</p>
              </div>

              {verifiedCenter.batches.length > 0 ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 block">Select Standard / Group</label>
                  <select
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    className="input-devotional text-xs py-1.5 font-semibold bg-white"
                  >
                    {verifiedCenter.batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.description ? `(${b.description})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="text-[10px] text-amber-600 font-medium">No classrooms configured for this center yet.</p>
              )}
            </div>
          )}
        </div>

        {/* 2. Personal Information */}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="First name" required>
            <input
              required
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="input-devotional"
            />
          </FormField>
          <FormField label="Last name" required>
            <input
              required
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className="input-devotional"
            />
          </FormField>
        </div>

        <FormField label="Email address" required>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="input-devotional"
            placeholder="you@example.com"
          />
        </FormField>

        {/* 3. Credentials (with confirmations and toggles) */}
        <FormField label="Password" required hint="Minimum 8 characters">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="input-devotional pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer text-sm"
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </FormField>

        <FormField label="Confirm Password" required>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-devotional pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer text-sm"
            >
              {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </FormField>

        <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already registered?{' '}
        <Link href={`/login${redirect ? '?redirect=' + encodeURIComponent(redirect) : ''}`} className="font-semibold text-saffron hover:text-saffron-dark">
          Sign in
        </Link>
      </p>
    </Card>
  );
}

export default function RegisterPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 bg-slate-50 min-h-screen">
      <div className="mb-8 text-center animate-fadeIn flex justify-center">
        <Logo size="md" showTagline hideIcon className="justify-center" />
      </div>
      <Suspense fallback={<div className="text-slate-400">Loading form...</div>}>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
