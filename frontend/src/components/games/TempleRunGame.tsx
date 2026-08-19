import { useRef, useEffect, useState, useCallback } from "react";

const LANES = [-1, 0, 1];
const LANE_WIDTH = 70;
const HORIZON_Y = 0.38;
const PLAYER_Y = 0.82;

interface Obstacle {
  z: number;
  lane: number;
  type: "block" | "low" | "tall";
  passed: boolean;
}

interface Coin {
  z: number;
  lane: number;
  collected: boolean;
}

export function TempleRunGame({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [distance, setDistance] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const stateRef = useRef({
    lane: 0,
    targetLane: 0,
    z: 0,
    speed: 0.12,
    jumping: false,
    jumpZ: 0,
    slide: false,
    slideTimer: 0,
    obstacles: [] as Obstacle[],
    coins: [] as Coin[],
    score: 0,
    distance: 0,
    spawnTimer: 0,
    coinTimer: 0,
    running: true,
    shakeTimer: 0,
    shakeIntensity: 0,
  });

  const spawn = useCallback(() => {
    const s = stateRef.current;
    const lane = LANES[Math.floor(Math.random() * 3)];
    const types: Obstacle["type"][] = ["block", "low", "tall"];
    const type = types[Math.floor(Math.random() * types.length)];
    s.obstacles.push({ z: s.z + 30 + Math.random() * 20, lane, type, passed: false });
  }, []);

  const spawnCoin = useCallback(() => {
    const s = stateRef.current;
    const lane = LANES[Math.floor(Math.random() * 3)];
    s.coins.push({ z: s.z + 25 + Math.random() * 30, lane, collected: false });
  }, []);

  const restart = () => {
    const s = stateRef.current;
    s.lane = 0; s.targetLane = 0; s.z = 0; s.speed = 0.12;
    s.jumping = false; s.jumpZ = 0; s.slide = false; s.slideTimer = 0;
    s.obstacles = []; s.coins = []; s.score = 0; s.distance = 0;
    s.spawnTimer = 0; s.coinTimer = 0; s.running = true;
    s.shakeTimer = 0; s.shakeIntensity = 0;
    setScore(0); setDistance(0); setGameOver(false);
  };

  const moveLeft = useCallback(() => {
    const s = stateRef.current;
    if (!s.running) return;
    s.targetLane = Math.max(-1, s.targetLane - 1);
  }, []);

  const moveRight = useCallback(() => {
    const s = stateRef.current;
    if (!s.running) return;
    s.targetLane = Math.min(1, s.targetLane + 1);
  }, []);

  const jump = useCallback(() => {
    const s = stateRef.current;
    if (!s.running || s.jumping) return;
    s.jumping = true;
    s.jumpZ = 0;
  }, []);

  const slideDown = useCallback(() => {
    const s = stateRef.current;
    if (!s.running || s.slide) return;
    s.slide = true;
    s.slideTimer = 0;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;
    let last = 0;

    const W = canvas.width;
    const H = canvas.height;
    const horizY = H * HORIZON_Y;
    const playerBaseY = H * PLAYER_Y;

    function project(z: number, laneX: number): { x: number; y: number; scale: number } {
      const s = stateRef.current;
      const dz = z - s.z;
      if (dz <= 0) return { x: W / 2, y: horizY, scale: 0 };
      const perspective = 20 / dz;
      const x = W / 2 + (laneX * LANE_WIDTH * perspective * 3);
      const y = horizY + (playerBaseY - horizY) * perspective * 2.5;
      return { x, y, scale: perspective * 2.5 };
    }

    const draw = (now: number) => {
      const dt = Math.min(now - last, 50);
      last = now;
      const s = stateRef.current;

      if (s.running) {
        s.z += s.speed * dt * 0.06;
        s.distance = Math.floor(s.z);
        setDistance(s.distance);

        // Lane smoothing
        s.lane += (s.targetLane - s.lane) * 0.15;

        // Jump physics
        if (s.jumping) {
          s.jumpZ += 0.08 * dt;
          if (s.jumpZ >= 1) { s.jumping = false; s.jumpZ = 0; }
        }

        // Slide timer
        if (s.slide) {
          s.slideTimer += dt;
          if (s.slideTimer > 600) { s.slide = false; s.slideTimer = 0; }
        }

        // Spawn obstacles
        s.spawnTimer += dt;
        const spawnRate = Math.max(800, 2000 - s.z * 2);
        if (s.spawnTimer > spawnRate) { s.spawnTimer = 0; spawn(); }

        // Spawn coins
        s.coinTimer += dt;
        if (s.coinTimer > 1200) { s.coinTimer = 0; spawnCoin(); }

        // Speed increase
        s.speed = Math.min(0.35, 0.12 + s.z * 0.0001);

        // Collision detection
        for (const obs of s.obstacles) {
          if (obs.passed) continue;
          const dz = obs.z - s.z;
          if (dz < 0.3 && dz > -0.3) {
            const sameLane = Math.abs(s.lane - obs.lane) < 0.5;
            if (sameLane) {
              if (obs.type === "block" && !s.jumping) {
                s.running = false; setGameOver(true);
                s.shakeTimer = 300; s.shakeIntensity = 8;
                if (s.score > highScore) setHighScore(s.score);
              } else if (obs.type === "low" && !s.jumping) {
                s.running = false; setGameOver(true);
                s.shakeTimer = 300; s.shakeIntensity = 8;
                if (s.score > highScore) setHighScore(s.score);
              } else if (obs.type === "tall" && !s.slide) {
                s.running = false; setGameOver(true);
                s.shakeTimer = 300; s.shakeIntensity = 8;
                if (s.score > highScore) setHighScore(s.score);
              }
            }
          }
          if (dz < -1) obs.passed = true;
        }

        // Coin collection
        for (const coin of s.coins) {
          if (coin.collected) continue;
          const dz = coin.z - s.z;
          if (dz < 0.5 && dz > -0.5 && Math.abs(s.lane - coin.lane) < 0.5) {
            coin.collected = true;
            s.score += 10;
            setScore(s.score);
          }
        }

        // Clean up passed objects
        s.obstacles = s.obstacles.filter((o) => o.z > s.z - 5);
        s.coins = s.coins.filter((c) => c.z > s.z - 5);

        // Distance score
        if (Math.floor(s.z) % 5 === 0) { s.score = Math.max(s.score, Math.floor(s.z)); setScore(s.score); }

        // Shake decay
        if (s.shakeTimer > 0) s.shakeTimer -= dt;
      }

      // ── DRAW ──
      const shakeX = s.shakeTimer > 0 ? (Math.random() - 0.5) * s.shakeIntensity : 0;
      const shakeY = s.shakeTimer > 0 ? (Math.random() - 0.5) * s.shakeIntensity : 0;

      ctx.save();
      ctx.translate(shakeX, shakeY);

      // Sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizY);
      skyGrad.addColorStop(0, "#0f172a");
      skyGrad.addColorStop(1, "#1e3a5f");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, horizY);

      // Ground
      const groundGrad = ctx.createLinearGradient(0, horizY, 0, H);
      groundGrad.addColorStop(0, "#1a3a2a");
      groundGrad.addColorStop(1, "#0f2a1a");
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, horizY, W, H - horizY);

      // Road stripes (perspective)
      const drawRange = 60;
      for (let dz = drawRange; dz > 0; dz -= 1.5) {
        const z = s.z + dz;
        const left = project(z, -1.5);
        const right = project(z, 1.5);
        if (left.scale <= 0) continue;

        // Road surface
        ctx.fillStyle = dz % 3 < 1.5 ? "#2d3748" : "#1a202c";
        ctx.beginPath();
        const prevLeft = project(z + 1.5, -1.5);
        const prevRight = project(z + 1.5, 1.5);
        ctx.moveTo(prevLeft.x, prevLeft.y);
        ctx.lineTo(prevRight.x, prevRight.y);
        ctx.lineTo(right.x, right.y);
        ctx.lineTo(left.x, left.y);
        ctx.fill();

        // Center dashes
        if (dz % 3 < 1.5) {
          const centerL = project(z, -0.05);
          const centerR = project(z, 0.05);
          ctx.fillStyle = "rgba(255,255,255,0.3)";
          ctx.fillRect(centerL.x, centerL.y - 1, centerR.x - centerL.x, 2);
        }

        // Lane dividers
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = 1;
        const div1 = project(z, -0.5);
        const div2 = project(z, 0.5);
        ctx.beginPath(); ctx.moveTo(div1.x, div1.y); ctx.lineTo(div1.x, div1.y + 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(div2.x, div2.y); ctx.lineTo(div2.x, div2.y + 2); ctx.stroke();
      }

      // Road edges
      const edgeL1 = project(s.z + drawRange, -1.5);
      const edgeR1 = project(s.z + drawRange, 1.5);
      const edgeL2 = project(s.z, -1.5);
      const edgeR2 = project(s.z, 1.5);
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(edgeL1.x, edgeL1.y); ctx.lineTo(edgeL2.x, edgeL2.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(edgeR1.x, edgeR1.y); ctx.lineTo(edgeR2.x, edgeR2.y); ctx.stroke();

      // Obstacles (draw back to front)
      const sortedObs = [...s.obstacles].sort((a, b) => b.z - a.z);
      for (const obs of sortedObs) {
        const dz = obs.z - s.z;
        if (dz < 0 || dz > drawRange) continue;
        const p = project(obs.z, obs.lane);
        if (p.scale <= 0) continue;
        const w = 40 * p.scale;
        const h = (obs.type === "tall" ? 60 : 40) * p.scale;

        if (obs.type === "block") {
          ctx.fillStyle = "#dc2626";
          ctx.fillRect(p.x - w / 2, p.y - h, w, h);
          ctx.fillStyle = "#b91c1c";
          ctx.fillRect(p.x - w / 2, p.y - h, w, h * 0.3);
        } else if (obs.type === "low") {
          ctx.fillStyle = "#f59e0b";
          ctx.fillRect(p.x - w / 2, p.y - h * 0.5, w, h * 0.5);
          ctx.fillStyle = "#d97706";
          ctx.fillRect(p.x - w / 2, p.y - h * 0.5, w, h * 0.15);
        } else {
          ctx.fillStyle = "#7c3aed";
          ctx.fillRect(p.x - w / 2, p.y - h, w, h);
          ctx.fillStyle = "#6d28d9";
          ctx.fillRect(p.x - w / 2, p.y - h, w, h * 0.2);
          ctx.fillStyle = "#5b21b6";
          ctx.fillRect(p.x - w / 2 - 3 * p.scale, p.y - h * 0.3, 3 * p.scale, h * 0.3);
        }
      }

      // Coins
      for (const coin of s.coins) {
        if (coin.collected) continue;
        const dz = coin.z - s.z;
        if (dz < 0 || dz > drawRange) continue;
        const p = project(coin.z, coin.lane);
        if (p.scale <= 0) continue;
        const r = 8 * p.scale;
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.arc(p.x, p.y - 20 * p.scale, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.arc(p.x, p.y - 20 * p.scale, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Player
      const playerP = project(s.z + 2, s.lane);
      const pScale = playerP.scale;
      const pW = 24 * pScale;
      const pH = (s.slide ? 20 : 44) * pScale;
      const pY = playerP.y - pH - (s.jumping ? Math.sin(s.jumpZ * Math.PI) * 60 * pScale : 0);

      // Player shadow
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(playerP.x, playerP.y, pW * 0.8, 4 * pScale, 0, 0, Math.PI * 2);
      ctx.fill();

      // Player body
      const bodyGrad = ctx.createLinearGradient(playerP.x - pW / 2, pY, playerP.x + pW / 2, pY + pH);
      bodyGrad.addColorStop(0, "#10b981");
      bodyGrad.addColorStop(1, "#059669");
      ctx.fillStyle = bodyGrad;
      ctx.fillRect(playerP.x - pW / 2, pY, pW, pH);

      // Player head
      if (!s.slide) {
        ctx.fillStyle = "#34d399";
        ctx.beginPath();
        ctx.arc(playerP.x, pY - 6 * pScale, 10 * pScale, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [spawn, spawnCoin, highScore]);

  // Controls
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") moveLeft();
      else if (e.key === "ArrowRight") moveRight();
      else if (e.key === "ArrowUp") jump();
      else if (e.key === "ArrowDown") slideDown();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [moveLeft, moveRight, jump, slideDown]);

  const touchRef = useRef({ x: 0, y: 0, time: 0 });
  const handleTouchStart = (e: React.TouchEvent) => {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    const dy = e.changedTouches[0].clientY - touchRef.current.y;
    const dt = Date.now() - touchRef.current.time;
    if (Math.abs(dx) < 15 && Math.abs(dy) < 15 && dt < 200) return; // tap, ignore
    if (Math.abs(dx) > Math.abs(dy)) { dx > 0 ? moveRight() : moveLeft(); }
    else { dy < 0 ? jump() : slideDown(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">
      <div className="flex items-center justify-between px-4 py-2">
        <button type="button" onClick={onBack} className="text-sm font-medium text-white/60">← Games</button>
        <span className="text-sm font-bold text-white">Temple Run</span>
        <button type="button" onClick={onClose} className="text-white/60">✕</button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="flex w-full justify-between px-4" style={{ maxWidth: "400px" }}>
          <p className="text-xs font-bold tabular-nums text-white/70">Score: {score}</p>
          <p className="text-xs font-bold tabular-nums text-white/70">Best: {highScore}</p>
        </div>
        <canvas
          ref={canvasRef}
          width={360}
          height={500}
          className="touch-none"
          style={{ maxWidth: "100%", maxHeight: "70vh" }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        />
        {gameOver && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-lg font-bold text-red-400">Game Over!</p>
            <p className="text-sm text-white/60">Distance: {distance}m · Score: {score}</p>
            <button type="button" onClick={restart} className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-bold text-white">Run Again</button>
          </div>
        )}
        {!gameOver && (
          <div className="flex gap-2">
            <button type="button" onClick={moveLeft} className="flex h-14 w-14 items-center justify-center rounded-lg bg-white/10 text-xl text-white active:bg-white/20">←</button>
            <button type="button" onClick={jump} className="flex h-14 w-14 items-center justify-center rounded-lg bg-white/10 text-xl text-white active:bg-white/20">↑</button>
            <button type="button" onClick={slideDown} className="flex h-14 w-14 items-center justify-center rounded-lg bg-white/10 text-xl text-white active:bg-white/20">↓</button>
            <button type="button" onClick={moveRight} className="flex h-14 w-14 items-center justify-center rounded-lg bg-white/10 text-xl text-white active:bg-white/20">→</button>
          </div>
        )}
        <p className="mt-2 text-[0.6rem] text-white/30">Swipe or use buttons · Jump ↑ · Slide ↓ · Dodge ← →</p>
      </div>
    </div>
  );
}
