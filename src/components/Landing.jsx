import { useState, useEffect, useRef } from 'react';
import './Landing.css';
import img1 from '../assets/images/img1.jpg';
import img2 from '../assets/images/img2.jpg';
import img3 from '../assets/images/img3.jpg';
import img4 from '../assets/images/img4.jpg';

// --- AESTHETIC IMAGE SET ---
const imageSet = [img1, img2, img3, img4];

// --- PLAYER STORAGE UTILS ---
const getPlayerData = () => {
  try { return JSON.parse(localStorage.getItem('puzzlePlayerData') || '{}'); }
  catch { return {}; }
};

const savePlayerData = (data) => {
  localStorage.setItem('puzzlePlayerData', JSON.stringify(data));
};

const getMainGamePerformance = () => {
  try { return JSON.parse(localStorage.getItem('mainGamePerformance') || '[]'); }
  catch { return []; }
};

const renderStars = (count) => {
  return "★".repeat(count) + "☆".repeat(3 - count);
};

export default function Landing({ onStart }) {
  // --- SESSION RETURN CHECK ---
  const [isReturning] = useState(() => sessionStorage.getItem('gateUnlocked') === 'true');

  // --- UI STATE ---
  const [theme] = useState(localStorage.getItem('puzzleTheme') || 'dark');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const isHelpOpenRef = useRef(false);

  // If returning, skip the welcome screen immediately
  const [welcomeOpacity, setWelcomeOpacity] = useState(isReturning ? 0 : 1);
  const [welcomeVisible, setWelcomeVisible] = useState(!isReturning);
  const [uiState, setUiState] = useState('hidden');
  const [zoomCanvas, setZoomCanvas] = useState(isReturning);
  const [successActive, setSuccessActive] = useState(isReturning);
  const [isExiting, setIsExiting] = useState(false);

  // --- PLAYER STATE ---
  const [playerData, setPlayerData] = useState(getPlayerData());
  const [showRegisterForm, setShowRegisterForm] = useState(!playerData.name);
  const [playerName, setPlayerName] = useState('');
  const [playerEmail, setPlayerEmail] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [performance, setPerformance] = useState(getMainGamePerformance());

  // --- PWA & TOOLTIP STATE ---
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS] = useState(() => {
    const ua = window.navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  });
  const [isStandalone] = useState(() => {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  });
  const [showDownloadTooltip, setShowDownloadTooltip] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const hasSeenTooltip = localStorage.getItem('hasSeenDownloadPrompt');
    if (!hasSeenTooltip && !isStandalone && !isReturning) {
      const tooltipTimer = setTimeout(() => {
        setShowDownloadTooltip(true);
        localStorage.setItem('hasSeenDownloadPrompt', 'true');
        setTimeout(() => setShowDownloadTooltip(false), 4000);
      }, 3500);
      return () => clearTimeout(tooltipTimer);
    }
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, [isStandalone, isReturning]);

  const handleDownload = async () => {
    setShowDownloadTooltip(false);
    if (isStandalone) return alert("Zigsaw Puzzle is already installed on your device!");
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } else if (isIOS) {
      alert("To install, tap the 'Share' icon in your browser menu and select 'Add to Home Screen'.");
    } else {
      alert("App installation is not supported in this browser, or it is already installed.");
    }
  };

  const handleRegister = (e) => {
    e.preventDefault();
    if (!playerName.trim() || !playerEmail.trim()) return;
    const newData = { name: playerName, email: playerEmail, registeredAt: new Date().toISOString() };
    savePlayerData(newData);
    setPlayerData(newData);
    setShowRegisterForm(false);
    setPlayerName('');
    setPlayerEmail('');
  };

  const handleClearProfile = () => {
    if (confirm('Are you sure you want to clear all player data and game statistics?')) {
      localStorage.removeItem('puzzlePlayerData');
      localStorage.removeItem('mainGamePerformance');
      sessionStorage.removeItem('gateUnlocked'); // Reset the gate session
      setPlayerData({});
      setPerformance([]);
      setShowProfile(false);
      setShowRegisterForm(true);
    }
  };

  const playerDataRef = useRef(playerData);
  useEffect(() => { playerDataRef.current = playerData; }, [playerData]);

  const canvasRef = useRef(null);
  const reqRef = useRef(null);
  const engineState = useRef({
    appState: isReturning ? 'success' : 'loading',
    isInitialLoad: !isReturning,
    time: 0, isDragging: false,
    dragOffsetX: 0, dragOffsetY: 0,
    isSnapped: isReturning,
    pieceX: 0, pieceY: 0,
    targetPieceX: 0, targetPieceY: 0, startX: 0, startY: 0, sizeW: 0, sizeH: 0,
    missingCol: 0, missingRow: 0, currentImgIndex: parseInt(localStorage.getItem('puzzleImgIndex') || '0'),
    img: new Image(), ripple: null, hasGeneratedMissingPiece: false
  });

  const handleHelpClick = () => {
    setShowProfile(false);
    setIsHelpOpen(true);
    isHelpOpenRef.current = true;
  };

  const handleUiClick = () => {
    if (uiState !== 'active') return;
    if (!playerData.name) return setShowRegisterForm(true);
    setUiState('vanish');
    setTimeout(() => {
      setUiState('hidden');
      engineState.current.appState = 'playing';
    }, 400);
  };

  const playAudio = (path, vol = 1.0) => {
    try { const audio = new Audio(path); audio.volume = vol; audio.play().catch(() => { }); }
    catch { /* Ignore */ }
  };

  const totalGames = performance.length;
  const bestTime = totalGames > 0 ? Math.min(...performance.map(p => p.time)).toFixed(2) : '--';
  const totalStars = performance.reduce((acc, p) => acc + (p.stars || 0), 0);
  const totalErrors = performance.reduce((acc, p) => acc + (p.errors || 0), 0);

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
      const size = Math.max(canvas.width / cols, canvas.height / rows);
      es.sizeW = size; es.sizeH = size;
      es.startX = (canvas.width - cols * size) / 2;
      es.startY = (canvas.height - rows * size) / 2;

      const minCol = Math.max(1, Math.ceil(-es.startX / size));
      const maxCol = Math.min(cols - 2, Math.floor((canvas.width - es.startX) / size) - 1);
      const minRow = Math.max(1, Math.ceil(-es.startY / size));
      const maxRow = Math.min(rows - 2, Math.floor((canvas.height - es.startY) / size) - 1);

      if (!es.hasGeneratedMissingPiece) {
        es.missingCol = maxCol >= minCol ? Math.floor(Math.random() * (maxCol - minCol + 1)) + minCol : Math.floor(cols / 2);
        es.missingRow = maxRow >= minRow ? Math.floor(Math.random() * (maxRow - minRow + 1)) + minRow : Math.floor(rows / 2);
        es.hasGeneratedMissingPiece = true;
      }

      es.targetPieceX = es.startX + (es.missingCol * es.sizeW) + (es.sizeW * 0.25);
      es.targetPieceY = es.startY + (es.missingRow * es.sizeH) + (es.sizeH * 0.25);

      // Instantly snap the piece into place if returning from Gallery
      if (isReturning) {
        es.pieceX = es.startX + es.missingCol * es.sizeW;
        es.pieceY = es.startY + es.missingRow * es.sizeH;
        es.isSnapped = true;
      } else if (!es.isSnapped && !es.isDragging) {
        es.pieceX = es.targetPieceX;
        es.pieceY = es.targetPieceY;
      }
    };

    const createPiecePath = (ctx, x, y, w, h, tabs) => {
      const knob = Math.min(w, h) * 0.22;
      ctx.beginPath(); ctx.moveTo(x, y);
      if (tabs.top) { ctx.lineTo(x + w / 2 - knob, y); ctx.arc(x + w / 2, y, knob, Math.PI, 0, tabs.top === -1); }
      ctx.lineTo(x + w, y);
      if (tabs.right) { ctx.lineTo(x + w, y + h / 2 - knob); ctx.arc(x + w, y + h / 2, knob, -Math.PI / 2, Math.PI / 2, tabs.right === -1); }
      ctx.lineTo(x + w, y + h);
      if (tabs.bottom) { ctx.lineTo(x + w / 2 + knob, y + h); ctx.arc(x + w / 2, y + h, knob, 0, Math.PI, tabs.bottom === -1); }
      ctx.lineTo(x, y + h);
      if (tabs.left) { ctx.lineTo(x, y + h / 2 + knob); ctx.arc(x, y + h / 2, knob, Math.PI / 2, -Math.PI / 2, tabs.left === -1); }
      ctx.lineTo(x, y); ctx.closePath();
    };

    const drawPiece3D = (ctx, drawX, drawY, c, r, isUplifted = false, isHole = false) => {
      const tabs = getTabs(c, r);
      const holeColor = theme === 'dark' ? 'rgba(5, 5, 5, 0.8)' : 'rgba(255, 255, 255, 0.8)';
      const depthColor = theme === 'dark' ? '#111111' : '#e0e0e0';
      const accentRGB = theme === 'dark' ? '255, 255, 255' : '0, 0, 0';

      if (isHole) {
        ctx.save(); createPiecePath(ctx, drawX, drawY, es.sizeW, es.sizeH, tabs);
        ctx.fillStyle = holeColor; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = `rgba(${accentRGB}, ${0.3 + Math.sin(es.time * 3) * 0.4})`; ctx.stroke();
        ctx.restore(); return;
      }

      const depth = isUplifted ? Math.min(es.sizeW, es.sizeH) * 0.15 : Math.min(es.sizeW, es.sizeH) * 0.05;
      ctx.save(); createPiecePath(ctx, drawX, drawY + depth, es.sizeW, es.sizeH, tabs);
      ctx.fillStyle = depthColor;
      if (isUplifted) { ctx.shadowColor = `rgba(0, 0, 0, 0.6)`; ctx.shadowBlur = 30; ctx.shadowOffsetX = 8; ctx.shadowOffsetY = 20; }
      else { ctx.shadowColor = `rgba(0, 0, 0, 0.2)`; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4; }
      ctx.fill(); ctx.restore();

      ctx.save(); createPiecePath(ctx, drawX, drawY, es.sizeW, es.sizeH, tabs); ctx.clip();
      ctx.drawImage(es.img, drawX - c * es.sizeW, drawY - r * es.sizeH, cols * es.sizeW, rows * es.sizeH);
      ctx.fillStyle = isUplifted ? (theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)') : (theme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)');
      ctx.fill(); ctx.restore();

      ctx.save(); createPiecePath(ctx, drawX, drawY, es.sizeW, es.sizeH, tabs);
      ctx.lineWidth = isUplifted ? 2 : 1; ctx.strokeStyle = isUplifted ? `rgba(${accentRGB}, 0.9)` : `rgba(${accentRGB}, 0.3)`;
      ctx.stroke(); ctx.restore();
    };

    const animate = () => {
      es.time += 0.05; ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (es.appState === 'loading') return reqRef.current = requestAnimationFrame(animate);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const drawX = es.startX + c * es.sizeW; const drawY = es.startY + r * es.sizeH;
          if (c === es.missingCol && r === es.missingRow && !es.isSnapped) drawPiece3D(ctx, drawX, drawY, c, r, false, true);
          else drawPiece3D(ctx, drawX, drawY, c, r, false, false);
        }
      }

      if (!es.isSnapped) drawPiece3D(ctx, es.pieceX, es.pieceY, es.missingCol, es.missingRow, true, false);

      if (es.ripple) {
        es.ripple.time += 1;
        const maxDispersion = Math.max(canvas.width, canvas.height) * 1.5;
        const phase = es.ripple.time; const radius = phase * 22;

        ctx.save(); ctx.beginPath(); ctx.arc(es.ripple.x, es.ripple.y, radius, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(es.img, es.startX, es.startY, cols * es.sizeW, rows * es.sizeH);
        ctx.lineWidth = 4; ctx.strokeStyle = `rgba(255, 255, 255, 0.1)`; ctx.strokeRect(es.startX, es.startY, cols * es.sizeW, rows * es.sizeH); ctx.restore();

        if (radius < maxDispersion) {
          const decay = Math.exp(-radius / (maxDispersion * 0.5));
          const thickness = 100 * decay;
          ctx.save(); ctx.beginPath(); ctx.arc(es.ripple.x, es.ripple.y, radius + thickness, 0, Math.PI * 2, false); ctx.arc(es.ripple.x, es.ripple.y, Math.max(0, radius), 0, Math.PI * 2, true); ctx.clip();
          const displacement = Math.sin(phase * 0.05) * 45 * decay; const scale = 1 + (0.03 * decay);
          ctx.translate(es.ripple.x, es.ripple.y); ctx.scale(scale, scale); ctx.translate(-es.ripple.x + displacement, -es.ripple.y + displacement);
          ctx.drawImage(es.img, es.startX, es.startY, cols * es.sizeW, rows * es.sizeH); ctx.restore();
          ctx.save(); ctx.beginPath(); ctx.arc(es.ripple.x, es.ripple.y, radius + (thickness / 2), 0, Math.PI * 2);
          ctx.lineWidth = thickness * 0.3; ctx.strokeStyle = `rgba(255, 255, 255, ${0.15 * decay})`; ctx.stroke(); ctx.restore();
        }
      }
      if (es.appState !== 'success') reqRef.current = requestAnimationFrame(animate);
    };

    es.img.crossOrigin = "Anonymous";
    es.img.onload = () => {
      generateTabs(); initGame();

      if (isReturning) {
        // Skip all initial animations if returning from gallery
        reqRef.current = requestAnimationFrame(animate);
      } else if (es.isInitialLoad) {
        playAudio('/car-rev.mp3', 0.5);
        reqRef.current = requestAnimationFrame(animate);
        setTimeout(() => {
          setWelcomeOpacity(0);
          setTimeout(() => {
            setWelcomeVisible(false); es.appState = 'waiting_for_click';
            setZoomCanvas(true); setUiState('active'); es.isInitialLoad = false;
          }, 800);
        }, 2700);
      } else {
        es.isSnapped = false; es.appState = 'playing';
      }
    };
    es.img.onerror = () => { es.img.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mO88ODhf8ZQAOAA/z/h0w8XAAAAAElFTkSuQmCC"; };
    es.img.src = imageSet[es.currentImgIndex];

    const getPointerPos = (e) => e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };

    const handleStart = (e) => {
      if (es.isSnapped || es.appState !== 'playing' || isHelpOpenRef.current || !playerDataRef.current?.name) return;
      const pos = getPointerPos(e); const paddingX = es.sizeW * 0.25; const paddingY = es.sizeH * 0.25;
      if (pos.x > es.pieceX - paddingX && pos.x < es.pieceX + es.sizeW + paddingX && pos.y > es.pieceY - paddingY && pos.y < es.pieceY + es.sizeH + paddingY) {
        es.isDragging = true; es.dragOffsetX = pos.x - es.pieceX; es.dragOffsetY = pos.y - es.pieceY;
        canvas.style.cursor = "grabbing"; if (e.cancelable) e.preventDefault();
      }
    };
    const handleMove = (e) => { if (es.isDragging) { const pos = getPointerPos(e); es.pieceX = pos.x - es.dragOffsetX; es.pieceY = pos.y - es.dragOffsetY; if (e.cancelable) e.preventDefault(); } };

    const handleEnd = () => {
      if (es.isDragging) {
        es.isDragging = false; canvas.style.cursor = "default";
        const distance = Math.hypot(es.pieceX - (es.startX + es.missingCol * es.sizeW), es.pieceY - (es.startY + es.missingRow * es.sizeH));
        if (distance < Math.min(es.sizeW, es.sizeH) * 0.4) {
          es.pieceX = es.startX + es.missingCol * es.sizeW; es.pieceY = es.startY + es.missingRow * es.sizeH;
          es.isSnapped = true; es.appState = 'success_delay';
          playAudio('/water-splash.mp3', 0.8);
          es.ripple = { x: es.startX + es.missingCol * es.sizeW + es.sizeW / 2, y: es.startY + es.missingRow * es.sizeH + es.sizeH / 2, time: 0 };
          setSuccessActive(true);
          localStorage.setItem('puzzleImgIndex', (es.currentImgIndex + 1) % imageSet.length);
          sessionStorage.setItem('gateUnlocked', 'true'); // Save Gate Unlock State

          setTimeout(() => { setIsExiting(true); if (onStart) onStart(); }, 1200);
        }
      }
    };

    canvas.addEventListener('mousedown', handleStart); canvas.addEventListener('mousemove', handleMove); window.addEventListener('mouseup', handleEnd);
    canvas.addEventListener('touchstart', handleStart, { passive: false }); canvas.addEventListener('touchmove', handleMove, { passive: false }); window.addEventListener('touchend', handleEnd);
    window.addEventListener('resize', initGame);

    return () => {
      cancelAnimationFrame(reqRef.current);
      canvas.removeEventListener('mousedown', handleStart); canvas.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleEnd);
      canvas.removeEventListener('touchstart', handleStart); canvas.removeEventListener('touchmove', handleMove); window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('resize', initGame);
    };
  }, [theme, onStart, playerDataRef, isReturning]);

  const isAnyModalOpen = showRegisterForm || showProfile || isHelpOpen;

  return (
    <div className={`sys-gate-wrapper ${theme === 'dark' ? 'dark-theme' : 'light-theme'} ${isExiting ? 'page-exit' : ''}`}>
      <div className="ambient-background"></div>

      {/* GLOBAL BACKDROP FOR MODALS */}
      <div className={`global-backdrop ${isAnyModalOpen ? 'active' : ''}`} onClick={() => { if (playerData.name) { setShowProfile(false); setIsHelpOpen(false); } }}></div>

      {/* HEADER */}
      <header className="sys-header ios-glass">
        <div className="logo">
          <span className="logo-icon">🧩</span> Zigsaw
        </div>
        <div className="header-buttons">
          {playerData.name ? (
            <button className="ios-btn profile-btn" onClick={() => setShowProfile(true)}>
              <span className="mini-avatar">{playerData.name.charAt(0).toUpperCase()}</span> Profile
            </button>
          ) : (
            <button className="ios-btn highlight-btn" onClick={() => setShowRegisterForm(true)}>Register</button>
          )}

          <div className="tooltip-container">
            <button className="ios-btn download-btn" onClick={handleDownload}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              Install App
            </button>
            {showDownloadTooltip && (
              <div className="download-tooltip fade-in-up">
                <strong>Install our App!</strong><br />Get the best full-screen puzzle experience.
                <button className="close-tooltip" onClick={(e) => { e.stopPropagation(); setShowDownloadTooltip(false); }}>✕</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* WELCOME LOADER */}
      {welcomeVisible && (
        <div className="overlay-panel welcome-screen ios-glass" style={{ opacity: welcomeOpacity }}>
          <h1 className="elegant-title">Initializing Game Engine</h1>
          <p className="elegant-subtitle">Loading assets and generating physics...</p>
          <div className="loader-container">
            <div className="loader-bar"><div className="loader-fill"></div></div>
            <div className="car-wrapper">
              <div className="smoke-particles">
                <div className="smoke smoke-1"></div><div className="smoke smoke-2"></div>
                <div className="smoke smoke-3"></div><div className="smoke smoke-4"></div>
              </div>
              <img src="/car.png" alt="Loading" className="loader-car-img" />
            </div>
          </div>
        </div>
      )}

      {/* START INSTRUCTION */}
      {uiState !== 'hidden' && (
        <div className={`overlay-panel ui-layer ios-glass ${uiState}`} onClick={handleUiClick}>
          <h1 className="elegant-title">solve Jigsaw</h1>
          <p className="elegant-subtitle">Click anywhere on this panel to dismiss, then complete the structural puzzle.</p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
            <button className="ios-btn highlight-btn">Understood</button>
          </div>
        </div>
      )}

      {/* REGISTRATION MODAL */}
      <div className={`overlay-panel modal-panel register-screen ios-glass ${showRegisterForm ? 'active' : ''}`}>
        <h1 className="elegant-title">Player Registration</h1>
        <p className="elegant-subtitle">Create your profile to save statistics and earn stars.</p>
        <form onSubmit={handleRegister} className="elegant-form">
          <div className="input-group">
            <label>Display Name</label>
            <input type="text" placeholder="Enter your name" value={playerName} onChange={(e) => setPlayerName(e.target.value)} required className="form-input" />
          </div>
          <div className="input-group">
            <label>Email Address</label>
            <input type="email" placeholder="Enter your email" value={playerEmail} onChange={(e) => setPlayerEmail(e.target.value)} required className="form-input" />
          </div>
          <div className="modal-actions">
            {playerData.name && <button type="button" className="ios-btn ghost-btn" onClick={() => setShowRegisterForm(false)}>Cancel</button>}
            <button type="submit" className="ios-btn highlight-btn">Create Profile</button>
          </div>
        </form>
      </div>

      {/* PROFILE & STATS MODAL */}
      <div className={`overlay-panel modal-panel profile-screen ios-glass ${showProfile ? 'active' : ''}`}>
        <div className="profile-header ios-glass-inset">
          <div className="profile-avatar-large">
            {playerData.name ? playerData.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="profile-info-text">
            <h2 className="rainbow-text">{playerData.name}</h2>
            <p>{playerData.email}</p>
          </div>
        </div>

        <div className="profile-stats-grid">
          <div className="stat-card">
            <span className="stat-value">{totalGames}</span>
            <span className="stat-label">Matches</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{bestTime}{bestTime !== '--' ? 's' : ''}</span>
            <span className="stat-label">Best Time</span>
          </div>
          <div className="stat-card">
            <span className="stat-value text-gold">{totalStars}</span>
            <span className="stat-label">Stars</span>
          </div>
          <div className="stat-card">
            <span className="stat-value text-red">{totalErrors}</span>
            <span className="stat-label">Errors</span>
          </div>
        </div>

        <div className="performance-history-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 className="elegant-title-small">Recent Operations</h3>
          </div>

          {performance.length === 0 ? (
            <div className="empty-state">
              <span>📭</span>
              <p>No puzzle operations recorded yet.</p>
            </div>
          ) : (
            <div className="history-table-wrapper">
              <table className="elegant-table">
                <thead>
                  <tr>
                    <th>Mission</th>
                    <th>Grid</th>
                    <th>Time</th>
                    <th>Errs</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.slice().reverse().map((record, index) => (
                    <tr key={index}>
                      <td>#{performance.length - index}</td>
                      <td><span className="badge">{record.gridSize}x{record.gridSize}</span></td>
                      <td><strong>{record.time}s</strong></td>
                      <td className={record.errors > 0 ? "text-red" : "text-green"}>{record.errors || 0}</td>
                      <td className="star-rating">{renderStars(record.stars || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-actions-grid mt-4">
          <button className="ios-btn outline-btn" onClick={handleHelpClick}>❓ How to Play</button>
          <button className="ios-btn outline-btn text-red" onClick={handleClearProfile}>Delete Data</button>
          <button className="ios-btn highlight-btn" onClick={() => setShowProfile(false)}>Close Menu</button>
        </div>
      </div>

      {/* HELP MODAL */}
      <div className={`overlay-panel modal-panel help-screen ios-glass ${isHelpOpen ? 'active' : ''}`}>
        <div className="icon-pulse mb-3">📖</div>
        <h1 className="elegant-title">How to Play</h1>
        <div className="help-content">
          <p>Welcome to the next-generation 3D puzzle engine.</p>
          <ul className="elegant-list">
            <li><strong>Goal:</strong> Drag the floating puzzle piece from the deck into the empty structural slot.</li>
            <li><strong>Accuracy:</strong> Dropping pieces in the wrong slot increases your error count.</li>
            <li><strong>Speed:</strong> Complete puzzles faster to earn a 3-star rating.</li>
          </ul>
        </div>
        <button className="ios-btn highlight-btn mt-4" style={{ width: '100%' }} onClick={() => { setIsHelpOpen(false); isHelpOpenRef.current = false; }}>Return</button>
      </div>

      {/* SUCCESS GATEKEEPER (Modified to handle returning session smoothly) */}
      <div
        className={`overlay-panel success-screen ios-glass ${successActive ? 'active' : ''}`}
        style={{ zIndex: isAnyModalOpen ? 1400 : 2500 }}
      >
        <div className="icon-pulse text-green mb-3">✔️</div>
        <h1 className="elegant-title rainbow-text">Gate Unlocked</h1>
        {isReturning ? (
          <>
            <p className="elegant-subtitle">Main console connection remains established.</p>
            <button className="ios-btn highlight-btn mt-4" style={{ width: '100%', maxWidth: '250px', margin: '0 auto' }} onClick={() => { setIsExiting(true); setTimeout(() => { if (onStart) onStart(); }, 1500); }}>Enter Console</button>
          </>
        ) : (
          <>
            <p className="elegant-subtitle">Establishing secure connection to the main console...</p>
            <div className="elegant-spinner mt-4"></div>
          </>
        )}
      </div>

      <canvas ref={canvasRef} className={`puzzle-canvas ${zoomCanvas ? 'zoom-active' : ''}`}></canvas>

      <div className="footer-copyright">
        &copy; {new Date().getFullYear()} Ankesh Kumar. Premium Edition.
      </div>
    </div>
  );
}