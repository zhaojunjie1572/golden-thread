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

  useEffect(() => {
    if (audioRef.current && isPlaying && tracks.length > 0) {
      audioRef.current.play().catch(e => console.error('Play error:', e));
    }
  }, [currentTrackIndex, tracks, isPlaying]);

  useEffect(() => {
    localStorage.setItem('music-tracks', JSON.stringify(tracks.map(t => ({ id: t.id, name: t.name, fileName: t.fileName }))));
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
