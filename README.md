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
│   │   ├── app.js            # Express e rotas da API
│   │   ├── server.js         # inicialização HTTP
│   │   └── config/
│   │       ├── env.js        # variáveis de ambiente
│   │       └── supabase.js   # cliente Supabase
│   ├── supabase-schema.sql
│   ├── .env                  # não versionar
│   └── package.json
├── .gitignore
└── README.md
```

No frontend, cada perfil mantém suas páginas, estilos e scripts próximos. O backend mantém a inicialização e as configurações separadas; as rotas ainda estão reunidas em `src/app.js` e podem ser extraídas por domínio conforme evoluírem.

---

## ⚙️ Como Rodar Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) v22+
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
PORT=3000
```

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
| `DB_TYPE` | Banco usado pela API: `supabase` ou `mysql` (padrão: Supabase quando suas credenciais estão configuradas; caso contrário, MySQL) |
| `PORT` | Porta do servidor (padrão: 3000) |
| `CORS_ORIGINS` | Opcional. Origens autorizadas, separadas por vírgula, quando o frontend estiver em outro domínio |

---

## 🌐 Deploy

### cPanel com Setup Node.js App

O servidor Express entrega tanto os arquivos estáticos de `FrontEnd/` quanto as rotas `/api`. Para publicar tudo na mesma origem:

1. Envie a pasta `Aflorar` completa para sua conta, mantendo `FrontEnd/` e `BackEnd/` lado a lado. Não envie `BackEnd/node_modules/` nem `BackEnd/.env`.
2. No **Setup Node.js App**, crie uma aplicação apontando para a pasta `BackEnd` (Application root) e escolha `server.js` como Startup file.
3. Escolha Node.js 22 ou superior e execute `npm install` pelo painel.
4. Para usar o Supabase, cadastre `DB_TYPE=supabase`, `SUPABASE_URL`, `SUPABASE_KEY` e `GEMINI_API_KEY` no painel. Adicione `SUPABASE_SERVICE_ROLE_KEY` se o projeto Supabase precisar que o backend crie/verifique a tabela `jardins`. Para usar MySQL, configure `DB_TYPE=mysql` e as variáveis `DB_HOST`, `DB_USER`, `DB_PASSWORD` e `DB_NAME`. Não defina `PORT` manualmente se o cPanel fornecer a porta da aplicação.
5. Associe a aplicação ao domínio ou subdomínio escolhido e reinicie-a após salvar as variáveis.

As chamadas do frontend usam caminhos relativos (`/api/...`), então site e API precisam estar servidos pelo mesmo domínio. Se mantiver temporariamente o frontend em outro domínio, informe esse domínio em `CORS_ORIGINS` no formato `https://site.exemplo.com`.

O Supabase e a API Gemini continuam sendo serviços externos; somente o site e o backend Express passam para o cPanel.

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
