import { useState, useEffect } from 'react';
import { loadState, saveState } from '../lib/tauri';

export function usePersistedState<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadState<T>(key, defaultValue).then((stored) => {
      setValue(stored);
      setLoaded(true);
    });
  }, [key]);

  useEffect(() => {
    if (loaded) {
      saveState(key, value);
    }
  }, [key, value, loaded]);

  return [value, setValue, loaded] as const;
}
