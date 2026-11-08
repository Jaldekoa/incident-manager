import { useCallback, useEffect, useRef, useState } from 'react';
import { setStored, type AreaState, type StorageArea } from '../../shared/storage';

/**
 * Valor de `chrome.storage[area][key]` sincronizado: se lee al montar y se actualiza con cada cambio,
 * venga de donde venga (service worker, offscreen u otra vista). Devuelve también un setter que lo persiste.
 */
export function useChromeStorage<A extends StorageArea, K extends keyof AreaState<A> & string>(area: A, key: K, fallback: AreaState<A>[K]) {
  type Value = AreaState<A>[K];
  const fallbackRef = useRef(fallback);
  const [value, setValue] = useState<Value>(fallback);

  useEffect(() => {
    let active = true;
    chrome.storage[area].get(key).then((items) => {
      if (active) setValue((items[key] as Value | undefined) ?? fallbackRef.current);
    });
    const listener = (changes: Record<string, chrome.storage.StorageChange>, changedArea: string) => {
      if (changedArea === area && key in changes) setValue((changes[key].newValue as Value | undefined) ?? fallbackRef.current);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => {
      active = false;
      chrome.storage.onChanged.removeListener(listener);
    };
  }, [area, key]);

  const update = useCallback((next: Value) => {
    setValue(next);
    return setStored(area, { [key]: next } as unknown as Partial<AreaState<A>>);
  }, [area, key]);

  return [value, update] as const;
}
