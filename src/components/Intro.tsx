import { ReactNode } from 'react';
import { AIDifficulty } from '../ai';
import { MANABIE_MARK } from '../data/brand';
import { PlayerProfile } from '../data/characters';
import { BOT_IMAGES, RPSChoice, RPS_CHOICES } from '../data/rps';
import { CharacterAvatar, getCharacterById } from './PlayerSetupModal';

interface IntroProps {
  profile: PlayerProfile;
  difficulty: AIDifficulty;
  isFullscreen?: boolean;
  onSelectDifficulty: (d: AIDifficulty) => void;
  onOpenSetup: () => void;
  onToggleFullscreen?: () => void;
  onStart: () => void; // xem cách chơi
  onPlayNow: () => void; // vào chơi luôn
}

const LEVELS: Array<{ id: AIDifficulty; icon: string; label: string; desc: string; c: string; cs: string }> = [
  { id: 'easy', icon: '🐢', label: 'Dễ', desc: 'Máy chọn ngẫu nhiên', c: 'var(--win)', cs: 'var(--win-dark)' },
  { id: 'normal', icon: '🐰', label: 'Vừa', desc: 'Máy học thói quen', c: 'var(--sky)', cs: 'var(--sky-dark)' },
  { id: 'hard', icon: '🦊', label: 'Khó', desc: 'Máy học rất nhanh', c: 'var(--lose)', cs: 'var(--lose-dark)' },
];

const FLOW = [
  { icon: '✋', label: 'Ra tay', c: 'var(--sky)' },
  { icon: '🔒', label: 'Chốt', c: 'var(--ink)' },
  { icon: '👋', label: 'Lắc tay', c: 'var(--rock)' },
  { icon: '🃏', label: 'Mở thẻ', c: 'var(--grape)' },
];

