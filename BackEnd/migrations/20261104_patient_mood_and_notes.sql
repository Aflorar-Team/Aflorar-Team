CREATE TABLE IF NOT EXISTS public.anotacoes_psicologo_diarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  psicologo_id uuid NOT NULL REFERENCES public.psicologos(usuario_id) ON DELETE CASCADE,
  paciente_id uuid NOT NULL REFERENCES public.pacientes(usuario_id) ON DELETE CASCADE,
  data_nota date NOT NULL DEFAULT CURRENT_DATE,
  conteudo text NOT NULL DEFAULT '',
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (psicologo_id, paciente_id, data_nota)
);

DROP TRIGGER IF EXISTS atualizar_updated_at ON public.anotacoes_psicologo_diarias;
CREATE TRIGGER atualizar_updated_at
  BEFORE UPDATE ON public.anotacoes_psicologo_diarias
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_updated_at();

CREATE INDEX IF NOT EXISTS idx_anotacoes_diarias_psicologo_paciente_data
  ON public.anotacoes_psicologo_diarias (psicologo_id, paciente_id, data_nota DESC);

ALTER TABLE public.anotacoes_psicologo_diarias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anotacoes_diarias_psicologo_vinculado ON public.anotacoes_psicologo_diarias;
CREATE POLICY anotacoes_diarias_psicologo_vinculado ON public.anotacoes_psicologo_diarias FOR ALL TO authenticated
  USING (psicologo_id = auth.uid() AND public.jwt_has_role('psicologo') AND EXISTS (
    SELECT 1 FROM public.vinculos_paciente_psicologo v
    WHERE v.paciente_id = anotacoes_psicologo_diarias.paciente_id
      AND v.psicologo_id = auth.uid()
      AND v.status = 'aceito'
  ))
  WITH CHECK (psicologo_id = auth.uid() AND public.jwt_has_role('psicologo') AND EXISTS (
    SELECT 1 FROM public.vinculos_paciente_psicologo v
    WHERE v.paciente_id = anotacoes_psicologo_diarias.paciente_id
      AND v.psicologo_id = auth.uid()
      AND v.status = 'aceito'
  ));

GRANT SELECT, INSERT, UPDATE ON public.anotacoes_psicologo_diarias TO authenticated;

DROP POLICY IF EXISTS evolucoes_visualizar ON public.jardim_evolucoes;
CREATE POLICY evolucoes_visualizar ON public.jardim_evolucoes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.jardins j
    WHERE j.id = jardim_id
      AND (
        j.usuario_id = auth.uid()::text
        OR (compartilhada AND EXISTS (
          SELECT 1 FROM public.vinculos_paciente_psicologo v
          WHERE v.paciente_id::text = j.usuario_id
            AND v.psicologo_id = auth.uid()
            AND v.status = 'aceito'
            AND public.jwt_has_role('psicologo')
        ))
      )
  ));