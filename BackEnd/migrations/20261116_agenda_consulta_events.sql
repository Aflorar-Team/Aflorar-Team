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

DROP POLICY IF EXISTS eventos_psicologo_visualizar ON public.eventos_agenda;
CREATE POLICY eventos_psicologo_visualizar ON public.eventos_agenda FOR SELECT TO authenticated
  USING (
    (psicologo_id = auth.uid() AND public.jwt_has_role('psicologo'))
    OR (tipo IN ('compromisso', 'aviso', 'consulta') AND paciente_id = auth.uid() AND public.jwt_has_role('paciente'))
  );
