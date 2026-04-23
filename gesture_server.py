"""
Sys.Gate — Python Gesture Control Server
=========================================
A standalone Python WebSocket server that streams hand-tracking data
to the browser using OpenCV + MediaPipe Hands.

Usage:
    python gesture_server.py [--port 8765] [--camera 0] [--smoothing 0.3]

The server sends JSON frames over WebSocket:
    { "x": float, "y": float, "isPinching": bool }
"""

import argparse
import asyncio
import json
import math
import sys

try:
    import cv2
    import mediapipe as mp
    import websockets
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Install requirements: pip install -r requirements.txt")
    sys.exit(1)


class GestureTracker:
    """Tracks hand landmarks and detects pinch gestures."""

    def __init__(self, camera_index=0, smoothing=0.3):
        self.cap = cv2.VideoCapture(camera_index)
        if not self.cap.isOpened():
            raise RuntimeError(f"Cannot open camera {camera_index}")

        self.mp_hands = mp.solutions.hands
        self.mp_drawing = mp.solutions.drawing_utils
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

        self.smoothing = smoothing
        self.smoothed_x = 0.5
        self.smoothed_y = 0.5

        # Get camera resolution for coordinate mapping
        self.frame_w = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        self.frame_h = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    def process_frame(self):
        """Read a frame, detect hand, return gesture data and annotated frame."""
        success, frame = self.cap.read()
        if not success:
            return None, None

        # Flip horizontally for mirror effect
        frame = cv2.flip(frame, 1)
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.hands.process(rgb_frame)

        gesture_data = {"x": self.smoothed_x, "y": self.smoothed_y, "isPinching": False}

        if results.multi_hand_landmarks:
            hand_landmarks = results.multi_hand_landmarks[0]

            # Draw landmarks on the preview
            self.mp_drawing.draw_landmarks(
                frame, hand_landmarks, self.mp_hands.HAND_CONNECTIONS
            )

            # Index finger tip (landmark 8) and thumb tip (landmark 4)
            index_tip = hand_landmarks.landmark[8]
            thumb_tip = hand_landmarks.landmark[4]

            # Smooth the position
            target_x = index_tip.x
            target_y = index_tip.y
            self.smoothed_x += (target_x - self.smoothed_x) * self.smoothing
            self.smoothed_y += (target_y - self.smoothed_y) * self.smoothing

            # Calculate pinch distance (3D)
            dx = index_tip.x - thumb_tip.x
            dy = index_tip.y - thumb_tip.y
            dz = index_tip.z - thumb_tip.z
            distance = math.sqrt(dx * dx + dy * dy + dz * dz)

            is_pinching = distance < 0.04

            gesture_data = {
                "x": round(self.smoothed_x, 4),
                "y": round(self.smoothed_y, 4),
                "isPinching": is_pinching,
            }

            # Visual feedback for pinch
            color = (0, 0, 255) if is_pinching else (0, 255, 0)
            cx = int(self.smoothed_x * self.frame_w)
            cy = int(self.smoothed_y * self.frame_h)
            cv2.circle(frame, (cx, cy), 15, color, -1)
            cv2.putText(
                frame,
                "PINCH" if is_pinching else "OPEN",
                (cx + 20, cy),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                color,
                2,
            )

        return gesture_data, frame

    def release(self):
        """Release camera resources."""
        self.cap.release()
        self.hands.close()


async def gesture_server(websocket, tracker):
    """WebSocket handler — streams gesture data to connected clients."""
    print(f"🤖 Client connected: {websocket.remote_address}")
    try:
        while True:
            gesture_data, frame = tracker.process_frame()

            if gesture_data is None:
                await asyncio.sleep(0.01)
                continue

            await websocket.send(json.dumps(gesture_data))

            # Show local preview window
            if frame is not None:
                cv2.imshow("Sys.Gate Gesture Server", frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

            # ~30fps target
            await asyncio.sleep(0.033)

    except websockets.exceptions.ConnectionClosed:
        print(f"🤖 Client disconnected: {websocket.remote_address}")


async def main(port, camera_index, smoothing):
    """Start the WebSocket server."""
    tracker = GestureTracker(camera_index=camera_index, smoothing=smoothing)
    print(f"🤖 Gesture Server starting on ws://localhost:{port}")
    print(f"   Camera: {camera_index} | Smoothing: {smoothing}")
    print(f"   Press 'q' in the preview window to stop.\n")

    async with websockets.serve(
        lambda ws: gesture_server(ws, tracker), "localhost", port
    ):
        await asyncio.Future()  # Run forever

    tracker.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sys.Gate Gesture Control Server")
    parser.add_argument("--port", type=int, default=8765, help="WebSocket port (default: 8765)")
    parser.add_argument("--camera", type=int, default=0, help="Camera index (default: 0)")
    parser.add_argument("--smoothing", type=float, default=0.3, help="Smoothing factor 0-1 (default: 0.3)")
    args = parser.parse_args()

    try:
        asyncio.run(main(args.port, args.camera, args.smoothing))
    except KeyboardInterrupt:
        print("\n🤖 Gesture Server stopped.")
