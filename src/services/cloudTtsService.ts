export type TtsEngine = 'browser' | 'aliyun' | 'edge-tts' | 'custom';

export interface CloudTtsConfig {
  engine: TtsEngine;
  aliyun?: {
    accessKeyId: string;
    accessKeySecret: string;
    appKey: string;
    voice: string;
  };
  'edge-tts'?: {
    apiUrl: string;
    voice: string;
  };
  custom?: {
    apiUrl: string;
    method: 'GET' | 'POST';
    headers: Record<string, string>;
    textParam: string;
    voiceParam?: string;
    voiceValue?: string;
    rateParam?: string;
    pitchParam?: string;
  };
}

const STORAGE_KEY = 'cloud-tts-config';

// 最大文本长度限制（URL 安全长度，约 1800 字符以留有余量）
const MAX_TEXT_LENGTH = 1800;

export const EDGE_TTS_VOICES = [
  { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓', desc: '温柔女声', gender: 'female' as const },
  { id: 'zh-CN-XiaoyiNeural', name: '晓伊', desc: '标准女声', gender: 'female' as const },
  { id: 'zh-CN-XiaohanNeural', name: '晓涵', desc: '甜美女声', gender: 'female' as const },
  { id: 'zh-CN-XiaomengNeural', name: '晓梦', desc: '活泼女声', gender: 'female' as const },
  { id: 'zh-CN-XiaomoNeural', name: '晓墨', desc: '知性女声', gender: 'female' as const },
  { id: 'zh-CN-XiaoxuanNeural', name: '晓萱', desc: '清新女声', gender: 'female' as const },
  { id: 'zh-CN-XiaoyouNeural', name: '晓悠', desc: '自然女声', gender: 'female' as const },
  { id: 'zh-CN-XiaozhenNeural', name: '晓甄', desc: '优雅女声', gender: 'female' as const },
  { id: 'zh-CN-YunxiNeural', name: '云希', desc: '标准男声', gender: 'male' as const },
  { id: 'zh-CN-YunyangNeural', name: '云扬', desc: '沉稳男声', gender: 'male' as const },
  { id: 'zh-CN-YunfengNeural', name: '云锋', desc: '洪亮男声', gender: 'male' as const },
  { id: 'zh-CN-YunhaoNeural', name: '云皓', desc: '磁性男声', gender: 'male' as const },
];

export const ALIYUN_VOICES = [
  { id: 'xiaoyun', name: '艾夏', desc: '温柔女声', gender: 'female' },
  { id: 'xiaoxue', name: '艾雪', desc: '标准女声', gender: 'female' },
  { id: 'xiaomei', name: '小美', desc: '甜美女声', gender: 'female' },
  { id: 'xiaoxiao', name: '艾娜', desc: '自然女声', gender: 'female' },
  { id: 'aixia', name: '艾雅', desc: '活泼女声', gender: 'female' },
  { id: 'xiaoyuan', name: '艾媛', desc: '知性女声', gender: 'female' },
  { id: 'xiajing', name: '艾婧', desc: '甜美女声', gender: 'female' },
  { id: 'xiaobei', name: '艾北', desc: '清亮女声', gender: 'female' },
  { id: 'xiaogang', name: '艾刚', desc: '标准男声', gender: 'male' },
  { id: 'xiaowei', name: '艾伟', desc: '沉稳男声', gender: 'male' },
];

export function getDefaultConfig(): CloudTtsConfig {
  return {
    engine: 'browser'
  };
}

export function saveConfig(config: CloudTtsConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('保存 TTS 配置失败', error);
  }
}

export function loadConfig(): CloudTtsConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('加载 TTS 配置失败', error);
  }
  return getDefaultConfig();
}

/**
 * 智能分割文本为适合朗读的段落
 * 优先按句子分割，如果句子太长则按逗号、顿号分割
 */
export function splitTextForSpeech(text: string, maxLength: number = MAX_TEXT_LENGTH): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const segments: string[] = [];
  let currentSegment = '';

  // 按句子分割（句号、问号、感叹号、换行）
  const sentences = text.split(/([。！？\n]+)/);

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];

    if (!sentence) continue;

    // 如果当前句子本身超过最大长度，需要进一步分割
    if (sentence.length > maxLength) {
      // 先保存当前累积的段落
      if (currentSegment.trim()) {
        segments.push(currentSegment.trim());
        currentSegment = '';
      }

      // 按逗号、顿号、分号进一步分割长句子
      const subSentences = sentence.split(/([，、；]+)/);
      let tempSegment = '';

      for (const sub of subSentences) {
        if (!sub) continue;

        if ((tempSegment + sub).length > maxLength) {
          if (tempSegment.trim()) {
            segments.push(tempSegment.trim());
          }
          tempSegment = sub;
        } else {
          tempSegment += sub;
        }
      }

      if (tempSegment.trim()) {
        segments.push(tempSegment.trim());
      }
    } else {
      // 检查加入当前句子后是否超过最大长度
      if ((currentSegment + sentence).length > maxLength) {
        if (currentSegment.trim()) {
          segments.push(currentSegment.trim());
        }
        currentSegment = sentence;
      } else {
        currentSegment += sentence;
      }
    }
  }

  // 保存最后一段
  if (currentSegment.trim()) {
    segments.push(currentSegment.trim());
  }

  return segments.filter(s => s.length > 0);
}

