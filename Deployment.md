# Server Deployment Guide: Vanna AI Agent Stack

This document provides a comprehensive server deployment guide for the **PMC CMS Vanna AI Agent Stack**. It covers system architecture, required ports, frontend and backend structures, environment configurations, and step-by-step deployment instructions for production Linux servers.

---

## 1. System Architecture & Structure

The system consists of a decoupled frontend and backend architecture designed for low-latency streaming responses, dynamic database introspection, and secure LLM-driven query generation.

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
┌──────────────┐      ┌─────────────────┐      ┌──────────────────────────────────┐
│  OpenRouter  │      │  PMC CMS Primary│      │ PMC Metadata PostgreSQL (5433)   │
│  LLM API     │      │  PostgreSQL     │      │ (Sessions, Memory & Audit Logs)  │
└──────────────┘      └─────────────────┘      └──────────────────────────────────┘
```

### Component Breakdown

#### A. Backend (FastAPI / Python)

* **Entry Point**: `main.py`
* **Framework**: FastAPI with Uvicorn ASGI server (runs on **Port 8000**).
* **Core Responsibilities**:
  * Exposes RESTful endpoints and Server-Sent Events (SSE) for streamed AI reasoning.
  * Connects to PostgreSQL databases for live schema fetching, SQL execution, and user session management.
  * Seeds business rules and domain knowledge into `DemoAgentMemory`.
  * Integrates with OpenRouter LLM service (`https://openrouter.ai/api/v1`).
  * Mounts static frontend distribution assets (`frontends/webcomponent/dist`).

#### B. Frontend (Web Component & Web App)

* **Location**: `frontends/webcomponent`
* **Tech Stack**: TypeScript, Lit (Web Components), Chart.js, Plotly.js, Vite.
* **Build Artifacts**: Compiled static bundle (`dist/vanna-components.js`, demo HTML pages).
* **Modes**:
  * **Development Mode**: Served via Vite dev server on **Port 5173**.
  * **Production Mode**: Built static bundle embedded directly via `<vanna-chat>` tag, served via FastAPI static file route (`/static/vanna-components.js`) or Nginx.

#### C. Optional Admin Dashboard (Streamlit)

* **Entry Point**: `streamlit_app.py`
* **Framework**: Streamlit (runs on **Port 8501**).
* **Purpose**: Provides an internal, interactive chat UI and schema exploration dashboard for administrators.

#### D. Database Tier

* **Primary Database (PMC CMS)**: Remote or local PostgreSQL instance containing operational data (`complaint`, `ward_master`, `category_master`, etc.).
* **Metadata Database**: Local PostgreSQL instance (**Port 5433** or **5432**) storing conversation history, agent memory, and audit execution logs.

---

## 2. Required Network Ports

The following ports must be configured in firewall rules (e.g., `ufw`, security groups, or iptables):

| Port Number           | Protocol | Direction        | Component / Service                 | Description / Access Scope                              |
| :-------------------- | :------- | :--------------- | :---------------------------------- | :------------------------------------------------------ |
| **80 / 443**    | TCP      | Inbound          | Nginx Web Server                    | Public entry point for HTTP/HTTPS client traffic.       |
| **8000**        | TCP      | Inbound/Internal | FastAPI Backend (`main.py`)       | Core API service & static asset host.                   |
| **5173**        | TCP      | Inbound/Internal | Vite Dev Server                     | **Development only**. Frontend dev environment.   |
| **8501**        | TCP      | Inbound/Internal | Streamlit UI (`streamlit_app.py`) | Optional internal admin dashboard.                      |
| **5432 / 5433** | TCP      | Outbound/Local   | PostgreSQL Databases                | Primary database & local metadata database connections. |
| **443**         | TCP      | Outbound         | OpenRouter API                      | HTTPS outbound calls to`https://openrouter.ai`.       |

---

## 3. Required Environment Configurations

Create a `.env` file in the root directory of the project (`/home/stark/PycharmProjects/vanna/.env`).

### `.env` File Template

```env
# Primary PostgreSQL Database Connection (CMS Data)
DATABASE_URL=postgresql+asyncpg://<username>:<password>@<db-host>:<db-port>/<database_name>

# PMC Metadata PostgreSQL Database Connection (Sessions & Audit Logs)
METADATA_DATABASE_URL=postgresql+asyncpg://postgres:<password>@localhost:5433/pmc_metadata_db

# OpenRouter LLM API Configuration
OPENROUTER_API_KEY=sk-or-v1-your-actual-api-key-here
OPENROUTER_LLM_MODEL=deepseek/deepseek-v4-flash-0731:nitro

# Application Environment Settings
ENV=production
LOG_LEVEL=info
```

### Remote Administrative Access (SSH Tunneling for DB Tools)
Since the Metadata DB on port `5433` is restricted to `localhost` for security, remote database clients (e.g. Antigravity DBcode, DBeaver, DataGrip) connect via an **SSH Tunnel**:

* **SSH Tunnel Tab**:
  * **Host**: `161.35.101.60`
  * **Port**: `22`
  * **User**: `root`
