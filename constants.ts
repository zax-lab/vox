
import { VoiceMapping } from './types';

export const DEFAULT_VOICE_MAPPINGS: VoiceMapping[] = [
  { name: 'Derthert', voice: 'Charon', culture: 'Vlandia' },
  { name: 'Rhagaea', voice: 'Kore', culture: 'Empire' },
  { name: 'Caladog', voice: 'Fenrir', culture: 'Battania' },
  { name: 'Unqid', voice: 'Zephyr', culture: 'Aserai' },
  { name: 'Monchug', voice: 'Puck', culture: 'Khuzait' },
  { name: 'Raganvad', voice: 'Fenrir', culture: 'Sturgia' },
  { name: 'Garios', voice: 'Charon', culture: 'Empire' },
  { name: 'Lucon', voice: 'Zephyr', culture: 'Empire' },
];

export const APP_CONFIG = {
  REFRESH_INTERVAL: 1500, // ms
  OCR_MODEL: 'gemini-3-flash-preview',
  TTS_MODEL: 'gemini-2.5-flash-preview-tts',
  AUDIO_SAMPLE_RATE: 24000,
};
