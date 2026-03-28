export type TtsEngine = 'browser' | 'edge-tts' | 'custom-api';

export interface TtsVoice {
  id: string;
  name: string;
  displayName: string;
  gender: 'female' | 'male' | 'neutral';
  language: string;
  engine: TtsEngine;
}

export interface CustomApiConfig {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  bodyTemplate?: string;
  textParam: string;
  voiceParam?: string;
  rateParam?: string;
  pitchParam?: string;
}

export interface TtsConfig {
  engine: TtsEngine;
  selectedVoice: string;
  rate: number;
  pitch: number;
  volume: number;
  customApi?: CustomApiConfig;
}

const CONFIG_STORAGE_KEY = 'tts-config';

const DEFAULT_CONFIG: TtsConfig = {
  engine: 'browser',
  selectedVoice: '',
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
};

export const EDGE_TTS_VOICES: TtsVoice[] = [
  { id: 'zh-CN-XiaoxiaoNeural', name: 'Xiaoxiao', displayName: '晓晓', gender: 'female', language: 'zh-CN', engine: 'edge-tts' },
  { id: 'zh-CN-XiaoyiNeural', name: 'Xiaoyi', displayName: '晓伊', gender: 'female', language: 'zh-CN', engine: 'edge-tts' },
  { id: 'zh-CN-YunxiNeural', name: 'Yunxi', displayName: '云希', gender: 'male', language: 'zh-CN', engine: 'edge-tts' },
  { id: 'zh-CN-YunyangNeural', name: 'Yunyang', displayName: '云扬', gender: 'male', language: 'zh-CN', engine: 'edge-tts' },
  { id: 'zh-CN-XiaohanNeural', name: 'Xiaohan', displayName: '晓涵', gender: 'female', language: 'zh-CN', engine: 'edge-tts' },
  { id: 'zh-CN-XiaomengNeural', name: 'Xiaomeng', displayName: '晓梦', gender: 'female', language: 'zh-CN', engine: 'edge-tts' },
  { id: 'zh-CN-XiaomoNeural', name: 'Xiaomo', displayName: '晓墨', gender: 'female', language: 'zh-CN', engine: 'edge-tts' },
  { id: 'zh-CN-XiaoxuanNeural', name: 'Xiaoxuan', displayName: '晓萱', gender: 'female', language: 'zh-CN', engine: 'edge-tts' },
  { id: 'zh-CN-XiaoyouNeural', name: 'Xiaoyou', displayName: '晓悠', gender: 'female', language: 'zh-CN', engine: 'edge-tts' },
  { id: 'zh-CN-XiaozhenNeural', name: 'Xiaozhen', displayName: '晓甄', gender: 'female', language: 'zh-CN', engine: 'edge-tts' },
  { id: 'zh-CN-YunfengNeural', name: 'Yunfeng', displayName: '云锋', gender: 'male', language: 'zh-CN', engine: 'edge-tts' },
  { id: 'zh-CN-YunhaoNeural', name: 'Yunhao', displayName: '云皓', gender: 'male', language: 'zh-CN', engine: 'edge-tts' },
];

export class TtsService {
  private config: TtsConfig;
  private audioElement: HTMLAudioElement | null = null;
  private onEndedCallback: (() => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;
  private isPlayingRef: boolean = false;
  private currentBlobUrl: string | null = null;

  constructor() {
    this.config = this.loadConfig();
    this.initAudio();
  }

  private initAudio() {
    this.audioElement = new Audio();
    this.audioElement.onended = () => {
      this.isPlayingRef = false;
      if (this.currentBlobUrl) {
        URL.revokeObjectURL(this.currentBlobUrl);
        this.currentBlobUrl = null;
      }
      if (this.onEndedCallback) {
        this.onEndedCallback();
      }
    };
    this.audioElement.onerror = (e) => {
      this.isPlayingRef = false;
      if (this.currentBlobUrl) {
        URL.revokeObjectURL(this.currentBlobUrl);
        this.currentBlobUrl = null;
      }
      if (this.onErrorCallback) {
        this.onErrorCallback(new Error('音频播放失败'));
      }
    };
  }

  loadConfig(): TtsConfig {
    try {
      const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('加载 TTS 配置失败:', error);
    }
    return { ...DEFAULT_CONFIG };
  }

  saveConfig(config: Partial<TtsConfig>) {
    this.config = { ...this.config, ...config };
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.error('保存 TTS 配置失败:', error);
    }
  }

  getConfig(): TtsConfig {
    return { ...this.config };
  }

  getAvailableVoices(browserVoices: SpeechSynthesisVoice[]): TtsVoice[] {
    const voices: TtsVoice[] = [];
    
    browserVoices.forEach(voice => {
      const isChinese = voice.lang.toLowerCase().includes('zh') || voice.lang.toLowerCase().includes('cn');
      voices.push({
        id: voice.name,
        name: voice.name,
        displayName: voice.name,
        gender: 'neutral',
        language: voice.lang,
        engine: 'browser',
      });
    });
    
    EDGE_TTS_VOICES.forEach(voice => {
      voices.push(voice);
    });
    
    return voices;
  }

