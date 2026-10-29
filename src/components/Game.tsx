import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { AIDifficulty } from '../ai';
import { BRAND_MASCOTS } from '../data/brand';
import { PlayerProfile } from '../data/characters';
import { ALL_RPS_CHOICES, BOT_IMAGES, HAND_WAITING_IMAGE, RPSChoice, RPS_CHOICES } from '../data/rps';
import { audio } from '../utils/audio';
import { GameEngine, GamePhase, GameState, InputMode } from '../utils/engine';
import { LandmarkPoint } from '../utils/gesture';
import { CharacterAvatar, getCharacterById } from './PlayerSetupModal';

const MAX_CANVAS_PIXEL_RATIO = 1.5;
const MAX_FRAME_DELTA_MS = 50;
const HAND_DETECT_INTERVAL_MS = 33; // ~30 lần/giây là đủ, đỡ nóng máy tính bảng
const UI_PUBLISH_INTERVAL_MS = 50;

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

interface GameProps {
  profile: PlayerProfile;
  difficulty?: AIDifficulty;
  onGameOver: (state: GameState) => void;
  onStateUpdate: (state: GameState) => void;
}

export function Game({ profile, difficulty = 'normal', onGameOver, onStateUpdate }: GameProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fxCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const rafRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const lastDetectRef = useRef(0);
  const isProcessingRef = useRef(false); // cờ chống chồng khung nhận diện
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
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
      video.pause();
    }
    try {
      landmarkerRef.current?.close();
    } catch {
      // bỏ qua
    }
    landmarkerRef.current = null;
  }, []);

  // ---------------------------------------------------------------------------
  // Vòng lặp khung hình: nhận diện tay, cập nhật engine, vẽ hiệu ứng
  // ---------------------------------------------------------------------------
  const runLoop = useCallback(() => {
    let last = performance.now();
    let lastPublish = -Infinity;
    let lastPhase: GamePhase | null = null;
    let lastWord = '';

    const detect = (engine: GameEngine) => {
      const video = videoRef.current;
      const lm = landmarkerRef.current;
      if (!video || !lm || video.readyState < 2) return;
      const now = performance.now();
      if (isProcessingRef.current) return;
      if (now - lastDetectRef.current < HAND_DETECT_INTERVAL_MS || video.currentTime === lastVideoTimeRef.current) return;
      lastDetectRef.current = now;
      isProcessingRef.current = true;
      lastVideoTimeRef.current = video.currentTime;
      let hand: LandmarkPoint[] | null = null;
      try {
        const res = lm.detectForVideo(video, now);
        const first = res?.landmarks?.[0];
        if (first) {
          const vw = video.videoWidth || 640;
          const vh = video.videoHeight || 480;
          hand = first.map((p) => ({ x: (1 - p.x) * vw, y: p.y * vh, z: p.z }));
        }
      } catch {
        return;
      } finally {
        isProcessingRef.current = false;
      }
      engine.updateHand(hand, video.videoWidth || 640, video.videoHeight || 480);
    };

    const frame = (t: number) => {
      if (finishedRef.current) return;
      const engine = engineRef.current;
      const canvas = fxCanvasRef.current;
      const box = containerRef.current;
      if (!engine || !canvas || !box) return;

      const dt = Math.max(0, Math.min(MAX_FRAME_DELTA_MS, t - last));
      last = t;

      if (engine.getState().inputMode === 'camera') detect(engine);
      engine.update(dt);

      const w = Math.max(1, box.clientWidth);
      const h = Math.max(1, box.clientHeight);
      const pr = Math.min(MAX_CANVAS_PIXEL_RATIO, window.devicePixelRatio || 1);
      if (canvas.width !== Math.floor(w * pr) || canvas.height !== Math.floor(h * pr)) {
        canvas.width = Math.floor(w * pr);
        canvas.height = Math.floor(h * pr);
        engine.resize(w, h);
      }
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(pr, 0, 0, pr, 0, 0);
        engine.draw(ctx);
      }

      const pv = previewCanvasRef.current;
      if (pv) {
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

      const s = engine.getState();
      if (s.phase !== lastPhase || s.chantWord !== lastWord || t - lastPublish >= UI_PUBLISH_INTERVAL_MS) {
        lastPhase = s.phase;
        lastWord = s.chantWord;
        lastPublish = t;
        setState(s);
        onStateUpdateRef.current(s);
      }
      if (s.isGameOver && !finishedRef.current) {
        finishedRef.current = true;
        stopCamera();
        onGameOverRef.current(s);
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

  // Mở camera và nạp mô hình nhận diện tay
  useEffect(() => {
    let active = true;
    finishedRef.current = false;
    audio.init();

    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        if (!active) return;
        const opts = (delegate: 'GPU' | 'CPU') => ({
          baseOptions: { modelAssetPath: MODEL_URL, delegate },
          runningMode: 'VIDEO' as const,
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        let lm: HandLandmarker;
        try {
          lm = await HandLandmarker.createFromOptions(vision, opts('GPU'));
        } catch {
          lm = await HandLandmarker.createFromOptions(vision, opts('CPU'));
        }
        if (!active || engineRef.current) {
          lm.close();
          return;
        }
        landmarkerRef.current = lm;

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        }
        if (!active || engineRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          if (!active) return;
          video.play().catch(() => undefined);
          startEngine('camera');
        };
      } catch (err) {
        console.warn('Không mở được camera, chuyển sang nút bấm:', err);
        if (!active) return;
        setCameraError('Không mở được camera. Em chơi bằng nút bấm nhé!');
        switchToButtons();
      }
    };
    init();

    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
      stopCamera();
    };
  }, [startEngine, stopCamera, switchToButtons]);

  const char = getCharacterById(profile.characterId);
  const s = state;
  const phase = s?.phase ?? 'TURN_INTRO';
  const mode = s?.inputMode ?? 'camera';

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
        <div className="absolute inset-0 flex flex-col gap-2 sm:gap-3 p-2 sm:p-4">
          <PhaseSteps phase={phase} />

          <div className="flex-1 min-h-0 grid grid-cols-2 sm:grid-cols-[1fr_minmax(230px,0.9fr)_1fr] gap-2 sm:gap-4 items-stretch">
            <PlayerCard state={s} char={char} name={profile.groupName} previewRef={previewCanvasRef} />
            <div className="col-span-2 sm:col-span-1 order-first sm:order-none flex flex-col items-center justify-center text-center min-h-0">
              <CenterStage state={s} onNext={() => engineRef.current?.skipReveal()} />
            </div>
            <BotCard state={s} />
          </div>

          <BottomBar
            mode={mode}
            phase={phase}
            liveGesture={s.liveGesture}
            onChoose={(c) => engineRef.current?.chooseByButton(c)}
            onSwitchToButtons={switchToButtons}
          />
        </div>
      )}

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
          <img className="w-32 h-32 object-contain anim-bob" src={BRAND_MASCOTS.cameraLoadingAnimated} alt="" />
          <p className="title text-3xl sm:text-4xl">Đang mở camera...</p>
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
  { icon: '✋', label: 'Giơ tay' },
  { icon: '🎵', label: 'Oẳn tù xì' },
  { icon: '🔒', label: 'Chốt tay' },
  { icon: '🏆', label: 'Kết quả' },
];

