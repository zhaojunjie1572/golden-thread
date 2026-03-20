import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ThemeColors {
  primary: string;
  primaryDark: string;
  bgLight: string;
  bgDark: string;
}

const themeColors: Record<string, ThemeColors> = {
  golden: {
    primary: '#DAA520',
    primaryDark: '#B8860B',
    bgLight: '#FFF8DC',
    bgDark: '#2F2410',
  },
  blue: {
    primary: '#3B82F6',
    primaryDark: '#2563EB',
    bgLight: '#EFF6FF',
    bgDark: '#1E3A5F',
  },
  green: {
    primary: '#10B981',
    primaryDark: '#059669',
    bgLight: '#ECFDF5',
    bgDark: '#064E3B',
  },
  purple: {
    primary: '#8B5CF6',
    primaryDark: '#7C3AED',
    bgLight: '#F5F3FF',
    bgDark: '#4C1D95',
  },
  pink: {
    primary: '#EC4899',
    primaryDark: '#DB2777',
    bgLight: '#FDF2F8',
    bgDark: '#6B1D44',
  },
};

interface ThemeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  currentTheme: string;
  setCurrentTheme: (theme: string) => void;
  colors: ThemeColors;
  availableThemes: string[];
  backgroundImage: string | null;
  setBackgroundImage: (image: string | null) => void;
  brightness: number;
  setBrightness: (value: number) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('dark-mode');
    return saved === 'true';
  });

  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('color-theme') || 'golden';
  });

  const [backgroundImage, setBackgroundImage] = useState<string | null>(() => {
    return localStorage.getItem('background-image') || null;
  });

  const [brightness, setBrightness] = useState(() => {
    const saved = localStorage.getItem('brightness');
    return saved ? parseFloat(saved) : 100;
  });

  useEffect(() => {
    localStorage.setItem('dark-mode', isDarkMode.toString());
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('color-theme', currentTheme);
  }, [currentTheme]);

  useEffect(() => {
    if (backgroundImage) {
      localStorage.setItem('background-image', backgroundImage);
    } else {
      localStorage.removeItem('background-image');
    }
  }, [backgroundImage]);

  useEffect(() => {
    localStorage.setItem('brightness', brightness.toString());
  }, [brightness]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  const colors = themeColors[currentTheme] || themeColors.golden;
  const availableThemes = Object.keys(themeColors);

  return (
    <ThemeContext.Provider
      value={{
        isDarkMode,
        toggleDarkMode,
        currentTheme,
        setCurrentTheme,
        colors,
        availableThemes,
        backgroundImage,
        setBackgroundImage,
        brightness,
        setBrightness,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
