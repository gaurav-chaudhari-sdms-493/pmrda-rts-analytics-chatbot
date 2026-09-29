# Server Deployment Guide: PMRDA RTS AI Agent Stack

This document provides a comprehensive server deployment guide for the **PMRDA RTS AI Analytics Chatbot Stack** (Pune Metropolitan Region Development Authority). It covers system architecture, required ports, frontend and backend structures, environment configurations, and step-by-step deployment instructions for production Linux servers.

---

## 1. System Architecture & Structure

The system consists of a decoupled frontend and backend architecture designed for low-latency streaming responses, dynamic database introspection, and secure LLM-driven query generation against the **PMRDA RTS Database (PostgreSQL 16)**.

```
                       ┌──────────────────────────────────────────────┐
                       │                Client Browser                │
                       └──────────────────────┬───────────────────────┘
                                              │ HTTP / HTTPS / SSE
                                              ▼
                       ┌──────────────────────────────────────────────┐
                       │          Nginx Reverse Proxy (Port 80/443)   │
                       └──────────────┬────────────────┬──────────────┘
                                      │                │
            /api /chat /health /static│                │ / (Optional Streamlit)
                                      ▼                ▼
┌──────────────────────────────────────────┐  ┌───────────────────────────────────┐
│        FastAPI Backend (Port 8000)       │  │     Streamlit Dashboard (8501)    │
│  - main.py (Uvicorn ASGI Server)         │  │  - streamlit_app.py (Admin/Data)  │
│  - System Prompt & Schema Engine         │  └───────────────────────────────────┘
│  - Static Asset Server (/static)         │
└──────┬──────────────────────┬────────────┘
       │                      │
       ▼                      ▼
┌──────────────┐      ┌─────────────────────────┐      ┌──────────────────────────────────┐
│  OpenRouter  │      │  PMRDA RTS Primary DB   │      │ PMRDA Metadata PostgreSQL (5433) │
│  LLM API     │      │  PostgreSQL (Port 5432) │      │ (Sessions, Memory & Audit Logs)  │
└──────────────┘      └─────────────────────────┘      └──────────────────────────────────┘
```

### Component Breakdown

#### A. Backend (FastAPI / Python)

* **Entry Point**: `main.py`
* **Framework**: FastAPI with Uvicorn ASGI server (runs on **Port 8000**).
* **Core Responsibilities**:
  * Exposes RESTful endpoints and Server-Sent Events (SSE) on `/api/vanna/v2/chat_sse` for streamed AI reasoning.
  * Connects to the primary PMRDA RTS PostgreSQL database for live schema extraction and read-only query execution.
  * Seeds PMRDA business rules, domain knowledge, and manual Question-SQL training pairs into `DemoAgentMemory`.
  * Integrates with OpenRouter LLM API service (`https://openrouter.ai/api/v1`).
  * Mounts compiled static frontend distribution assets (`frontends/webcomponent/dist` at `/static`).

#### B. Frontend (Web Component & Floating Embed Widget)

* **Location**: `frontends/webcomponent`
* **Tech Stack**: TypeScript, Lit (Web Components), Chart.js, Plotly.js, Vite.
* **Build Artifacts**: Compiled production bundle (`dist/vanna-components.js`, `dist/floating-widget-demo.html`).
* **Modes**:
  * **Development Mode**: Served via Vite dev server on **Port 5173**.
  * **Production Mode**: Built static bundle embedded directly via `<vanna-chat>` tag, served via FastAPI static file route (`/static/vanna-components.js`) or Nginx.

#### C. Optional Admin Dashboard (Streamlit)

* **Entry Point**: `streamlit_app.py`
* **Framework**: Streamlit (runs on **Port 8501**).
* **Purpose**: Provides an internal, interactive chat UI and schema exploration dashboard for administrators and developers.

#### D. Database Tier

* **Primary Database (PMRDA RTS)**: Remote or local PostgreSQL instance containing operational RTS data (`rts_citizen_applications`, `sdk_aw_workflow_tasks`, `sdk_pg_transactions`, `sdk_svc_services`, `sdk_core_villages`, etc.).
* **Metadata Database**: Local PostgreSQL instance (**Port 5433** or **5432**) storing conversation history, agent memory, and audit execution logs (`pmrda_metadata_db`).

