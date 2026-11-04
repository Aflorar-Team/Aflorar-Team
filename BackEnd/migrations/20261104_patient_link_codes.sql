ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS codigo_vinculo text;

ALTER TABLE public.pacientes
  ALTER COLUMN codigo_vinculo SET DEFAULT (
    'AFL-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10))
  );

UPDATE public.pacientes
SET codigo_vinculo = 'AFL-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10))
WHERE codigo_vinculo IS NULL;

ALTER TABLE public.pacientes
  ALTER COLUMN codigo_vinculo SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pacientes_codigo_vinculo_key
  ON public.pacientes (codigo_vinculo);