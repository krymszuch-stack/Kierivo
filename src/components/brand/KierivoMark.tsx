import React from 'react';

export interface KierivoMarkProps {
  className?: string;
}

/**
 * Geometria znaku ma jedno źródło w `public/brand/kierivo-mark.svg`.
 * Komponent jedynie osadza plik, żeby favicon, materiały i interfejs nie
 * rozjechały się po kolejnej korekcie proporcji.
 */
export const KierivoMark: React.FC<KierivoMarkProps> = ({ className = 'h-8 w-8' }) => (
  <img
    src="/brand/kierivo-mark.svg"
    alt=""
    aria-hidden="true"
    className={className}
    draggable={false}
  />
);
