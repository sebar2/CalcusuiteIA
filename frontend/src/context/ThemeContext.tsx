import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiService } from '../services/api';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setCurrentTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('calcu_theme');
      if (saved === 'dark' || saved === 'dark_bitrix') return 'dark';
      if (saved === 'light' || saved === 'light_bitrix') return 'light';
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const applyTheme = (targetTheme: Theme) => {
    const root = document.documentElement;
    if (targetTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('calcu_theme', targetTheme);
    } catch (e) {
      console.warn('Could not persist theme in localStorage', e);
    }
  };

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setCurrentTheme(newTheme);
    applyTheme(newTheme);
    // Sincronizar con backend en segundo plano
    apiService.saveUserPreferences({
      user_id: 'default_user',
      active_theme: newTheme === 'dark' ? 'dark_bitrix' : 'light_bitrix'
    }).catch(err => console.warn('Could not sync theme with backend', err));
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === 'dark', toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
