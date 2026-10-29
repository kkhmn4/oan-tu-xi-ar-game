// Engine chính cho game AR Oẳn Tù Xì
//
// Mỗi lượt đi theo một chiều, học sinh nhìn màn hình là biết đang ở bước nào:
//
//   TURN_INTRO  "Lượt 3"                                      1,4 s
//   WAIT_HAND   chờ thấy bàn tay trước camera                  (đến khi thấy tay)
//   CHOOSE      RA TAY: giữ yên Búa, Kéo hoặc Bao              giữ đủ 0,8 s là chốt
//               (chơi bằng nút: bấm một nút là chốt)
//   LOCKED      CHỐT! khóa lựa chọn của người chơi             0,9 s
//   CHANT       lắc tay qua lại (hướng nào cũng được) cho vòng quanh tay đầy dần:
//               đầy 1/3 hô OẲN, 2/3 hô TÙ, đầy hết hô XÌ (chơi bằng nút: vòng tự đầy trong 2,1 s).
//               Ngừng lắc 1,6 s thì nhắc "Lắc tay để tiếp tục".
//   SHOW        XÌ! máy mở thẻ                                 0,6 s
//   REVEAL      thẻ của máy đã mở, báo thắng thua              3,4 s  (bấm "Lượt tiếp" để đi nhanh)
//
// Hết lượt 5 của vòng 1 vào ROUND_GAP: đổi bạn, bấm nút để vào vòng 2.
import { AdaptiveRPSAI, AIDifficulty, AIPostMatchInsight, ProbabilityDistribution } from '../ai';
import { evaluateRPS, RPSChoice, RPSResult, RPS_CHOICES } from '../data/rps';
import { audio } from './audio';
import { LITE } from './device';
import { detectRPSGesture, HAND_CONNECTIONS, LandmarkPoint } from './gesture';

export type GamePhase =
  | 'TURN_INTRO'
  | 'WAIT_HAND'
  | 'CHOOSE'
  | 'LOCKED'
  | 'CHANT'
  | 'SHOW'
  | 'REVEAL'
  | 'ROUND_GAP'
  | 'GAMEOVER';

export type InputMode = 'camera' | 'buttons';

export const TIMING = {
  turnIntro: 1.4,
  holdToLock: 0.8, // giữ yên một thế tay chừng này giây thì máy chốt
  holdGrace: 0.25, // mất dấu tay trong khoảng ngắn này thì chưa tính là đổi tay
  locked: 0.9,
  chantBeat: 0.7, // nhịp hô tự động khi chơi bằng nút
  show: 0.6,
  reveal: 3.4,
  roundGapAuto: 20,
  handStableMs: 300,
  shakeIdle: 1.6, // ngừng lắc quá lâu thì hiện lời nhắc
  shakeTravel: 4, // tay đi tổng cộng chừng này lần chiều dài lòng bàn tay thì vòng đầy (khoảng 3 lần lắc)
  shakeNoise: 0.03, // dịch chuyển nhỏ hơn mức này mỗi lần đo là tay rung, không tính
  shakeJump: 0.6, // nhảy xa hơn mức này mỗi lần đo là nhận diện bị giật, không tính
};

export interface TurnHistoryItem {
  round: 1 | 2;
  turn: number;
  playerChoice: RPSChoice;
  aiChoice: RPSChoice;
  result: RPSResult;
  scoreGain: number;
}

