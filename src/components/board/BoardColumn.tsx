import type { Order, OrderChannel } from '../../types'
import { CHANNEL_CONFIG, BOARD_STATUSES } from '../../types'
import OrderCard from './OrderCard'

const COL_STYLES: Record<string, { border: string; headBg: string; titleColor: string; countBg: string; countColor: string }> = {
  blue: {
    border: 'border-blue/25',
    headBg: 'bg-blue/[0.06]',
    titleColor: 'text-blue',
    countBg: 'bg-blue-d',
    countColor: 'text-blue',
  },
  purple: {
    border: 'border-purple/25',
    headBg: 'bg-purple/[0.06]',
    titleColor: 'text-purple',
    countBg: 'bg-purple-d',
    countColor: 'text-purple',
  },
  amber: {
    border: 'border-amber/25',
    headBg: 'bg-amber/[0.06]',
    titleColor: 'text-amber',
    countBg: 'bg-amber-d',
    countColor: 'text-amber',
  },
  red: {
    border: 'border-red/25',
    headBg: 'bg-red/[0.06]',
    titleColor: 'text-red',
    countBg: 'bg-red-d',
    countColor: 'text-red',
  },
}

interface Props {
  channel: OrderChannel
  orders: Order[]
  allOrdersForChannel: Order[]
  onAdvance: (id: string) => void
  onProcess: (id: string) => void
  onCardClick: (id: string) => void
}

export default function BoardColumn({
  channel,
  orders,
  allOrdersForChannel,
  onAdvance,
  onProcess,
  onCardClick,
}: Props) {
  const config = CHANNEL_CONFIG[channel]
  const style = COL_STYLES[config.colorClass]
  const totalCount = allOrdersForChannel.filter((o) => BOARD_STATUSES.includes(o.status)).length
  const needsZoho = channel === 'manual'
    ? allOrdersForChannel.filter((o) => !o.reference_number && BOARD_STATUSES.includes(o.status)).length
    : 0

  return (
    <div className={`flex flex-col min-h-0 rounded-xl overflow-hidden bg-s1 border ${style.border}`}>
      <div className={`px-4 pt-3.5 pb-3 shrink-0 border-b border-border ${style.headBg}`}>
        <div className="flex items-center">
          <div className={`text-sm font-bold ${style.titleColor}`}>{config.label}</div>
          <div
            className={`ml-2 inline-flex items-center justify-center w-[22px] h-[22px] rounded-md text-[11px] font-bold ${style.countBg} ${style.countColor}`}
          >
            {totalCount}
          </div>
        </div>
        <div className="text-[11px] text-muted mt-0.5">
          {needsZoho > 0 ? (
            <span className="text-red opacity-70">{needsZoho} need Zoho SO</span>
          ) : (
            config.sub
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 pb-4">
        {orders.length > 0 ? (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onAdvance={onAdvance}
              onProcess={onProcess}
              onClick={onCardClick}
            />
          ))
        ) : (
          <div className="py-6 px-3 text-center text-muted text-xs">
            <div className="mb-2 opacity-40 flex justify-center"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg></div>
            All clear
          </div>
        )}
      </div>
    </div>
  )
}