export async function synthesizeTextToSpeech(
  text: string, 
  config: CloudTtsConfig, 
  options: { rate: number; pitch: number }
): Promise<Blob> {
  if (config.engine === 'browser') {
    throw new Error('浏览器 TTS 不需要调用云服务');
  }

  if (config.engine === 'aliyun') {
    return synthesizeAliyun(text, config, options);
  }

  if (config.engine === 'edge-tts') {
    return synthesizeEdgeTts(text, config, options);
  }

  if (config.engine === 'custom' && config.custom) {
    return synthesizeCustom(text, config, options);
  }

  throw new Error('未配置 TTS 服务');
}

async function synthesizeAliyun(
  text: string, 
  config: CloudTtsConfig, 
  options: { rate: number; pitch: number }
): Promise<Blob> {
  if (!config.aliyun) {
    throw new Error('阿里云 TTS 未配置');
  }

  const { accessKeyId, accessKeySecret, appKey, voice } = config.aliyun;

  if (!accessKeyId || !accessKeySecret || !appKey) {
    throw new Error('请完整填写阿里云配置');
  }

  const format = 'wav';
  const sampleRate = 16000;
  
  const params = new URLSearchParams({
    appkey: appKey,
    text: text,
    voice: voice || 'xiaoyun',
    format: format,
    sample_rate: sampleRate.toString(),
    speech_rate: options.rate.toString(),
    pitch_rate: options.pitch.toString(),
    enable_subtitle: 'false'
  });

  const requestUrl = `https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/tts?${params.toString()}`;
  
  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      'X-NLS-Token': accessKeyId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text
    })
  });

  if (!response.ok) {
    throw new Error(`请求失败: ${response.status}`);
  }

  return response.blob();
}

async function synthesizeEdgeTts(
  text: string, 
  config: CloudTtsConfig, 
  options: { rate: number; pitch: number }
): Promise<Blob> {
  if (!config['edge-tts']) {
    throw new Error('Edge TTS 未配置');
  }

  const { apiUrl, voice } = config['edge-tts'];

  if (!apiUrl) {
    throw new Error('请配置 Edge TTS API URL');
  }

  const rate = Math.round((options.rate - 1) * 100);
  const pitch = Math.round((options.pitch - 1) * 100);
  
  const params = new URLSearchParams({
    text: text,
    voice: voice || 'zh-CN-XiaoxiaoNeural',
    rate: rate.toString(),
    pitch: pitch.toString()
  });

  const requestUrl = `${apiUrl}?${params.toString()}`;
  
  const response = await fetch(requestUrl);

  if (!response.ok) {
    throw new Error(`Edge TTS 请求失败: ${response.status}`);
  }

  return response.blob();
}

async function synthesizeCustom(
  text: string, 
  config: CloudTtsConfig, 
  options: { rate: number; pitch: number }
): Promise<Blob> {
  if (!config.custom) {
    throw new Error('自定义 API 未配置');
  }

  const { apiUrl, method, headers, textParam, voiceParam, voiceValue, rateParam, pitchParam } = config.custom;

  let url = apiUrl;
  let body: string | undefined;

  if (method === 'GET') {
    const params = new URLSearchParams();
    params.set(textParam, text);
    if (voiceParam && voiceValue) params.set(voiceParam, voiceValue);
    if (rateParam) params.set(rateParam, options.rate.toString());
    if (pitchParam) params.set(pitchParam, options.pitch.toString());
    url = `${apiUrl}?${params.toString()}`;
  } else {
    body = JSON.stringify({
      [textParam]: text,
      ...(voiceParam && voiceValue ? { [voiceParam]: voiceValue } : {}),
      ...(rateParam ? { [rateParam]: options.rate } : {}),
      ...(pitchParam ? { [pitchParam]: options.pitch } : {})
    });
  }

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body
  });

  if (!response.ok) {
    throw new Error(`API 请求失败: ${response.status}`);
  }

  return response.blob();
}

export async function playAudio(blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    
    audio.onended = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('音频播放失败'));
    };
    
    audio.play().catch(reject);
  });
}

/**
 * 长文本语音合成控制器
 */
export interface SpeechController {
  play: () => void;
  pause: () => void;
  stop: () => void;
  onProgress?: (current: number, total: number) => void;
  onEnded?: () => void;
  onError?: (error: Error) => void;
}

/**
 * 朗读长文本（云 TTS 版本）
 */
