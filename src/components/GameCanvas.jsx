import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Stage, Layer, Shape, Rect, Image as KonvaImage, Group, Text } from 'react-konva';
import useImage from 'use-image';
import { generatePieces, calculateDistance, drawPiecePath, getSvgPath } from '../utils/puzzleLogic';
import { useGestureControl } from '../hooks/useGestureControl';
import './GameCanvas.css';

const formatTime = (totalSeconds) => {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds / 60 % 1 * 60).toFixed(0).padStart(2, '0');
  return `${m}:${s}`;
};

const GameTimer = ({ isWin, isPaused, colors, timeRef }) => {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (isWin || isPaused) return;
    const interval = setInterval(() => setSeconds(s => { timeRef.current = s + 1; return s + 1; }), 1000);
    return () => clearInterval(interval);
  }, [isWin, isPaused, timeRef]);
  if (isWin) return null;
  return (
    <div className="ios-glass" style={{ position: 'fixed', top: 'max(20px, env(safe-area-inset-top))', right: 'max(20px, env(safe-area-inset-right))', color: colors.accent, fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'monospace', zIndex: 10, padding: '10px 20px' }}>
      {formatTime(seconds)}
    </div>
  );
};

// --- CONFETTI COMPONENT ---
const Confetti = ({ colors }) => {
  const confettiPieces = useMemo(() => {
    const palette = ['#ff0055', '#00f0ff', '#ffaa00', '#00ff88', '#ff44ff', colors.accent];
    return Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 2}s`,
      duration: `${2 + Math.random() * 2}s`,
      color: palette[Math.floor(Math.random() * palette.length)],
      size: `${6 + Math.random() * 8}px`,
      rotation: `${Math.random() * 360}deg`,
    }));
  }, [colors.accent]);

  return (
    <div className="confetti-container">
      {confettiPieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
            transform: `rotate(${p.rotation})`,
          }}
        />
      ))}
    </div>
  );
};

// --- GESTURE STATUS OVERLAY ---
const GestureStatus = ({ statusMessage, errorMessage, colors, onDismissError }) => {
  if (!statusMessage && !errorMessage) return null;

  return (
    <div className="ios-glass gesture-status" style={{
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 200,
      padding: '12px 24px',
      maxWidth: '90vw',
      textAlign: 'center',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    }}>
      {statusMessage && (
        <>
          <div className="gesture-spinner" />
          <span style={{ color: colors.accent, fontSize: '0.9rem', fontWeight: 500 }}>
            {statusMessage}
          </span>
        </>
      )}
      {errorMessage && (
        <>
          <span style={{ color: '#ff4444', fontSize: '0.9rem', fontWeight: 500 }}>
            ⚠️ {errorMessage}
          </span>
          <button
            className="ios-btn"
            onClick={onDismissError}
            style={{ padding: '4px 12px', fontSize: '0.8rem', marginLeft: '8px' }}
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
};

export default function GameCanvas({ imgUrl, gridSize, onBack, theme, colors, gestureEnabled = false }) {
  const [image] = useImage(imgUrl);
  const [pieces, setPieces] = useState([]);
  const piecesRef = useRef(pieces);
  useEffect(() => { piecesRef.current = pieces; }, [pieces]);
  const markedAreaRef = useRef(null);

  // Ref for background counting, State for rendering the final score
  const timeRef = useRef(0);
  const [finalTime, setFinalTime] = useState(0);

  const [boardConfig, setBoardConfig] = useState({ boardW: 0, boardH: 0, offsetX: 0, offsetY: 0, scale: 1 });
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [windowSize, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [isExiting, setIsExiting] = useState(false);

  // --- GESTURE CONTROL STATE ---
  // Initialize from the Gallery's pre-set value
  const [useHoloMode, setUseHoloMode] = useState(gestureEnabled);
  const { isReady, gestureState, videoRef, statusMessage, errorMessage } = useGestureControl(useHoloMode);

  const [activeGesturePieceId, setActiveGesturePieceId] = useState(null);
  const activePieceRef = useRef(null); // SYNCHRONOUS TRACKER for high-speed loop
  const pieceNodesRef = useRef({}); // DIRECT KONVA NODE TRACKER for 60fps performance
  const dragOffsetRef = useRef({ x: 0, y: 0 }); // Prevents center-snapping glitch
  const prevPinchRef = useRef(false); // Tracks exact moment a pinch starts
  const isClickingUIRef = useRef(false); // Prevents grabbing pieces while clicking UI

  // --- GESTURE HELP MODAL & TOAST PROMPTS ---
  const [showGestureHelp, setShowGestureHelp] = useState(false);
  const [gestureToast, setGestureToast] = useState(null);

  // --- HINT SYSTEM, UNLOCKED PIECE, & RATINGS ---
  const [showHint, setShowHint] = useState(false);
  const [wrongMoves, setWrongMoves] = useState(0);
  const [feedbackStatus, setFeedbackStatus] = useState(null);
  const [showTutorial, setShowTutorial] = useState(() => !localStorage.getItem('tutorialSeen'));
  const unlockedPiece = pieces.find(p => !p.isFixed);
  const unlockedPieceId = unlockedPiece ? unlockedPiece.id : null;

  const handleDismissTutorial = () => {
    localStorage.setItem('tutorialSeen', 'true');
    setShowTutorial(false);
  };

  const handleHintClick = () => {
    setShowHint(true);
    setTimeout(() => setShowHint(false), 2500);
  };

  const showToast = useCallback((msg) => {
    setGestureToast(msg);
    setTimeout(() => setGestureToast(null), 1500);
  }, []);

  const isWin = pieces.length > 0 && pieces.every(p => p.isFixed);
  const isMobile = windowSize.w <= 768;

  // --- PIECE PROGRESS ---
  const fixedCount = pieces.filter(p => p.isFixed).length;
  const totalCount = pieces.length;
  const progressPercent = totalCount > 0 ? (fixedCount / totalCount) * 100 : 0;

  // Dismiss error and turn off holo mode
  const handleDismissError = useCallback(() => {
    setUseHoloMode(false);
  }, []);

  // Snapshot the time and turn off gestures when the user wins
  useEffect(() => {
    if (isWin) {
      setFinalTime(timeRef.current);
      if (useHoloMode) setUseHoloMode(false);
    }
  }, [isWin, useHoloMode]);

  // Show help modal when gesture control is turned on for the first time
  useEffect(() => {
    if (useHoloMode && !window.hasSeenGestureHelp) {
      setShowGestureHelp(true);
      window.hasSeenGestureHelp = true;
    }
  }, [useHoloMode]);

  useEffect(() => {
    const calculateLayout = () => {
      if (!image || !markedAreaRef.current) return;

      const isMob = window.innerWidth <= 768;
      const cw = window.innerWidth;
      const ch = window.innerHeight;

      // Calculate the visual safe-zone where the board used to be
      const boxW = isWin || isMob ? cw * 0.9 : cw * 0.7;
      const boxH = isMob ? ch * 0.65 : ch * 0.8;
      const boxLeft = isWin || isMob ? cw * 0.05 : cw * 0.02;
      const boxTop = ch * 0.1;

      const scale = Math.min((boxW - 40) / image.width, (boxH - 40) / image.height);
      const scaledW = image.width * scale;
      const scaledH = image.height * scale;

      setStageSize({ width: cw, height: ch });
      setWindowSize({ w: cw, h: ch });
      setBoardConfig({
        boardW: scaledW,
        boardH: scaledH,
        offsetX: boxLeft + (boxW - scaledW) / 2,
        offsetY: boxTop + (boxH - scaledH) / 2,
        scale
      });

      // Functional state update fixes the ESLint dependency warning
      setPieces(prev => {
        const layerOffsetX = boxLeft + (boxW - scaledW) / 2;
        const layerOffsetY = boxTop + (boxH - scaledH) / 2;

        if (prev.length > 0) {
          // DYNAMIC RESPONSIVE RESCALE!
          const pieceWidth = scaledW / gridSize;
          const pieceHeight = scaledH / gridSize;

          return prev.map((p, index) => {
            const row = parseInt(p.id.split('-')[1], 10);
            const col = parseInt(p.id.split('-')[2], 10);
            const newCorrectX = col * pieceWidth;
            const newCorrectY = row * pieceHeight;

            if (p.isFixed) {
              return { ...p, w: pieceWidth, h: pieceHeight, correctX: newCorrectX, correctY: newCorrectY, x: newCorrectX, y: newCorrectY };
            } else {
              let startX, startY;
              const stackOffsetX = index * -1.5;
              const stackOffsetY = index * -1.5;

              if (isMob) {
                const marginY = boxTop + boxH + 20;
                startX = cw / 2 - pieceWidth / 2 + stackOffsetX;
                startY = marginY + 20 + stackOffsetY;
              } else {
                const marginX = boxLeft + boxW + 20;
                const marginW = cw - marginX - 20;
                startX = marginX + (marginW - pieceWidth) / 2 + stackOffsetX;
                startY = ch / 2 - pieceHeight / 2 + stackOffsetY;
              }
              return { ...p, w: pieceWidth, h: pieceHeight, correctX: newCorrectX, correctY: newCorrectY, x: startX - layerOffsetX, y: startY - layerOffsetY };
            }
          });
        }

        const initialPieces = generatePieces(scaledW, scaledH, gridSize, gridSize);

        // Shuffle pieces so the deck is random
        const shuffled = [...initialPieces].sort(() => Math.random() - 0.5);

        return shuffled.map((p, index) => {
          if (p.isFixed) return p;

          let startX, startY;
          // Slight isometric offset to make it look like a physical 3D stack
          const stackOffsetX = index * -1.5;
          const stackOffsetY = index * -1.5;

          if (isMob) {
            const marginY = boxTop + boxH + 20;
            startX = cw / 2 - p.w / 2 + stackOffsetX;
            startY = marginY + 20 + stackOffsetY;
          } else {
            const marginX = boxLeft + boxW + 20;
            const marginW = cw - marginX - 20;
            startX = marginX + (marginW - p.w) / 2 + stackOffsetX;
            startY = ch / 2 - p.h / 2 + stackOffsetY;
          }

          return {
            ...p,
            status: 'board', // Spawn directly on the board
            x: startX - layerOffsetX,
            y: startY - layerOffsetY
          };
        });
      });
    };
    calculateLayout(); window.addEventListener('resize', calculateLayout); return () => window.removeEventListener('resize', calculateLayout);
  }, [image, gridSize, isWin]);

  // --- THE GESTURE PHYSICS ENGINE ---
  useEffect(() => {
    if (!useHoloMode || !isReady || isWin) return;

    const { x, y, isPinching } = gestureState;
    const rect = markedAreaRef.current?.getBoundingClientRect();
    if (!rect) return;

    // --- UI GESTURE CLICK DETECTION ---
    if (isPinching && !prevPinchRef.current) {
      const elements = document.elementsFromPoint(x, y);
      const button = elements?.find(el => el.tagName === 'BUTTON' || el.closest('button'));

      if (button) {
        const targetBtn = button.tagName === 'BUTTON' ? button : button.closest('button');
        if (!targetBtn.disabled) {
          targetBtn.click();
          showToast('Button Clicked!');
          isClickingUIRef.current = true;
        }
      }
    }
    prevPinchRef.current = isPinching;

    // If they are currently holding a pinch over a UI button, DO NOT interact with puzzle pieces!
    if (isClickingUIRef.current) {
      if (!isPinching) isClickingUIRef.current = false;
      return;
    }

    const canvasX = x - rect.left - boardConfig.offsetX;
    const canvasY = y - rect.top - boardConfig.offsetY;

    if (isPinching) {
      if (activePieceRef.current === null) {
        // 1. Try to grab the ONLY unlocked piece
        const unlocked = piecesRef.current.find(p => !p.isFixed);

        // Massive 50px magnetic forgiveness pad for high-density 10x10 grids
        const pad = 50;

        if (unlocked && unlocked.status === 'board' &&
          canvasX > unlocked.x - pad && canvasX < unlocked.x + unlocked.w + pad &&
          canvasY > unlocked.y - pad && canvasY < unlocked.y + unlocked.h + pad) {

          activePieceRef.current = unlocked.id;
          dragOffsetRef.current = { x: canvasX - unlocked.x, y: canvasY - unlocked.y };
          setActiveGesturePieceId(unlocked.id);
          showToast('Grabbed Piece!');

          // Bring to front visually
          const node = pieceNodesRef.current[unlocked.id];
          if (node) node.moveToTop();
        }
      } else {
        const id = activePieceRef.current;
        // PERFORMANCE FIX: Mutate Konva node directly to bypass React 60fps choking!
        const node = pieceNodesRef.current[id];
        if (node) {
          node.x(canvasX - dragOffsetRef.current.x);
          node.y(canvasY - dragOffsetRef.current.y);
          node.getLayer().batchDraw(); // Fast layer redraw
        }
      }
    } else {
      if (activePieceRef.current !== null) {
        const id = activePieceRef.current;

        // Sync final position from the native Konva node back to React state
        const node = pieceNodesRef.current[id];
        const piece = piecesRef.current.find(p => p.id === id);
        const finalX = node ? node.x() : (piece ? piece.x : 0);
        const finalY = node ? node.y() : (piece ? piece.y : 0);

        let snapped = false;
        const snapDistance = piece ? Math.max(60, Math.min(piece.w, piece.h) * 0.8) : 40;

        if (piece && calculateDistance(finalX, finalY, piece.correctX, piece.correctY) < snapDistance) {
          snapped = true;
        } else {
          setWrongMoves(m => m + 1);
        }

        setFeedbackStatus({ id, type: snapped ? 'success' : 'error' });
        setTimeout(() => setFeedbackStatus(null), 600);

        setPieces(prev => prev.map(p => {
          if (p.id === id) {
            if (snapped) return { ...p, x: p.correctX, y: p.correctY, isFixed: true };
            return { ...p, x: finalX, y: finalY };
          }
          return p;
        }));

        activePieceRef.current = null;
        setActiveGesturePieceId(null);
      }
    }
  }, [gestureState, useHoloMode, isReady, boardConfig, isWin, showToast]);

  const handleBack = () => { setIsExiting(true); setTimeout(() => onBack(), 1500); };

  const handleRestart = () => {
    // Setting pieces to empty automatically triggers the highly-optimized calculateLayout 
    // to dynamically generate and shuffle a brand new deck stack!
    setPieces([]);
    timeRef.current = 0;
    setFinalTime(0);
    setWrongMoves(0);
  };

  const handleDragStartKonva = (e) => {
    if (useHoloMode) return;
    e.currentTarget.moveToTop();
  };

  const handleDragEndKonva = (e, id) => {
    if (useHoloMode) return;

    const group = e.currentTarget;
    const finalX = group.x();
    const finalY = group.y();
    const piece = pieces.find(p => p.id === id);

    if (!piece) return;

    let snapped = false;
    const snapDistance = Math.max(60, Math.min(piece.w, piece.h) * 0.8);

    if (calculateDistance(finalX, finalY, piece.correctX, piece.correctY) < snapDistance) {
      snapped = true;
    } else {
      setWrongMoves(prev => prev + 1);
    }

    setFeedbackStatus({ id, type: snapped ? 'success' : 'error' });
    setTimeout(() => setFeedbackStatus(null), 600);

    setPieces(prev => prev.map(p => {
      if (p.id === id) {
        if (snapped) return { ...p, x: p.correctX, y: p.correctY, isFixed: true };
        return { ...p, x: finalX, y: finalY };
      }
      return p;
    }));
  };

  // Toggle gesture control
  const handleToggleGesture = () => {
    setUseHoloMode(prev => !prev);
  };

  // Button state label
  const getGestureButtonLabel = () => {
    if (!useHoloMode) return '✋ Hand Control: OFF';
    if (errorMessage) return '✋ Error';
    if (statusMessage) return '✋ Loading...';
    if (isReady) return '✋ Hand Control: ON';
    return '✋ Initializing...';
  };

  // Make the stage full screen. When using holomode, bring it to front so pieces float over the tray.
  const markedAreaStyle = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: useHoloMode ? 30 : 0, pointerEvents: useHoloMode ? 'none' : 'auto' };
  const boardPieces = pieces.filter(p => p.status === 'board');

  const getStarRating = () => {
    const total = pieces.length;
    if (total === 0) return 0;
    let score = 3;
    if (wrongMoves > total * 0.5) score -= 1;
    if (wrongMoves > total * 1.5) score -= 1;
    if (finalTime > total * 10) score -= 1;
    else if (finalTime > total * 20) score -= 2;
    return Math.max(1, score);
  };
  const stars = getStarRating();
  const starsDisplay = Array(3).fill(0).map((_, i) => i < stars ? '⭐' : '✩').join('');

  return (
    <div style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', overflow: 'hidden', backgroundColor: colors.bg }} className={`cinematic-enter ${isExiting ? 'page-exit' : ''} ${theme === 'dark' ? 'dark-theme' : ''}`}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(${colors.border} 1px, transparent 1px), linear-gradient(90deg, ${colors.border} 1px, transparent 1px)`, backgroundSize: '50px 50px', zIndex: -1, pointerEvents: 'none' }}></div>

      {/* 
        ALWAYS render the <video> element (hidden when not in holo mode).
        This ensures videoRef is available for the hook to attach the camera preview stream.
      */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'absolute', bottom: '20px', left: '20px',
          width: '160px', height: '120px', borderRadius: '12px',
          objectFit: 'cover', transform: 'scaleX(-1)', zIndex: 50,
          border: `2px solid ${colors.accent}`,
          boxShadow: `0 0 20px ${colors.accent}60`,
          // Hide when not active, but keep in DOM
          display: useHoloMode && isReady ? 'block' : 'none'
        }}
      />

      {/* Gesture cursor indicator */}
      {useHoloMode && isReady && !isWin && (
        <div style={{
          position: 'fixed', top: gestureState.y, left: gestureState.x, width: '24px', height: '24px',
          backgroundColor: gestureState.isPinching ? '#ff0055' : colors.accent, borderRadius: '50%',
          transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 9999,
          boxShadow: `0 0 ${gestureState.isPinching ? '40px' : '20px'} ${gestureState.isPinching ? '#ff0055' : colors.accent}`,
          transition: 'background-color 0.15s, box-shadow 0.15s, width 0.15s, height 0.15s',
          border: '2px solid white',
        }}>
          {/* Inner dot for precise targeting */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            width: '6px', height: '6px', borderRadius: '50%',
            backgroundColor: 'white', transform: 'translate(-50%, -50%)',
          }} />
        </div>
      )}

      {/* Gesture status/error overlay */}
      <GestureStatus
        statusMessage={useHoloMode ? statusMessage : ''}
        errorMessage={useHoloMode ? errorMessage : ''}
        colors={colors}
        onDismissError={handleDismissError}
      />

      {/* --- GESTURE TOAST PROMPT --- */}
      {gestureToast && (
        <div className="ios-glass gesture-toast" style={{
          position: 'fixed',
          top: '120px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          padding: '12px 24px',
          background: colors.panel,
          color: colors.accent,
          borderRadius: '24px',
          border: `1px solid ${colors.accent}`,
          boxShadow: `0 0 20px ${colors.shadow}`,
          fontSize: '1.2rem',
          fontWeight: 'bold',
          pointerEvents: 'none',
          animation: 'popInCard 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}>
          ✨ {gestureToast}
        </div>
      )}

      {/* --- FIRST-TIME TUTORIAL MODAL --- */}
      {showTutorial && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', pointerEvents: 'auto' }}>
          <div className="ios-glass" style={{ background: colors.panel, padding: '40px', borderRadius: '24px', maxWidth: '450px', width: '90%', textAlign: 'center', border: `1px solid ${colors.accent}`, boxShadow: `0 0 40px ${colors.shadow}` }}>
            <h1 className="rainbow-text" style={{ marginTop: 0, marginBottom: '20px', fontSize: '2.5rem' }}>Welcome!</h1>
            <ul style={{ textAlign: 'left', color: colors.textMain, fontSize: '1.1rem', lineHeight: 1.8, marginBottom: '30px', paddingLeft: '0', listStyle: 'none' }}>
              <li style={{ marginBottom: '15px' }}>🧩 <b>Gameplay:</b> Drag the single active piece from the deck on the right and snap it into the board.</li>
              <li style={{ marginBottom: '15px' }}>✋ <b>Holo Mode:</b> Turn on hand gestures to pinch and drag pieces through your webcam!</li>
              <li style={{ marginBottom: '15px' }}>💡 <b>Hints:</b> Stuck? Click Hint to highlight the correct position.</li>
              <li>⭐ <b>Stars:</b> Place pieces accurately without dropping them in the wrong spot to earn 3 stars!</li>
            </ul>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button className="ios-btn" onClick={handleDismissTutorial} style={{ background: colors.accent, color: colors.accentText, flex: 1, fontSize: '1.1rem', padding: '15px', fontWeight: 'bold' }}>Play Game</button>
              <button className="ios-btn" onClick={handleDismissTutorial} style={{ background: colors.bg, color: colors.textSub, border: `1px solid ${colors.border}`, padding: '15px 25px' }}>Skip</button>
            </div>
          </div>
        </div>
      )}

      {/* --- GESTURE HELP MODAL --- */}
      {showGestureHelp && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)' }}>
          <div className="ios-glass" style={{ background: colors.panel, padding: '40px', borderRadius: '24px', maxWidth: '400px', textAlign: 'center', border: `1px solid ${colors.accent}`, boxShadow: `0 0 40px ${colors.shadow}` }}>
            <div style={{ fontSize: '3rem', marginBottom: '10px' }}>✋</div>
            <h2 className="rainbow-text" style={{ marginTop: 0, marginBottom: '20px' }}>Holo Mode</h2>
            <ul style={{ textAlign: 'left', color: colors.textMain, fontSize: '1.05rem', lineHeight: 1.8, marginBottom: '30px', paddingLeft: '20px' }}>
              <li><b>1.</b> Position your hand in front of the camera.</li>
              <li><b>2.</b> <b>Pinch</b> your index finger and thumb to grab a piece.</li>
              <li><b>3.</b> <b>Move</b> your hand to drag the piece around.</li>
              <li><b>4.</b> <b>Release</b> the pinch to drop it into place.</li>
            </ul>
            <button className="ios-btn" onClick={() => setShowGestureHelp(false)} style={{ background: colors.accent, color: colors.accentText, width: '100%', fontSize: '1.1rem', padding: '12px', fontWeight: 'bold' }}>Got it!</button>
          </div>
        </div>
      )}

      <div ref={markedAreaRef} style={markedAreaStyle}>
        <div style={{ position: 'absolute', top: 'max(20px, env(safe-area-inset-top))', left: 'max(20px, env(safe-area-inset-left))', zIndex: 50, display: 'flex', gap: '10px', flexWrap: 'wrap', pointerEvents: 'auto', maxWidth: 'calc(100vw - 120px)' }}>
          <button className="ios-btn" onClick={handleBack} style={{ background: colors.panel, color: colors.accent, border: `1px solid ${colors.border}` }}>⬅ Home Page</button>

          {/* --- HINT BUTTON --- */}
          <button className="ios-btn" onClick={handleHintClick} disabled={showHint || !unlockedPiece} style={{ background: colors.panel, color: colors.accent, border: `1px solid ${colors.border}`, opacity: (showHint || !unlockedPiece) ? 0.5 : 1 }}>💡 Hint</button>

          {/* --- HAND GESTURE CONTROL TOGGLE --- */}
          <button
            className="ios-btn gesture-toggle-btn"
            onClick={handleToggleGesture}
            style={{
              background: useHoloMode ? (isReady ? colors.accent : colors.panel) : colors.panel,
              color: useHoloMode && isReady ? colors.accentText : colors.accent,
              border: `1px solid ${useHoloMode ? colors.accent : colors.border}`,
              boxShadow: useHoloMode && isReady ? `0 0 20px ${colors.accent}80` : 'none',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Animated loading bar inside button */}
            {useHoloMode && statusMessage && (
              <div style={{
                position: 'absolute', bottom: 0, left: 0, height: '3px',
                background: colors.accent,
                animation: 'gestureLoadBar 2s ease-in-out infinite',
                width: '100%',
              }} />
            )}
            {getGestureButtonLabel()}
          </button>
        </div>

        {/* --- PIECE PROGRESS INDICATOR --- */}
        {!isWin && totalCount > 0 && (
          <div className="ios-glass piece-progress" style={{ color: colors.accent }}>
            <span>🧩 {fixedCount}/{totalCount}</span>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${progressPercent}%`, backgroundColor: colors.accent }} />
            </div>
          </div>
        )}

        <GameTimer isWin={isWin} isPaused={showTutorial} colors={colors} timeRef={timeRef} />

        {isWin && (
          <>
            <Confetti colors={colors} />
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100, pointerEvents: 'auto' }}>
              <div className="ios-glass win-card-animate" style={{ background: colors.panel, padding: '50px 60px', borderRadius: '32px', textAlign: 'center', border: `1px solid ${colors.border}`, boxShadow: `0 30px 60px ${colors.shadow}` }}>
                <h1 className="rainbow-text" style={{ fontSize: '3.5rem', margin: '0 0 5px 0', fontWeight: 800, textShadow: `0 0 30px ${colors.accent}50` }}>Puzzle Solved</h1>
                <p style={{ color: colors.textSub, fontSize: '1.2rem', marginBottom: '25px', opacity: 0.8 }}>Yaah! You did it</p>

                <div style={{ fontSize: '4rem', marginBottom: '30px', letterSpacing: '10px', filter: 'drop-shadow(0 0 20px rgba(255, 215, 0, 0.6))' }}>{starsDisplay}</div>

                <div style={{ background: theme === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.4)', padding: '25px 50px', borderRadius: '24px', margin: '0 auto 40px auto', border: `1px solid ${colors.border}`, display: 'inline-flex', gap: '50px', justifyContent: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '0.9rem', margin: '0 0 8px 0', color: colors.textSub, textTransform: 'uppercase', letterSpacing: '3px', fontWeight: 600 }}>Time</p>
                    <p style={{ fontSize: '2.5rem', margin: 0, color: colors.accent, fontWeight: 'bold' }}>{formatTime(finalTime)}</p>
                  </div>
                  <div style={{ width: '1px', background: colors.border, opacity: 0.5 }}></div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '0.9rem', margin: '0 0 8px 0', color: colors.textSub, textTransform: 'uppercase', letterSpacing: '3px', fontWeight: 600 }}>Errors</p>
                    <p style={{ fontSize: '2.5rem', margin: 0, color: wrongMoves > 0 ? '#ff4d4d' : '#00ffcc', fontWeight: 'bold' }}>{wrongMoves}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                  <button className="ios-btn" onClick={handleRestart} style={{ fontSize: '1.2rem', padding: '16px 40px', background: colors.accent, color: colors.accentText, fontWeight: 'bold', boxShadow: `0 10px 25px -5px ${colors.accent}` }}>Play Again</button>
                  <button className="ios-btn" onClick={handleBack} style={{ fontSize: '1.2rem', padding: '16px 40px', background: 'transparent', color: colors.textMain, border: `2px solid ${colors.border}`, fontWeight: 600 }}>Main Menu</button>
                </div>
              </div>
            </div>
          </>
        )}

        <Stage width={stageSize.width} height={stageSize.height}>
          <Layer x={boardConfig.offsetX} y={boardConfig.offsetY}>
            {image && <KonvaImage image={image} width={boardConfig.boardW} height={boardConfig.boardH} opacity={0.15} listening={false} perfectDrawEnabled={false} />}
            <Rect width={boardConfig.boardW} height={boardConfig.boardH} stroke={colors.border} strokeWidth={2} dash={[5, 5]} />
            {boardPieces.filter(p => p.isFixed).map(p => {
              const isSuccess = feedbackStatus?.id === p.id && feedbackStatus?.type === 'success';
              return (
                <Shape
                  key={p.id}
                  x={p.x}
                  y={p.y}
                  width={p.w}
                  height={p.h}
                  draggable={false}
                  sceneFunc={(ctx, shape) => { drawPiecePath(ctx, p.w, p.h, p.tabs); ctx.fillStrokeShape(shape); }}
                  fillPatternImage={image}
                  fillPatternScale={{ x: boardConfig.scale, y: boardConfig.scale }}
                  fillPatternOffset={{ x: p.correctX / boardConfig.scale, y: p.correctY / boardConfig.scale }}
                  perfectDrawEnabled={false}
                  listening={false}
                  stroke={isSuccess ? '#00ff00' : colors.accent}
                  strokeWidth={isSuccess ? 4 : 2}
                  shadowBlur={isSuccess ? 20 : 0}
                  shadowColor={isSuccess ? '#00ff00' : 'transparent'}
                  shadowOpacity={isSuccess ? 1 : 0}
                />
              )
            })}
          </Layer>
          <Layer x={boardConfig.offsetX} y={boardConfig.offsetY}>
            {/* --- GLOWING HINT SHAPE --- */}
            {showHint && unlockedPiece && (
              <Shape
                x={unlockedPiece.correctX}
                y={unlockedPiece.correctY}
                width={unlockedPiece.w}
                height={unlockedPiece.h}
                sceneFunc={(ctx, shape) => { drawPiecePath(ctx, unlockedPiece.w, unlockedPiece.h, unlockedPiece.tabs); ctx.fillStrokeShape(shape); }}
                fill="transparent"
                stroke={colors.accent}
                strokeWidth={4}
                shadowBlur={20}
                shadowColor={colors.accent}
                shadowOpacity={1}
                listening={false}
              />
            )}

            {/* --- ACTIVE PUZZLE PIECE & NEXT LOCKED PIECE --- */}
            {/* We render the active unlocked piece and exactly ONE locked piece beneath it for visual depth! */}
            {boardPieces.filter(p => !p.isFixed).slice(0, 2).sort((a, b) => (a.id === unlockedPieceId ? 1 : b.id === unlockedPieceId ? -1 : 0)).map((p) => {
              const isUnlocked = p.id === unlockedPieceId;
              const isActiveGesture = p.id === activeGesturePieceId;
              const isError = feedbackStatus?.id === p.id && feedbackStatus?.type === 'error';

              // Shift the locked piece down and right so the active piece half-covers it
              const displayX = isUnlocked ? p.x : p.x + p.w * 0.35;
              const displayY = isUnlocked ? p.y : p.y + p.h * 0.35;

              let pieceStroke = isActiveGesture ? '#ff0055' : (isUnlocked ? colors.accent : (theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'));
              let pieceStrokeWidth = isActiveGesture ? 3 : (isUnlocked ? 2 : 1);
              let pieceShadow = isUnlocked ? 15 : 0;
              let shadowColor = colors.accent;

              if (isError) {
                pieceStroke = '#ff0000';
                pieceStrokeWidth = 4;
                pieceShadow = 25;
                shadowColor = '#ff0000';
              }

              return (
                <Group
                  key={p.id}
                  ref={node => { if (node) pieceNodesRef.current[p.id] = node; }}
                  x={displayX}
                  y={displayY}
                  draggable={!useHoloMode && isUnlocked} // ONLY drag the active piece
                  onDragStart={handleDragStartKonva}
                  onDragEnd={(e) => handleDragEndKonva(e, p.id)}
                >
                  <Shape
                    width={p.w}
                    height={p.h}
                    sceneFunc={(ctx, shape) => { drawPiecePath(ctx, p.w, p.h, p.tabs); ctx.fillStrokeShape(shape); }}
                    hitFunc={(ctx, shape) => { ctx.beginPath(); ctx.rect(0, 0, p.w, p.h); ctx.closePath(); ctx.fillStrokeShape(shape); }}
                    fillPatternImage={image}
                    fillPatternScale={{ x: boardConfig.scale, y: boardConfig.scale }}
                    fillPatternOffset={{ x: p.correctX / boardConfig.scale, y: p.correctY / boardConfig.scale }}
                    transformsEnabled="position"
                    perfectDrawEnabled={false}
                    stroke={pieceStroke}
                    strokeWidth={pieceStrokeWidth}
                    shadowBlur={pieceShadow}
                    shadowColor={shadowColor}
                    shadowOpacity={isUnlocked || isError ? 0.8 : 0}
                  />

                  {/* --- DARK OVERLAY & LOCK ICON FOR INACTIVE PIECE --- */}
                  {!isUnlocked && (
                    <>
                      <Shape
                        width={p.w}
                        height={p.h}
                        sceneFunc={(ctx, shape) => { drawPiecePath(ctx, p.w, p.h, p.tabs); ctx.fillStrokeShape(shape); }}
                        fill="rgba(0,0,0,0.7)"
                        listening={false}
                      />
                      <Text
                        text="🔒"
                        fontSize={Math.max(12, Math.min(p.w, p.h) * 0.4)}
                        x={p.w / 2 - Math.max(12, Math.min(p.w, p.h) * 0.4) / 2}
                        y={p.h / 2 - Math.max(12, Math.min(p.w, p.h) * 0.4) / 2}
                        listening={false}
                      />
                    </>
                  )}
                </Group>
              )
            })}
          </Layer>
        </Stage>
      </div>
      <div className="footer-copyright">
        &copy; 2026 Ankesh_kumar_singh. All rights reserved.
      </div>
    </div>
  );
}