import { useState, useEffect, useMemo } from 'react';
import Landing from './components/Landing';
import Gallery from './components/Gallery';
import GameCanvas from './components/GameCanvas';

export default function App() {
  const [mountedScreens, setMountedScreens] = useState({
    landing: true, gallery: false, game: false
  });

  const [theme, setTheme] = useState(localStorage.getItem('puzzleTheme') || 'dark');
  const [gameConfig, setGameConfig] = useState({ imgUrl: null, gridSize: 3, gestureEnabled: false });

  const colors = useMemo(() => theme === 'dark' ? {
    bg: '#050505', panel: 'rgba(26, 26, 26, 0.75)', accent: '#ffffff', accentText: '#000000',
    textMain: '#ffffff', textSub: '#a0a0a0', border: 'rgba(255, 255, 255, 0.12)',
    shadow: 'rgba(0, 0, 0, 0.8)', overlay: 'rgba(0, 0, 0, 0.85)'
  } : {
    bg: '#ffffff', panel: 'rgba(255, 255, 255, 0.85)', accent: '#000000', accentText: '#ffffff',
    textMain: '#000000', textSub: '#555555', border: 'rgba(0, 0, 0, 0.2)',
    shadow: 'rgba(0, 0, 0, 0.15)', overlay: 'rgba(255, 255, 255, 0.7)'
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('puzzleTheme', newTheme);
  };

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--bg-color', colors.bg);
    root.style.setProperty('--panel-bg', colors.panel);
    root.style.setProperty('--accent-color', colors.accent);
    root.style.setProperty('--accent-text', colors.accentText);
    root.style.setProperty('--text-main', colors.textMain);
    root.style.setProperty('--text-sub', colors.textSub);
    root.style.setProperty('--glass-border', colors.border);
    root.style.setProperty('--glass-shadow', colors.shadow);
    root.style.setProperty('--modal-backdrop', colors.overlay);
  }, [colors]);

  const handleLandingComplete = () => {
    setMountedScreens(prev => ({ ...prev, gallery: true }));
    setTimeout(() => setMountedScreens(prev => ({ ...prev, landing: false })), 800);
  };

  const handleGallerySelect = (imgUrl) => {
    setGameConfig(prev => ({ ...prev, imgUrl }));
    setMountedScreens(prev => ({ ...prev, game: true }));
    setTimeout(() => setMountedScreens(prev => ({ ...prev, gallery: false })), 800);
  };

  const handleBackToMenu = () => {
    setMountedScreens(prev => ({ ...prev, gallery: true }));
    setTimeout(() => setMountedScreens(prev => ({ ...prev, game: false })), 800);
  };

  const handleHomeReturn = () => {
    setMountedScreens(prev => ({ ...prev, landing: true }));
    setTimeout(() => setMountedScreens(prev => ({ ...prev, gallery: false })), 800);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', overflow: 'hidden', backgroundColor: colors.bg }}>
      {mountedScreens.landing && (
        <Landing onStart={handleLandingComplete} theme={theme} colors={colors} />
      )}

      {mountedScreens.gallery && (
        <Gallery
          theme={theme} colors={colors} toggleTheme={toggleTheme}
          setDiff={(size) => setGameConfig(prev => ({ ...prev, gridSize: size }))}
          setGestureEnabled={(val) => setGameConfig(prev => ({ ...prev, gestureEnabled: val }))}
          gestureEnabled={gameConfig.gestureEnabled}
          onSelect={handleGallerySelect} onHome={handleHomeReturn}
        />
      )}

      {mountedScreens.game && (
        <GameCanvas
          imgUrl={gameConfig.imgUrl} gridSize={gameConfig.gridSize}
          gestureEnabled={gameConfig.gestureEnabled} onBack={handleBackToMenu}
          theme={theme} colors={colors}
        />
      )}
    </div>
  );
}