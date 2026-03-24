import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProtocols } from '../context/ProtocolContext';
import { useMusic } from '../context/MusicContext';
import { ProtocolModel, goalTypeLabels, triggerTypeLabels } from '../types/protocol';
import MindMapView from './MindMapView';

const defaultWisdomQuotes = [
  { text: "千里之行，始于足下", author: "老子" },
  { text: "业精于勤，荒于嬉", author: "韩愈" },
  { text: "不积跬步，无以至千里", author: "荀子" },
  { text: "天行健，君子以自强不息", author: "周易" },
  { text: "一寸光阴一寸金，寸金难买寸光阴", author: "王贞白" },
  { text: "学而不思则罔，思而不学则殆", author: "孔子" },
  { text: "知之为知之，不知为不知，是知也", author: "孔子" },
  { text: "三人行，必有我师焉", author: "孔子" },
  { text: "生于忧患，死于安乐", author: "孟子" },
  { text: "路漫漫其修远兮，吾将上下而求索", author: "屈原" }
];

const STORAGE_KEY = 'wisdom_quotes';

const formatDate = (() => {
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
  return (date: Date): string => formatter.format(date);
})();

const WisdomQuoteCard = ({ 
  quote, 
  onAdd, 
  onEdit,
  onChange
}: { 
  quote: { text: string; author: string }; 
  onAdd: () => void; 
  onEdit: () => void;
  onChange: () => void;
}) => (
  <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border-2 border-amber-200 p-5 shadow-lg">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-2xl">📜</span>
      <h2 className="text-lg font-bold text-amber-800">醒世恒言</h2>
      <div className="ml-auto flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          className="text-xs bg-amber-500 text-white px-2 py-1 rounded-lg hover:bg-amber-600 transition-colors"
        >
          + 添加
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="text-xs bg-blue-500 text-white px-2 py-1 rounded-lg hover:bg-blue-600 transition-colors"
        >
          编辑
        </button>
      </div>
    </div>
    <div 
      className="bg-white/70 rounded-xl p-4 border border-amber-100 cursor-pointer hover:bg-white/90 transition-colors"
      onClick={onChange}
    >
      <p className="text-lg font-medium text-gray-800 italic leading-relaxed">
        "{quote.text}"
      </p>
      <p className="text-right text-sm text-amber-700 mt-2 font-semibold">
        —— {quote.author}
      </p>
      <p className="text-center text-xs text-amber-500 mt-2">点击更换语录</p>
    </div>
  </div>
);

const QuickActionCard = ({
  title,
  subtitle,
  icon,
  color,
  onClick,
  stats
}: {
  title: string;
  subtitle: string;
  icon: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
  onClick: () => void;
  stats: string;
}) => {
  const colorClasses = {
    blue: 'from-blue-50 to-blue-100 border-blue-200 hover:border-blue-300 text-blue-700',
    green: 'from-green-50 to-green-100 border-green-200 hover:border-green-300 text-green-700',
    purple: 'from-purple-50 to-purple-100 border-purple-200 hover:border-purple-300 text-purple-700',
    orange: 'from-orange-50 to-orange-100 border-orange-200 hover:border-orange-300 text-orange-700'
  };

  const iconBgClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500'
  };

  return (
    <button
      onClick={onClick}
      className={`w-full bg-gradient-to-br ${colorClasses[color]} rounded-2xl border-2 p-6 transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] text-left group`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-12 h-12 ${iconBgClasses[color]} rounded-xl flex items-center justify-center text-white text-2xl shadow-lg group-hover:scale-110 transition-transform`}>
              {icon}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 group-hover:text-gray-900">{title}</h2>
              <p className="text-sm text-gray-500">{subtitle}</p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium bg-white/60 ${colorClasses[color]}`}>
            {stats}
          </span>
        </div>
      </div>
      <div className="mt-4 flex items-center text-sm text-gray-500 group-hover:text-gray-700 transition-colors">
        <span>点击进入</span>
        <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span>
      </div>
    </button>
  );
};

