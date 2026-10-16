-- Lighter feed: every new photo also gets a small thumbnail (~30 KB) for the grid, and when R2 is on the
-- thumbnail and the 1080px copy live on Cloudflare R2 (no download fees) instead of the Supabase bucket,
-- whose free plan only includes a few GB of downloads a month.
--
-- R2 links are signed by the r2 function when the phone uploads (7 days, R2's longest) and kept in the
-- photo row, so showing a photo costs no extra call; a daily job signs again the ones about to expire.
alter table public.photos add column if not exists thumb_path text;
alter table public.photos add column if not exists thumb_url text;
alter table public.photos add column if not exists preview_url text;
alter table public.photos add column if not exists links_until timestamptz;
create index if not exists photos_links_until on public.photos (links_until) where preview_url is not null;

-- links signed at upload, waiting for the photo row (the phone uploads before it calls send_photo)
create table if not exists public.r2_links (
  id uuid primary key,
  guest_id uuid not null references public.guests (id) on delete cascade,
  thumb text,
  preview text,
  until timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.r2_links enable row level security;
revoke all on public.r2_links from anon, authenticated;

create or replace function public.photo_store()
returns trigger language plpgsql security definer set search_path to '' as $$
declare l public.r2_links; t text := regexp_replace(new.preview_path, '-p\.jpg$', '-t.jpg');
begin
  new.on_r2 := not exists (select 1 from storage.objects o where o.bucket_id = 'fotos' and o.name = new.original_path);
  -- the light copies are where the phone managed to put them: the app's bucket wins (R2 links are signed
  -- before the upload, so they exist even when the R2 upload then failed and the phone fell back)
  if exists (select 1 from storage.objects o where o.bucket_id = 'fotos' and o.name = new.preview_path) then
    if t <> new.preview_path and exists (select 1 from storage.objects o where o.bucket_id = 'fotos' and o.name = t) then
      new.thumb_path := t;
    end if;
  else
    select * into l from public.r2_links where id = new.id and guest_id = new.guest_id;
    if found then
      new.thumb_url := l.thumb;
      new.preview_url := l.preview;
      new.links_until := l.until;
    end if;
  end if;
  return new;
end $$;

-- every morning, sign again the R2 viewing links that expire within 2 days (album stays visible for months)
select cron.schedule('renovar-links', '23 6 * * *', $c$select net.http_post('https://optapzbhyhklcirdoyid.supabase.co/functions/v1/r2?op=renew', '{}'::jsonb, headers := '{"Content-Type":"application/json"}'::jsonb)$c$);
