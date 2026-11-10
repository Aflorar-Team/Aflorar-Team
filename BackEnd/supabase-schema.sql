CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.usuarios (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT '',
  email text,
  avatar_url text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.criar_perfil_usuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.usuarios (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', ''),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ao_criar_usuario_auth ON auth.users;
CREATE TRIGGER ao_criar_usuario_auth
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.criar_perfil_usuario();

INSERT INTO public.usuarios (id, nome, email)
SELECT id, COALESCE(raw_user_meta_data ->> 'nome', ''), email
FROM auth.users
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.pacientes (
  usuario_id uuid PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE,
  cpf char(11) UNIQUE,
  telefone varchar(11),
  codigo_vinculo text NOT NULL UNIQUE DEFAULT (
    'AFL-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10))
  ),
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pacientes_cpf_valido CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$'),
  CONSTRAINT pacientes_telefone_valido CHECK (telefone IS NULL OR telefone ~ '^[0-9]{10,11}$')
);

CREATE TABLE IF NOT EXISTS public.psicologos (
  usuario_id uuid PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE,
  cpf char(11) UNIQUE,
  crp varchar(16) UNIQUE,
  telefone varchar(11),
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT psicologos_cpf_valido CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$'),
  CONSTRAINT psicologos_telefone_valido CHECK (telefone IS NULL OR telefone ~ '^[0-9]{10,11}$')
);

CREATE TABLE IF NOT EXISTS public.configuracoes_usuario (
  usuario_id uuid PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tema text NOT NULL DEFAULT 'claro' CHECK (tema IN ('claro', 'escuro')),
  notificacoes_habilitadas boolean NOT NULL DEFAULT true,
  fuso_horario text NOT NULL DEFAULT 'America/Recife',
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vinculos_paciente_psicologo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(usuario_id) ON DELETE CASCADE,
  psicologo_id uuid NOT NULL REFERENCES public.psicologos(usuario_id) ON DELETE CASCADE,
  solicitado_por uuid NOT NULL REFERENCES public.usuarios(id),
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'aceito', 'recusado', 'encerrado')),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (paciente_id, psicologo_id),
  CONSTRAINT vinculo_solicitante_participante
    CHECK (solicitado_por IN (paciente_id, psicologo_id))
);

CREATE INDEX IF NOT EXISTS idx_vinculos_psicologo_status
  ON public.vinculos_paciente_psicologo (psicologo_id, status);
CREATE INDEX IF NOT EXISTS idx_vinculos_paciente_status
  ON public.vinculos_paciente_psicologo (paciente_id, status);

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

