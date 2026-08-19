import { useState, useRef, useCallback } from "react";

const SIZE = 4;
const COLORS: Record<number, string> = {
  0: "#1e293b", 2: "#64748b", 4: "#94a3b8", 8: "#f97316", 16: "#ea580c",
  32: "#dc2626", 64: "#b91c1c", 128: "#facc15", 256: "#eab308",
  512: "#ca8a04", 1024: "#a16207", 2048: "#10b981",
};
const TEXT_COLORS: Record<number, string> = {
  0: "transparent", 2: "#fff", 4: "#fff", 8: "#fff", 16: "#fff",
  32: "#fff", 64: "#fff", 128: "#fff", 256: "#fff",
  512: "#fff", 1024: "#fff", 2048: "#fff",
};

function createGrid(): number[][] {
  const g = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  addRandom(g);
  addRandom(g);
  return g;
}

function addRandom(grid: number[][]) {
  const empty: [number, number][] = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!grid[r][c]) empty.push([r, c]);
  if (empty.length === 0) return;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  grid[r][c] = Math.random() < 0.9 ? 2 : 4;
}

function slide(row: number[]): number[] {
  let arr = row.filter((v) => v !== 0);
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] === arr[i + 1]) { arr[i] *= 2; arr[i + 1] = 0; }
  }
  arr = arr.filter((v) => v !== 0);
  while (arr.length < SIZE) arr.push(0);
  return arr;
}

function moveLeft(grid: number[][]): { grid: number[][]; moved: boolean; score: number } {
  let moved = false;
  let score = 0;
  const newGrid = grid.map((row) => {
    const slid = slide(row);
    if (slid.some((v, i) => v !== row[i])) moved = true;
    score += slid.reduce((s, v, i) => s + (v !== row[i] && v > row[i] ? v : 0), 0);
    return slid;
  });
  return { grid: newGrid, moved, score };
}

function rotateGrid(grid: number[][]): number[][] {
  const n = grid.length;
  const rotated: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) rotated[c][n - 1 - r] = grid[r][c];
  return rotated;
}

function canMove(grid: number[][]): boolean {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (!grid[r][c]) return true;
      if (c < SIZE - 1 && grid[r][c] === grid[r][c + 1]) return true;
      if (r < SIZE - 1 && grid[r][c] === grid[r + 1][c]) return true;
    }
  return false;
}

export function Game2048({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const [grid, setGrid] = useState(createGrid);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const touchRef = useRef({ x: 0, y: 0 });

  const move = useCallback((dir: "left" | "right" | "up" | "down") => {
    setGrid((prev) => {
      let g = prev.map((r) => [...r]);
      const rotations = { left: 0, right: 2, up: 1, down: 3 }[dir];
      for (let i = 0; i < rotations; i++) g = rotateGrid(g);
      const result = moveLeft(g);
      for (let i = 0; i < (4 - rotations) % 4; i++) result.grid = rotateGrid(result.grid);
      if (result.moved) {
        addRandom(result.grid);
        setScore((s) => {
          const ns = s + result.score;
          setBest((b) => Math.max(b, ns));
          return ns;
        });
        if (!canMove(result.grid)) setGameOver(true);
      }
      return result.grid;
    });
  }, []);

  const restart = () => { setGrid(createGrid()); setScore(0); setGameOver(false); };

  // Keyboard
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useState(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") move("left");
      else if (e.key === "ArrowRight") move("right");
      else if (e.key === "ArrowUp") move("up");
      else if (e.key === "ArrowDown") move("down");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const handleTouchStart = (e: React.TouchEvent) => { touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    const dy = e.changedTouches[0].clientY - touchRef.current.y;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "right" : "left");
    else move(dy > 0 ? "down" : "up");
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">
      <div className="flex items-center justify-between px-4 py-2">
        <button type="button" onClick={onBack} className="text-sm font-medium text-white/60">← Games</button>
        <span className="text-sm font-bold text-white">2048</span>
        <button type="button" onClick={onClose} className="text-white/60">✕</button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        <div className="flex gap-6">
          <div className="rounded-lg bg-white/10 px-4 py-2 text-center">
            <p className="text-[0.6rem] uppercase tracking-wider text-white/50">Score</p>
            <p className="text-lg font-bold tabular-nums text-white">{score}</p>
          </div>
          <div className="rounded-lg bg-white/10 px-4 py-2 text-center">
            <p className="text-[0.6rem] uppercase tracking-wider text-white/50">Best</p>
            <p className="text-lg font-bold tabular-nums text-white">{best}</p>
          </div>
        </div>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)`, width: "min(80vw, 320px)", aspectRatio: "1" }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {grid.flat().map((val, i) => (
            <div
              key={i}
              className="flex items-center justify-center font-bold transition-all"
              style={{
                background: COLORS[val] || "#fbbf24",
                color: TEXT_COLORS[val] || "#fff",
                fontSize: val >= 1024 ? "0.9rem" : val >= 128 ? "1.1rem" : "1.3rem",
                borderRadius: "4px",
                aspectRatio: "1",
              }}
            >
              {val || ""}
            </div>
          ))}
        </div>
        {gameOver && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-lg font-bold text-red-400">Game Over</p>
            <button type="button" onClick={restart} className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-bold text-white">Play Again</button>
          </div>
        )}
        <p className="text-xs text-white/40">Swipe or use arrow keys</p>
      </div>
    </div>
  );
}