* **General DB Connection Tab**:
  * **Host**: `localhost`
  * **Port**: `5433`
  * **User**: `postgres`
  * **Database**: `pmc_metadata_db`


---

## 4. How the System Runs

### Development Workflow

In local development, both backend and frontend dev servers run concurrently using `start.sh`:

```bash
./start.sh
```

* **FastAPI Backend**: `http://localhost:8000`
* **Vite Frontend**: `http://localhost:5173`

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
sudo apt update && sudo apt install -y python3-pip python3-venv nodejs npm nginx git
```

### Step 2: Repository & Python Environment Setup

```bash
# Clone project repository
cd /var/www
git clone <repository-url> vanna
cd /var/www/vanna

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install --upgrade pip
pip install -e ".[fastapi,postgres]"
```

### Step 3: Build Web Component Frontend Assets

```bash
cd /var/www/vanna/frontends/webcomponent
npm install
npm run build
```

*This produces production assets in `/var/www/vanna/frontends/webcomponent/dist`.*

### Step 4: Configure Environment Variables

Create `/var/www/vanna/.env` and insert your database connections and API keys.

```bash
sudo nano /var/www/vanna/.env
```

### Step 5: Setup Systemd Service for Backend (`vanna-backend.service`)

Create a systemd unit file to keep FastAPI running automatically:

```bash
sudo nano /etc/systemd/system/vanna-backend.service
```

Add the following contents:

```ini
[Unit]
Description=Vanna AI Agent FastAPI Backend Service
After=network.target postgresql.service

[User]
User=www-data
Group=www-data
WorkingDirectory=/var/www/vanna
EnvironmentFile=/var/www/vanna/.env
ExecStart=/var/www/vanna/venv/bin/python main.py

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable vanna-backend
sudo systemctl start vanna-backend
sudo systemctl status vanna-backend
```

### Step 6 (Optional): Setup Systemd Service for Streamlit (`vanna-streamlit.service`)

If running the Streamlit admin app:

```bash
sudo nano /etc/systemd/system/vanna-streamlit.service
```

Add the following contents:

```ini
[Unit]
Description=Vanna AI Streamlit Admin Interface
After=network.target

[User]
User=www-data
Group=www-data
WorkingDirectory=/var/www/vanna
EnvironmentFile=/var/www/vanna/.env
ExecStart=/var/www/vanna/venv/bin/streamlit run streamlit_app.py --server.port 8501 --server.address 0.0.0.0

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable vanna-streamlit
sudo systemctl start vanna-streamlit
```

### Step 7: Nginx Reverse Proxy & SSL Configuration

Create an Nginx configuration file for the domain:

```bash
sudo nano /etc/nginx/sites-available/vanna
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name vanna.yourdomain.com;

    # Proxy REST API, SSE Streaming & Static Assets to FastAPI
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
      
        # SSE Streaming Headers
        proxy_set_header Connection '';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
      
        # Disable buffering for SSE streaming
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
    }

    # Optional: Route Streamlit Dashboard under /admin
    location /admin {
        proxy_pass http://127.0.0.1:8501;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

Enable site and test configuration:

```bash
sudo ln -s /etc/nginx/sites-available/vanna /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

Enable HTTPS via Let's Encrypt Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d vanna.yourdomain.com
```

---

## 6. Alternative Containerized Deployment (Docker & Docker Compose)

For containerized environments, use the following `docker-compose.yml` configuration:

```yaml
version: '3.8'

services:
  metadata-db:
    image: postgres:15-alpine
    container_name: vanna-metadata-db
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres_password
      POSTGRES_DB: pmc_metadata_db
    ports:
      - "5433:5432"
    volumes:
      - metadata_db_data:/var/lib/postgresql/data

  vanna-backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: vanna-backend
    restart: always
    ports:
      - "8000:8000"
    env_file:
      - .env
    depends_on:
      - metadata-db

volumes:
  metadata_db_data:
```

---

## 7. Verification & Health Monitoring

1. **API Healthcheck Endpoint**:

   ```bash
   curl http://localhost:8000/health
   ```

   *Expected output*: `{"status":"healthy","service":"vanna"}`
2. **System Logs Inspection**:

   * FastAPI Backend Logs: `sudo journalctl -u vanna-backend -f`
   * Application File Logs: `tail -f /var/www/vanna/main.log`
   * Nginx Access & Error Logs: `sudo tail -f /var/log/nginx/error.log`

---

## 8. Summary Checklist

* [ ] Firewall opened for Ports **80/443** (Public) and internal **8000 / 8501**.
* [ ] `.env` file populated with valid `DATABASE_URL`, `METADATA_DATABASE_URL`, and `OPENROUTER_API_KEY`.
* [ ] Frontend static assets compiled via `npm run build` in `frontends/webcomponent`.
* [ ] Systemd services active (`vanna-backend.service`).
* [ ] Nginx reverse proxy configured with SSE support (`proxy_buffering off;`) and SSL active.
