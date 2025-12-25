
import React, { useRef, useState, useEffect } from 'react';
import { ROI } from '../types';

interface RoiSelectorProps {
  onRoiSelected: (roi: ROI) => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

const RoiSelector: React.FC<RoiSelectorProps> = ({ onRoiSelected, containerRef }) => {
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentRoi, setCurrentRoi] = useState<ROI | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setStartPos({ x, y });
    setCurrentRoi({ x, y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!startPos || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newRoi = {
      x: Math.min(x, startPos.x),
      y: Math.min(y, startPos.y),
      width: Math.abs(x - startPos.x),
      height: Math.abs(y - startPos.y),
    };
    setCurrentRoi(newRoi);
  };

  const handleMouseUp = () => {
    if (currentRoi && currentRoi.width > 5 && currentRoi.height > 5) {
      onRoiSelected(currentRoi);
    }
    setStartPos(null);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (currentRoi) {
        ctx.strokeStyle = '#c5a059';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(currentRoi.x, currentRoi.y, currentRoi.width, currentRoi.height);
        ctx.fillStyle = 'rgba(197, 160, 89, 0.1)';
        ctx.fillRect(currentRoi.x, currentRoi.y, currentRoi.width, currentRoi.height);
      }
      requestAnimationFrame(draw);
    };

    const handleResize = () => {
      canvas.width = containerRef.current!.clientWidth;
      canvas.height = containerRef.current!.clientHeight;
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    const anim = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(anim);
    };
  }, [currentRoi, containerRef]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-50 cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    />
  );
};

export default RoiSelector;
