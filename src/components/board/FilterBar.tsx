import type { OrderStatus } from '../../types'

export type FilterMode = 'all' | OrderStatus
export type SortMode = 'age-desc' | 'age-asc' | 'val-desc'

interface Props {
  filter: FilterMode
  sort: SortMode
  onFilterChange: (f: FilterMode) => void
  onSortChange: (s: SortMode) => void
}

const PILLS: { mode: FilterMode; label: string; activeClass: string }[] = [
  { mode: 'all', label: 'All stages', activeClass: 'bg-white/[0.08] text-text border-white/[0.12]' },
  { mode: 'pending', label: 'Pending', activeClass: 'bg-amber/12 text-amber border-amber/25' },
  { mode: 'processing', label: 'Processing', activeClass: 'bg-blue/12 text-blue border-blue/25' },
  { mode: 'awaiting_shipment', label: 'Awaiting shipment', activeClass: 'bg-orange/12 text-orange border-orange/25' },
]

export default function FilterBar({ filter, sort, onFilterChange, onSortChange }: Props) {
  return (
    <div className="flex items-center gap-2 px-6 py-2.5 border-b border-border bg-s1/50 shrink-0">
      <span className="text-[10px] text-muted/50 uppercase tracking-wider font-semibold mr-1">Filter</span>
      {PILLS.map((p) => (
        <button
          key={p.mode}
          onClick={() => onFilterChange(p.mode)}
          className={`px-3 py-1 rounded-lg border text-[11px] cursor-pointer transition-all duration-150 ${
            filter === p.mode
              ? `font-semibold ${p.activeClass}`
              : 'border-transparent text-muted hover:text-text hover:bg-white/[0.03]'
          }`}
        >
          {p.label}
        </button>
      ))}
      <div className="flex-1" />
      <span className="text-[10px] text-muted/50 uppercase tracking-wider font-semibold">Sort</span>
      <select
        value={sort}
        onChange={(e) => onSortChange(e.target.value as SortMode)}
        className="bg-s2 border border-border rounded-lg px-2.5 py-1 text-text text-[11px] outline-none cursor-pointer focus:border-blue/40 transition-all"
      >
        <option value="age-desc">Oldest first</option>
        <option value="age-asc">Newest first</option>
        <option value="val-desc">Value: high to low</option>
      </select>
    </div>
  )
}
