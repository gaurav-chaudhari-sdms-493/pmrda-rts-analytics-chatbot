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
from vanna.prompts import PmcSchemaSystemPromptBuilder, BUSINESS_CONTEXT_DOCUMENTATION

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pmc_chatbot.schema")

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
    """Returns raw table and column metadata directly from PostgreSQL or static fallback catalog."""
    global _schema_cache, _cache_timestamp
    now = time.time()

    if _schema_cache and (now - _cache_timestamp < CACHE_TTL_SECONDS):
        return _schema_cache

    try:
        import psycopg2

        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute(
            r"""
            SELECT table_name, column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name NOT LIKE '\_%'
              AND table_name NOT LIKE 'vw\_%'
              AND table_name NOT LIKE 'migration\_%'
              AND table_name NOT LIKE 'notification\_%'
              AND table_name NOT LIKE 'sequelize%'
              AND table_name NOT LIKE 'Sequelize%'
              AND table_name NOT LIKE '%_log'
              AND table_name NOT LIKE '%_cache'
              AND table_name NOT LIKE '%_config'
              AND table_name NOT LIKE '%_permission'
            ORDER BY table_name, ordinal_position;
        """
        )
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        tables = {}
        for t_name, c_name, d_type in rows:
            tables.setdefault(t_name, []).append(f"{c_name} ({d_type})")

        catalog_lines = ["DATABASE TABLES & COLUMNS:"]
        for table_name, cols in tables.items():
            catalog_lines.append(f"\nTable `{table_name}`:")
            for col in cols:
                catalog_lines.append(f"  - {col}")

        _schema_cache = "\n".join(catalog_lines)
        _cache_timestamp = now
        return _schema_cache
    except Exception as e:
        logger.warning(f"Live schema query failed, using static catalog fallback: {e}")
        _schema_cache = """
DATABASE TABLES & COLUMNS:
Table `complaint`:
  - id (integer)
  - complaint_number (character varying)
  - title (character varying)
  - description (text)
  - category_id (integer)
  - sub_category_id (integer)
  - ward_id (integer)
  - citizen_id (integer)
  - status (character varying)
  - created_at (timestamp without time zone)

Table `category_master`:
  - id (integer)
  - category_name (character varying)

Table `sub_category_master`:
  - id (integer)
  - category_id (integer)
  - sub_category_name (character varying)

Table `ward_master`:
  - id (integer)
  - ward_name (character varying)
"""
        _cache_timestamp = now
        return _schema_cache


# 3. Dynamic System Prompt Builder & Business Context documentation are imported from vanna.prompts
# (See src/vanna/prompts.py for system prompt templates, rules, and domain documentation)

# 4. Configure Agent Memory
agent_memory = DemoAgentMemory(max_items=1000)


async def seed_domain_knowledge(memory: DemoAgentMemory, user: CoreUser):
    """Seed manual business rules and context into agent memory."""
    dummy_context = ToolContext(
        user=user,
        conversation_id="system_init",
        request_id="init_seed",
        agent_memory=memory,
    )
    for doc in BUSINESS_CONTEXT_DOCUMENTATION:
        await memory.save_text_memory(content=doc, context=dummy_context)
    logger.info("Successfully seeded domain knowledge and business rules into Agent Memory.")


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
    system_prompt_builder=PmcSchemaSystemPromptBuilder(schema_provider=fetch_live_database_schema),
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
    server.run()
