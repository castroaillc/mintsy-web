import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import type { ModeType } from '@/components/ui/gluestack-ui-provider';

const STORAGE_KEY = 'theme-mode';

type ThemeModeContextValue = {
  mode: ModeType;
  setMode: (mode: ModeType) => void;
  /** False until the saved preference has been read, so the UI doesn't flash the wrong theme. */
  isLoaded: boolean;
};

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

function isMode(value: string | null): value is ModeType {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ModeType>('system');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((saved) => {
        if (isMode(saved)) setModeState(saved);
      })
      .finally(() => setIsLoaded(true));
  }, []);

  const setMode = (next: ModeType) => {
    setModeState(next);
    SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => {});
  };

  return (
    <ThemeModeContext.Provider value={{ mode, setMode, isLoaded }}>
      {children}
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeModeProvider');
  return ctx;
}
