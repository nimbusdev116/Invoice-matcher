import type { Order, OrderChannel } from '../../types'
import { CHANNEL_CONFIG, BOARD_STATUSES } from '../../types'
import OrderCard from './OrderCard'

const COL_STYLES: Record<string, { border: string; headBg: string; titleColor: string; countBg: string; countColor: string }> = {
  blue: {
    border: 'border-blue/20',
    headBg: 'bg-blue/[0.04]',
    titleColor: 'text-blue',
    countBg: 'bg-blue/12',
    countColor: 'text-blue',
  },
  purple: {
    border: 'border-purple/20',
    headBg: 'bg-purple/[0.04]',
    titleColor: 'text-purple',
    countBg: 'bg-purple/12',
    countColor: 'text-purple',
  },
  amber: {
    border: 'border-amber/20',
    headBg: 'bg-amber/[0.04]',
    titleColor: 'text-amber',
    countBg: 'bg-amber/12',
    countColor: 'text-amber',
  },
  red: {
    border: 'border-red/20',
    headBg: 'bg-red/[0.04]',
    titleColor: 'text-red',
    countBg: 'bg-red/12',
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
      <div className={`px-4 pt-3.5 pb-3 shrink-0 border-b border-border/50 ${style.headBg}`}>
        <div className="flex items-center gap-2">
          <div className={`text-sm font-semibold ${style.titleColor}`}>{config.label}</div>
          <div
            className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-md text-[10px] font-bold ${style.countBg} ${style.countColor}`}
          >
            {totalCount}
          </div>
        </div>
        <div className="text-[10px] text-muted/50 mt-0.5">
          {needsZoho > 0 ? (
            <span className="text-red/70">{needsZoho} need Zoho SO</span>
          ) : (
            config.sub
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 pb-4">
        {orders.length > 0 ? (
          orders.map((order, i) => (
            <div key={order.id} style={{ animation: `fadeIn ${0.1 + i * 0.03}s ease-out` }}>
              <OrderCard
                order={order}
                onAdvance={onAdvance}
                onProcess={onProcess}
                onClick={onCardClick}
              />
            </div>
          ))
        ) : (
          <div className="py-8 px-3 text-center text-muted/40">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-xs">All clear</div>
          </div>
        )}
      </div>
    </div>
  )
}
