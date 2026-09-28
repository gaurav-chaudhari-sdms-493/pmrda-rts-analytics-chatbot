# PMC CMS AI Chatbot — Pune Municipal Corporation Data Assistant

**PMC CMS AI Chatbot** is a specialized, enterprise AI system designed for Pune Municipal Corporation (PMC). It empowers senior leadership, the PMC Commissioner, ward officers, and department heads to query citizen grievances, ward compliance, SLA breaches, and officer performance using natural language in **English, Marathi (Devanagari), Hinglish, and Marathish**.

![PMC CMS AI Assistant Architecture](img/architecture.png)

---

## 🏛️ System Overview

The PMC CMS Chatbot translates natural language questions directly into PostgreSQL queries executed against the PMC Citizen Management System (CMS) database. It returns streaming progress updates, formatted SQL (for authorized administrators), interactive data tables, Plotly data visualizations, and executive summaries.

### Key Capabilities

* 🎯 **PMC Domain-Specific Guardrails**: Strictly constrained to Pune Municipal Corporation civic complaints, ward statistics, officer performance, and municipal services. Automatically flags and refuses off-topic queries.
* 🗣️ **Multilingual & Script Matching**: Intelligently detects and matches user language and script:
  * English (e.g. *"Show total pending complaints in Kothrud ward"*)
  * Marathi / Devanagari (e.g. *"पुणे महानगरपालिकेतील एकूण तक्रारींची संख्या किती आहे?"*)
  * Marathish / Roman script (e.g. *"Kothrud ward madhe kiti complaints pending aahet?"*)
  * Hinglish / Roman script (e.g. *"Sabse zyada complaints kis department mein hain?"*)
* 📍 **Ward Alias & Mapping Engine**: Resolves informal ward/prabhag names to official database ward identifiers.
* 📊 **Streaming Visualizations & Data Tables**: Generates real-time Plotly charts, data grids, and summary cards embedded in web components.
* 🧠 **Seeded Agent Memory**: Pre-loaded with PMC business logic, SLA turnaround rules, escalation matrices, and category hierarchies.
* 🔒 **Role & User Aware Security**: Enforces identity context across queries and audit logs.

---

## 🏗️ Architecture & Component Structure

The repository is structured into modular backend, frontend, and integration components:

```
vanna/
├── main.py                     # Primary FastAPI backend entry point & server runner
├── streamlit_app.py            # Streamlit admin interface & data exploration app
├── start.sh                    # One-touch script to launch backend & frontend dev servers
├── Deployment.md               # Production Linux server deployment guide
├── LICENSE                     # Proprietary & Private License documentation
├── pyproject.toml              # Python project metadata & dependency management
│
├── src/vanna/                  # Vanna 2.0 Core Framework & PMC Modules
│   ├── core/                   # Agent core, system prompt builder, tools, user resolver
│   ├── integrations/           # OpenRouter LLM, PostgreSQL runner, and Agent Memory
│   ├── prompts.py              # PMC system prompt templates, domain rules & language guardrails
│   └── servers/fastapi/        # FastAPI application factory, routes, and SSE streaming
│
├── frontends/
│   └── webcomponent/           # Lit Web Component (<vanna-chat>) & Vite build pipeline
│       ├── src/components/     # Web component source code (vanna-chat.ts)
│       └── dist/               # Production compiled JS bundle (vanna-components.js)
│
└── COMMISSIONER_CHATBOT_QUERY_SCOPE.md  # 200 example query benchmarks & scope documentation
```

---

## ⚙️ Prerequisites & Environment Setup

### 1. Requirements
* **Python**: 3.10 or higher
* **Node.js**: v18.0 or higher & `npm`
* **Database**: PostgreSQL 14+ (Primary PMC CMS Database & Metadata Database)

### 2. Environment Configuration (`.env`)
Create a `.env` file in the root directory:

```env
# Primary PMC CMS PostgreSQL Database Connection
DATABASE_URL=postgresql+asyncpg://<username>:<password>@<db-host>:<db-port>/<database_name>

# PMC Metadata PostgreSQL Database Connection (Sessions & Audit Logs)
METADATA_DATABASE_URL=postgresql+asyncpg://postgres:<password>@localhost:5433/pmc_metadata_db

# OpenRouter LLM Configuration
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
OPENROUTER_LLM_MODEL=deepseek/deepseek-v4-flash-0731:nitro
```

---

## 🚀 How to Run the System

### A. One-Touch Start (Backend + Frontend)
Run the automated startup script:
```bash
./start.sh
```
This automatically launches:
* **FastAPI Backend**: `http://localhost:8000` (API & Web Component Static Assets)
* **Vite Frontend Dev Server**: `http://localhost:5173`

### B. Running Backend Independently
```bash
# Activate virtual environment
source venv/bin/activate

# Launch FastAPI Server
python main.py
```

### C. Running Web Components Frontend (Dev Mode)
```bash
cd frontends/webcomponent
npm install
npm run dev
```

### D. Running Streamlit Admin UI
```bash
source venv/bin/activate
streamlit run streamlit_app.py
```
Access the Streamlit Dashboard at `http://localhost:8501`.

---

## 🌐 Embedding the Web Component (`<vanna-chat>`)

The compiled frontend component can be embedded into any web page:

```html
<!-- Embed PMC Chat Web Component -->
<script src="http://your-server-ip:8000/static/vanna-components.js"></script>

<vanna-chat 
  sse-endpoint="http://your-server-ip:8000/chat" 
  theme="light">
</vanna-chat>
```

---

## 🚢 Production Deployment

For deploying to production servers (Systemd + Nginx + SSL + Port configurations), refer to the dedicated deployment guide:

👉 **[Deployment.md](Deployment.md)**

### Required Network Ports Overview
* **Port 8000**: FastAPI Backend API Service.
* **Port 5173**: Vite Frontend (*Dev environment only*).
* **Port 8501**: Streamlit Admin Interface.
* **Port 80 / 443**: Nginx Public Reverse Proxy (HTTP/HTTPS).

---

## 📄 License & Confidentiality

**PROPRIETARY AND CONFIDENTIAL**

Copyright (c) 2026 **Stark Digital Media Services Pvt. Ltd.** All Rights Reserved.

This software and associated documentation contain proprietary and confidential information of Stark Digital Media Services Pvt. Ltd. Unauthorized copying, distribution, modification, public display, or transmission of this software is strictly prohibited without explicit written permission from Stark Digital Media Services Pvt. Ltd.

