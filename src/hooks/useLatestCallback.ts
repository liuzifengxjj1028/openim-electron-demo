import { useCallback, useRef, useEffect } from "react";

export function useLatestCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const ref = useRef<T>(callback);

  useEffect(() => {
    ref.current = callback;
  }, [callback]);

  return useCallback((...args: any[]) => {
    return ref.current?.(...args);
  }, []) as T;
}
