-- Añade el precio configurable para recogida en punto NACEX.
ALTER TABLE public.shop_settings
  ADD COLUMN IF NOT EXISTS shipping_nacex_cents integer NOT NULL DEFAULT 499;

-- Permitimos un tercer método de entrega: punto NACEX.
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_delivery_method_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_delivery_method_check
  CHECK (delivery_method IN ('delivery', 'pickup', 'nacex_point'));
