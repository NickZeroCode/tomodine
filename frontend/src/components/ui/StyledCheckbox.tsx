export function StyledCheckbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all duration-200 ${
          checked ? "border-brand-600 bg-brand-600" : "border-slate-300 bg-white hover:border-slate-400"
        }`}
      >
        {checked && (
          <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3 text-white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 6l2.5 2.5 4.5-5" />
          </svg>
        )}
      </span>
      <span className="text-sm text-ink-600">{label}</span>
    </label>
  );
}
