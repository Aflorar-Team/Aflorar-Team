CREATE UNIQUE INDEX IF NOT EXISTS idx_conversas_paciente_psicologo_unica
  ON public.conversas (paciente_id, psicologo_id)
  WHERE tipo = 'paciente_psicologo';

DROP POLICY IF EXISTS conversas_participantes_visualizar ON public.conversas;
CREATE POLICY conversas_participantes_visualizar ON public.conversas FOR SELECT TO authenticated
  USING (
    (tipo = 'flora' AND paciente_id = auth.uid())
    OR (tipo = 'paciente_psicologo'
      AND auth.uid() IN (paciente_id, psicologo_id)
      AND EXISTS (
        SELECT 1 FROM public.vinculos_paciente_psicologo v
        WHERE v.paciente_id = public.conversas.paciente_id
          AND v.psicologo_id = public.conversas.psicologo_id
          AND v.status = 'aceito'
      ))
  );

DROP POLICY IF EXISTS conversas_participantes_atualizar ON public.conversas;
CREATE POLICY conversas_participantes_atualizar ON public.conversas FOR UPDATE TO authenticated
  USING (
    (tipo = 'flora' AND paciente_id = auth.uid())
    OR (tipo = 'paciente_psicologo'
      AND auth.uid() IN (paciente_id, psicologo_id)
      AND EXISTS (
        SELECT 1 FROM public.vinculos_paciente_psicologo v
        WHERE v.paciente_id = public.conversas.paciente_id
          AND v.psicologo_id = public.conversas.psicologo_id
          AND v.status = 'aceito'
      ))
  )
  WITH CHECK (
    (tipo = 'flora' AND paciente_id = auth.uid())
    OR (tipo = 'paciente_psicologo'
      AND auth.uid() IN (paciente_id, psicologo_id)
      AND EXISTS (
        SELECT 1 FROM public.vinculos_paciente_psicologo v
        WHERE v.paciente_id = public.conversas.paciente_id
          AND v.psicologo_id = public.conversas.psicologo_id
          AND v.status = 'aceito'
      ))
  );

DROP POLICY IF EXISTS mensagens_participantes_visualizar ON public.mensagens_conversa;
CREATE POLICY mensagens_participantes_visualizar ON public.mensagens_conversa FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversas c
    WHERE c.id = conversa_id
      AND (
        (c.tipo = 'flora' AND c.paciente_id = auth.uid())
        OR (c.tipo = 'paciente_psicologo'
          AND auth.uid() IN (c.paciente_id, c.psicologo_id)
          AND EXISTS (
            SELECT 1 FROM public.vinculos_paciente_psicologo v
            WHERE v.paciente_id = c.paciente_id
              AND v.psicologo_id = c.psicologo_id
              AND v.status = 'aceito'
          ))
      )
  ));

DROP POLICY IF EXISTS mensagens_participantes_enviar ON public.mensagens_conversa;
CREATE POLICY mensagens_participantes_enviar ON public.mensagens_conversa FOR INSERT TO authenticated
  WITH CHECK (
    remetente_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversas c
      WHERE c.id = conversa_id
        AND c.tipo = 'paciente_psicologo'
        AND (
          (c.paciente_id = auth.uid() AND papel_remetente = 'paciente')
          OR (c.psicologo_id = auth.uid() AND papel_remetente = 'psicologo')
        )
        AND EXISTS (
          SELECT 1 FROM public.vinculos_paciente_psicologo v
          WHERE v.paciente_id = c.paciente_id
            AND v.psicologo_id = c.psicologo_id
            AND v.status = 'aceito'
        )
    )
  );
