# Project Replication & Architecture Adaptation Guide

This guide provides a comprehensive checklist and step-by-step instructions for adapting this Text-to-SQL Analytics Chatbot architecture to **any new database, client, or enterprise domain**.

---

## 🏗️ Architectural Overview

The project is structured into three primary tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND PRESENTATION                           │
│  - Web Component (Lit + Vite)        : frontends/webcomponent/         │
│  - Floating Embed Widget            : public/floating-widget-demo.html │
│  - Streamlit Dashboard (Alternative) : streamlit_app.py                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / SSE (/api/vanna/v2/chat_sse)
┌───────────────────────────────────▼────────────────────────────────────┐
│                        BACKEND ORCHESTRATION                           │
│  - Server Engine                     : main.py (FastAPI / Uvicorn)     │
│  - Prompts & Business Rules          : src/vanna/prompts.py            │
│  - Question-SQL Training Pairs       : vanna_training_data.py          │
│  - Dynamic Live Schema Extraction    : main.py                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ SQL Execution / DB Inspection
┌───────────────────────────────────▼────────────────────────────────────┐
│                       DATABASE & LLM PROVIDERS                         │
│  - Target Database                   : PostgreSQL / MySQL / SQLite     │
│  - LLM Reasoning Provider            : OpenRouter / Anthropic / OpenAI │
│  - In-Memory / Vector Knowledge      : DemoAgentMemory (ChromaDB)      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Quick Adaptation Checklist (Files to Modify)

