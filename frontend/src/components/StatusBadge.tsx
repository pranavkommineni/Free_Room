import React from 'react';
import { STATUS_CONFIG } from '../constants';

interface StatusBadgeProps {
  status: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className = '',
  size = 'md',
}) => {
  const normalized = status.toUpperCase();
  const config = STATUS_CONFIG[normalized] || {
    label: status,
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
    badge: 'bg-slate-400',
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5',
  };

  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeClasses[size]} ${className}`}
      role="status"
      aria-label={`Status: ${config.label}`}
    >
      <span
        className={`rounded-full mr-1.5 ${config.badge} ${dotSizes[size]}`}
        aria-hidden="true"
      />
      {config.label}
    </span>
  );
};
