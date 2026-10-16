-- Indexes the database advisor flagged (foreign keys without one) plus the face queue, so lookups by guest
-- and the queue scan stay fast as the party grows.
create index if not exists face_extra_photo on public.face_extra (photo_id);
create index if not exists photo_faces_guest on public.photo_faces (guest_id);
create index if not exists photo_spots_guest on public.photo_spots (guest_id);
create index if not exists photo_spots_tagged_by on public.photo_spots (tagged_by);
create index if not exists photos_face_queue on public.photos (created_at) where faces_status = 'pending' and kind = 'party' and removed_at is null;
create index if not exists guests_face_queue on public.guests (created_at) where face_status = 'pending' and selfie_path is not null;
