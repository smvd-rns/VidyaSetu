import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Navbar } from '@/components/Navbar';

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <Navbar />

      <main className="mx-auto flex max-w-5xl flex-1 flex-col items-center px-4 py-16 text-center sm:py-24">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold-light bg-parchment px-4 py-1.5 text-xs font-medium text-maroon">
          <span className="text-saffron">ॐ</span> Serving seekers of knowledge
        </div>

        <Logo size="lg" showTagline />

        <h1 className="font-display mt-10 max-w-3xl text-4xl font-bold leading-tight text-maroon sm:text-5xl">
          A sacred bridge between{' '}
          <span className="text-saffron">gurus</span>, centers, and students
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          VidyaSetu helps coaching institutes share courses, videos, notes, and tests — each center
          in its own peaceful space, guided by dedicated teachers.
        </p>

        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <Link href="/login?redirect=/apply-center" className="btn-primary px-8 py-3 text-base">
            Open a center
          </Link>
          <Link href="/login" className="btn-outline px-8 py-3 text-base">
            Student sign in
          </Link>
        </div>

        <div className="mt-20 grid w-full max-w-3xl gap-6 sm:grid-cols-3">
          {[
            { icon: '🪷', title: 'Centers apply', desc: 'Institutes register and await blessing of approval' },
            { icon: '📿', title: 'Teachers guide', desc: 'Admins, teachers & staff nurture their students' },
            { icon: '📖', title: 'Students learn', desc: 'Videos, notes & tests in one devoted space' },
          ].map((item) => (
            <div
              key={item.title}
              className="card-devotional rounded-xl p-5 text-left transition hover:shadow-lg"
            >
              <span className="text-2xl">{item.icon}</span>
              <h3 className="font-display mt-3 text-lg font-semibold text-maroon">{item.title}</h3>
              <p className="mt-1 text-sm text-muted">{item.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted">
        VidyaSetu · Where knowledge meets devotion
      </footer>
    </div>
  );
}
