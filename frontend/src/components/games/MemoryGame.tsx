import { useState, useCallback } from "react";

const EMOJIS = ["🍕", "🍔", "🍟", "🌮", "🍣", "🍜", "🥗", "🍰"];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Card {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
}

function createCards(): Card[] {
  const pairs = shuffle(EMOJIS).slice(0, 6);
  const deck = shuffle([...pairs, ...pairs]);
  return deck.map((emoji, i) => ({ id: i, emoji, flipped: false, matched: false }));
}

export function MemoryGame({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const [cards, setCards] = useState(createCards);
  const [first, setFirst] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);
  const [won, setWon] = useState(false);

  const flip = useCallback((idx: number) => {
    if (locked || cards[idx].flipped || cards[idx].matched) return;

    setCards((prev) => prev.map((c, i) => (i === idx ? { ...c, flipped: true } : c)));

    if (first === null) {
      setFirst(idx);
    } else {
      setLocked(true);
      setMoves((m) => m + 1);
      const second = idx;

      setTimeout(() => {
        setCards((prev) => {
          const isMatch = prev[first].emoji === prev[second].emoji;
          const updated = prev.map((c, i) => {
            if (i === first || i === second) {
              return isMatch ? { ...c, matched: true } : { ...c, flipped: false };
            }
            return c;
          });
          if (isMatch && updated.every((c) => c.matched)) setWon(true);
          return updated;
        });
        setFirst(null);
        setLocked(false);
      }, 700);
    }
  }, [cards, first, locked]);

  const restart = () => { setCards(createCards()); setFirst(null); setMoves(0); setLocked(false); setWon(false); };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">
      <div className="flex items-center justify-between px-4 py-2">
        <button type="button" onClick={onBack} className="text-sm font-medium text-white/60">← Games</button>
        <span className="text-sm font-bold text-white">Memory</span>
        <button type="button" onClick={onClose} className="text-white/60">✕</button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        <div className="flex gap-6">
          <div className="rounded-lg bg-white/10 px-4 py-2 text-center">
            <p className="text-[0.6rem] uppercase tracking-wider text-white/50">Moves</p>
            <p className="text-lg font-bold tabular-nums text-white">{moves}</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2" style={{ width: "min(80vw, 300px)" }}>
          {cards.map((card, i) => (
            <button
              key={card.id}
              type="button"
              onClick={() => flip(i)}
              className="flex aspect-square items-center justify-center text-2xl transition-transform"
              style={{
                borderRadius: "6px",
                background: card.flipped || card.matched ? "#1d6a4e" : "#334155",
                transform: card.flipped || card.matched ? "scale(1)" : "scale(0.95)",
                opacity: card.matched ? 0.6 : 1,
              }}
            >
              {card.flipped || card.matched ? card.emoji : "?"}
            </button>
          ))}
        </div>
        {won && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-lg font-bold text-emerald-400">🎉 You won in {moves} moves!</p>
            <button type="button" onClick={restart} className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-bold text-white">Play Again</button>
          </div>
        )}
      </div>
    </div>
  );
}
