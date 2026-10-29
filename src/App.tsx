import { useCallback, useEffect, useState } from 'react';
import { AIDifficulty } from './ai';
import { Game } from './components/Game';
import { Intro } from './components/Intro';
import { Tutorial } from './components/Tutorial';
import { Debrief } from './components/Debrief';
import { CharacterAvatar, PlayerSetupModal } from './components/PlayerSetupModal';
import { TurnTrack } from './components/TurnTrack';
import {
  getCharacterById,
  loadSavedPlayerProfile,
  PLAYER_CHARACTERS,
  PlayerProfile,
  savePlayerProfile,
} from './data/characters';
import { audio } from './utils/audio';
import { createInitialState, GameState } from './utils/engine';
import { isFullscreen, toggleFullscreen } from './utils/fullscreen';

type Screen = 'intro' | 'tutorial' | 'playing' | 'debrief';

const DEFAULT_PROFILE: PlayerProfile = {
  groupName: 'Nhóm 1',
  className: '',
  characterId: PLAYER_CHARACTERS[0].id,
  characterImage: PLAYER_CHARACTERS[0].image,
  characterName: PLAYER_CHARACTERS[0].name,
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('intro');
  const [muted, setMuted] = useState(false);
  // Điền tên đội và chọn nhân vật trước khi vào game
  const [profileModalOpen, setProfileModalOpen] = useState(true);
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile>(() => loadSavedPlayerProfile() || DEFAULT_PROFILE);
  const [difficulty, setDifficulty] = useState<AIDifficulty>('normal');
  const [state, setState] = useState<GameState>(() => createInitialState());
  const [finalState, setFinalState] = useState<GameState>(() => createInitialState());
  const [runKey, setRunKey] = useState(0);
  const [fullscreenActive, setFullscreenActive] = useState(false);

  useEffect(() => {
    const onFs = () => setFullscreenActive(isFullscreen());
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs);
    };
  }, []);

  useEffect(() => {
    audio.setIntensity(state.phase === 'SHOW' ? 0.8 : state.streak >= 2 ? 0.5 : 0.2);
  }, [state.phase, state.streak]);

  const onGameOver = useCallback((s: GameState) => {
    audio.stopMusic();
    setFinalState(s);
    setScreen('debrief');
  }, []);

  const handleStartGame = () => {
    audio.init();
    audio.startMusic();
    setState(createInitialState(difficulty));
    setRunKey((k) => k + 1);
    setScreen('playing');
  };

  const handleBackToIntro = () => {
    audio.stopMusic();
    setScreen('intro');
  };

  const handleSaveProfile = (p: PlayerProfile) => {
    setPlayerProfile(p);
    savePlayerProfile(p);
    setProfileModalOpen(false);
  };

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-[var(--cream)]" data-screen={screen}>
      <PlayerSetupModal open={profileModalOpen} initialProfile={playerProfile} onConfirm={handleSaveProfile} />

      {screen === 'playing' ? (
        <div key="playing" className="flex-1 flex flex-col h-full overflow-hidden anim-fade">
          <GameHud
            state={state}
            profile={playerProfile}
            muted={muted}
            isFullscreen={fullscreenActive}
            onToggleMute={() =>
              setMuted((m) => {
                audio.setMuted(!m);
                return !m;
              })
            }
            onToggleFullscreen={toggleFullscreen}
            onQuit={handleBackToIntro}
          />
          <main className="relative min-h-0 flex-1">
            <Game key={runKey} profile={playerProfile} difficulty={difficulty} onStateUpdate={setState} onGameOver={onGameOver} />
          </main>
        </div>
      ) : screen === 'intro' ? (
        <div key="intro" className="flex-1 flex flex-col h-full overflow-hidden anim-fade">
          <Intro
            profile={playerProfile}
            difficulty={difficulty}
            isFullscreen={fullscreenActive}
            onSelectDifficulty={setDifficulty}
            onOpenSetup={() => setProfileModalOpen(true)}
            onToggleFullscreen={toggleFullscreen}
            onStart={() => setScreen('tutorial')}
          />
        </div>
      ) : screen === 'tutorial' ? (
        <div key="tutorial" className="flex-1 flex flex-col h-full overflow-hidden anim-fade">
          <Tutorial
            isFullscreen={fullscreenActive}
            onBack={handleBackToIntro}
            onToggleFullscreen={toggleFullscreen}
            onStart={handleStartGame}
          />
        </div>
      ) : (
        <div key="debrief" className="flex-1 flex flex-col h-full overflow-hidden anim-fade">
          <Debrief
            state={finalState}
            profile={playerProfile}
            onReplay={handleStartGame}
            onOpenSetup={() => {
              setProfileModalOpen(true);
              handleBackToIntro();
            }}
            onBackToIntro={handleBackToIntro}
          />
        </div>
      )}
    </div>
  );
}

// Thanh trên cùng lúc đang chơi
function GameHud({
  state,
  profile,
  muted,
  isFullscreen: isFs = false,
  onToggleMute,
  onToggleFullscreen,
  onQuit,
}: {
  state: GameState;
  profile: PlayerProfile;
  muted: boolean;
  isFullscreen?: boolean;
  onToggleMute: () => void;
  onToggleFullscreen?: () => void;
  onQuit: () => void;
}) {
  const char = getCharacterById(profile.characterId);

  return (
    <header className="shrink-0 flex items-center justify-between gap-2 px-2 sm:px-4 py-1.5 bg-white border-b-4 border-[var(--line)] z-30">
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-10 h-10 rounded-2xl bg-[var(--sky-soft)] p-0.5 shrink-0">
          <CharacterAvatar character={char} />
        </div>
        <div className="hidden md:flex flex-col leading-tight min-w-0">
          <span className="font-extrabold text-base truncate max-w-[150px]">{profile.groupName}</span>
          {profile.className && <span className="text-sm text-[var(--ink-soft)] truncate">{profile.className}</span>}
        </div>
        <div className="flex items-center gap-1 rounded-2xl bg-[var(--sun-soft)] border-[3px] border-[var(--sun)] px-2.5 py-0.5">
          <span className="text-lg">⭐</span>
          <span className="font-extrabold text-xl leading-none">{state.score}</span>
        </div>
        {state.streak >= 2 && (
          <div className="hidden sm:flex items-center gap-1 rounded-2xl bg-[#ffe6ef] border-[3px] border-[var(--scissors)] px-2 py-0.5 anim-pop">
            <span className="text-lg">🔥</span>
            <span className="font-extrabold text-base leading-none">Thắng {state.streak} lượt liền</span>
          </div>
        )}
      </div>

      <div className="flex-1 flex justify-center min-w-0 overflow-hidden">
        <div className="hidden lg:flex">
          <TurnTrack history={state.history} currentRound={state.round} currentTurn={state.turn} />
        </div>
        <span className="lg:hidden chip text-base whitespace-nowrap">
          Vòng {state.round}, lượt {state.turn}/5
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {onToggleFullscreen && (
          <button type="button" onClick={onToggleFullscreen} title={isFs ? 'Thu nhỏ' : 'Toàn màn hình'} className="btn btn-white btn-icon">
            {isFs ? '🗗' : '⛶'}
          </button>
        )}
        <button type="button" onClick={onToggleMute} title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'} className="btn btn-white btn-icon">
          {muted ? '🔇' : '🔊'}
        </button>
        <button type="button" onClick={onQuit} className="btn btn-white btn-sm">
          Thoát
        </button>
      </div>
    </header>
  );
}
