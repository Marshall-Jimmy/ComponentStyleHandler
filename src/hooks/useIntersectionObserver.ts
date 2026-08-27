import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * IntersectionObserver Hook
 * 用于 iframe 懒加载：仅当元素进入视口时才触发回调。
 */

export function useIntersectionObserver<T extends HTMLElement>(options?: IntersectionObserverInit) {
  const ref = useRef<T | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '200px', ...options },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [options]);

  const setRef = useCallback((node: T | null) => {
    ref.current = node;
  }, []);

  return { ref: setRef, isVisible };
}
