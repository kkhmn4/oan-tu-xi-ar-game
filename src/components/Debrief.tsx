import { PlayerProfile } from '../data/characters';
import { ALL_RPS_CHOICES, BOT_IMAGES, RPSChoice, RPS_CHOICES } from '../data/rps';
import { GameState } from '../utils/engine';
import { TopBar } from './Intro';
import { CharacterAvatar, getCharacterById } from './PlayerSetupModal';
import { ResultLegend, TurnTrack } from './TurnTrack';

interface DebriefProps {
  state: GameState;
  profile: PlayerProfile;
  onReplay: () => void;
  onOpenSetup: () => void;
  onBackToIntro: () => void;
}

export function Debrief({ state, profile, onReplay, onOpenSetup, onBackToIntro }: DebriefProps) {
  const character = getCharacterById(profile.characterId);
  const isWin = state.totalWins > state.totalLosses;
  const isDraw = state.totalWins === state.totalLosses;
  const color = isWin ? 'var(--win)' : isDraw ? 'var(--draw)' : 'var(--lose)';
  const colorDark = isWin ? 'var(--win-dark)' : isDraw ? 'var(--sun-dark)' : 'var(--lose-dark)';

  const counts: Record<RPSChoice, number> = { rock: 0, paper: 0, scissors: 0 };
  state.history.forEach((h) => (counts[h.playerChoice] += 1));
  const fav = ALL_RPS_CHOICES.reduce((a, b) => (counts[b] > counts[a] ? b : a));
  const total = state.history.length;

  return (
    <div className="stage flex-1 flex flex-col h-full overflow-hidden">
      <div className="stage-deco" aria-hidden="true">
        <span /><span /><span /><span />
      </div>
      <TopBar
        title="Tổng kết"
        right={
          <button type="button" onClick={onBackToIntro} className="btn btn-white btn-sm">
            ← Trang đầu
          </button>
        }
      />

      <main className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center gap-3 px-3 sm:px-5 py-3 max-w-5xl mx-auto w-full">
        <div className="card w-full flex flex-wrap items-center justify-center gap-4 sm:gap-8 px-4 py-3 anim-pop" style={{ ['--c' as string]: color, ['--cs' as string]: colorDark }}>
          <div className="flex items-end gap-2">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-[var(--sky-soft)] p-1">
              <CharacterAvatar character={character} />
            </div>
            <span className="title text-3xl text-[var(--ink-soft)] pb-6">vs</span>
            <img src={isWin ? BOT_IMAGES.lose : isDraw ? BOT_IMAGES.draw : BOT_IMAGES.win} alt="Máy" className="h-24 sm:h-28 object-contain" />
          </div>
          <div className="flex flex-col items-center text-center">
            <span className="text-5xl">{isWin ? '🏆' : isDraw ? '🤝' : '💪'}</span>
            <span className="title text-[clamp(2.2rem,5vw,3.8rem)]" style={{ color }}>
              {isWin ? 'BẠN THẮNG MÁY!' : isDraw ? 'HÒA NHAU!' : 'MÁY THẮNG LẦN NÀY!'}
            </span>
            <span className="text-lg sm:text-xl font-extrabold text-[var(--ink-soft)]">
              {profile.groupName}
              {profile.className ? `, ${profile.className}` : ''}
            </span>
          </div>
          <div className="flex flex-col items-center rounded-3xl bg-[var(--sun-soft)] border-4 border-[var(--sun)] px-5 py-2">
            <span className="text-base font-extrabold">Tổng điểm</span>
            <span className="title text-5xl sm:text-6xl">⭐ {state.score}</span>
          </div>
        </div>

        <div className="flex gap-2 sm:gap-3 text-xl sm:text-2xl anim-slide-up">
          <span className="chip px-5 py-1" style={{ ['--c' as string]: 'var(--win)' }}>Thắng {state.totalWins}</span>
          <span className="chip px-5 py-1" style={{ ['--c' as string]: 'var(--draw)' }}>Hòa {state.totalDraws}</span>
          <span className="chip px-5 py-1" style={{ ['--c' as string]: 'var(--lose)' }}>Thua {state.totalLosses}</span>
        </div>

        <div className="card w-full flex flex-col items-center gap-2 p-3 anim-slide-up overflow-x-auto">
          <TurnTrack history={state.history} currentRound={2} currentTurn={5} finished size="lg" />
          <ResultLegend />
        </div>

        {total > 0 && (
          <div className="card w-full flex items-center gap-3 p-3 anim-slide-up" style={{ ['--c' as string]: 'var(--grape)', ['--cs' as string]: 'var(--grape-dark)' }}>
            <img src={RPS_CHOICES[fav].image} alt="" className="w-16 h-16 sm:w-20 sm:h-20 object-contain shrink-0" />
            <div className="flex flex-col leading-snug">
              <span className="font-extrabold text-xl sm:text-2xl text-[var(--grape)]">Máy đã để ý thói quen của em</span>
              <span className="text-lg sm:text-xl font-bold">
                Em ra <b style={{ color: RPS_CHOICES[fav].color }}>{RPS_CHOICES[fav].label}</b> nhiều nhất: {counts[fav]} trên {total} lượt.
              </span>
              <span className="text-base sm:text-lg text-[var(--ink-soft)] font-bold">
                Máy học từ các lượt trước để đoán lượt sau. Muốn thắng máy, hãy đổi tay thật bất ngờ!
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <button type="button" onClick={onReplay} className="btn btn-win min-h-[62px] text-2xl px-10">
            ↻ Chơi lại
          </button>
          <button type="button" onClick={onOpenSetup} className="btn btn-white">
            ✏️ Đổi đội
          </button>
        </div>
      </main>
    </div>
  );
}
