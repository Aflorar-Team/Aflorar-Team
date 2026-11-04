ALTER TABLE public.eventos_agenda
  DROP CONSTRAINT IF EXISTS eventos_agenda_tipo_check;

ALTER TABLE public.eventos_agenda
  ADD CONSTRAINT eventos_agenda_tipo_check
  CHECK (tipo IN ('compromisso', 'aviso', 'autoaviso'));

DROP POLICY IF EXISTS eventos_psicologo_visualizar ON public.eventos_agenda;
CREATE POLICY eventos_psicologo_visualizar ON public.eventos_agenda FOR SELECT TO authenticated
  USING (
    (psicologo_id = auth.uid() AND public.jwt_has_role('psicologo'))
    OR (tipo IN ('compromisso', 'aviso') AND paciente_id = auth.uid() AND public.jwt_has_role('paciente'))
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