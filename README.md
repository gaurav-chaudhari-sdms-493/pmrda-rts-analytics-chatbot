# PMRDA RTS AI Chatbot — Pune Metropolitan Region Development Authority RTS & Analytics Assistant

**PMRDA RTS AI Chatbot** is a specialized, enterprise AI analytics system designed for the **Pune Metropolitan Region Development Authority (PMRDA)**. It empowers senior leadership, the Metropolitan Commissioner, town planning officers, and department heads to query RTS (Right to Services) application metrics, workflow task queues, fee collections, SLA compliance, and regional master data using natural language in **English, Marathi (Devanagari), Hinglish, and Marathish**.

![PMRDA RTS AI Assistant Architecture](img/architecture.png)

---

## 🏛️ System Overview

The PMRDA RTS Chatbot translates natural language questions directly into PostgreSQL 16 queries executed against the PMRDA RTS database. It streams real-time AI reasoning, formatted SQL (in Developer Info mode), interactive pagination data tables, Plotly data visualizations, and contextual executive summaries.

### Key Capabilities

* 🎯 **PMRDA Domain Guardrails**: Strictly constrained to Pune Metropolitan Region Development Authority services, RTS applications, town planning, building permissions, fire NOCs, and fee collections. Automatically rejects off-topic queries (e.g., general trivia, cooking recipes, external advice) with polite multilingual notices.
* ⚡ **Strict Database-First Live Execution**: Enforces live SQL query execution (`run_sql`) for all aggregates, counts, and metrics (`SELECT COUNT(*)`). The assistant never quotes hardcoded numbers or hallucinates counts from memory.
* 🗣️ **Multilingual & Script Matching**: Intelligently detects and matches user language and script:
  * **English**: *"Show total applications count till now"*
  * **Marathi (Devanagari)**: *"पुणे महानगर प्रदेश विकास प्राधिकरणात एकूण किती अर्ज आले आहेत?"*
  * **Marathish (Roman script)**: *"Aata paryant kiti applications aale aahet?"*
  * **Hinglish (Roman script)**: *"Total registered users kitne hain?"*
  * **Hindi (Devanagari)**: *"कुल कितने आवेदन स्वीकृत हुए हैं?"*
* 📊 **Streaming Visualizations & Data Tables**: Generates real-time interactive Plotly charts, data grids, and status cards embedded in responsive web components.
* 🧠 **Seeded Agent Memory**: Pre-loaded with PMRDA business logic, active schema catalogs (excluding snapshot/staging tables `bak_*`), and 19 enterprise Question-SQL training pairs from `vanna_training_data.py`.
* 🛡️ **Zero Internal Table Leakage**: Speaks exclusively in clean, executive business terminology without exposing internal database table names or SQL jargon in public responses.

---

## 🏗️ Architecture & Component Structure

The repository is organized into modular backend, frontend, and integration components:

```
pmrda-rts-analytics-chatbot/
├── main.py                     # Primary FastAPI backend entry point & server runner
├── vanna_training_data.py      # 19 enterprise Question-SQL few-shot training pairs
├── streamlit_app.py            # Streamlit admin interface & data exploration app
├── start.sh                    # One-touch script to launch backend & frontend dev servers
├── Deployment.md               # Production Linux server deployment guide (Systemd + Nginx)
├── PROJECT_REPLICATION_GUIDE.md# Architecture adaptation guide for porting to new projects
├── LICENSE                     # Proprietary & Private License documentation
├── pyproject.toml              # Python project metadata & dependency management
│
├── src/vanna/                  # Vanna 2.0 Core Framework & PMRDA Modules
│   ├── core/                   # Agent core, system prompt builder, tools, user resolver
│   ├── integrations/           # OpenRouter LLM, PostgreSQL runner, and Agent Memory
│   ├── prompts.py              # PMRDA system prompt templates, domain rules & language guardrails
│   └── servers/fastapi/        # FastAPI application factory, routes, and SSE streaming
│
├── frontends/
│   └── webcomponent/           # Lit Web Component (<vanna-chat>) & Vite build pipeline
│       ├── index.html          # Fullscreen chat interface
│       ├── public/             # Static demos (floating-widget-demo.html)
│       ├── src/components/     # Web component source code (vanna-chat.ts, rich-component-system.ts)
│       ├── src/styles/         # UI component styling (rich-component-styles.ts)
│       └── dist/               # Production compiled JS bundle (vanna-components.js)
│
└── COMMISSIONER_CHATBOT_QUERY_SCOPE.md  # Example query benchmarks & PMRDA scope documentation
```

