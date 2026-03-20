import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProtocols } from '../context/ProtocolContext';
import { ProtocolModel, goalTypeLabels, triggerTypeLabels, createEmptyProtocol } from '../types/protocol';

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

const goalMatchTemplates = [
  {
    title: "情境感知",
    content: "敏锐觉察环境变化，把握行动时机",
    template: {
      principle: "情境感知",
      goalType: "habit",
      action: "观察记录环境变化",
      minimumAction: "觉察1个关键信号"
    }
  },
  {
    title: "资源嗅探",
    content: "主动发现可用资源，为行动铺路",
    template: {
      principle: "资源嗅探",
      goalType: "habit",
      action: "寻找并整合3种资源",
      minimumAction: "发现1种可用资源"
    }
  },
  {
    title: "供需解析",
    content: "分析需求与供给，找到平衡点",
    template: {
      principle: "供需解析",
      goalType: "habit",
      action: "深度分析供需关系",
      minimumAction: "识别1个关键需求"
    }
  },
  {
    title: "权力允许",
    content: "明确权限边界，在允许范围内行动",
    template: {
      principle: "权力允许",
      goalType: "habit",
      action: "在权限内自主决策",
      minimumAction: "确认1项可执行权限"
    }
  }
];

const valueExchangeTemplates = [
  {
    title: "行业信息",
    content: "收集行业动态，把握趋势脉搏",
    template: {
      principle: "行业信息",
      goalType: "habit",
      action: "阅读3篇行业资讯",
      minimumAction: "浏览1条行业新闻"
    }
  },
  {
    title: "市场节点",
    content: "识别关键节点，捕捉市场机会",
    template: {
      principle: "市场节点",
      goalType: "habit",
      action: "分析2个市场关键节点",
      minimumAction: "标记1个重要节点"
    }
  },
  {
    title: "资源利用",
    content: "优化资源配置，最大化价值产出",
    template: {
      principle: "资源利用",
      goalType: "habit",
      action: "优化3项资源使用",
      minimumAction: "改进1项资源利用方式"
    }
  },
  {
    title: "风险收益",
    content: "评估风险与收益，做出明智决策",
    template: {
      principle: "风险收益",
      goalType: "habit",
      action: "分析2个决策的风险收益",
      minimumAction: "评估1个选项的利弊"
    }
  }
];

const animations = `
  @keyframes bloodFall {
    0% {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
    70% {
      opacity: 1;
    }
    100% {
      transform: translateY(80px) scale(0.5);
      opacity: 0;
    }
  }
  
  @keyframes goldBounce {
    0% {
      transform: translateY(0) scale(0.5) rotate(0deg);
      opacity: 0;
    }
    30% {
      transform: translateY(-20px) scale(1.2) rotate(180deg);
      opacity: 1;
    }
    60% {
      transform: translateY(0) scale(1) rotate(360deg);
      opacity: 1;
    }
    100% {
      transform: translateY(-10px) scale(0.8) rotate(540deg);
      opacity: 0.8;
    }
  }
`;

function formatDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
  return formatter.format(date);
}

const BloodDrop = ({ x, y }: { x: number; y: number }) => (
  <div
    className="absolute"
    style={{
      left: `${x}%`,
      top: `${y}%`,
      animation: 'bloodFall 0.8s ease-in forwards'
    }}
  >
    <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
      <path
        d="M12 0C12 0 0 16 0 22C0 27.5228 5.37258 32 12 32C18.6274 32 24 27.5228 24 22C24 16 12 0 12 0Z"
        fill="#DC2626"
      />
      <ellipse cx="8" cy="18" rx="2" ry="3" fill="#FCA5A5" opacity="0.6" />
    </svg>
  </div>
);

