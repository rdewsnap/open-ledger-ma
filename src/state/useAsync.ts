import { useEffect, useState } from 'react';

export type AsyncState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'ready'; data: T; error?: undefined }
  | { status: 'error'; data?: undefined; error: Error };

/** Minimal promise → state hook. `key` changes re-run the loader. */
export function useAsync<T>(load: () => Promise<T>, key: string): AsyncState<T> {
  const [state, setState] = useState<{ key: string; value: AsyncState<T> }>({
    key,
    value: { status: 'loading' },
  });

  useEffect(() => {
    let live = true;
    load().then(
      (data) => live && setState({ key, value: { status: 'ready', data } }),
      (error: unknown) =>
        live &&
        setState({
          key,
          value: { status: 'error', error: error instanceof Error ? error : new Error(String(error)) },
        }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state.key === key ? state.value : { status: 'loading' };
}
