import { useState, useRef } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { ProtocolProvider } from './context/ProtocolContext';
import { BookProvider } from './context/BookContext';
import { useTheme } from './context/ThemeContext';
import ThemeWrapper from './components/ThemeWrapper';
import TodayView from './components/TodayView';
import ProtocolCreateView from './components/ProtocolCreateView';
import ActionProtocolView from './components/ActionProtocolView';
import ProtocolsListView from './components/ProtocolsListView';
import AIAssistantView from './components/AIAssistantView';
import BookView from './components/BookView';

const themeColors: Record<string, any> = {
  golden: { primary: '#DAA520' },
  blue: { primary: '#3B82F6' },
  green: { primary: '#10B981' },
  purple: { primary: '#8B5CF6' },
  pink: { primary: '#EC4899' },
};

const themeNames: Record<string, string> = {
  golden: '金色',
  blue: '蓝色',
  green: '绿色',
  purple: '紫色',
  pink: '粉色',
};

function AppContent() {
  const { 
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
  } = useTheme();
  const [showThemeSettings, setShowThemeSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <ThemeWrapper>
      <div className="min-h-screen">
        <header className="sticky top-0 z-30 backdrop-blur-md bg-opacity-80" style={{ backgroundColor: isDarkMode ? '#111827cc' : colors.bgLight + 'cc' }}>
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <h1 className="text-xl font-bold" style={{ color: colors.primary }}>金线</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowThemeSettings(!showThemeSettings)}
                className="p-2 rounded-xl transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                title="主题设置"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </button>
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-xl transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                title={isDarkMode ? '切换到浅色模式' : '切换到深色模式'}
              >
                {isDarkMode ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          
          {showThemeSettings && (
            <div className="border-t theme-border-color max-w-4xl mx-auto px-4 py-3 space-y-4">
              <div>
                <p className="text-sm font-medium mb-3">选择主题颜色</p>
                <div className="flex gap-2 flex-wrap">
                  {availableThemes.map((theme) => (
                    <button
                      key={theme}
                      onClick={() => setCurrentTheme(theme)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        currentTheme === theme 
                          ? 'ring-2 ring-offset-2' 
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ 
                        backgroundColor: themeColors[theme].primary,
                        color: '#fff',
                        boxShadow: currentTheme === theme ? `0 0 0 2px white, 0 0 0 4px ${themeColors[theme].primary}` : undefined,
                      }}
                    >
                      {themeNames[theme]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-3">背景图片</p>
                <div className="flex gap-3 items-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          setBackgroundImage(event.target?.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors theme-primary-bg text-white"
                  >
                    选择本地图片
                  </button>
                  {backgroundImage && (
                    <button
                      onClick={() => setBackgroundImage(null)}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-red-500 text-white hover:bg-red-600"
                    >
                      清除背景
                    </button>
                  )}
                </div>
                {backgroundImage && (
                  <div className="mt-2 w-20 h-20 rounded-lg overflow-hidden border theme-border-color">
                    <img 
                      src={backgroundImage} 
                      alt="背景预览" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">亮度调节</p>
                  <span className="text-sm text-gray-500">{brightness}%</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="150"
                  value={brightness}
                  onChange={(e) => setBrightness(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  style={{ accentColor: colors.primary }}
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>较暗</span>
                  <span>正常</span>
                  <span>较亮</span>
                </div>
              </div>
            </div>
          )}
        </header>

        <nav className="fixed bottom-0 left-0 right-0 z-40 theme-card-bg border-t theme-border-color px-4 py-2">
          <div className="max-w-xl mx-auto">
            <div className="flex justify-around items-center">
              <NavItem to="/action" icon="🚀" label="智库" />
              <NavItem to="/" icon="☀️" label="今日" />
              <NavItem to="/protocols" icon="📋" label="协议" />
              <NavItem to="/books" icon="📚" label="读书" />
              <NavItem to="/ai" icon="🤖" label="AI助手" />
            </div>
          </div>
        </nav>

        <main className="pt-4 pb-24">
          <Routes>
            <Route path="/" element={<TodayView />} />
            <Route path="/action" element={<ActionProtocolView />} />
            <Route path="/create" element={<ProtocolCreateView />} />
            <Route path="/protocols" element={<ProtocolsListView />} />
            <Route path="/books" element={<BookView />} />
            <Route path="/ai" element={<AIAssistantView />} />
          </Routes>
        </main>
      </div>
    </ThemeWrapper>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: string; label: string }) {
  const { colors } = useTheme();
  
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-colors ${
          isActive ? 'theme-primary theme-primary-bg' : 'text-gray-500'
        }`
      }
      style={({ isActive }) => ({
        color: isActive ? '#fff' : undefined,
        backgroundColor: isActive ? colors.primary : undefined,
      })}
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-xs font-medium">{label}</span>
    </NavLink>
  );
}

function App() {
  return (
    <ProtocolProvider>
      <BookProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </BookProvider>
    </ProtocolProvider>
  );
}

export default App;