| # | Priority | File Path | Purpose of Modification |
|---|---|---|---|
| **1** | 🔴 Critical | [`.env`](file:///.env) | Database connection credentials, LLM API keys & model selection. |
| **2** | 🔴 Critical | [`src/vanna/prompts.py`](file:///src/vanna/prompts.py) | Domain persona, strict scope restriction, schema domain map, join rules, and suggested queries. |
| **3** | 🔴 Critical | [`vanna_training_data.py`](file:///vanna_training_data.py) | Enterprise Question-to-SQL few-shot examples for vector memory. |
| **4** | 🔴 Critical | [`main.py`](file:///main.py) | Table filtering logic for live schema, fallback schema, branding, and server ports. |
| **5** | 🟡 High | [`start.sh`](file:///start.sh) | Port cleanup, background service management, health checks. |
| **6** | 🟡 High | [`frontends/webcomponent/index.html`](file:///frontends/webcomponent/index.html) | Fullscreen chat page title, meta branding, and favicon. |
| **7** | 🟡 High | [`frontends/webcomponent/public/floating-widget-demo.html`](file:///frontends/webcomponent/public/floating-widget-demo.html) | Floating widget embed demo, titles, widget labels, and script version tags. |
| **8** | 🟢 Medium | [`frontends/webcomponent/vite.config.ts`](file:///frontends/webcomponent/vite.config.ts) | Vite proxy endpoints (`/api` and `/static`). |
| **9** | 🟢 Medium | [`frontends/webcomponent/src/styles/rich-component-styles.ts`](file:///frontends/webcomponent/src/styles/rich-component-styles.ts) | Developer Info container visibility, primary colors, theme styling. |
| **10**| 🟢 Medium | [`frontends/webcomponent/src/components/rich-component-system.ts`](file:///frontends/webcomponent/src/components/rich-component-system.ts) | Developer Info accordion behavior (default collapsed vs expanded). |
| **11**| ⚪ Optional | [`streamlit_app.py`](file:///streamlit_app.py) | Streamlit dashboard interface title, header branding, and suggested prompts. |

---

## 🛠️ Step-by-Step Code Modification Instructions

### 1. Environment Configuration: `.env`
Update your database connection parameters, credentials, and LLM provider:

```bash
# -----------------------------------------------------------------------------
# LLM Provider Configuration (OpenRouter / Anthropic / OpenAI)
# -----------------------------------------------------------------------------
VANNA_MODEL=anthropic/claude-3.5-sonnet   # or openai/gpt-4o, etc.
OPENROUTER_API_KEY=your_api_key_here

# -----------------------------------------------------------------------------
# Target Database Connection
# -----------------------------------------------------------------------------
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=your_new_database_name
DB_USER=your_db_username
DB_PASSWORD=your_db_password

# -----------------------------------------------------------------------------
# Application Server Settings
# -----------------------------------------------------------------------------
PORT=8000
HOST=0.0.0.0
FEED_LIVE_SCHEMA=true
```

---

### 2. Domain Scope & System Prompts: `src/vanna/prompts.py`
This file is the **brain** of the SQL Assistant. Update the following sections:

#### A. Strict Domain Scope Rejection Rule
Prevent the chatbot from answering off-topic questions (e.g. general recipes, trivia, coding):
```python
=== STRICT <ORGANIZATION> DOMAIN SCOPE RULE (CRITICAL & NON-NEGOTIABLE) ===
- You are STRICTLY dedicated to <Organization Name> (<ACRONYM>) services, data analytics, and database queries ONLY.
- IF A USER ASKS AN OFF-TOPIC OR GENERAL QUESTION UNRELATED TO <ACRONYM>, YOU MUST STRICTLY REFUSE TO ANSWER.
- Reply politely in the user's language:
  "I am the <ACRONYM> AI Assistant and I can only answer questions related to <Organization Name> services and data."
```

#### B. Active Core Domain Tables (Domain Map)
Group active database tables by functional modules.
> ⚠️ **CRITICAL RULE**: Do **NOT** include static record counts (e.g. do not write "1,390 villages" or "4,500 records") in the prompt text. If static counts are present, the LLM will quote them directly instead of running a live SQL query!

```python
=== <ORGANIZATION> SCHEMA DOMAIN MAP & TABLE SELECTION RULES ===
1. ACTIVE CORE DOMAIN TABLES:
   - **Users & Auth**: `app_users`, `app_roles`, `user_role_mappings`
   - **Transactions & Orders**: `orders`, `order_items`, `payment_transactions`
   - **Catalog & Inventory**: `products`, `categories`, `warehouses`
```

#### C. Recommended Join Patterns
Specify primary and foreign key relationships so the model doesn't guess invalid joins:
```python
2. RECOMMENDED CORE TABLE JOIN PATTERNS:
   - `orders.user_id = app_users.id`
   - `order_items.order_id = orders.id`
   - `order_items.product_id = products.id`
```

#### D. Database-First Live Query Rule (`Rule 0`)
Enforce that the LLM must execute `run_sql` for all quantitative metrics:
```python
0. STRICT DATABASE-FIRST LIVE QUERY MANDATE:
   - ABSOLUTELY NEVER answer counts, totals, or statistics from memory or static estimation!
   - For every question asking for counts, quantities, or statuses:
     - ALWAYS execute a live SQL query using run_sql against the database.
```

#### E. Branding & Suggested Queries
Update hero text and query chips for the frontend UI:
```python
DEFAULT_HERO_TITLE = "<Organization Name> AI Assistant"
DEFAULT_HERO_SUBTITLE = "<Subtitle in local language / english>"
DEFAULT_SUGGESTED_QUERIES = [
    {
        "query": "Show total orders count till now",
        "title": "Total Orders Count",
        "subtitle": "All-time summary",
        "icon": "📈"
    },
    ...
]
```

---

### 3. Few-Shot Training Data: `vanna_training_data.py`
The agent uses vector memory similarity search to find similar Question-SQL pairs before generating SQL.
Replace existing pairs with 15–25 realistic questions and correct PostgreSQL queries for your new schema:

```python
from vanna.capabilities.agent_memory import ToolMemory

training_examples = [
    ToolMemory(
        question="What is the total number of registered customers?",
        tool_name="run_sql",
        args={
            "sql": """
            SELECT COUNT(*)::int AS "Total Customers"
            FROM app_users
            WHERE is_active = true AND deleted_at IS NULL;
            """
        }
    ),
    ToolMemory(
        question="Show total revenue grouped by month for 2026",
        tool_name="run_sql",
        args={
            "sql": """
            SELECT 
                TO_CHAR(created_at, 'YYYY-MM') AS "Month",
                SUM(amount)::numeric(12, 2) AS "Total Revenue"
            FROM payment_transactions
            WHERE status = 'SUCCESS'
            GROUP BY 1
            ORDER BY 1 ASC;
            """
        }
    ),
]
```

---

### 4. Server & Schema Catalog: `main.py`

#### A. Table Filtering in `fetch_live_database_schema()`
Exclude internal, backup, staging, or empty tables from being fed into the LLM context:
```python
# Exclude unwanted table prefixes:
if table_name.startswith(("bak_", "_bak_", "tmp_", "audit_")):
    continue

# Optionally restrict to specific active tables:
ALLOWED_TABLES = {"app_users", "orders", "order_items", "products"}
if table_name not in ALLOWED_TABLES:
    continue
```

#### B. Fallback Schema Catalog
Provide a minimal fallback DDL/schema string if the live database inspection times out on startup.

#### C. System Prompt Builder
Ensure `SystemPromptBuilder` is instantiated with your new builder from `src/vanna/prompts.py`:
```python
vanna_agent = Agent(
    llm_service=llm,
    tool_registry=tools,
    user_resolver=user_resolver,
    agent_memory=agent_memory,
    system_prompt_builder=PmrdaSchemaSystemPromptBuilder(
        schema_provider=fetch_live_database_schema
    ),
    conversation_filters=[ContextWindowFilter(max_questions=5)],
)
```

---

### 5. Frontend Interfaces & Embedding

#### A. Fullscreen Chat UI: `frontends/webcomponent/index.html`
- Update `<title>` tag.
- Update favicon emoji/SVG.

#### B. Floating Widget Demo: `frontends/webcomponent/public/floating-widget-demo.html`
- Update headings, portal title, and description.
- Update the initialization call:
  ```javascript
  PMCWidget.init({
    apiHost: window.location.origin,
    title: "<New Organization> AI Assistant",
    subtitle: "<Subheading / Local translation>",
    position: "bottom-right",
    primaryColor: "#2563eb"
  });
  ```
- **Cache Busting**: When updating scripts, increment version parameters:
  ```html
  <script type="module" src="/static/vanna-components.js?v=13"></script>
  <script src="/static/pmc-widget.js?v=13"></script>
  ```

#### C. Developer Info Container Visibility
In `frontends/webcomponent/src/styles/rich-component-styles.ts`:
- **To Hide**:
  ```css
  .dev-info-container {
    display: none !important;
  }
  ```
- **To Show**:
  ```css
  .dev-info-container {
    display: block;
  }
  ```

#### D. Rebuilding the Frontend Bundle
Whenever modifying `.ts` or `.css` files under `frontends/webcomponent/src/`:
```bash
cd frontends/webcomponent
npm run build
```
This updates `frontends/webcomponent/dist/vanna-components.js`, which is served by FastAPI on `/static/vanna-components.js`.

---

### 6. Service Runner: `start.sh`
Ensure `start.sh` cleans up appropriate ports, checks database health, and launches both servers:
```bash
# Ports to clean before start:
fuser -k 8000/tcp 2>/dev/null || true
fuser -k 5173/tcp 2>/dev/null || true

# Start FastAPI on Port 8000
python main.py &

# Start Vite dev server on Port 5173
cd frontends/webcomponent && npm run dev -- --host &
```

---

## 🚀 Execution & Verification Workflow

When launching your new project:

1. **Verify Database Connectivity**:
   ```bash
   python -c "import psycopg2, os; conn = psycopg2.connect(dbname=os.getenv('DB_NAME'), user=os.getenv('DB_USER'), password=os.getenv('DB_PASSWORD'), host=os.getenv('DB_HOST'), port=os.getenv('DB_PORT')); print('DB Connected Successfully!')"
   ```

2. **Rebuild Frontend Components**:
   ```bash
   cd frontends/webcomponent && npm run build && cd ../..
   ```

3. **Start All Services**:
   ```bash
   ./start.sh
   ```

4. **Health Check Endpoints**:
   - Backend API: `curl http://127.0.0.1:8000/health` → `{"status":"healthy","service":"vanna"}`
   - Fullscreen Interface: `http://localhost:5173/`
   - Floating Widget Demo: `http://localhost:5173/static/floating-widget-demo.html`
