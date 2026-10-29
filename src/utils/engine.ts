// Engine chính cho game AR Oẳn Tù Xì
//
// Mỗi lượt đi qua các pha theo đúng một chiều, mỗi pha có thời lượng cố định
// để học sinh nhìn màn hình là biết đang ở đâu:
//
//   TURN_INTRO  "Lượt 3"                           1,4 s
//   WAIT_HAND   chờ thấy bàn tay trước camera       (đến khi thấy tay)
//   CHANT       OẲN, TÙ (lắc nắm tay theo nhịp)    2 x 0,85 s
//   SHOW        XÌ! ra tay và giữ yên              1,2 s  (máy đếm phiếu ở 0,8 s cuối)
//   LOCKED      CHỐT! khóa thế tay của người chơi   0,9 s
//   REVEAL      máy lật bài, báo thắng thua         3,4 s  (bấm "Lượt tiếp" để đi nhanh)
//   RETRY       không thấy tay lúc chốt: chơi lại lượt đó, không tính điểm
//
// Hết lượt 5 của vòng 1 vào ROUND_GAP: đổi bạn, bấm nút để vào vòng 2.
import { AdaptiveRPSAI, AIDifficulty, AIPostMatchInsight, ProbabilityDistribution } from '../ai';
import { evaluateRPS, RPSChoice, RPSResult, RPS_CHOICES } from '../data/rps';
import { audio } from './audio';
import { detectRPSGesture, HAND_CONNECTIONS, LandmarkPoint } from './gesture';

export type GamePhase =
  | 'TURN_INTRO'
  | 'WAIT_HAND'
  | 'CHANT'
  | 'SHOW'
  | 'LOCKED'
  | 'REVEAL'
  | 'RETRY'
  | 'ROUND_GAP'
  | 'GAMEOVER';

export type InputMode = 'camera' | 'buttons';

