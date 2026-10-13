import { useCallback, useEffect, useState, type DependencyList } from 'react';
import { ApiError } from './api';

type ApiState<T> = {
  data: T | undefined;
  error: ApiError | undefined;
  loading: boolean;
};

/**
 * Loads data when `deps` change. Each run gets its own AbortController, so a
 * slow response for old filters can never overwrite the result for new ones.
 * Previous data stays visible while a reload is in flight.
 */
export function useApi<T>(fetcher: (signal: AbortSignal) => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<ApiState<T>>({ data: undefined, error: undefined, loading: true });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState(prev => ({ ...prev, loading: true }));

    fetcher(controller.signal).then(
      data => setState({ data, error: undefined, loading: false }),
      (err: unknown) => {
        if (controller.signal.aborted) return;
        const error =
          err instanceof ApiError ? err : new ApiError(0, 'Unexpected error while loading data.');
        setState(prev => ({ ...prev, error, loading: false }));
      },
    );

    return () => controller.abort();
  }, [...deps, reloadKey]); // `fetcher` is recreated each render; `deps` lists what it reads.

  const reload = useCallback(() => setReloadKey(key => key + 1), []);

  /** Replace the data locally, e.g. with the response of a successful update. */
  const setData = useCallback((data: T) => setState({ data, error: undefined, loading: false }), []);

  return { ...state, reload, setData };
}
