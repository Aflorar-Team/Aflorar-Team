ALTER TABLE public.conversas
  ADD COLUMN IF NOT EXISTS psicologo_leu_ate timestamptz;

UPDATE public.conversas
SET psicologo_leu_ate = atualizado_em
WHERE psicologo_leu_ate IS NULL;

ALTER TABLE public.conversas
  ALTER COLUMN psicologo_leu_ate SET DEFAULT now();
