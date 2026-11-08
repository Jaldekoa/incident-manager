import type { StatusMessage } from '../hooks/useStatus';

export function StatusBar({ status }: { status: StatusMessage }) {
  return (
    <p id="status" className={`status-message${status.error ? ' error' : ''}`} role="status" aria-live="polite" hidden={!status.text}>
      {status.text}
    </p>
  );
}