---

## 2. Required Network Ports

The following ports must be configured in firewall rules (`ufw`, cloud security groups, or iptables):

| Port Number           | Protocol | Direction        | Component / Service                 | Description / Access Scope                              |
| :-------------------- | :------- | :--------------- | :---------------------------------- | :------------------------------------------------------ |
| **80 / 443**          | TCP      | Inbound          | Nginx Web Server                    | Public entry point for HTTP/HTTPS client traffic.       |
| **8000**              | TCP      | Inbound/Internal | FastAPI Backend (`main.py`)         | Core API service & static asset host.                   |
| **5173**              | TCP      | Inbound/Internal | Vite Dev Server                     | **Development only**. Frontend dev environment.         |
| **8501**              | TCP      | Inbound/Internal | Streamlit UI (`streamlit_app.py`)   | Optional internal admin dashboard.                      |
| **5432 / 5433**       | TCP      | Outbound/Local   | PostgreSQL Databases                | PMRDA RTS database & local metadata database.           |
| **443**               | TCP      | Outbound         | OpenRouter API                      | HTTPS outbound calls to `https://openrouter.ai`.        |

---

## 3. Required Environment Configurations

Create a `.env` file in the root directory of the project (`/var/www/pmrda-rts-analytics-chatbot/.env`).

### `.env` File Template

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
OPENROUTER_API_KEY=sk-or-v1-your-actual-api-key-here
OPENROUTER_LLM_MODEL=deepseek/deepseek-v4-flash-0731:nitro

# -----------------------------------------------------------------------------
# Application Environment Settings
# -----------------------------------------------------------------------------
HOST=0.0.0.0
PORT=8000
FEED_LIVE_SCHEMA=true
ENV=production
LOG_LEVEL=info
```

### Remote Administrative Access (SSH Tunneling for DB Tools)

If the database or metadata database is restricted to private IP/localhost for security, connect remote database GUI clients (e.g. DBeaver, DataGrip, Antigravity DBcode) via an **SSH Tunnel**:

* **SSH Tunnel Tab**:
  * **Host**: `<Your-Bastion-or-Server-IP>`
  * **Port**: `22`
  * **User**: `ubuntu` (or server user)
* **General DB Connection Tab**:
  * **Host**: `localhost` (or internal DB host)
  * **Port**: `5432` / `5433`
  * **Database**: `PMRDA-RTS` / `pmrda_metadata_db`

---

## 4. How the System Runs

### Development Workflow

In local development, both backend and frontend dev servers run concurrently using `start.sh`:

```bash
./start.sh
```

* **FastAPI Backend**: `http://localhost:8000`
* **Vite Frontend**: `http://localhost:5173`
* **Widget Demo**: `http://localhost:5173/static/floating-widget-demo.html`

### Production Workflow

In a production deployment:

1. **Frontend Assets** are pre-compiled into static distribution files:
   ```bash
   cd frontends/webcomponent
   npm install
   npm run build
   ```
2. **FastAPI Backend** serves the API endpoints on **Port 8000** and mounts the compiled frontend static folder (`dist/`).
3. **Nginx** handles public SSL termination and proxies requests to FastAPI on **Port 8000**.

---

## 5. Step-by-Step Server Deployment Guide (Systemd + Nginx)

This section details standard production deployment on an Ubuntu / Debian server using `systemd` and `Nginx`.

### Step 1: System Prerequisites Installation

```bash
sudo apt update && sudo apt install -y python3-pip python3-venv nodejs npm nginx git curl
```

### Step 2: Repository & Python Environment Setup

```bash
# Clone project repository
cd /var/www
git clone https://github.com/gaurav-chaudhari-sdms-493/pmrda-rts-analytics-chatbot.git
cd /var/www/pmrda-rts-analytics-chatbot

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install --upgrade pip
pip install -e ".[fastapi,postgres]"
```

### Step 3: Build Web Component Frontend Assets

```bash
cd /var/www/pmrda-rts-analytics-chatbot/frontends/webcomponent
npm install
npm run build
cd /var/www/pmrda-rts-analytics-chatbot
```