CREATE OR REPLACE FUNCTION public.pode_acessar_perfil(perfil_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() = perfil_id OR EXISTS (
    SELECT 1
    FROM public.vinculos_paciente_psicologo v
    WHERE v.status = 'aceito'
      AND (
        (v.paciente_id = perfil_id AND v.psicologo_id = auth.uid())
        OR (v.psicologo_id = perfil_id AND v.paciente_id = auth.uid())
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.pode_acessar_paciente(paciente_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() = paciente_uuid OR EXISTS (
    SELECT 1
    FROM public.vinculos_paciente_psicologo v
    WHERE v.paciente_id = paciente_uuid
      AND v.psicologo_id = auth.uid()
      AND v.status = 'aceito'
  );
$$;

CREATE TABLE IF NOT EXISTS public.registros_humor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(usuario_id) ON DELETE CASCADE,
  data_registro date NOT NULL DEFAULT CURRENT_DATE,
  humor text NOT NULL,
  emoji text NOT NULL,
  origem text NOT NULL DEFAULT 'inicio'
    CHECK (origem IN ('inicio', 'diario', 'quiz')),
  observacao text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (paciente_id, data_registro, origem)
);

CREATE INDEX IF NOT EXISTS idx_registros_humor_paciente_data
  ON public.registros_humor (paciente_id, data_registro DESC);

CREATE TABLE IF NOT EXISTS public.diario_paginas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(usuario_id) ON DELETE CASCADE,
  data_pagina date NOT NULL DEFAULT CURRENT_DATE,
  humor text NOT NULL DEFAULT 'Bem',
  emoji text NOT NULL DEFAULT '🙂',
  texto text NOT NULL DEFAULT '',
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diario_paginas_paciente_data
  ON public.diario_paginas (paciente_id, data_pagina DESC);

CREATE TABLE IF NOT EXISTS public.gatilhos_emocionais (
  id smallint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  nome text NOT NULL UNIQUE
);

INSERT INTO public.gatilhos_emocionais (nome) VALUES
  ('trabalho'), ('relacionamentos'), ('saúde'), ('sono'),
  ('família'), ('finanças'), ('solidão'), ('conquista')
ON CONFLICT (nome) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.diario_pagina_gatilhos (
  pagina_id uuid NOT NULL REFERENCES public.diario_paginas(id) ON DELETE CASCADE,
  gatilho_id smallint NOT NULL REFERENCES public.gatilhos_emocionais(id),
  PRIMARY KEY (pagina_id, gatilho_id)
);

CREATE TABLE IF NOT EXISTS public.tentativas_quiz (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(usuario_id) ON DELETE CASCADE,
  respostas jsonb NOT NULL,
  resultado_titulo text,
  resultado_mensagem text,
  concluido_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tentativas_quiz_respostas_array CHECK (jsonb_typeof(respostas) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_tentativas_quiz_paciente_data
  ON public.tentativas_quiz (paciente_id, concluido_em DESC);

CREATE TABLE IF NOT EXISTS public.jardins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id text NOT NULL,
  nome text NOT NULL,
  nivel integer NOT NULL DEFAULT 1 CHECK (nivel BETWEEN 1 AND 5),
  posicao integer NOT NULL DEFAULT 0 CHECK (posicao BETWEEN 0 AND 6),
  semente text NOT NULL DEFAULT 'girassol' CHECK (semente IN ('girassol', 'rosa', 'lavanda', 'flor-luz')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jardins_usuario_id
  ON public.jardins (usuario_id);
CREATE INDEX IF NOT EXISTS idx_jardins_usuario_posicao
  ON public.jardins (usuario_id, posicao) WHERE posicao > 0;

CREATE TABLE IF NOT EXISTS public.jardim_evolucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jardim_id uuid NOT NULL REFERENCES public.jardins(id) ON DELETE CASCADE,
  texto varchar(600) NOT NULL,
  compartilhada boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jardim_evolucoes_jardim_data
  ON public.jardim_evolucoes (jardim_id, criado_em DESC);

CREATE TABLE IF NOT EXISTS public.eventos_agenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  psicologo_id uuid NOT NULL REFERENCES public.psicologos(usuario_id) ON DELETE CASCADE,
  paciente_id uuid REFERENCES public.pacientes(usuario_id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('compromisso', 'aviso', 'autoaviso')),
  titulo varchar(90) NOT NULL,
  data_evento date NOT NULL,
  hora time NOT NULL,
  detalhes varchar(300),
  notificar boolean NOT NULL DEFAULT false,
  notificado_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eventos_agenda_psicologo_data
  ON public.eventos_agenda (psicologo_id, data_evento, hora);
CREATE INDEX IF NOT EXISTS idx_eventos_agenda_paciente_data
  ON public.eventos_agenda (paciente_id, data_evento, hora)
  WHERE paciente_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.anotacoes_psicologo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  psicologo_id uuid NOT NULL REFERENCES public.psicologos(usuario_id) ON DELETE CASCADE,
  paciente_id uuid REFERENCES public.pacientes(usuario_id) ON DELETE SET NULL,
  titulo text NOT NULL DEFAULT 'Anotações gerais',
  conteudo text NOT NULL DEFAULT '',
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anotacoes_psicologo_paciente
  ON public.anotacoes_psicologo (psicologo_id, paciente_id);

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

CREATE INDEX IF NOT EXISTS idx_anotacoes_diarias_psicologo_paciente_data
  ON public.anotacoes_psicologo_diarias (psicologo_id, paciente_id, data_nota DESC);

CREATE TABLE IF NOT EXISTS public.conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('flora', 'paciente_psicologo')),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(usuario_id) ON DELETE CASCADE,
  psicologo_id uuid REFERENCES public.psicologos(usuario_id) ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversa_participantes_validos CHECK (
    (tipo = 'flora' AND psicologo_id IS NULL)
    OR (tipo = 'paciente_psicologo' AND psicologo_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_conversas_paciente_data
  ON public.conversas (paciente_id, atualizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_conversas_psicologo_data
  ON public.conversas (psicologo_id, atualizado_em DESC)
  WHERE psicologo_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversas_paciente_psicologo_unica
  ON public.conversas (paciente_id, psicologo_id)
  WHERE tipo = 'paciente_psicologo';

CREATE TABLE IF NOT EXISTS public.mensagens_conversa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  remetente_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  papel_remetente text NOT NULL
    CHECK (papel_remetente IN ('paciente', 'psicologo', 'assistente', 'sistema')),
  conteudo text NOT NULL,
  metadados jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensagens_conversa_data
  ON public.mensagens_conversa (conversa_id, criado_em);

CREATE TABLE IF NOT EXISTS public.planos_assinatura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  preco_centavos integer NOT NULL CHECK (preco_centavos >= 0),
  periodo text NOT NULL DEFAULT 'mensal' CHECK (periodo IN ('mensal', 'anual')),
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.planos_assinatura (codigo, nome, preco_centavos, periodo)
VALUES ('premium-mensal', 'Premium', 690, 'mensal')
ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.assinaturas_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  plano_id uuid NOT NULL REFERENCES public.planos_assinatura(id),
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'ativa', 'cancelada', 'expirada', 'inadimplente')),
  provedor text,
  id_assinatura_provedor text,
  inicio_em timestamptz,
  termina_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provedor, id_assinatura_provedor)
);

CREATE TABLE IF NOT EXISTS public.mensagens_contato (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text NOT NULL,
  mensagem text NOT NULL,
  estado text NOT NULL DEFAULT 'nova' CHECK (estado IN ('nova', 'em_atendimento', 'respondida', 'arquivada')),
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.atualizar_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.atualizar_jardim_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS atualizar_jardins_updated_at ON public.jardins;
CREATE TRIGGER atualizar_jardins_updated_at
  BEFORE UPDATE ON public.jardins
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_jardim_updated_at();

DO $$
DECLARE
  tabela text;
BEGIN
  FOREACH tabela IN ARRAY ARRAY[
    'usuarios', 'configuracoes_usuario', 'vinculos_paciente_psicologo',
    'anotacoes_psicologo_diarias',
    'diario_paginas', 'eventos_agenda', 'anotacoes_psicologo',
    'conversas', 'assinaturas_usuario'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS atualizar_updated_at ON public.%I', tabela);
    EXECUTE format(
      'CREATE TRIGGER atualizar_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.atualizar_updated_at()',
      tabela
    );
  END LOOP;
END;
$$;

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psicologos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vinculos_paciente_psicologo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_humor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diario_paginas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gatilhos_emocionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diario_pagina_gatilhos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tentativas_quiz ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jardins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jardim_evolucoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anotacoes_psicologo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anotacoes_psicologo_diarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens_conversa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planos_assinatura ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assinaturas_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens_contato ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS usuarios_visualizar ON public.usuarios;
CREATE POLICY usuarios_visualizar ON public.usuarios FOR SELECT TO authenticated
  USING (public.pode_acessar_perfil(id));
DROP POLICY IF EXISTS usuarios_atualizar ON public.usuarios;
CREATE POLICY usuarios_atualizar ON public.usuarios FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS pacientes_visualizar ON public.pacientes;
CREATE POLICY pacientes_visualizar ON public.pacientes FOR SELECT TO authenticated
  USING (public.pode_acessar_paciente(usuario_id));
DROP POLICY IF EXISTS pacientes_inserir ON public.pacientes;
CREATE POLICY pacientes_inserir ON public.pacientes FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid());
DROP POLICY IF EXISTS pacientes_atualizar ON public.pacientes;
CREATE POLICY pacientes_atualizar ON public.pacientes FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

DROP POLICY IF EXISTS psicologos_visualizar ON public.psicologos;
CREATE POLICY psicologos_visualizar ON public.psicologos FOR SELECT TO authenticated
  USING (public.pode_acessar_perfil(usuario_id));
DROP POLICY IF EXISTS psicologos_inserir ON public.psicologos;
CREATE POLICY psicologos_inserir ON public.psicologos FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid());
DROP POLICY IF EXISTS psicologos_atualizar ON public.psicologos;
CREATE POLICY psicologos_atualizar ON public.psicologos FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

DROP POLICY IF EXISTS configuracoes_proprias ON public.configuracoes_usuario;
CREATE POLICY configuracoes_proprias ON public.configuracoes_usuario FOR ALL TO authenticated
  USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

DROP POLICY IF EXISTS vinculos_participantes_visualizar ON public.vinculos_paciente_psicologo;
CREATE POLICY vinculos_participantes_visualizar ON public.vinculos_paciente_psicologo FOR SELECT TO authenticated
  USING (auth.uid() IN (paciente_id, psicologo_id));
DROP POLICY IF EXISTS vinculos_participantes_criar ON public.vinculos_paciente_psicologo;
CREATE POLICY vinculos_participantes_criar ON public.vinculos_paciente_psicologo FOR INSERT TO authenticated
  WITH CHECK (solicitado_por = auth.uid() AND auth.uid() IN (paciente_id, psicologo_id));
DROP POLICY IF EXISTS vinculos_participantes_atualizar ON public.vinculos_paciente_psicologo;
CREATE POLICY vinculos_participantes_atualizar ON public.vinculos_paciente_psicologo FOR UPDATE TO authenticated
  USING (
    auth.uid() IN (paciente_id, psicologo_id)
    AND (status = 'aceito' OR solicitado_por <> auth.uid())
  )
  WITH CHECK (auth.uid() IN (paciente_id, psicologo_id));

DROP POLICY IF EXISTS humor_paciente_e_profissional ON public.registros_humor;
CREATE POLICY humor_paciente_e_profissional ON public.registros_humor FOR SELECT TO authenticated
  USING (public.pode_acessar_paciente(paciente_id));
DROP POLICY IF EXISTS humor_paciente_manter ON public.registros_humor;
CREATE POLICY humor_paciente_manter ON public.registros_humor FOR ALL TO authenticated
  USING (paciente_id = auth.uid()) WITH CHECK (paciente_id = auth.uid());

DROP POLICY IF EXISTS diario_paciente_e_profissional ON public.diario_paginas;
CREATE POLICY diario_paciente_e_profissional ON public.diario_paginas FOR SELECT TO authenticated
  USING (public.pode_acessar_paciente(paciente_id));
DROP POLICY IF EXISTS diario_paciente_manter ON public.diario_paginas;
CREATE POLICY diario_paciente_manter ON public.diario_paginas FOR ALL TO authenticated
  USING (paciente_id = auth.uid()) WITH CHECK (paciente_id = auth.uid());

DROP POLICY IF EXISTS gatilhos_listar ON public.gatilhos_emocionais;
CREATE POLICY gatilhos_listar ON public.gatilhos_emocionais FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS gatilhos_pagina_propria ON public.diario_pagina_gatilhos;
CREATE POLICY gatilhos_pagina_propria ON public.diario_pagina_gatilhos FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.diario_paginas d
    WHERE d.id = pagina_id AND d.paciente_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.diario_paginas d
    WHERE d.id = pagina_id AND d.paciente_id = auth.uid()
  ));

DROP POLICY IF EXISTS quiz_paciente_e_profissional ON public.tentativas_quiz;
CREATE POLICY quiz_paciente_e_profissional ON public.tentativas_quiz FOR SELECT TO authenticated
  USING (public.pode_acessar_paciente(paciente_id));
DROP POLICY IF EXISTS quiz_paciente_inserir ON public.tentativas_quiz;
CREATE POLICY quiz_paciente_inserir ON public.tentativas_quiz FOR INSERT TO authenticated
  WITH CHECK (paciente_id = auth.uid());

DROP POLICY IF EXISTS jardins_proprios ON public.jardins;
CREATE POLICY jardins_proprios ON public.jardins FOR ALL TO authenticated
  USING (usuario_id = auth.uid()::text) WITH CHECK (usuario_id = auth.uid()::text);
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
DROP POLICY IF EXISTS evolucoes_criar_proprias ON public.jardim_evolucoes;
CREATE POLICY evolucoes_criar_proprias ON public.jardim_evolucoes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.jardins j
    WHERE j.id = jardim_id AND j.usuario_id = auth.uid()::text
  ));
