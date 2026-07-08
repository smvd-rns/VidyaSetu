import Link from 'next/link';
import { Logo } from './Logo';

interface NavbarProps {
  variant?: 'public' | 'app';
  onLogout?: () => void;
}

export function Navbar({ variant = 'public', onLogout }: NavbarProps) {
  return (
    <header className="border-b border-border/80 bg-white/95 backdrop-blur-sm sticky top-0 z-50">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Logo size="sm" />
        <nav className="flex items-center gap-3 text-sm">
          {variant === 'public' ? (
            <>
              <Link href="/login" className="font-semibold text-indigo-950 hover:text-indigo-600 transition">
                Sign in
              </Link>
              <Link href="/register" className="btn-primary px-4 py-2">
                Get started
              </Link>
            </>
          ) : (
            onLogout && (
              <button type="button" onClick={onLogout} className="btn-outline px-4 py-2">
                Logout
              </button>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
