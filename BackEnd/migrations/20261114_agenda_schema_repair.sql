CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.eventos_agenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  psicologo_id uuid NOT NULL REFERENCES public.psicologos(usuario_id) ON DELETE CASCADE,
  paciente_id uuid REFERENCES public.pacientes(usuario_id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('compromisso', 'aviso', 'consulta')),
  titulo varchar(90) NOT NULL,
  data_evento date NOT NULL,
  hora time NOT NULL,
  detalhes varchar(300),
  notificar boolean NOT NULL DEFAULT false,
  notificado_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.eventos_agenda
  ADD COLUMN IF NOT EXISTS notificar boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notificado_em timestamptz;

ALTER TABLE public.eventos_agenda
  DROP CONSTRAINT IF EXISTS eventos_agenda_tipo_check;

UPDATE public.eventos_agenda
SET tipo = 'aviso', notificar = false, notificado_em = NULL
WHERE tipo = 'autoaviso';

UPDATE public.eventos_agenda
SET tipo = 'compromisso'
WHERE tipo = 'consulta' AND paciente_id IS NULL;

ALTER TABLE public.eventos_agenda
  ADD CONSTRAINT eventos_agenda_tipo_check
  CHECK (
    tipo IN ('compromisso', 'aviso', 'consulta')
    AND (tipo <> 'consulta' OR paciente_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_eventos_agenda_psicologo_data
  ON public.eventos_agenda (psicologo_id, data_evento, hora);

CREATE INDEX IF NOT EXISTS idx_eventos_agenda_paciente_data
  ON public.eventos_agenda (paciente_id, data_evento, hora)
  WHERE paciente_id IS NOT NULL;

ALTER TABLE public.eventos_agenda ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eventos_psicologo_visualizar ON public.eventos_agenda;
CREATE POLICY eventos_psicologo_visualizar ON public.eventos_agenda FOR SELECT TO authenticated
  USING (
    (psicologo_id = auth.uid() AND public.jwt_has_role('psicologo'))
    OR (tipo IN ('compromisso', 'aviso', 'consulta') AND paciente_id = auth.uid() AND public.jwt_has_role('paciente'))
  );

DROP POLICY IF EXISTS eventos_psicologo_manter ON public.eventos_agenda;
CREATE POLICY eventos_psicologo_manter ON public.eventos_agenda FOR ALL TO authenticated
  USING (psicologo_id = auth.uid() AND public.jwt_has_role('psicologo'))
  WITH CHECK (
    psicologo_id = auth.uid()
    AND public.jwt_has_role('psicologo')
    AND (paciente_id IS NULL OR EXISTS (
      SELECT 1 FROM public.vinculos_paciente_psicologo v
      WHERE v.paciente_id = eventos_agenda.paciente_id
        AND v.psicologo_id = auth.uid()
        AND v.status = 'aceito'
    ))
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.eventos_agenda TO authenticated;
