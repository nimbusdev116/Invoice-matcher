interface ToggleProps {
  enabled: boolean
  onChange: (enabled: boolean) => void
  label?: string
  description?: string
  size?: 'sm' | 'md'
}

export function Toggle({ enabled, onChange, label, description, size = 'md' }: ToggleProps) {
  const trackSize = size === 'sm' ? 'w-8 h-[18px]' : 'w-10 h-[22px]'
  const thumbSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'
  const thumbTranslate = size === 'sm' ? 'translate-x-[14px]' : 'translate-x-[18px]'

  return (
    <label className="inline-flex items-center gap-2.5 cursor-pointer select-none group">
      <button
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex shrink-0 ${trackSize} items-center rounded-full transition-colors duration-200 focus:outline-none ${
          enabled
            ? 'bg-green'
            : 'bg-s3 group-hover:bg-border'
        }`}
      >
        <span
          className={`${thumbSize} rounded-full bg-white shadow-sm transition-transform duration-200 ${
            enabled ? thumbTranslate : 'translate-x-[3px]'
          }`}
        />
      </button>
      {(label || description) && (
        <div className="flex flex-col">
          {label && <span className="text-xs text-text font-medium leading-tight">{label}</span>}
          {description && <span className="text-[10px] text-muted leading-tight">{description}</span>}
        </div>
      )}
    </label>
  )
}

export default Toggle
