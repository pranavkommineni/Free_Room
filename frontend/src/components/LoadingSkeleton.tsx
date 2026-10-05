import React from 'react';

export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm animate-pulse"
        >
          <div className="flex justify-between items-center mb-4">
            <div className="h-6 bg-slate-200 rounded w-24"></div>
            <div className="h-5 bg-slate-200 rounded-full w-20"></div>
          </div>
          <div className="space-y-2 mb-4">
            <div className="h-4 bg-slate-100 rounded w-full"></div>
            <div className="h-4 bg-slate-100 rounded w-3/4"></div>
          </div>
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <div className="h-8 bg-slate-200 rounded flex-1"></div>
            <div className="h-8 bg-slate-200 rounded flex-1"></div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 5,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm animate-pulse">
      <div className="h-12 bg-slate-100 border-b border-slate-200 flex items-center px-6">
        <div className="h-4 bg-slate-200 rounded w-48"></div>
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="p-4 flex gap-4 items-center">
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={c}
                className="h-4 bg-slate-100 rounded flex-1"
                style={{ width: `${Math.floor(100 / cols)}%` }}
              ></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export const StatSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm animate-pulse"
        >
          <div className="h-3 bg-slate-200 rounded w-20 mb-2"></div>
          <div className="h-8 bg-slate-200 rounded w-16 mb-1"></div>
          <div className="h-2 bg-slate-100 rounded w-12"></div>
        </div>
      ))}
    </div>
  );
};
