import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  headerRight?: ReactNode;
}

/** Consistent card chrome for the progress charts — title, canvas area, and
 * an optional legend/caption row, all inside a shared rounded/shadowed card. */
export default function ChartCard({ title, children, footer, headerRight }: ChartCardProps) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        {headerRight}
      </div>
      {children}
      {footer && <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-400">{footer}</div>}
    </div>
  );
}
