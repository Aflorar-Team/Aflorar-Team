# 🌱 Aflorar

> Plataforma de saúde mental que conecta pacientes e psicólogos, com suporte de inteligência artificial.

![Status](https://img.shields.io/badge/status-em%20desenvolvimento-yellow)
![Versão](https://img.shields.io/badge/versão-MVP-green)

---

## 📋 Sobre o Projeto

O **Aflorar** é uma plataforma web voltada para o bem-estar emocional e saúde mental. Ela oferece:

- 💬 **Flora** — assistente virtual com IA para suporte emocional
- 👤 **Área do Paciente** — chat com a Flora, acompanhamento de humor
- 🧠 **Área do Psicólogo** — gestão de pacientes, agenda, anotações e gráficos

---

## 🚀 Funcionalidades

### Paciente
- Cadastro e login
- Chat com a Flora (IA baseada no Gemini)
- Acompanhamento de humor/emocional
- Jardim
- Diário

### Psicólogo
- Cadastro e login com CRP e CPF
- Dashboard com lista de pacientes
- Agenda de consultas
- Bloco de anotações com exportação em PDF
- Gráficos de humor dos pacientes
- Modo escuro

---

## 🛠️ Tecnologias Utilizadas

### Frontend
| Tecnologia | Uso |
|---|---|
| HTML5 | Estrutura das páginas |
| CSS3 | Estilização e responsividade |
| JavaScript | Interatividade e consumo de APIs |
| Chart.js | Gráficos de humor |
| jsPDF | Exportação de anotações em PDF |

### Backend
| Tecnologia | Uso |
|---|---|
| Node.js | Ambiente de execução |
| Express.js | Framework do servidor |
| Supabase | Autenticação e banco de dados |
| Google Gemini API | Inteligência artificial da Flora |
| dotenv | Gerenciamento de variáveis de ambiente |
| node-fetch | Requisições HTTP |

### Deploy
| Serviço | O que hospeda |
|---|---|
| Vercel | Frontend |
| Render | Backend |
| Supabase | Banco de dados e autenticação |

---

## 📁 Estrutura do Projeto

```
Aflorar/
├── FrontEnd/
│   ├── index.html
│   ├── escolha-tipo-conta.html
│   ├── shared/
│   │   ├── css/             # estilos compartilhados e telas públicas
│   │   └── js/              # scripts compartilhados e tela inicial
│   ├── Paciente/
│   │   ├── *.html
│   │   ├── css/             # estilos das telas do paciente
│   │   └── js/              # scripts das telas do paciente
│   └── Psicologo/
│       ├── *.html
│       ├── css/             # estilos das telas do psicólogo
│       └── js/              # scripts das telas do psicólogo
├── BackEnd/
│   ├── server.js             # entrada compatível com npm start/Render
│   ├── src/
│   │   ├── app.js            # composição do Express e dependências compartilhadas
│   │   ├── server.js         # inicialização HTTP
│   │   ├── routes/
│   │   │   ├── profiles.js       # cadastro, OAuth, login e sessões
│   │   │   ├── relationships.js  # códigos e vínculos paciente-profissional
│   │   │   ├── clinical.js       # emoções, anotações e compartilhamentos
│   │   │   ├── admin.js          # revisão de profissionais
│   │   │   ├── flora.js          # endpoint da assistente Flora
│   │   │   └── gardens.js        # canteiros e evoluções do jardim
│   │   └── config/
│   │       ├── env.js        # variáveis de ambiente
│   │       └── supabase.js   # cliente Supabase
│   ├── supabase-schema.sql
│   ├── .env                  # não versionar
│   └── package.json
├── .gitignore
└── README.md
```

No frontend, cada perfil mantém suas páginas, estilos e scripts próximos. No backend, `src/app.js` configura o Express e registra os módulos de rotas por domínio; a entrada HTTP permanece em `src/server.js`.

---

## ⚙️ Como Rodar Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) v18+
- Conta no [Supabase](https://supabase.com)
- Chave de API do [Google AI Studio](https://aistudio.google.com)

### Passo a passo

**1. Clone o repositório**
```bash
git clone https://github.com/seu-usuario/aflorar.git
cd aflorar
```

**2. Instale as dependências do backend**
```bash
cd BackEnd
npm install
```

**3. Configure as variáveis de ambiente**

Crie o arquivo `BackEnd/.env`:
```env
GEMINI_API_KEY=sua_chave_do_gemini
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_KEY=sua_chave_anonima_do_supabase
SUPABASE_SERVICE_ROLE_KEY=sua_chave_de_servico_do_supabase
ADMIN_EMAIL=administrador@seudominio.com
SMTP_USER=aflorar4@gmail.com
SMTP_APP_PASSWORD=sua_senha_de_app_google
CONTACT_EMAIL=aflorar4@gmail.com
FRONTEND_URL=https://aflorar-team.vercel.app
PORT=3000
```

`SUPABASE_SERVICE_ROLE_KEY` é usada apenas pelo backend para salvar papéis e perfis. Configure-a como variável secreta no Render; nunca a inclua no frontend ou em repositório público.
Para a demonstração do MVP, o formulário de contato e a recuperação de senha enviam e-mails usando SMTP do Gmail. Ative a verificação em duas etapas na conta `aflorar4@gmail.com`, crie uma senha de app nas configurações de Segurança da Conta Google e configure essa senha em `SMTP_APP_PASSWORD` no Render. Use `SMTP_USER=aflorar4@gmail.com`; `CONTACT_EMAIL=aflorar4@gmail.com` recebe as mensagens do formulário, enquanto recuperação de senha é enviada ao endereço digitado no login. Não use a senha normal da conta Google nem compartilhe a senha de app. O Gmail tem limites de envio; para o MVP com poucos jurados, esse volume é baixo. Para produção com maior volume, prefira um provedor transacional e domínio verificado.

`RESEND_API_KEY` e `EMAIL_FROM` são opcionais e servem como alternativa quando as variáveis SMTP não estão configuradas; nesse caso, o remetente precisa ser verificado no Resend. `FRONTEND_URL` deve ser a origem de produção do frontend. No Supabase, adicione `https://aflorar-team.vercel.app/redefinir-senha.html` à lista de URLs de redirecionamento permitidas para que o link de recuperação retorne à aplicação.

**4. Rode o servidor**
```bash
node server.js
```

**5. Acesse o frontend**

Abra `http://localhost:3000` no navegador.

---

## 🔐 Variáveis de Ambiente

| Variável | Descrição |
|---|---|
| `GEMINI_API_KEY` | Chave da API do Google Gemini |
| `SUPABASE_URL` | URL do projeto no Supabase |
| `SUPABASE_KEY` | Chave anônima pública do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave administrativa privada, exclusiva do backend |
| `ADMIN_EMAIL` | E-mail verificado autorizado a revisar profissionais |
| `SMTP_USER` | Conta Gmail usada pelo backend para enviar e-mails |
| `SMTP_APP_PASSWORD` | Senha de app do Gmail, criada na Conta Google com verificação em duas etapas |
| `CONTACT_EMAIL` | Destinatário das mensagens do formulário de contato (ex.: `aflorar4@gmail.com`) |
| `RESEND_API_KEY` | (Opcional) Chave privada do Resend como alternativa ao SMTP |
| `EMAIL_FROM` | (Opcional) Remetente verificado no Resend; usado somente com essa alternativa |
| `FRONTEND_URL` | Origem do frontend usada como destino dos links de redefinição |
| `PORT` | Porta do servidor (padrão: 3000) |

### Papéis de conta e aprovação profissional

Após aplicar o schema principal, execute `BackEnd/migrations/20261103_secure_role_policies.sql`, `BackEnd/migrations/20261104_patient_link_codes.sql`, `BackEnd/migrations/20261104_patient_mood_and_notes.sql`, `BackEnd/migrations/20261104_agenda_patient_events.sql`, `BackEnd/migrations/20261109_garden_seeds.sql`, `BackEnd/migrations/20261109_private_conversations.sql`, `BackEnd/migrations/20261114_agenda_schema_repair.sql` e `BackEnd/migrations/20261114_unread_conversation_messages.sql` no SQL Editor do Supabase. As migrações adicionam códigos únicos, notas diárias, acesso restrito a evoluções compartilhadas, suporte a avisos associados a pacientes na agenda, a semente escolhida em cada canteiro, as políticas e unicidade das conversas privadas, a compatibilidade das colunas da agenda em bancos existentes e o marcador de leitura das mensagens do psicólogo. Configure `ADMIN_EMAIL` no Render com o e-mail verificado que terá acesso ao painel `/admin.html`; o administrador entra com Google. Novos pacientes recebem o papel pelo backend; psicólogos ficam pendentes até revisão manual. No painel, confira o CRP no Cadastro Nacional do CFP e confirme a identidade por um canal confiável; a busca pública sozinha não prova identidade. O backend registra a decisão em `app_metadata` e na tabela `psicologos`.

Contas de pacientes criadas antes desta mudança precisam receber `paciente` em `app_metadata.roles` por uma migração administrativa após conferência. Psicólogos antigos não devem receber o papel automaticamente: devem completar os dados novamente para entrar na fila `/admin.html` e passar pela mesma revisão. Não copie papéis de `user_metadata`, pois esse campo pode ser editado pelo próprio usuário.

Não faça scraping do portal do CFP. Para consultar uma integração autorizada, contate o CFP/CRP pelo canal oficial e solicite documentação, condições de uso, limites, custos e processo de homologação.

Modelo de solicitação ao CFP/CRP:

> Olá, represento a plataforma Aflorar, que está estruturando o cadastro e a validação de profissionais de Psicologia. O CFP/CRP oferece API ou serviço oficial para consulta automatizada do número de registro, regional e situação ativa? Se sim, poderiam informar requisitos de acesso, termos de uso, limites, custos e processo de homologação? Obrigado.

---

## 🌐 Deploy

- **Frontend:** [aflorar-team.vercel.app](https://aflorar-team.vercel.app)
- **Backend:** [aflorar-backend.onrender.com](https://aflorar-backend.onrender.com)

> ⚠️ O backend no Render pode demorar ~30 segundos para responder após inatividade (plano gratuito).

---

## 👥 Equipe

| Nome | Função |
|---|---|
| Altemar Galvão | Mentor |
| João Vitor | Desenvolvedor Full-Stack |
| Gleyciane Julia | Desenvolvedora |
| Luna Ariela | Designer de UI/UX Geral |
| Déborah Leão | Designer de Produto |
| Thayná Valencia | Designer de Produto |
| João Henrique | Gestão de informação |

---

## 📄 Licença

Este projeto é privado e de uso restrito.

© 2025 Aflorar. Todos os direitos reservados.
