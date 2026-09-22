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
│   ├── Css/
│   │   ├── global.css
│   │   ├── login.css
│   │   └── ...
│   ├── Js/
│   │   ├── chat.js
│   │   ├── login-paciente.js
│   │   ├── cadastro-paciente.js
│   │   ├── login-psicologo.js
│   │   ├── cadastro-psicologo.js
│   │   └── dashboard-psicologo.js
│   ├── chat.html
│   ├── inicio.html
│   ├── login-paciente.html
│   ├── cadastro-paciente.html
│   ├── login-psicologo.html
│   ├── cadastro-psicologo.html
│   ├── dashboard-psicologo.html
│   ├── agenda-psicologo.html
│   ├── graficos-paciente.html
│   └── anotacoes-psicologo.html
│
├── BackEnd/
│   ├── server.js
│   ├── .env          ← NÃO versionar
│   ├── package.json
│   └── node_modules/ ← NÃO versionar
│
├── .gitignore
└── README.md
```

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
| `PORT` | Porta do servidor (padrão: 3000) |

---

## 🌐 Deploy

- **Frontend:** [aflorar-team.vercel.app](https://aflorar-team.vercel.app)
- **Backend:** [aflorar-backend.onrender.com](https://aflorar-backend.onrender.com)

> ⚠️ O backend no Render pode demorar ~30 segundos para responder após inatividade (plano gratuito).

---

## 👥 Equipe

| Nome | Função |
|---|---|
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
