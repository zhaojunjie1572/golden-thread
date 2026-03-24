import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';

export interface MusicTrack {
  id: string;
  name: string;
  url: string;
  fileName: string;
}

interface MusicContextType {
  tracks: MusicTrack[];
  currentTrackIndex: number;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  isMusicPlayerVisible: boolean;
  addTracks: (newTracks: MusicTrack[]) => void;
  removeTrack: (id: string) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setVolume: (volume: number) => void;
  setCurrentTrackIndex: (index: number) => void;
  seek: (time: number) => void;
  toggleMusicPlayerVisible: () => void;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export function MusicProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracks] = useState<MusicTrack[]>(() => {
    try {
      // 注意：只恢复元数据，URL 是临时的 blob URL，需要在页面加载后重新选择文件
      const saved = localStorage.getItem('music-tracks-metadata');
      if (saved) {
        const metadata = JSON.parse(saved);
        // URL 为空，需要用户重新选择文件
        return metadata.map((m: any) => ({ ...m, url: '' }));
      }
      return [];
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
  const [isMusicPlayerVisible, setIsMusicPlayerVisible] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    localStorage.setItem('music-volume', volume.toString());
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // 使用 ref 来存储 tracks 避免依赖项变化导致重复触发
  const tracksRef = useRef(tracks);
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    if (audioRef.current && isPlaying && tracksRef.current.length > 0) {
      audioRef.current.play().catch(e => console.error('Play error:', e));
    }
  }, [currentTrackIndex, isPlaying]);

  useEffect(() => {
    // 只保存音乐元数据，不保存临时的 blob URL
    // URL 需要在页面刷新后重新通过文件选择创建
    localStorage.setItem('music-tracks-metadata', JSON.stringify(tracks.map(t => ({ id: t.id, name: t.name, fileName: t.fileName }))));
  }, [tracks]);

  const addTracks = (newTracks: MusicTrack[]) => {
    if (newTracks.length > 0) {
      const updatedTracks = [...tracks, ...newTracks].slice(0, 9);
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

  const toggleMusicPlayerVisible = () => {
    setIsMusicPlayerVisible(!isMusicPlayerVisible);
  };

  const togglePlay = () => {
    if (tracks.length === 0) return;
    // 检查当前曲目是否有有效的 URL
    const currentTrack = tracks[currentTrackIndex];
    if (!currentTrack?.url) {
      console.warn('当前音乐没有有效的 URL，请重新选择文件');
      return;
    }
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => console.error('Play error:', e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  const nextTrack = () => {
    if (tracks.length === 0) return;
    setCurrentTrackIndex((prev) => (prev + 1) % tracks.length);
    setIsPlaying(true);
  };

  const prevTrack = () => {
    if (tracks.length === 0) return;
    setCurrentTrackIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
    setIsPlaying(true);
  };

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
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
    nextTrack();
  };

  return (
    <MusicContext.Provider value={{
      tracks,
      currentTrackIndex,
      isPlaying,
      volume,
      currentTime,
      duration,
      isMusicPlayerVisible,
      addTracks,
      removeTrack,
      togglePlay,
      nextTrack,
      prevTrack,
      setVolume,
      setCurrentTrackIndex,
      seek,
      toggleMusicPlayerVisible,
    }}>
      {children}
      {tracks.length > 0 && (
        <audio
          ref={audioRef}
          src={tracks[currentTrackIndex]?.url}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
        />
      )}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  const context = useContext(MusicContext);
  if (context === undefined) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return context;
}
