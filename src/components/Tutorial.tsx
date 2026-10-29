import { ReactNode } from 'react';
import { ALL_RPS_CHOICES, BOT_IMAGES, RPS_CHOICES } from '../data/rps';
import { HandSkeletonSvg } from './HandSkeletonSvg';
import { TopBar } from './Intro';

interface TutorialProps {
  isFullscreen?: boolean;
  onBack: () => void;
  onToggleFullscreen?: () => void;
  onStart: () => void;
}

const BEAT_STRIP = [
  { word: 'OẲN', c: 'var(--rock)', note: 'lắc tay' },
  { word: 'TÙ', c: 'var(--sky)', note: 'lắc tay' },
  { word: 'XÌ', c: 'var(--lose)', note: 'ra tay, giữ yên' },
  { word: '🔒 CHỐT', c: 'var(--ink)', note: 'máy khóa tay em' },
];

export function Tutorial({ isFullscreen, onBack, onToggleFullscreen, onStart }: TutorialProps) {
  return (
    <div className="stage flex-1 flex flex-col h-full overflow-hidden">
      <div className="stage-deco" aria-hidden="true">
        <span /><span /><span /><span />
      </div>
      <TopBar
        title="Cách chơi"
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
        right={
          <button type="button" onClick={onBack} className="btn btn-white btn-sm">
            ← Trang đầu
          </button>
        }
      />

      <main className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center gap-3 sm:gap-4 px-3 sm:px-5 py-3 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full">
          <Step n={1} color="var(--sky)" title="Giơ 1 bàn tay" text="Đưa tay vào trước camera. Máy chỉ nhìn các khớp tay, không hiện hình em.">
            <div className="h-full aspect-square rounded-2xl bg-[var(--sky-soft)] p-2">
              <HandSkeletonSvg gesture="paper" color="#1E9BFF" glow={false} />
            </div>
          </Step>

          <Step n={2} color="var(--rock)" title="Hô OẲN, TÙ" text="Nắm tay lại, lắc lên xuống theo nhịp hô.">
            <img src={RPS_CHOICES.rock.image} alt="" className="h-full object-contain anim-wiggle" />
          </Step>

          <Step n={3} color="var(--lose)" title="Đến XÌ: ra tay" text="Ra Búa, Kéo hoặc Bao. Giữ yên tay đến khi hết thanh đỏ.">
            <div className="flex items-end gap-1 h-full">
              {ALL_RPS_CHOICES.map((c) => (
                <img key={c} src={RPS_CHOICES[c].image} alt={RPS_CHOICES[c].label} className="h-[85%] object-contain" />
              ))}
            </div>
          </Step>

          <Step n={4} color="var(--grape)" title="Máy CHỐT, lật bài" text="Máy khóa tay em, rồi mới lật bài của máy. Xem ai thắng!">
            <div className="relative h-full flex items-center">
              <img src={BOT_IMAGES.draw} alt="" className="h-full object-contain" />
              <span className="absolute -right-3 top-0 chip text-base" style={{ ['--c' as string]: 'var(--ink)' }}>🔒</span>
            </div>
          </Step>
        </div>

        <div className="card w-full p-3 flex flex-col items-center gap-2" style={{ ['--c' as string]: 'var(--sun)', ['--cs' as string]: 'var(--sun-dark)' }}>
          <span className="font-extrabold text-lg sm:text-xl">Nhịp của một lượt</span>
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
            {BEAT_STRIP.map((b, i) => (
              <div key={b.word} className="flex items-center gap-1.5 sm:gap-2">
                <div className="flex flex-col items-center">
                  <span className="chip title text-2xl sm:text-3xl px-4 py-1" style={{ ['--c' as string]: b.c, boxShadow: '0 4px 0 rgba(0,0,0,.18)' }}>
                    {b.word}
                  </span>
                  <span className="text-sm sm:text-base font-bold text-[var(--ink-soft)] mt-1">{b.note}</span>
                </div>
                {i < BEAT_STRIP.length - 1 && <span className="title text-3xl text-[var(--line)] -mt-5">›</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {ALL_RPS_CHOICES.map((c) => (
            <div key={c} className="flex items-center gap-2 rounded-2xl bg-white border-[3px] pl-1 pr-3 py-1" style={{ borderColor: RPS_CHOICES[c].color }}>
              <div className="w-11 h-11 rounded-xl p-0.5" style={{ background: RPS_CHOICES[c].soft }}>
                <HandSkeletonSvg gesture={c} color={RPS_CHOICES[c].color} glow={false} />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="font-extrabold text-lg" style={{ color: RPS_CHOICES[c].color }}>{RPS_CHOICES[c].label}</span>
                <span className="text-sm sm:text-base font-bold">{RPS_CHOICES[c].pose}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 text-base sm:text-lg font-extrabold">
          <span className="chip" style={{ ['--c' as string]: 'var(--sky)' }}>Vòng 1: bạn thứ nhất, 5 lượt</span>
          <span className="chip" style={{ ['--c' as string]: 'var(--grape)' }}>Vòng 2: đổi bạn thứ hai, 5 lượt</span>
          <span className="chip" style={{ ['--c' as string]: 'var(--sun-dark)' }}>Thắng +100 ⭐, hòa +30 ⭐</span>
        </div>

        <button type="button" onClick={onStart} className="btn btn-win min-h-[66px] text-2xl px-12">
          Chơi ngay! ▶
        </button>
      </main>
    </div>
  );
}

function Step({ n, color, title, text, children }: { n: number; color: string; title: string; text: string; children: ReactNode }) {
  return (
    <div className="card flex flex-col items-center text-center gap-1 p-3 anim-pop" style={{ ['--c' as string]: color, ['--cs' as string]: color, animationDelay: `${n * 0.08}s` }}>
      <div className="flex items-center gap-2 self-start">
        <span className="w-9 h-9 rounded-full text-white font-extrabold text-xl flex items-center justify-center" style={{ background: color }}>
          {n}
        </span>
        <span className="font-extrabold text-xl sm:text-2xl text-left leading-tight" style={{ color }}>{title}</span>
      </div>
      <div className="h-24 sm:h-28 lg:h-32 flex items-center justify-center my-1">{children}</div>
      <p className="text-base sm:text-lg font-bold leading-snug">{text}</p>
    </div>
  );
}
