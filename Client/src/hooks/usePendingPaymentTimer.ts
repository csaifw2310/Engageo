import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'engageo-pending-payment-until';
const DEFAULT_DURATION = 15 * 60 * 1000; // 15 minutes

export function usePendingPaymentTimer(duration = DEFAULT_DURATION) {
  const [retryUntil, setRetryUntil] = useState<number | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? Number(saved) : null;
  });

  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!retryUntil) return;

    const tick = () => {
      const remaining = retryUntil - Date.now();

      if (remaining <= 0) {
        localStorage.removeItem(STORAGE_KEY);
        setRetryUntil(null);
        setTimeLeft(0);
        return;
      }

      setTimeLeft(remaining);
    };

    tick();

    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [retryUntil]);

  const startCooldown = (customDuration = duration) => {
    const until = Date.now() + customDuration;

    localStorage.setItem(STORAGE_KEY, String(until));
    setRetryUntil(until);
    setTimeLeft(customDuration);
  };

  const clearCooldown = () => {
    localStorage.removeItem(STORAGE_KEY);
    setRetryUntil(null);
    setTimeLeft(0);
  };

  const formattedTime = useMemo(() => {
    if (timeLeft <= 0) return '0:00';

    const totalSeconds = Math.ceil(timeLeft / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [timeLeft]);

  return {
    isLocked: timeLeft > 0,
    timeLeft,
    formattedTime,
    startCooldown,
    clearCooldown,
  };
}