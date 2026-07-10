import Link from 'next/link';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

export function Logo({ size = 'md', showTagline = false }: LogoProps) {
  const sizes = {
    sm: { icon: 'h-8 w-8 text-lg', title: 'text-xl', tag: 'text-xs' },
    md: { icon: 'h-10 w-10 text-xl', title: 'text-2xl', tag: 'text-sm' },
    lg: { icon: 'h-14 w-14 text-3xl', title: 'text-4xl', tag: 'text-base' },
  };
  const s = sizes[size];

  return (
    <Link href="/" className="group flex items-center gap-3">
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
      <div>
        <span className={`font-sans ${s.title} font-extrabold tracking-tight text-indigo-950`}>
          VenuTube
        </span>
        {showTagline && (
          <p className={`${s.tag} text-muted`}>Professional College Education Portal</p>
        )}
      </div>
    </Link>
  );
}