export function TopBar({ title, isFullscreen, onToggleFullscreen, right }: {
  title: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  right?: ReactNode;
}) {
  return (
    <header className="shrink-0 flex items-center justify-between gap-2 px-3 sm:px-5 py-2 bg-white border-b-4 border-[var(--line)]">
      <div className="flex items-center gap-2">
        <img className="h-7 object-contain" src={MANABIE_MARK} alt="Manabie" />
        <span className="font-extrabold text-lg sm:text-xl">{title}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {onToggleFullscreen && (
          <button type="button" onClick={onToggleFullscreen} className="btn btn-white btn-sm" title="Toàn màn hình">
            {isFullscreen ? '🗗 Thu nhỏ' : '⛶ Toàn màn hình'}
          </button>
        )}
        {right}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Sơ đồ "Ai thắng ai?": ba bàn tay ở ba góc tam giác, mũi tên chỉ từ bên thắng sang bên thua
// ---------------------------------------------------------------------------
const CYCLE: Array<{ id: RPSChoice; x: number; y: number }> = [
  { id: 'rock', x: 50, y: 16 },
  { id: 'scissors', x: 82, y: 70 },
  { id: 'paper', x: 18, y: 70 },
];
const ARROWS: Array<{ from: RPSChoice; d: string; lx: number; ly: number }> = [
  { from: 'rock', d: 'M62 21 Q80 28 81 50', lx: 86, ly: 33 }, // Búa đập Kéo
  { from: 'scissors', d: 'M69 82 Q50 94 31 82', lx: 50, ly: 93 }, // Kéo cắt Bao
  { from: 'paper', d: 'M19 50 Q20 28 38 21', lx: 14, ly: 33 }, // Bao bọc Búa
];

function WhoBeatsWho() {
  return (
    <div className="relative w-full" style={{ aspectRatio: '1 / 1' }}>
      <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100">
        <defs>
          {ARROWS.map((a) => (
            <marker key={a.from} id={`mui-${a.from}`} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill={RPS_CHOICES[a.from].color} />
            </marker>
          ))}
        </defs>
        {ARROWS.map((a) => (
          <path
            key={a.from}
            d={a.d}
            fill="none"
            stroke={RPS_CHOICES[a.from].color}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeDasharray="1 4.2"
            markerEnd={`url(#mui-${a.from})`}
            className="anim-dash"
          />
        ))}
      </svg>

      {ARROWS.map((a) => {
        const w = RPS_CHOICES[a.from];
        return (
          <span
            key={a.from}
            className="absolute -translate-x-1/2 -translate-y-1/2 chip title whitespace-nowrap"
            style={{ left: `${a.lx}%`, top: `${a.ly}%`, ['--c' as string]: w.color, fontSize: 'min(3vh, 1.35rem)', boxShadow: '0 3px 0 rgba(0,0,0,.18)' }}
          >
            {w.verb}
          </span>
        );
      })}

      {CYCLE.map((p, i) => {
        const d = RPS_CHOICES[p.id];
        return (
          <div
            key={p.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 anim-bob"
            style={{ left: `${p.x}%`, top: `${p.y}%`, width: '25%', animationDelay: `${-i * 0.5}s` }}
          >
            <div
              className="relative w-full aspect-square rounded-full bg-white flex items-center justify-center"
              style={{ border: `6px solid ${d.color}`, boxShadow: `0 6px 0 ${d.color}` }}
            >
              <img src={d.image} alt={d.label} className="h-[70%] object-contain" />
              <span
                className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 z-10 chip title whitespace-nowrap"
                style={{ ['--c' as string]: d.color, fontSize: 'min(3vh, 1.4rem)', paddingTop: 0 }}
              >
                {d.vietnameseName}
              </span>
            </div>
          </div>
        );
      })}

      {/* Máy đứng giữa tam giác */}
      <img
        src={BOT_IMAGES.wait}
        alt="Máy"
        className="absolute left-1/2 top-[53%] -translate-x-1/2 -translate-y-1/2 h-[36%] object-contain anim-float"
      />
    </div>
  );
}

export function Intro({ profile, difficulty, isFullscreen, onSelectDifficulty, onOpenSetup, onToggleFullscreen, onStart, onPlayNow }: IntroProps) {
  const character = getCharacterById(profile.characterId);

  return (
    <div className="stage flex-1 flex flex-col h-full overflow-hidden">
      <div className="stage-deco" aria-hidden="true">
        <span /><span /><span /><span />
      </div>
      <TopBar title="Trò chơi AR" isFullscreen={isFullscreen} onToggleFullscreen={onToggleFullscreen} />

      <main className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center-safe fit-short px-4 sm:px-8 py-3">
        <div className="w-full max-w-[1400px] grid grid-cols-1 md:grid-cols-[1.05fr_1fr] gap-5 lg:gap-10 items-center">
          {/* Cột trái: tên trò chơi, các bước, đội, mức chơi, nút */}
          <div className="flex flex-col gap-3 sm:gap-4 anim-slide-up min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 sm:gap-3" aria-label="Oẳn tù xì">
              {[
                { w: 'OẲN', c: 'var(--rock)', cs: '#d96a00', r: -4 },
                { w: 'TÙ', c: 'var(--sky)', cs: 'var(--sky-dark)', r: 3 },
                { w: 'XÌ', c: 'var(--scissors)', cs: '#d6336c', r: -2 },
              ].map((t, i) => (
                <span
                  key={t.w}
                  className="title text-white rounded-3xl px-4 sm:px-5 anim-pop"
                  style={{
                    background: t.c,
                    boxShadow: `0 7px 0 ${t.cs}`,
                    rotate: `${t.r}deg`,
                    fontSize: 'clamp(2.6rem, min(6vw, 10.5vh), 5.4rem)',
                    animationDelay: `${i * 0.1}s`,
                  }}
                >
                  {t.w}
                </span>
              ))}
            </h1>
            <p className="font-extrabold leading-tight" style={{ fontSize: 'clamp(1.3rem, 3.6vh, 2rem)' }}>
              Đấu với <span className="text-[var(--grape)]">Máy</span> bằng bàn tay thật! ✋
            </p>

            {/* Bốn bước của một lượt */}
            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
              {FLOW.map((f, i) => (
                <div key={f.label} className="flex items-center gap-1.5 sm:gap-2">
                  <span
                    className="flex items-center gap-1.5 rounded-2xl text-white font-extrabold px-2.5 py-1 whitespace-nowrap"
                    style={{ background: f.c, boxShadow: '0 4px 0 rgba(0,0,0,.18)', fontSize: 'clamp(0.95rem, min(1.35vw, 2.6vh), 1.35rem)' }}
                  >
                    <span className="w-6 h-6 rounded-full bg-white/25 flex items-center justify-center text-sm">{i + 1}</span>
                    <span>{f.icon}</span>
                    <span>{f.label}</span>
                  </span>
                  {i < FLOW.length - 1 && <span className="title text-xl text-[var(--line)]">›</span>}
                </div>
              ))}
            </div>

            {/* Đội của em và mức chơi */}
            <div className="flex flex-col gap-3">
              <div className="card flex items-center gap-3 p-2.5" style={{ ['--c' as string]: 'var(--sky)', ['--cs' as string]: 'var(--sky-dark)' }}>
                <div className="w-14 h-14 rounded-2xl bg-[var(--sky-soft)] p-0.5 shrink-0">
                  <CharacterAvatar character={character} />
                </div>
                <div className="flex flex-col min-w-0 flex-1 leading-tight">
                  <span className="text-sm font-bold text-[var(--ink-soft)]">Đội của em</span>
                  <span className="font-extrabold text-xl truncate">{profile.groupName}</span>
                  {profile.className && <span className="text-base text-[var(--ink-soft)] truncate">{profile.className}</span>}
                </div>
                <button type="button" onClick={onOpenSetup} className="btn btn-white btn-sm">✏️ Đổi</button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {LEVELS.map((lv) => {
                  const on = difficulty === lv.id;
                  return (
                    <button
                      key={lv.id}
                      type="button"
                      onClick={() => onSelectDifficulty(lv.id)}
                      className={`rounded-2xl border-[3px] px-1 py-1.5 flex flex-col items-center justify-center leading-tight cursor-pointer transition-transform ${
                        on ? 'text-white scale-105' : 'bg-white text-[var(--ink)]'
                      }`}
                      style={{ borderColor: lv.c, background: on ? lv.c : undefined, boxShadow: `0 5px 0 ${on ? lv.cs : 'var(--line)'}` }}
                    >
                      <span className="text-3xl">{lv.icon}</span>
                      <span className="font-extrabold text-xl">{lv.label}</span>
                      <span className={`text-xs sm:text-sm font-bold ${on ? 'text-white/90' : 'text-[var(--ink-soft)]'}`}>{lv.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-[1.4fr_1fr] gap-3">
              <button type="button" onClick={onStart} className="btn btn-win min-h-[66px] text-2xl">
                📖 Xem cách chơi
              </button>
              <button type="button" onClick={onPlayNow} className="btn btn-sun min-h-[66px] text-2xl">
                ⚡ Chơi luôn
              </button>
            </div>
          </div>

          {/* Cột phải: sơ đồ Ai thắng ai */}
          <div className="hidden md:flex flex-col items-center anim-slide-up min-w-0">
            <div
              className="card relative w-full flex flex-col items-center px-4 pt-3 pb-4"
              style={{ ['--c' as string]: 'var(--grape)', ['--cs' as string]: 'var(--grape-dark)', maxWidth: 'min(100%, 70vh)' }}
            >
              <div className="flex items-center gap-2 self-stretch justify-between">
                <span className="chip title" style={{ ['--c' as string]: 'var(--grape)', fontSize: 'min(3.6vh, 1.7rem)' }}>Ai thắng ai?</span>
                <span className="font-bold text-[var(--ink-soft)] text-right leading-tight" style={{ fontSize: 'min(2.4vh, 1.05rem)' }}>
                  Mũi tên chỉ từ
                  <br />
                  bên thắng sang bên thua
                </span>
              </div>
              <div className="w-[88%] mt-1">
                <WhoBeatsWho />
              </div>
              <span className="font-extrabold text-center leading-snug" style={{ fontSize: 'min(2.8vh, 1.25rem)' }}>
                Chào các bạn! Mình là <span className="text-[var(--grape)]">Máy</span>, mình nhìn bàn tay qua camera.
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
