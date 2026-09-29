import os
import sys
import time
import logging
import asyncio
from typing import List, Optional
from dotenv import load_dotenv

# Ensure vanna package is importable from workspace root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from vanna import Agent
from vanna.core.system_prompt import SystemPromptBuilder
from vanna.core.tool import ToolContext
from vanna.core.tool.models import ToolSchema
from vanna.core.user.models import User as CoreUser
from vanna.core.registry import ToolRegistry
from vanna.core.user import UserResolver, User, RequestContext
from vanna.tools import RunSqlTool, VisualizeDataTool
from vanna.tools.agent_memory import (
    SaveQuestionToolArgsTool,
    SearchSavedCorrectToolUsesTool,
    SaveTextMemoryTool,
)
from vanna.servers.fastapi import VannaFastAPIServer
from vanna.integrations.openai import OpenAILlmService
from vanna.integrations.postgres import PostgresRunner, PostgresConversationStore
from vanna.integrations.local.agent_memory import DemoAgentMemory
from vanna.core.filter import ContextWindowFilter
from vanna.prompts import PmrdaSchemaSystemPromptBuilder, PmcSchemaSystemPromptBuilder, BUSINESS_CONTEXT_DOCUMENTATION

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pmrda_chatbot.schema")

# Load environment variables
load_dotenv()

# 1. Configure OpenRouter LLM
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.getenv("OPENROUTER_LLM_MODEL")

llm = OpenAILlmService(
    model=OPENROUTER_MODEL,
    api_key=OPENROUTER_API_KEY,
    base_url="https://openrouter.ai/api/v1",
)

# 2. Configure Database Connection
RAW_DATABASE_URL = os.getenv("DATABASE_URL")
DATABASE_URL = RAW_DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://", 1)

db_tool = RunSqlTool(
    sql_runner=PostgresRunner(connection_string=DATABASE_URL)
)

# 2b. Configure Metadata Database Connection for Conversations & Logging
METADATA_DATABASE_URL = os.getenv("METADATA_DATABASE_URL")
conversation_store = PostgresConversationStore(connection_string=METADATA_DATABASE_URL)


# Schema Cache Helper
_schema_cache = None
_cache_timestamp = 0
CACHE_TTL_SECONDS = 300


def fetch_live_database_schema() -> str:
    """Returns raw table and column metadata directly from PostgreSQL, dynamically excluding empty tables (0 rows)."""
    if os.getenv("FEED_LIVE_SCHEMA", "false").lower() != "true":
        logger.info("Live database schema feeding is DISABLED (FEED_LIVE_SCHEMA != true). Relying strictly on Business Rules and Manual Question-SQL Training in Agent Memory.")
        return "No live database schema provided. Rely strictly on Business Rules and Manual Question-SQL Pair Training in Agent Memory."

    global _schema_cache, _cache_timestamp
    now = time.time()

    if _schema_cache and (now - _cache_timestamp < CACHE_TTL_SECONDS):
        return _schema_cache

    try:
        import psycopg2

        conn = psycopg2.connect(DATABASE_URL, connect_timeout=5)
        cursor = conn.cursor()

        # Step 1: Discover all base tables in public schema
        cursor.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_type = 'BASE TABLE'
            ORDER BY table_name;
            """
        )
        all_tables = [r[0] for r in cursor.fetchall()]

        # Step 2: Dynamically filter tables to include ONLY active operational tables (>0 rows) and exclude backup/snapshot tables (bak_*)
        active_tables = set()
        for t_name in all_tables:
            # Exclude backup and staging snapshot tables
            if t_name.startswith('bak_') or t_name.startswith('_bak_'):
                continue
            try:
                cursor.execute(f'SELECT EXISTS (SELECT 1 FROM "{t_name}" LIMIT 1);')
                if cursor.fetchone()[0]:
                    active_tables.add(t_name)
            except Exception:
                conn.rollback()

        # Step 3: Fetch column metadata for active tables only
        cursor.execute(
            """
            SELECT table_name, column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position;
            """
        )
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        tables = {}
        for t_name, c_name, d_type in rows:
            if t_name in active_tables:
                tables.setdefault(t_name, []).append(f"{c_name} ({d_type})")

        catalog_lines = [f"DATABASE TABLES & COLUMNS (Active Useful Tables: {len(tables)}):"]
        for table_name, cols in tables.items():
            catalog_lines.append(f"\nTable `{table_name}`:")
            for col in cols:
                catalog_lines.append(f"  - {col}")

        _schema_cache = "\n".join(catalog_lines)
        _cache_timestamp = now
        logger.info(f"Successfully fetched live DB schema for {len(tables)} active operational tables (excluding empty & backup tables).")
        return _schema_cache
    except Exception as e:
        logger.warning(f"Live schema query failed, using static active tables catalog fallback: {e}")
        _schema_cache = """
DATABASE TABLES & COLUMNS (Active Useful Tables Fallback Catalog):

