export type UserRole = 'admin' | 'manager' | 'rep' | 'driver'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  phone: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type OrderSource =
  | 'b2b_portal'
  | 'bwg_portal'
  | 'musgrave_portal'
  | 'mirakl'
  | 'whatsapp'
  | 'email'
  | 'manual'

export type OrderChannel = 'direct' | 'bwg' | 'musgrave' | 'manual'

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'awaiting_shipment'
  | 'shipped'
  | 'delivered'
  | 'cancelled'

export type FulfillmentMethod =
  | 'collection'
  | 'own_van'
  | 'an_post'
  | 'independent_express'

export interface Order {
  id: string
  so_number: string | null
  zoho_so_id: string | null
  zoho_invoice_id: string | null
  zoho_invoice_number: string | null
  reference_number: string | null
  customer_name: string
  customer_email: string | null
  customer_phone: string | null
  source: OrderSource
  channel: OrderChannel
  status: OrderStatus
  fulfillment_method: FulfillmentMethod | null
  value: number
  currency: string
  rep_id: string | null
  notes: string | null
  pod_required: boolean
  pod_received: boolean
  pod_url: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  shipped_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
}

export interface OrderStatusHistory {
  id: string
  order_id: string
  from_status: OrderStatus | null
  to_status: OrderStatus
  changed_by: string | null
  note: string | null
  created_at: string
}

export const SOURCE_LABELS: Record<OrderSource, string> = {
  b2b_portal: 'B2B Portal',
  bwg_portal: 'BWG Portal',
  musgrave_portal: 'Musgrave Portal',
  mirakl: 'Odoo / Mirakl',
  whatsapp: 'WhatsApp',
  email: 'Email',
  manual: 'Manual',
}

export const SOURCE_COLORS: Record<OrderSource, string> = {
  b2b_portal: '#58a6ff',
  bwg_portal: '#bc8cff',
  musgrave_portal: '#d29922',
  mirakl: '#f0883e',
  whatsapp: '#25D366',
  email: '#4285F4',
  manual: '#7d8590',
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  awaiting_shipment: 'Awaiting Shipment',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export const FULFILLMENT_LABELS: Record<FulfillmentMethod, string> = {
  collection: 'Collection',
  own_van: 'Own Van',
  an_post: 'An Post',
  independent_express: 'Ind. Express',
}


export const CHANNEL_CONFIG: Record<
  OrderChannel,
  { label: string; sub: string; colorClass: string }
> = {
  direct: { label: 'Direct', sub: 'B2B + Odoo orders', colorClass: 'blue' },
  bwg: { label: 'BWG', sub: 'BWG portal orders', colorClass: 'purple' },
  musgrave: { label: 'Musgrave', sub: 'Musgrave portal orders', colorClass: 'amber' },
  manual: { label: 'Manual', sub: 'Manually created orders', colorClass: 'red' },
}

export interface OrderMedia {
  id: string
  order_id: string
  media_type: 'image' | 'audio' | 'document'
  file_id: string | null
  file_url: string | null
  file_data: string | null
  mime_type: string | null
  analysis: string | null
  transcript: string | null
  telegram_chat_id: string | null
  telegram_message_id: string | null
  created_at: string
}

export const BOARD_STATUSES: OrderStatus[] = ['pending', 'processing', 'awaiting_shipment']

export const STATUS_FLOW: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'processing',
  processing: 'awaiting_shipment',
  awaiting_shipment: 'shipped',
}
