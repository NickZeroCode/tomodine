import { useState } from "react";
import { TetrisGame } from "./TetrisGame";
import { SnakeGame } from "./SnakeGame";
import { Game2048 } from "./Game2048";
import { MemoryGame } from "./MemoryGame";
import { TicTacToe } from "./TicTacToe";
import { TriviaGame } from "./TriviaGame";
import { WordChain } from "./WordChain";

type GameId = "tetris" | "snake" | "2048" | "memory" | "tictactoe" | "trivia" | "wordchain" | null;

const SOLO = [
  {
    id: "tetris" as const,
    name: "Tetris",
    desc: "Stack blocks, clear lines",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10">
        <rect x="4" y="4" width="10" height="10" rx="1.5" fill="#a78bfa" />
        <rect x="14" y="4" width="10" height="10" rx="1.5" fill="#8b5cf6" />
        <rect x="24" y="4" width="10" height="10" rx="1.5" fill="#a78bfa" />
        <rect x="14" y="14" width="10" height="10" rx="1.5" fill="#7c3aed" />
        <rect x="4" y="24" width="10" height="10" rx="1.5" fill="#c4b5fd" opacity="0.5" />
        <rect x="24" y="24" width="10" height="10" rx="1.5" fill="#c4b5fd" opacity="0.5" />
      </svg>
    ),
  },
  {
    id: "snake" as const,
    name: "Snake",
    desc: "Eat, grow, survive",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10">
        <path d="M8 28c0-4 4-4 4-8s4-4 4-8 4-4 4-4" stroke="#34d399" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="32" cy="8" r="2.5" fill="#10b981" />
        <circle cx="8" cy="28" r="3" fill="#ef4444" />
      </svg>
    ),
  },
  {
    id: "2048" as const,
    name: "2048",
    desc: "Merge tiles to win",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10">
        <rect x="2" y="2" width="16" height="16" rx="2" fill="#f97316" />
        <rect x="22" y="2" width="16" height="16" rx="2" fill="#eab308" />
        <rect x="2" y="22" width="16" height="16" rx="2" fill="#eab308" />
        <rect x="22" y="22" width="16" height="16" rx="2" fill="#10b981" />
        <text x="10" y="14" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="sans-serif">2</text>
        <text x="30" y="14" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="sans-serif">4</text>
        <text x="10" y="34" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="sans-serif">8</text>
        <text x="30" y="34" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="sans-serif">16</text>
      </svg>
    ),
  },
  {
    id: "memory" as const,
    name: "Memory",
    desc: "Find matching pairs",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10">
        <rect x="2" y="4" width="14" height="18" rx="2" fill="#3b82f6" />
        <rect x="6" y="8" width="14" height="18" rx="2" fill="#6366f1" />
        <rect x="10" y="12" width="14" height="18" rx="2" fill="#8b5cf6" />
        <circle cx="9" cy="13" r="2" fill="white" opacity="0.6" />
        <circle cx="13" cy="17" r="2" fill="white" opacity="0.6" />
        <circle cx="17" cy="21" r="2" fill="white" opacity="0.6" />
      </svg>
    ),
  },
];

const SOCIAL = [
  {
    id: "tictactoe" as const,
    name: "Tic Tac Toe",
    desc: "2 player classic",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10">
        <line x1="15" y1="6" x2="15" y2="34" stroke="white" strokeWidth="2" opacity="0.4" />
        <line x1="25" y1="6" x2="25" y2="34" stroke="white" strokeWidth="2" opacity="0.4" />
        <line x1="6" y1="15" x2="34" y2="15" stroke="white" strokeWidth="2" opacity="0.4" />
        <line x1="6" y1="25" x2="34" y2="25" stroke="white" strokeWidth="2" opacity="0.4" />
        <circle cx="10" cy="10" r="3.5" stroke="#60a5fa" strokeWidth="2" fill="none" />
        <line x1="21" y1="21" x2="29" y2="29" stroke="#f87171" strokeWidth="2" strokeLinecap="round" />
        <line x1="29" y1="21" x2="21" y2="29" stroke="#f87171" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "trivia" as const,
    name: "Trivia Quiz",
    desc: "Test your knowledge",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10">
        <circle cx="20" cy="16" r="12" stroke="#fbbf24" strokeWidth="2" />
        <text x="20" y="21" textAnchor="middle" fill="#fbbf24" fontSize="16" fontWeight="bold" fontFamily="sans-serif">?</text>
        <rect x="14" y="30" width="12" height="3" rx="1.5" fill="#fbbf24" opacity="0.4" />
      </svg>
    ),
  },
  {
    id: "wordchain" as const,
    name: "Word Chain",
    desc: "Build words together",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10">
        <rect x="4" y="14" width="10" height="12" rx="2" fill="#6366f1" />
        <rect x="15" y="14" width="10" height="12" rx="2" fill="#8b5cf6" />
        <rect x="26" y="14" width="10" height="12" rx="2" fill="#a78bfa" />
        <text x="9" y="23" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="sans-serif">A</text>
        <text x="20" y="23" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="sans-serif">B</text>
        <text x="31" y="23" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="sans-serif">C</text>
      </svg>
    ),
  },
];

export function MiniGames({ onClose }: { onClose: () => void }) {
  const [activeGame, setActiveGame] = useState<GameId>(null);

  if (activeGame === "tetris") return <TetrisGame onBack={() => setActiveGame(null)} onClose={onClose} />;
  if (activeGame === "snake") return <SnakeGame onBack={() => setActiveGame(null)} onClose={onClose} />;
  if (activeGame === "2048") return <Game2048 onBack={() => setActiveGame(null)} onClose={onClose} />;
  if (activeGame === "memory") return <MemoryGame onBack={() => setActiveGame(null)} onClose={onClose} />;
  if (activeGame === "tictactoe") return <TicTacToe onBack={() => setActiveGame(null)} onClose={onClose} />;
  if (activeGame === "trivia") return <TriviaGame onBack={() => setActiveGame(null)} onClose={onClose} />;
  if (activeGame === "wordchain") return <WordChain onBack={() => setActiveGame(null)} onClose={onClose} />;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
        <button type="button" onClick={onClose} className="text-sm font-medium text-ink-500">← Back</button>
        <h2 className="font-display text-base font-bold text-ink-900">Games</h2>
        <button type="button" onClick={onClose} className="text-ink-400">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mb-6 text-center">
          <p className="text-3xl">🎮</p>
          <h3 className="mt-2 font-display text-lg font-bold text-ink-900">While you wait...</h3>
          <p className="mt-1 text-sm text-ink-500">Pick a game to pass the time!</p>
        </div>

        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">Solo Games</h4>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SOLO.map((game) => (
            <button key={game.id} type="button" onClick={() => setActiveGame(game.id)} className="group flex flex-col items-center rounded-xl border border-ink-100 bg-white p-4 shadow-sm transition-all hover:shadow-md active:scale-[0.97]">
              {game.icon}
              <p className="mt-2 text-sm font-semibold text-ink-900">{game.name}</p>
              <p className="mt-0.5 text-[0.65rem] text-ink-400">{game.desc}</p>
            </button>
          ))}
        </div>

        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">Play Together 🤝</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SOCIAL.map((game) => (
            <button key={game.id} type="button" onClick={() => setActiveGame(game.id)} className="group flex flex-col items-center rounded-xl border border-ink-100 bg-white p-4 shadow-sm transition-all hover:shadow-md active:scale-[0.97]">
              {game.icon}
              <p className="mt-2 text-sm font-semibold text-ink-900">{game.name}</p>
              <p className="mt-0.5 text-[0.65rem] text-ink-400">{game.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
