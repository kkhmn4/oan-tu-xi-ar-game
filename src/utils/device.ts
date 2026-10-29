// Nhận biết máy yếu (máy tính bảng RAM 4 GB trở xuống, ít nhân CPU) để bật chế độ nhẹ:
// tắt hiệu ứng nền chạy liên tục, giảm pháo giấy, canvas độ phân giải 1x, nhận diện tay thưa hơn.
// Ép bật hoặc tắt bằng ?lite=1 hoặc ?lite=0 trên đường dẫn.
function detectLite(): boolean {
  if (typeof window === 'undefined') return false;
  const q = new URLSearchParams(window.location.search).get('lite');
  if (q === '1') return true;
  if (q === '0') return false;
  const mem = (navigator as any).deviceMemory as number | undefined;
  const cores = navigator.hardwareConcurrency || 8;
  return (mem !== undefined && mem <= 4) || cores <= 4;
}

export const LITE = detectLite();

if (typeof document !== 'undefined' && LITE) document.documentElement.classList.add('lite');
