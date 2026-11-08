import { useCallback, useState } from 'react';

export interface StatusMessage {
  text: string;
  error: boolean;
}

/** Mensaje de la barra de estado; `setStatus()` sin texto la oculta. */
export type SetStatus = (text?: string, error?: boolean) => void;

export function useStatus() {
  const [status, setState] = useState<StatusMessage>({ text: '', error: false });
  const setStatus = useCallback<SetStatus>((text = '', error = false) => setState({ text, error }), []);
  return [status, setStatus] as const;
}
