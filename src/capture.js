/** Map preview pixels, rejecting points outside the specific captured image. */
export function mapCapturePoint(shot, x, y) {
  if (!shot?.captureId || ![shot.left, shot.top, shot.width, shot.height, shot.previewWidth, shot.previewHeight].every(Number.isFinite) ||
      shot.width <= 0 || shot.height <= 0 || shot.previewWidth <= 0 || shot.previewHeight <= 0) {
    throw new Error('Unknown captureId or incomplete capture metadata. Take a screenshot first, or use screen coordinates.');
  }
  if (![x, y].every(Number.isFinite) || x < 0 || y < 0 || x >= shot.previewWidth || y >= shot.previewHeight) {
    throw new Error(`Point is outside capture ${shot.captureId} (${shot.previewWidth}x${shot.previewHeight}).`);
  }
  return {
    x: Math.min(shot.left + shot.width - 1, Math.round(shot.left + x * shot.width / shot.previewWidth)),
    y: Math.min(shot.top + shot.height - 1, Math.round(shot.top + y * shot.height / shot.previewHeight)),
  };
}
