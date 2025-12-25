
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { APP_CONFIG } from "./constants";
import { OcrResponse } from "./types";

// Always use the required initialization format.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Base64 Decoding Utility following the provided manual implementation guideline.
 */
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Performs OCR on a base64 image chunk using Gemini.
 * Identifies both speaker and dialogue text.
 */
export const performOcr = async (base64Image: string): Promise<OcrResponse | null> => {
  try {
    const response = await ai.models.generateContent({
      model: APP_CONFIG.OCR_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
          {
            text: "Analyze this gaming UI snippet. Identify the speaker's name (if any) and the dialogue text. Return the result in JSON format with keys 'speaker' and 'dialogue'. If no speaker is found, use 'Unknown'. If no clear dialogue is found, return empty strings.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            speaker: { type: Type.STRING },
            dialogue: { type: Type.STRING },
          },
          required: ["speaker", "dialogue"],
        },
      },
    });

    // Directly access the .text property.
    const text = response.text;
    if (!text) return null;
    return JSON.parse(text.trim()) as OcrResponse;
  } catch (error) {
    console.error("OCR Error:", error);
    return null;
  }
};

/**
 * Generates speech from text using specified voice.
 */
export const generateSpeech = async (text: string, voiceName: string): Promise<Uint8Array | null> => {
  try {
    const response = await ai.models.generateContent({
      model: APP_CONFIG.TTS_MODEL,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) return null;

    // Use the manual decode helper as recommended.
    return decode(base64Audio);
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
};

/**
 * Audio Decoding Utility - Processes raw PCM audio data.
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
