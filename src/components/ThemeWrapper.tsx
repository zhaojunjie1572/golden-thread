import React from 'react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const { isDarkMode, colors, backgroundImage, brightness } = useTheme();

  const bgColor = isDarkMode ? '#111827' : colors.bgLight;
  const textColor = isDarkMode ? '#F3F4F6' : '#1F2937';
  const cardBg = isDarkMode ? '#1F2937' : '#FFFFFF';
  const borderColor = isDarkMode ? '#374151' : '#E5E7EB';

  const brightnessValue = brightness / 100;

  return (
    <div
      className="min-h-screen transition-all duration-300"
      style={{ 
        backgroundColor: bgColor,
        color: textColor,
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
        filter: `brightness(${brightnessValue})`,
        '--theme-primary': colors.primary,
        '--theme-primary-dark': colors.primaryDark,
        '--theme-bg': bgColor,
        '--theme-card-bg': cardBg,
        '--theme-border': borderColor,
      } as React.CSSProperties}
    >
      <style>{`
        .theme-primary { color: ${colors.primary} !important; }
        .theme-primary-bg { background-color: ${colors.primary} !important; }
        .theme-primary-bg:hover { background-color: ${colors.primaryDark} !important; }
        .theme-border { border-color: ${colors.primary} !important; }
        .theme-ring { --tw-ring-color: ${colors.primary}40 !important; }
        
        .theme-card-bg { background-color: ${cardBg} !important; }
        .theme-border-color { border-color: ${borderColor} !important; }
        
        .dark .theme-card-bg { background-color: #1F2937 !important; }
        .dark .theme-border-color { border-color: #374151 !important; }
      `}</style>
      {children}
    </div>
  );
}
