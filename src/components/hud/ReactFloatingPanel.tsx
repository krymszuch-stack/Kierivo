import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Minus,
  Maximize2,
  Minimize2,
  Move,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  ShieldCheck,
  Zap,
  User,
  TrendingUp,
  Award,
  Video,
  Eye,
  Lock,
  Clock,
  Sparkles,
} from 'lucide-react';
import { motion } from 'motion/react';
import { MasterVault, STARStory } from '../../types';
import { buildStarStoriesFromVault } from '../../lib/starStoryEngine';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';

export interface ReactFloatingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  vault: MasterVault;
  initialSlot?: 1 | 2 | 3;
  className?: string;
}

export const ReactFloatingPanel: React.FC<ReactFloatingPanelProps> = ({
  isOpen,
  onClose,
  vault,
  initialSlot = 3,
  className = '',
}) => {
  const [activeSlot, setActiveSlot] = useState<1 | 2 | 3>(initialSlot);
  const [isMinimized, setIsMinimized] = useState(false);
  const [opacity, setOpacity] = useState(90); // 30% - 100%
  const [fontSize, setFontSize] = useState(14); // 12px - 22px
  const [isScrolling, setIsScrolling] = useState(false);
  const [isZoomSimulated, setIsZoomSimulated] = useState(false);
  const wpmSpeed = 140; // Domyślna prędkość telepromptera WPM

  // Pozycja okna (drag)
  const [position, setPosition] = useState({ x: 24, y: 80 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, initialPosX: 0, initialPosY: 0 });

  const teleprompterRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Pobranie historii STAR z MasterVault
  const starStories: STARStory[] = React.useMemo(() => {
    return buildStarStoriesFromVault(vault);
  }, [vault]);

  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0);
  const currentStory = starStories[selectedStoryIndex] || starStories[0];

  // Skróty klawiszowe Ctrl+1, Ctrl+2, Ctrl+3
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '1') {
          e.preventDefault();
          setActiveSlot(1);
        } else if (e.key === '2') {
          e.preventDefault();
          setActiveSlot(2);
        } else if (e.key === '3') {
          e.preventDefault();
          setActiveSlot(3);
        } else if (e.key === ' ' && activeSlot === 3) {
          e.preventDefault();
          setIsScrolling((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeSlot]);

  // Autoprzewijanie telepromptera
  useEffect(() => {
    if (isScrolling && teleprompterRef.current) {
      const pixelsPerSecond = (wpmSpeed / 60) * 16;
      const intervalMs = 50;
      const pixelsPerInterval = (pixelsPerSecond * intervalMs) / 1000;

      scrollIntervalRef.current = setInterval(() => {
        if (teleprompterRef.current) {
          teleprompterRef.current.scrollTop += pixelsPerInterval;
        }
      }, intervalMs);
    } else if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
    }

    return () => {
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
    };
  }, [isScrolling, wpmSpeed]);

  // Obsługa przeciągania okna
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, textarea, select')) return;
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialPosX: position.x,
      initialPosY: position.y,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = moveEvent.clientX - dragStartRef.current.x;
      const deltaY = moveEvent.clientY - dragStartRef.current.y;
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 380, dragStartRef.current.initialPosX + deltaX)),
        y: Math.max(0, Math.min(window.innerHeight - 200, dragStartRef.current.initialPosY + deltaY)),
      });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleResetScroll = () => {
    setIsScrolling(false);
    if (teleprompterRef.current) {
      teleprompterRef.current.scrollTop = 0;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        opacity: opacity / 100,
      }}
      className={`fixed z-50 w-[420px] max-w-[95vw] select-none rounded-3xl border border-brand-500/40 bg-elevated/95 backdrop-blur-md shadow-floating transition-opacity duration-150 ${className}`}
    >
      {/* Pasek Tytułowy (Draggable Header) */}
      <div
        onMouseDown={handleMouseDown}
        className="flex cursor-move items-center justify-between border-b border-line px-4 py-2.5 bg-sunken/40 rounded-t-3xl"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-600 text-on-brand shadow-xs">
            <Zap className="h-3.5 w-3.5" />
          </div>
          <div className="flex items-center gap-1.5">
            {/* Sufiks „(live-hud-v1)" to identyfikator wewnętrzny — nie dla UI. */}
            <span className="font-mono text-xs font-black tracking-wider text-ink">
              LIVE HUD
            </span>
            <span className="rounded bg-brand-500/10 px-1.5 py-0.2 font-mono text-[9px] font-bold text-brand-600 flex items-center gap-0.5">
              <Lock className="h-2.5 w-2.5" /> Dane z Vaultu
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Przełącznik symulacji Zoom/Meeting */}
          <button
            type="button"
            onClick={() => setIsZoomSimulated(!isZoomSimulated)}
            title="Podgląd panelu podczas spotkania (symulacja)"
            className={`rounded-lg p-1.5 transition-colors ${
              isZoomSimulated ? 'bg-error text-white animate-pulse' : 'text-muted hover:bg-surface hover:text-ink'
            }`}
          >
            <Video className="h-3.5 w-3.5" />
          </button>

          {/* Minimalizuj */}
          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink transition-colors"
          >
            {isMinimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
          </button>

          {/* Zamknij */}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-error transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="p-4 space-y-3.5">
          {/* Pasek Przełączania Slotów 1, 2, 3 */}
          <div className="grid grid-cols-3 gap-1.5 bg-surface p-1 rounded-xl border border-line">
            <button
              type="button"
              onClick={() => setActiveSlot(1)}
              className={`flex flex-col items-center py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
                activeSlot === 1
                  ? 'bg-brand-600 text-on-brand shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <span>Slot 1 (Ctrl+1)</span>
              <span className="text-[8px] opacity-80">Profil & Pitch</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSlot(2)}
              className={`flex flex-col items-center py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
                activeSlot === 2
                  ? 'bg-brand-600 text-on-brand shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <span>Slot 2 (Ctrl+2)</span>
              <span className="text-[8px] opacity-80">Twarde Liczby</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSlot(3)}
              className={`flex flex-col items-center py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
                activeSlot === 3
                  ? 'bg-brand-600 text-on-brand shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <span>Slot 3 (Ctrl+3)</span>
              <span className="text-[8px] opacity-80">STAR Teleprompter</span>
            </button>
          </div>

          {/* Zawartość Slotu 1: Profil & Elevator Pitch */}
          {activeSlot === 1 && (
            <div className="rounded-2xl border border-line bg-surface p-3.5 space-y-2">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <div className="flex items-center gap-1.5">
                  <User className="h-4 w-4 text-brand-600" />
                  <span className="font-bold text-xs text-ink">{vault.personalInfo.fullName || 'Profil Kandydata'}</span>
                </div>
                <span className="text-[10px] font-mono text-muted">{vault.personalInfo.title}</span>
              </div>

              <div className="space-y-1">
                <span className="font-mono text-[9px] font-extrabold uppercase text-muted">
                  Kluczowy Elevator Pitch (30s)
                </span>
                {/* Reguła 1: brak podsumowania to uczciwy pusty stan. Syntetyczny pitch
                    fabrykował kompetencje i wystawiał je jako „Kluczowy Pitch" podczas
                    prawdziwej rozmowy — dokładnie klasa błędu usunięta z Trackera. */}
                <p className="text-xs text-ink/90 font-sans leading-relaxed">
                  {vault.personalInfo.summary || (
                    <span className="italic text-muted">
                      Brak pitcha — uzupełnij podsumowanie w Master Vault.
                    </span>
                  )}
                </p>
              </div>

              {((vault.skillsMatrix?.hardSkills?.length ?? 0) > 0 || (vault.skillsMatrix?.toolsAndTech?.length ?? 0) > 0) && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {[...(vault.skillsMatrix?.hardSkills || []), ...(vault.skillsMatrix?.toolsAndTech || [])].slice(0, 5).map((sk) => (
                    <span
                      key={sk}
                      className="rounded bg-sunken px-1.5 py-0.2 font-mono text-[9px] font-medium text-ink"
                    >
                      {sk}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Zawartość Slotu 2: Twarde Liczby i Metryki */}
          {activeSlot === 2 && (
            <div className="rounded-2xl border border-line bg-surface p-3.5 space-y-2.5">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-success-fg" />
                  <span className="font-bold text-xs text-ink">Liczby i osiągnięcia z profilu</span>
                </div>
                <span className="text-[9px] font-mono font-bold text-success-fg">Z Vaultu</span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {vault.history?.flatMap((exp) => exp.highlights || []).slice(0, 4).map((hl, i) => (
                  <div key={i} className="rounded-lg border border-line/60 bg-sunken p-2 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9px] font-bold text-brand-600">
                        {hl.tool || hl.action || 'Wdrożenie'}
                      </span>
                      {hl.metric && (
                        <span className="rounded bg-success-soft px-1.5 py-0.2 font-mono text-[10px] font-extrabold text-success-fg">
                          {hl.metric}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-ink/90 leading-snug">{hl.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Zawartość Slotu 3: STAR Teleprompter */}
          {activeSlot === 3 && currentStory && (
            <div className="space-y-2.5">
              {/* Wybór Historii STAR */}
              <div className="flex items-center justify-between">
                <select
                  value={selectedStoryIndex}
                  onChange={(e) => {
                    setSelectedStoryIndex(Number(e.target.value));
                    handleResetScroll();
                  }}
                  className="rounded-lg border border-line bg-surface px-2 py-1 text-[11px] font-mono font-bold text-ink max-w-[280px] truncate focus:outline-none"
                >
                  {starStories.map((s, idx) => (
                    <option key={s.id} value={idx}>
                      {s.title}
                    </option>
                  ))}
                </select>

                <span className="text-[10px] font-mono text-muted">
                  {currentStory.durationSec}s
                </span>
              </div>

              {/* Okno Tekstu Telepromptera */}
              <div
                ref={teleprompterRef}
                style={{ fontSize: `${fontSize}px` }}
                className="max-h-48 overflow-y-auto rounded-2xl border border-line bg-surface p-3.5 space-y-2.5 font-sans leading-relaxed text-ink scroll-smooth"
              >
                <div>
                  <span className="font-mono text-[9px] font-extrabold uppercase text-muted block">
                    S — Sytuacja
                  </span>
                  <p className="text-ink/90">{currentStory.situation}</p>
                </div>

                <div>
                  <span className="font-mono text-[9px] font-extrabold uppercase text-brand-600 block">
                    T — Zadanie
                  </span>
                  <p className="text-ink/90">{currentStory.task}</p>
                </div>

                <div>
                  <span className="font-mono text-[9px] font-extrabold uppercase text-brand-700 block">
                    A — Działanie
                  </span>
                  <p className="text-ink/90">{currentStory.action}</p>
                </div>

                <div className="rounded-lg bg-success-soft/50 p-2 border border-success/30">
                  <span className="font-mono text-[9px] font-extrabold uppercase text-success-fg block">
                    R — Rezultat
                  </span>
                  <p className="font-semibold text-success-fg">{currentStory.result}</p>
                </div>
              </div>

              {/* Kontrolki Telepromptera */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant={isScrolling ? 'secondary' : 'primary'}
                    size="sm"
                    icon={isScrolling ? Pause : Play}
                    onClick={() => setIsScrolling(!isScrolling)}
                  >
                    {isScrolling ? 'Pauza' : 'Auto-przewijaj'}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={RotateCcw}
                    onClick={handleResetScroll}
                  >
                    Reset
                  </Button>
                </div>

                {/* Odczyt WPM usunięty: nie ma kontrolki zmiany tempa — parametr steruje
                    wyłącznie prędkością auto-przewijania, więc liczba niczego nie opisywała.
                    Rozmiar fontu zostaje, bo zmieniają go przyciski A-/A+. */}
                <div className="flex items-center gap-2 text-[10px] font-mono text-muted">
                  <span>{fontSize}px</span>
                </div>
              </div>
            </div>
          )}

          {/* Pasek ustawień: Przezroczystość, Rozmiar tekstu i Szybkość WPM */}
          <div className="flex items-center justify-between border-t border-line pt-2.5 text-[10px] font-mono text-muted">
            <div className="flex items-center gap-1.5">
              <span>Przezroczystość:</span>
              <input
                type="range"
                min="30"
                max="100"
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                className="h-1 w-16 accent-brand-600"
              />
              <span>{opacity}%</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span>Rozmiar:</span>
              <button
                type="button"
                onClick={() => setFontSize((f) => Math.max(11, f - 1))}
                className="rounded px-1 bg-sunken hover:bg-line text-ink"
              >
                A-
              </button>
              <button
                type="button"
                onClick={() => setFontSize((f) => Math.min(22, f + 1))}
                className="rounded px-1 bg-sunken hover:bg-line text-ink"
              >
                A+
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
