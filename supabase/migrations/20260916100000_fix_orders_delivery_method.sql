-- ============================================================================
-- Guardar correctamente el método de entrega en los pedidos
-- delivery | pickup | nacex_point
-- ============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_method text NOT NULL DEFAULT 'delivery';

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_delivery_method_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_delivery_method_check
  CHECK (delivery_method IN ('delivery', 'pickup', 'nacex_point'));

-- ============================================================================
-- Actualizamos process_paid_order() para recibir y guardar delivery_method
-- ============================================================================

DROP FUNCTION IF EXISTS public.process_paid_order(
  text, text, text, text, text, jsonb, text, integer, integer, integer, jsonb
);

CREATE OR REPLACE FUNCTION public.process_paid_order(
  _session_id      text,
  _payment_intent  text,
  _email           text,
  _name            text,
  _phone           text,
  _address         jsonb,
  _delivery_method text,
  _currency        text,
  _subtotal_cents  integer,
  _shipping_cents  integer,
  _total_cents     integer,
  _items           jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order_id  uuid;
  _existing  uuid;
  _item      jsonb;
  _qty       integer;
  _updated   integer;
  _oversold  jsonb := '[]'::jsonb;
  _review    boolean := false;
BEGIN
  -- Idempotencia: si ya existe un pedido para esta sesión, no reprocesar.
  SELECT id INTO _existing
  FROM public.orders
  WHERE stripe_session_id = _session_id;

  IF _existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'order_id', _existing,
      'already_processed', true
    );
  END IF;

  INSERT INTO public.orders (
    stripe_session_id,
    stripe_payment_intent,
    email,
    customer_name,
    phone,
    shipping_address,
    delivery_method,
    currency,
    subtotal_cents,
    shipping_cents,
    total_cents,
    status
  ) VALUES (
    _session_id,
    _payment_intent,
    _email,
    _name,
    _phone,
    _address,
    CASE
      WHEN _delivery_method IN ('delivery', 'pickup', 'nacex_point')
        THEN _delivery_method
      ELSE 'delivery'
    END,
    COALESCE(_currency, 'EUR'),
    COALESCE(_subtotal_cents, 0),
    COALESCE(_shipping_cents, 0),
    COALESCE(_total_cents, 0),
    'paid'
  )
  RETURNING id INTO _order_id;

  FOR _item IN
    SELECT *
    FROM jsonb_array_elements(COALESCE(_items, '[]'::jsonb))
  LOOP
    _qty := COALESCE((_item->>'quantity')::int, 1);

    -- Decremento ATÓMICO y CONDICIONAL.
    UPDATE public.product_variants
      SET stock = stock - _qty
      WHERE id = NULLIF(_item->>'variant_id', '')::uuid
        AND stock >= _qty;

    GET DIAGNOSTICS _updated = ROW_COUNT;

    IF _updated = 0 THEN
      _review := true;

      _oversold := _oversold || jsonb_build_object(
        'variant_id', _item->>'variant_id',
        'title', _item->>'title',
        'quantity', _qty
      );

      UPDATE public.product_variants
        SET stock = 0
        WHERE id = NULLIF(_item->>'variant_id', '')::uuid
          AND stock < _qty;
    END IF;

    INSERT INTO public.order_items (
      order_id,
      variant_id,
      product_handle,
      title,
      unit_price_cents,
      quantity,
      attributes
    ) VALUES (
      _order_id,
      NULLIF(_item->>'variant_id', '')::uuid,
      _item->>'product_handle',
      COALESCE(_item->>'title', 'Producto'),
      COALESCE((_item->>'unit_price_cents')::int, 0),
      _qty,
      COALESCE(_item->'attributes', '[]'::jsonb)
    );
  END LOOP;

  IF _review THEN
    UPDATE public.orders
    SET needs_review = true
    WHERE id = _order_id;
  END IF;

  RETURN jsonb_build_object(
    'order_id', _order_id,
    'already_processed', false,
    'oversold', _oversold
  );
END
$$;

-- Solo el webhook con service_role puede ejecutar esta función.
REVOKE ALL ON FUNCTION public.process_paid_order(
  text, text, text, text, text, jsonb, text, text,
  integer, integer, integer, jsonb
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.process_paid_order(
  text, text, text, text, text, jsonb, text, text,
  integer, integer, integer, jsonb
) TO service_role;
