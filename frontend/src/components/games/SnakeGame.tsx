import { useRef, useEffect, useState, useCallback } from "react";

const GRID = 20;
const CELL = 18;

export function SnakeGame({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const stateRef = useRef({
    snake: [{ x: 10, y: 10 }],
    food: { x: 15, y: 15 },
    dir: { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    running: true,
    score: 0,
    timer: 0,
    speed: 150,
  });

  const placeFood = useCallback(() => {
    const s = stateRef.current;
    let pos: { x: number; y: number };
    do {
      pos = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
    } while (s.snake.some((p) => p.x === pos.x && p.y === pos.y));
    s.food = pos;
  }, []);

  const restart = () => {
    stateRef.current = { snake: [{ x: 10, y: 10 }], food: { x: 15, y: 15 }, dir: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 }, running: true, score: 0, timer: 0, speed: 150 };
    placeFood();
    setScore(0);
    setGameOver(false);
  };

  const step = useCallback(() => {
    const s = stateRef.current;
    if (!s.running) return;
    s.dir = s.nextDir;
    const head = { x: s.snake[0].x + s.dir.x, y: s.snake[0].y + s.dir.y };
    if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID || s.snake.some((p) => p.x === head.x && p.y === head.y)) {
      s.running = false;
      setGameOver(true);
      return;
    }
    s.snake.unshift(head);
    if (head.x === s.food.x && head.y === s.food.y) {
      s.score += 10;
      setScore(s.score);
      if (s.speed > 60) s.speed -= 2;
      placeFood();
    } else {
      s.snake.pop();
    }
  }, [placeFood]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;
    let last = 0;

    const draw = (now: number) => {
      const dt = now - last;
      const s = stateRef.current;
      if (s.running) {
        s.timer += dt;
        if (s.timer >= s.speed) { s.timer = 0; step(); }
      }
      last = now;

      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, GRID * CELL, GRID * CELL);

      // Grid
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 0.3;
      for (let i = 0; i <= GRID; i++) {
        ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, GRID * CELL); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(GRID * CELL, i * CELL); ctx.stroke();
      }

      // Border walls — clearly visible
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 3;
      ctx.strokeRect(1, 1, GRID * CELL - 2, GRID * CELL - 2);

      // Food
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(s.food.x * CELL + CELL / 2, s.food.y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
      ctx.fill();

      // Snake
      s.snake.forEach((p, i) => {
        ctx.fillStyle = i === 0 ? "#10b981" : "#34d399";
        ctx.fillRect(p.x * CELL + 1, p.y * CELL + 1, CELL - 2, CELL - 2);
      });

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  const setDir = useCallback((x: number, y: number) => {
    const s = stateRef.current;
    if (s.dir.x === -x && s.dir.y === -y) return;
    s.nextDir = { x, y };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") setDir(0, -1);
      else if (e.key === "ArrowDown") setDir(0, 1);
      else if (e.key === "ArrowLeft") setDir(-1, 0);
      else if (e.key === "ArrowRight") setDir(1, 0);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setDir]);

  const touchRef = useRef({ x: 0, y: 0 });
  const handleTouchStart = (e: React.TouchEvent) => { touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    const dy = e.changedTouches[0].clientY - touchRef.current.y;
    if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
    else setDir(0, dy > 0 ? 1 : -1);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">
      <div className="flex items-center justify-between px-4 py-2">
        <button type="button" onClick={onBack} className="text-sm font-medium text-white/60">← Games</button>
        <span className="text-sm font-bold text-white">Snake</span>
        <button type="button" onClick={onClose} className="text-white/60">✕</button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="text-sm font-bold tabular-nums text-white">Score: {score}</p>
        <canvas
          ref={canvasRef}
          width={GRID * CELL}
          height={GRID * CELL}
          className="touch-none"
          style={{ maxHeight: "60vh", maxWidth: "100%" }}
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
          <div className="grid grid-cols-3 gap-2" style={{ width: "150px" }}>
            <div />
            <button type="button" onClick={() => setDir(0, -1)} className="flex h-12 items-center justify-center rounded-lg bg-white/10 text-lg text-white active:bg-white/20">↑</button>
            <div />
            <button type="button" onClick={() => setDir(-1, 0)} className="flex h-12 items-center justify-center rounded-lg bg-white/10 text-lg text-white active:bg-white/20">←</button>
            <button type="button" onClick={() => setDir(0, 1)} className="flex h-12 items-center justify-center rounded-lg bg-white/10 text-lg text-white active:bg-white/20">↓</button>
            <button type="button" onClick={() => setDir(1, 0)} className="flex h-12 items-center justify-center rounded-lg bg-white/10 text-lg text-white active:bg-white/20">→</button>
          </div>
        )}
      </div>
    </div>
  );
}
