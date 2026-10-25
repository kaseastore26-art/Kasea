-- ============================================================================
-- Códigos de descuento (Kasea)
--
-- Solo el servidor (service role) lee y escribe estas tablas: el navegador
-- nunca accede directamente, así nadie puede inventarse ni listar códigos.
-- ============================================================================

create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and length(code) between 4 and 40),
  percent integer not null check (percent between 1 and 100),
  max_uses integer check (max_uses is null or max_uses > 0),   -- null = ilimitado
  used_count integer not null default 0,
  expires_at timestamptz,                                      -- null = no caduca
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists public.discount_redemptions (
  id bigserial primary key,
  code text not null references public.discount_codes(code) on update cascade on delete cascade,
  reference text not null unique,          -- id de la sesión de Stripe o del pedido en efectivo
  created_at timestamptz not null default now()
);

alter table public.discount_codes enable row level security;
alter table public.discount_redemptions enable row level security;

-- Sin políticas RLS: anon y authenticated no pueden ver nada.
revoke all on public.discount_codes from anon, authenticated;
revoke all on public.discount_redemptions from anon, authenticated;
grant all on public.discount_codes to service_role;
grant all on public.discount_redemptions to service_role;
grant usage, select on sequence public.discount_redemptions_id_seq to service_role;

-- Marca un código como usado UNA sola vez por pedido (idempotente: si Stripe
-- reintenta el webhook no se cuenta dos veces).
create or replace function public.redeem_discount_code(_code text, _reference text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer;
begin
  insert into public.discount_redemptions (code, reference)
  values (upper(_code), _reference)
  on conflict (reference) do nothing;

  get diagnostics inserted = row_count;
  if inserted = 0 then
    return false;
  end if;

  update public.discount_codes
     set used_count = used_count + 1,
         last_used_at = now()
   where code = upper(_code);

  return true;
end;
$$;

revoke execute on function public.redeem_discount_code(text, text) from public, anon, authenticated;
grant execute on function public.redeem_discount_code(text, text) to service_role;
