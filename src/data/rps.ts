// Dữ liệu & Logic trò chơi Oẳn Tù Xì (Kéo - Búa - Bao)

export type RPSChoice = 'rock' | 'paper' | 'scissors';
export type RPSResult = 'win' | 'lose' | 'draw';

export interface RPSChoiceDef {
  id: RPSChoice;
  name: string;
  vietnameseName: string; // chữ hoa, dùng cho nhãn lớn
  label: string; // chữ thường, dùng trong câu
  emoji: string;
  color: string; // màu đặc của thế tay
  soft: string; // nền nhạt cùng tông
  beats: RPSChoice;
  beatenBy: RPSChoice;
  verb: string; // "đập", "bọc", "cắt"
  pose: string; // cách làm thế tay, một câu ngắn
  image: string; // bàn tay 3D tách nền
}

const base = (import.meta as any).env?.BASE_URL || '/';
const asset = (relPath: string) => `${base}${relPath.replace(/^\/+/, '')}`;

export const RPS_CHOICES: Record<RPSChoice, RPSChoiceDef> = {
  rock: {
    id: 'rock',
    name: 'Rock',
    vietnameseName: 'BÚA',
    label: 'Búa',
    emoji: '✊',
    color: '#FF8A1F',
    soft: '#FFF0DE',
    beats: 'scissors',
    beatenBy: 'paper',
    verb: 'đập',
    pose: 'Nắm chặt cả bàn tay',
    image: asset('assets/vui/tay_bua.webp'),
  },
  paper: {
    id: 'paper',
    name: 'Paper',
    vietnameseName: 'BAO',
    label: 'Bao',
    emoji: '✋',
    color: '#22B45A',
    soft: '#E3F8EA',
    beats: 'rock',
    beatenBy: 'scissors',
    verb: 'bọc',
    pose: 'Xòe thẳng 5 ngón tay',
    image: asset('assets/vui/tay_bao.webp'),
  },
  scissors: {
    id: 'scissors',
    name: 'Scissors',
    vietnameseName: 'KÉO',
    label: 'Kéo',
    emoji: '✌️',
    color: '#FF4F8B',
    soft: '#FFE6EF',
    beats: 'paper',
    beatenBy: 'rock',
    verb: 'cắt',
    pose: 'Giơ 2 ngón thành chữ V',
    image: asset('assets/vui/tay_keo.webp'),
  },
};

export const ALL_RPS_CHOICES: RPSChoice[] = ['rock', 'scissors', 'paper'];

export const HAND_WAITING_IMAGE = asset('assets/vui/tay_cho.webp');

export const BOT_IMAGES = {
  wait: asset('assets/vui/bot_cho.webp'),
  shuffle: asset('assets/vui/bot_xao.webp'),
  win: asset('assets/vui/bot_thang.webp'), // máy thắng
  lose: asset('assets/vui/bot_thua.webp'), // máy thua
  draw: asset('assets/vui/bot_hoa.webp'),
};

/**
 * Xác định kết quả giữa người chơi và máy
 */
export function evaluateRPS(player: RPSChoice, ai: RPSChoice): {
  result: RPSResult;
  message: string;
  detail: string;
} {
  const p = RPS_CHOICES[player];
  const a = RPS_CHOICES[ai];
  if (player === ai) {
    return { result: 'draw', message: 'HÒA!', detail: `Cả hai cùng ra ${p.label}` };
  }
  if (p.beats === ai) {
    return { result: 'win', message: 'BẠN THẮNG!', detail: `${p.label} ${p.verb} ${a.label}` };
  }
  return { result: 'lose', message: 'MÁY THẮNG!', detail: `${a.label} ${a.verb} ${p.label}` };
}

/**
 * Random ngẫu nhiên một lựa chọn cho AI
 */
export function getRandomAIChoice(): RPSChoice {
  return ALL_RPS_CHOICES[Math.floor(Math.random() * ALL_RPS_CHOICES.length)];
}
