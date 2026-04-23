import { useState, useEffect, useRef } from 'react';
import './Landing.css';
import img1 from '../assets/images/img1.jpg';
import img2 from '../assets/images/img2.jpg';
import img3 from '../assets/images/img3.jpg';
import img4 from '../assets/images/img4.jpg';

// --- AESTHETIC IMAGE SET ---
const imageSet = [
  img1,
  img2,
  img3,
  img4
];

export default function Landing({ onStart }) {
  // --- UI STATE ---
  const [theme] = useState(localStorage.getItem('puzzleTheme') || 'dark');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const isHelpOpenRef = useRef(false);

  const [welcomeOpacity, setWelcomeOpacity] = useState(1);
  const [welcomeVisible, setWelcomeVisible] = useState(true);

  const [uiState, setUiState] = useState('hidden');
  const [zoomCanvas, setZoomCanvas] = useState(false);
  const [successActive, setSuccessActive] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // --- ENGINE REFS ---
  const canvasRef = useRef(null);
  const reqRef = useRef(null);
  const engineState = useRef({
    appState: 'loading',
    isInitialLoad: true,
    time: 0,
    isDragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    isSnapped: false,
    pieceX: 0, pieceY: 0, targetPieceX: 0, targetPieceY: 0,
    startX: 0, startY: 0, sizeW: 0, sizeH: 0,
    missingCol: 0, // NEW: Dynamically set
    missingRow: 0, // NEW: Dynamically set
    currentImgIndex: parseInt(localStorage.getItem('puzzleImgIndex') || '0'),
    img: new Image(),
    ripple: null,
    hasGeneratedMissingPiece: false
  });

  const handleHelpClick = () => { setIsHelpOpen(true); isHelpOpenRef.current = true; };

  const handleUiClick = () => {
    if (uiState !== 'active') return;
    setUiState('vanish');
    setTimeout(() => {
      setUiState('hidden');
      engineState.current.appState = 'playing';
    }, 400);
  };

  const playAudio = (path, vol = 1.0) => {
    try {
      const audio = new Audio(path);
      audio.volume = vol;
      audio.play().catch(err => console.log(`Audio autoplay blocked: ${path}`, err));
    } catch (e) {
      console.log("Audio playback failed");
    }
  };

  // --- CANVAS ENGINE ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const es = engineState.current;

    const cols = 12, rows = 8;
    let verticalTabs = [], horizontalTabs = [];

    const generateTabs = () => {
      for (let c = 0; c < cols; c++) {
        verticalTabs[c] = []; horizontalTabs[c] = [];
        for (let r = 0; r < rows; r++) {
          verticalTabs[c][r] = Math.random() > 0.5 ? 1 : -1;
          horizontalTabs[c][r] = Math.random() > 0.5 ? 1 : -1;
        }
      }
    };

    const getTabs = (c, r) => ({
      top: r === 0 ? 0 : horizontalTabs[c][r - 1] === 1 ? -1 : 1,
      right: c === cols - 1 ? 0 : verticalTabs[c][r],
      bottom: r === rows - 1 ? 0 : horizontalTabs[c][r],
      left: c === 0 ? 0 : verticalTabs[c - 1][r] === 1 ? -1 : 1
    });

    const initGame = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      // Make pieces perfectly square, large enough to cover the screen
      const size = Math.max(canvas.width / cols, canvas.height / rows);
      es.sizeW = size;
      es.sizeH = size;

      // Center the grid so it fills the screen symmetrically
      es.startX = (canvas.width - cols * size) / 2;
      es.startY = (canvas.height - rows * size) / 2;

      // Calculate explicitly visible columns and rows to ensure the missing piece is always on-screen
      const minCol = Math.max(1, Math.ceil(-es.startX / size));
      const maxCol = Math.min(cols - 2, Math.floor((canvas.width - es.startX) / size) - 1);

      const minRow = Math.max(1, Math.ceil(-es.startY / size));
      const maxRow = Math.min(rows - 2, Math.floor((canvas.height - es.startY) / size) - 1);

      if (!es.hasGeneratedMissingPiece) {
        // Fallback to center if the screen is too tiny
        es.missingCol = maxCol >= minCol ? Math.floor(Math.random() * (maxCol - minCol + 1)) + minCol : Math.floor(cols / 2);
        es.missingRow = maxRow >= minRow ? Math.floor(Math.random() * (maxRow - minRow + 1)) + minRow : Math.floor(rows / 2);
        es.hasGeneratedMissingPiece = true;
      }

      es.targetPieceX = es.startX + (es.missingCol * es.sizeW) + (es.sizeW * 0.25);
      es.targetPieceY = es.startY + (es.missingRow * es.sizeH) + (es.sizeH * 0.25);

      if (!es.isSnapped && !es.isDragging) {
        es.pieceX = es.targetPieceX;
        es.pieceY = es.targetPieceY;
      }
    };

    const createPiecePath = (ctx, x, y, w, h, tabs) => {
      const knob = Math.min(w, h) * 0.22;
      ctx.beginPath();
      ctx.moveTo(x, y);
      if (tabs.top) { ctx.lineTo(x + w / 2 - knob, y); ctx.arc(x + w / 2, y, knob, Math.PI, 0, tabs.top === -1); }
      ctx.lineTo(x + w, y);
      if (tabs.right) { ctx.lineTo(x + w, y + h / 2 - knob); ctx.arc(x + w, y + h / 2, knob, -Math.PI / 2, Math.PI / 2, tabs.right === -1); }
      ctx.lineTo(x + w, y + h);
      if (tabs.bottom) { ctx.lineTo(x + w / 2 + knob, y + h); ctx.arc(x + w / 2, y + h, knob, 0, Math.PI, tabs.bottom === -1); }
      ctx.lineTo(x, y + h);
      if (tabs.left) { ctx.lineTo(x, y + h / 2 + knob); ctx.arc(x, y + h / 2, knob, Math.PI / 2, -Math.PI / 2, tabs.left === -1); }
      ctx.lineTo(x, y);
      ctx.closePath();
    };

    const drawPiece3D = (ctx, drawX, drawY, c, r, isUplifted = false, isHole = false) => {
      const tabs = getTabs(c, r);
      const isDarkTheme = theme === 'dark';

      // Adapted 3D colors for the new premium themes
      const holeColor = isDarkTheme ? 'rgba(5, 6, 10, 0.8)' : 'rgba(200, 210, 220, 0.6)';
      const depthColor = isDarkTheme ? '#0b0d17' : '#d2dce6';
      const accentRGB = isDarkTheme ? '255, 255, 255' : '23, 23, 23';
      const shadowMult = isDarkTheme ? 1 : 0.5;

      if (isHole) {
        ctx.save();
        createPiecePath(ctx, drawX, drawY, es.sizeW, es.sizeH, tabs);
        ctx.fillStyle = holeColor; ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = `rgba(${accentRGB}, ${0.3 + Math.sin(es.time * 3) * 0.4})`;
        ctx.stroke();
        ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 10; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 4; ctx.stroke();
        ctx.restore(); return;
      }

      const depth = isUplifted ? Math.min(es.sizeW, es.sizeH) * 0.15 : Math.min(es.sizeW, es.sizeH) * 0.05;
      ctx.save();
      createPiecePath(ctx, drawX, drawY + depth, es.sizeW, es.sizeH, tabs);
      ctx.fillStyle = depthColor;

      if (isUplifted) {
        ctx.shadowColor = `rgba(0, 0, 0, ${0.5 * shadowMult})`;
        ctx.shadowBlur = 30; ctx.shadowOffsetX = 8; ctx.shadowOffsetY = 20;
      } else {
        ctx.shadowColor = `rgba(0, 0, 0, ${0.15 * shadowMult})`;
        ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
      }
      ctx.fill(); ctx.restore();

      ctx.save();
      createPiecePath(ctx, drawX, drawY, es.sizeW, es.sizeH, tabs);
      ctx.clip();
      ctx.drawImage(es.img, drawX - c * es.sizeW, drawY - r * es.sizeH, cols * es.sizeW, rows * es.sizeH);
      ctx.fillStyle = isUplifted ? (isDarkTheme ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.2)') : (isDarkTheme ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.05)');
      ctx.fill(); ctx.restore();

      ctx.save();
      createPiecePath(ctx, drawX, drawY, es.sizeW, es.sizeH, tabs);
      ctx.lineWidth = isUplifted ? 2 : 1;
      ctx.strokeStyle = isUplifted ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.3)";
      ctx.stroke(); ctx.restore();
    };

    const animate = () => {
      es.time += 0.05;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (es.appState === 'loading') {
        reqRef.current = requestAnimationFrame(animate);
        return;
      }

      // 1. DRAW BASE PUZZLE
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const drawX = es.startX + c * es.sizeW;
          const drawY = es.startY + r * es.sizeH;
          if (c === es.missingCol && r === es.missingRow && !es.isSnapped) {
            drawPiece3D(ctx, drawX, drawY, c, r, false, true);
          } else {
            drawPiece3D(ctx, drawX, drawY, c, r, false, false);
          }
        }
      }

      if (!es.isSnapped) {
        drawPiece3D(ctx, es.pieceX, es.pieceY, es.missingCol, es.missingRow, true, false);
      }

      // 2. DRAW THE WAVE & WIPE AWAY LINES
      if (es.ripple) {
        es.ripple.time += 1;
        const maxDispersion = Math.max(canvas.width, canvas.height) * 1.5;
        const phase = es.ripple.time;
        const radius = phase * 22;

        ctx.save();
        ctx.beginPath();
        ctx.arc(es.ripple.x, es.ripple.y, radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(es.img, es.startX, es.startY, cols * es.sizeW, rows * es.sizeH);

        ctx.lineWidth = 4;
        ctx.strokeStyle = `rgba(255, 255, 255, 0.1)`;
        ctx.strokeRect(es.startX, es.startY, cols * es.sizeW, rows * es.sizeH);
        ctx.restore();

        if (radius < maxDispersion) {
          const decay = Math.exp(-radius / (maxDispersion * 0.5));
          const thickness = 100 * decay;

          ctx.save();

          ctx.beginPath();
          ctx.arc(es.ripple.x, es.ripple.y, radius + thickness, 0, Math.PI * 2, false);
          ctx.arc(es.ripple.x, es.ripple.y, Math.max(0, radius), 0, Math.PI * 2, true);
          ctx.clip();

          const displacement = Math.sin(phase * 0.05) * 45 * decay;
          const scale = 1 + (0.03 * decay);

          ctx.translate(es.ripple.x, es.ripple.y);
          ctx.scale(scale, scale);
          ctx.translate(-es.ripple.x + displacement, -es.ripple.y + displacement);

          ctx.drawImage(es.img, es.startX, es.startY, cols * es.sizeW, rows * es.sizeH);
          ctx.restore();

          ctx.save();
          ctx.beginPath();
          ctx.arc(es.ripple.x, es.ripple.y, radius + (thickness / 2), 0, Math.PI * 2);
          ctx.lineWidth = thickness * 0.3;
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.15 * decay})`;
          ctx.stroke();
          ctx.restore();
        }
      }

      if (es.appState !== 'success') {
        reqRef.current = requestAnimationFrame(animate);
      }
    };

    // Initialize Image
    es.img.crossOrigin = "Anonymous";
    es.img.onload = () => {
      generateTabs();
      initGame();

      if (es.isInitialLoad) {
        playAudio('/car-rev.mp3', 0.5);

        reqRef.current = requestAnimationFrame(animate);
        setTimeout(() => {
          setWelcomeOpacity(0);
          setTimeout(() => {
            setWelcomeVisible(false);
            es.appState = 'waiting_for_click';
            setZoomCanvas(true);
            setUiState('active');
            es.isInitialLoad = false;
          }, 800);
        }, 2700);
      } else {
        es.isSnapped = false;
        es.appState = 'playing';
      }
    };

    es.img.onerror = () => {
      es.img.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mO88ODhf8ZQAOAA/z/h0w8XAAAAAElFTkSuQmCC";
    };

    es.img.src = imageSet[es.currentImgIndex];

    const getPointerPos = (e) => e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };

    const handleStart = (e) => {
      if (es.isSnapped || es.appState !== 'playing' || isHelpOpenRef.current) return;
      const pos = getPointerPos(e);
      const paddingX = es.sizeW * 0.25;
      const paddingY = es.sizeH * 0.25;

      if (pos.x > es.pieceX - paddingX && pos.x < es.pieceX + es.sizeW + paddingX &&
        pos.y > es.pieceY - paddingY && pos.y < es.pieceY + es.sizeH + paddingY) {
        es.isDragging = true; es.dragOffsetX = pos.x - es.pieceX; es.dragOffsetY = pos.y - es.pieceY;
        canvas.style.cursor = "grabbing"; if (e.cancelable) e.preventDefault();
      }
    };

    const handleMove = (e) => {
      if (es.isDragging) {
        const pos = getPointerPos(e);
        es.pieceX = pos.x - es.dragOffsetX; es.pieceY = pos.y - es.dragOffsetY;
        if (e.cancelable) e.preventDefault();
      }
    };

    const handleEnd = () => {
      if (es.isDragging) {
        es.isDragging = false; canvas.style.cursor = "default";

        // Dynamic distance check based on the new randomized targets
        const distance = Math.hypot(es.pieceX - (es.startX + es.missingCol * es.sizeW), es.pieceY - (es.startY + es.missingRow * es.sizeH));

        if (distance < Math.min(es.sizeW, es.sizeH) * 0.4) {
          es.pieceX = es.startX + es.missingCol * es.sizeW;
          es.pieceY = es.startY + es.missingRow * es.sizeH;
          es.isSnapped = true;
          es.appState = 'success_delay';

          // --- TRIGGER EXACT MOMENT IT SNAPS ---
          playAudio('/water-splash.mp3', 0.8);
          es.ripple = {
            x: es.startX + es.missingCol * es.sizeW + es.sizeW / 2,
            y: es.startY + es.missingRow * es.sizeH + es.sizeH / 2,
            time: 0
          };

          setSuccessActive(true);
          localStorage.setItem('puzzleImgIndex', (es.currentImgIndex + 1) % imageSet.length);

          setTimeout(() => {
            setIsExiting(true);
            if (onStart) onStart();
          }, 1200);
        }
      }
    };

    canvas.addEventListener('mousedown', handleStart);
    canvas.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    canvas.addEventListener('touchstart', handleStart, { passive: false });
    canvas.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('resize', initGame);

    return () => {
      cancelAnimationFrame(reqRef.current);
      canvas.removeEventListener('mousedown', handleStart);
      canvas.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      canvas.removeEventListener('touchstart', handleStart);
      canvas.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('resize', initGame);
    };
  }, [theme, onStart]);

  return (
    <div className={`sys-gate-wrapper ${theme === 'dark' ? 'dark-theme' : ''} ${isExiting ? 'page-exit' : ''}`}>
      <div className="grid-overlay"></div>

      <header className="sys-header ios-glass">
        <div className="logo">Zigsaw Puzzle</div>
        <div className="header-buttons">
          <button className="ios-btn" onClick={handleHelpClick}>Help</button>
        </div>
      </header>

      {welcomeVisible && (
        <div className="overlay-panel welcome-screen ios-glass" style={{ opacity: welcomeOpacity }}>
          <h1>Initializing</h1>
          <p>Loading the Game Assets...</p>
          <div className="loader-container">
            <div className="loader-bar"><div className="loader-fill"></div></div>
            <div className="car-wrapper">
              <div className="smoke-particles">
                <div className="smoke smoke-1"></div>
                <div className="smoke smoke-2"></div>
                <div className="smoke smoke-3"></div>
                <div className="smoke smoke-4"></div>
              </div>
              <img src="/car.png" alt="Sports Car" className="loader-car-img" />
            </div>
          </div>
        </div>
      )}

      {uiState !== 'hidden' && (
        <div className={`overlay-panel ui-layer ios-glass ${uiState}`} onClick={handleUiClick}>
          <h1>solve Jigsaw</h1>
          <p>Click anywhere on this panel to dismiss, then complete the structural puzzle.</p>
          <button className="ios-btn understood-btn">Understood</button>
        </div>
      )}

      <div className={`overlay-panel help-screen ios-glass ${isHelpOpen ? 'active' : ''}`}>
        <h1>About Zigsaw Puzzle</h1>
        <p style={{ textAlign: 'left' }}>
          Welcome to the next-generation 3D puzzle game. <br /><br />
          <b>Objective:</b> Drag the floating puzzle piece from its starting position into the empty structural slot to enter the world of Zigsaw Puzzle.
        </p>
        <button className="ios-btn" onClick={() => { setIsHelpOpen(false); isHelpOpenRef.current = false; }}>Close</button>
      </div>

      <div className={`overlay-panel success-screen ios-glass ${successActive ? 'active' : ''}`}>
        <h1 style={{ color: 'var(--accent)' }}>Done!</h1>
        <p>Picture Complete. Routing connection...</p>
        <div className="spinner"></div>
      </div>

      <canvas ref={canvasRef} className={`puzzle-canvas ${zoomCanvas ? 'zoom-active' : ''}`}></canvas>

      <div className="footer-copyright">
        &copy; 2026 Ankesh_kumar_singh. All rights reserved.
      </div>
    </div>
  );
}