function stepIndex(phase: GamePhase): number {
  if (phase === 'CHANT' || phase === 'SHOW') return 1;
  if (phase === 'LOCKED' || phase === 'RETRY') return 2;
  if (phase === 'REVEAL') return 3;
  return 0;
}

function PhaseSteps({ phase }: { phase: GamePhase }) {
  const cur = stepIndex(phase);
  return (
    <div className="hidden sm:flex items-center justify-center gap-1.5 shrink-0">
      {STEPS.map((st, i) => {
        const done = i < cur;
        const active = i === cur;
        const bad = active && phase === 'RETRY';
        const bg = bad ? 'var(--lose)' : active ? 'var(--sky)' : done ? 'var(--win)' : '#fff';
        return (
          <div key={st.label} className="flex items-center gap-1.5">
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 lg:px-4 py-1 font-extrabold transition-all ${
                active ? 'text-white text-lg lg:text-xl scale-105' : done ? 'text-white text-base' : 'text-[var(--ink-soft)] text-base border-[3px] border-[var(--line)]'
              }`}
              style={{ background: bg, boxShadow: active ? '0 4px 0 rgba(0,0,0,.18)' : undefined }}
            >
              <span className="w-6 h-6 rounded-full bg-white/25 flex items-center justify-center text-sm">{done ? '✓' : i + 1}</span>
              <span>{st.icon}</span>
              <span>{st.label}</span>
            </div>
            {i < STEPS.length - 1 && <span className={`text-xl font-extrabold ${i < cur ? 'text-[var(--win)]' : 'text-[var(--line)]'}`}>›</span>}
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// THẺ NGƯỜI CHƠI
// =============================================================================
function PlayerCard({
  state: s,
  char,
  name,
  previewRef,
}: {
  state: GameState;
  char: ReturnType<typeof getCharacterById>;
  name: string;
  previewRef: RefObject<HTMLCanvasElement | null>;
}) {
  const locked = (s.phase === 'LOCKED' || s.phase === 'REVEAL') && s.playerChoice;
  const camera = s.inputMode === 'camera';
  const live = s.liveGesture;

  let img = HAND_WAITING_IMAGE;
  let imgClass = 'anim-bob';
  let caption = 'Chuẩn bị nhé!';
  let color = 'var(--sky)';

  if (locked) {
    img = RPS_CHOICES[s.playerChoice!].image;
    imgClass = s.phase === 'LOCKED' ? 'anim-pop' : '';
    caption = RPS_CHOICES[s.playerChoice!].vietnameseName;
    color = RPS_CHOICES[s.playerChoice!].color;
  } else if (s.phase === 'WAIT_HAND') {
    caption = 'Giơ 1 bàn tay lên';
  } else if (s.phase === 'CHANT') {
    if (camera || !live) {
      img = RPS_CHOICES.rock.image;
      imgClass = 'anim-wiggle';
      caption = camera ? 'Lắc nắm tay theo nhịp' : 'Bấm chọn tay ở dưới';
    } else {
      img = RPS_CHOICES[live].image;
      imgClass = '';
      caption = `Em chọn ${RPS_CHOICES[live].label}`;
      color = RPS_CHOICES[live].color;
    }
  } else if (s.phase === 'SHOW') {
    if (live) {
      img = RPS_CHOICES[live].image;
      imgClass = '';
      caption = RPS_CHOICES[live].vietnameseName;
      color = RPS_CHOICES[live].color;
    } else {
      caption = camera ? 'Ra tay đi em!' : 'Bấm chọn nhanh!';
    }
  } else if (s.phase === 'RETRY') {
    caption = 'Chưa chốt được';
    color = 'var(--lose)';
  }

  return (
    <div className="card relative flex flex-col min-h-0 overflow-hidden" style={{ ['--c' as string]: color, ['--cs' as string]: color }}>
      <div className="flex items-center gap-2 px-3 pt-2 shrink-0">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[var(--sky-soft)] p-0.5 shrink-0">
          <CharacterAvatar character={char} />
        </div>
        <div className="flex flex-col min-w-0 leading-tight">
          <span className="chip text-sm w-max" style={{ ['--c' as string]: 'var(--sky)' }}>BẠN</span>
          <span className="font-extrabold text-base sm:text-lg truncate">{name}</span>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 flex flex-col items-center justify-center px-2">
        <img
          key={`${img}-${imgClass}`}
          src={img}
          alt={caption}
          className={`h-[54%] max-h-60 w-auto object-contain drop-shadow-[0_10px_0_rgba(35,51,92,0.12)] ${imgClass}`}
        />
        {locked && (
          <span className="chip text-base sm:text-lg mt-1 anim-stamp" style={{ ['--c' as string]: 'var(--ink)' }}>
            🔒 ĐÃ CHỐT
          </span>
        )}
        <span
          className={`title mt-1 text-center ${caption.length > 9 ? 'text-xl sm:text-2xl lg:text-3xl' : 'text-2xl sm:text-3xl lg:text-4xl'}`}
          style={{ color }}
        >
          {caption}
        </span>
        {s.phase === 'SHOW' && (
          <span className="mt-1 text-lg font-extrabold text-[var(--ink-soft)]">Giữ yên tay nhé!</span>
        )}
      </div>

      {camera && (
        <div className="absolute right-2 top-2 w-[34%] max-w-40 rounded-2xl overflow-hidden border-[3px] border-[var(--sky)] bg-white">
          <canvas ref={previewRef} className="block w-full aspect-[4/3]" />
          <div className="text-center text-xs sm:text-sm font-extrabold py-0.5 bg-[var(--sky)] text-white truncate px-1">
            {locked
              ? `🔒 Chốt: ${RPS_CHOICES[s.playerChoice!].label}`
              : s.handVisible
              ? `👀 Thấy: ${live ? RPS_CHOICES[live].label : '...'}`
              : 'Chưa thấy tay'}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// THẺ MÁY
// =============================================================================
function BotCard({ state: s }: { state: GameState }) {
  const revealed = s.phase === 'REVEAL' && s.aiChoice;
  const face = revealed
    ? s.lastResult === 'win'
      ? BOT_IMAGES.lose
      : s.lastResult === 'lose'
      ? BOT_IMAGES.win
      : BOT_IMAGES.draw
    : s.phase === 'CHANT' || s.phase === 'SHOW'
    ? BOT_IMAGES.shuffle
    : BOT_IMAGES.wait;
  const color = revealed ? RPS_CHOICES[s.aiChoice!].color : 'var(--grape)';

  return (
    <div className="card relative flex flex-col min-h-0 overflow-hidden" style={{ ['--c' as string]: color, ['--cs' as string]: color }}>
      <div className="flex items-center justify-end gap-2 px-3 pt-2 shrink-0">
        <div className="flex flex-col items-end leading-tight">
          <span className="chip text-sm" style={{ ['--c' as string]: 'var(--grape)' }}>MÁY</span>
          <span className="font-extrabold text-base sm:text-lg">
            {s.difficulty === 'easy' ? 'Mức dễ' : s.difficulty === 'hard' ? 'Mức khó' : 'Mức vừa'}
          </span>
        </div>
        <img key={face} src={face} alt="" className="w-12 h-14 sm:w-14 sm:h-16 object-contain anim-pop" />
      </div>

      <div className="relative flex-1 min-h-0 flex flex-col items-center justify-center px-2">
        {revealed ? (
          <>
            <img
              key={`ai-${s.round}-${s.turn}`}
              src={RPS_CHOICES[s.aiChoice!].image}
              alt={RPS_CHOICES[s.aiChoice!].label}
              className="h-[54%] max-h-60 w-auto object-contain anim-flip -scale-x-100"
            />
            <span className="title text-2xl sm:text-3xl lg:text-4xl mt-1" style={{ color }}>
              {RPS_CHOICES[s.aiChoice!].vietnameseName}
            </span>
          </>
        ) : (
          <>
            <div
              className={`relative h-[54%] max-h-60 aspect-[3/4] rounded-3xl bg-[var(--grape)] flex items-center justify-center shadow-[0_8px_0_var(--grape-dark)] ${
                s.phase === 'CHANT' || s.phase === 'SHOW' ? 'anim-shake' : ''
              }`}
            >
              <div className="absolute inset-3 rounded-2xl border-4 border-dashed border-white/50" />
              <span className="title text-white text-7xl sm:text-8xl">?</span>
            </div>
            <span className="mt-2 text-lg sm:text-xl font-extrabold text-[var(--grape)] text-center leading-tight">
              Máy đã chọn xong
              <br />
              <span className="text-[var(--ink-soft)] text-base">và úp bài, không nhìn trộm</span>
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// GIỮA SÂN: NHỊP HÔ, CHỐT, KẾT QUẢ
// =============================================================================
const BEATS = ['OẲN', 'TÙ', 'XÌ', 'CHỐT'] as const;

function BeatTrack({ state: s }: { state: GameState }) {
  const idx =
    s.phase === 'CHANT' ? (s.chantWord === 'OẲN' ? 0 : 1) : s.phase === 'SHOW' ? 2 : s.phase === 'LOCKED' || s.phase === 'REVEAL' ? 3 : -1;
  const colors = ['var(--rock)', 'var(--sky)', 'var(--lose)', 'var(--ink)'];
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-1.5">
      {BEATS.map((b, i) => (
        <div key={b} className="flex items-center gap-1 sm:gap-1.5">
          <div
            className={`relative rounded-full flex items-center justify-center font-extrabold text-white transition-all ${
              i === idx ? 'w-14 h-14 sm:w-16 sm:h-16 text-base sm:text-lg' : 'w-11 h-11 sm:w-12 sm:h-12 text-xs sm:text-sm'
            }`}
            style={{ background: i <= idx ? colors[i] : '#e9dfcc', boxShadow: i === idx ? '0 4px 0 rgba(0,0,0,.2)' : undefined }}
          >
            {i === 3 ? '🔒' : b}
            {i === 2 && s.phase === 'SHOW' && (
              <svg className="absolute -inset-1.5 w-[calc(100%+12px)] h-[calc(100%+12px)] -rotate-90" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="18" fill="none" stroke="var(--lose)" strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={113} strokeDashoffset={113 * s.phaseProgress} />
              </svg>
            )}
          </div>
          {i < 3 && <span className="w-3 sm:w-5 h-1.5 rounded-full" style={{ background: i < idx ? colors[i + 1] : '#e9dfcc' }} />}
        </div>
      ))}
    </div>
  );
}

function CenterStage({ state: s, onNext }: { state: GameState; onNext: () => void }) {
  const big = 'title outline-text text-[clamp(3.6rem,9vw,8rem)]';

  if (s.phase === 'WAIT_HAND') {
    return (
      <div className="flex flex-col items-center gap-2 anim-fade">
        <span className="text-[clamp(3rem,7vw,6rem)] anim-bob">✋</span>
        <span className="title text-[clamp(1.8rem,3.4vw,3rem)] text-[var(--sky)]">Giơ tay lên nào!</span>
        <span className="text-lg sm:text-xl text-[var(--ink-soft)] max-w-xs">Đưa 1 bàn tay vào trước camera, cách khoảng 1 gang tay đến 1 cánh tay.</span>
      </div>
    );
  }

  if (s.phase === 'CHANT' || s.phase === 'SHOW') {
    const word = s.chantWord === 'XÌ' ? 'XÌ!' : s.chantWord;
    const color = s.chantWord === 'OẲN' ? 'var(--rock)' : s.chantWord === 'TÙ' ? 'var(--sky)' : 'var(--lose)';
    return (
      <div className="flex flex-col items-center gap-2 sm:gap-3">
        <span key={word} className={`${big} anim-beat`} style={{ color }}>
          {word}
        </span>
        <span className="text-xl sm:text-2xl font-extrabold text-[var(--ink)]">
          {s.phase === 'SHOW' ? (s.inputMode === 'camera' ? 'Ra tay và giữ yên!' : 'Bấm chọn ngay!') : 'Cùng hô theo nhịp'}
        </span>
        <BeatTrack state={s} />
        {s.phase === 'SHOW' && (
          <div className="w-48 sm:w-60">
            <div className="timebar" style={{ ['--c' as string]: 'var(--lose)' }}>
              <i style={{ width: `${(1 - s.phaseProgress) * 100}%` }} />
            </div>
            <span className="text-sm font-bold text-[var(--ink-soft)]">Hết thanh đỏ là máy chốt</span>
          </div>
        )}
      </div>
    );
  }

  if (s.phase === 'LOCKED') {
    return (
      <div className="flex flex-col items-center gap-3">
        <span className={`${big} anim-stamp text-[var(--ink)]`}>CHỐT!</span>
        <span className="text-xl sm:text-2xl font-extrabold">Máy đã khóa tay của em 🔒</span>
        <BeatTrack state={s} />
        <span className="text-lg font-bold text-[var(--grape)]">Chuẩn bị lật bài của máy...</span>
      </div>
    );
  }

  if (s.phase === 'REVEAL') {
    const c = s.lastResult === 'win' ? 'var(--win)' : s.lastResult === 'lose' ? 'var(--lose)' : 'var(--draw)';
    const icon = s.lastResult === 'win' ? '🎉' : s.lastResult === 'lose' ? '🤖' : '🤝';
    const nextLabel = s.turn < s.maxTurnsPerRound ? `Lượt ${s.turn + 1}` : s.round === 1 ? 'Hết vòng 1' : 'Xem tổng kết';
    return (
      <div className="flex flex-col items-center gap-2 sm:gap-3 w-full max-w-sm">
        <span className="text-5xl sm:text-6xl anim-pop">{icon}</span>
        <span className="chip title text-[clamp(1.8rem,3.6vw,3.2rem)] px-6 py-1 anim-pop" style={{ ['--c' as string]: c, boxShadow: '0 6px 0 rgba(0,0,0,.18)' }}>
          {s.resultMessage}
        </span>
        <span className="title text-[clamp(1.5rem,2.6vw,2.4rem)] anim-slide-up">{s.resultDetail}</span>
        <span className="text-xl font-extrabold anim-slide-up" style={{ color: s.lastScoreGain ? 'var(--win)' : 'var(--ink-soft)' }}>
          {s.lastScoreGain ? `+${s.lastScoreGain} điểm ⭐` : 'Không có điểm'}
        </span>
        <div className="w-full px-4">
          <div className="timebar" style={{ ['--c' as string]: 'var(--sky)' }}>
            <i style={{ width: `${s.phaseProgress * 100}%` }} />
          </div>
        </div>
        <button type="button" className="btn btn-sm" onClick={onNext}>
          {nextLabel} ▶
        </button>
      </div>
    );
  }

  if (s.phase === 'RETRY') {
    return (
      <div className="flex flex-col items-center gap-2 anim-pop">
        <span className="text-6xl">🙈</span>
        <span className="title text-[clamp(1.8rem,3.4vw,3rem)] text-[var(--lose)]">Chơi lại lượt này</span>
        <span className="text-xl font-bold max-w-xs">{s.retryReason}</span>
        <span className="text-lg text-[var(--ink-soft)] max-w-xs">Lần này nhớ ra tay đúng lúc <b>XÌ</b> và giữ yên nhé!</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xl font-extrabold text-[var(--ink-soft)]">Vòng {s.round}</span>
      <span className="title text-[clamp(3rem,7vw,6rem)] text-[var(--sky)]">Lượt {s.turn}</span>
    </div>
  );
}

// =============================================================================
// THANH DƯỚI: LUẬT CHƠI HOẶC NÚT BẤM
// =============================================================================
function BottomBar({
  mode,
  phase,
  liveGesture,
  onChoose,
  onSwitchToButtons,
}: {
  mode: InputMode;
  phase: GamePhase;
  liveGesture: RPSChoice | null;
  onChoose: (c: RPSChoice) => void;
  onSwitchToButtons: () => void;
}) {
  if (mode === 'buttons') {
    const open = phase === 'CHANT' || phase === 'SHOW';
    return (
      <div className="shrink-0 flex flex-col items-center gap-1">
        <span className="text-base sm:text-lg font-extrabold text-[var(--ink-soft)]">
          {open ? 'Bấm chọn trước khi máy CHỐT' : 'Nút sẽ mở khi bắt đầu hô'}
        </span>
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          {ALL_RPS_CHOICES.map((c) => {
            const d = RPS_CHOICES[c];
            const picked = liveGesture === c && open;
            return (
              <button
                key={c}
                type="button"
                disabled={!open}
                onClick={() => onChoose(c)}
                className={`btn min-h-0 py-1 px-4 sm:px-6 ${picked ? 'ring-4 ring-[var(--ink)] scale-105' : ''} ${open ? '' : 'opacity-50 cursor-not-allowed'}`}
                style={{ ['--c' as string]: d.color, ['--cs' as string]: 'rgba(0,0,0,.25)' }}
              >
                <img src={d.image} alt="" className="w-10 h-10 sm:w-14 sm:h-14 object-contain" />
                <span className="text-xl sm:text-2xl">{d.vietnameseName}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="shrink-0 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      {ALL_RPS_CHOICES.map((c) => {
        const d = RPS_CHOICES[c];
        const loser = RPS_CHOICES[d.beats];
        return (
          <div key={c} className="flex items-center gap-1 bg-white rounded-full pl-1 pr-3 py-0.5 border-[3px]" style={{ borderColor: d.color }}>
            <img src={d.image} alt="" className="w-8 h-8 object-contain" />
            <span className="font-extrabold text-base sm:text-lg" style={{ color: d.color }}>{d.label}</span>
            <span className="font-bold text-base sm:text-lg text-[var(--ink-soft)]">{d.verb}</span>
            <img src={loser.image} alt="" className="w-7 h-7 object-contain" />
            <span className="font-extrabold text-base sm:text-lg" style={{ color: loser.color }}>{loser.label}</span>
          </div>
        );
      })}
      <button type="button" className="btn btn-white btn-sm" onClick={onSwitchToButtons}>
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
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[var(--cream)]/80 anim-fade pointer-events-none">
      <div
        key={`${s.round}-${s.turn}`}
        className="card anim-pop flex flex-col items-center gap-2 px-10 sm:px-16 py-5 sm:py-7"
        style={{ ['--c' as string]: 'var(--sky)', ['--cs' as string]: 'var(--sky-dark)' }}
      >
        <span className="chip text-lg sm:text-xl" style={{ ['--c' as string]: s.round === 1 ? 'var(--sky)' : 'var(--grape)' }}>
          VÒNG {s.round} {s.round === 1 ? '· Bạn thứ nhất' : '· Bạn thứ hai'}
        </span>
        <span className="title text-[clamp(4rem,10vw,8rem)] text-[var(--sky)]">LƯỢT {s.turn}</span>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((t) => (
            <span
              key={t}
              className="w-5 h-5 rounded-full"
              style={{ background: t < s.turn ? 'var(--win)' : t === s.turn ? 'var(--sky)' : '#e9dfcc' }}
            />
          ))}
        </div>
        <span className="text-xl sm:text-2xl font-extrabold text-[var(--ink-soft)]">Còn {s.maxTurnsPerRound - s.turn + 1} lượt trong vòng này</span>
      </div>
    </div>
  );
}

function RoundGapOverlay({ state: s, onStart }: { state: GameState; onStart: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[var(--cream)]/90 p-4 anim-fade">
      <div className="card anim-pop flex flex-col items-center gap-3 px-6 sm:px-12 py-6 max-w-xl w-full text-center" style={{ ['--c' as string]: 'var(--grape)', ['--cs' as string]: 'var(--grape-dark)' }}>
        <span className="text-5xl">🔄</span>
        <span className="title text-[clamp(2.4rem,5vw,4rem)] text-[var(--grape)]">HẾT VÒNG 1!</span>
        <div className="flex gap-3 text-lg sm:text-xl font-extrabold">
          <span className="chip" style={{ ['--c' as string]: 'var(--win)' }}>Thắng {s.round1Wins}</span>
          <span className="chip" style={{ ['--c' as string]: 'var(--draw)' }}>Hòa {s.round1Draws}</span>
          <span className="chip" style={{ ['--c' as string]: 'var(--lose)' }}>Thua {s.round1Losses}</span>
        </div>
        <span className="text-xl sm:text-2xl font-extrabold">
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
