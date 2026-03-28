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

  const url = `https://nls-meta.cn-shanghai.aliyuncs.com/2019-02-28/meta/filelist?Action=CreateToken`;
  const timestamp = new Date().toISOString();
  
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
