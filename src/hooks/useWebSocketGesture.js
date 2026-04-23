import { useState, useEffect, useRef } from 'react';

/**
 * useWebSocketGesture — React hook that connects to the Python gesture server
 * via WebSocket and provides gesture state. Falls back to the in-browser
 * MediaPipe approach if the server is unavailable.
 *
 * @param {boolean} isActive - Whether gesture tracking should be active
 * @param {string} wsUrl - WebSocket URL (default: ws://localhost:8765)
 * @returns {{ isReady, gestureState, videoRef, source }}
 */
export function useWebSocketGesture(isActive, wsUrl = 'ws://localhost:8765') {
  const [isReady, setIsReady] = useState(false);
  const [source, setSource] = useState('none'); // 'websocket' | 'browser' | 'none'
  const [gestureState, setGestureState] = useState({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    isPinching: false,
  });

  const videoRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    if (!isActive) {
      setIsReady(false);
      setSource('none');
      return;
    }

    let active = true;
    console.log('🤖 WebSocket Gesture: Attempting to connect to', wsUrl);

    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!active) return;
          console.log('🤖 WebSocket Gesture: Connected to Python server!');
          setIsReady(true);
          setSource('websocket');
        };

        ws.onmessage = (event) => {
          if (!active) return;
          try {
            const data = JSON.parse(event.data);
            // The Python server sends normalized 0-1 coordinates
            // Map to screen coordinates
            setGestureState({
              x: (1 - data.x) * window.innerWidth, // Mirror X
              y: data.y * window.innerHeight,
              isPinching: data.isPinching,
            });
          } catch (e) {
            console.error('🤖 WebSocket Gesture: Parse error', e);
          }
        };

        ws.onclose = () => {
          if (!active) return;
          console.log('🤖 WebSocket Gesture: Connection closed. Will retry in 3s...');
          setIsReady(false);
          setSource('none');
          reconnectTimeoutRef.current = setTimeout(() => {
            if (active) connectWebSocket();
          }, 3000);
        };

        ws.onerror = (err) => {
          console.warn('🤖 WebSocket Gesture: Connection failed.', err);
          ws.close();
        };
      } catch (e) {
        console.warn('🤖 WebSocket Gesture: Could not create WebSocket.', e);
      }
    };

    connectWebSocket();

    return () => {
      active = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      setIsReady(false);
      setSource('none');
    };
  }, [isActive, wsUrl]);

  return { isReady, gestureState, videoRef, source };
}