export interface GameState {
  phase: GamePhase;
  phaseProgress: number; // 0..1 của pha hiện tại (dùng cho thanh thời gian)
  phaseRemaining: number; // giây còn lại của pha hiện tại
  round: 1 | 2;
  turn: number; // 1 -> 5 trong mỗi vòng
  maxTurnsPerRound: number;
  score: number;
  streak: number;
  bestStreak: number;
  round1Wins: number;
  round1Losses: number;
  round1Draws: number;
  round2Wins: number;
  round2Losses: number;
  round2Draws: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  chantWord: 'OẲN' | 'TÙ' | 'XÌ' | '';
  beat: number; // số tiếng đã hô trong lượt (0..3): OẲN, TÙ, XÌ
  shakeProgress: number; // 0..1: vòng lắc tay đầy tới đâu
  needShake: boolean; // đang chờ lắc quá lâu: hiện "Lắc tay để tiếp tục"
  holdProgress: number; // 0..1: giữ yên thế tay bao lâu rồi (lúc RA TAY)
  inputMode: InputMode;
  liveGesture: RPSChoice | null; // thế tay máy đang thấy (chưa chốt)
  handVisible: boolean;
  playerChoice: RPSChoice | null; // thế tay đã chốt
  aiChoice: RPSChoice | null; // chỉ có giá trị từ REVEAL trở đi
  lastResult: RPSResult | null;
  lastScoreGain: number;
  resultMessage: string;
  resultDetail: string;
  isGameOver: boolean;
  isWin: boolean;
  history: TurnHistoryItem[];
  difficulty: AIDifficulty;
  predictedPlayerProbabilities?: ProbabilityDistribution;
  aiInsight?: AIPostMatchInsight;
}

export function createInitialState(difficulty: AIDifficulty = 'normal', inputMode: InputMode = 'camera'): GameState {
  return {
    phase: 'TURN_INTRO',
    phaseProgress: 0,
    phaseRemaining: TIMING.turnIntro,
    round: 1,
    turn: 1,
    maxTurnsPerRound: 5,
    score: 0,
    streak: 0,
    bestStreak: 0,
    round1Wins: 0,
    round1Losses: 0,
    round1Draws: 0,
    round2Wins: 0,
    round2Losses: 0,
    round2Draws: 0,
    totalWins: 0,
    totalLosses: 0,
    totalDraws: 0,
    chantWord: '',
    beat: 0,
    shakeProgress: 0,
    needShake: false,
    holdProgress: 0,
    inputMode,
    liveGesture: null,
    handVisible: false,
    playerChoice: null,
    aiChoice: null,
    lastResult: null,
    lastScoreGain: 0,
    resultMessage: '',
    resultDetail: '',
    isGameOver: false,
    isWin: false,
    history: [],
    difficulty,
  };
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  color: string;
  size: number;
  alpha: number;
}

