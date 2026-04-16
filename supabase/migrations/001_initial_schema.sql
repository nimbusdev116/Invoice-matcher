-- ============================================================
-- OrderTrack – Initial Schema Migration
-- ============================================================

-- Drop prior partial runs (safe if nothing exists yet)
-- Tables first (CASCADE removes their triggers + foreign keys automatically)
DROP TABLE IF EXISTS public.app_settings CASCADE;
DROP TABLE IF EXISTS public.zoho_sync_log CASCADE;
DROP TABLE IF EXISTS public.pod_records CASCADE;
DROP TABLE IF EXISTS public.fulfillments CASCADE;
DROP TABLE IF EXISTS public.order_status_history CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Then functions
DROP FUNCTION IF EXISTS public.log_order_status_change();
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.current_user_role();
DROP FUNCTION IF EXISTS public.update_updated_at();

-- ===================  1. HELPER FUNCTIONS  ===================

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ===================  2. TABLES  ===================

-- profiles (extends auth.users) — created first so current_user_role() can reference it
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'rep'
              CHECK (role IN ('admin', 'manager', 'rep', 'driver')),
  phone       TEXT,
  avatar_url  TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- orders
CREATE TABLE public.orders (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  so_number            TEXT UNIQUE,
  zoho_so_id           TEXT,
  zoho_invoice_id      TEXT,
  zoho_invoice_number  TEXT,
  reference_number     TEXT,
  customer_name        TEXT NOT NULL,
  customer_email       TEXT,
  customer_phone       TEXT,
  source               TEXT CHECK (source IN (
                          'b2b_portal', 'bwg_portal', 'musgrave_portal',
                          'mirakl', 'whatsapp', 'email', 'manual'
                        )),
  channel              TEXT CHECK (channel IN (
                          'direct', 'bwg', 'musgrave', 'offline'
                        )),
  status               TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN (
                          'pending', 'processing', 'pending_shipment',
                          'shipped', 'delivered', 'cancelled'
                        )),
  fulfillment_method   TEXT CHECK (fulfillment_method IN (
                          'collection', 'own_van', 'an_post', 'independent_express'
                        )),
  value                NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency             TEXT NOT NULL DEFAULT 'EUR',
  rep_id               UUID REFERENCES public.profiles (id),
  notes                TEXT,
  pod_required         BOOLEAN NOT NULL DEFAULT FALSE,
  pod_received         BOOLEAN NOT NULL DEFAULT FALSE,
  pod_url              TEXT,
  created_by           UUID REFERENCES public.profiles (id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  shipped_at           TIMESTAMPTZ,
  delivered_at         TIMESTAMPTZ,
  cancelled_at         TIMESTAMPTZ
);

-- order_status_history
CREATE TABLE public.order_status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  from_status TEXT,
  to_status   TEXT NOT NULL,
  changed_by  UUID REFERENCES public.profiles (id),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- fulfillments
CREATE TABLE public.fulfillments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  method           TEXT CHECK (method IN (
                      'collection', 'own_van', 'an_post', 'independent_express'
                    )),
  driver_id        UUID REFERENCES public.profiles (id),
  tracking_number  TEXT,
  route_sheet_id   TEXT,
  docket_number    TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN (
                      'pending', 'picked', 'in_transit',
                      'delivered', 'failed', 'returned'
                    )),
  dispatched_at    TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       UUID REFERENCES public.profiles (id)
);

-- pod_records
CREATE TABLE public.pod_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  fulfillment_id   UUID REFERENCES public.fulfillments (id),
  courier          TEXT NOT NULL,
  tracking_number  TEXT,
  pod_file_url     TEXT,
  pod_type         TEXT NOT NULL DEFAULT 'image'
                    CHECK (pod_type IN ('image', 'pdf', 'signature')),
  status           TEXT NOT NULL DEFAULT 'awaiting'
                    CHECK (status IN (
                      'awaiting', 'received', 'verified', 'disputed'
                    )),
  verified_by      UUID REFERENCES public.profiles (id),
  verified_at      TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- zoho_sync_log
CREATE TABLE public.zoho_sync_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation        TEXT NOT NULL CHECK (operation IN (
                      'fetch_orders', 'create_so', 'update_so',
                      'create_invoice', 'mark_sent', 'token_refresh'
                    )),
  status           TEXT NOT NULL CHECK (status IN (
                      'success', 'error', 'partial'
                    )),
  order_id         UUID REFERENCES public.orders (id),
  zoho_record_id   TEXT,
  error_message    TEXT,
  records_affected INTEGER NOT NULL DEFAULT 0,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at     TIMESTAMPTZ
);

-- app_settings
CREATE TABLE public.app_settings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key          TEXT UNIQUE NOT NULL,
  value        JSONB NOT NULL,
  description  TEXT,
  is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by   UUID REFERENCES public.profiles (id),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===================  3. TRIGGERS  ===================

-- Auto-create a profile row when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'rep')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- profiles updated_at
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Log order status changes and set timestamp columns
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Always bump updated_at
  NEW.updated_at = now();

  -- Only log when status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.order_status_history (order_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());

    -- Set convenience timestamps
    IF NEW.status = 'shipped' AND OLD.status <> 'shipped' THEN
      NEW.shipped_at = now();
    END IF;

    IF NEW.status = 'delivered' AND OLD.status <> 'delivered' THEN
      NEW.delivered_at = now();
    END IF;

    IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
      NEW.cancelled_at = now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_order_status_change
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_order_status_change();