DROP POLICY IF EXISTS evolucoes_editar_proprias ON public.jardim_evolucoes;
CREATE POLICY evolucoes_editar_proprias ON public.jardim_evolucoes FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.jardins j
    WHERE j.id = jardim_id AND j.usuario_id = auth.uid()::text
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.jardins j
    WHERE j.id = jardim_id AND j.usuario_id = auth.uid()::text
  ));

DROP POLICY IF EXISTS eventos_psicologo_visualizar ON public.eventos_agenda;
CREATE POLICY eventos_psicologo_visualizar ON public.eventos_agenda FOR SELECT TO authenticated
  USING (
    (psicologo_id = auth.uid() AND public.jwt_has_role('psicologo'))
    OR (tipo IN ('compromisso', 'aviso') AND paciente_id = auth.uid() AND public.jwt_has_role('paciente'))
  );
DROP POLICY IF EXISTS eventos_psicologo_manter ON public.eventos_agenda;
CREATE POLICY eventos_psicologo_manter ON public.eventos_agenda FOR ALL TO authenticated
  USING (psicologo_id = auth.uid())
  WITH CHECK (
    psicologo_id = auth.uid()
    AND (paciente_id IS NULL OR EXISTS (
      SELECT 1 FROM public.vinculos_paciente_psicologo v
      WHERE v.paciente_id = eventos_agenda.paciente_id
        AND v.psicologo_id = auth.uid()
        AND v.status = 'aceito'
    ))
  );

