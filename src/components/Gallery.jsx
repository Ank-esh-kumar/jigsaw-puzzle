import { useEffect, useMemo, useRef, useState } from 'react';
import './Gallery.css';
import img1 from '../assets/images/img1.jpg';
import img2 from '../assets/images/img2.jpg';
import img3 from '../assets/images/img3.jpg';
import img4 from '../assets/images/img4.jpg';
import img5 from '../assets/images/img5.jpg';
import img6 from '../assets/images/img6.jpg';
import img7 from '../assets/images/img7.jpg';
import img8 from '../assets/images/img8.jpg';
import img9 from '../assets/images/img9.jpg';

const getPlayerData = () => {
  try { return JSON.parse(localStorage.getItem('puzzlePlayerData') || '{}'); }
  catch { return {}; }
};

const renderStars = (count) => {
  return "★".repeat(count) + "☆".repeat(3 - count);
};

const StatsModal = ({ colors, onClose, theme }) => {
  const performance = JSON.parse(localStorage.getItem('mainGamePerformance') || '[]');
  const [graphLevel, setGraphLevel] = useState(3);

  const totalGames = performance.length;
  const bestTime = totalGames > 0 ? Math.min(...performance.map(p => p.time)).toFixed(2) : '--';
  const totalStars = performance.reduce((acc, curr) => acc + (curr.stars || 0), 0);
  const totalErrors = performance.reduce((acc, curr) => acc + (curr.errors || 0), 0);
  const totalHints = performance.reduce((acc, curr) => acc + (curr.hints || 0), 0);

  const rawLevelData = useMemo(() => {
    return performance
      .map((p, originalIdx) => ({ ...p, gameNum: originalIdx + 1 }))
      .filter(p => p.gridSize === graphLevel);
  }, [performance, graphLevel]);

  const sortedData = useMemo(() => {
    return [...rawLevelData].sort((a, b) => a.time - b.time);
  }, [rawLevelData]);

  const maxT = Math.max(...sortedData.map(l => l.time), 10);
  const maxE = Math.max(...sortedData.map(l => l.errors), 1);

  const wormPath = useMemo(() => {
    if (sortedData.length < 2) return '';
    return sortedData.map((d, i) => {
      const x = (d.time / maxT) * 100;
      const y = 100 - (d.errors / maxE) * 100;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }, [sortedData, maxT, maxE]);

  const graphLineColor = theme === 'dark' ? '#ffffff' : '#000000';

  return (
    <div className="stats-modal" onClick={onClose}>
      {/* Removed hardcoded max-width, letting CSS handle responsiveness */}
      <div className="stats-card ios-glass" onClick={e => e.stopPropagation()} style={{ background: colors.panel, borderColor: colors.accent }}>
        <div className="stats-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '10px' }}>
          <h2 className="rainbow-text" style={{ margin: 0, fontSize: '1.6rem', textAlign: 'left' }}>Advanced Statistics</h2>
          <button className="ios-btn" onClick={onClose} style={{ padding: '6px 12px', flexShrink: 0 }}>✕</button>
        </div>

        <div className="profile-stats responsive-stats-grid">
          <div className="stat-box"><span className="stat-value">{totalGames}</span><span className="stat-label">Games</span></div>
          <div className="stat-box"><span className="stat-value">{bestTime}{bestTime !== '--' ? 's' : ''}</span><span className="stat-label">Best Time</span></div>
          <div className="stat-box"><span className="stat-value text-gold">{totalStars}</span><span className="stat-label">Total ★</span></div>
          <div className="stat-box"><span className="stat-value text-danger">{totalErrors}</span><span className="stat-label">Errors</span></div>
          <div className="stat-box"><span className="stat-value">{totalHints}</span><span className="stat-label">Hints</span></div>
        </div>

        <div className="level-stats-container ios-glass-inset" style={{ margin: '25px 0', padding: '20px' }}>
          <div className="graph-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
            <h4 className="theme-text-main" style={{ margin: 0, fontSize: '1rem', textAlign: 'left' }}>Performance Graph</h4>
            <select
              value={graphLevel}
              onChange={(e) => setGraphLevel(Number(e.target.value))}
              className="form-input"
              style={{ padding: '8px 12px', fontSize: '0.85rem', width: '130px', margin: 0 }}
            >
              <option value="3">3x3 Level</option>
              <option value="5">5x5 Level</option>
              <option value="8">8x8 Level</option>
              <option value="10">10x10 Level</option>
            </select>
          </div>

          {sortedData.length === 0 ? (
            <p className="theme-text-sub" style={{ fontSize: '0.9rem', fontStyle: 'italic', padding: '20px 0' }}>Play this level to generate graph data!</p>
          ) : (
            <div className="worm-graph-wrapper" style={{ position: 'relative', height: '160px', width: '90%', maxWidth: '500px', margin: '0 auto 35px auto', borderLeft: `2px solid var(--text-sub)`, borderBottom: `2px solid var(--text-sub)`, boxSizing: 'border-box' }}>
              <span className="axis-label y-axis-label">Errors</span>
              <span className="axis-label x-axis-label">Time (s)</span>

              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
                <path
                  d={wormPath}
                  fill="none"
                  stroke={graphLineColor}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  style={{ filter: `drop-shadow(0px 0px 6px var(--glass-border))` }}
                />
              </svg>

              {sortedData.map((d, i) => {
                const posX = (d.time / maxT) * 100;
                const posY = (d.errors / maxE) * 100;
                return (
                  <div
                    key={i}
                    className="worm-point"
                    style={{ left: `${posX}%`, bottom: `${posY}%`, backgroundColor: graphLineColor }}
                    data-info={`Game #${d.gameNum} | ${d.time}s, ${d.errors} err`}
                  />
                );
              })}
            </div>
          )}
        </div>

        <div className="performance-history-container" style={{ textAlign: 'left' }}>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--text-main)', marginBottom: '15px' }}>Recent Match History</h2>
          {performance.length === 0 ? (
            <p style={{ color: 'var(--text-sub)' }}>No games played yet. Proceed to the main menu!</p>
          ) : (
            <div className="history-table-wrapper">
              <table className="elegant-table">
                <thead>
                  <tr>
                    <th>Lvl</th>
                    <th>Grid</th>
                    <th>Time</th>
                    <th>Errors</th>
                    <th>Hints</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.slice().reverse().map((record, index) => (
                    <tr key={index}>
                      <td>#{performance.length - index}</td>
                      <td><span className="badge">{record.gridSize}x{record.gridSize}</span></td>
                      <td><strong>{record.time}s</strong></td>
                      <td className={record.errors > 0 ? "text-danger" : "text-green"}>{record.errors || 0}</td>
                      <td className={record.hints > 0 ? "text-gold" : ""}>{record.hints || 0}</td>
                      <td className="star-rating">{renderStars(record.stars || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Gallery = ({ onSelect, setDiff, theme, colors, toggleTheme, setGestureEnabled, gestureEnabled, onHome }) => {
  const [isExiting, setIsExiting] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [localDiff, setLocalDiff] = useState(3);
  const [playerData] = useState(getPlayerData());

  const performance = useMemo(() => JSON.parse(localStorage.getItem('mainGamePerformance') || '[]'), []);
  const totalGames = performance.length;
  const totalStars = performance.reduce((acc, curr) => acc + (curr.stars || 0), 0);

  const presets = useMemo(() => [img1, img2, img3, img4, img5, img6, img7, img8, img9], []);

  useEffect(() => {
    const randomImg = presets[Math.floor(Math.random() * presets.length)];
    const wrapper = document.querySelector('.gallery-wrapper');

    if (wrapper) {
      wrapper.style.transition = 'background 1.5s ease-in-out';
      wrapper.style.backgroundImage = `
        linear-gradient(
          to bottom right, 
          ${theme === 'dark' ? 'rgba(5,5,5,0.85)' : 'rgba(255,255,255,0.85)'}, 
          ${theme === 'dark' ? 'rgba(20,20,30,0.6)' : 'rgba(240,240,240,0.7)'}
        ), 
        url(${randomImg})
      `;
      wrapper.style.backgroundSize = 'cover';
      wrapper.style.backgroundPosition = 'center';
      wrapper.style.backgroundAttachment = 'fixed';
      wrapper.style.backdropFilter = 'blur(40px) saturate(150%)';
      wrapper.style.webkitBackdropFilter = 'blur(40px) saturate(150%)';
    }
  }, [theme, presets]);

  const [activeIndex, setActiveIndex] = useState(0);
  const wheelTimeout = useRef(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const nextSlide = () => setActiveIndex((prev) => (prev + 1) % presets.length);
  const prevSlide = () => setActiveIndex((prev) => (prev === 0 ? presets.length - 1 : prev - 1));

  const handleScroll = (e) => {
    if (wheelTimeout.current) return;
    wheelTimeout.current = setTimeout(() => { wheelTimeout.current = null; }, 400);
    if (e.deltaY > 0 || e.deltaX > 0) nextSlide();
    else prevSlide();
  };

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; touchEndX.current = e.touches[0].clientX; };
  const handleTouchMove = (e) => { touchEndX.current = e.touches[0].clientX; };
  const handleTouchEnd = () => {
    const swipeDistance = touchStartX.current - touchEndX.current;
    if (swipeDistance > 50) nextSlide();
    if (swipeDistance < -50) prevSlide();
  };

  const handleSelection = (url) => { setIsExiting(true); setTimeout(() => onSelect(url), 1500); };
  const handleUpload = (e) => { const file = e.target.files[0]; if (file) handleSelection(URL.createObjectURL(file)); };

  const handleLevelChange = (e) => {
    const val = Number(e.target.value);
    setDiff(val);
    setLocalDiff(val);
  };

  const handleHomeClick = () => {
    setIsExiting(true);
    setTimeout(() => { if (onHome) onHome(); }, 1500);
  };

  const isAnyModalOpen = showProfileSettings || isHelpOpen;

  return (
    <div className={`gallery-wrapper cinematic-enter ${isExiting ? 'page-exit' : ''} ${theme === 'dark' ? 'dark-theme' : 'light-theme'}`}>

      {/* --- GLOBAL BLUR BACKDROP --- */}
      <div className={`global-backdrop ${isAnyModalOpen || showStats ? 'active' : ''}`} onClick={() => { setShowProfileSettings(false); setIsHelpOpen(false); setShowStats(false); }}></div>

      {/* --- STATS MODAL --- */}
      {showStats && <StatsModal colors={colors} onClose={() => setShowStats(false)} theme={theme} />}

      {/* --- HELP MODAL --- */}
      <div className={`overlay-panel modal-panel help-screen ios-glass ${isHelpOpen ? 'active' : ''}`}>
        <div className="icon-pulse mb-3" style={{ fontSize: '3.5rem' }}>📖</div>
        <h1 className="elegant-title">How to Play</h1>
        <div className="elegant-list" style={{ textAlign: 'left', lineHeight: '1.6', color: 'var(--text-sub)' }}>
          <p>Welcome to the next-generation 3D puzzle engine.</p>
          <ul style={{ paddingLeft: '20px' }}>
            <li style={{ marginBottom: '10px' }}><strong>Goal:</strong> Drag the floating puzzle piece from the deck into the empty structural slot.</li>
            <li style={{ marginBottom: '10px' }}><strong>Accuracy:</strong> Dropping pieces in the wrong slot increases your error count.</li>
            <li style={{ marginBottom: '10px' }}><strong>Speed:</strong> Complete puzzles faster to earn a 3-star rating.</li>
          </ul>
        </div>
        <button className="ios-btn highlight-btn" style={{ width: '100%', marginTop: '20px' }} onClick={() => setIsHelpOpen(false)}>Understood</button>
      </div>

      {/* --- PROFILE & SETTINGS CARD MODAL --- */}
      <div className={`overlay-panel modal-panel profile-settings-screen ios-glass ${showProfileSettings ? 'active' : ''}`}>

        <div className="profile-header ios-glass-inset">
          <div className="profile-avatar-large">
            {playerData.name ? playerData.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="profile-info-text">
            <h2 className="rainbow-text">{playerData.name || 'Guest Explorer'}</h2>
            <p>{playerData.email || 'Not registered'}</p>
          </div>
        </div>

        <div className="profile-stats-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '25px' }}>
          <div className="stat-card">
            <span className="stat-value">{totalGames}</span>
            <span className="stat-label">Total Matches</span>
          </div>
          <div className="stat-card">
            <span className="stat-value text-gold">{totalStars}</span>
            <span className="stat-label">Stars Collected</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ textAlign: 'left', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-sub)', margin: '10px 0 5px 0' }}>System Options</h3>

          <button className="ios-btn settings-row-btn" onClick={toggleTheme}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>🌗 Interface Theme</span>
            <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
          </button>

          <button className="ios-btn settings-row-btn" onClick={() => { setShowProfileSettings(false); setShowStats(true); }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-gold)' }}>📊 Game Statistics</span>
            <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>View Graphs</span>
          </button>

          <div className="ios-btn settings-row-btn" style={{ cursor: 'default' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>✋ Gesture Engine</span>
            <button
              className="ios-btn highlight-btn"
              onClick={(e) => { e.stopPropagation(); setGestureEnabled(!gestureEnabled); }}
              style={{
                padding: '4px 12px', fontSize: '0.75rem', margin: 0,
                background: gestureEnabled ? 'var(--accent-color)' : 'var(--btn-bg)',
                color: gestureEnabled ? 'var(--accent-text)' : 'var(--text-main)'
              }}
            >
              {gestureEnabled ? 'ACTIVE' : 'OFF'}
            </button>
          </div>

          <button className="ios-btn settings-row-btn" onClick={() => { setShowProfileSettings(false); setIsHelpOpen(true); }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>❓ Need Help?</span>
            <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>Documentation</span>
          </button>
        </div>

        <div className="modal-actions mt-4">
          <button className="ios-btn highlight-btn" style={{ width: '100%' }} onClick={() => setShowProfileSettings(false)}>Close Menu</button>
        </div>
      </div>

      {/* --- MAIN GALLERY PANEL --- */}
      <div className="ios-glass main-panel">

        {/* Top Action Bar (Home Button & Profile Trigger) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '15px' }}>
          <button className="ios-btn ghost-btn" onClick={handleHomeClick} style={{ padding: '6px 16px', borderRadius: '30px' }}>
            <span style={{ marginRight: '6px', fontSize: '1.1rem' }}>⬅</span> Home
          </button>

          <button className="ios-btn ghost-btn" onClick={() => setShowProfileSettings(true)} style={{ padding: '6px 16px', borderRadius: '30px' }}>
            <span className="mini-avatar">{playerData.name ? playerData.name.charAt(0).toUpperCase() : 'U'}</span>
            <span style={{ marginLeft: '8px' }}>{playerData.name || 'Settings'}</span>
          </button>
        </div>

        <h2 className="theme-text-main" style={{ fontSize: '2.2rem', marginBottom: '8px', margin: 0, letterSpacing: '1px' }}>Zigsaw Console</h2>
        <p className="theme-text-sub" style={{ marginBottom: '35px', fontSize: '0.95rem' }}>Configure your game and select a blueprint.</p>

        <div className="game-setup-card ios-glass" style={{ marginBottom: '35px', padding: '20px', borderRadius: '20px', background: 'var(--stat-card-bg)', border: `1px solid var(--glass-border)`, display: 'flex', flexDirection: 'column', gap: '15px' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div className="theme-text-main" style={{ fontSize: '1.1rem', fontWeight: 600 }}>Grid Complexity</div>
            <select onChange={handleLevelChange} className="form-input" value={localDiff} style={{ minWidth: '120px', fontWeight: 'bold', padding: '8px 12px', width: 'auto', margin: 0 }}>
              <option value="3">Sector 3x3</option>
              <option value="5">Sector 5x5</option>
              <option value="8">Sector 8x8</option>
              <option value="10">Sector 10x10</option>
            </select>
          </div>

          <div style={{ height: '1px', background: 'var(--glass-border)', width: '100%' }}></div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.4rem', opacity: gestureEnabled ? 1 : 0.5, transition: 'opacity 0.3s' }}>✋</span>
              <div className="theme-text-main" style={{ fontSize: '1.1rem', fontWeight: 600 }}>Holo Mode</div>
            </div>
            <button className="ios-btn highlight-btn" onClick={() => setGestureEnabled(!gestureEnabled)} style={{ padding: '8px 24px', fontSize: '0.9rem', fontWeight: 700, background: gestureEnabled ? 'var(--accent-color)' : 'var(--btn-bg)', color: gestureEnabled ? 'var(--accent-text)' : 'var(--text-main)', minWidth: '80px' }}>{gestureEnabled ? 'ON' : 'OFF'}</button>
          </div>
        </div>

        <h3 className="theme-text-main" style={{ fontWeight: 600, fontSize: '1.3rem', marginBottom: '5px' }}>Blueprint Gallery</h3>
        <p className="theme-text-sub" style={{ fontSize: '0.85rem', marginBottom: '15px' }}>Swipe or scroll to browse. Click to start.</p>

        <div className="carousel-wrapper" onWheel={handleScroll} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} style={{ margin: '20px 0', padding: '20px 0' }}>
          <button className="ios-btn carousel-btn left" onClick={prevSlide}>&#10094;</button>
          <div className="carousel-scene">
            {presets.map((url, index) => {
              const length = presets.length; let offset = index - activeIndex;
              if (offset > Math.floor(length / 2)) offset -= length; if (offset < -Math.floor(length / 2)) offset += length;
              const absOffset = Math.abs(offset); const isActive = offset === 0;

              return (
                <div key={index} className={`carousel-card ${isActive ? 'active' : ''}`} onClick={() => isActive ? handleSelection(url) : setActiveIndex(index)} style={{ transform: `translateX(${offset * 110}%) scale(${1 - absOffset * 0.15}) perspective(1000px) rotateY(${offset * -15}deg)`, zIndex: 10 - absOffset, opacity: absOffset > 2 ? 0 : 1 - (absOffset * 0.3), pointerEvents: absOffset > 2 ? 'none' : 'auto' }}>
                  <img src={url} alt={`Preset ${index + 1}`} />
                  <div className="card-reflection" style={{ backgroundImage: `url(${url})` }}></div>
                </div>
              );
            })}
          </div>
          <button className="ios-btn carousel-btn right" onClick={nextSlide}>&#10095;</button>
        </div>

        <div style={{ margin: '25px 0', opacity: 0.3, borderBottom: `1px solid var(--glass-border)` }}></div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <p className="theme-text-sub" style={{ fontSize: '0.85rem' }}>Want to play with your own picture?</p>
          <label htmlFor="custom-upload" className="ios-btn highlight-btn" style={{ display: 'inline-block', width: 'auto', padding: '12px 30px', fontWeight: 'bold' }}>Upload Custom Image</label>
          <input type="file" id="custom-upload" accept="image/*" onChange={handleUpload} className="hidden-input" />
        </div>
      </div>

      <div className="footer-copyright">&copy; {new Date().getFullYear()} Ankesh Kumar. Premium Edition.</div>
    </div>
  );
};

export default Gallery;