// Worker nhận diện bàn tay: chạy MediaPipe ngoài luồng giao diện để game không bị khựng.
// Worker cổ điển (không phải module) vì bộ nạp WASM của MediaPipe cần importScripts.
//
// Nhận:  { type: 'init' }                      nạp mô hình, chạy thử để chọn GPU hay CPU
//        { type: 'frame', bitmap }             một khung hình đã thu nhỏ (ImageBitmap, chuyển quyền sở hữu)
// Gửi:   { type: 'ready', delegate }
//        { type: 'hand', landmarks, ms, delegate }   landmarks: 21 điểm chuẩn hóa 0..1 hoặc null
//        { type: 'error', message }
/* eslint-disable no-restricted-globals */
var exports = {};
var module = { exports: exports };
importScripts('./vision_bundle.js');
var FilesetResolver = exports.FilesetResolver;
var HandLandmarker = exports.HandLandmarker;

var base = self.location.href.replace(/[^/]*$/, '');
var vision = null;
var landmarker = null;
var delegate = 'GPU';
var SLOW_GPU_MS = 30; // GPU chậm hơn mức này trên ảnh thử thì đo thêm CPU rồi chọn bên nhanh hơn

async function make(d) {
  if (!vision) vision = await FilesetResolver.forVisionTasks(base + 'wasm');
  var opts = {
    baseOptions: { modelAssetPath: base + 'hand_landmarker.task', delegate: d },
    runningMode: 'VIDEO',
    numHands: 1,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  };
  if (d === 'GPU') opts.canvas = new OffscreenCanvas(1, 1);
  var lm = await HandLandmarker.createFromOptions(vision, opts);
  return lm;
}

async function use(d) {
  var next = await make(d);
  if (landmarker) landmarker.close();
  landmarker = next;
  delegate = d;
}

// Chạy thử trên ảnh trống: một lần khởi động, rồi 2 lần lấy số nhỏ hơn (ms).
// Lần khởi động đã quá chậm thì trả luôn, khỏi tốn thời gian đo tiếp.
function bench(lm) {
  var c = new OffscreenCanvas(256, 192);
  var g = c.getContext('2d');
  var run = function (i) {
    g.fillStyle = '#888';
    g.fillRect(0, 0, 256, 192);
    var bmp = c.transferToImageBitmap();
    var t0 = performance.now();
    lm.detectForVideo(bmp, t0 + i);
    bmp.close();
    return performance.now() - t0;
  };
  var warm = run(0);
  if (warm > 250) return warm;
  return Math.min(run(1), run(2));
}

// Chọn GPU hay CPU ngay lúc nạp sẵn (trang đầu), để vào ván là nhận diện đều ngay.
// GPU yếu hoặc GPU giả lập bằng phần mềm có thể chậm gấp chục lần CPU.
async function init() {
  var gpuMs = Infinity;
  try {
    await use('GPU');
    gpuMs = bench(landmarker);
  } catch (e) {
    gpuMs = Infinity;
  }
  if (gpuMs > SLOW_GPU_MS) {
    var gpu = delegate === 'GPU' ? landmarker : null;
    var cpu = await make('CPU');
    var cpuMs = bench(cpu);
    if (cpuMs < gpuMs) {
      if (gpu) gpu.close();
      landmarker = cpu;
      delegate = 'CPU';
    } else {
      cpu.close();
    }
  }
  self.postMessage({ type: 'ready', delegate: delegate });
}

var busy = false;
self.onmessage = async function (ev) {
  var msg = ev.data;
  if (msg.type === 'init') {
    try {
      await init();
    } catch (e) {
      self.postMessage({ type: 'error', message: String(e && e.message ? e.message : e) });
    }
    return;
  }
  if (msg.type === 'frame') {
    var bmp = msg.bitmap;
    if (!landmarker || busy) {
      bmp.close();
      self.postMessage({ type: 'hand', landmarks: undefined, ms: 0, delegate: delegate });
      return;
    }
    busy = true;
    var t0 = performance.now();
    var lmk = null;
    try {
      var res = landmarker.detectForVideo(bmp, t0);
      var first = res && res.landmarks && res.landmarks[0];
      if (first) lmk = first.map(function (p) { return { x: p.x, y: p.y, z: p.z }; });
    } catch (e) {
      lmk = undefined;
    }
    bmp.close();
    var ms = performance.now() - t0;
    self.postMessage({ type: 'hand', landmarks: lmk, ms: ms, delegate: delegate });
    busy = false;
  }
};
