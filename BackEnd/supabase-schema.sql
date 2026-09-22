CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.jardins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id text NOT NULL,
  nome text NOT NULL,
  nivel integer NOT NULL DEFAULT 1,
  posicao integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jardins_usuario_id
  ON public.jardins (usuario_id);

CREATE INDEX IF NOT EXISTS idx_jardins_usuario_posicao
  ON public.jardins (usuario_id, posicao);

ALTER TABLE public.jardins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios podem ver seus jardins" ON public.jardins;
CREATE POLICY "usuarios podem ver seus jardins"
  ON public.jardins
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "usuarios podem inserir seus jardins" ON public.jardins;
CREATE POLICY "usuarios podem inserir seus jardins"
  ON public.jardins
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "usuarios podem atualizar seus jardins" ON public.jardins;
CREATE POLICY "usuarios podem atualizar seus jardins"
  ON public.jardins
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "usuarios podem deletar seus jardins" ON public.jardins;
CREATE POLICY "usuarios podem deletar seus jardins"
  ON public.jardins
  FOR DELETE
  USING (true);