---

## ⚙️ Prerequisites & Environment Setup

### 1. Requirements
* **Python**: 3.10 or higher
* **Node.js**: v18.0 or higher & `npm`
* **Database**: PostgreSQL 14+ (PMRDA RTS Primary Database)

### 2. Environment Configuration (`.env`)
Create a `.env` file in the root directory:

```env
# -----------------------------------------------------------------------------
# Database Connections
# -----------------------------------------------------------------------------
# Main PMRDA RTS Database (read-only recommended)
DATABASE_URL=postgresql+asyncpg://pmrda_rts_readonly:<password>@<db-host>:5432/PMRDA-RTS

# PMRDA Metadata Database (local sessions, templates, execution logs)
METADATA_DATABASE_URL=postgresql+asyncpg://postgres:<password>@localhost:5433/pmrda_metadata_db

# -----------------------------------------------------------------------------
# OpenRouter API Key & LLM Configuration
# -----------------------------------------------------------------------------
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
OPENROUTER_LLM_MODEL=deepseek/deepseek-v4-flash-0731:nitro

# -----------------------------------------------------------------------------
# Server Settings
# -----------------------------------------------------------------------------
PORT=8000
HOST=0.0.0.0
FEED_LIVE_SCHEMA=true
```

---

## 🚀 How to Run the System

### A. One-Touch Start (Backend + Frontend)
Run the automated startup script:
```bash
./start.sh
```
This automatically manages port cleanups, seeds domain memory, and launches:
* **FastAPI Backend**: `http://localhost:8000` (API & Web Component Static Assets)
* **Vite Frontend Dev Server**: `http://localhost:5173`
* **Floating Widget Demo**: `http://localhost:5173/static/floating-widget-demo.html`

### B. Running Backend Independently
```bash
# Activate virtual environment
source venv/bin/activate

# Launch FastAPI Server on port 8000
python main.py
```

### C. Running Frontend Independently
```bash
cd frontends/webcomponent
npm install
npm run dev -- --host
```

### D. Running Streamlit Admin App
```bash
streamlit run streamlit_app.py --server.port 8501
```

---

## 🌐 Website Integration (Floating Chatbot Widget)

To embed the floating PMRDA chatbot widget into any external portal or website HTML:

```html
<!-- 1. Include Web Component Bundle -->
<script type="module" src="https://your-chatbot-domain.com/static/vanna-components.js?v=12"></script>

<!-- 2. Include Floating Widget Script -->
<script src="https://your-chatbot-domain.com/static/pmc-widget.js?v=12"></script>

<!-- 3. Initialize Floating Widget -->
<script>
  document.addEventListener('DOMContentLoaded', function () {
    PMCWidget.init({
      apiHost: "https://your-chatbot-domain.com",
      title: "PMRDA AI Assistant",
      subtitle: "पुणे महानगर प्रदेश विकास प्राधिकरण AI सहाय्यक",
      position: "bottom-right",
      primaryColor: "#2563eb"
    });
  });
</script>
```

---

## 📚 Related Documentation

* **[Deployment.md](file:///Deployment.md)**: Production deployment instructions for Ubuntu/Debian with Systemd, Nginx, and SSL.
* **[PROJECT_REPLICATION_GUIDE.md](file:///PROJECT_REPLICATION_GUIDE.md)**: Step-by-step guide for adapting this architecture to another database or project.
* **[COMMISSIONER_CHATBOT_QUERY_SCOPE.md](file:///COMMISSIONER_CHATBOT_QUERY_SCOPE.md)**: Comprehensive query benchmarks, join topology, and evaluation scope.

---

## 📄 License

This software is proprietary and confidential. See [LICENSE](file:///LICENSE) for terms and restrictions.  
Copyright © 2026 **Stark Digital Media Services Pvt. Ltd.** All Rights Reserved.
