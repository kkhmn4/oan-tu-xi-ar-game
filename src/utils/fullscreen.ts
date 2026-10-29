// Quản lý chế độ toàn màn hình (Fullscreen) tối ưu cho Tablet & Mobile trình duyệt
export function isFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  return !!(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement
  );
}

export async function toggleFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  try {
    if (!isFullscreen()) {
      const docEl = document.documentElement as any;
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      } else if (docEl.msRequestFullscreen) {
        await docEl.msRequestFullscreen();
      }
      // Máy tính bảng: khóa màn ngang khi vào toàn màn hình (trình duyệt không hỗ trợ thì bỏ qua)
      try {
        await (screen.orientation as any)?.lock?.('landscape');
      } catch {
        // bỏ qua
      }
      return true;
    } else {
      const doc = document as any;
      if (doc.exitFullscreen) {
        await doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      } else if (doc.msExitFullscreen) {
        await doc.msExitFullscreen();
      }
      return false;
    }
  } catch (err) {
    console.warn('Không thể chuyển đổi toàn màn hình:', err);
    return isFullscreen();
  }
}
