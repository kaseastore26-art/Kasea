ALTER TABLE public.category_images
ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
