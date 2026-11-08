import { useEffect, useState } from 'react';
import { isCapturableUrl } from '../../shared/settings';

/** Si se puede capturar el audio de la pestaña activa (o ya se está capturando). */
export function useActiveTabCapturable(capturing: boolean): boolean {
  const [capturable, setCapturable] = useState(false);

  useEffect(() => {
    let active = true;
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (active) setCapturable(capturing || isCapturableUrl(tab?.url));
    });
    return () => { active = false; };
  }, [capturing]);

  return capturable;
}