export async function speakLongText(
  text: string,
  config: CloudTtsConfig,
  options: {
    rate?: number;
    pitch?: number;
    volume?: number;
    onProgress?: (current: number, total: number) => void;
    onEnded?: () => void;
    onError?: (error: Error) => void;
  } = {}
): Promise<SpeechController> {
  if (config.engine === 'browser') {
    throw new Error('浏览器 TTS 请使用 speakLongTextBrowser');
  }

  const segments = splitTextForSpeech(text);
  const { rate = 1, pitch = 1, volume = 1 } = options;

  let currentIndex = 0;
  let isPlaying = false;
  let isPaused = false;
  let currentAudio: HTMLAudioElement | null = null;
  let audioUrls: string[] = [];

  // 预合成所有音频段
  const preloadAudios = async () => {
    try {
      for (let i = 0; i < segments.length; i++) {
        if (!isPlaying && !isPaused) return; // 如果被停止则取消预加载

        const blob = await synthesizeTextToSpeech(segments[i], config, { rate, pitch });
        const url = URL.createObjectURL(blob);
        audioUrls.push(url);
      }
    } catch (error) {
      options.onError?.(error instanceof Error ? error : new Error('预加载音频失败'));
    }
  };

  const playNext = async () => {
    if (currentIndex >= segments.length || !isPlaying) {
      isPlaying = false;
      options.onEnded?.();
      return;
    }

    options.onProgress?.(currentIndex + 1, segments.length);

    try {
      // 如果该段音频还没预加载，先合成
      if (!audioUrls[currentIndex]) {
        const blob = await synthesizeTextToSpeech(segments[currentIndex], config, { rate, pitch });
        audioUrls[currentIndex] = URL.createObjectURL(blob);
      }

      const audio = new Audio(audioUrls[currentIndex]);
      currentAudio = audio;
      audio.volume = volume;

      audio.onended = () => {
        currentIndex++;
        if (isPlaying && !isPaused) {
          playNext();
        }
      };

      audio.onerror = () => {
        options.onError?.(new Error(`音频播放失败: 第 ${currentIndex + 1} 段`));
        currentIndex++;
        if (isPlaying && !isPaused) {
          playNext();
        }
      };

      await audio.play();
    } catch (error) {
      options.onError?.(error instanceof Error ? error : new Error('播放音频失败'));
      isPlaying = false;
    }
  };

  const controller: SpeechController = {
    play: () => {
      if (isPaused && currentAudio) {
        currentAudio.play();
        isPaused = false;
        isPlaying = true;
      } else if (!isPlaying) {
        isPlaying = true;
        isPaused = false;
        playNext();
        // 开始预加载剩余音频
        preloadAudios();
      }
    },
    pause: () => {
      isPaused = true;
      currentAudio?.pause();
    },
    stop: () => {
      isPlaying = false;
      isPaused = false;
      currentAudio?.pause();
      currentAudio = null;
      currentIndex = 0;
      // 清理所有音频 URL
      audioUrls.forEach(url => URL.revokeObjectURL(url));
      audioUrls = [];
    }
  };

  return controller;
}

/**
 * 朗读长文本（浏览器 TTS 版本）
 */
export function speakLongTextBrowser(
  text: string,
  options: {
    rate?: number;
    pitch?: number;
    volume?: number;
    voice?: SpeechSynthesisVoice | null;
    onProgress?: (current: number, total: number) => void;
    onEnded?: () => void;
    onError?: (error: Error) => void;
  } = {}
): SpeechController {
  if (!window.speechSynthesis) {
    throw new Error('浏览器不支持语音合成');
  }

  const segments = splitTextForSpeech(text, 300); // 浏览器 TTS 可以处理更长的段落
  const { rate = 1, pitch = 1, volume = 1, voice } = options;

  let currentIndex = 0;
  let isPlaying = false;
  let isPaused = false;

  const playNext = () => {
    if (currentIndex >= segments.length || !isPlaying) {
      isPlaying = false;
      options.onEnded?.();
      return;
    }

    options.onProgress?.(currentIndex + 1, segments.length);

    const utterance = new SpeechSynthesisUtterance(segments[currentIndex]);
    utterance.lang = 'zh-CN';
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    if (voice) {
      utterance.voice = voice;
    }

    utterance.onend = () => {
      currentIndex++;
      if (isPlaying && !isPaused) {
        playNext();
      }
    };

    utterance.onerror = (event) => {
      if (event.error !== 'canceled') {
        options.onError?.(new Error(`语音合成错误: ${event.error}`));
      }
      currentIndex++;
      if (isPlaying && !isPaused) {
        playNext();
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  const controller: SpeechController = {
    play: () => {
      if (isPaused) {
        window.speechSynthesis.resume();
        isPaused = false;
        isPlaying = true;
      } else if (!isPlaying) {
        isPlaying = true;
        isPaused = false;
        playNext();
      }
    },
    pause: () => {
      isPaused = true;
      window.speechSynthesis.pause();
    },
    stop: () => {
      isPlaying = false;
      isPaused = false;
      currentIndex = 0;
      window.speechSynthesis.cancel();
    }
  };

  return controller;
}
