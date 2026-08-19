import { useRef, useEffect, useState, useCallback } from "react";

const COLS = 10;
const ROWS = 20;
const BLOCK = 20;

const SHAPES: number[][][] = [
  [[1, 1, 1, 1]],
  [[1, 1], [1, 1]],
  [[0, 1, 0], [1, 1, 1]],
  [[1, 0, 0], [1, 1, 1]],
  [[0, 0, 1], [1, 1, 1]],
  [[0, 1, 1], [1, 1, 0]],
  [[1, 1, 0], [0, 1, 1]],
];

const COLORS = ["#00d4ff", "#ffdd00", "#aa00ff", "#ff6600", "#0055ff", "#00ff66", "#ff0044"];

function createGrid(): number[][] {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function rotate(shape: number[][]): number[][] {
  const rows = shape.length;
  const cols = shape[0].length;
  const rotated: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      rotated[c][rows - 1 - r] = shape[r][c];
  return rotated;
}

export function TetrisGame({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const stateRef = useRef({
    grid: createGrid(),
    piece: { shape: SHAPES[0], color: 1, x: 3, y: 0 },
    next: { shape: SHAPES[1], color: 2 },
    dropTimer: 0,
    dropInterval: 800,
    running: true,
    score: 0,
  });

  const spawn = useCallback(() => {
    const s = stateRef.current;
    const idx = Math.floor(Math.random() * SHAPES.length);
    s.piece = { shape: SHAPES[idx], color: idx + 1, x: Math.floor((COLS - SHAPES[idx][0].length) / 2), y: 0 };
    const nIdx = Math.floor(Math.random() * SHAPES.length);
    s.next = { shape: SHAPES[nIdx], color: nIdx + 1 };
    if (collides(s.grid, s.piece.shape, s.piece.x, s.piece.y)) {
      s.running = false;
      setGameOver(true);
    }
  }, []);

  const collides = (grid: number[][], shape: number[][], px: number, py: number): boolean => {
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        if (shape[r][c]) {
          const nx = px + c;
          const ny = py + r;
          if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
          if (ny >= 0 && grid[ny][nx]) return true;
        }
    return false;
  };

  const merge = useCallback(() => {
    const s = stateRef.current;
    const { shape, color, x, y } = s.piece;
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        if (shape[r][c] && y + r >= 0) s.grid[y + r][x + c] = color;
  }, []);

  const clearLines = useCallback(() => {
    const s = stateRef.current;
    let cleared = 0;
    s.grid = s.grid.filter((row) => !row.every((c) => c > 0));
    cleared = ROWS - s.grid.length;
    while (s.grid.length < ROWS) s.grid.unshift(Array(COLS).fill(0));
    s.score += cleared * 100;
    setScore(s.score);
  }, []);

  const moveDown = useCallback(() => {
    const s = stateRef.current;
    if (!s.running) return;
    if (!collides(s.grid, s.piece.shape, s.piece.x, s.piece.y + 1)) {
      s.piece.y++;
    } else {
      merge();
      clearLines();
      spawn();
    }
  }, [merge, clearLines, spawn]);

  const move = useCallback((dx: number) => {
    const s = stateRef.current;
    if (!s.running) return;
    if (!collides(s.grid, s.piece.shape, s.piece.x + dx, s.piece.y)) s.piece.x += dx;
  }, []);

  const rotatePiece = useCallback(() => {
    const s = stateRef.current;
    if (!s.running) return;
    const rotated = rotate(s.piece.shape);
    if (!collides(s.grid, rotated, s.piece.x, s.piece.y)) s.piece.shape = rotated;
    else if (!collides(s.grid, rotated, s.piece.x - 1, s.piece.y)) { s.piece.shape = rotated; s.piece.x--; }
    else if (!collides(s.grid, rotated, s.piece.x + 1, s.piece.y)) { s.piece.shape = rotated; s.piece.x++; }
  }, []);

  const hardDrop = useCallback(() => {
    const s = stateRef.current;
    if (!s.running) return;
    while (!collides(s.grid, s.piece.shape, s.piece.x, s.piece.y + 1)) s.piece.y++;
    merge();
    clearLines();
    spawn();
  }, [merge, clearLines, spawn]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;
    let last = 0;

    const draw = (now: number) => {
      const s = stateRef.current;
      const dt = now - last;
      last = now;

      if (s.running) {
        s.dropTimer += dt;
        if (s.dropTimer >= s.dropInterval) {
          s.dropTimer = 0;
          moveDown();
        }
      }

      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, COLS * BLOCK, ROWS * BLOCK);

      // Grid lines
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 0.5;
      for (let r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * BLOCK); ctx.lineTo(COLS * BLOCK, r * BLOCK); ctx.stroke(); }
      for (let c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(c * BLOCK, 0); ctx.lineTo(c * BLOCK, ROWS * BLOCK); ctx.stroke(); }

      // Merged blocks
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          if (s.grid[r][c]) { ctx.fillStyle = COLORS[s.grid[r][c] - 1]; ctx.fillRect(c * BLOCK + 1, r * BLOCK + 1, BLOCK - 2, BLOCK - 2); }

      // Ghost piece
      let ghostY = s.piece.y;
      while (!collides(s.grid, s.piece.shape, s.piece.x, ghostY + 1)) ghostY++;
      ctx.globalAlpha = 0.2;
      for (let r = 0; r < s.piece.shape.length; r++)
        for (let c = 0; c < s.piece.shape[r].length; c++)
          if (s.piece.shape[r][c]) { ctx.fillStyle = COLORS[s.piece.color - 1]; ctx.fillRect((s.piece.x + c) * BLOCK + 1, (ghostY + r) * BLOCK + 1, BLOCK - 2, BLOCK - 2); }
      ctx.globalAlpha = 1;

      // Active piece
      for (let r = 0; r < s.piece.shape.length; r++)
        for (let c = 0; c < s.piece.shape[r].length; c++)
          if (s.piece.shape[r][c]) { ctx.fillStyle = COLORS[s.piece.color - 1]; ctx.fillRect((s.piece.x + c) * BLOCK + 1, (s.piece.y + r) * BLOCK + 1, BLOCK - 2, BLOCK - 2); }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [moveDown]);

  // Touch controls
  const touchRef = useRef({ x: 0, y: 0 });
  const handleTouchStart = (e: React.TouchEvent) => { touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    const dy = e.changedTouches[0].clientY - touchRef.current.y;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) rotatePiece();
    else if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1);
    else if (dy > 30) hardDrop();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") move(-1);
      else if (e.key === "ArrowRight") move(1);
      else if (e.key === "ArrowDown") moveDown();
      else if (e.key === "ArrowUp") rotatePiece();
      else if (e.key === " ") hardDrop();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [move, moveDown, rotatePiece, hardDrop]);

  const restart = () => {
    stateRef.current = { grid: createGrid(), piece: { shape: SHAPES[0], color: 1, x: 3, y: 0 }, next: { shape: SHAPES[1], color: 2 }, dropTimer: 0, dropInterval: 800, running: true, score: 0 };
    setScore(0);
    setGameOver(false);
    spawn();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">
      <div className="flex items-center justify-between px-4 py-2">
        <button type="button" onClick={onBack} className="text-sm font-medium text-white/60">← Games</button>
        <span className="text-sm font-bold text-white">Tetris</span>
        <button type="button" onClick={onClose} className="text-white/60">✕</button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="text-sm font-bold tabular-nums text-white">Score: {score}</p>
        <canvas
          ref={canvasRef}
          width={COLS * BLOCK}
          height={ROWS * BLOCK}
          className="touch-none"
          style={{ maxHeight: "65vh", maxWidth: "100%" }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        />
        {gameOver && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-lg font-bold text-red-400">Game Over</p>
            <button type="button" onClick={restart} className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-bold text-white">Play Again</button>
          </div>
        )}
        {!gameOver && (
          <div className="flex gap-2">
            <button type="button" onClick={() => move(-1)} className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/10 text-xl text-white active:bg-white/20">←</button>
            <button type="button" onClick={rotatePiece} className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/10 text-xl text-white active:bg-white/20">↻</button>
            <button type="button" onClick={() => move(1)} className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/10 text-xl text-white active:bg-white/20">→</button>
            <button type="button" onClick={hardDrop} className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/10 text-xl text-white active:bg-white/20">⤓</button>
          </div>
        )}
      </div>
    </div>
  );
}