interface Pt {
  x: number;
  y: number;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export class GameEngine {
  private width = 960;
  private height = 540;
  private onStateChange: (state: GameState) => void;
  private adaptiveAI: AdaptiveRPSAI;
  private pendingAIChoice: RPSChoice = 'rock';
  private state: GameState;

  private landmarks: LandmarkPoint[] | null = null; // tọa độ pixel trong khung video (đã lật gương)
  private videoW = 640;
  private videoH = 480;
  private phaseTime = 0;
  private handSeenMs = 0;
  private clock = 0;
  // Giữ yên thế tay để chốt
  private holdGesture: RPSChoice | null = null;
  private holdTime = 0;
  private missTime = 0;
  // Bộ đo lắc tay: cộng dồn quãng đường tâm bàn tay đi được, hướng nào cũng được
  private shakePos: Pt | null = null;
  private lastShakeGainAt = 0;
  private previewDirty = true;
  private particles: Particle[] = [];
  private rings: Array<{ x: number; y: number; r: number; color: string; age: number }> = [];

  constructor(onStateChange: (state: GameState) => void, difficulty: AIDifficulty = 'normal', inputMode: InputMode = 'camera') {
    this.onStateChange = onStateChange;
    this.state = createInitialState(difficulty, inputMode);
    this.adaptiveAI = new AdaptiveRPSAI({ difficulty, maxTurns: 10 });
    this.startTurn();
  }

  resize(w: number, h: number) {
    this.width = w;
    this.height = h;
  }

  getState(): GameState {
    return { ...this.state, history: [...this.state.history] };
  }

  /** Đọc trạng thái hiện tại không sao chép (chỉ đọc), dùng trong vòng lặp khung hình. */
  peek(): Readonly<GameState> {
    return this.state;
  }

  hasVFX(): boolean {
    return this.particles.length > 0 || this.rings.length > 0;
  }

  /** Ô camera nhỏ cần vẽ lại không (có tay mới hoặc đổi pha). Gọi xong thì xóa cờ. */
  takePreviewDirty(): boolean {
    const d = this.previewDirty;
    this.previewDirty = false;
    return d;
  }

  getOverallTurnNumber(): number {
    return this.state.round === 1 ? this.state.turn : 5 + this.state.turn;
  }

  // ---------------------------------------------------------------------------
  // ĐẦU VÀO
  // ---------------------------------------------------------------------------

  /** Tay từ MediaPipe, tọa độ pixel trong khung video đã lật gương. */
  updateHand(landmarks: LandmarkPoint[] | null, videoW: number, videoH: number) {
    this.videoW = videoW;
    this.videoH = videoH;
    const hasHand = !!(landmarks && landmarks.length >= 21);
    this.previewDirty = true;
    this.landmarks = hasHand ? landmarks : null;
    this.state.handVisible = hasHand;
    this.state.liveGesture = hasHand ? detectRPSGesture(landmarks!).choice : null;
    if (hasHand) this.trackShake(landmarks!);
    else this.resetShake();
  }

  private resetShake() {
    this.shakePos = null;
  }

  /** Lắc tay: quãng đường tâm bàn tay đi được (tính theo chiều dài lòng bàn tay) làm vòng đầy dần. */
  private trackShake(lm: LandmarkPoint[]) {
    const palm = Math.hypot(lm[9].x - lm[0].x, lm[9].y - lm[0].y) || 1;
    const raw = { x: (lm[0].x + lm[9].x) / 2, y: (lm[0].y + lm[9].y) / 2 };
    const prev = this.shakePos;
    const p = prev ? { x: prev.x * 0.35 + raw.x * 0.65, y: prev.y * 0.35 + raw.y * 0.65 } : raw;
    this.shakePos = p;
    if (!prev || this.state.phase !== 'CHANT' || this.state.inputMode !== 'camera') return;
    const d = dist(p, prev) / palm;
    if (d < TIMING.shakeNoise || d > TIMING.shakeJump) return;
    this.lastShakeGainAt = this.clock;
    this.setShakeProgress(this.state.shakeProgress + d / TIMING.shakeTravel);
  }

  /** Vòng lắc đầy tới đâu thì hô tới đó: 1/3 OẲN, 2/3 TÙ, đầy hết XÌ rồi mở thẻ. */
  private setShakeProgress(v: number) {
    this.state.shakeProgress = Math.min(1, v);
    this.state.needShake = false;
    const want = this.state.shakeProgress >= 1 ? 3 : this.state.shakeProgress >= 2 / 3 ? 2 : this.state.shakeProgress >= 1 / 3 ? 1 : 0;
    while (this.state.beat < want && this.state.phase === 'CHANT') this.beat();
  }

  /** Một tiếng hô: OẲN, TÙ, rồi XÌ thì mở thẻ. */
  private beat() {
    this.state.beat += 1;
    if (this.state.beat === 1) {
      this.state.chantWord = 'OẲN';
      audio.playChant('oan');
    } else if (this.state.beat === 2) {
      this.state.chantWord = 'TÙ';
      audio.playChant('tu');
    } else {
      this.enter('SHOW');
    }
  }

  /** Chế độ nút bấm: bấm một thế tay là chốt luôn. */
  chooseByButton(choice: RPSChoice) {
    if (this.state.phase !== 'CHOOSE') return;
    this.state.liveGesture = choice;
    audio.playClick();
    this.lockPlayer(choice);
  }

  setInputMode(mode: InputMode) {
    this.state.inputMode = mode;
    if (mode === 'buttons') {
      this.landmarks = null;
      this.state.handVisible = false;
      this.state.liveGesture = null;
      if (this.state.phase === 'WAIT_HAND') this.enter('CHOOSE');
      else if (this.state.phase === 'CHANT') this.enter('CHANT'); // chuyển sang tự hô
    }
    this.emit();
  }

  /** Bấm "Lượt tiếp" trong lúc xem kết quả. */
  skipReveal() {
    if (this.state.phase === 'REVEAL') this.advanceTurn();
  }

  /** Bấm "Bạn thứ hai sẵn sàng" lúc nghỉ giữa vòng. */
  startRound2() {
    if (this.state.phase !== 'ROUND_GAP') return;
    this.state.round = 2;
    this.state.turn = 1;
    this.startTurn();
  }

  // ---------------------------------------------------------------------------
  // VÒNG ĐỜI MỘT LƯỢT
  // ---------------------------------------------------------------------------

  private phaseDuration(phase: GamePhase): number {
    switch (phase) {
      case 'TURN_INTRO':
        return TIMING.turnIntro;
      case 'LOCKED':
        return TIMING.locked;
      case 'CHANT':
        return this.state.inputMode === 'buttons' ? TIMING.chantBeat * 3 : 0;
      case 'SHOW':
        return TIMING.show;
      case 'REVEAL':
        return TIMING.reveal;
      case 'ROUND_GAP':
        return TIMING.roundGapAuto;
      default:
        return 0;
    }
  }

  private enter(phase: GamePhase) {
    this.state.phase = phase;
    this.previewDirty = true;
    this.phaseTime = 0;
    this.state.phaseProgress = 0;
    this.state.phaseRemaining = this.phaseDuration(phase);
    this.state.needShake = false;

    if (phase === 'CHOOSE') {
      this.holdGesture = null;
      this.holdTime = 0;
      this.missTime = 0;
      this.state.holdProgress = 0;
      this.state.chantWord = '';
    } else if (phase === 'CHANT') {
      this.state.beat = 0;
      this.state.shakeProgress = 0;
      this.state.chantWord = '';
      this.lastShakeGainAt = this.clock;
    } else if (phase === 'SHOW') {
      this.state.chantWord = 'XÌ';
      this.state.beat = 3;
      audio.playChant('xi');
    } else if (phase === 'WAIT_HAND') {
      this.handSeenMs = 0;
      this.state.chantWord = '';
    } else {
      this.state.chantWord = '';
    }
    this.emit();
  }

  private startTurn() {
    if (this.getOverallTurnNumber() > 10) {
      this.finishGame();
      return;
    }
    // Máy chốt lựa chọn của nó NGAY ĐẦU LƯỢT, trước khi người chơi ra tay (không nhìn trộm).
    const prediction = this.adaptiveAI.prepareTurn(this.getOverallTurnNumber());
    this.pendingAIChoice = prediction.chosenAIChoice;
    this.state.predictedPlayerProbabilities = prediction.predictedPlayerProbabilities;

    this.state.playerChoice = null;
    this.state.aiChoice = null;
    this.state.lastResult = null;
    this.state.lastScoreGain = 0;
    this.state.resultMessage = '';
    this.state.resultDetail = '';
    this.state.beat = 0;
    this.state.shakeProgress = 0;
    this.state.holdProgress = 0;
    if (this.state.inputMode === 'buttons') this.state.liveGesture = null;
    audio.playNewTurn();
    this.enter('TURN_INTRO');
  }

  update(dtMs: number) {
    const dt = dtMs / 1000;
    this.clock += dt;
    this.updateVFX(dt);

    const phase = this.state.phase;
    if (phase === 'GAMEOVER') return;

    this.phaseTime += dt;
    const dur = this.phaseDuration(phase);
    if (dur > 0) {
      this.state.phaseProgress = Math.min(1, this.phaseTime / dur);
      this.state.phaseRemaining = Math.max(0, dur - this.phaseTime);
    }

    switch (phase) {
      case 'TURN_INTRO':
        if (this.phaseTime >= dur) {
          this.enter(this.state.inputMode === 'camera' && !this.state.handVisible ? 'WAIT_HAND' : 'CHOOSE');
          return;
        }
        break;

      case 'WAIT_HAND':
        if (this.state.inputMode !== 'camera') {
          this.enter('CHOOSE');
          return;
        }
        this.handSeenMs = this.state.handVisible ? this.handSeenMs + dtMs : 0;
        if (this.handSeenMs >= TIMING.handStableMs) {
          this.enter('CHOOSE');
          return;
        }
        break;

      case 'CHOOSE': {
        if (this.state.inputMode !== 'camera') break; // chờ bấm nút
        const g = this.state.liveGesture;
        if (g && g === this.holdGesture) {
          this.holdTime += dt;
          this.missTime = 0;
        } else if (g) {
          this.holdGesture = g; // đổi thế tay: giữ lại từ đầu
          this.holdTime = 0;
          this.missTime = 0;
        } else {
          this.missTime += dt;
          if (this.missTime > TIMING.holdGrace) this.holdTime = Math.max(0, this.holdTime - dt * 2);
        }
        this.state.holdProgress = Math.min(1, this.holdTime / TIMING.holdToLock);
        if (this.holdGesture && this.holdTime >= TIMING.holdToLock) {
          this.lockPlayer(this.holdGesture);
          return;
        }
        break;
      }

      case 'LOCKED':
        if (this.phaseTime >= dur) {
          this.enter('CHANT');
          return;
        }
        break;

      case 'CHANT':
        if (this.state.inputMode === 'camera') {
          // Vòng đầy theo tay lắc; chỉ nhắc khi ngừng lắc hoặc mất tay
          this.state.needShake = !this.state.handVisible || this.clock - this.lastShakeGainAt > TIMING.shakeIdle;
          break;
        }
        this.setShakeProgress(this.phaseTime / dur); // chơi bằng nút: vòng tự đầy
        if (this.state.phase !== 'CHANT') return;
        break;

      case 'SHOW':
        if (this.phaseTime >= dur) {
          this.reveal();
          return;
        }
        break;

      case 'REVEAL':
        if (this.phaseTime >= dur) {
          this.advanceTurn();
          return;
        }
        break;

      case 'ROUND_GAP':
        if (this.phaseTime >= dur) {
          this.startRound2();
          return;
        }
        break;
    }

    this.emit();
  }

  private lockPlayer(choice: RPSChoice) {
    this.state.playerChoice = choice;
    this.state.holdProgress = 1;
    audio.playLock();
    this.spawnRing(this.width * 0.25, this.height * 0.5, RPS_CHOICES[choice].color);
    this.enter('LOCKED');
  }

  private reveal() {
    const overallTurn = this.getOverallTurnNumber();
    const player = this.state.playerChoice!;
    const ai = this.pendingAIChoice;
    const evaluation = evaluateRPS(player, ai);
    this.adaptiveAI.recordTurnResult(overallTurn, player, evaluation.result);

    this.state.aiChoice = ai;
    this.state.lastResult = evaluation.result;
    this.state.resultMessage = evaluation.message;
    this.state.resultDetail = evaluation.detail;

    let gain = 0;
    const r1 = this.state.round === 1;
    if (evaluation.result === 'win') {
      gain = 100;
      this.state.streak += 1;
      this.state.bestStreak = Math.max(this.state.bestStreak, this.state.streak);
      if (r1) this.state.round1Wins += 1;
      else this.state.round2Wins += 1;
      this.state.totalWins += 1;
      audio.playWin();
      this.spawnConfetti();
    } else if (evaluation.result === 'draw') {
      gain = 30;
      if (r1) this.state.round1Draws += 1;
      else this.state.round2Draws += 1;
      this.state.totalDraws += 1;
      audio.playDraw();
    } else {
      this.state.streak = 0;
      if (r1) this.state.round1Losses += 1;
      else this.state.round2Losses += 1;
      this.state.totalLosses += 1;
      audio.playLose();
    }
    this.state.score += gain;
    this.state.lastScoreGain = gain;
    audio.playClash();
    this.spawnRing(
      this.width / 2,
      this.height / 2,
      evaluation.result === 'win' ? '#22C55E' : evaluation.result === 'lose' ? '#EF4444' : '#FFB800'
    );

    this.state.history.push({
      round: this.state.round,
      turn: this.state.turn,
      playerChoice: player,
      aiChoice: ai,
      result: evaluation.result,
      scoreGain: gain,
    });
    this.enter('REVEAL');
  }

  private advanceTurn() {
    if (this.state.turn < this.state.maxTurnsPerRound) {
      this.state.turn += 1;
      this.startTurn();
    } else if (this.state.round === 1) {
      audio.playNewTurn();
      this.enter('ROUND_GAP');
    } else {
      this.finishGame();
    }
  }

  private finishGame() {
    this.state.phase = 'GAMEOVER';
    this.state.isGameOver = true;
    this.state.isWin = this.state.totalWins > this.state.totalLosses;
    this.state.aiInsight = this.adaptiveAI.generatePostMatchInsight();
    this.emit();
  }

  private emit() {
    this.onStateChange({ ...this.state, history: [...this.state.history] });
  }

  // ---------------------------------------------------------------------------
  // HIỆU ỨNG (canvas trong suốt phủ lên sân chơi)
  // ---------------------------------------------------------------------------

  private updateVFX(dt: number) {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.age += dt;
      r.r += dt * 520;
      if (r.age >= 0.7) this.rings.splice(i, 1);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += dt * 520;
      p.rot += p.vr * dt;
      p.alpha -= dt * 0.55;
      if (p.alpha <= 0 || p.y > this.height + 40) this.particles.splice(i, 1);
    }
  }

