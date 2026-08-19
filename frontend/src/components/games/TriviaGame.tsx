import { useState, useCallback } from "react";

interface Question {
  q: string;
  options: string[];
  answer: number;
  category: string;
}

const QUESTIONS: Question[] = [
  { q: "What is the national fruit of Bangladesh?", options: ["Mango", "Banana", "Jackfruit", "Litchi"], answer: 2, category: "🇧🇩 Culture" },
  { q: "How many seasons does Bangladesh have?", options: ["4", "5", "6", "3"], answer: 2, category: "🌍 Geography" },
  { q: "What is the currency of Bangladesh?", options: ["Rupee", "Taka", "Riyal", "Dollar"], answer: 1, category: "💰 Money" },
  { q: "Which river is the longest in Bangladesh?", options: ["Padma", "Meghna", "Jamuna", "Brahmaputra"], answer: 2, category: "🌍 Geography" },
  { q: "What is the capital of Bangladesh?", options: ["Chittagong", "Sylhet", "Dhaka", "Khulna"], answer: 2, category: "🌍 Geography" },
  { q: "What does 'Bhàt' mean in Bengali?", options: ["Fish", "Rice", "Water", "Bread"], answer: 1, category: "🗣️ Language" },
  { q: "Which sport is most popular in Bangladesh?", options: ["Football", "Cricket", "Hockey", "Tennis"], answer: 1, category: "⚽ Sports" },
  { q: "What is the Sundarbans famous for?", options: ["Tigers", "Elephants", "Mountains", "Deserts"], answer: 0, category: "🌍 Geography" },
  { q: "How many divisions does Bangladesh have?", options: ["5", "6", "7", "8"], answer: 3, category: "🇧🇩 Culture" },
  { q: "What is 'Hilsa' in Bangladesh?", options: ["A dance", "A fish", "A river", "A mountain"], answer: 1, category: "🍽️ Food" },
  { q: "What is the national flower of Bangladesh?", options: ["Rose", "Lotus", "Water Lily", "Sunflower"], answer: 2, category: "🇧🇩 Culture" },
  { q: "Which city is known as the 'City of Mosques'?", options: ["Sylhet", "Dhaka", "Chittagong", "Rajshahi"], answer: 1, category: "🇧🇩 Culture" },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function TriviaGame({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const [questions] = useState(() => shuffle(QUESTIONS).slice(0, 8));
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const select = useCallback((idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    if (idx === questions[current].answer) setScore((s) => s + 1);
    setTimeout(() => {
      if (current + 1 >= questions.length) setDone(true);
      else { setCurrent((c) => c + 1); setSelected(null); }
    }, 1200);
  }, [selected, current, questions]);

  const restart = () => { setCurrent(0); setSelected(null); setScore(0); setDone(false); };

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">
        <div className="flex items-center justify-between px-4 py-2">
          <button type="button" onClick={onBack} className="text-sm font-medium text-white/60">← Games</button>
          <span className="text-sm font-bold text-white">Trivia</span>
          <button type="button" onClick={onClose} className="text-white/60">✕</button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
          <p className="text-4xl">🏆</p>
          <h3 className="font-display text-xl font-bold text-white">Quiz Complete!</h3>
          <p className="text-lg text-white/70">Score: <span className="font-bold text-emerald-400">{score}</span> / {questions.length}</p>
          <p className="text-sm text-white/50">
            {score === questions.length ? "Perfect score! 🌟" : score >= questions.length / 2 ? "Well done! 👏" : "Try again! 💪"}
          </p>
          <button type="button" onClick={restart} className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-bold text-white">Play Again</button>
        </div>
      </div>
    );
  }

  const q = questions[current];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">
      <div className="flex items-center justify-between px-4 py-2">
        <button type="button" onClick={onBack} className="text-sm font-medium text-white/60">← Games</button>
        <span className="text-sm font-bold text-white">Trivia</span>
        <button type="button" onClick={onClose} className="text-white/60">✕</button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6">
        <div className="flex w-full max-w-sm items-center justify-between">
          <span className="text-xs text-white/50">{q.category}</span>
          <span className="text-xs tabular-nums text-white/50">{current + 1} / {questions.length}</span>
        </div>
        <div className="w-full max-w-sm rounded-xl bg-white/5 p-5">
          <h3 className="text-center text-base font-semibold text-white">{q.q}</h3>
        </div>
        <div className="w-full max-w-sm space-y-2.5">
          {q.options.map((opt, i) => {
            const isCorrect = i === q.answer;
            const isSelected = i === selected;
            let bg = "#334155";
            if (selected !== null) {
              if (isCorrect) bg = "#059669";
              else if (isSelected && !isCorrect) bg = "#dc2626";
            }
            return (
              <button
                key={i}
                type="button"
                onClick={() => select(i)}
                disabled={selected !== null}
                className="w-full px-4 py-3 text-left text-sm font-medium text-white transition-all"
                style={{ borderRadius: "6px", background: bg }}
              >
                {opt}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-white/40">Answer together as a group!</p>
      </div>
    </div>
  );
}