const defaultMusicWebsites = [
  { name: '网易云音乐', url: 'https://music.163.com' },
  { name: 'QQ音乐', url: 'https://y.qq.com' },
  { name: '酷狗音乐', url: 'https://www.kugou.com' },
  { name: '酷我音乐', url: 'https://www.kuwo.cn' },
  { name: 'Spotify', url: 'https://www.spotify.com' },
  { name: 'Apple Music', url: 'https://music.apple.com' },
];

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const MusicPlayer = () => {
  const {
    tracks,
    currentTrackIndex,
    isPlaying,
    volume,
    currentTime,
    duration,
    addTracks,
    removeTrack,
    togglePlay,
    nextTrack,
    prevTrack,
    setVolume,
    setCurrentTrackIndex,
    seek,
    isMusicPlayerVisible,
    toggleMusicPlayerVisible,
  } = useMusic();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showWebsites, setShowWebsites] = useState(false);
  const [showWebsiteEditor, setShowWebsiteEditor] = useState(false);
  const [editingWebsiteIndex, setEditingWebsiteIndex] = useState<number | null>(null);
  const [newWebsiteName, setNewWebsiteName] = useState('');
  const [newWebsiteUrl, setNewWebsiteUrl] = useState('');
  const [showReloadInfo, setShowReloadInfo] = useState(false);

  // 从 localStorage 读取数据 - 使用 lazy initialization
  const [savedMusicInfo, setSavedMusicInfo] = useState(() => {
    try {
      const saved = localStorage.getItem('music-saved-info');
      return saved ? JSON.parse(saved) : { trackNames: [], lastReload: null };
    } catch {
      return { trackNames: [], lastReload: null };
    }
  });

  const [musicWebsites, setMusicWebsites] = useState(() => {
    try {
      const saved = localStorage.getItem('music-websites');
      return saved ? JSON.parse(saved) : defaultMusicWebsites;
    } catch {
      return defaultMusicWebsites;
    }
  });

  // 合并多个 useEffect 为一个
  useEffect(() => {
    localStorage.setItem('music-websites', JSON.stringify(musicWebsites));
  }, [musicWebsites]);

  useEffect(() => {
    if (tracks.length > 0) {
      const trackNames = tracks.map(t => ({ name: t.name, fileName: t.fileName }));
      const newInfo = { trackNames, lastReload: Date.now() };
      setSavedMusicInfo(newInfo);
      localStorage.setItem('music-saved-info', JSON.stringify(newInfo));
    }
  }, [tracks]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newTracks = files
      .filter(file => file.type.startsWith('audio/'))
      .map(file => ({
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^/.]+$/, ''),
        fileName: file.name,
        url: URL.createObjectURL(file),
      }));

    if (newTracks.length > 0) {
      addTracks(newTracks);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [addTracks]);

  const openMusicWebsite = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    setShowWebsites(false);
  }, []);

  const openAddWebsiteModal = useCallback(() => {
    setEditingWebsiteIndex(null);
    setNewWebsiteName('');
    setNewWebsiteUrl('');
    setShowWebsiteEditor(true);
  }, []);

  const openEditWebsiteModal = useCallback((index: number) => {
    setEditingWebsiteIndex(index);
    setNewWebsiteName(musicWebsites[index].name);
    setNewWebsiteUrl(musicWebsites[index].url);
    setShowWebsiteEditor(true);
  }, [musicWebsites]);

  const saveWebsite = useCallback(() => {
    if (!newWebsiteName.trim() || !newWebsiteUrl.trim()) return;

    let url = newWebsiteUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    setMusicWebsites((prev: typeof defaultMusicWebsites) => {
      const updated = [...prev];
      if (editingWebsiteIndex !== null) {
        updated[editingWebsiteIndex] = { name: newWebsiteName.trim(), url };
      } else {
        updated.push({ name: newWebsiteName.trim(), url });
      }
      return updated;
    });
    setShowWebsiteEditor(false);
  }, [newWebsiteName, newWebsiteUrl, editingWebsiteIndex]);

  const deleteWebsite = useCallback((index: number) => {
    setMusicWebsites((prev: typeof defaultMusicWebsites) => prev.filter((_, i: number) => i !== index));
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value));
  }, [seek]);

  return (
    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border-2 border-purple-200 p-5 shadow-lg">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">🎵</span>
        <h2 className="text-lg font-bold text-purple-800">音乐播放器</h2>
        <div className="ml-auto flex gap-2">
          {savedMusicInfo.trackNames.length > 0 && tracks.length === 0 ? (
            <button
              onClick={() => setShowReloadInfo(!showReloadInfo)}
              className="text-xs bg-amber-500 text-white px-2 py-1 rounded-lg hover:bg-amber-600 transition-colors animate-pulse"
            >
              ⚠️ 重新加载
            </button>
          ) : null}
          {!isMusicPlayerVisible ? (
            <button
              onClick={toggleMusicPlayerVisible}
              className="text-xs bg-amber-500 text-white px-2 py-1 rounded-lg hover:bg-amber-600 transition-colors"
            >
              🎵 显示
            </button>
          ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              onClick={() => setShowWebsites(!showWebsites)}
              className="text-xs bg-green-500 text-white px-2 py-1 rounded-lg hover:bg-green-600 transition-colors"
            >
              🌐 网络
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs bg-purple-500 text-white px-2 py-1 rounded-lg hover:bg-purple-600 transition-colors"
              title={tracks.length >= 9 ? "最多9首音乐" : "添加本地音乐"}
            >
              + 本地
            </button>
          </div>
        </div>

        {showReloadInfo && savedMusicInfo.trackNames.length > 0 && tracks.length === 0 && (
          <div className="mb-3 bg-amber-50 rounded-xl p-3 border border-amber-200">
            <div className="flex items-start gap-2">
              <span className="text-xl">⚠️</span>
              <div className="flex-1">
                <p className="text-sm text-amber-800 font-medium mb-1">浏览器安全提醒</p>
                <p className="text-xs text-amber-700 mb-2">
                  由于浏览器的安全限制，本地文件路径无法在页面刷新后直接恢复。需要重新选择文件。
                </p>
                <p className="text-xs text-amber-700 mb-2">
                  你之前有 <span className="font-bold">{savedMusicInfo.trackNames.length}</span> 首歌：
                </p>
                <div className="mb-2 max-h-24 overflow-y-auto bg-white/50 rounded-lg p-2">
                  {savedMusicInfo.trackNames.map((t: any, i: number) => (
                    <div key={i} className="text-xs text-amber-600 truncate">
                      {i + 1}. {t.name}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors"
                  >
                    🎵 重新选择文件
                  </button>
                  <button
                    onClick={() => setShowReloadInfo(false)}
                    className="text-xs bg-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    稍后再说
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showWebsites && (
          <div className="mb-3 bg-white/80 rounded-xl p-3 border border-purple-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-purple-700">选择音乐网站：</p>
              <button
                onClick={openAddWebsiteModal}
                className="text-xs bg-purple-500 text-white px-2 py-1 rounded-lg hover:bg-purple-600 transition-colors"
              >
                + 添加
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {musicWebsites.map((site: any, index: number) => (
                <div key={index} className="flex items-center gap-2">
                  <button
                    onClick={() => openMusicWebsite(site.url)}
                    className="flex-1 text-xs bg-purple-100 text-purple-700 px-3 py-2 rounded-lg hover:bg-purple-200 transition-colors text-left truncate"
                  >
                    {site.name}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditWebsiteModal(index);
                    }}
                    className="p-1.5 text-purple-500 hover:bg-purple-100 rounded-lg"
                    title="编辑"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteWebsite(index);
                    }}
                    className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg"
                    title="删除"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {showWebsiteEditor && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                {editingWebsiteIndex !== null ? '编辑网站' : '添加网站'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">网站名称</label>
                  <input
                    type="text"
                    value={newWebsiteName}
                    onChange={(e) => setNewWebsiteName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="例如：网易云音乐"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">网站地址</label>
                  <input
                    type="text"
                    value={newWebsiteUrl}
                    onChange={(e) => setNewWebsiteUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="例如：https://music.163.com"
                  />
                </div>
                {editingWebsiteIndex !== null && (
                  <button
                    onClick={() => deleteWebsite(editingWebsiteIndex!)}
                    className="w-full bg-red-500 text-white py-2 rounded-lg font-medium hover:bg-red-600 transition-colors"
                  >
                    删除这个网站
                  </button>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowWebsiteEditor(false)}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-400 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={saveWebsite}
                    className="flex-1 bg-purple-500 text-white py-2 rounded-lg font-medium hover:bg-purple-600 transition-colors"
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {tracks.length > 0 && (
        <>
          <div className="bg-white/70 rounded-xl p-4 border border-purple-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-lg flex items-center justify-center">
                <span className="text-lg">🎶</span>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-purple-900 truncate">
                  {tracks[currentTrackIndex]?.name || '未选择音乐'}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className="flex-1 h-1 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <span className="text-xs text-purple-600 min-w-[80px] text-right">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
              </div>

              <button
                onClick={prevTrack}
                disabled={tracks.length <= 1}
                className="p-1.5 text-purple-700 hover:bg-purple-100 rounded-lg disabled:opacity-30"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>

              <button
                onClick={togglePlay}
                className="p-2 bg-purple-500 text-white rounded-full hover:bg-purple-600"
              >
                {isPlaying ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              <button
                onClick={nextTrack}
                disabled={tracks.length <= 1}
                className="p-1.5 text-purple-700 hover:bg-purple-100 rounded-lg disabled:opacity-30"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>

              <div className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 0 010 12.728M5.586 15H4a1 0 01-1-1v-4a1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-12 h-1 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            </div>
          </div>

          {tracks.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {tracks.map((track, index) => (
                <div
                  key={track.id}
                  className={`p-1.5 rounded-lg text-center transition-all duration-200 overflow-hidden relative ${
                    currentTrackIndex === index
                      ? 'bg-purple-500 text-white'
                      : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                  }`}
                >
                  <button
                    onClick={() => {
                      setCurrentTrackIndex(index);
                    }}
                    className="w-full h-full"
                  >
                    <div className="text-xs truncate pr-4">{track.name}</div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTrack(track.id);
                    }}
                    className={`absolute top-0 right-0 p-0.5 rounded-bl-lg ${
                      currentTrackIndex === index
                        ? 'text-white hover:bg-white/20'
                        : 'text-purple-500 hover:bg-purple-300'
                    }`}
                    title="删除歌曲"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tracks.length === 0 && (
        <div className="bg-white/70 rounded-xl p-4 border border-purple-100 text-center">
          <p className="text-sm text-purple-600">🎵 点击 + 号添加最多9首背景音乐</p>
        </div>
      )}
    </div>
  );
};

const NotificationPermissionPrompt = ({ 
  onRequest, 
  onDismiss 
}: { 
  onRequest: () => void; 
  onDismiss: () => void;
}) => (
  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
    <div className="flex items-start gap-4">
      <div className="text-3xl">🔔</div>
      <div className="flex-1">
        <h3 className="font-semibold text-gray-800 mb-1">开启提醒功能</h3>
        <p className="text-sm text-gray-600 mb-4">
          允许浏览器发送通知，不错过任何行动时间！
        </p>
        <div className="flex gap-3">
          <button
            onClick={onRequest}
            className="bg-amber-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-amber-600 transition-colors"
          >
            开启通知
          </button>
          <button
            onClick={onDismiss}
            className="text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            稍后再说
          </button>
        </div>
      </div>
    </div>
  </div>
);



const CompletedState = () => (
  <div className="text-center py-16">
    <div className="text-6xl mb-6 text-green-500">✅</div>
    <h2 className="text-2xl font-semibold text-gray-800 mb-4">今日完成！</h2>
    <p className="text-gray-500">继续保持，明天也要加油</p>
  </div>
);

const SuccessModal = ({ 
  isOpen, 
  reward, 
  onClose 
}: { 
  isOpen: boolean; 
  reward?: string; 
  onClose: () => void;
}) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">太棒了！</h3>
        <p className="text-gray-500 mb-6">
          {reward ? `完成任务！\n奖励：${reward}` : '你完成了今天的任务！'}
        </p>
        <button
          onClick={onClose}
          className="w-full bg-amber-500 text-white py-3 rounded-xl font-semibold hover:bg-amber-600 transition-colors"
        >
          继续
        </button>
      </div>
    </div>
  );
};

const FailureModal = ({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean; 
  onClose: () => void;
}) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">💪</div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">没关系</h3>
        <p className="text-gray-500 mb-6">明天继续努力，或者看看是否需要调整难度</p>
        <button
          onClick={onClose}
          className="w-full bg-gray-500 text-white py-3 rounded-xl font-semibold hover:bg-gray-600 transition-colors"
        >
          好的
        </button>
      </div>
    </div>
  );
};

const ProtocolCard = ({
  protocol,
  onSuccess,
  onFailure,
  onOpenMindMap
}: {
  protocol: ProtocolModel;
  onSuccess: () => void;
  onFailure: () => void;
  onOpenMindMap?: (protocol: ProtocolModel) => void;
}) => {
  const [showSuccess, setShowSuccess] = useState(false);
  const [showFailure, setShowFailure] = useState(false);

  const handleSuccessInternal = useCallback(() => {
    onSuccess();
    setShowSuccess(true);
  }, [onSuccess]);

  const handleFailureInternal = useCallback(() => {
    onFailure();
    setShowFailure(true);
  }, [onFailure]);

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">{protocol.principle}</h3>
            <p className="text-sm text-gray-500 mt-1">优先级: {protocol.priority}</p>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-amber-50 text-amber-700">
            {goalTypeLabels[protocol.goalType]}
          </span>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-2">
            <span className="text-sm text-gray-500 min-w-[60px]">触发</span>
            <span className="text-sm text-gray-700">
              {triggerTypeLabels[protocol.triggerType]}: {protocol.triggerCondition}
            </span>
          </div>

          {protocol.reminderTime && (
            <div className="flex items-start gap-2">
              <span className="text-sm text-gray-500 min-w-[60px]">⏰ 提醒</span>
              <span className="text-sm font-medium text-amber-600">{protocol.reminderTime}</span>
            </div>
          )}

          {(protocol.psychologicalBoundary || protocol.actionPermission) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
              {protocol.psychologicalBoundary && (
                <div>
                  <div className="flex items-center gap-1 text-purple-600 text-sm font-medium mb-1">
                    <span>🛡️</span> 不做
                  </div>
                  <div className="text-sm text-gray-700">{protocol.psychologicalBoundary}</div>
                </div>
              )}
              {protocol.actionPermission && (
                <div>
                  <div className="flex items-center gap-1 text-green-600 text-sm font-medium mb-1">
                    <span>✅</span> 可以做
                  </div>
                  <div className="text-sm text-gray-700">{protocol.actionPermission}</div>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-semibold text-amber-600 mb-2 flex items-center gap-1">
                  <span>📋</span> Plan A
                </h4>
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-xs text-gray-500 min-w-[40px]">标准</span>
                  <span className="text-sm text-gray-700">{protocol.action}</span>
                </div>
                <div className="flex items-center gap-2 text-amber-600 text-sm">
                  <span>最小:</span>
                  <span className="font-medium">{protocol.minimumAction}</span>
                </div>
              </div>
              {protocol.actionPlanB && (
                <div>
                  <h4 className="text-sm font-semibold text-blue-600 mb-2 flex items-center gap-1">
                    <span>🔄</span> Plan B
                  </h4>
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xs text-gray-500 min-w-[40px]">标准</span>
                    <span className="text-sm text-gray-700">{protocol.actionPlanB}</span>
                  </div>
                  {protocol.minimumActionPlanB && (
                    <div className="flex items-center gap-2 text-blue-600 text-sm">
                      <span>最小:</span>
                      <span className="font-medium">{protocol.minimumActionPlanB}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {protocol.environmentPrep && (
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-start gap-2">
                <span className="text-sm text-gray-500 min-w-[60px]">准备</span>
                <span className="text-sm text-gray-700">{protocol.environmentPrep}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          {onOpenMindMap && (
            <button
              onClick={() => onOpenMindMap(protocol)}
              className="px-4 bg-amber-100 text-amber-700 py-3.5 rounded-xl font-semibold hover:bg-amber-200 transition-colors flex items-center justify-center gap-2"
              title="思维导图"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9z" />
              </svg>
            </button>
          )}
          <button
            onClick={handleSuccessInternal}
            className="flex-1 bg-green-500 text-white py-3.5 rounded-xl font-semibold hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            完成
          </button>
          <button
            onClick={handleFailureInternal}
            className="flex-1 bg-gray-400 text-white py-3.5 rounded-xl font-semibold hover:bg-gray-500 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            跳过
          </button>
        </div>
      </div>

      <SuccessModal 
        isOpen={showSuccess} 
        reward={protocol.reward} 
        onClose={() => setShowSuccess(false)} 
      />
      <FailureModal 
        isOpen={showFailure} 
        onClose={() => setShowFailure(false)} 
      />
    </>
  );
};

export default function TodayView() {
  const {
    getTodayProtocols,
    protocols,
    isLoading,
    requestNotificationPermission,
    hasNotificationPermission,
    markProtocolSuccess,
    markProtocolFailure
  } = useProtocols();
  const navigate = useNavigate();

  const todayProtocols = useMemo(() => getTodayProtocols(), [getTodayProtocols]);
  const allCompleted = useMemo(() => protocols.length > 0 && todayProtocols.length === 0, [protocols.length, todayProtocols.length]);

  const [showPermissionPrompt, setShowPermissionPrompt] = useState(() => !hasNotificationPermission() && protocols.length > 0);

  // 思维导图状态
  const [showMindMap, setShowMindMap] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolModel | undefined>(undefined);

  // 语录状态 - 使用单个 state 对象减少重渲染
  const [quoteState, setQuoteState] = useState(() => {
    const savedQuotes = localStorage.getItem(STORAGE_KEY);
    const quotes = savedQuotes ? JSON.parse(savedQuotes) : defaultWisdomQuotes;
    const today = new Date().getDate();
    return {
      quotes,
      currentIndex: today % quotes.length,
      showEditModal: false,
      editingIndex: null as number | null,
      newText: '',
      newAuthor: ''
    };
  });

  const currentQuote = quoteState.quotes[quoteState.currentIndex];

  // 保存语录到 localStorage
  const saveQuotesToStorage = useCallback((quotes: typeof defaultWisdomQuotes) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
  }, []);

  const handleSuccess = useCallback((protocol: ProtocolModel) => {
    markProtocolSuccess(protocol.id);
  }, [markProtocolSuccess]);

  const handleFailure = useCallback((protocol: ProtocolModel) => {
    markProtocolFailure(protocol.id);
  }, [markProtocolFailure]);

  const changeQuote = useCallback(() => {
    setQuoteState(prev => ({
      ...prev,
      currentIndex: (prev.currentIndex + 1) % prev.quotes.length
    }));
  }, []);

  const openAddModal = useCallback(() => {
    setQuoteState(prev => ({
      ...prev,
      showEditModal: true,
      editingIndex: null,
      newText: '',
      newAuthor: ''
    }));
  }, []);

  const openEditModal = useCallback((index: number) => {
    setQuoteState(prev => ({
      ...prev,
      showEditModal: true,
      editingIndex: index,
      newText: prev.quotes[index].text,
      newAuthor: prev.quotes[index].author
    }));
  }, []);

  const saveQuote = useCallback(() => {
    if (!quoteState.newText.trim()) return;

    setQuoteState(prev => {
      const updatedQuotes = [...prev.quotes];
      const newQuote = { text: prev.newText, author: prev.newAuthor || '我' };

      if (prev.editingIndex !== null) {
        updatedQuotes[prev.editingIndex] = newQuote;
      } else {
        updatedQuotes.push(newQuote);
      }

      saveQuotesToStorage(updatedQuotes);

      return {
        ...prev,
        quotes: updatedQuotes,
        showEditModal: false
      };
    });
  }, [quoteState.newText, quoteState.newAuthor, saveQuotesToStorage]);

  const deleteQuote = useCallback(() => {
    setQuoteState(prev => {
      if (prev.quotes.length <= 1) {
        alert('至少需要保留一条语录！');
        return prev;
      }

      const updatedQuotes = prev.quotes.filter((_: typeof defaultWisdomQuotes[0], i: number) => i !== prev.editingIndex);
      saveQuotesToStorage(updatedQuotes);

      let newIndex = prev.currentIndex;
      if (prev.currentIndex >= updatedQuotes.length) {
        newIndex = Math.max(0, updatedQuotes.length - 1);
      }

      return {
        ...prev,
        quotes: updatedQuotes,
        showEditModal: false,
        currentIndex: newIndex
      };
    });
  }, [saveQuotesToStorage]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">今日执行</h1>
          <p className="text-gray-500">{formatDate(new Date())}</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MusicPlayer />
          <WisdomQuoteCard 
            quote={currentQuote}
            onAdd={openAddModal}
            onEdit={() => openEditModal(quoteState.currentIndex)}
            onChange={changeQuote}
          />
        </div>
      </div>
      
      {/* 快速入口区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* 创建协议入口 */}
        <QuickActionCard
          title="创建新协议"
          subtitle="定义你的行动规则"
          icon="➕"
          color="blue"
          onClick={() => navigate('/create')}
          stats={protocols.length > 0 ? `${protocols.length} 个协议` : '开始创建'}
        />

        {/* 协议列表入口 */}
        <QuickActionCard
          title="我的协议库"
          subtitle="管理和追踪所有协议"
          icon="📋"
          color="green"
          onClick={() => navigate('/protocols')}
          stats={`${protocols.filter(p => p.successCount > 0).length} 个已执行`}
        />
      </div>

      {/* 语录编辑弹窗 */}
      {quoteState.showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-[500px] max-w-[90vw]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">
                {quoteState.editingIndex !== null ? '编辑语录' : '添加语录'}
              </h3>
              <button
                onClick={() => setQuoteState(prev => ({ ...prev, showEditModal: false }))}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">语录内容</label>
                <textarea
                  value={quoteState.newText}
                  onChange={(e) => setQuoteState(prev => ({ ...prev, newText: e.target.value }))}
                  placeholder="输入语录内容..."
                  className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                  rows={4}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">作者</label>
                <input
                  type="text"
                  value={quoteState.newAuthor}
                  onChange={(e) => setQuoteState(prev => ({ ...prev, newAuthor: e.target.value }))}
                  placeholder="输入作者名称（可选）"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              {quoteState.editingIndex !== null && (
                <button
                  onClick={deleteQuote}
                  className="flex-1 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                >
                  删除
                </button>
              )}
              <button
                onClick={() => setQuoteState(prev => ({ ...prev, showEditModal: false }))}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={saveQuote}
                disabled={!quoteState.newText.trim()}
                className="flex-1 py-2 bg-amber-500 text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {showPermissionPrompt && (
        <NotificationPermissionPrompt
          onRequest={async () => {
            await requestNotificationPermission();
            setShowPermissionPrompt(false);
          }}
          onDismiss={() => setShowPermissionPrompt(false)}
        />
      )}
      
      {protocols.length === 0 ? null : allCompleted ? (
        <CompletedState />
      ) : (
        <div className="space-y-6">
          {todayProtocols.map(protocol => (
            <ProtocolCard
              key={protocol.id}
              protocol={protocol}
              onSuccess={() => handleSuccess(protocol)}
              onFailure={() => handleFailure(protocol)}
              onOpenMindMap={(proto) => {
                setSelectedProtocol(proto);
                setShowMindMap(true);
              }}
            />
          ))}
        </div>
      )}

      {showMindMap && selectedProtocol && (
        <MindMapView
          protocol={selectedProtocol}
          onClose={() => setShowMindMap(false)}
        />
      )}
    </div>
  );
}
