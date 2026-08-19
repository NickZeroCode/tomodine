import { useState } from "react";

type Player = "X" | "O" | null;

function checkWinner(board: Player[]): Player | "draw" {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return board.every((c) => c !== null) ? "draw" : null;
}

export function TicTacToe({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const [board, setBoard] = useState<Player[]>(Array(9).fill(null));
  const [turn, setTurn] = useState<"X" | "O">("X");
  const [scores, setScores] = useState({ X: 0, O: 0 });
  const winner = checkWinner(board);

  const play = (i: number) => {
    if (board[i] || winner) return;
    const next = [...board];
    next[i] = turn;
    setBoard(next);
    const w = checkWinner(next);
    if (w === "X" || w === "O") setScores((s) => ({ ...s, [w]: s[w] + 1 }));
    setTurn(turn === "X" ? "O" : "X");
  };

  const reset = () => { setBoard(Array(9).fill(null)); setTurn("X"); };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">
      <div className="flex items-center justify-between px-4 py-2">
        <button type="button" onClick={onBack} className="text-sm font-medium text-white/60">← Games</button>
        <span className="text-sm font-bold text-white">Tic Tac Toe</span>
        <button type="button" onClick={onClose} className="text-white/60">✕</button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        <div className="flex gap-8">
          <div className="text-center">
            <p className="text-xs text-white/50">Player X</p>
            <p className="text-2xl font-bold text-blue-400">{scores.X}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-white/50">Player O</p>
            <p className="text-2xl font-bold text-red-400">{scores.O}</p>
          </div>
        </div>
        <p className="text-sm font-medium text-white/70">
          {winner === "draw" ? "It's a draw!" : winner ? `Player ${winner} wins!` : `Player ${turn}'s turn`}
        </p>
        <div className="grid grid-cols-3 gap-2" style={{ width: "min(75vw, 280px)" }}>
          {board.map((cell, i) => (
            <button
              key={i}
              type="button"
              onClick={() => play(i)}
              className="flex aspect-square items-center justify-center text-3xl font-bold transition-all"
              style={{
                borderRadius: "6px",
                background: cell ? "transparent" : "#334155",
                color: cell === "X" ? "#60a5fa" : "#f87171",
              }}
            >
              {cell || ""}
            </button>
          ))}
        </div>
        {(winner || board.every((c) => c !== null)) && (
          <button type="button" onClick={reset} className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-bold text-white">Play Again</button>
        )}
      </div>
    </div>
  );
}
