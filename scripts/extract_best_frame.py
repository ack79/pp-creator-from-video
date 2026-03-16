#!/usr/bin/env python3
"""Extract the best face frame from a video using ffmpeg and OpenCV."""

import sys
import os
import subprocess
import tempfile
import shutil
import cv2
import numpy as np


def extract_frames(video_path, output_dir, frame_rate=2):
    """Extract frames from video at given FPS using ffmpeg."""
    pattern = os.path.join(output_dir, "frame_%05d.jpg")
    cmd = [
        "ffmpeg", "-i", video_path,
        "-vf", f"fps={frame_rate}",
        "-q:v", "2",
        pattern,
        "-hide_banner", "-loglevel", "error"
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"ffmpeg error: {result.stderr}", file=sys.stderr)
        return False
    return True


def detect_faces(image, cascade):
    """Detect faces in an image, return list of (x, y, w, h)."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    faces = cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(80, 80)
    )
    return faces


def sharpness_score(image, face_rect):
    """Calculate Laplacian variance sharpness on face region."""
    x, y, w, h = face_rect
    face_region = image[y:y+h, x:x+w]
    gray = cv2.cvtColor(face_region, cv2.COLOR_BGR2GRAY)
    return cv2.Laplacian(gray, cv2.CV_64F).var()


def main():
    if len(sys.argv) < 3:
        print("Usage: extract_best_frame.py <input_video> <output_dir> [frame_rate]", file=sys.stderr)
        sys.exit(1)

    video_path = sys.argv[1]
    output_dir = sys.argv[2]
    frame_rate = int(sys.argv[3]) if len(sys.argv) > 3 else 2

    if not os.path.isfile(video_path):
        print(f"Video file not found: {video_path}", file=sys.stderr)
        sys.exit(1)

    # Create temp dir for extracted frames
    frames_dir = tempfile.mkdtemp(prefix="frames_")

    try:
        # Step 1: Extract frames
        if not extract_frames(video_path, frames_dir, frame_rate):
            sys.exit(1)

        frame_files = sorted([
            os.path.join(frames_dir, f)
            for f in os.listdir(frames_dir)
            if f.endswith(".jpg")
        ])

        if not frame_files:
            print("No frames extracted from video", file=sys.stderr)
            sys.exit(1)

        # Step 2: Face detection + sharpness scoring
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        cascade = cv2.CascadeClassifier(cascade_path)

        best_score = -1
        best_frame_path = None

        for frame_path in frame_files:
            image = cv2.imread(frame_path)
            if image is None:
                continue

            faces = detect_faces(image, cascade)
            if len(faces) == 0:
                continue

            # Use the largest face
            largest_face = max(faces, key=lambda f: f[2] * f[3])
            score = sharpness_score(image, largest_face)

            if score > best_score:
                best_score = score
                best_frame_path = frame_path

        if best_frame_path is None:
            print("No face detected in any frame", file=sys.stderr)
            sys.exit(1)

        # Step 3: Save best frame (full frame, not cropped)
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, "best_frame.jpg")
        shutil.copy2(best_frame_path, output_path)

        print(output_path)

    finally:
        # Clean up temp frames
        shutil.rmtree(frames_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
