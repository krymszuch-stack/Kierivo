import React from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  badgeVariant?: 'brand' | 'success' | 'warning';
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  badge,
  badgeVariant = 'brand',
  actions,
  className = '',
}) => {
  const badgeStyles = {
    brand: 'bg-brand-50 text-brand-fg border-brand-200',
    success: 'bg-success-soft text-success-fg border-success/30',
    warning: 'bg-warning-soft text-warning-fg border-warning/30',
  };

  return (
    <div
      className={`mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div>
        <div className="flex items-center gap-2.5">
          <h2 className="text-xl font-extrabold text-ink sm:text-2xl tracking-tight m-0">
            {title}
          </h2>
          {badge && (
            <span
              className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                badgeStyles[badgeVariant]
              }`}
            >
              {badge}
            </span>
          )}
        </div>

        {description && (
          <p className="mt-1 text-xs text-muted leading-relaxed sm:text-sm">
            {description}
          </p>
        )}
      </div>

      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
};
