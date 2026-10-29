import { RPS_CHOICES } from '../data/rps';
import { TurnHistoryItem } from '../utils/engine';

const RESULT_COLOR = { win: 'var(--win)', lose: 'var(--lose)', draw: 'var(--draw)' } as const;

interface TurnTrackProps {
  history: TurnHistoryItem[];
  currentRound: 1 | 2;
  currentTurn: number;
  finished?: boolean;
  size?: 'sm' | 'lg';
}

/** 2 vòng x 5 lượt. Ô đã chơi: hình tay của người chơi trên nền màu kết quả. */
export function TurnTrack({ history, currentRound, currentTurn, finished = false, size = 'sm' }: TurnTrackProps) {
  const dot = size === 'lg' ? 'w-12 h-12 sm:w-14 sm:h-14' : 'w-8 h-8 sm:w-9 sm:h-9';

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {([1, 2] as const).map((round) => (
        <div key={round} className="flex items-center gap-1 sm:gap-1.5">
          <span
            className={`font-extrabold leading-none mr-0.5 ${size === 'lg' ? 'text-lg' : 'text-xs sm:text-sm'} ${
              round === currentRound && !finished ? 'text-[var(--sky)]' : 'text-[var(--ink-soft)]'
            }`}
          >
            Vòng {round}
          </span>
          {[1, 2, 3, 4, 5].map((turn) => {
            const item = history.find((h) => h.round === round && h.turn === turn);
            const isCurrent = !finished && !item && round === currentRound && turn === currentTurn;
            if (item) {
              return (
                <span
                  key={turn}
                  title={`Lượt ${turn}: ${RPS_CHOICES[item.playerChoice].label}`}
                  className={`${dot} rounded-full flex items-center justify-center anim-pop`}
                  style={{ background: RESULT_COLOR[item.result], boxShadow: '0 3px 0 rgba(0,0,0,.15)' }}
                >
                  <img src={RPS_CHOICES[item.playerChoice].image} alt="" className="w-[70%] h-[70%] object-contain" />
                </span>
              );
            }
            return (
              <span
                key={turn}
                className={`${dot} relative rounded-full flex items-center justify-center font-extrabold ${
                  isCurrent
                    ? 'bg-[var(--sky)] text-white'
                    : 'bg-white text-[var(--ink-soft)] border-[3px] border-[var(--line)]'
                } ${size === 'lg' ? 'text-xl' : 'text-sm'}`}
              >
                {isCurrent && <span className="absolute inset-0 rounded-full border-4 border-[var(--sky)] anim-ping" />}
                {turn}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function ResultLegend() {
  return (
    <div className="flex items-center gap-3 text-sm font-bold text-[var(--ink-soft)]">
      <span className="flex items-center gap-1"><i className="w-3.5 h-3.5 rounded-full" style={{ background: 'var(--win)' }} />Thắng</span>
      <span className="flex items-center gap-1"><i className="w-3.5 h-3.5 rounded-full" style={{ background: 'var(--draw)' }} />Hòa</span>
      <span className="flex items-center gap-1"><i className="w-3.5 h-3.5 rounded-full" style={{ background: 'var(--lose)' }} />Thua</span>
    </div>
  );
}
