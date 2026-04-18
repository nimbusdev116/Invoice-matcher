-- Add Zoho status fields to store original Zoho Books statuses
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS zoho_so_status TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS zoho_invoice_status TEXT;
