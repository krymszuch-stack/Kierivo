import React from 'react';
import { motion } from 'motion/react';

export interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
}

export const ScoreRing: React.FC<ScoreRingProps> = ({
  score,
  size = 140,
  strokeWidth = 10,
  label = 'Dopasowanie',
  className = '',
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (score / 100) * circumference;

  const getScoreColor = (val: number) => {
    if (val >= 80) return { stroke: 'var(--success, #10b981)', text: 'text-success-fg', bg: 'bg-success-soft' };
    if (val >= 60) return { stroke: 'var(--warning, #f59e0b)', text: 'text-warning-fg', bg: 'bg-warning-soft' };
    return { stroke: 'var(--danger, #ef4444)', text: 'text-danger-fg', bg: 'bg-danger-soft' };
  };

  const colors = getScoreColor(score);

  return (
    <div className={`relative flex flex-col items-center justify-center ${className}`}>
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="var(--line, rgba(255,255,255,0.1))"
            strokeWidth={strokeWidth}
            fill="transparent"
          />

          {/* Animated Progress Circle */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: progressOffset }}
            transition={{ duration: 1.2, ease: [0.19, 1, 0.22, 1] }}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>

        {/* Inner Score Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <motion.span
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className={`font-mono text-4xl font-extrabold tracking-tight ${colors.text}`}
          >
            {score}%
          </motion.span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
            {label}
          </span>
        </div>
      </div>
    </div>
  );
};
