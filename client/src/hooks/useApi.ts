import { useCallback, useEffect, useRef, useState } from "react";

type State<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

/**
 * Load data from one of the services and track loading/error state.
 *
 * `deps` works like useEffect's dependency array — change a filter and the
 * request re-runs. An in-flight request is aborted when that happens, so a slow
 * earlier response can never overwrite a newer one.
 */
export function useApi<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: unknown[] = []
): State<T> & { reload: () => void } {
  const [state, setState] = useState<State<T>>({ data: null, loading: true, error: null });
  const [nonce, setNonce] = useState(0);

  // Keep the latest loader without making it a dependency; callers usually pass
  // an inline arrow function, which would otherwise re-run this on every render.
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setState(previous => ({ ...previous, loading: true, error: null }));

    loaderRef
      .current(controller.signal)
      .then(data => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch(error => {
        if (!active || controller.signal.aborted) return;
        setState({
          data: null,
          loading: false,
          error: error?.message ?? "Something went wrong. Please try again.",
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce(value => value + 1), []);

  return { ...state, reload };
}
