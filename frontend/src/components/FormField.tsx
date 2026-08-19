import { useId } from "react";
import type { ReactNode } from "react";

export function Field({
  label,
  error,
  required = false,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode | ((id: string) => ReactNode);
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {typeof children === "function" ? children(id) : children}
      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Text input bound to a form state object key. */
export function TextField({
  label,
  value,
  onChange,
  error,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <Field label={label} error={error}>
      <input
        id={id}
        type={type}
        className="input"
        value={value}
        required={required}
        placeholder={placeholder}
        aria-invalid={!!error}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
