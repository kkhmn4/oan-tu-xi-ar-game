import React, { useEffect, useState } from 'react';
import {
  CHARACTERS_SPRITE_SHEET,
  getCharacterById,
  PLAYER_CHARACTERS,
  PlayerCharacter,
  PlayerProfile,
} from '../data/characters';
import { audio } from '../utils/audio';

export { getCharacterById };

interface PlayerSetupModalProps {
  open: boolean;
  initialProfile: PlayerProfile | null;
  onConfirm: (profile: PlayerProfile) => void;
  onClose?: () => void;
}

export function CharacterAvatar({
  character,
  className = 'w-full h-full',
}: {
  character: PlayerCharacter;
  className?: string;
  imgClassName?: string;
}) {
  const { x, y, width, height } = character.cropRect;
  // Sprite sheet tách nền 513x486
  const bgPosX = (x / (513 - width)) * 100;
  const bgPosY = (y / (486 - height)) * 100;
  const bgSizeX = (513 / width) * 100;
  const bgSizeY = (486 / height) * 100;

  return (
    <div className={`relative overflow-hidden flex items-center justify-center select-none ${className}`}>
      <div
        role="img"
        aria-label={character.name}
        className="w-full h-full rounded-xl"
        style={{
          backgroundImage: `url(${CHARACTERS_SPRITE_SHEET})`,
          backgroundPosition: `${bgPosX.toFixed(3)}% ${bgPosY.toFixed(3)}%`,
          backgroundSize: `${bgSizeX.toFixed(3)}% ${bgSizeY.toFixed(3)}%`,
          backgroundRepeat: 'no-repeat',
        }}
      />
    </div>
  );
}

export function PlayerSetupModal({ open, initialProfile, onConfirm }: PlayerSetupModalProps) {
  const [groupName, setGroupName] = useState<string>(initialProfile?.groupName ?? 'Nhóm 1');
  const [className, setClassName] = useState<string>(initialProfile?.className ?? '');
  const [selectedCharId, setSelectedCharId] = useState<string>(initialProfile?.characterId ?? PLAYER_CHARACTERS[0].id);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open && initialProfile) {
      setGroupName(initialProfile.groupName || 'Nhóm 1');
      setClassName(initialProfile.className || '');
      setSelectedCharId(initialProfile.characterId || PLAYER_CHARACTERS[0].id);
      setErrorMsg(null);
    }
  }, [open, initialProfile]);

  if (!open) return null;

  const selectedChar = getCharacterById(selectedCharId);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanGroup = groupName.trim();
    if (!cleanGroup) {
      setErrorMsg('Em nhập tên đội nhé!');
      return;
    }
    audio.playClick();
    onConfirm({
      groupName: cleanGroup,
      className: className.trim(),
      characterId: selectedChar.id,
      characterImage: selectedChar.image,
      characterName: selectedChar.name,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#23335c]/45 anim-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-setup-title"
    >
      <form
        onSubmit={handleSubmit}
        className="card anim-pop relative w-full max-w-2xl max-h-[96dvh] flex flex-col overflow-hidden"
        style={{ ['--c' as string]: 'var(--sky)', ['--cs' as string]: 'var(--sky-dark)' }}
      >
        <div className="px-4 sm:px-6 pt-3 pb-2 flex items-center gap-3 shrink-0">
          <span className="text-4xl">✌️</span>
          <div className="leading-tight">
            <h2 id="player-setup-title" className="title text-3xl sm:text-4xl text-[var(--sky)]">Đội của em là ai?</h2>
            <p className="text-base sm:text-lg font-bold text-[var(--ink-soft)]">Đặt tên đội và chọn một nhân vật</p>
          </div>
        </div>

        <div className="px-4 sm:px-6 flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-[var(--sky-soft)] border-4 border-[var(--sky)] p-1 shrink-0 anim-pop" key={selectedCharId}>
              <CharacterAvatar character={selectedChar} />
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1.4fr_1fr] gap-2">
              <label className="flex flex-col gap-0.5">
                <span className="font-extrabold text-base">Tên đội *</span>
                <input
                  className="input"
                  maxLength={24}
                  value={groupName}
                  onChange={(e) => {
                    setGroupName(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Ví dụ: Nhóm Sấm Sét"
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="font-extrabold text-base">Lớp (không bắt buộc)</span>
                <input className="input" maxLength={16} value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Ví dụ: lớp mình" />
              </label>
            </div>
          </div>

          {errorMsg && (
            <div className="chip text-base self-start" style={{ ['--c' as string]: 'var(--lose)' }}>
              ⚠️ {errorMsg}
            </div>
          )}

          <span className="font-extrabold text-base">Chọn nhân vật</span>
          <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5 p-2 rounded-2xl bg-[var(--cream)] border-[3px] border-[var(--line)] min-h-0 overflow-y-auto">
            {PLAYER_CHARACTERS.map((char) => {
              const on = char.id === selectedCharId;
              return (
                <button
                  key={char.id}
                  type="button"
                  onClick={() => {
                    audio.playClick();
                    setSelectedCharId(char.id);
                  }}
                  title={char.name}
                  className={`relative aspect-square rounded-2xl p-1 cursor-pointer transition-transform ${
                    on ? 'bg-[var(--sky-soft)] border-4 border-[var(--sky)] scale-110 z-10' : 'bg-white border-[3px] border-transparent hover:border-[var(--line)]'
                  }`}
                >
                  <CharacterAvatar character={char} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 sm:px-6 py-3 flex items-center justify-end shrink-0">
          <button type="submit" className="btn btn-win text-2xl px-10 min-h-[60px]">
            Xong, vào chơi ▶
          </button>
        </div>
      </form>
    </div>
  );
}