export const TIMING = {
  turnIntro: 1.4,
  chantBeat: 0.85,
  show: 1.2,
  showVoteFrom: 0.4, // bỏ 0,4 s đầu của XÌ cho tay kịp thành hình rồi mới đếm phiếu
  locked: 0.9,
  reveal: 3.4,
  retry: 2.2,
  roundGapAuto: 20,
  handStableMs: 300,
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
  inputMode: InputMode;
  liveGesture: RPSChoice | null; // thế tay máy đang thấy (chưa chốt)
  handVisible: boolean;
  playerChoice: RPSChoice | null; // thế tay đã chốt
  aiChoice: RPSChoice | null; // chỉ có giá trị từ REVEAL trở đi
  lastResult: RPSResult | null;
  lastScoreGain: number;
  resultMessage: string;
  resultDetail: string;
  retryReason: string;
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
    inputMode,
    liveGesture: null,
    handVisible: false,
    playerChoice: null,
    aiChoice: null,
    lastResult: null,
    lastScoreGain: 0,
    resultMessage: '',
    resultDetail: '',
    retryReason: '',
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
  private buttonChoice: RPSChoice | null = null;
  private phaseTime = 0;
  private handSeenMs = 0;
  private votes: Record<RPSChoice, number> = { rock: 0, paper: 0, scissors: 0 };
  private lastSeenInShow: RPSChoice | null = null;
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
    this.landmarks = hasHand ? landmarks : null;
    this.state.handVisible = hasHand;
    this.state.liveGesture = hasHand ? detectRPSGesture(landmarks!).choice : null;
  }

  /** Chế độ nút bấm: chọn thế tay. Chỉ nhận trong lúc hô và lúc XÌ. */
  chooseByButton(choice: RPSChoice) {
    if (this.state.phase !== 'CHANT' && this.state.phase !== 'SHOW') return;
    this.buttonChoice = choice;
    this.state.liveGesture = choice;
    audio.playClick();
    this.emit();
  }

  setInputMode(mode: InputMode) {
    this.state.inputMode = mode;
    if (mode === 'buttons') {
      this.landmarks = null;
      this.state.handVisible = false;
      this.state.liveGesture = this.buttonChoice;
      if (this.state.phase === 'WAIT_HAND') this.enter('CHANT');
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
      case 'CHANT':
        return TIMING.chantBeat * 2;
      case 'SHOW':
        return TIMING.show;
      case 'LOCKED':
        return TIMING.locked;
      case 'REVEAL':
        return TIMING.reveal;
      case 'RETRY':
        return TIMING.retry;
      case 'ROUND_GAP':
        return TIMING.roundGapAuto;
      default:
        return 0;
    }
  }

  private enter(phase: GamePhase) {
    this.state.phase = phase;
    this.phaseTime = 0;
    this.state.phaseProgress = 0;
    this.state.phaseRemaining = this.phaseDuration(phase);

    if (phase === 'CHANT') {
      this.state.chantWord = 'OẲN';
      audio.playChant('oan');
    } else if (phase === 'SHOW') {
      this.state.chantWord = 'XÌ';
      this.votes = { rock: 0, paper: 0, scissors: 0 };
      this.lastSeenInShow = null;
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

    this.buttonChoice = null;
    this.state.playerChoice = null;
    this.state.aiChoice = null;
    this.state.lastResult = null;
    this.state.lastScoreGain = 0;
    this.state.resultMessage = '';
    this.state.resultDetail = '';
    this.state.retryReason = '';
    if (this.state.inputMode === 'buttons') this.state.liveGesture = null;
    audio.playNewTurn();
    this.enter('TURN_INTRO');
  }

  update(dtMs: number) {
    const dt = dtMs / 1000;
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
          this.enter(this.state.inputMode === 'camera' && !this.state.handVisible ? 'WAIT_HAND' : 'CHANT');
          return;
        }
        break;

      case 'WAIT_HAND':
        if (this.state.inputMode !== 'camera') {
          this.enter('CHANT');
          return;
        }
        this.handSeenMs = this.state.handVisible ? this.handSeenMs + dtMs : 0;
        if (this.handSeenMs >= TIMING.handStableMs) {
          this.enter('CHANT');
          return;
        }
        break;

      case 'CHANT':
        if (this.phaseTime >= TIMING.chantBeat && this.state.chantWord === 'OẲN') {
          this.state.chantWord = 'TÙ';
          audio.playChant('tu');
        }
        if (this.phaseTime >= dur) {
          this.enter('SHOW');
          return;
        }
        break;

      case 'SHOW': {
        const g = this.state.inputMode === 'buttons' ? this.buttonChoice : this.state.liveGesture;
        if (g) this.lastSeenInShow = g;
        if (g && this.phaseTime >= TIMING.showVoteFrom) this.votes[g] += dtMs;
        if (this.phaseTime >= dur) {
          this.lockPlayer();
          return;
        }
        break;
      }

      case 'LOCKED':
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

      case 'RETRY':
        if (this.phaseTime >= dur) {
          this.startTurn();
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

  /** Hết XÌ: thế tay xuất hiện lâu nhất trong cửa sổ đếm phiếu là thế tay được chốt. */
  private lockPlayer() {
    let best: RPSChoice | null = null;
    let bestMs = 0;
    for (const c of ['rock', 'paper', 'scissors'] as RPSChoice[]) {
      if (this.votes[c] > bestMs) {
        bestMs = this.votes[c];
        best = c;
      }
    }
    const locked = best ?? this.lastSeenInShow;

    if (!locked) {
      this.state.retryReason =
        this.state.inputMode === 'buttons'
          ? 'Em chưa bấm chọn Búa, Kéo hay Bao.'
          : 'Máy chưa thấy rõ tay em lúc XÌ.';
      audio.playLose();
      this.enter('RETRY');
      return;
    }

    this.state.playerChoice = locked;
    audio.playLock();
    this.spawnRing(this.width * 0.25, this.height * 0.5, '#1E9BFF');
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
    for (let i = 0; i < 90; i++) {
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
