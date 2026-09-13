import React from 'react';
import { KierivoMark } from './KierivoMark';

export interface LogoProps {
  className?: string;
  /** Sam sygnet — pasek boczny w wersji zwiniętej. */
  collapsed?: boolean;
}

export const KierivoLogo: React.FC<LogoProps> = ({ className = '', collapsed = false }) => (
  <div className={`flex items-center gap-2.5 ${className}`} aria-label="Kierivo">
    <KierivoMark className="h-9 w-10 shrink-0" />

    {!collapsed && (
      <span className="font-sans text-lg font-extrabold tracking-[-0.045em] text-ink">
        Kierivo
      </span>
    )}
  </div>
);
