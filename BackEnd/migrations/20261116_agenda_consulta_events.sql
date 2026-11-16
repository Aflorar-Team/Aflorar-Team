ALTER TABLE public.eventos_agenda
  DROP CONSTRAINT IF EXISTS eventos_agenda_tipo_check;

UPDATE public.eventos_agenda
SET tipo = 'aviso', notificar = false, notificado_em = NULL
WHERE tipo = 'autoaviso';

ALTER TABLE public.eventos_agenda
  ADD CONSTRAINT eventos_agenda_tipo_check
  CHECK (tipo IN ('compromisso', 'aviso', 'consulta'));

DROP POLICY IF EXISTS eventos_psicologo_visualizar ON public.eventos_agenda;
CREATE POLICY eventos_psicologo_visualizar ON public.eventos_agenda FOR SELECT TO authenticated
  USING (
    (psicologo_id = auth.uid() AND public.jwt_has_role('psicologo'))
    OR (tipo IN ('compromisso', 'aviso', 'consulta') AND paciente_id = auth.uid() AND public.jwt_has_role('paciente'))
  );
