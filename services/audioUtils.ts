import { VoiceType } from '../types';

// Audio Context Singleton to prevent multiple contexts
let audioContext: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000, // Gemini TTS sample rate
    });
  }
  return audioContext;
};

// Base64 decoding helper
function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// PCM Data Decoding
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Convert PCM 16-bit to Float32 [-1.0, 1.0]
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const playGeminiAudio = async (base64Audio: string): Promise<void> => {
  try {
    const ctx = getAudioContext();
    
    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const audioBytes = decodeBase64(base64Audio);
    const audioBuffer = await decodeAudioData(audioBytes, ctx);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start(0);

    return new Promise((resolve) => {
      source.onended = () => resolve();
    });
  } catch (error) {
    console.error("Error playing Gemini audio:", error);
    throw error;
  }
};

export const playLocalAudio = (text: string, language: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      console.error("Local TTS not supported");
      reject("TTS not supported");
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Attempt to map simple language name to BCP 47 tag (heuristic)
    // In a real app, we'd have a robust mapping or a dropdown of actual voices.
    // Here we try to guess or fallback to English if unknown, but we want the CHILD'S language.
    // We rely on the browser's ability to find a voice for the requested lang code if provided,
    // or we assume the `language` passed is a locale code (e.g., 'es-MX', 'fr-FR').
    // If the user inputs "Spanish", we might need to map it.
    
    // Simple mapping for demo purposes.
    const langMap: Record<string, string> = {
      'spanish': 'es-ES',
      'french': 'fr-FR',
      'german': 'de-DE',
      'italian': 'it-IT',
      'japanese': 'ja-JP',
      'chinese': 'zh-CN',
      'mandarin': 'zh-CN',
      'korean': 'ko-KR',
      'portuguese': 'pt-BR',
      'russian': 'ru-RU',
      'arabic': 'ar-SA',
      'hindi': 'hi-IN'
    };

    const normalizedLang = language.toLowerCase().trim();
    utterance.lang = langMap[normalizedLang] || language; // Fallback to raw string if not in map

    utterance.onend = () => resolve();
    utterance.onerror = (e) => {
      console.error("Local TTS error", e);
      resolve(); // Resolve anyway to reset UI state
    };

    window.speechSynthesis.speak(utterance);
  });
};