  private spawnRing(x: number, y: number, color: string) {
    this.rings.push({ x, y, r: 30, color, age: 0 });
  }

  private spawnConfetti() {
    const colors = ['#FF8A1F', '#FF4F8B', '#22C55E', '#1E9BFF', '#8B5CF6', '#FFC21A'];
    const count = LITE ? 40 : 90;
    for (let i = 0; i < count; i++) {
      const fromLeft = i % 2 === 0;
      this.particles.push({
        x: fromLeft ? this.width * 0.1 : this.width * 0.9,
        y: this.height * 0.85,
        vx: (fromLeft ? 1 : -1) * (Math.random() * 380 + 120),
        vy: -(Math.random() * 520 + 380),
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 12,
        color: colors[i % colors.length],
        size: Math.random() * 8 + 7,
        alpha: 1.3,
      });
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const r of this.rings) {
      ctx.globalAlpha = Math.max(0, 1 - r.age / 0.7);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 10 * (1 - r.age / 0.7) + 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const p of this.particles) {
      ctx.globalAlpha = Math.min(1, Math.max(0, p.alpha));
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /** Ô "Máy nhìn thấy": vẽ khung xương 21 điểm của bàn tay, không vẽ hình camera (C-108). */
  drawHandPreview(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.fillStyle = '#EAF6FF';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#C9E6FF';
    for (let x = 10; x < w; x += 18) for (let y = 10; y < h; y += 18) ctx.fillRect(x, y, 2, 2);

    const lm = this.landmarks;
    if (!lm) return;
    const s = Math.min(w / this.videoW, h / this.videoH);
    const ox = (w - this.videoW * s) / 2;
    const oy = (h - this.videoH * s) / 2;
    const pt = (i: number) => [ox + lm[i].x * s, oy + lm[i].y * s] as const;

    const g = this.state.playerChoice && (this.state.phase === 'LOCKED' || this.state.phase === 'REVEAL')
      ? this.state.playerChoice
      : this.state.liveGesture;
    const color = g ? RPS_CHOICES[g].color : '#1E9BFF';

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(3, w / 40);
    for (const [a, b] of HAND_CONNECTIONS) {
      const [x1, y1] = pt(a);
      const [x2, y2] = pt(b);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    const tips = [4, 8, 12, 16, 20];
    for (let i = 0; i < lm.length; i++) {
      const [x, y] = pt(i);
      ctx.beginPath();
      ctx.arc(x, y, tips.includes(i) ? w / 34 : w / 55, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.stroke();
    }
  }
}
