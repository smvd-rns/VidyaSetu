import { ReactNode } from 'react';

interface PageShellProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  maxWidth?: 'md' | 'lg' | 'xl' | 'full';
}

export function PageShell({ children, title, subtitle, maxWidth = 'lg' }: PageShellProps) {
  const widths = { md: 'max-w-md', lg: 'max-w-xl', xl: 'max-w-4xl', full: 'max-w-[1500px]' };

  return (
    <div className={`mx-auto w-full ${widths[maxWidth]} px-4 py-10`}>
      {(title || subtitle) && (
        <div className="mb-8 text-center">
          {title && (
            <h1 className="font-sans text-3xl font-extrabold tracking-tight text-indigo-950 sm:text-4xl">{title}</h1>
          )}
          {subtitle && <p className="mt-3 text-sm leading-relaxed text-muted">{subtitle}</p>}
          <div className="divider-ornament mx-auto mt-6 max-w-xs"></div>
        </div>
      )}
      {children}
    </div>
  );
}

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div
      {...props}
      className={`card-devotional rounded-2xl p-6 sm:p-8 bg-white border border-border shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

interface FormFieldProps {
  label: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
}

export function FormField({ label, required, children, hint }: FormFieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-indigo-950">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {message}
    </div>
  );
}

export function SuccessBanner({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-xl border border-green-200 bg-green-50/80 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl text-green-700">
        ✓
      </div>
      <h2 className="font-display text-xl font-bold text-green-800">{title}</h2>
      <p className="mt-2 text-sm text-green-700">{message}</p>
    </div>
  );
}
