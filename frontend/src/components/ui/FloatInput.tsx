import { useRef } from "react";

export function FloatInput({
  id, type = "text", value, onChange, label, autoComplete, required,
  icon, rightSlot, error,
}: {
  id: string; type?: string; value: string; onChange: (v: string) => void;
  label: string; autoComplete?: string; required?: boolean;
  icon: React.ReactNode; rightSlot?: React.ReactNode; error?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const active = value.length > 0 || document.activeElement === ref.current;
  return (
    <div className="group relative">
      <div
        onClick={() => ref.current?.focus()}
        className={`flex cursor-text items-center gap-3 rounded-xl border-2 bg-slate-50 px-4 py-3.5 transition-all duration-200 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(29,106,78,0.08)] ${
          error ? "border-red-300 focus-within:border-red-400" : "border-transparent focus-within:border-brand-500"
        }`}
      >
        <span className="text-slate-400 transition-colors group-focus-within:text-brand-600">{icon}</span>
        <div className="relative flex-1">
          <label
            htmlFor={id}
            className="pointer-events-none absolute left-0 origin-left text-sm text-slate-400 transition-all duration-200"
            style={{
              top: active ? "-10px" : "50%",
              transform: active ? "translateY(0) scale(0.75)" : "translateY(-50%) scale(1)",
              color: active ? (error ? "#dc2626" : "#1d6a4e") : undefined,
            }}
          >
            {label}
          </label>
          <input
            ref={ref}
            id={id}
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoComplete={autoComplete}
            required={required}
            className="w-full bg-transparent pt-2.5 text-sm text-ink-900 outline-none placeholder:text-transparent"
            placeholder={label}
          />
        </div>
        {rightSlot}
      </div>
      <div
        className="mx-4 h-0.5 rounded-full transition-all duration-300"
        style={{
          background: error ? "#dc2626" : "#1d6a4e",
          opacity: active ? 1 : 0,
          transform: active ? "scaleX(1)" : "scaleX(0)",
        }}
      />
      {error && <p className="mt-1.5 px-4 text-xs text-red-600">{error}</p>}
    </div>
  );
}
