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
        '--theme-primary': colors.primary,
        '--theme-primary-dark': colors.primaryDark,
        '--theme-bg': bgColor,
        '--theme-card-bg': cardBg,
        '--theme-border': borderColor,
      } as React.CSSProperties}
    >
      {/* 背景层 - 单独显示背景图片 */}
      {backgroundImage && (
        <div
          className="fixed inset-0 z-0"
          style={{
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            filter: `brightness(${brightnessValue})`,
          }}
        />
      )}
      
      {/* 内容层 - 确保文字可读 */}
      <div className="relative z-10 min-h-screen">
        {children}
      </div>

      <style>{`
        .theme-primary { color: ${colors.primary} !important; }
        .theme-primary-bg { background-color: ${colors.primary} !important; }
        .theme-primary-bg:hover { background-color: ${colors.primaryDark} !important; }
        .theme-border { border-color: ${colors.primary} !important; }
        .theme-ring { --tw-ring-color: ${colors.primary}40 !important; }
        
        .theme-card-bg { 
          background-color: ${isDarkMode ? '#1F2937ee' : '#FFFFFFee'} !important; 
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .theme-border-color { border-color: ${borderColor} !important; }
        
        .dark .theme-card-bg { 
          background-color: #1F2937ee !important; 
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .dark .theme-border-color { border-color: #374151 !important; }
        
        /* 导航栏和头部使用半透明背景 */
        header {
          background-color: ${isDarkMode ? '#111827dd' : colors.bgLight + 'dd'} !important;
          backdrop-filter: blur(12px) !important;
          -webkit-backdrop-filter: blur(12px) !important;
        }
        
        nav {
          background-color: ${isDarkMode ? '#1F2937dd' : '#FFFFFFdd'} !important;
          backdrop-filter: blur(12px) !important;
          -webkit-backdrop-filter: blur(12px) !important;
        }
        
        /* 背景图片模式下的卡片样式优化 */
        ${backgroundImage ? `
        /* 主要内容卡片半透明化 */
        .bg-white, .bg-gray-50, .bg-gray-100 {
          background-color: ${isDarkMode ? '#1F2937ee' : '#FFFFFFee'} !important;
        }
        
        /* 渐变背景卡片增加透明度 */
        [class*="bg-gradient-to"] {
          opacity: 0.95;
        }
        
        /* 模态框和弹窗保持较高透明度 */
        .fixed[class*="bg-white"],
        .fixed[class*="bg-gray-900"] {
          background-color: ${isDarkMode ? '#1F2937' : '#FFFFFF'} !important;
        }
        ` : ''}
      `}</style>
    </div>
  );
}
