CREATE OR REPLACE FUNCTION public.jwt_has_role(required_role text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? required_role,
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.jwt_has_role(text) TO authenticated;

DROP POLICY IF EXISTS pacientes_inserir ON public.pacientes;
CREATE POLICY pacientes_inserir ON public.pacientes FOR INSERT TO authenticated
  WITH CHECK (false);
DROP POLICY IF EXISTS pacientes_atualizar ON public.pacientes;
CREATE POLICY pacientes_atualizar ON public.pacientes FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS psicologos_inserir ON public.psicologos;
CREATE POLICY psicologos_inserir ON public.psicologos FOR INSERT TO authenticated
  WITH CHECK (false);
DROP POLICY IF EXISTS psicologos_atualizar ON public.psicologos;
CREATE POLICY psicologos_atualizar ON public.psicologos FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS vinculos_participantes_criar ON public.vinculos_paciente_psicologo;
CREATE POLICY vinculos_participantes_criar ON public.vinculos_paciente_psicologo FOR INSERT TO authenticated
  WITH CHECK (
    solicitado_por = auth.uid()
    AND (
      (paciente_id = auth.uid() AND public.jwt_has_role('paciente'))
      OR (psicologo_id = auth.uid() AND public.jwt_has_role('psicologo'))
    )
  );
DROP POLICY IF EXISTS vinculos_participantes_atualizar ON public.vinculos_paciente_psicologo;
CREATE POLICY vinculos_participantes_atualizar ON public.vinculos_paciente_psicologo FOR UPDATE TO authenticated
  USING (
    (
      (paciente_id = auth.uid() AND public.jwt_has_role('paciente'))
      OR (psicologo_id = auth.uid() AND public.jwt_has_role('psicologo'))
    )
    AND (status = 'aceito' OR solicitado_por <> auth.uid())
  )
  WITH CHECK (
    (paciente_id = auth.uid() AND public.jwt_has_role('paciente'))
    OR (psicologo_id = auth.uid() AND public.jwt_has_role('psicologo'))
  );

DROP POLICY IF EXISTS eventos_psicologo_visualizar ON public.eventos_agenda;
CREATE POLICY eventos_psicologo_visualizar ON public.eventos_agenda FOR SELECT TO authenticated
  USING (
    (psicologo_id = auth.uid() AND public.jwt_has_role('psicologo'))
    OR (tipo = 'compromisso' AND paciente_id = auth.uid() AND public.jwt_has_role('paciente'))
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

DROP POLICY IF EXISTS anotacoes_psicologo_proprias ON public.anotacoes_psicologo;
CREATE POLICY anotacoes_psicologo_proprias ON public.anotacoes_psicologo FOR ALL TO authenticated
  USING (psicologo_id = auth.uid() AND public.jwt_has_role('psicologo'))
  WITH CHECK (
    psicologo_id = auth.uid()
    AND public.jwt_has_role('psicologo')
    AND (paciente_id IS NULL OR EXISTS (
      SELECT 1 FROM public.vinculos_paciente_psicologo v
      WHERE v.paciente_id = anotacoes_psicologo.paciente_id
        AND v.psicologo_id = auth.uid()
        AND v.status = 'aceito'
    ))
  );

DROP POLICY IF EXISTS conversas_participantes_visualizar ON public.conversas;
CREATE POLICY conversas_participantes_visualizar ON public.conversas FOR SELECT TO authenticated
  USING (
    (paciente_id = auth.uid() AND public.jwt_has_role('paciente'))
    OR (
      psicologo_id = auth.uid()
      AND public.jwt_has_role('psicologo')
      AND EXISTS (
        SELECT 1 FROM public.vinculos_paciente_psicologo v
        WHERE v.paciente_id = public.conversas.paciente_id
          AND v.psicologo_id = auth.uid()
          AND v.status = 'aceito'
      )
    )
  );
DROP POLICY IF EXISTS conversas_paciente_criar ON public.conversas;
CREATE POLICY conversas_paciente_criar ON public.conversas FOR INSERT TO authenticated
  WITH CHECK (
    paciente_id = auth.uid()
    AND public.jwt_has_role('paciente')
    AND (tipo = 'flora' OR EXISTS (
      SELECT 1 FROM public.vinculos_paciente_psicologo v
      WHERE v.paciente_id = public.conversas.paciente_id
        AND v.psicologo_id = public.conversas.psicologo_id
        AND v.status = 'aceito'
    ))
  );
DROP POLICY IF EXISTS conversas_participantes_atualizar ON public.conversas;
CREATE POLICY conversas_participantes_atualizar ON public.conversas FOR UPDATE TO authenticated
  USING (
    (paciente_id = auth.uid() AND public.jwt_has_role('paciente'))
    OR (psicologo_id = auth.uid() AND public.jwt_has_role('psicologo'))
  )
  WITH CHECK (
    (paciente_id = auth.uid() AND public.jwt_has_role('paciente'))
    OR (psicologo_id = auth.uid() AND public.jwt_has_role('psicologo'))
  );

DROP POLICY IF EXISTS mensagens_participantes_visualizar ON public.mensagens_conversa;
CREATE POLICY mensagens_participantes_visualizar ON public.mensagens_conversa FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversas c
    WHERE c.id = conversa_id
      AND (
        (c.paciente_id = auth.uid() AND public.jwt_has_role('paciente'))
        OR (c.psicologo_id = auth.uid() AND public.jwt_has_role('psicologo'))
      )
  ));
DROP POLICY IF EXISTS mensagens_participantes_enviar ON public.mensagens_conversa;
CREATE POLICY mensagens_participantes_enviar ON public.mensagens_conversa FOR INSERT TO authenticated
  WITH CHECK (
    remetente_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversas c
      WHERE c.id = conversa_id
        AND (
          (c.paciente_id = auth.uid() AND public.jwt_has_role('paciente') AND papel_remetente = 'paciente')
          OR (c.psicologo_id = auth.uid() AND public.jwt_has_role('psicologo') AND papel_remetente = 'psicologo')
        )
    )
  );