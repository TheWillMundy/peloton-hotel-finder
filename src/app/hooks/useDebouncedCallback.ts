import { useRef, useCallback, useEffect } from 'react';

type Timer = ReturnType<typeof setTimeout>;

interface DebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  cancel: () => void;
}

export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): DebouncedFunction<T> {
  const timeout = useRef<Timer | null>(null);

  const debouncedFunction = useCallback((...args: Parameters<T>) => {
    if (timeout.current) {
      clearTimeout(timeout.current);
    }
    timeout.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);

  const cancel = useCallback(() => {
    if (timeout.current) {
      clearTimeout(timeout.current);
      timeout.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  const fn = debouncedFunction as DebouncedFunction<T>;
  fn.cancel = cancel;
  return fn;
} 