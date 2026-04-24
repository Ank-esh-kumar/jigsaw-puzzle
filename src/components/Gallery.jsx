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

const Gallery = ({ onSelect, setDiff, theme, colors, toggleTheme, setGestureEnabled, gestureEnabled }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // --- EXPANDED AESTHETIC IMAGE SET (9 total) ---
  const presets = useMemo(() => [
    img1, img2, img3, img4, img5, img6, img7, img8, img9
  ], []);

  // --- DYNAMIC BACKGROUND EFFECT ---
  useEffect(() => {
    const randomImg = presets[Math.floor(Math.random() * presets.length)];
    const wrapper = document.querySelector('.gallery-wrapper');

    if (wrapper) {
      wrapper.style.transition = 'background 1.5s ease-in-out';
      wrapper.style.backgroundImage = `
        linear-gradient(
          to bottom right, 
          ${theme === 'dark' ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.7)'}, 
          ${theme === 'dark' ? 'rgba(20,20,30,0.6)' : 'rgba(240,240,250,0.5)'}
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

  // --- CAROUSEL STATE & HANDLERS ---
  const [activeIndex, setActiveIndex] = useState(0);
  const wheelTimeout = useRef(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const nextSlide = () => setActiveIndex((prev) => (prev + 1) % presets.length);
  const prevSlide = () => setActiveIndex((prev) => (prev === 0 ? presets.length - 1 : prev - 1));

  // Desktop Scroll
  const handleScroll = (e) => {
    if (wheelTimeout.current) return;
    wheelTimeout.current = setTimeout(() => { wheelTimeout.current = null; }, 400);

    if (e.deltaY > 0 || e.deltaX > 0) nextSlide();
    else prevSlide();
  };

  // Mobile Swipe
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const swipeDistance = touchStartX.current - touchEndX.current;
    if (swipeDistance > 50) nextSlide();
    if (swipeDistance < -50) prevSlide();
  };

  // --- EXIT ANIMATION WRAPPER ---
  const handleSelection = (url) => {
    setIsExiting(true);
    setTimeout(() => {
      onSelect(url);
    }, 1500);
  };

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleSelection(URL.createObjectURL(file));
    }
  };

  return (
    <div className={`gallery-wrapper cinematic-enter ${isExiting ? 'page-exit' : ''} ${theme === 'dark' ? 'dark-theme' : ''}`}>

      <div className={`menu-overlay ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)}></div>

      {/* --- SIDE MENU --- */}
      <div className={`ios-glass side-menu ${menuOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <h2 className="theme-text-accent" style={{ margin: 0, fontSize: '1.5rem', letterSpacing: '2px' }}>SETTINGS</h2>
          <button className="ios-btn" onClick={() => setMenuOpen(false)} style={{ padding: '8px 16px' }}>X</button>
        </div>

        <button
          className="ios-btn"
          onClick={toggleTheme}
          style={{ width: '100%', marginBottom: '20px' }}
        >
          Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode
        </button>

        <button className="ios-btn" style={{ width: '100%', marginBottom: '20px', opacity: 0.7 }}>
          Preferences
        </button>

        <div style={{ width: '100%', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
          <span className="theme-text-sub" style={{ fontSize: '0.95rem' }}>✋ Hand Gesture</span>
          <button
            className="ios-btn"
            onClick={() => setGestureEnabled(!gestureEnabled)}
            style={{
              padding: '6px 16px',
              fontSize: '0.85rem',
              background: gestureEnabled ? colors.accent : 'rgba(255,255,255,0.1)',
              color: gestureEnabled ? colors.accentText : colors.accent,
              boxShadow: gestureEnabled ? '0 0 15px var(--shadow-glow)' : 'none',
              transition: 'all 0.3s ease',
            }}
          >
            {gestureEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        <button className="ios-btn" style={{ width: '100%', opacity: 0.7 }}>
          Help
        </button>
      </div>

      {/* --- MAIN PANEL --- */}
      <div className="ios-glass main-panel">
        <div style={{ position: 'absolute', top: '25px', right: '30px' }}>
          <button
            className="ios-btn"
            onClick={() => setMenuOpen(true)}
            style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${colors.border}`, color: colors.textSub }}
          >
            Options
          </button>
        </div>

        <h2 className="theme-text-main" style={{ fontSize: '2.5rem', marginBottom: '30px', margin: 0 }}>
          Menu
        </h2>

        <div style={{ marginBottom: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <label className="theme-text-sub" style={{ fontSize: '1.2rem', marginRight: '15px' }}>
            Level
          </label>
          <select
            onChange={(e) => setDiff(Number(e.target.value))}
            className="ios-select"
            defaultValue="3"
          >
            <option value="3">Sector 3x3</option>
            <option value="5">Sector 5x5</option>
            <option value="8">Sector 8x8</option>
            <option value="10">Sector 10x10</option>
          </select>
        </div>

        {/* --- HAND GESTURE CONTROL TOGGLE --- */}
        <div style={{
          marginBottom: '25px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px',
          padding: '14px 20px', borderRadius: '16px',
          background: gestureEnabled ? (theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)') : 'rgba(255,255,255,0.03)',
          border: `1px solid ${gestureEnabled ? 'var(--accent)' : 'transparent'}`,
          transition: 'all 0.3s ease',
        }}>
          <span style={{ fontSize: '1.5rem' }}>✋</span>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div className="theme-text-main" style={{ fontSize: '1rem', fontWeight: 600 }}>Hand Gesture Control</div>
            <div className="theme-text-sub" style={{ fontSize: '0.8rem', marginTop: '2px' }}>Use pinch gestures to move pieces</div>
          </div>
          <button
            className="ios-btn"
            onClick={() => setGestureEnabled(!gestureEnabled)}
            style={{
              padding: '8px 20px',
              fontSize: '0.9rem',
              fontWeight: 700,
              background: gestureEnabled ? colors.accent : 'rgba(255,255,255,0.1)',
              color: gestureEnabled ? colors.accentText : colors.accent,
              boxShadow: gestureEnabled ? '0 0 20px var(--shadow-glow)' : 'none',
              transition: 'all 0.3s ease',
              minWidth: '60px',
            }}
          >
            {gestureEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        <h3 className="theme-text-sub" style={{ fontWeight: 400, marginBottom: '15px' }}>
          Select Picture
        </h3>

        {/* --- 3D CAROUSEL SECTION --- */}
        <div
          className="carousel-wrapper"
          onWheel={handleScroll}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <button className="ios-btn carousel-btn left" onClick={prevSlide}>
            &#10094;
          </button>

          <div className="carousel-scene">
            {presets.map((url, index) => {
              // Continuous Circle Math
              const length = presets.length;
              let offset = index - activeIndex;

              if (offset > Math.floor(length / 2)) offset -= length;
              if (offset < -Math.floor(length / 2)) offset += length;

              const absOffset = Math.abs(offset);
              const isActive = offset === 0;

              return (
                <div
                  key={index}
                  className={`carousel-card ${isActive ? 'active' : ''}`}
                  onClick={() => isActive ? handleSelection(url) : setActiveIndex(index)}
                  style={{
                    transform: `
                      translateX(${offset * 110}%) 
                      scale(${1 - absOffset * 0.15}) 
                      perspective(1000px) 
                      rotateY(${offset * -15}deg)
                    `,
                    zIndex: 10 - absOffset,
                    opacity: absOffset > 2 ? 0 : 1 - (absOffset * 0.3),
                    pointerEvents: absOffset > 2 ? 'none' : 'auto'
                  }}
                >
                  <img src={url} alt={`Preset ${index + 1}`} />

                  {/* Subtle reflection effect for the 3D look */}
                  <div className="card-reflection" style={{ backgroundImage: `url(${url})` }}></div>
                </div>
              );
            })}
          </div>

          <button className="ios-btn carousel-btn right" onClick={nextSlide}>
            &#10095;
          </button>
        </div>

        <div style={{ margin: '30px 0', opacity: 0.3, borderBottom: `2px solid var(--text-muted)` }}></div>

        <label htmlFor="custom-upload" className="ios-btn" style={{ display: 'inline-block', width: 'auto' }}>
          Upload Your Image
        </label>
        <input
          type="file"
          id="custom-upload"
          accept="image/*"
          onChange={handleUpload}
          className="hidden-input"
        />
      </div>
      <div className="footer-copyright">
        &copy; 2026 Ankesh_kumar_singh. All rights reserved.
      </div>
    </div>
  );
};

export default Gallery;