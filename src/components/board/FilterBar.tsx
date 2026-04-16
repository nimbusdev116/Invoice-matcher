import type { OrderStatus } from '../../types'

export type FilterMode = 'all' | OrderStatus
export type SortMode = 'age-desc' | 'age-asc' | 'val-desc'

interface Props {
  filter: FilterMode
  sort: SortMode
  onFilterChange: (f: FilterMode) => void
  onSortChange: (s: SortMode) => void
}

const PILLS: { mode: FilterMode; label: string; cls: string }[] = [
  { mode: 'all', label: 'All stages', cls: 'all' },
  { mode: 'pending', label: 'Pending', cls: 'pending' },
  { mode: 'processing', label: 'Processing', cls: 'processing' },
  { mode: 'pending_shipment', label: 'Pending shipment', cls: 'shipment' },
]

const PILL_ACTIVE: Record<string, string> = {
  all: 'bg-white/[0.07] text-text border-border2',
  pending: 'bg-amber-d text-amber border-amber/40',
  processing: 'bg-blue-d text-blue border-blue/40',
  shipment: 'bg-orange-d text-orange border-orange/40',
}

export default function FilterBar({ filter, sort, onFilterChange, onSortChange }: Props) {
  return (
    <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-s1 shrink-0">
      <span className="text-[11px] text-muted mr-1">Show:</span>
      {PILLS.map((p) => (
        <button
          key={p.mode}
          onClick={() => onFilterChange(p.mode)}
          className={`px-3.5 py-1 rounded-full border text-xs cursor-pointer transition-all ${
            filter === p.mode
              ? `font-semibold ${PILL_ACTIVE[p.cls]}`
              : 'border-border text-muted hover:border-border2 hover:text-text'
          }`}
        >
          {p.label}
        </button>
      ))}
      <div className="flex-1" />
      <span className="text-[11px] text-muted">Sort:</span>
      <select
        value={sort}
        onChange={(e) => onSortChange(e.target.value as SortMode)}
        className="bg-s2 border border-border rounded-md px-2.5 py-1 text-text text-xs outline-none"
      >
        <option value="age-desc">Oldest first</option>
        <option value="age-asc">Newest first</option>
        <option value="val-desc">Value: high → low</option>
      </select>
    </div>
  )
}