  isPlaying(): boolean {
    return this.isPlayingRef;
  }

  private async synthesizeWithEdgeTts(text: string): Promise<Blob> {
    const voice = EDGE_TTS_VOICES.find(v => v.id === this.config.selectedVoice) || EDGE_TTS_VOICES[0];
    
    try {
      const params = new URLSearchParams({
        text: text,
        voice: voice.id,
        rate: this.config.rate.toString(),
        pitch: this.config.pitch.toString(),
      });
      
      const response = await fetch(`https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?${params.toString()}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Edge TTS 请求失败: ${response.status}`);
      }
      
      return await response.blob();
    } catch (error) {
      console.error('Edge TTS 合成失败:', error);
      throw new Error('Edge TTS 服务暂时不可用，请使用浏览器原生 TTS');
    }
  }

  private async synthesizeWithCustomApi(text: string): Promise<Blob> {
    if (!this.config.customApi) {
      throw new Error('请先配置自定义 API');
    }
    
    const { url, method, headers, textParam, voiceParam, rateParam, pitchParam, bodyTemplate } = this.config.customApi;
    
    try {
      let requestUrl = url;
      let requestBody: string | undefined;
      
      if (method === 'GET') {
        const params = new URLSearchParams();
        params.set(textParam, text);
        if (voiceParam && this.config.selectedVoice) {
          params.set(voiceParam, this.config.selectedVoice);
        }
        if (rateParam) {
          params.set(rateParam, this.config.rate.toString());
        }
        if (pitchParam) {
          params.set(pitchParam, this.config.pitch.toString());
        }
        requestUrl = `${url}?${params.toString()}`;
      } else {
        if (bodyTemplate) {
          requestBody = bodyTemplate
            .replace('{{text}}', text)
            .replace('{{voice}}', this.config.selectedVoice || '')
            .replace('{{rate}}', this.config.rate.toString())
            .replace('{{pitch}}', this.config.pitch.toString());
        } else {
          const body: Record<string, any> = {
            [textParam]: text,
          };
          if (voiceParam && this.config.selectedVoice) {
            body[voiceParam] = this.config.selectedVoice;
          }
          if (rateParam) {
            body[rateParam] = this.config.rate;
          }
          if (pitchParam) {
            body[pitchParam] = this.config.pitch;
          }
          requestBody = JSON.stringify(body);
        }
      }
      
      const response = await fetch(requestUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: method === 'POST' ? requestBody : undefined,
      });
      
      if (!response.ok) {
        throw new Error(`自定义 API 请求失败: ${response.status}`);
      }
      
      return await response.blob();
    } catch (error) {
      console.error('自定义 API 合成失败:', error);
      throw error;
    }
  }

  async synthesize(text: string): Promise<Blob> {
    switch (this.config.engine) {
      case 'edge-tts':
        try {
          return await this.synthesizeWithEdgeTts(text);
        } catch {
          console.warn('Edge TTS 失败，回退到浏览器 TTS');
          this.config.engine = 'browser';
          throw new Error('浏览器 TTS 不需要合成音频');
        }
      case 'custom-api':
        try {
          return await this.synthesizeWithCustomApi(text);
        } catch {
          console.warn('自定义 API 失败，回退到浏览器 TTS');
          this.config.engine = 'browser';
          throw new Error('浏览器 TTS 不需要合成音频');
        }
      default:
        throw new Error('浏览器 TTS 不需要合成音频');
    }
  }

  async speak(text: string, onEnded?: () => void, onError?: (error: Error) => void): Promise<void> {
    this.onEndedCallback = onEnded || null;
    this.onErrorCallback = onError || null;
    
    if (this.config.engine === 'browser') {
      throw new Error('请使用浏览器原生 TTS');
    }
    
    try {
      const blob = await this.synthesize(text);
      this.currentBlobUrl = URL.createObjectURL(blob);
      
      if (!this.audioElement) {
        this.initAudio();
      }
      
      if (this.audioElement) {
        this.audioElement.src = this.currentBlobUrl;
        this.audioElement.volume = this.config.volume;
        this.isPlayingRef = true;
        await this.audioElement.play();
      }
    } catch (error) {
      this.isPlayingRef = false;
      if (this.onErrorCallback) {
        this.onErrorCallback(error instanceof Error ? error : new Error('播放失败'));
      }
      throw error;
    }
  }

  stop() {
    this.isPlayingRef = false;
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
  }

  pause() {
    if (this.audioElement && !this.audioElement.paused) {
      this.audioElement.pause();
    }
  }

  resume() {
    if (this.audioElement && this.audioElement.paused) {
      this.audioElement.play().catch(console.error);
    }
  }

  setVolume(volume: number) {
    this.config.volume = volume;
    if (this.audioElement) {
      this.audioElement.volume = volume;
    }
  }
}

export const ttsService = new TtsService();
