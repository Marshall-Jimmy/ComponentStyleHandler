import { useEffect, useRef } from 'react';

/** 节流 Hook：在 delay 毫秒内最多执行一次回调（用于窗口 resize 等高频事件） */
export function useThrottle<T extends unknown[]>(fn: (...args: T) => void, delay: number) {
  const lastRun = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (...args: T) => {
    const now = Date.now();
    const remaining = delay - (now - lastRun.current);
    if (remaining <= 0) {
      lastRun.current = now;
      fnRef.current(...args);
    } else if (!timer.current) {
      timer.current = setTimeout(() => {
        lastRun.current = Date.now();
        timer.current = null;
        fnRef.current(...args);
      }, remaining);
    }
  };
}