*This compiles production assets in `/var/www/pmrda-rts-analytics-chatbot/frontends/webcomponent/dist`.*

### Step 4: Configure Environment Variables

Create `/var/www/pmrda-rts-analytics-chatbot/.env` with your database credentials and API key:

```bash
nano /var/www/pmrda-rts-analytics-chatbot/.env
```

### Step 5: Setup Systemd Service for Backend (`pmrda-chatbot-backend.service`)

Create a systemd unit file to keep FastAPI running automatically:

```bash
sudo nano /etc/systemd/system/pmrda-chatbot-backend.service
```

Add the following contents:

```ini
[Unit]
Description=PMRDA RTS AI Chatbot FastAPI Backend Service
After=network.target postgresql.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/pmrda-rts-analytics-chatbot
EnvironmentFile=/var/www/pmrda-rts-analytics-chatbot/.env
ExecStart=/var/www/pmrda-rts-analytics-chatbot/venv/bin/python main.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Set permissions, enable, and start the service:

```bash
sudo chown -R www-data:www-data /var/www/pmrda-rts-analytics-chatbot
sudo systemctl daemon-reload
sudo systemctl enable pmrda-chatbot-backend
sudo systemctl start pmrda-chatbot-backend
sudo systemctl status pmrda-chatbot-backend
```

### Step 6 (Optional): Setup Systemd Service for Streamlit (`pmrda-chatbot-streamlit.service`)

If running the Streamlit admin dashboard on Port 8501:

```bash
sudo nano /etc/systemd/system/pmrda-chatbot-streamlit.service
```

Add the following contents:

```ini
[Unit]
Description=PMRDA RTS AI Streamlit Admin Interface
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/pmrda-rts-analytics-chatbot
EnvironmentFile=/var/www/pmrda-rts-analytics-chatbot/.env
ExecStart=/var/www/pmrda-rts-analytics-chatbot/venv/bin/streamlit run streamlit_app.py --server.port 8501 --server.address 0.0.0.0
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start Streamlit:

```bash
sudo systemctl daemon-reload
sudo systemctl enable pmrda-chatbot-streamlit
sudo systemctl start pmrda-chatbot-streamlit
```

---

## 6. Nginx Reverse Proxy Configuration

Configure Nginx to serve the site with SSL and proxy API/SSE requests to FastAPI.

Create `/etc/nginx/sites-available/pmrda-chatbot`:

```bash
sudo nano /etc/nginx/sites-available/pmrda-chatbot
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name pmrda-chatbot.yourdomain.com;

    client_max_body_size 50M;

    # Static Assets & Web Component Distribution
    location /static/ {
        alias /var/www/pmrda-rts-analytics-chatbot/frontends/webcomponent/dist/;
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }

    # FastAPI SSE Streaming Endpoint (Crucial: buffer disabled for instant token streaming)
    location /api/vanna/v2/chat_sse {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Disable buffering for Server-Sent Events (SSE)
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }

    # FastAPI General API Routes
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    # Health Check Endpoint
    location /health {
        proxy_pass http://127.0.0.1:8000/health;
        proxy_set_header Host $host;
    }

    # Root: Default to Fullscreen Web Component Interface or Widget Demo
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site and test configuration:

```bash
sudo ln -s /etc/nginx/sites-available/pmrda-chatbot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### SSL Setup with Let's Encrypt (Certbot)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d pmrda-chatbot.yourdomain.com
```

---

## 7. Production Verification & Smoke Tests

After deployment, verify system health using the following checklist:

| Verification Step | Command / URL | Expected Result |
| :--- | :--- | :--- |
| **Backend Health** | `curl -s http://127.0.0.1:8000/health` | `{"status":"healthy","service":"vanna"}` |
| **Systemd Status** | `sudo systemctl status pmrda-chatbot-backend` | `Active: active (running)` |
| **Nginx Status** | `sudo systemctl status nginx` | `Active: active (running)` |
| **Static Asset Load** | `curl -I https://pmrda-chatbot.yourdomain.com/static/vanna-components.js` | `HTTP/1.1 200 OK` |
| **SSE Chat Stream** | Send a test query via frontend web UI | Real-time SQL execution & answer |