DROP POLICY IF EXISTS anotacoes_psicologo_proprias ON public.anotacoes_psicologo;
CREATE POLICY anotacoes_psicologo_proprias ON public.anotacoes_psicologo FOR ALL TO authenticated
  USING (psicologo_id = auth.uid())
  WITH CHECK (
    psicologo_id = auth.uid()
    AND (paciente_id IS NULL OR EXISTS (
      SELECT 1 FROM public.vinculos_paciente_psicologo v
      WHERE v.paciente_id = anotacoes_psicologo.paciente_id
        AND v.psicologo_id = auth.uid()
        AND v.status = 'aceito'
    ))
  );

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
DROP POLICY IF EXISTS conversas_paciente_criar ON public.conversas;
CREATE POLICY conversas_paciente_criar ON public.conversas FOR INSERT TO authenticated
  WITH CHECK (
    paciente_id = auth.uid()
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
        AND (
          (c.tipo = 'paciente_psicologo'
            AND c.paciente_id = auth.uid()
            AND papel_remetente = 'paciente')
          OR (c.tipo = 'paciente_psicologo'
            AND c.psicologo_id = auth.uid()
            AND papel_remetente = 'psicologo')
        )
        AND EXISTS (
          SELECT 1 FROM public.vinculos_paciente_psicologo v
          WHERE v.paciente_id = c.paciente_id
            AND v.psicologo_id = c.psicologo_id
            AND v.status = 'aceito'
        )
    )
  );

