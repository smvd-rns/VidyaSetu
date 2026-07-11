import Link from 'next/link';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  hideIcon?: boolean;
  className?: string;
}

export function Logo({ size = 'md', showTagline = false, hideIcon = false, className = '' }: LogoProps) {
  const sizes = {
    sm: { icon: 'h-8 w-8 text-lg', title: 'text-2xl', tag: 'text-xs', flute: 'w-20 h-3' },
    md: { icon: 'h-10 w-10 text-xl', title: 'text-4xl', tag: 'text-sm', flute: 'w-32 h-5' },
    lg: { icon: 'h-14 w-14 text-3xl', title: 'text-6xl', tag: 'text-base', flute: 'w-48 h-6' },
  };
  const s = sizes[size];

  return (
    <Link href="/" className={`group flex items-center gap-3 ${className}`}>
      {!hideIcon && (
        <div
          className={`${s.icon} flex shrink-0 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white shadow-md transition group-hover:bg-indigo-700`}
          aria-hidden
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.263 15.541A22.89 22.89 0 0 0 12 17.75c2.78 0 5.42-.489 7.737-1.378M2.083 9.007c.504-.2 1.054-.33 1.637-.384M2.083 9.007l1.922-.769M2.083 9.007A3.332 3.332 0 0 0 1.5 11.75c0 .95.4 1.81 1.042 2.42M12 2.25c-2.78 0-5.42.489-7.737 1.378M12 2.25c2.78 0 5.42.489 7.737 1.378M12 2.25l7.737 3.094M12 2.25L4.263 5.344m15.474 3.663c-.504-.2-1.054-.33-1.637-.384M19.737 9.007l-1.922-.769M19.737 9.007a3.332 3.332 0 0 1 .58 2.743c0 .95-.4 1.81-1.042 2.42M4.263 5.344a22.89 22.89 0 0 0-1.637 3.279m15.474-3.279c.683.273 1.233.729 1.637 1.279m-1.637-1.279a22.89 22.89 0 0 1 1.637 3.279M4.263 5.344L12 8.438l7.737-3.094M3.704 8.246a22.89 22.89 0 0 0-1.621 3.284M18.063 8.246a22.89 22.89 0 0 1 1.621 3.284M12 17.75c-2.78 0-5.42-.489-7.737-1.378M12 17.75l-7.737-3.094M12 17.75l7.737-3.094M4.263 14.656a22.89 22.89 0 0 1-1.621-3.284M19.737 14.656a22.89 22.89 0 0 0 1.621-3.284"
            />
          </svg>
        </div>
      )}
      <div className={`flex flex-col ${hideIcon ? 'items-center text-center' : 'items-start'}`}>
        <span className={`font-display ${s.title} font-extrabold tracking-wide leading-none`}>
          <span className="text-indigo-950 italic">venu</span>
          <span className="text-red-600 font-bold">Tube</span>
        </span>
        {/* Stylistic Flute ornament below the text */}
        <svg className={`${s.flute} mt-1.5 text-amber-500`} viewBox="0 0 100 24" fill="currentColor">
          {/* Main flute body */}
          <rect x="5" y="10" width="80" height="4" rx="2" />
          {/* Flute holes */}
          <circle cx="22" cy="12" r="1" fill="#fff" />
          <circle cx="32" cy="12" r="1" fill="#fff" />
          <circle cx="42" cy="12" r="1" fill="#fff" />
          <circle cx="52" cy="12" r="1" fill="#fff" />
          <circle cx="62" cy="12" r="1" fill="#fff" />
          <circle cx="72" cy="12" r="1" fill="#fff" />
          {/* Decorative thread/tassel at the end */}
          <path d="M 80 12 C 82 15, 84 17, 88 18" stroke="currentColor" strokeWidth="1.25" fill="none" strokeLinecap="round" />
          <path d="M 80 12 C 83 14, 85 15, 85 19" stroke="currentColor" strokeWidth="1.25" fill="none" strokeLinecap="round" />
          <circle cx="88" cy="18" r="1.25" />
          <circle cx="85" cy="19" r="1.25" />
        </svg>
        {showTagline && (
          <p className={`${s.tag} text-muted mt-2`}>Professional College Education Portal</p>
        )}
      </div>
    </Link>
  );
}
