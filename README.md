# Sys.Gate — 3D Jigsaw Puzzle Game

A premium, gesture-controlled jigsaw puzzle game built with React, Konva, and MediaPipe. Features cinematic page transitions, glassmorphic UI, dual theme support, and an optional Python-powered hand tracking server.

---

## ✨ Features

- **3D Landing Puzzle** — A canvas-rendered puzzle intro with realistic piece physics, 3D lighting, and a ripple-wave completion effect.
- **Konva Game Engine** — Drag-and-drop jigsaw gameplay with interlocking tab/slot piece shapes, snap-to-grid detection, and a tray system.
- **🤖 Holo Mode** — Control puzzle pieces with your hand using MediaPipe AI. Supports pinch-to-grab gesture.
- **Dual Theme** — Midnight Cyber (dark) and Ethereal Pearl (light) themes with full CSS variable system.
- **Cinematic Transitions** — 3D perspective page transitions between Landing → Gallery → Game screens.
- **Glassmorphic UI** — iOS-style frosted glass panels, buttons, and overlays.
- **Python Gesture Server** — Optional WebSocket-based hand tracking server for enhanced performance.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+ and npm
- (Optional) **Python** 3.9+ for gesture control server

### Install & Run

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Python Gesture Server (Optional)

For enhanced gesture control performance:

```bash
# Install Python dependencies
pip install -r requirements.txt

# Start the gesture server
python gesture_server.py --port 8765 --camera 0

# Options:
#   --port      WebSocket port (default: 8765)
#   --camera    Camera index (default: 0)
#   --smoothing Smoothing factor 0-1 (default: 0.3)
```

---

## 🎮 How to Play

1. **Landing Screen** — Complete the 3D puzzle verification by dragging the floating piece into its slot.
2. **Gallery Screen** — Choose a preset image or upload your own, and select grid complexity.
3. **Game Screen** — Drag pieces from the tray to the board. Snap them into their correct positions to win!

### Controls
- **Mouse/Touch** — Drag pieces from the tray onto the board.
- **🤖 Holo Mode** — Toggle in-game. Use pinch gesture to grab and move pieces.

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + Vite |
| Canvas Engine | Konva / react-konva |
| Gesture AI | MediaPipe Hands |
| Styling | CSS Variables + Glassmorphism |
| Python Server | OpenCV + MediaPipe + WebSockets |

---

## 📁 Project Structure

```
jigsaw-game/
├── public/              # Static assets (car.png, favicon, icons)
├── src/
│   ├── components/      # React components + their CSS
│   │   ├── Landing.*    # 3D puzzle intro screen
│   │   ├── Gallery.*    # Image selection + particle background
│   │   └── GameCanvas.* # Main jigsaw game engine
│   ├── hooks/
│   │   ├── useGestureControl.js     # In-browser MediaPipe hand tracking
│   │   └── useWebSocketGesture.js   # Python WebSocket gesture client
│   ├── utils/
│   │   └── puzzleLogic.js           # Piece generation, paths, distance
│   ├── index.css        # Global design system (themes, utilities)
│   ├── main.jsx         # React entry point
│   └── App.jsx          # Screen router + theme state
├── gesture_server.py    # Python gesture control server
├── requirements.txt     # Python dependencies
└── index.html           # HTML entry with CSP + SEO
```

---

## 📜 License

MIT
