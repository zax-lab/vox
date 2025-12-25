
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ROI, DetectionResult, VoiceMapping } from './types';
import { DEFAULT_VOICE_MAPPINGS, APP_CONFIG } from './constants';
import { performOcr, generateSpeech, decodeAudioData } from './geminiService';
import RoiSelector from './components/RoiSelector';

const App: React.FC = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [roi, setRoi] = useState<ROI | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [results, setResults] = useState<DetectionResult[]>([]);
  const [voiceMappings, setVoiceMappings] = useState<VoiceMapping[]>(DEFAULT_VOICE_MAPPINGS);
  const [isSelectorActive, setIsSelectorActive] = useState(false);
  const [statusMsg, setStatusMsg] = useState('System Standby');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastProcessedText = useRef<string>('');

  // Setup Audio Context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  const startScreenCapture = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStatusMsg('Source Connected');
    } catch (err) {
      console.error('Error sharing screen:', err);
      setStatusMsg('Screen Share Denied');
    }
  };

  const stopScreenCapture = () => {
    stream?.getTracks().forEach(track => track.stop());
    setStream(null);
    setIsCapturing(false);
    setStatusMsg('System Standby');
  };

  const toggleCapture = () => {
    if (!roi) {
      alert("Please define a Region of Interest (ROI) first.");
      return;
    }
    setIsCapturing(!isCapturing);
    setStatusMsg(isCapturing ? 'Capture Paused' : 'Monitoring Active');
  };

  const processFrame = useCallback(async () => {
    if (!isCapturing || !roi || !videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Adjust canvas to ROI size
    canvas.width = roi.width;
    canvas.height = roi.height;

    // We need to calculate scaling since the video might be scaled in the UI
    const scaleX = video.videoWidth / video.clientWidth;
    const scaleY = video.videoHeight / video.clientHeight;

    ctx.drawImage(
      video,
      roi.x * scaleX, roi.y * scaleY, roi.width * scaleX, roi.height * scaleY,
      0, 0, roi.width, roi.height
    );

    const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    
    // Perform OCR
    const ocrData = await performOcr(base64Image);

    if (ocrData && ocrData.dialogue.trim().length > 5 && ocrData.dialogue !== lastProcessedText.current) {
      lastProcessedText.current = ocrData.dialogue;
      
      const speaker = ocrData.speaker || 'Unknown';
      const mapping = voiceMappings.find(m => m.name.toLowerCase().includes(speaker.toLowerCase())) || 
                     { name: speaker, voice: 'Zephyr' as const, culture: 'Unknown' };

      const newResult: DetectionResult = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        speaker,
        text: ocrData.dialogue,
        voiceName: mapping.voice,
        status: 'processing'
      };

      setResults(prev => [newResult, ...prev].slice(0, 50));

      // Generate TTS
      const audioBytes = await generateSpeech(ocrData.dialogue, mapping.voice);
      if (audioBytes && audioContextRef.current) {
        const audioBuffer = await decodeAudioData(
          audioBytes,
          audioContextRef.current,
          APP_CONFIG.AUDIO_SAMPLE_RATE,
          1
        );
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        
        setResults(prev => prev.map(r => r.id === newResult.id ? { ...r, status: 'speaking' } : r));
        source.start();
        source.onended = () => {
          setResults(prev => prev.map(r => r.id === newResult.id ? { ...r, status: 'completed' } : r));
        };
      } else {
        setResults(prev => prev.map(r => r.id === newResult.id ? { ...r, status: 'error' } : r));
      }
    }
  }, [isCapturing, roi, voiceMappings]);

  // Fix: Replaced NodeJS.Timeout with any to resolve the "Cannot find namespace 'NodeJS'" error in browser context.
  useEffect(() => {
    let interval: any;
    if (isCapturing) {
      interval = setInterval(processFrame, APP_CONFIG.REFRESH_INTERVAL);
    }
    return () => clearInterval(interval);
  }, [isCapturing, processFrame]);

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="bannerlord-font text-3xl md:text-4xl medieval-accent font-bold tracking-wider">
            VOICE OVERLAY PROTOTYPE
          </h1>
          <p className="text-gray-400 text-sm mt-1 uppercase tracking-widest">Advanced OCR-to-Voice Simulation</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-gray-500 uppercase">System Status</p>
            <p className={`font-semibold ${isCapturing ? 'text-green-500' : 'text-yellow-500'}`}>{statusMsg}</p>
          </div>
          <button 
            onClick={stream ? stopScreenCapture : startScreenCapture}
            className={`medieval-button px-6 py-2 rounded uppercase text-sm font-bold tracking-tighter flex items-center gap-2`}
          >
            <i className={`fa-solid ${stream ? 'fa-plug-circle-xmark' : 'fa-desktop'}`}></i>
            {stream ? 'Disconnect' : 'Connect Source'}
          </button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Feed and Controls */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div 
            ref={containerRef}
            className="medieval-panel relative aspect-video rounded-lg overflow-hidden flex items-center justify-center group"
          >
            {stream ? (
              <>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  className="w-full h-full object-contain"
                />
                {isSelectorActive && (
                  <RoiSelector 
                    containerRef={containerRef} 
                    onRoiSelected={(newRoi) => {
                      setRoi(newRoi);
                      setIsSelectorActive(false);
                      setStatusMsg('ROI Defined');
                    }} 
                  />
                )}
                {roi && !isSelectorActive && (
                  <div 
                    className="absolute border-2 border-dashed border-yellow-500 bg-yellow-500/10 pointer-events-none"
                    style={{
                      left: roi.x,
                      top: roi.y,
                      width: roi.width,
                      height: roi.height
                    }}
                  >
                    <span className="absolute -top-6 left-0 bg-yellow-500 text-black text-[10px] font-bold px-1 rounded">
                      CAPTURE ZONE
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center p-12">
                <i className="fa-solid fa-camera-retro text-6xl text-gray-700 mb-4"></i>
                <p className="text-gray-500 italic">No source connected. Please connect a screen or window to begin.</p>
              </div>
            )}
            
            {/* Hover Overlay Controls */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-md p-2 rounded-full flex gap-2">
              <button 
                onClick={() => setIsSelectorActive(!isSelectorActive)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isSelectorActive ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
                title="Define Capture Region"
              >
                <i className="fa-solid fa-expand"></i>
              </button>
              <button 
                onClick={toggleCapture}
                disabled={!roi}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${!roi ? 'opacity-50 cursor-not-allowed' : ''} ${isCapturing ? 'bg-red-600 text-white' : 'bg-green-600 text-white hover:bg-green-500'}`}
                title={isCapturing ? 'Pause Monitoring' : 'Start Monitoring'}
              >
                <i className={`fa-solid ${isCapturing ? 'fa-pause' : 'fa-play'}`}></i>
              </button>
            </div>
          </div>

          {/* Activity Log */}
          <div className="medieval-panel flex-1 rounded-lg p-6 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="bannerlord-font text-xl medieval-accent">Detection Log</h2>
              <span className="text-xs text-gray-500">{results.length} Entries Captured</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 max-h-[300px]">
              {results.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-600 italic">
                  Waiting for dialogue detection...
                </div>
              ) : (
                results.map((res) => (
                  <div key={res.id} className="bg-[#222] p-4 rounded border-l-4 border-[#c5a059] flex gap-4 animate-in slide-in-from-left duration-300">
                    <div className="flex-shrink-0 flex flex-col items-center justify-center text-xs w-16">
                      <span className="text-gray-500">{new Date(res.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      <div className={`mt-2 h-2 w-2 rounded-full ${res.status === 'speaking' ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}></div>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-[#c5a059] uppercase text-sm">{res.speaker}</span>
                        <span className="text-[10px] bg-black/50 px-2 py-1 rounded text-gray-400 font-mono">VOICE: {res.voiceName}</span>
                      </div>
                      <p className="text-sm mt-1 italic text-gray-300">"{res.text}"</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Settings */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="medieval-panel rounded-lg p-6">
            <h2 className="bannerlord-font text-xl medieval-accent mb-4">Voice Mappings</h2>
            <p className="text-xs text-gray-400 mb-6">Link character names to specific vocal profiles.</p>
            
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {voiceMappings.map((mapping, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded border border-white/10">
                  <div>
                    <p className="text-sm font-bold">{mapping.name}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">{mapping.culture}</p>
                  </div>
                  <select 
                    value={mapping.voice}
                    onChange={(e) => {
                      const newMappings = [...voiceMappings];
                      newMappings[idx].voice = e.target.value as any;
                      setVoiceMappings(newMappings);
                    }}
                    className="bg-black text-[#c5a059] text-xs border border-[#c5a059]/30 rounded px-2 py-1 outline-none"
                  >
                    <option value="Kore">Kore (Regal)</option>
                    <option value="Puck">Puck (Energetic)</option>
                    <option value="Charon">Charon (Gravelly)</option>
                    <option value="Fenrir">Fenrir (Deep)</option>
                    <option value="Zephyr">Zephyr (Wise)</option>
                  </select>
                </div>
              ))}
              
              <button className="w-full border border-dashed border-gray-600 text-gray-500 py-3 text-xs uppercase hover:border-[#c5a059] hover:text-[#c5a059] transition-all">
                <i className="fa-solid fa-plus mr-2"></i> Add Mapping
              </button>
            </div>
          </div>

          <div className="medieval-panel rounded-lg p-6 bg-gradient-to-br from-[#1a1a1a] to-[#2a2215]">
            <h2 className="bannerlord-font text-lg medieval-accent mb-2">Technical Summary</h2>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">OCR Engine</span>
                <span className="text-gray-200">Gemini 3 Flash</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">TTS Engine</span>
                <span className="text-gray-200">Gemini 2.5 Flash TTS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Sample Rate</span>
                <span className="text-gray-200">24kHz PCM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">ROI Status</span>
                <span className={`${roi ? 'text-green-500' : 'text-red-500'}`}>
                  {roi ? `${roi.width}x${roi.height} Set` : 'Not Configured'}
                </span>
              </div>
            </div>
            
            <div className="mt-8 pt-4 border-t border-white/5">
              <p className="text-[10px] text-gray-500 italic text-center">
                This prototype demonstrates real-time pixel extraction to AI-generated humanized voice.
              </p>
            </div>
          </div>
        </div>
      </main>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;
