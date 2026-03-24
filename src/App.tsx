import { useState, useRef, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { ProtocolProvider } from './context/ProtocolContext';
import { BookProvider } from './context/BookContext';
import { MusicProvider } from './context/MusicContext';
import { SpeechProvider, useSpeech } from './context/SpeechContext';
import { useTheme } from './context/ThemeContext';
import ThemeWrapper from './components/ThemeWrapper';
import TodayView from './components/TodayView';
import ProtocolCreateView from './components/ProtocolCreateView';
import ActionProtocolView from './components/ActionProtocolView';
import ProtocolsListView from './components/ProtocolsListView';
import AIAssistantView from './components/AIAssistantView';
import BookView from './components/BookView';
import { SyncManagerView } from './components/SyncManagerView';
import AgentWorkflowView from './components/AgentWorkflowView';
import { GitHubGistSyncService } from './services/githubGistSyncService';

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

function SpeechPlayer() {
  const {
    speechState,
    pauseSpeaking,
    resumeSpeaking,
    stopSpeaking,
    nextParagraph: speechNextParagraph,
    prevParagraph: speechPrevParagraph,
  } = useSpeech();

  if (!speechState.isPlaying && !speechState.isPaused) return null;

  const progress = speechState.totalParagraphs > 0 
    ? ((speechState.currentParagraphIndex + 1) / speechState.totalParagraphs) * 100 
    : 0;

  return (
    <div className="border-b theme-border-color px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 shadow-sm">
      <div className="max-w-xl mx-auto">
        <div className="mb-2">
          <div className="flex justify-between text-xs text-amber-700 mb-1">
            <span>朗读进度</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-1.5 bg-amber-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-400 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md ${speechState.isPlaying ? 'animate-pulse' : ''}`}>
            <span className="text-lg">📖</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-amber-900 truncate">
              {speechState.bookTitle} - {speechState.bookAuthor}
            </div>
            <div className="text-xs text-amber-700 truncate mt-0.5">
              {speechState.currentParagraph.substring(0, 50)}{speechState.currentParagraph.length > 50 ? '...' : ''}
            </div>
          </div>
          <button
            onClick={speechPrevParagraph}
            disabled={speechState.currentParagraphIndex <= 0}
            className="p-2 text-amber-700 hover:bg-amber-100 rounded-full disabled:opacity-30 transition-all hover:scale-110"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>
          <button
            onClick={speechState.isPaused ? resumeSpeaking : pauseSpeaking}
            className="p-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full hover:from-amber-600 hover:to-orange-600 shadow-lg transition-all hover:scale-105 active:scale-95"
          >
            {speechState.isPaused ? (
              <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
              </svg>
            )}
          </button>
          <button
            onClick={speechNextParagraph}
            disabled={speechState.currentParagraphIndex >= speechState.totalParagraphs - 1}
            className="p-2 text-amber-700 hover:bg-amber-100 rounded-full disabled:opacity-30 transition-all hover:scale-110"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
          <button
            onClick={stopSpeaking}
            className="p-2 text-red-600 hover:bg-red-100 rounded-full transition-all hover:scale-110"
            title="停止朗读"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}



function AppContentWithMusicAndSpeech() {
  const navigate = useNavigate();
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

  // 启动自动同步
  useEffect(() => {
    const config = GitHubGistSyncService.getConfig();
    
    if (!config) {
      console.log('[自动同步] 未配置同步设置');
      return;
    }
    
    if (!config.autoSync) {
      console.log('[自动同步] 自动同步已关闭');
      return;
    }
    
    if (!config.token) {
      console.log('[自动同步] 未配置 GitHub Token，无法启动自动同步');
      return;
    }
    
    if (!config.gistId) {
      console.log('[自动同步] 未配置 Gist ID，首次同步将创建新的 Gist');
    }
    
    console.log('[自动同步] 正在启动...');
    GitHubGistSyncService.startAutoSync((result) => {
      if (result.success) {
        console.log('[自动同步] 同步成功:', result.message);
      } else {
        console.log('[自动同步] 同步失败:', result.message);
      }
    });

    return () => {
      GitHubGistSyncService.stopAutoSync();
    };
  }, []);

  return (
    <ThemeWrapper>
      <div className="min-h-screen">
        <header className="fixed top-0 left-0 right-0 z-30">
          <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
            <h1 className="text-lg sm:text-xl font-bold" style={{ color: colors.primary }}>金线</h1>
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => navigate('/sync')}
                className="p-2 sm:p-2 rounded-xl transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                title="数据同步"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={() => setShowThemeSettings(!showThemeSettings)}
                className="p-2 sm:p-2 rounded-xl transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                title="主题设置"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </button>
              <button
                onClick={toggleDarkMode}
                className="p-2 sm:p-2 rounded-xl transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                title={isDarkMode ? '切换到浅色模式' : '切换到深色模式'}
              >
                {isDarkMode ? (
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

        <nav className="fixed bottom-0 left-0 right-0 z-40 theme-card-bg border-t theme-border-color">
          <SpeechPlayer />
          <div className="px-2 sm:px-4 py-1 sm:py-2">
            <div className="max-w-xl mx-auto">
              <div className="flex justify-around items-center">
                <NavItem to="/action" icon="🚀" label="智库" />
                <NavItem to="/" icon="☀️" label="今日" />
                <NavItem to="/workflow" icon="🧠" label="工作流" />
                <NavItem to="/books" icon="📚" label="读书" />
                <NavItem to="/ai" icon="🤖" label="AI助手" />
              </div>
            </div>
          </div>
        </nav>

        <main className="pt-16 sm:pt-20 pb-24 sm:pb-32">
          <Routes>
            <Route path="/" element={<TodayView />} />
            <Route path="/action" element={<ActionProtocolView />} />
            <Route path="/create" element={<ProtocolCreateView />} />
            <Route path="/protocols" element={<ProtocolsListView />} />
            <Route path="/books" element={<BookView />} />
            <Route path="/ai" element={<AIAssistantView />} />
            <Route path="/sync" element={<SyncManagerView />} />
            <Route path="/workflow" element={<AgentWorkflowView />} />
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
        `flex flex-col items-center gap-0.5 sm:gap-1 py-1.5 sm:py-2 px-2 sm:px-4 rounded-xl transition-colors ${
          isActive ? 'theme-primary theme-primary-bg' : 'text-gray-500'
        }`
      }
      style={({ isActive }) => ({
        color: isActive ? '#fff' : undefined,
        backgroundColor: isActive ? colors.primary : undefined,
      })}
    >
      <span className="text-xl sm:text-2xl">{icon}</span>
      <span className="text-[10px] sm:text-xs font-medium">{label}</span>
    </NavLink>
  );
}

function AppContent() {
  return (
    <MusicProvider>
      <SpeechProvider>
        <AppContentWithMusicAndSpeech />
      </SpeechProvider>
    </MusicProvider>
  );
}

function App() {
  return (
    <ProtocolProvider>
      <BookProvider>
        <HashRouter>
          <AppContent />
        </HashRouter>
      </BookProvider>
    </ProtocolProvider>
  );
}

export default App;
