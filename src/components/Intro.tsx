import { ReactNode } from 'react';
import { AIDifficulty } from '../ai';
import { MANABIE_MARK } from '../data/brand';
import { PlayerProfile } from '../data/characters';
import { ALL_RPS_CHOICES, BOT_IMAGES, RPS_CHOICES } from '../data/rps';
import { CharacterAvatar, getCharacterById } from './PlayerSetupModal';

interface IntroProps {
  profile: PlayerProfile;
  difficulty: AIDifficulty;
  isFullscreen?: boolean;
  onSelectDifficulty: (d: AIDifficulty) => void;
  onOpenSetup: () => void;
  onToggleFullscreen?: () => void;
  onStart: () => void;
}

const LEVELS: Array<{ id: AIDifficulty; icon: string; label: string; desc: string; c: string; cs: string }> = [
  { id: 'easy', icon: '🐢', label: 'Dễ', desc: 'Máy chọn gần như ngẫu nhiên', c: 'var(--win)', cs: 'var(--win-dark)' },
  { id: 'normal', icon: '🐰', label: 'Vừa', desc: 'Máy học thói quen của em', c: 'var(--sky)', cs: 'var(--sky-dark)' },
  { id: 'hard', icon: '🦊', label: 'Khó', desc: 'Máy học rất nhanh', c: 'var(--lose)', cs: 'var(--lose-dark)' },
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

export function RuleChips({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const img = size === 'lg' ? 'w-12 h-12 sm:w-14 sm:h-14' : 'w-9 h-9';
  const txt = size === 'lg' ? 'text-xl sm:text-2xl' : 'text-lg';
  return (
    <div className="flex flex-col gap-2">
      {ALL_RPS_CHOICES.map((c) => {
        const d = RPS_CHOICES[c];
        const l = RPS_CHOICES[d.beats];
        return (
          <div key={c} className="flex items-center gap-2 rounded-2xl bg-white border-[3px] px-2 py-1" style={{ borderColor: d.color }}>
            <img src={d.image} alt="" className={`${img} object-contain`} />
            <span className={`font-extrabold ${txt}`} style={{ color: d.color }}>{d.label}</span>
            <span className={`font-bold ${txt} text-[var(--ink-soft)]`}>{d.verb}</span>
            <img src={l.image} alt="" className={`${img} object-contain`} />
            <span className={`font-extrabold ${txt}`} style={{ color: l.color }}>{l.label}</span>
            <span className="ml-auto chip text-sm" style={{ ['--c' as string]: d.color }}>{d.label} thắng</span>
          </div>
        );
      })}
    </div>
  );
}

export function Intro({ profile, difficulty, isFullscreen, onSelectDifficulty, onOpenSetup, onToggleFullscreen, onStart }: IntroProps) {
  const character = getCharacterById(profile.characterId);

  return (
    <div className="stage flex-1 flex flex-col h-full overflow-hidden">
      <div className="stage-deco" aria-hidden="true">
        <span /><span /><span /><span />
      </div>
      <TopBar title="Trò chơi AR" isFullscreen={isFullscreen} onToggleFullscreen={onToggleFullscreen} />

      <main className="flex-1 min-h-0 overflow-y-auto flex flex-col md:flex-row items-center justify-center gap-4 lg:gap-10 px-4 py-3 max-w-6xl mx-auto w-full">
        <div className="flex flex-col gap-3 max-w-lg w-full anim-slide-up">
          <div>
            <h1 className="title outline-text text-[clamp(3.2rem,8vw,6.5rem)] flex flex-wrap gap-x-4">
              <span style={{ color: 'var(--rock)' }}>OẲN</span>
              <span style={{ color: 'var(--sky)' }}>TÙ</span>
              <span style={{ color: 'var(--scissors)' }}>XÌ</span>
            </h1>
            <p className="text-xl sm:text-2xl font-extrabold mt-1">Đấu với Máy bằng bàn tay thật! ✋</p>
          </div>

          <RuleChips />

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

          <div className="flex flex-col gap-1.5">
            <span className="font-extrabold text-lg">Chọn mức chơi</span>
            <div className="grid grid-cols-3 gap-2">
              {LEVELS.map((lv) => {
                const on = difficulty === lv.id;
                return (
                  <button
                    key={lv.id}
                    type="button"
                    onClick={() => onSelectDifficulty(lv.id)}
                    className={`rounded-2xl border-[3px] px-1 py-1.5 flex flex-col items-center leading-tight cursor-pointer transition-transform ${
                      on ? 'text-white scale-105' : 'bg-white text-[var(--ink)]'
                    }`}
                    style={{
                      borderColor: lv.c,
                      background: on ? lv.c : undefined,
                      boxShadow: `0 5px 0 ${on ? lv.cs : 'var(--line)'}`,
                    }}
                  >
                    <span className="text-2xl">{lv.icon}</span>
                    <span className="font-extrabold text-xl">{lv.label}</span>
                    <span className={`text-xs sm:text-sm font-bold ${on ? 'text-white/90' : 'text-[var(--ink-soft)]'}`}>{lv.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button type="button" onClick={onStart} className="btn btn-win w-full min-h-[64px] text-2xl">
            Xem cách chơi ▶
          </button>
        </div>

        <div className="hidden md:flex relative flex-col items-center justify-center w-full max-w-sm anim-slide-up">
          <div className="card relative px-5 py-3 mb-2 text-center" style={{ ['--c' as string]: 'var(--grape)', ['--cs' as string]: 'var(--grape-dark)' }}>
            <p className="font-extrabold text-xl leading-snug">
              Chào các bạn! Mình là <span className="text-[var(--grape)]">Máy</span>.
              <br />
              Mình nhìn bàn tay qua camera. Đấu với mình nhé!
            </p>
            <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-6 h-6 rotate-45 bg-white border-r-4 border-b-4 border-[var(--grape)]" />
          </div>
          <div className="relative">
            <img src={BOT_IMAGES.wait} alt="Máy" className="h-[46vh] max-h-80 object-contain anim-float" />
            <img src={RPS_CHOICES.rock.image} alt="" className="absolute -left-16 top-6 w-20 anim-bob" />
            <img src={RPS_CHOICES.scissors.image} alt="" className="absolute -right-14 top-0 w-16 anim-bob" style={{ animationDelay: '-0.5s' }} />
            <img src={RPS_CHOICES.paper.image} alt="" className="absolute -right-16 bottom-6 w-20 anim-bob" style={{ animationDelay: '-1s' }} />
          </div>
        </div>
      </main>
    </div>
  );
}
