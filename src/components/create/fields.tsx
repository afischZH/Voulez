'use client'

import { useId } from 'react'

const base =
  'w-full rounded-lg border border-steel-600/70 bg-steel-900/60 px-4 py-3 text-parchment placeholder:text-fog-dim'

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-2xs text-fog-dim tracking-[0.22em] uppercase">{label}</span>
      {children}
      {hint && <span className="text-fog-dim mt-1.5 block text-sm">{hint}</span>}
    </label>
  )
}

export function TextInput({
  label,
  hint,
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <input {...props} className={`${base} mt-2 ${className}`} />
    </Field>
  )
}

export function TextArea({
  label,
  hint,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <textarea {...props} className={`${base} mt-2`} />
    </Field>
  )
}

export function Choice({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (next: string) => void
}) {
  const name = useId()
  return (
    <fieldset>
      <legend className="text-2xs text-fog-dim tracking-[0.22em] uppercase">
        {label}
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={`cursor-pointer rounded-lg border px-4 py-2.5 text-sm transition-colors ${
              value === option.value
                ? 'border-brass bg-brass/16 text-brass-bright'
                : 'border-steel-600/70 text-fog hover:border-brass/50'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
