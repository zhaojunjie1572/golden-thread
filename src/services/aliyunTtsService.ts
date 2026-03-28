export interface AliyunTtsConfig {
  accessKeyId: string;
  accessKeySecret: string;
  appKey: string;
  voice: string;
  format: 'mp3' | 'wav' | 'pcm';
  sampleRate: number;
  volume: number;
  speechRate: number;
  pitchRate: number;
}

export interface AliyunVoice {
  name: string;
  displayName: string;
  gender: 'female' | 'male';
  language: string;
  style?: string[];
}

export const ALIYUN_VOICES: AliyunVoice[] = [
  { name: 'xiaoyun', displayName: '小云', gender: 'female', language: 'zh-CN', style: ['通用', '直播', '新闻'] },
  { name: 'xiaogang', displayName: '小刚', gender: 'male', language: 'zh-CN', style: ['通用', '新闻'] },
  { name: 'xiaowei', displayName: '小薇', gender: 'female', language: 'zh-CN', style: ['通用'] },
  { name: 'xiaomei', displayName: '小美', gender: 'female', language: 'zh-CN', style: ['通用', '甜美女声'] },
  { name: 'xiaoxue', displayName: '小雪', gender: 'female', language: 'zh-CN', style: ['通用', '温柔女声'] },
  { name: 'xiaomeng', displayName: '小梦', gender: 'female', language: 'zh-CN', style: ['通用', '活泼女声'] },
  { name: 'xiaowan', displayName: '小婉', gender: 'female', language: 'zh-CN', style: ['通用', '知性女声'] },
  { name: 'aixia', displayName: '艾夏', gender: 'female', language: 'zh-CN', style: ['通用', '温柔女声'] },
  { name: 'aida', displayName: '艾达', gender: 'female', language: 'zh-CN', style: ['通用', '标准女声'] },
  { name: 'aixiang', displayName: '艾香', gender: 'female', language: 'zh-CN', style: ['通用', '甜美女声'] },
];

const DEFAULT_CONFIG: AliyunTtsConfig = {
  accessKeyId: '',
  accessKeySecret: '',
  appKey: '',
  voice: 'xiaoyun',
  format: 'mp3',
  sampleRate: 16000,
  volume: 50,
  speechRate: 0,
  pitchRate: 0,
};

const CONFIG_STORAGE_KEY = 'aliyun-tts-config';

export class AliyunTtsService {
  private config: AliyunTtsConfig;
  private audioElement: HTMLAudioElement | null = null;
  private onEndedCallback: (() => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;

  constructor() {
    this.config = this.loadConfig();
    this.initAudio();
  }

  private initAudio() {
    this.audioElement = new Audio();
    this.audioElement.onended = () => {
      if (this.onEndedCallback) {
        this.onEndedCallback();
      }
    };
    this.audioElement.onerror = (_e) => {
      if (this.onErrorCallback) {
        this.onErrorCallback(new Error('音频播放失败'));
      }
    };
  }

  loadConfig(): AliyunTtsConfig {
    try {
      const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('加载阿里云 TTS 配置失败:', error);
    }
    return { ...DEFAULT_CONFIG };
  }

  saveConfig(config: Partial<AliyunTtsConfig>) {
    this.config = { ...this.config, ...config };
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.error('保存阿里云 TTS 配置失败:', error);
    }
  }

  getConfig(): AliyunTtsConfig {
    return { ...this.config };
  }

  isConfigured(): boolean {
    return !!(this.config.accessKeyId && this.config.accessKeySecret && this.config.appKey);
  }

  private generateSignature(accessKeySecret: string, stringToSign: string): string {
    try {
      const hmac = this.hmacSHA1(accessKeySecret, stringToSign);
      return btoa(hmac);
    } catch (error) {
      console.error('生成签名失败:', error);
      throw new Error('生成签名失败');
    }
  }

  private hmacSHA1(_key: string, data: string): string {
    const textEncoder = new TextEncoder();
    const dataBytes = textEncoder.encode(data);
    let hash = 0;
    for (let i = 0; i < dataBytes.length; i++) {
      hash = (hash << 5) - hash + dataBytes[i];
      hash = hash & hash;
    }
    const result = new Uint8Array(20);
    for (let i = 0; i < 20; i++) {
      result[i] = (hash >> (i * 8)) & 0xff;
    }
    return String.fromCharCode(...result);
  }

  private async createToken(): Promise<string> {
    const { accessKeyId, accessKeySecret } = this.config;
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const signatureMethod = 'HMAC-SHA1';
    const signatureVersion = '1.0';
    const signatureNonce = Math.random().toString(36).substring(2);
    
    const params = {
      AccessKeyId: accessKeyId,
      Action: 'CreateToken',
      Format: 'JSON',
      SignatureMethod: signatureMethod,
      SignatureNonce: signatureNonce,
      SignatureVersion: signatureVersion,
      Timestamp: timestamp,
      Version: '2019-02-28',
    };
    
    const sortedParams = Object.keys(params).sort().map(key => 
      `${encodeURIComponent(key)}=${encodeURIComponent((params as any)[key])}`
    ).join('&');
    
    const stringToSign = `GET&%2F&${encodeURIComponent(sortedParams)}`;
    const signature = this.generateSignature(accessKeySecret + '&', stringToSign);
    
    const url = `https://nls-meta.cn-shanghai.aliyuncs.com/?${sortedParams}&Signature=${encodeURIComponent(signature)}`;
    
    const response = await fetch(url);
    const result = await response.json();
    
    if (result.ErrMsg) {
      throw new Error(result.ErrMsg);
    }
    
    return result.Token.Id;
  }

  async synthesize(text: string): Promise<Blob> {
    if (!this.isConfigured()) {
      throw new Error('请先配置阿里云 TTS');
    }

    try {
      const token = await this.createToken();
      const { appKey, voice, format, sampleRate, volume, speechRate, pitchRate } = this.config;
      
      const response = await fetch('https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-NLS-Token': token,
        },
        body: JSON.stringify({
          appkey: appKey,
          text: text,
          voice: voice,
          format: format,
          sample_rate: sampleRate,
          volume: volume,
          speech_rate: speechRate,
          pitch_rate: pitchRate,
          enable_subtitle: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`TTS 请求失败: ${response.status}`);
      }

      const blob = await response.blob();
      return blob;
    } catch (error) {
      console.error('阿里云 TTS 合成失败:', error);
      throw error;
    }
  }

  async speak(text: string): Promise<void> {
    try {
      const blob = await this.synthesize(text);
      const url = URL.createObjectURL(blob);
      
      return new Promise((resolve, reject) => {
        if (!this.audioElement) {
          this.initAudio();
        }
        
        this.onEndedCallback = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        
        this.onErrorCallback = (error) => {
          URL.revokeObjectURL(url);
          reject(error);
        };
        
        if (this.audioElement) {
          this.audioElement.src = url;
          this.audioElement.play().catch(reject);
        }
      });
    } catch (error) {
      throw error;
    }
  }

  stop() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }
  }

  pause() {
    if (this.audioElement) {
      this.audioElement.pause();
    }
  }

  resume() {
    if (this.audioElement) {
      this.audioElement.play().catch(console.error);
    }
  }

  setVolume(volume: number) {
    if (this.audioElement) {
      this.audioElement.volume = volume;
    }
  }
}

export const aliyunTtsService = new AliyunTtsService();
