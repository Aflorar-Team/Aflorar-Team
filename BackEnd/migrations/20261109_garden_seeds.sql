ALTER TABLE public.jardins
  ADD COLUMN IF NOT EXISTS semente text NOT NULL DEFAULT 'girassol';

ALTER TABLE public.jardins
  DROP CONSTRAINT IF EXISTS jardins_semente_check;

ALTER TABLE public.jardins
  ADD CONSTRAINT jardins_semente_check
  CHECK (semente IN ('girassol', 'rosa', 'lavanda', 'flor-luz'));
