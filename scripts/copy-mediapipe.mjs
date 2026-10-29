// Chép thư viện nhận diện tay (đúng phiên bản trong node_modules) vào public/mediapipe
// để trang tự phục vụ, không phụ thuộc CDN. Chạy tự động trước "npm run dev" và "npm run build".
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const src = 'node_modules/@mediapipe/tasks-vision';
const dst = 'public/mediapipe';
mkdirSync(join(dst, 'wasm'), { recursive: true });

// Bản CommonJS đổi đuôi .js để worker cổ điển nạp được bằng importScripts
copyFileSync(join(src, 'vision_bundle.cjs'), join(dst, 'vision_bundle.js'));
for (const f of readdirSync(join(src, 'wasm'))) {
  // Chỉ cần bản thường (SIMD) và bản không SIMD cho máy cũ
  if (/^vision_wasm_(nosimd_)?internal\.(js|wasm)$/.test(f)) copyFileSync(join(src, 'wasm', f), join(dst, 'wasm', f));
}
console.log('Đã chép MediaPipe vào', dst);
