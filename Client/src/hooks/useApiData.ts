import { useState, useEffect, useCallback } from "react";
import type { AxiosError } from "axios";

type ApiErrorResponse = {
  message?: string;
  errors?: {
    msg: string;
  }[];
};

interface State<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApiData<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<State<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const fetch = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetcher();
      setState({ data, loading: false, error: null });
    } catch (err) {
      const e = err as AxiosError<{ message: string }>;
      const msg =
        e.response?.data?.message ??
        (err instanceof Error ? err.message : "Failed to load");
      setState({ data: null, loading: false, error: msg });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { ...state, refetch: fetch };
}

export function getApiErrorMessage(err: unknown): string {
  const e = err as AxiosError<ApiErrorResponse>;

  if (e.response?.data?.errors?.length) {
    return e.response.data.errors.map((x) => x.msg).join(", ");
  }

  return (
    e.response?.data?.message ??
    (err instanceof Error ? err.message : "Something went wrong")
  );
}
