import { useEffect, useState } from 'react';

/** Estado del permiso de micrófono de la extensión, actualizado si cambia mientras el popup está abierto. */
export function useMicPermission(): PermissionState {
  const [state, setState] = useState<PermissionState>('prompt');

  useEffect(() => {
    let permission: PermissionStatus | undefined;
    navigator.permissions.query({ name: 'microphone' as PermissionName })
      .then((status) => {
        permission = status;
        setState(status.state);
        status.onchange = () => setState(status.state);
      })
      .catch(() => setState('prompt'));
    return () => {
      if (permission) permission.onchange = null;
    };
  }, []);

  return state;
}