Table `rts_citizen_applications`:
  - id (uuid)
  - application_number (character varying)
  - service_id (uuid)
  - service_name (character varying)
  - applicant_name (character varying)
  - applicant_email (character varying)
  - applicant_mobile (character varying)
  - status (character varying)
  - department_id (uuid)
  - submitted_at (timestamp with time zone)
  - created_at (timestamp with time zone)
  - updated_at (timestamp with time zone)

Table `sdk_dg_documents`:
  - id (uuid)
  - application_id (uuid)
  - document_number (character varying)
  - document_name (character varying)
  - template_id (uuid)
  - status (character varying)
  - generated_at (timestamp with time zone)

Table `sdk_aw_workflow_tasks`:
  - id (uuid)
  - instance_id (uuid)
  - application_id (uuid)
  - task_name (character varying)
  - assigned_user_id (uuid)
  - department_id (uuid)
  - status (character varying)
  - created_at (timestamp with time zone)

Table `sdk_pg_transactions`:
  - id (uuid)
  - transaction_number (character varying)
  - application_id (uuid)
  - amount (numeric)
  - payment_gateway (character varying)
  - status (character varying)
  - payment_date (timestamp with time zone)

Table `sdk_svc_services`:
  - id (uuid)
  - service_name (character varying)
  - department_id (uuid)
  - is_active (boolean)

Table `sdk_svc_departments`:
  - id (uuid)
  - department_name (character varying)

Table `sdk_rbac_users`:
  - id (uuid)
  - username (character varying)
  - email (character varying)
  - full_name (character varying)
  - designation (character varying)

Table `sdk_svc_service_sla`:
  - id (uuid)
  - service_id (uuid)
  - sla_days (integer)

Table `sdk_core_villages`:
  - id (uuid)
  - village_name (character varying)
  - taluka_id (uuid)

Table `license_master`:
  - id (uuid)
  - license_number (character varying)
  - holder_name (character varying)
  - license_type (character varying)
"""
        _cache_timestamp = now
        return _schema_cache


# 3. Dynamic System Prompt Builder & Business Context documentation are imported from vanna.prompts
# (See src/vanna/prompts.py for system prompt templates, rules, and domain documentation)

from vanna_training_data import register_training_data

# 4. Configure Agent Memory
agent_memory = DemoAgentMemory(max_items=1000)


async def seed_domain_knowledge(memory: DemoAgentMemory, user: CoreUser):
    """Seed manual business rules, context, and manual Question-SQL training pairs into agent memory."""
    dummy_context = ToolContext(
        user=user,
        conversation_id="system_init",
        request_id="init_seed",
        agent_memory=memory,
    )
    for doc in BUSINESS_CONTEXT_DOCUMENTATION:
        await memory.save_text_memory(content=doc, context=dummy_context)
    logger.info("Successfully seeded domain knowledge and business rules into Agent Memory.")

    # Register manual Question-SQL training pairs from vanna_training_data.py
    count = await register_training_data(memory, user=user)
    logger.info(f"Successfully seeded {count} manual Question-SQL training pairs from vanna_training_data.py into Agent Memory.")


# 5. Configure User Resolver
class SimpleUserResolver(UserResolver):
    async def resolve_user(self, request_context: RequestContext) -> User:
        user_email = request_context.get_cookie("vanna_email") or "admin@example.com"
        group = "admin" if user_email == "admin@example.com" else "user"
        return User(id=user_email, email=user_email, group_memberships=[group])


user_resolver = SimpleUserResolver()

# 6. Register Tools
tools = ToolRegistry()
tools.register_local_tool(db_tool, access_groups=["admin", "user"])
tools.register_local_tool(SaveQuestionToolArgsTool(), access_groups=["admin"])
tools.register_local_tool(SearchSavedCorrectToolUsesTool(), access_groups=["admin", "user"])
tools.register_local_tool(SaveTextMemoryTool(), access_groups=["admin", "user"])
tools.register_local_tool(VisualizeDataTool(), access_groups=["admin", "user"])

# 7. Create Global Agent Instance (Storage is handled explicitly via PmcMetadataLogger)
vanna_agent = Agent(
    llm_service=llm,
    tool_registry=tools,
    user_resolver=user_resolver,
    agent_memory=agent_memory,
    system_prompt_builder=PmrdaSchemaSystemPromptBuilder(schema_provider=fetch_live_database_schema),
    conversation_filters=[ContextWindowFilter(max_questions=5)],
)


# Alias for backwards compatibility
agent = vanna_agent

# 8. Run Server with Pre-seeded Domain Knowledge
if __name__ == "__main__":
    # Seed domain knowledge asynchronously on boot
    default_user = User(id="admin@example.com", email="admin@example.com", group_memberships=["admin"])
    asyncio.run(seed_domain_knowledge(agent_memory, default_user))

    dist_folder = os.path.join(os.path.dirname(__file__), "frontends/webcomponent/dist")
    server = VannaFastAPIServer(
        agent,
        config={
            "dev_mode": True,
            "static_folder": dist_folder,
            "cdn_url": "/static/vanna-components.js",
        },
    )
    port = int(os.getenv("PORT", 8000))
    server.run(port=port)