const GoldIngot = ({ x, y, opacity }: { x: number; y: number; opacity: number }) => (
  <div
    className="absolute"
    style={{
      left: `${x}%`,
      top: `${y}%`,
      opacity,
      animation: 'goldBounce 0.8s ease-out'
    }}
  >
    <svg width="32" height="24" viewBox="0 0 32 24" fill="none">
      <rect x="4" y="4" width="24" height="16" rx="2" fill="url(#goldGradient)" stroke="#B45309" strokeWidth="2" />
      <rect x="10" y="8" width="12" height="8" rx="1" fill="#FCD34D" opacity="0.5" />
      <defs>
        <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FCD34D" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

const BloodLevelBar = ({ level }: { level: number }) => (
  <div className="flex-1 relative">
    <div className="h-8 bg-gray-200 rounded-full overflow-hidden border-2 border-gray-300">
      <div 
        className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300 rounded-full"
        style={{ width: `${level}%` }}
      >
        <div className="h-full bg-gradient-to-b from-white/30 to-transparent rounded-full"></div>
      </div>
    </div>
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="text-sm font-bold text-white drop-shadow-lg">
        {Math.round(level)}%
      </span>
    </div>
  </div>
);

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

const TemplateCard = ({ 
  template, 
  color, 
  onClick 
}: { 
  template: any; 
  color: 'blue' | 'green'; 
  onClick: () => void;
}) => {
  return (
    <div
      className="bg-white rounded-xl p-4 border cursor-pointer hover:shadow-md transition-all duration-300"
      style={{ borderColor: color === 'blue' ? '#dbeafe' : '#d1fae5' }}
      onClick={onClick}
    >
      <h3 className={`font-semibold mb-1 ${color === 'blue' ? 'text-blue-700' : 'text-green-700'}`}>
        {template.title}
      </h3>
      <p className="text-sm text-gray-600">{template.content}</p>
    </div>
  );
};

const TemplateSection = ({ 
  title, 
  icon, 
  templates, 
  color, 
  onTemplateClick 
}: { 
  title: string; 
  icon: string; 
  templates: any[]; 
  color: 'blue' | 'green'; 
  onTemplateClick: (template: any) => void;
}) => {
  const bgColors = {
    blue: 'from-blue-50 to-indigo-50 border-blue-200',
    green: 'from-green-50 to-emerald-50 border-green-200'
  };
  
  const textColors = {
    blue: 'text-blue-800',
    green: 'text-green-800'
  };
  
  return (
    <div className={`bg-gradient-to-br ${bgColors[color]} rounded-2xl border-2 ${bgColors[color].split(' ')[2]} p-6 shadow-lg`}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">{icon}</span>
        <h2 className={`text-xl font-bold ${textColors[color]}`}>{title}</h2>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {templates.map((template, index) => (
          <TemplateCard
            key={index}
            template={template}
            color={color}
            onClick={() => onTemplateClick(template)}
          />
        ))}
      </div>
    </div>
  );
};

const QuoteEditModal = ({ 
  isOpen, 
  isEditing, 
  text, 
  author, 
  onTextChange,
  onAuthorChange,
  onClose, 
  onSave, 
  onDelete 
}: { 
  isOpen: boolean; 
  isEditing: boolean; 
  text: string; 
  author: string; 
  onTextChange: (text: string) => void;
  onAuthorChange: (author: string) => void;
  onClose: () => void; 
  onSave: () => void; 
  onDelete: () => void;
}) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          {isEditing ? '编辑语录' : '添加语录'}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">语录内容</label>
            <textarea
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              rows={3}
              placeholder="输入你的语录..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">作者（可选）</label>
            <input
              type="text"
              value={author}
              onChange={(e) => onAuthorChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="默认为'我'"
            />
          </div>
          {isEditing && (
            <button
              onClick={onDelete}
              className="w-full bg-red-500 text-white py-2 rounded-lg font-medium hover:bg-red-600 transition-colors"
            >
              删除这条语录
            </button>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-400 transition-colors"
            >
              取消
            </button>
            <button
              onClick={onSave}
              className="flex-1 bg-amber-500 text-white py-2 rounded-lg font-medium hover:bg-amber-600 transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface MusicTrack {
  id: string;
  name: string;
  file: File;
  url: string;
}

const CuteWidget = () => {
  const [position, setPosition] = useState({ x: 20, y: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [expression, setExpression] = useState('happy');
  const [clickCount, setClickCount] = useState(0);
  const [bounce, setBounce] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);

  const expressions = ['happy', 'wink', 'surprised', 'love', 'sleepy'];

  const handleInteractionStart = () => {
    setIsDragging(true);
    setClickCount(prev => prev + 1);
    
    if (clickCount % 5 === 4) {
      setExpression(expressions[Math.floor(Math.random() * expressions.length)]);
    }
    
    setBounce(true);
    setTimeout(() => setBounce(false), 400);
  };

  const handleMouseDown = (_e: React.MouseEvent) => {
    handleInteractionStart();
  };

  const handleTouchStart = (_e: React.TouchEvent) => {
    handleInteractionStart();
  };

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return;
    setPosition({
      x: clientX - 40,
      y: clientY - 40,
    });
  }, [isDragging]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    handleMove(e.clientX, e.clientY);
  }, [handleMove]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, [handleMove]);

  const handleInteractionEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleInteractionEnd);
      window.addEventListener('touchmove', handleTouchMove as any, { passive: false });
      window.addEventListener('touchend', handleInteractionEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleInteractionEnd);
      window.removeEventListener('touchmove', handleTouchMove as any);
      window.removeEventListener('touchend', handleInteractionEnd);
    };
  }, [isDragging, handleMouseMove, handleTouchMove]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!isDragging) {
        setBounce(true);
        setTimeout(() => setBounce(false), 400);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [isDragging]);

  const getEmoji = () => {
    switch (expression) {
      case 'happy': return '😊';
      case 'wink': return '😉';
      case 'surprised': return '😮';
      case 'love': return '😍';
      case 'sleepy': return '😴';
      default: return '😊';
    }
  };

  return (
    <div
      ref={widgetRef}
      className="fixed cursor-grab active:cursor-grabbing z-50 select-none touch-none"
      style={{
        left: position.x,
        top: position.y,
        animation: bounce ? 'widgetBounce 0.4s ease-out' : 'widgetFloat 3s ease-in-out infinite',
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <style>{`
        @keyframes widgetFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes widgetBounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
      `}</style>
      <div className="relative">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-pink-300 to-purple-400 rounded-full shadow-lg flex items-center justify-center border-4 border-white">
          <span className="text-3xl sm:text-4xl">{getEmoji()}</span>
        </div>
        {clickCount > 0 && (
          <div className="absolute -top-2 -right-2 w-5 h-5 sm:w-6 sm:h-6 bg-yellow-400 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold text-white shadow">
            {clickCount}
          </div>
        )}
        {clickCount % 10 === 0 && clickCount > 0 && (
          <div className="absolute -top-7 sm:-top-8 left-1/2 transform -translate-x-1/2 bg-white px-2 sm:px-3 py-1 rounded-full shadow text-[10px] sm:text-xs font-medium text-gray-700 whitespace-nowrap">
            好可爱！
          </div>
        )}
      </div>
    </div>
  );
};

const MusicPlayer = () => {
  const [tracks, setTracks] = useState<MusicTrack[]>(() => {
    try {
      const saved = localStorage.getItem('music-tracks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('music-volume');
    return saved ? parseFloat(saved) : 0.5;
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('music-volume', volume.toString());
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (audioRef.current && isPlaying && tracks.length > 0) {
      audioRef.current.play();
    }
  }, [currentTrackIndex, tracks, isPlaying]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newTracks: MusicTrack[] = [];
    
    files.forEach((file) => {
      if (file.type.startsWith('audio/')) {
        const url = URL.createObjectURL(file);
        newTracks.push({
          id: crypto.randomUUID(),
          name: file.name.replace(/\.[^/.]+$/, ''),
          file,
          url,
        });
      }
    });

    if (newTracks.length > 0) {
      const updatedTracks = [...tracks, ...newTracks].slice(0, 3);
      setTracks(updatedTracks);
    }
  };

  const removeTrack = (id: string) => {
    const updatedTracks = tracks.filter(track => track.id !== id);
    setTracks(updatedTracks);
    if (currentTrackIndex >= updatedTracks.length) {
      setCurrentTrackIndex(0);
      setIsPlaying(false);
    }
  };

  const togglePlay = () => {
    if (tracks.length === 0) return;
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const nextTrack = () => {
    setCurrentTrackIndex((prev) => (prev + 1) % tracks.length);
    setIsPlaying(true);
  };

  const prevTrack = () => {
    setCurrentTrackIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
    setIsPlaying(true);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    if (tracks.length > 1) {
      nextTrack();
    } else {
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border-2 border-purple-200 p-5 shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🎵</span>
        <h2 className="text-lg font-bold text-purple-800">背景音乐</h2>
        <div className="ml-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={tracks.length >= 3}
            className="text-xs bg-purple-500 text-white px-2 py-1 rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + 添加音乐
          </button>
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-4">🎵</div>
          <p className="text-gray-500">还没有音乐</p>
          <p className="text-xs text-gray-400 mt-2">点击上方按钮添加最多3首歌</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {tracks.map((track, index) => (
              <div
                key={track.id}
                className={`flex-1 min-w-0 p-3 rounded-xl cursor-pointer transition-colors ${
                  currentTrackIndex === index
                    ? 'bg-purple-100 border-2 border-purple-400'
                    : 'bg-white border-2 border-transparent hover:bg-gray-50'
                }`}
                onClick={() => {
                  setCurrentTrackIndex(index);
                  setIsPlaying(true);
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎶</span>
                  <span className="text-sm font-medium text-gray-800 truncate flex-1">
                    {track.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTrack(track.id);
                    }}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <audio
            ref={audioRef}
            src={tracks[currentTrackIndex]?.url}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
          />

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                onClick={prevTrack}
                disabled={tracks.length <= 1}
                className="p-2 text-purple-700 hover:bg-purple-100 rounded-lg disabled:opacity-30"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>

              <button
                onClick={togglePlay}
                className="p-3 bg-purple-500 text-white rounded-full hover:bg-purple-600"
              >
                {isPlaying ? (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              <button
                onClick={nextTrack}
                disabled={tracks.length <= 1}
                className="p-2 text-purple-700 hover:bg-purple-100 rounded-lg disabled:opacity-30"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>

              <div className="flex-1"></div>

              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-20 accent-purple-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full accent-purple-500"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>
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

const EmptyState = () => null;

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
  onFailure 
}: { 
  protocol: ProtocolModel; 
  onSuccess: () => void; 
  onFailure: () => void;
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
  const allCompleted = useMemo(() => protocols.length > 0 && todayProtocols.length === 0, [protocols, todayProtocols]);
  
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(!hasNotificationPermission() && protocols.length > 0);
  const [bloodLevel, setBloodLevel] = useState(100);
  const [bloodDrops, setBloodDrops] = useState<{ id: number; x: number; y: number; isGold: boolean }[]>([]);
  const [goldIngots, setGoldIngots] = useState<{ id: number; x: number; y: number; opacity: number }[]>([]);
  
  const bloodDropIdRef = useRef(0);
  const goldIngotIdRef = useRef(0);
  
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [wisdomQuotes, setWisdomQuotes] = useState(defaultWisdomQuotes);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newQuoteText, setNewQuoteText] = useState('');
  const [newQuoteAuthor, setNewQuoteAuthor] = useState('');
  
  const currentQuote = useMemo(() => wisdomQuotes[currentQuoteIndex], [wisdomQuotes, currentQuoteIndex]);

  useEffect(() => {
    const savedQuotes = localStorage.getItem(STORAGE_KEY);
    if (savedQuotes) {
      try {
        setWisdomQuotes(JSON.parse(savedQuotes));
      } catch {
        setWisdomQuotes(defaultWisdomQuotes);
      }
    }
  }, []);

  useEffect(() => {
    const today = new Date().getDate();
    setCurrentQuoteIndex(today % wisdomQuotes.length);
  }, [wisdomQuotes]);

  const saveQuotes = useCallback((quotes: typeof defaultWisdomQuotes) => {
    setWisdomQuotes(quotes);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setBloodLevel(prev => {
        const newLevel = Math.max(0, prev - 0.1);
        if (newLevel < prev && Math.random() < 0.3) {
          addBloodDrop();
        }
        return newLevel;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const addBloodDrop = useCallback(() => {
    const id = bloodDropIdRef.current++;
    const x = 50 + (Math.random() - 0.5) * 30;
    const y = 0;
    setBloodDrops(prev => [...prev, { id, x, y, isGold: false }]);
    
    setTimeout(() => {
      setBloodDrops(prev => prev.filter(drop => drop.id !== id));
      addGoldIngot(x, 80);
    }, 800);
  }, []);

  const addGoldIngot = useCallback((x: number, y: number) => {
    const id = goldIngotIdRef.current++;
    setGoldIngots(prev => [...prev, { id, x, y, opacity: 1 }]);
    
    setTimeout(() => {
      setGoldIngots(prev => prev.filter(ingot => ingot.id !== id));
    }, 2000);
  }, []);

  const handleSuccess = useCallback((protocol: ProtocolModel) => {
    markProtocolSuccess(protocol.id);
    setBloodLevel(prev => Math.min(100, prev + 20));
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        addGoldIngot(30 + Math.random() * 40, 50);
      }, i * 200);
    }
  }, [markProtocolSuccess, addGoldIngot]);

  const handleFailure = useCallback((protocol: ProtocolModel) => {
    markProtocolFailure(protocol.id);
    setBloodLevel(prev => Math.max(0, prev - 10));
    for (let i = 0; i < 2; i++) {
      setTimeout(() => {
        addBloodDrop();
      }, i * 300);
    }
  }, [markProtocolFailure, addBloodDrop]);

  const changeQuote = useCallback(() => {
    setCurrentQuoteIndex((prev) => (prev + 1) % wisdomQuotes.length);
  }, [wisdomQuotes]);

  const openAddModal = useCallback(() => {
    setEditingIndex(null);
    setNewQuoteText('');
    setNewQuoteAuthor('');
    setShowEditModal(true);
  }, []);

  const openEditModal = useCallback((index: number) => {
    setEditingIndex(index);
    setNewQuoteText(wisdomQuotes[index].text);
    setNewQuoteAuthor(wisdomQuotes[index].author);
    setShowEditModal(true);
  }, [wisdomQuotes]);

  const saveQuote = useCallback(() => {
    if (!newQuoteText.trim()) return;
    
    const updatedQuotes = [...wisdomQuotes];
    if (editingIndex !== null) {
      updatedQuotes[editingIndex] = { text: newQuoteText, author: newQuoteAuthor || '我' };
    } else {
      updatedQuotes.push({ text: newQuoteText, author: newQuoteAuthor || '我' });
    }
    saveQuotes(updatedQuotes);
    setShowEditModal(false);
  }, [newQuoteText, newQuoteAuthor, editingIndex, wisdomQuotes, saveQuotes]);

  const deleteQuote = useCallback((index: number) => {
    if (wisdomQuotes.length <= 1) {
      alert('至少需要保留一条语录！');
      return;
    }
    const updatedQuotes = wisdomQuotes.filter((_, i) => i !== index);
    saveQuotes(updatedQuotes);
    if (currentQuoteIndex >= updatedQuotes.length) {
      setCurrentQuoteIndex(Math.max(0, updatedQuotes.length - 1));
    }
  }, [wisdomQuotes, saveQuotes, currentQuoteIndex]);

  const handleTemplateClick = useCallback((template: any) => {
    const newProtocol = createEmptyProtocol();
    const mergedProtocol = {
      ...newProtocol,
      ...template.template,
      triggerCondition: template.content,
      successCriteria: template.content
    };
    navigate('/create', { state: { prefillData: mergedProtocol } });
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <style>{animations}</style>
      
      <div className="flex flex-col lg:flex-row gap-6 mb-8">
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-3xl font-bold text-gray-800">今日执行</h1>
            <BloodLevelBar level={bloodLevel} />
          </div>
          <p className="text-gray-500">{formatDate(new Date())}</p>
          
          <div className="relative h-32 mt-2">
            {bloodDrops.map(drop => (
              <BloodDrop key={drop.id} x={drop.x} y={drop.y} />
            ))}
            {goldIngots.map(ingot => (
              <GoldIngot key={ingot.id} x={ingot.x} y={ingot.y} opacity={ingot.opacity} />
            ))}
          </div>
          
          <div className="mt-4">
            <MusicPlayer />
          </div>
        </div>
        
        <div className="w-full lg:w-80">
          <WisdomQuoteCard 
            quote={currentQuote}
            onAdd={openAddModal}
            onEdit={() => openEditModal(currentQuoteIndex)}
            onChange={changeQuote}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <TemplateSection
          title="目标匹配"
          icon="🎯"
          templates={goalMatchTemplates}
          color="blue"
          onTemplateClick={handleTemplateClick}
        />
        <TemplateSection
          title="价值交换"
          icon="💎"
          templates={valueExchangeTemplates}
          color="green"
          onTemplateClick={handleTemplateClick}
        />
      </div>

      <QuoteEditModal
        isOpen={showEditModal}
        isEditing={editingIndex !== null}
        text={newQuoteText}
        author={newQuoteAuthor}
        onTextChange={setNewQuoteText}
        onAuthorChange={setNewQuoteAuthor}
        onClose={() => setShowEditModal(false)}
        onSave={saveQuote}
        onDelete={() => deleteQuote(editingIndex!)}
      />

      {showPermissionPrompt && (
        <NotificationPermissionPrompt
          onRequest={async () => {
            await requestNotificationPermission();
            setShowPermissionPrompt(false);
          }}
          onDismiss={() => setShowPermissionPrompt(false)}
        />
      )}
      
      {protocols.length === 0 ? (
        <EmptyState />
      ) : allCompleted ? (
        <CompletedState />
      ) : (
        <div className="space-y-6">
          {todayProtocols.map(protocol => (
            <ProtocolCard 
              key={protocol.id} 
              protocol={protocol} 
              onSuccess={() => handleSuccess(protocol)}
              onFailure={() => handleFailure(protocol)}
            />
          ))}
        </div>
      )}
      <CuteWidget />
    </div>
  );
}
