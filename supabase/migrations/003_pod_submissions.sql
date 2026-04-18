-- POD Submissions from Telegram (/POD command)
CREATE TABLE IF NOT EXISTS public.pod_submissions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             UUID REFERENCES public.orders (id),
  so_number            TEXT,
  sender_name          TEXT NOT NULL,
  telegram_chat_id     TEXT,
  telegram_message_id  TEXT,
  media_type           TEXT CHECK (media_type IN ('image', 'audio', 'document', 'text')),
  file_data            TEXT,
  mime_type            TEXT,
  caption              TEXT,
  status               TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'verified', 'rejected')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure order_media table exists (used by existing code)
CREATE TABLE IF NOT EXISTS public.order_media (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             UUID REFERENCES public.orders (id) ON DELETE CASCADE,
  media_type           TEXT NOT NULL CHECK (media_type IN ('image', 'audio', 'document')),
  file_id              TEXT,
  file_url             TEXT,
  file_data            TEXT,
  mime_type            TEXT,
  analysis             TEXT,
  transcript           TEXT,
  note                 TEXT,
  telegram_chat_id     TEXT,
  telegram_message_id  TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Triggers
CREATE TRIGGER set_pod_submissions_updated_at
  BEFORE UPDATE ON public.pod_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pod_submissions_status ON public.pod_submissions (status, created_at DESC);

-- RLS
ALTER TABLE public.pod_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pod_submissions_select_all"
  ON public.pod_submissions FOR SELECT USING (true);

CREATE POLICY "pod_submissions_insert_all"
  ON public.pod_submissions FOR INSERT WITH CHECK (true);

CREATE POLICY "pod_submissions_update_privileged"
  ON public.pod_submissions FOR UPDATE
  USING (current_user_role() IN ('admin', 'manager'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pod_submissions;