-- fulfillments updated_at
CREATE TRIGGER set_fulfillments_updated_at
  BEFORE UPDATE ON public.fulfillments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- pod_records updated_at
CREATE TRIGGER set_pod_updated_at
  BEFORE UPDATE ON public.pod_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ===================  4. INDEXES  ===================

-- orders
CREATE INDEX idx_orders_status       ON public.orders (status);
CREATE INDEX idx_orders_channel      ON public.orders (channel);
CREATE INDEX idx_orders_created_at   ON public.orders (created_at DESC);
CREATE INDEX idx_orders_status_date  ON public.orders (status, created_at DESC);
CREATE INDEX idx_orders_zoho_so_id   ON public.orders (zoho_so_id) WHERE zoho_so_id IS NOT NULL;
CREATE INDEX idx_orders_channel_status ON public.orders (channel, status, created_at DESC);

-- order_status_history
CREATE INDEX idx_osh_order_id ON public.order_status_history (order_id, created_at DESC);

-- fulfillments
CREATE INDEX idx_fulfillments_order ON public.fulfillments (order_id);

-- pod_records
CREATE INDEX idx_pod_order  ON public.pod_records (order_id);
CREATE INDEX idx_pod_status ON public.pod_records (status);

-- ===================  5. ROLE HELPER  ===================
-- Defined here (after ALL tables exist) to avoid any validation issues
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT role FROM public.profiles WHERE id = auth.uid());
END;
$$;

-- ===================  6. ROW LEVEL SECURITY  ===================

ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fulfillments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_records           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoho_sync_log         ENABLE ROW LEVEL SECURITY;

-- ---- profiles ----
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  USING (current_user_role() = 'admin');

-- ---- orders ----
CREATE POLICY "orders_select_all"
  ON public.orders FOR SELECT
  USING (true);

CREATE POLICY "orders_insert_privileged"
  ON public.orders FOR INSERT
  WITH CHECK (current_user_role() IN ('admin', 'manager', 'rep'));

CREATE POLICY "orders_update_privileged"
  ON public.orders FOR UPDATE
  USING (current_user_role() IN ('admin', 'manager', 'rep'));

-- ---- order_status_history ----
CREATE POLICY "osh_select_all"
  ON public.order_status_history FOR SELECT
  USING (true);

CREATE POLICY "osh_insert_all"
  ON public.order_status_history FOR INSERT
  WITH CHECK (true);

-- ---- fulfillments ----
CREATE POLICY "fulfillments_select_all"
  ON public.fulfillments FOR SELECT
  USING (true);

CREATE POLICY "fulfillments_insert_privileged"
  ON public.fulfillments FOR INSERT
  WITH CHECK (current_user_role() IN ('admin', 'manager'));

CREATE POLICY "fulfillments_update_privileged"
  ON public.fulfillments FOR UPDATE
  USING (current_user_role() IN ('admin', 'manager', 'driver'));

-- ---- pod_records ----
CREATE POLICY "pod_select_all"
  ON public.pod_records FOR SELECT
  USING (true);

CREATE POLICY "pod_insert_privileged"
  ON public.pod_records FOR INSERT
  WITH CHECK (current_user_role() IN ('admin', 'manager', 'driver'));

CREATE POLICY "pod_update_privileged"
  ON public.pod_records FOR UPDATE
  USING (current_user_role() IN ('admin', 'manager'));

-- ---- app_settings ----
CREATE POLICY "settings_select"
  ON public.app_settings FOR SELECT
  USING (
    is_sensitive = FALSE
    OR current_user_role() = 'admin'
  );

CREATE POLICY "settings_update_admin"
  ON public.app_settings FOR UPDATE
  USING (current_user_role() = 'admin');

-- ---- zoho_sync_log ----
CREATE POLICY "sync_log_select_privileged"
  ON public.zoho_sync_log FOR SELECT
  USING (current_user_role() IN ('admin', 'manager'));

CREATE POLICY "sync_log_insert_all"
  ON public.zoho_sync_log FOR INSERT
  WITH CHECK (true);

-- ===================  7. REALTIME  ===================

ALTER PUBLICATION supabase_realtime ADD TABLE public.orders, public.fulfillments, public.pod_records;

-- ===================  8. SEED DATA  ===================

INSERT INTO public.app_settings (key, value, description, is_sensitive) VALUES
  ('zoho_org_id',            '""'::jsonb,                         'Zoho organisation ID',               TRUE),
  ('zoho_client_id',         '""'::jsonb,                         'Zoho OAuth2 client ID',              TRUE),
  ('zoho_client_secret',     '""'::jsonb,                         'Zoho OAuth2 client secret',          TRUE),
  ('zoho_refresh_token',     '""'::jsonb,                         'Zoho OAuth2 refresh token',          TRUE),
  ('zoho_base_url',          '"https://www.zohoapis.eu"'::jsonb,  'Zoho API base URL',                  FALSE),
  ('urgent_threshold_hours', '24'::jsonb,                         'Hours before an order is flagged urgent', FALSE),
  ('zoho_last_sync_at',     '"2026-04-01T00:00:00+00:00"'::jsonb, 'Last Zoho sync watermark',          FALSE);
