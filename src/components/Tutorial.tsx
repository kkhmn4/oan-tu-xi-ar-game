import { ReactNode } from 'react';
import { ALL_RPS_CHOICES, RPS_CHOICES } from '../data/rps';
import { HandSkeletonSvg } from './HandSkeletonSvg';
import { TopBar } from './Intro';

interface TutorialProps {
  isFullscreen?: boolean;
  onBack: () => void;
  onToggleFullscreen?: () => void;
  onStart: () => void;
}

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

      <main className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center-safe fit-short px-4 sm:px-6 py-3 w-full">
        <div className="w-full max-w-[1600px] flex flex-col gap-[2.2vh]">
          {/* Nút chơi ở trên cùng, không phải cuộn xuống tìm */}
          <div className="flex items-center justify-between gap-3">
            <h2 className="title" style={{ fontSize: 'clamp(1.8rem, 5vh, 2.8rem)' }}>
              Một lượt có <span className="text-[var(--sky)]">4 bước</span>
            </h2>
            <button type="button" onClick={onStart} className="btn btn-win min-h-[64px] text-2xl sm:text-3xl px-10 sm:px-14 anim-pop">
              Chơi ngay! ▶
            </button>
          </div>

          {/* Bốn bước: ô thấp, trải ngang */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Step n={1} color="var(--sky)" title="Ra tay" text="Giơ Búa, Kéo hoặc Bao trước camera.">
              <div className="flex items-end justify-center h-full w-full">
                {ALL_RPS_CHOICES.map((c) => (
                  <img key={c} src={RPS_CHOICES[c].image} alt={RPS_CHOICES[c].label} className="w-1/3 max-h-[90%] object-contain" />
                ))}
              </div>
            </Step>

            <Step n={2} color="var(--ink)" title="Máy chốt" text="Giữ yên tay cho vòng chạy đầy. Máy khóa lựa chọn.">
              <div className="relative h-full aspect-square rounded-full bg-white border-[5px] border-[var(--ink)] flex items-center justify-center">
                <img src={RPS_CHOICES.scissors.image} alt="" className="h-[78%] object-contain" />
                <span className="absolute -right-3 -top-2 chip text-base" style={{ ['--c' as string]: 'var(--ink)' }}>🔒</span>
              </div>
            </Step>

            <Step n={3} color="var(--rock)" title="Lắc tay" text="Lắc qua lại khoảng 3 lần. Máy hô OẲN, TÙ, XÌ.">
              <img src={RPS_CHOICES.scissors.image} alt="" className="h-full object-contain anim-wiggle" />
            </Step>

            <Step n={4} color="var(--grape)" title="Mở thẻ" text="Vòng đầy, máy mở thẻ. Xem ai thắng!">
              <div className="flex items-center justify-center gap-1 h-full w-full">
                <div className="w-[34%] aspect-[3/4] max-h-[85%] rounded-xl bg-[var(--grape)] flex items-center justify-center shadow-[0_4px_0_var(--grape-dark)]">
                  <span className="title text-white text-3xl">?</span>
                </div>
                <span className="title text-2xl text-[var(--grape)]">›</span>
                <img src={RPS_CHOICES.paper.image} alt="" className="w-[44%] max-h-[90%] object-contain -scale-x-100" />
              </div>
            </Step>
          </div>

          {/* Cách làm ba thế tay và luật vòng chơi trên cùng một hàng */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-stretch">
            {ALL_RPS_CHOICES.map((c) => (
              <div
                key={c}
                className="flex items-center gap-3 rounded-3xl bg-white border-4 p-2.5"
                style={{ borderColor: RPS_CHOICES[c].color, boxShadow: `0 6px 0 ${RPS_CHOICES[c].color}` }}
              >
                <div className="rounded-2xl p-1 shrink-0" style={{ background: RPS_CHOICES[c].soft, width: 'min(13vh, 110px)', height: 'min(13vh, 110px)' }}>
                  <HandSkeletonSvg gesture={c} color={RPS_CHOICES[c].color} glow={false} />
                </div>
                <div className="flex flex-col leading-tight min-w-0">
                  <span className="title" style={{ color: RPS_CHOICES[c].color, fontSize: 'clamp(1.8rem, 5vh, 2.6rem)' }}>{RPS_CHOICES[c].label}</span>
                  <span className="font-extrabold text-balance" style={{ fontSize: 'clamp(1.05rem, 2.8vh, 1.4rem)' }}>{RPS_CHOICES[c].pose}</span>
                </div>
              </div>
            ))}
            <div className="flex lg:flex-col flex-wrap justify-center gap-2 font-extrabold" style={{ fontSize: 'clamp(1rem, 2.6vh, 1.35rem)' }}>
              <span className="chip px-4 py-1 justify-center" style={{ ['--c' as string]: 'var(--sky)' }}>Vòng 1: bạn thứ nhất, 5 lượt</span>
              <span className="chip px-4 py-1 justify-center" style={{ ['--c' as string]: 'var(--grape)' }}>Vòng 2: bạn thứ hai, 5 lượt</span>
              <span className="chip px-4 py-1 justify-center" style={{ ['--c' as string]: 'var(--sun-dark)' }}>Thắng +100 ⭐, hòa +30 ⭐</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Step({ n, color, title, text, children }: { n: number; color: string; title: string; text: string; children: ReactNode }) {
  return (
    <div
      className="card flex flex-col gap-1.5 p-3 anim-pop"
      style={{ ['--c' as string]: color, ['--cs' as string]: color, animationDelay: `${n * 0.08}s` }}
    >
      <div className="flex items-center gap-2">
        <span className="w-9 h-9 rounded-full text-white font-extrabold text-xl flex items-center justify-center shrink-0" style={{ background: color }}>
          {n}
        </span>
        <span className="title leading-tight" style={{ color, fontSize: 'clamp(1.5rem, 4.2vh, 2.3rem)' }}>{title}</span>
      </div>
      {/* Hình bên trái, lời bên phải: ô thấp hơn, rộng hơn */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center shrink-0 overflow-hidden" style={{ height: 'min(22vh, 190px)', width: '46%' }}>
          {children}
        </div>
        <p className="font-bold leading-snug text-left" style={{ fontSize: 'clamp(1rem, 2.8vh, 1.4rem)' }}>{text}</p>
      </div>
    </div>
  );
}
