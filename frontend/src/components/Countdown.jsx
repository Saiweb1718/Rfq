import { useState, useEffect } from 'react';
import { differenceInSeconds, differenceInMinutes, differenceInHours } from 'date-fns';

export default function Countdown({
  targetTime,
  triggerWindowMinutes,
  label = 'Time Remaining',
  onExpired,
  className = '',
}) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const target = new Date(targetTime);
  const totalSeconds = Math.max(0, differenceInSeconds(target, now));
  const hours = differenceInHours(target, now);
  const minutes = differenceInMinutes(target, now) % 60;
  const seconds = totalSeconds % 60;

  const isExpired = totalSeconds <= 0;
  const isInTriggerWindow = triggerWindowMinutes
    ? totalSeconds <= triggerWindowMinutes * 60 && !isExpired
    : false;

  useEffect(() => {
    if (isExpired && onExpired) onExpired();
  }, [isExpired, onExpired]);

  const getColorClass = () => {
    if (isExpired) return 'text-danger-400';
    if (isInTriggerWindow) return 'text-warning-400';
    if (totalSeconds < 300) return 'text-warning-500';
    return 'text-success-400';
  };

  const pad = (n) => n.toString().padStart(2, '0');

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <span className="text-xs uppercase tracking-widest text-surface-600 mb-1">
        {label}
      </span>
      <div
        className={`font-mono text-2xl font-bold tabular-nums ${getColorClass()} ${
          isInTriggerWindow ? 'animate-pulse-glow rounded-lg px-3 py-1' : ''
        }`}
      >
        {isExpired ? (
          <span className="text-danger-400">EXPIRED</span>
        ) : (
          `${pad(Math.max(0, hours))}:${pad(Math.max(0, minutes))}:${pad(Math.max(0, seconds))}`
        )}
      </div>
      {isInTriggerWindow && (
        <span className="text-xs text-warning-400 mt-1 animate-fade-in">
          ⚡ Trigger window active
        </span>
      )}
    </div>
  );
}
