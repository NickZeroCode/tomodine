import { useState, useRef, useEffect } from "react";

export function WordChain({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const [words, setWords] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [players] = useState(["Player 1", "Player 2"]);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const lastWord = words.length > 0 ? words[words.length - 1] : "";
  const lastChar = lastWord ? lastWord[lastWord.length - 1].toLowerCase() : "";

  useEffect(() => {
    if (!gameOver) inputRef.current?.focus();
  }, [currentPlayer, gameOver]);

  const submit = () => {
    const word = input.trim().toLowerCase();
    if (!word) return;
    if (word.length < 2) { setError("Word must be at least 2 letters"); return; }
    if (words.includes(word)) { setError("Word already used!"); return; }
    if (lastChar && word[0] !== lastChar) {
      setError(`Word must start with "${lastChar.toUpperCase()}"`);
      return;
    }
    setWords((w) => [...w, word]);
    setInput("");
    setError(null);
    setCurrentPlayer((p) => (p + 1) % players.length);
  };

  const pass = () => {
    setCurrentPlayer((p) => (p + 1) % players.length);
    setError(null);
    setInput("");
  };

  const restart = () => { setWords([]); setInput(""); setError(null); setCurrentPlayer(0); setGameOver(false); };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">
      <div className="flex items-center justify-between px-4 py-2">
        <button type="button" onClick={onBack} className="text-sm font-medium text-white/60">← Games</button>
        <span className="text-sm font-bold text-white">Word Chain</span>
        <button type="button" onClick={onClose} className="text-white/60">✕</button>
      </div>
      <div className="flex flex-1 flex-col px-4">
        {/* Player indicator */}
        <div className="flex items-center justify-center gap-3 py-3">
          {players.map((p, i) => (
            <span
              key={i}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                i === currentPlayer ? "bg-emerald-600 text-white" : "bg-white/10 text-white/50"
              }`}
            >
              {p}
            </span>
          ))}
        </div>

        {/* Chain display */}
        <div className="flex-1 overflow-y-auto py-2">
          {words.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/40">Start a word, any word!</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {words.map((w, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span className={`inline-block rounded-lg px-3 py-1.5 text-sm font-medium ${
                    i % 2 === 0 ? "bg-blue-500/20 text-blue-300" : "bg-purple-500/20 text-purple-300"
                  }`}>
                    {w}
                  </span>
                  {i < words.length - 1 && (
                    <span className="text-white/30">→</span>
                  )}
                </span>
              ))}
            </div>
          )}
          {lastChar && (
            <p className="mt-3 text-center text-xs text-white/50">
              Next word must start with: <span className="font-bold text-emerald-400 text-base">{lastChar.toUpperCase()}</span>
            </p>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-white/10 py-3">
          {error && <p className="mb-2 text-center text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(null); }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={lastChar ? `Word starting with "${lastChar.toUpperCase()}"...` : "Type a word..."}
              className="flex-1 rounded-lg bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button type="button" onClick={submit} className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white active:scale-95">
              ✓
            </button>
            <button type="button" onClick={pass} className="rounded-lg bg-white/10 px-3 py-3 text-xs text-white/60 active:bg-white/20">
              Pass
            </button>
          </div>
          <button type="button" onClick={() => setGameOver(true)} className="mt-2 w-full text-center text-xs text-white/30">
            End game
          </button>
        </div>
      </div>

      {gameOver && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/60">
          <div className="mx-4 w-full max-w-sm rounded-xl bg-slate-800 p-6 text-center">
            <p className="text-2xl">📝</p>
            <h3 className="mt-2 font-display text-lg font-bold text-white">Game Over!</h3>
            <p className="mt-1 text-sm text-white/60">Total words: {words.length}</p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={restart} className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-bold text-white">Play Again</button>
              <button type="button" onClick={onBack} className="flex-1 rounded-lg bg-white/10 py-2 text-sm text-white/60">Back</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
