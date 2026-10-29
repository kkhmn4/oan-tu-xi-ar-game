import { ReactNode, RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { AIDifficulty } from '../ai';
import { BRAND_MASCOTS } from '../data/brand';
import { PlayerProfile } from '../data/characters';
import { ALL_RPS_CHOICES, BOT_IMAGES, HAND_WAITING_IMAGE, RPSChoice, RPS_CHOICES } from '../data/rps';
import { audio } from '../utils/audio';
import { LITE } from '../utils/device';
import { GameEngine, GamePhase, GameState, InputMode } from '../utils/engine';
import { handStats, preloadHandTracker, pushFrame, setHandListener } from '../vision/handTracker';
import { CharacterAvatar, getCharacterById } from './PlayerSetupModal';

const MAX_CANVAS_PIXEL_RATIO = LITE ? 1 : 1.5;
const MAX_FRAME_DELTA_MS = 50;
const PROGRESS_STEPS = 24; // thanh thời gian chỉ cần cập nhật ~24 nấc mỗi pha, không cần mỗi khung hình
// Chỉ nhận diện tay ở các pha cần tay (ra tay, lắc); lúc chốt, mở thẻ, nghỉ thì worker được nghỉ
const NEEDS_HAND: GamePhase[] = ['TURN_INTRO', 'WAIT_HAND', 'CHOOSE', 'CHANT'];

interface GameProps {
  profile: PlayerProfile;
  difficulty?: AIDifficulty;
  onGameOver: (state: GameState) => void;
  onStateUpdate: (state: GameState) => void;
}

/** Khóa dùng để quyết định có cần vẽ lại giao diện React hay không. */
function uiKey(s: GameState): string {
  const timed = s.phase === 'REVEAL' || s.phase === 'ROUND_GAP';
  return [
    s.phase,
    s.chantWord,
    s.beat,
    s.needShake,
    s.liveGesture,
    s.handVisible,
    s.playerChoice,
    s.aiChoice,
    s.inputMode,
    s.history.length,
    s.phase === 'CHOOSE' ? Math.floor(s.holdProgress * PROGRESS_STEPS) : 0,
    s.phase === 'CHANT' ? Math.floor(s.shakeProgress * PROGRESS_STEPS * 2) : 0,
    timed ? Math.floor(s.phaseProgress * PROGRESS_STEPS) : 0,
    s.phase === 'ROUND_GAP' ? Math.ceil(s.phaseRemaining) : 0,
  ].join('|');
}

/** Khóa cho thanh trên cùng (App): chỉ đổi khi điểm, lượt hoặc pha đổi. */
function hudKey(s: GameState): string {
  return [s.phase, s.score, s.streak, s.round, s.turn, s.history.length].join('|');
}

export function Game({ profile, difficulty = 'normal', onGameOver, onStateUpdate }: GameProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fxCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const rafRef = useRef(0);
  const finishedRef = useRef(false);
  const onGameOverRef = useRef(onGameOver);
  const onStateUpdateRef = useRef(onStateUpdate);
  onGameOverRef.current = onGameOver;
  onStateUpdateRef.current = onStateUpdate;

  const [loading, setLoading] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [state, setState] = useState<GameState | null>(null);

  useEffect(() => {
    if (!cameraError) return;
    const t = window.setTimeout(() => setCameraError(null), 5000);
    return () => window.clearTimeout(t);
  }, [cameraError]);

  const stopCamera = useCallback(() => {
    setHandListener(null);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
      video.pause();
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Vòng lặp khung hình: gửi khung cho worker, cập nhật engine, vẽ hiệu ứng
  // ---------------------------------------------------------------------------
  const runLoop = useCallback(() => {
    let last = performance.now();
    let lastUi = '';
    let lastHud = '';
    let fxWasEmpty = false;

    const frame = (t: number) => {
      if (finishedRef.current) return;
      const engine = engineRef.current;
      const canvas = fxCanvasRef.current;
      const box = containerRef.current;
      if (!engine || !canvas || !box) return;

      const dt = Math.max(0, Math.min(MAX_FRAME_DELTA_MS, t - last));
      last = t;

      const live = engine.peek();
      if (live.inputMode === 'camera' && NEEDS_HAND.includes(live.phase) && videoRef.current) pushFrame(videoRef.current);
      engine.update(dt);

      const w = Math.max(1, box.clientWidth);
      const h = Math.max(1, box.clientHeight);
      const pr = Math.min(MAX_CANVAS_PIXEL_RATIO, window.devicePixelRatio || 1);
      if (canvas.width !== Math.floor(w * pr) || canvas.height !== Math.floor(h * pr)) {
        canvas.width = Math.floor(w * pr);
        canvas.height = Math.floor(h * pr);
        engine.resize(w, h);
        fxWasEmpty = false;
      }
      // Không có pháo giấy, vòng sóng thì khỏi xóa và vẽ lại cả màn hình
      const fxEmpty = !engine.hasVFX();
      if (!(fxEmpty && fxWasEmpty)) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.setTransform(pr, 0, 0, pr, 0, 0);
          engine.draw(ctx);
        }
      }
      fxWasEmpty = fxEmpty;

      // Ô camera nhỏ: chỉ vẽ lại khi có dữ liệu tay mới
      const pv = previewCanvasRef.current;
      if (pv && engine.takePreviewDirty()) {
        const pw = pv.clientWidth;
        const ph = pv.clientHeight;
        if (pw > 0 && (pv.width !== Math.floor(pw * pr) || pv.height !== Math.floor(ph * pr))) {
          pv.width = Math.floor(pw * pr);
          pv.height = Math.floor(ph * pr);
        }
        const pctx = pv.getContext('2d');
        if (pctx && pw > 0) {
          pctx.setTransform(pr, 0, 0, pr, 0, 0);
          engine.drawHandPreview(pctx, pw, ph);
        }
      }

      const cur = engine.peek();
      const ui = uiKey(cur);
      if (ui !== lastUi) {
        lastUi = ui;
        const snap = engine.getState();
        setState(snap);
        const hud = hudKey(snap);
        if (hud !== lastHud) {
          lastHud = hud;
          onStateUpdateRef.current(snap);
        }
      }
      if (cur.isGameOver && !finishedRef.current) {
        finishedRef.current = true;
        stopCamera();
        onGameOverRef.current(engine.getState());
        return;
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
  }, [stopCamera]);

  const startEngine = useCallback(
    (mode: InputMode) => {
      if (engineRef.current) return;
      engineRef.current = new GameEngine(() => undefined, difficulty, mode);
      setLoading(false);
      runLoop();
    },
    [difficulty, runLoop]
  );

  const switchToButtons = useCallback(() => {
    stopCamera();
    if (engineRef.current) engineRef.current.setInputMode('buttons');
    else startEngine('buttons');
  }, [startEngine, stopCamera]);

  // Mở camera và chờ worker nhận diện tay sẵn sàng (thường đã nạp sẵn từ trang đầu)
  useEffect(() => {
    let active = true;
    finishedRef.current = false;
    audio.init();

    const openCamera = async () => {
      try {
        return await navigator.mediaDevices.getUserMedia({
          // 480x360 đủ cho nhận diện tay, nhẹ hơn 640x480 cho máy yếu
          video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 360 }, frameRate: { ideal: 24, max: 30 } },
          audio: false,
        });
      } catch {
        return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      }
    };

    const init = async () => {
      try {
        const [stream] = await Promise.all([openCamera(), preloadHandTracker()]);
        if (!active || engineRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current!;
        setHandListener((pts) => {
          const engine = engineRef.current;
          if (!engine || !video.videoWidth) return;
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          // Lật gương cho giống soi gương, đổi sang tọa độ điểm ảnh của khung video
          engine.updateHand(pts ? pts.map((p) => ({ x: (1 - p.x) * vw, y: p.y * vh, z: p.z })) : null, vw, vh);
        });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          if (!active) return;
          video.play().catch(() => undefined);
          startEngine('camera');
        };
      } catch (err) {
        console.warn('Không mở được camera hoặc mô hình, chuyển sang nút bấm:', err);
        if (!active) return;
        setCameraError('Không mở được camera. Em chơi bằng nút bấm nhé!');
        switchToButtons();
      }
    };
    init();

    // Số đo nhận diện tay (GPU hay CPU, mấy ms mỗi lần) để kiểm hiệu năng
    (window as any).__oanPerf = handStats;

    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
      stopCamera();
    };
  }, [startEngine, stopCamera, switchToButtons]);

  const char = getCharacterById(profile.characterId);
  const s = state;
  const phase = s?.phase ?? 'TURN_INTRO';

  const resultColor =
    s?.lastResult === 'win' ? 'var(--win)' : s?.lastResult === 'lose' ? 'var(--lose)' : 'var(--draw)';

  return (
    <div ref={containerRef} className="stage relative w-full h-full overflow-hidden select-none">
      <div className="stage-deco" aria-hidden="true">
        <span /><span /><span /><span />
      </div>

      {/* Luồng camera chỉ để máy đọc khớp tay. Không hiện hình học sinh lên màn hình (C-108). */}
      <video
        ref={videoRef}
        playsInline
        autoPlay
        muted
        disablePictureInPicture
        className="absolute w-px h-px opacity-0 pointer-events-none"
        aria-hidden="true"
      />

      {s && (
        <div className="absolute inset-0 flex flex-col gap-1 sm:gap-2 p-2 sm:p-3">
          <PhaseSteps phase={phase} />
          <FocusStage state={s} char={char} onNext={() => engineRef.current?.skipReveal()} />
          <BottomBar
            state={s}
            previewRef={previewCanvasRef}
            onChoose={(c) => engineRef.current?.chooseByButton(c)}
            onSwitchToButtons={switchToButtons}
          />
        </div>
      )}

      {/* Viền màn hình sáng màu: đỏ nhấp nháy lúc XÌ, màu kết quả lúc mở thẻ */}
      {phase === 'SHOW' && <div className="edge-glow edge-pulse" style={{ ['--g' as string]: 'var(--lose)' }} />}
      {phase === 'REVEAL' && <div key={`edge-${s?.round}-${s?.turn}`} className="edge-glow anim-fade" style={{ ['--g' as string]: resultColor }} />}

      {/* Lớp hiệu ứng pháo giấy, vòng sóng */}
      <canvas ref={fxCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-30" />

      {/* Lóe sáng như bấm máy ảnh lúc CHỐT */}
      {phase === 'LOCKED' && <div key={`flash-${s?.round}-${s?.turn}`} className="absolute inset-0 z-30 bg-white anim-flash pointer-events-none" />}

      {s && phase === 'TURN_INTRO' && <TurnIntroOverlay state={s} />}
      {s && phase === 'ROUND_GAP' && <RoundGapOverlay state={s} onStart={() => engineRef.current?.startRound2()} />}

      {cameraError && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 chip text-base sm:text-lg py-1.5 px-4 anim-slide-up" style={{ ['--c' as string]: 'var(--lose)' }}>
          📷 {cameraError}
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 z-50 stage flex flex-col items-center justify-center gap-3 p-6 text-center">
          <img className="w-32 h-32 object-contain anim-bob" src={BRAND_MASCOTS.explore} alt="" />
          <p className="title text-3xl sm:text-4xl">Đang mở camera...</p>
          <p className="text-lg font-bold text-[var(--sky)]">Máy đang chuẩn bị mắt nhìn bàn tay</p>
          <p className="text-lg text-[var(--ink-soft)] max-w-md">Nếu trình duyệt hỏi, em bấm <b>Cho phép</b> để máy nhìn thấy bàn tay.</p>
          <div className="w-12 h-12 rounded-full border-[6px] border-[var(--sky)] border-t-transparent animate-spin" />
          <button type="button" className="btn btn-white btn-sm mt-2" onClick={switchToButtons}>
            🖱️ Không có camera? Chơi bằng nút bấm
          </button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// THANH 4 BƯỚC CỦA MỘT LƯỢT
// =============================================================================
const STEPS = [
  { icon: '✋', label: 'Ra tay' },
  { icon: '🔒', label: 'Chốt' },
  { icon: '🎵', label: 'Lắc tay' },
  { icon: '🃏', label: 'Mở thẻ' },
];

function stepIndex(phase: GamePhase): number {
  if (phase === 'LOCKED') return 1;
  if (phase === 'CHANT' || phase === 'SHOW') return 2;
  if (phase === 'REVEAL') return 3;
  return 0;
}

function PhaseSteps({ phase }: { phase: GamePhase }) {
  const cur = stepIndex(phase);
  return (
    <div className="hide-short flex items-center justify-center gap-1.5 shrink-0">
      {STEPS.map((st, i) => {
        const done = i < cur;
        const active = i === cur;
        const bg = active ? 'var(--sky)' : done ? 'var(--win)' : '#fff';
        return (
          <div key={st.label} className="flex items-center gap-1.5">
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-0.5 font-extrabold ${
                active ? 'text-white text-lg' : done ? 'text-white text-sm opacity-80' : 'text-[var(--ink-soft)] text-sm border-[3px] border-[var(--line)] opacity-70'
              }`}
              style={{ background: bg }}
            >
              <span>{done ? '✓' : st.icon}</span>
              <span>{st.label}</span>
            </div>
            {i < STEPS.length - 1 && <span className="text-lg font-extrabold text-[var(--line)]">›</span>}
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// VÙNG TIÊU ĐIỂM: MỘT CHỮ LỆNH TO, TAY EM ĐỐI MẶT THẺ CỦA MÁY, NHỊP Ở DƯỚI
// =============================================================================
interface Banner {
  text: string;
  sub: string;
  color: string;
  pulse?: boolean;
}

function getBanner(s: GameState): Banner {
  const camera = s.inputMode === 'camera';
  switch (s.phase) {
    case 'WAIT_HAND':
      return { text: 'GIƠ TAY LÊN!', sub: 'Đưa 1 bàn tay vào trước camera', color: 'var(--sky)' };
    case 'CHOOSE':
      if (!camera) return { text: 'CHỌN TAY!', sub: 'Bấm Búa, Kéo hoặc Bao ở dưới', color: 'var(--sky)' };
      if (!s.handVisible) return { text: 'GIƠ TAY LÊN!', sub: 'Máy chưa thấy tay em', color: 'var(--sky)', pulse: true };
      return { text: 'RA TAY!', sub: 'Giữ yên Búa, Kéo hoặc Bao cho vòng chạy đầy', color: 'var(--sky)' };
    case 'LOCKED':
      return {
        text: 'ĐÃ CHỐT!',
        sub: camera ? 'Giờ lắc tay cho vòng cam đầy để mở thẻ' : 'Cùng hô OẲN, TÙ, XÌ',
        color: 'var(--ink)',
      };
    case 'CHANT': {
      if (!camera) return { text: s.chantWord || 'LẮC TAY!', sub: 'Cùng hô theo nhịp', color: s.chantWord === 'TÙ' ? 'var(--sky)' : 'var(--rock)' };
      if (s.needShake) {
        return {
          text: 'LẮC TAY ĐỂ TIẾP TỤC',
          sub: s.handVisible ? 'Lắc tay qua lại cho vòng cam đầy' : 'Máy chưa thấy tay em',
          color: 'var(--rock)',
          pulse: true,
        };
      }
      if (s.beat === 0) return { text: 'LẮC TAY!', sub: 'Lắc qua lại cho vòng cam đầy', color: 'var(--rock)' };
      if (s.beat === 1) return { text: 'OẲN', sub: 'Lắc tiếp!', color: 'var(--rock)' };
      return { text: 'TÙ', sub: 'Lắc thêm chút nữa là mở thẻ!', color: 'var(--sky)' };
    }
    case 'SHOW':
      return { text: 'XÌ!', sub: 'Mở thẻ!', color: 'var(--lose)' };
    case 'REVEAL':
      return {
        text: s.resultMessage,
        sub: `${s.resultDetail}${s.lastScoreGain ? `   +${s.lastScoreGain} ⭐` : ''}`,
        color: s.lastResult === 'win' ? 'var(--win)' : s.lastResult === 'lose' ? 'var(--lose)' : 'var(--draw)',
      };
    default:
      return { text: `LƯỢT ${s.turn}`, sub: `Vòng ${s.round}`, color: 'var(--sky)' };
  }
}

function FocusStage({
  state: s,
  char,
  onNext,
}: {
  state: GameState;
  char: ReturnType<typeof getCharacterById>;
  onNext: () => void;
}) {
  const b = getBanner(s);
  const long = b.text.length > 10;
  const loseShake = s.phase === 'REVEAL' && s.lastResult === 'lose';

  return (
    <div
      key={loseShake ? `shake-${s.round}-${s.turn}` : 'stage'}
      className={`flex-1 min-h-0 flex flex-col items-center justify-center gap-[1.2vh] ${loseShake ? 'anim-shake-once' : ''}`}
    >
      {/* Chữ lệnh: chỗ duy nhất có chữ to */}
      <div className="flex flex-col items-center text-center shrink-0">
        <span
          key={b.text}
          className={`title outline-text anim-beat ${b.pulse ? 'anim-pulse-text' : ''}`}
          style={{ color: b.color, fontSize: long ? 'clamp(2rem, 7vh, 5rem)' : 'clamp(3rem, 11vh, 8rem)' }}
        >
          {b.text}
        </span>
        <span className="font-extrabold text-[var(--ink)] leading-tight" style={{ fontSize: 'clamp(1.2rem, 3.4vh, 2.1rem)' }}>
          {b.sub}
        </span>
      </div>

      {/* Tay em và thẻ của máy đối mặt nhau */}
      <div className="flex-1 min-h-0 w-full max-w-6xl grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6 px-2">
        <PlayerSlot state={s} char={char} />
        <CenterBadge state={s} />
        <BotSlot state={s} />
      </div>

      <div className="shrink-0 flex flex-col items-center gap-1.5 min-h-[11vh] justify-center">
        {s.phase === 'REVEAL' ? (
          <div className="flex items-center gap-3">
            <div className="w-48 sm:w-64 timebar" style={{ ['--c' as string]: 'var(--sky)' }}>
              <i style={{ width: `${s.phaseProgress * 100}%` }} />
            </div>
            <button type="button" className="btn" onClick={onNext}>
              {s.turn < s.maxTurnsPerRound ? `Lượt ${s.turn + 1}` : s.round === 1 ? 'Hết vòng 1' : 'Xem tổng kết'} ▶
            </button>
          </div>
        ) : (
          <BeatTrack state={s} />
        )}
      </div>
    </div>
  );
}

const RING_LEN = 2 * Math.PI * 47; // chu vi vòng tròn r = 47 trong khung 100 x 100

function HandStage({
  children,
  ring,
  spin,
  reverse,
  fill,
  fillColor,
  label,
  labelColor,
}: {
  children: ReactNode;
  ring?: string;
  spin?: string; // màu vòng nét đứt xoay quanh (đang chờ, đang lắc)
  reverse?: boolean;
  fill?: number; // 0..1: vòng chạy đầy dần khi giữ yên tay, đầy là máy chốt
  fillColor?: string;
  label?: string; // nhãn màu gắn ở mép dưới hình tròn (BÚA, THẺ ÚP)
  labelColor?: string;
}) {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ height: 'min(27vh, 250px)', aspectRatio: '1 / 1', marginTop: '2.6vh', marginBottom: '3.4vh' }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: '#fff', boxShadow: ring ? `0 0 0 8px ${ring}, 0 10px 0 8px rgba(35,51,92,.12)` : '0 8px 0 rgba(35,51,92,.08)' }}
      />
      {spin && fill === undefined && (
        <svg className={`absolute -inset-[9%] w-[118%] h-[118%] pointer-events-none ${reverse ? 'anim-spin-rev' : 'anim-spin'}`} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="47" fill="none" stroke={spin} strokeWidth="3.2" strokeLinecap="round" strokeDasharray="14 9" />
        </svg>
      )}
      {fill !== undefined && (
        <svg className="absolute -inset-[9%] w-[118%] h-[118%] -rotate-90 pointer-events-none" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="47" fill="none" stroke="#efe6d3" strokeWidth="4.5" />
          <circle
            cx="50"
            cy="50"
            r="47"
            fill="none"
            stroke={fillColor}
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeDasharray={RING_LEN}
            strokeDashoffset={RING_LEN * (1 - fill)}
            style={{ transition: 'stroke-dashoffset 60ms linear' }}
          />
        </svg>
      )}
      {children}
      {label && (
        <span
          className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 z-10 chip title whitespace-nowrap px-5"
          style={{ ['--c' as string]: labelColor, fontSize: 'min(4.6vh, 2.3rem)', boxShadow: '0 4px 0 rgba(0,0,0,.18)', paddingTop: 0 }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

function PlayerSlot({ state: s, char }: { state: GameState; char: ReturnType<typeof getCharacterById> }) {
  const camera = s.inputMode === 'camera';
  const locked = s.playerChoice;
  const live = s.liveGesture;

  let img = HAND_WAITING_IMAGE;
  let anim = 'anim-bob';
  let label = 'Giơ tay';
  let color = 'var(--sky)';
  let spin: string | undefined = 'var(--sky)';
  let fill: number | undefined;
  let fillRingColor: string | undefined;

  if (locked && s.phase !== 'CHOOSE') {
    img = RPS_CHOICES[locked].image;
    label = RPS_CHOICES[locked].vietnameseName;
    color = RPS_CHOICES[locked].color;
    spin = undefined;
    anim = s.phase === 'LOCKED' ? 'anim-pop' : s.phase === 'CHANT' && s.needShake ? 'anim-wiggle' : s.phase === 'CHANT' ? 'anim-drop' : '';
    if (s.phase === 'CHANT') {
      fill = s.shakeProgress; // vòng cam đầy dần theo tay lắc
      fillRingColor = 'var(--rock)';
    }
  } else if (s.phase === 'CHOOSE') {
    if (live) {
      img = RPS_CHOICES[live].image;
      anim = '';
      label = RPS_CHOICES[live].vietnameseName;
      color = RPS_CHOICES[live].color;
      if (camera) {
        fill = s.holdProgress;
        spin = undefined;
      }
    } else {
      label = camera ? '?' : 'Bấm chọn';
    }
  }

  const won = s.phase === 'REVEAL' && s.lastResult === 'win';
  const lost = s.phase === 'REVEAL' && s.lastResult === 'lose';
  const showLock = !!locked && s.phase !== 'CHOOSE';

  return (
    <div className={`flex flex-col items-center min-w-0 ${lost ? 'opacity-55 grayscale' : ''}`}>
      <div className="flex items-center gap-2">
        <div className="rounded-2xl bg-[var(--sky-soft)] p-0.5 shrink-0" style={{ width: 'min(7vh, 56px)', height: 'min(7vh, 56px)' }}>
          <CharacterAvatar character={char} />
        </div>
        <span className="chip px-5" style={{ ['--c' as string]: 'var(--sky)', fontSize: 'min(4.4vh, 2rem)' }}>BẠN</span>
      </div>
      <HandStage
        ring={won ? 'var(--win)' : showLock ? color : undefined}
        spin={won || lost ? undefined : spin}
        fill={fill}
        fillColor={fillRingColor ?? color}
        label={label}
        labelColor={color}
      >
        {won && <span className="absolute -top-8 text-5xl anim-pop z-10">👑</span>}
        <img key={`${img}-${anim}-${s.beat}`} src={img} alt={label} className={`relative h-[80%] w-auto object-contain ${anim}`} />
        {showLock && (
          <span className="absolute -top-1 -right-1 w-14 h-14 rounded-full bg-[var(--ink)] text-white text-3xl flex items-center justify-center anim-stamp shadow-[0_5px_0_rgba(0,0,0,.25)] z-10">
            🔒
          </span>
        )}
      </HandStage>
    </div>
  );
}

function BotSlot({ state: s }: { state: GameState }) {
  const revealed = s.phase === 'REVEAL' && s.aiChoice ? s.aiChoice : null;
  const face = revealed
    ? s.lastResult === 'win'
      ? BOT_IMAGES.lose
      : s.lastResult === 'lose'
      ? BOT_IMAGES.win
      : BOT_IMAGES.draw
    : s.phase === 'CHANT' || s.phase === 'SHOW'
    ? BOT_IMAGES.shuffle
    : BOT_IMAGES.wait;
  const won = s.phase === 'REVEAL' && s.lastResult === 'lose';
  const lost = s.phase === 'REVEAL' && s.lastResult === 'win';
  const shaking = s.phase === 'CHANT' || s.phase === 'SHOW';

  return (
    <div className={`flex flex-col items-center min-w-0 ${lost ? 'opacity-55 grayscale' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="chip px-5" style={{ ['--c' as string]: 'var(--grape)', fontSize: 'min(4.4vh, 2rem)' }}>MÁY</span>
        <img key={face} src={face} alt="" className="object-contain anim-pop" style={{ width: 'min(7vh, 56px)', height: 'min(8vh, 64px)' }} />
      </div>
      <HandStage
        ring={won ? 'var(--win)' : revealed ? RPS_CHOICES[revealed].color : undefined}
        spin={revealed ? undefined : 'var(--grape)'}
        reverse
        label={revealed ? RPS_CHOICES[revealed].vietnameseName : 'THẺ ÚP'}
        labelColor={revealed ? RPS_CHOICES[revealed].color : 'var(--grape)'}
      >
        {won && <span className="absolute -top-8 text-5xl anim-pop z-10">👑</span>}
        {revealed ? (
          <img key={`ai-${s.round}-${s.turn}`} src={RPS_CHOICES[revealed].image} alt="" className="relative h-[80%] w-auto object-contain anim-flip -scale-x-100" />
        ) : (
          <div
            className={`relative h-[74%] aspect-[3/4] rounded-3xl bg-[var(--grape)] flex items-center justify-center shadow-[0_8px_0_var(--grape-dark)] ${shaking ? 'anim-shake' : ''}`}
          >
            <div className="absolute inset-3 rounded-2xl border-4 border-dashed border-white/50" />
            <span className="title text-white" style={{ fontSize: 'min(16vh, 8rem)' }}>?</span>
          </div>
        )}
      </HandStage>
    </div>
  );
}

function CenterBadge({ state: s }: { state: GameState }) {
  const size = 'min(15vh, 130px)';
  if (s.phase === 'REVEAL') {
    const icon = s.lastResult === 'win' ? '🎉' : s.lastResult === 'lose' ? '😮' : '🤝';
    return (
      <span className="anim-pop" style={{ fontSize: 'min(13vh, 6.5rem)' }}>
        {icon}
      </span>
    );
  }
  return (
    <div className="relative flex items-center justify-center rounded-full bg-[var(--ink)] text-white shadow-[0_6px_0_rgba(0,0,0,.25)]" style={{ width: size, height: size }}>
      <span className="title" style={{ fontSize: 'min(6vh, 3rem)' }}>VS</span>
    </div>
  );
}

// Nhịp một lượt: chốt tay trước, rồi lắc cho vòng đầy (OẲN, TÙ, XÌ) thì mở thẻ
const BEATS = ['🔒', 'OẲN', 'TÙ', 'XÌ'] as const;

function BeatTrack({ state: s }: { state: GameState }) {
  const idx =
    s.phase === 'LOCKED' ? 0 : s.phase === 'CHANT' ? s.beat : s.phase === 'SHOW' ? 3 : -1;
  const colors = ['var(--ink)', 'var(--rock)', 'var(--sky)', 'var(--lose)'];
  return (
    <div className="flex items-center justify-center gap-2">
      {BEATS.map((b, i) => (
        <div key={b} className="flex items-center gap-2">
          <div
            className={`rounded-full flex items-center justify-center font-extrabold text-white transition-all ${i === idx ? 'anim-pop' : ''}`}
            style={{
              width: i === idx ? 'min(10.5vh, 96px)' : 'min(8vh, 72px)',
              height: i === idx ? 'min(10.5vh, 96px)' : 'min(8vh, 72px)',
              fontSize: i === idx ? 'min(4.2vh, 2.1rem)' : 'min(3.1vh, 1.5rem)',
              background: i <= idx ? colors[i] : '#e9dfcc',
              boxShadow: i === idx ? '0 5px 0 rgba(0,0,0,.2)' : undefined,
            }}
          >
            {b}
          </div>
          {i < 3 && <span className="w-8 h-2.5 rounded-full" style={{ background: i < idx ? colors[i + 1] : '#e9dfcc' }} />}
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// THANH DƯỚI: Ô NHẬN DIỆN TAY HOẶC NÚT BẤM
// =============================================================================
function BottomBar({
  state: s,
  previewRef,
  onChoose,
  onSwitchToButtons,
}: {
  state: GameState;
  previewRef: RefObject<HTMLCanvasElement | null>;
  onChoose: (c: RPSChoice) => void;
  onSwitchToButtons: () => void;
}) {
  if (s.inputMode === 'buttons') {
    const open = s.phase === 'CHOOSE';
    return (
      <div className="shrink-0 flex items-center justify-center gap-3 sm:gap-5">
        {ALL_RPS_CHOICES.map((c) => {
          const d = RPS_CHOICES[c];
          const picked = s.liveGesture === c && open;
          return (
            <button
              key={c}
              type="button"
              disabled={!open}
              onClick={() => onChoose(c)}
              className={`btn min-h-0 py-1 px-5 sm:px-7 ${picked ? 'ring-4 ring-[var(--ink)] scale-105' : ''} ${open ? '' : 'opacity-40 cursor-not-allowed'}`}
              style={{ ['--c' as string]: d.color, ['--cs' as string]: 'rgba(0,0,0,.25)' }}
            >
              <img src={d.image} alt="" className="w-12 h-12 sm:w-14 sm:h-14 object-contain" />
              <span className="text-2xl">{d.vietnameseName}</span>
            </button>
          );
        })}
      </div>
    );
  }

  const locked = (s.phase === 'LOCKED' || s.phase === 'REVEAL') && s.playerChoice;
  return (
    <div className="shrink-0 flex items-center justify-end gap-3 relative min-h-[44px]">
      <div
        className="absolute left-0 bottom-0 rounded-2xl overflow-hidden border-4 border-[var(--sky)] bg-white z-10"
        style={{ width: 'min(12rem, 24vh)' }}
      >
        <canvas ref={previewRef} className="block w-full aspect-[4/3]" />
        <div className="text-center text-base sm:text-lg font-extrabold py-0.5 bg-[var(--sky)] text-white truncate px-1">
          {locked ? '🔒 Đã chốt' : s.handVisible ? '📷 Thấy tay' : '📷 Chưa thấy tay'}
        </div>
      </div>
      <button type="button" className="btn btn-white btn-sm shrink-0" onClick={onSwitchToButtons}>
        🖱️ Chơi bằng nút
      </button>
    </div>
  );
}

// =============================================================================
// LỚP PHỦ: SANG LƯỢT MỚI, NGHỈ GIỮA VÒNG
// =============================================================================
function TurnIntroOverlay({ state: s }: { state: GameState }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[var(--cream)]/85 anim-fade pointer-events-none">
      <div
        key={`${s.round}-${s.turn}`}
        className="card anim-pop flex flex-col items-center gap-2 px-10 sm:px-16 py-5 sm:py-7"
        style={{ ['--c' as string]: 'var(--sky)', ['--cs' as string]: 'var(--sky-dark)' }}
      >
        <span className="chip text-xl" style={{ ['--c' as string]: s.round === 1 ? 'var(--sky)' : 'var(--grape)' }}>
          VÒNG {s.round}: {s.round === 1 ? 'bạn thứ nhất' : 'bạn thứ hai'}
        </span>
        <span className="title text-[var(--sky)]" style={{ fontSize: 'clamp(4rem, 16vh, 9rem)' }}>LƯỢT {s.turn}</span>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((t) => (
            <span key={t} className="w-5 h-5 rounded-full" style={{ background: t < s.turn ? 'var(--win)' : t === s.turn ? 'var(--sky)' : '#e9dfcc' }} />
          ))}
        </div>
        <span className="text-2xl font-extrabold text-[var(--ink-soft)]">Còn {s.maxTurnsPerRound - s.turn + 1} lượt trong vòng này</span>
      </div>
    </div>
  );
}

function RoundGapOverlay({ state: s, onStart }: { state: GameState; onStart: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[var(--cream)]/90 p-4 anim-fade">
      <div className="card anim-pop flex flex-col items-center gap-3 px-6 sm:px-12 py-6 max-w-xl w-full text-center" style={{ ['--c' as string]: 'var(--grape)', ['--cs' as string]: 'var(--grape-dark)' }}>
        <span className="text-5xl">🔄</span>
        <span className="title text-[var(--grape)]" style={{ fontSize: 'clamp(2.6rem, 9vh, 4.4rem)' }}>HẾT VÒNG 1!</span>
        <div className="flex gap-3 text-xl font-extrabold">
          <span className="chip" style={{ ['--c' as string]: 'var(--win)' }}>Thắng {s.round1Wins}</span>
          <span className="chip" style={{ ['--c' as string]: 'var(--draw)' }}>Hòa {s.round1Draws}</span>
          <span className="chip" style={{ ['--c' as string]: 'var(--lose)' }}>Thua {s.round1Losses}</span>
        </div>
        <span className="text-2xl font-extrabold">
          {s.inputMode === 'camera' ? 'Đổi chỗ! Mời bạn thứ hai giơ tay trước camera.' : 'Đổi chỗ! Mời bạn thứ hai vào bấm chọn.'}
        </span>
        <button type="button" className="btn btn-grape text-2xl px-8 min-h-[64px]" onClick={onStart}>
          Bạn thứ hai sẵn sàng ▶
        </button>
        <span className="text-base text-[var(--ink-soft)]">Tự bắt đầu sau {Math.ceil(s.phaseRemaining)} giây</span>
      </div>
    </div>
  );
}