DROP POLICY IF EXISTS planos_ativos_listar ON public.planos_assinatura;
CREATE POLICY planos_ativos_listar ON public.planos_assinatura FOR SELECT TO authenticated USING (ativo);
DROP POLICY IF EXISTS assinatura_propria ON public.assinaturas_usuario;
CREATE POLICY assinatura_propria ON public.assinaturas_usuario FOR SELECT TO authenticated
  USING (usuario_id = auth.uid());

DROP POLICY IF EXISTS contato_publico_enviar ON public.mensagens_contato;
CREATE POLICY contato_publico_enviar ON public.mensagens_contato FOR INSERT TO anon, authenticated
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.usuarios TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.pacientes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.psicologos TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.configuracoes_usuario TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.vinculos_paciente_psicologo TO authenticated;
REVOKE UPDATE ON public.vinculos_paciente_psicologo FROM PUBLIC, anon, authenticated;
GRANT UPDATE (status) ON public.vinculos_paciente_psicologo TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registros_humor TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diario_paginas TO authenticated;
GRANT SELECT ON public.gatilhos_emocionais TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.diario_pagina_gatilhos TO authenticated;
GRANT SELECT, INSERT ON public.tentativas_quiz TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jardins TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.jardim_evolucoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eventos_agenda TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.anotacoes_psicologo TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.anotacoes_psicologo_diarias TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.conversas TO authenticated;
GRANT SELECT, INSERT ON public.mensagens_conversa TO authenticated;
GRANT SELECT ON public.planos_assinatura TO authenticated;
GRANT SELECT ON public.assinaturas_usuario TO authenticated;
GRANT INSERT ON public.mensagens_contato TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.gatilhos_emocionais_id_seq TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_acessar_perfil(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_acessar_paciente(uuid) TO authenticated;