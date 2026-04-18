import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { formatEur, cn } from '../lib/utils'
import {
  type Order,
  type FulfillmentMethod,
  type PodSubmission,
  FULFILLMENT_LABELS,
} from '../types'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import FulfillmentIcon from '../components/ui/FulfillmentIcon'
import { useToast } from '../contexts/ToastContext'

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function getFileExtension(mime: string | null): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a',
    'application/pdf': 'pdf',
  }
  return map[mime || ''] || 'bin'
}

const COURIER_METHODS: FulfillmentMethod[] = ['an_post', 'independent_express']

export default function PodTracker() {
  const [orders, setOrders] = useState<Order[]>([])
  const [submissions, setSubmissions] = useState<PodSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [submissionFilter, setSubmissionFilter] = useState<'pending' | 'verified' | 'rejected' | 'all'>('pending')
  const [selectedSubmission, setSelectedSubmission] = useState<PodSubmission | null>(null)
  const { showToast } = useToast()

  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .in('fulfillment_method', COURIER_METHODS)
      .order('updated_at', { ascending: false })

    if (error) console.error('Failed to fetch courier orders', error)
    setOrders((data as Order[]) ?? [])
  }, [])

  const fetchSubmissions = useCallback(async () => {
    const { data, error } = await supabase
      .from('pod_submissions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) console.error('Failed to fetch POD submissions', error)
    setSubmissions((data as PodSubmission[]) ?? [])
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchOrders(), fetchSubmissions()]).finally(() => setLoading(false))
  }, [fetchOrders, fetchSubmissions])

  useEffect(() => {
    const channel = supabase
      .channel('pod-submissions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pod_submissions' }, () => {
        fetchSubmissions()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchSubmissions])

  // Keep selectedSubmission in sync when submissions update (e.g. realtime)
  useEffect(() => {
    if (selectedSubmission) {
      const updated = submissions.find(s => s.id === selectedSubmission.id)
      if (updated) setSelectedSubmission(updated)
      else setSelectedSubmission(null)
    }
  }, [submissions])

  async function handleMarkPodReceived(orderId: string) {
    setUpdatingIds((prev) => new Set(prev).add(orderId))

    const { error } = await supabase
      .from('orders')
      .update({ pod_received: true })
      .eq('id', orderId)

    if (error) {
      showToast('Failed to mark POD received', 'error')
    } else {
      showToast('POD marked as received', 'success')
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, pod_received: true } : o))
      )
    }

    setUpdatingIds((prev) => {
      const next = new Set(prev)
      next.delete(orderId)
      return next
    })
  }

  async function handleSubmissionStatus(id: string, status: 'verified' | 'rejected') {
    setUpdatingIds((prev) => new Set(prev).add(id))

    try {
      const res = await fetch(`/api/pod-submissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!res.ok) throw new Error('Failed to update')

      showToast(`POD ${status === 'verified' ? 'verified' : 'rejected'}`, status === 'verified' ? 'success' : 'error')
      setSubmissions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status } : s))
      )
      if (selectedSubmission?.id === id) {
        setSelectedSubmission((prev) => prev ? { ...prev, status } : null)
      }
    } catch {
      showToast('Failed to update POD status', 'error')
    }

    setUpdatingIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  async function handleDelete(id: string) {
    setDeletingIds((prev) => new Set(prev).add(id))

    try {
      const res = await fetch(`/api/pod-submissions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')

      showToast('POD submission deleted', 'success')
      setSubmissions((prev) => prev.filter((s) => s.id !== id))
      if (selectedSubmission?.id === id) setSelectedSubmission(null)
    } catch {
      showToast('Failed to delete POD submission', 'error')
    }

    setDeletingIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  async function handleDownload(submission: PodSubmission) {
    try {
      const res = await fetch(`/api/pod-media/${submission.id}`)
      if (!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ext = getFileExtension(submission.mime_type)
      a.download = `POD-${submission.so_number || submission.id.slice(0, 8)}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      showToast('Download failed', 'error')
    }
  }

  const awaitingPod = useMemo(
    () => orders.filter((o) => !o.pod_received),
    [orders]
  )

  const podReceived = useMemo(
    () => orders.filter((o) => o.pod_received).slice(0, 20),
    [orders]
  )

  const filteredSubmissions = useMemo(
    () => submissionFilter === 'all'
      ? submissions
      : submissions.filter((s) => s.status === submissionFilter),
    [submissions, submissionFilter]
  )

  const awaitingPodCount = awaitingPod.length
  const podReceivedCount = orders.filter((o) => o.pod_received).length
  const totalCourierCount = orders.length
  const pendingSubmissionCount = submissions.filter((s) => s.status === 'pending').length

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 shrink-0 bg-s1 border-b border-border flex items-center px-4 md:px-6">
        <h1 className="text-sm font-semibold text-text">POD Tracker</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted">
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
                <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="text-sm">Loading POD tracker...</span>
            </div>
          </div>
        ) : (
          <div className="p-4 md:p-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
              <StatCard label="Awaiting POD" value={awaitingPodCount} accent="amber" />
              <StatCard label="POD Received" value={podReceivedCount} accent="green" />
              <StatCard label="Total Courier" value={totalCourierCount} accent="blue" />
              <StatCard label="Telegram PODs" value={pendingSubmissionCount} accent="purple" />
            </div>

            {/* Telegram POD Submissions */}
            <section className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-text">Telegram POD Submissions</h2>
                <div className="flex gap-1">
                  {(['pending', 'verified', 'rejected', 'all'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setSubmissionFilter(f)}
                      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md transition-all cursor-pointer ${
                        submissionFilter === f
                          ? 'bg-blue/15 text-blue'
                          : 'text-muted/60 hover:text-muted hover:bg-s3'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {filteredSubmissions.length === 0 ? (
                <div className="bg-s1 border border-border rounded-xl px-5 py-10 text-center text-muted">
                  <svg className="w-8 h-8 mx-auto mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162" />
                  </svg>
                  <div className="text-sm">No {submissionFilter !== 'all' ? submissionFilter : ''} POD submissions</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredSubmissions.map((sub, i) => (
                    <PodSubmissionCard
                      key={sub.id}
                      submission={sub}
                      index={i}
                      updating={updatingIds.has(sub.id)}
                      onVerify={() => handleSubmissionStatus(sub.id, 'verified')}
                      onReject={() => handleSubmissionStatus(sub.id, 'rejected')}
                      onClick={() => setSelectedSubmission(sub)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Awaiting POD */}
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-text mb-3">Awaiting POD</h2>

              {awaitingPod.length === 0 ? (
                <div className="bg-s1 border border-border rounded-xl px-5 py-10 text-center text-muted">
                  <svg className="w-8 h-8 mx-auto mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm">All PODs confirmed</div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {awaitingPod.map((order, i) => (
                    <div
                      key={order.id}
                      className="bg-s1 border border-border rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4 hover:border-border2 transition-all"
                      style={{ animation: `fadeIn ${0.1 + i * 0.03}s ease-out` }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span className="text-sm font-semibold text-text truncate">
                            {order.customer_name}
                          </span>
                          <span className="text-[11px] text-muted/60">
                            {order.so_number ?? 'No SO#'}
                          </span>
                          {order.fulfillment_method && (
                            <span className="text-[11px] text-muted">
                              <span className="mr-1 inline-flex"><FulfillmentIcon method={order.fulfillment_method} /></span>
                              {FULFILLMENT_LABELS[order.fulfillment_method]}
                            </span>
                          )}
                          <span className="text-[11px] text-muted/60">
                            {order.shipped_at
                              ? `Shipped ${formatDate(order.shipped_at)}`
                              : 'Not shipped'}
                          </span>
                          <span className="text-[11px] text-text font-medium tabular-nums">
                            {formatEur(order.value)}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="green"
                        size="sm"
                        disabled={updatingIds.has(order.id)}
                        onClick={() => handleMarkPodReceived(order.id)}
                        className={cn('w-full md:w-auto', updatingIds.has(order.id) && 'opacity-50')}
                      >
                        {updatingIds.has(order.id) ? 'Saving...' : 'Mark POD Received'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Recently Confirmed */}
            <section>
              <h2 className="text-sm font-semibold text-text mb-3">Recently Confirmed</h2>

              {podReceived.length === 0 ? (
                <div className="bg-s1 border border-border rounded-xl px-5 py-10 text-center text-muted">
                  <svg className="w-8 h-8 mx-auto mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                  </svg>
                  <div className="text-sm">No confirmed PODs yet</div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {podReceived.map((order, i) => (
                    <div
                      key={order.id}
                      className="bg-s1 border border-border rounded-xl px-4 py-2.5 flex items-center gap-4"
                      style={{ animation: `fadeIn ${0.1 + i * 0.03}s ease-out` }}
                    >
                      <div className="flex-1 flex flex-wrap items-center gap-x-4 gap-y-1 min-w-0">
                        <span className="text-[13px] font-medium text-text truncate">
                          {order.customer_name}
                        </span>
                        <span className="text-[11px] text-muted/60">
                          {order.so_number ?? 'No SO#'}
                        </span>
                        {order.fulfillment_method && (
                          <span className="text-[11px] text-muted">
                            {FULFILLMENT_LABELS[order.fulfillment_method]}
                          </span>
                        )}
                        <span className="text-[11px] text-text tabular-nums">
                          {formatEur(order.value)}
                        </span>
                      </div>
                      <span className="bg-green/12 text-green text-[10px] font-semibold py-0.5 px-2 rounded-md whitespace-nowrap shrink-0">
                        POD Confirmed
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      <PodSubmissionDetailModal
        submission={selectedSubmission}
        open={selectedSubmission !== null}
        onClose={() => setSelectedSubmission(null)}
        updating={selectedSubmission ? updatingIds.has(selectedSubmission.id) : false}
        deleting={selectedSubmission ? deletingIds.has(selectedSubmission.id) : false}
        onVerify={() => selectedSubmission && handleSubmissionStatus(selectedSubmission.id, 'verified')}
        onReject={() => selectedSubmission && handleSubmissionStatus(selectedSubmission.id, 'rejected')}
        onDelete={() => selectedSubmission && handleDelete(selectedSubmission.id)}
        onDownload={() => selectedSubmission && handleDownload(selectedSubmission)}
      />
    </div>
  )
}

// ─── Detail Modal ──────────────────────────────────────────────────────────

function PodSubmissionDetailModal({
  submission,
  open,
  onClose,
  updating,
  deleting,
  onVerify,
  onReject,
  onDelete,
  onDownload,
}: {
  submission: PodSubmission | null
  open: boolean
  onClose: () => void
  updating: boolean
  deleting: boolean
  onVerify: () => void
  onReject: () => void
  onDelete: () => void
  onDownload: () => void
}) {
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!open) setConfirming(false)
  }, [open])

  if (!submission) return null

  const statusStyles = {
    pending: 'bg-amber/12 text-amber',
    verified: 'bg-green/12 text-green',
    rejected: 'bg-red/12 text-red',
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`POD from ${submission.sender_name}`}
      footer={
        <>
          {confirming ? (
            <>
              <Button size="sm" variant="danger" onClick={onDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Confirm delete'}
              </Button>
              <Button size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
            </>
          ) : (
            <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>Delete</Button>
          )}
          <div className="flex-1" />
          {submission.file_data && (
            <Button size="sm" onClick={onDownload}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Download
            </Button>
          )}
          {submission.status === 'pending' && (
            <>
              <Button size="sm" variant="danger" disabled={updating} onClick={onReject}>Reject</Button>
              <Button size="sm" variant="green" disabled={updating} onClick={onVerify}>Verify</Button>
            </>
          )}
        </>
      }
    >
      {/* Full-size media preview */}
      {submission.media_type === 'image' && submission.file_data && (
        <div className="mb-4 bg-s2 border border-border rounded-lg overflow-hidden">
          <img
            src={`/api/pod-media/${submission.id}`}
            alt="POD"
            className="w-full object-contain"
          />
        </div>
      )}

      {submission.media_type === 'audio' && submission.file_data && (
        <div className="mb-4 bg-s2 border border-border rounded-lg p-4">
          <audio
            controls
            src={`/api/pod-media/${submission.id}`}
            className="w-full"
          />
        </div>
      )}

      {submission.media_type === 'document' && submission.file_data && (
        <div className="mb-4 bg-s2 border border-border rounded-lg p-6 flex flex-col items-center gap-3">
          <svg className="w-10 h-10 text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <span className="text-xs text-muted">{submission.mime_type || 'Document'}</span>
          <button
            onClick={onDownload}
            className="text-xs text-blue font-medium hover:underline cursor-pointer"
          >
            Download file
          </button>
        </div>
      )}

      {submission.media_type === 'text' && !submission.file_data && (
        <div className="mb-4 bg-s2 border border-border rounded-lg p-4 flex items-center justify-center">
          <span className="text-xs text-muted">Text-only submission</span>
        </div>
      )}

      {/* Caption */}
      {submission.caption && (
        <div className="mb-4">
          <label className="text-[10px] uppercase tracking-wider text-muted mb-1 block">Caption</label>
          <p className="text-[13px] text-text/80 leading-relaxed whitespace-pre-wrap">{submission.caption}</p>
        </div>
      )}

      {/* Info cards */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <div className="bg-s2 border border-border rounded-lg p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted mb-1">Sender</div>
          <div className="text-[13px] font-semibold text-text">{submission.sender_name}</div>
        </div>
        <div className="bg-s2 border border-border rounded-lg p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted mb-1">Status</div>
          <span className={`text-[11px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${statusStyles[submission.status]}`}>
            {submission.status}
          </span>
        </div>
        {submission.so_number && (
          <div className="bg-s2 border border-border rounded-lg p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-muted mb-1">SO Number</div>
            <div className={`text-[13px] font-semibold ${submission.order_id ? 'text-blue' : 'text-amber'}`}>
              {submission.so_number}
              {!submission.order_id && <span className="text-[9px] text-amber/60 ml-1">(no match)</span>}
            </div>
          </div>
        )}
        <div className="bg-s2 border border-border rounded-lg p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted mb-1">Media Type</div>
          <div className="text-[13px] font-semibold text-text capitalize">{submission.media_type || 'None'}</div>
        </div>
      </div>

      {/* Timestamp */}
      <div className="text-[11px] text-muted/50">
        Received {timeAgo(submission.created_at)} · {new Date(submission.created_at).toLocaleString('en-IE', {
          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
        })}
      </div>
    </Modal>
  )
}

// ─── Submission Card ───────────────────────────────────────────────────────

function PodSubmissionCard({
  submission,
  index,
  updating,
  onVerify,
  onReject,
  onClick,
}: {
  submission: PodSubmission
  index: number
  updating: boolean
  onVerify: () => void
  onReject: () => void
  onClick: () => void
}) {
  const statusStyles = {
    pending: 'bg-amber/12 text-amber',
    verified: 'bg-green/12 text-green',
    rejected: 'bg-red/12 text-red',
  }

  const mediaTypeIcon = {
    image: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
      </svg>
    ),
    audio: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
      </svg>
    ),
    document: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
    text: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
      </svg>
    ),
  }

  return (
    <div
      className="bg-s1 border border-border rounded-xl overflow-hidden hover:border-border2 transition-all cursor-pointer"
      style={{ animation: `fadeIn ${0.1 + index * 0.03}s ease-out` }}
      onClick={onClick}
    >
      {/* Media preview */}
      {submission.media_type === 'image' && submission.file_data && (
        <div className="border-b border-border bg-s2">
          <img
            src={`/api/pod-media/${submission.id}`}
            alt="POD"
            className="w-full max-h-48 object-contain"
          />
        </div>
      )}

      {submission.media_type === 'audio' && submission.file_data && (
        <div className="border-b border-border bg-s2 p-3" onClick={(e) => e.stopPropagation()}>
          <audio
            controls
            src={`/api/pod-media/${submission.id}`}
            className="w-full"
          />
        </div>
      )}

      {submission.media_type === 'document' && submission.file_data && (
        <div className="border-b border-border bg-s2 p-3 flex items-center justify-center">
          <span className="flex items-center gap-2 text-blue text-xs font-medium">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            View document
          </span>
        </div>
      )}

      {/* Card body */}
      <div className="p-3.5">
        {/* Header: media type + sender + time */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-muted/60">{mediaTypeIcon[submission.media_type || 'text']}</span>
            <span className="text-[13px] font-semibold text-text">{submission.sender_name}</span>
          </div>
          <span className="text-[10px] text-muted/50">{timeAgo(submission.created_at)}</span>
        </div>

        {/* Caption */}
        {submission.caption && (
          <p className="text-xs text-muted/80 leading-relaxed mb-2 whitespace-pre-wrap line-clamp-2">{submission.caption}</p>
        )}

        {/* SO number link */}
        {submission.so_number && (
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[10px] text-muted/40 uppercase">SO</span>
            <span className={`text-xs font-semibold ${submission.order_id ? 'text-blue' : 'text-amber'}`}>
              {submission.so_number}
            </span>
            {!submission.order_id && (
              <span className="text-[9px] text-amber/60">(no match)</span>
            )}
          </div>
        )}

        {/* Status badge + actions */}
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${statusStyles[submission.status]}`}>
            {submission.status}
          </span>

          {submission.status === 'pending' && (
            <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
              <button
                disabled={updating}
                onClick={onVerify}
                className={cn(
                  'text-[10px] font-semibold px-2 py-1 rounded-md bg-green/12 text-green hover:bg-green/20 transition-all cursor-pointer',
                  updating && 'opacity-50 cursor-not-allowed'
                )}
              >
                Verify
              </button>
              <button
                disabled={updating}
                onClick={onReject}
                className={cn(
                  'text-[10px] font-semibold px-2 py-1 rounded-md bg-red/12 text-red hover:bg-red/20 transition-all cursor-pointer',
                  updating && 'opacity-50 cursor-not-allowed'
                )}
              >
                Reject
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Stat Card ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent: 'amber' | 'green' | 'blue' | 'purple'
}) {
  const styles = {
    amber: 'bg-amber/8 border-amber/15 text-amber',
    green: 'bg-green/8 border-green/15 text-green',
    blue: 'bg-blue/8 border-blue/15 text-blue',
    purple: 'bg-purple/8 border-purple/15 text-purple',
  }

  return (
    <div className={`rounded-xl border p-4 ${styles[accent]}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70 mb-2">{label}</div>
      <div className="text-2xl font-bold text-text">{value}</div>
    </div>
  )
}
