ALTER TABLE public.vinculos_paciente_psicologo
  DROP CONSTRAINT IF EXISTS vinculos_paciente_psicologo_solicitado_por_fkey,
  ADD CONSTRAINT vinculos_paciente_psicologo_solicitado_por_fkey
    FOREIGN KEY (solicitado_por)
    REFERENCES public.usuarios(id)
    ON DELETE CASCADE;
