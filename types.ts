
export interface ROI {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectionResult {
  id: string;
  timestamp: number;
  speaker: string;
  text: string;
  voiceName: string;
  status: 'processing' | 'ready' | 'speaking' | 'completed' | 'error';
}

export interface VoiceMapping {
  name: string;
  voice: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
  culture: string;
}

export interface OcrResponse {
  speaker: string;
  dialogue: string;
}
