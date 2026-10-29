// Cầu nối tới worker nhận diện tay (public/mediapipe/hand-worker.js).
// Một worker dùng chung cho cả phiên: nạp sẵn từ trang đầu, giữ lại qua các ván để khỏi nạp mô hình lại.
import { LITE } from '../utils/device';

export interface NormPoint {
  x: number;
  y: number;
  z?: number;
}

type HandListener = (landmarks: NormPoint[] | null, ms: number) => void;

const base = (import.meta as any).env?.BASE_URL || '/';
const FRAME_WIDTH = LITE ? 256 : 320; // thu nhỏ khung hình trước khi gửi: đủ cho nhận diện tay, nhẹ hơn nhiều
const MIN_INTERVAL_MS = LITE ? 55 : 33; // trần tần số nhận diện: ~18 lần/giây (máy nhẹ) hoặc ~30 lần/giây

let worker: Worker | null = null;
let readyPromise: Promise<string> | null = null;
let listener: HandListener | null = null;
let busy = false;
let lastSent = 0;

export const handStats = { delegate: '', lastMs: 0, avgMs: 0, frames: 0 };

/** Tạo worker và nạp mô hình. Gọi sớm (trang đầu) để lúc vào chơi không phải chờ. */
export function preloadHandTracker(): Promise<string> {
  if (readyPromise) return readyPromise;
  readyPromise = new Promise((resolve, reject) => {
    try {
      worker = new Worker(`${base}mediapipe/hand-worker.js`);
    } catch (e) {
      reject(e);
      return;
    }
    worker.onmessage = (ev: MessageEvent) => {
      const m = ev.data;
      if (m.type === 'ready') {
        handStats.delegate = m.delegate;
        resolve(m.delegate);
      } else if (m.type === 'error') {
        reject(new Error(m.message));
      } else if (m.type === 'hand') {
        busy = false;
        if (m.landmarks === undefined) return; // worker bỏ qua khung này
        handStats.delegate = m.delegate;
        handStats.lastMs = m.ms;
        handStats.frames += 1;
        handStats.avgMs = handStats.avgMs ? handStats.avgMs * 0.9 + m.ms * 0.1 : m.ms;
        listener?.(m.landmarks, m.ms);
      }
    };
    worker.onerror = (e) => reject(new Error(e.message || 'Worker lỗi'));
    worker.postMessage({ type: 'init' });
  });
  // Lỗi nạp thì cho phép thử lại ở lần sau
  readyPromise.catch(() => {
    worker?.terminate();
    worker = null;
    readyPromise = null;
  });
  return readyPromise;
}

export function setHandListener(fn: HandListener | null) {
  listener = fn;
}

/**
 * Gửi một khung hình nếu worker đang rảnh và đã đủ khoảng cách thời gian.
 * Worker chưa trả lời thì bỏ qua khung này: nhận diện chậm chỉ làm thưa nhịp, không làm khựng giao diện.
 */
export function pushFrame(video: HTMLVideoElement) {
  if (!worker || busy || video.readyState < 2 || !video.videoWidth) return;
  const now = performance.now();
  if (now - lastSent < MIN_INTERVAL_MS) return;
  lastSent = now;
  busy = true;
  const w = FRAME_WIDTH;
  const h = Math.round((FRAME_WIDTH * video.videoHeight) / video.videoWidth);
  createImageBitmap(video, { resizeWidth: w, resizeHeight: h, resizeQuality: 'low' })
    .then((bitmap) => {
      if (!worker) {
        bitmap.close();
        busy = false;
        return;
      }
      worker.postMessage({ type: 'frame', bitmap }, [bitmap]);
    })
    .catch(() => {
      busy = false;
    });
}
