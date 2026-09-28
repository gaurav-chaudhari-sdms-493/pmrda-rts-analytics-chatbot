"""
Framework-agnostic chat handling logic.
"""

import uuid
from typing import AsyncGenerator, List

from ...core import Agent
from .models import ChatRequest, ChatResponse, ChatStreamChunk


class ChatHandler:
    """Core chat handling logic - framework agnostic."""

    def __init__(
        self,
        agent: Agent,
    ):
        """Initialize chat handler.

        Args:
            agent: The agent to handle chat requests
        """
        self.agent = agent

    async def handle_stream(
        self, request: ChatRequest
    ) -> AsyncGenerator[ChatStreamChunk, None]:
        """Stream chat responses.

        Args:
            request: Chat request

        Yields:
            Chat stream chunks
        """
        conversation_id = request.conversation_id or self._generate_conversation_id()
        # Use request_id from client for tracking, or use the one generated internally
        request_id = request.request_id or str(uuid.uuid4())

        import os
        import time
        from ...metadata_logger import get_metadata_logger

        meta_logger = get_metadata_logger()
        user_email = request.request_context.cookies.get("vanna_email") if request.request_context else None

        # 1. Explicitly store User prompt in pmc_metadata_db
        meta_logger.log_user_message(session_id=conversation_id, content=request.message, user_email=user_email)

        start_time = time.time()
        text_parts = []
        sql_used = None
        total_records = None
        sql_execution_ms = 0.0
        output_file = None

        phase1_rag_ms = None
        phase2_schema_prompt_ms = None
        phase3_llm_reasoning_ms = None
        phase4_sql_execution_ms = None
        phase5_ui_overhead_ms = None
        prompt_tokens = None
        completion_tokens = None
        total_tokens = None
        estimated_cost_usd = None

        async for component in self.agent.send_message(
            request_context=request.request_context,
            message=request.message,
            conversation_id=conversation_id,
        ):
            chunk = ChatStreamChunk.from_component(component, conversation_id, request_id)

            # Capture text content and SQL execution details for metadata logging
            rich_data = chunk.rich or {}
            simple_data = chunk.simple or {}
            comp_data = rich_data.get("data") if isinstance(rich_data.get("data"), dict) else rich_data

            # 1. Text content
            txt = rich_data.get("text") or rich_data.get("content") or comp_data.get("text") or comp_data.get("content") or simple_data.get("text") or ""
            if txt and not comp_data.get("rows") and not comp_data.get("raw_metrics") and not comp_data.get("_raw_metrics"):
                if not ("Total response time:" in txt or "Phase-Wise Execution" in txt):
                    text_parts.append(txt)

            # 2. Data Table / SQL details & output file
            if "total_rows" in comp_data or "row_count" in comp_data or "sql" in comp_data or "output_file" in comp_data or "total_rows" in rich_data or "row_count" in rich_data:
                if comp_data.get("total_rows") is not None:
                    total_records = comp_data.get("total_rows")
                elif comp_data.get("row_count") is not None:
                    total_records = comp_data.get("row_count")
                elif rich_data.get("total_rows") is not None:
                    total_records = rich_data.get("total_rows")

                if comp_data.get("sql"):
                    sql_used = comp_data.get("sql")
                elif comp_data.get("query"):
                    sql_used = comp_data.get("query")
                elif rich_data.get("sql"):
                    sql_used = rich_data.get("sql")

                if comp_data.get("output_file"):
                    output_file = comp_data.get("output_file")
                elif rich_data.get("output_file"):
                    output_file = rich_data.get("output_file")

                if comp_data.get("execution_time_ms"):
                    sql_execution_ms = comp_data.get("execution_time_ms")
                elif rich_data.get("execution_time_ms"):
                    sql_execution_ms = rich_data.get("execution_time_ms")

            # 3. Extract phase timings & token metrics from timing card metadata
            meta = comp_data.get("metadata") if isinstance(comp_data, dict) else None
            if isinstance(meta, dict):
                raw_m = meta.get("_raw_metrics") or meta.get("raw_metrics")
                if isinstance(raw_m, dict):
                    phase1_rag_ms = raw_m.get("phase1_rag_ms")
                    phase2_schema_prompt_ms = raw_m.get("phase2_schema_prompt_ms")
                    phase3_llm_reasoning_ms = raw_m.get("phase3_llm_reasoning_ms")
                    phase4_sql_execution_ms = raw_m.get("phase4_sql_execution_ms")
                    phase5_ui_overhead_ms = raw_m.get("phase5_ui_overhead_ms")
                    prompt_tokens = raw_m.get("prompt_tokens")
                    completion_tokens = raw_m.get("completion_tokens")
                    total_tokens = raw_m.get("total_tokens")
                    estimated_cost_usd = raw_m.get("estimated_cost_usd")

            yield chunk


        elapsed_ms = (time.time() - start_time) * 1000.0
        full_agent_response = "\n".join(text_parts).strip()
        llm_model = os.getenv("OPENROUTER_LLM_MODEL", "openrouter/free")

        # Fallback: if sql_used was not in component, retrieve from query_execution_log for this session
        if not sql_used:
            try:
                conn = meta_logger._get_connection()
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT query_text, execution_time_ms, result_row_count FROM query_execution_log WHERE session_id = %s ORDER BY id DESC LIMIT 1;",
                        (conversation_id,)
                    )
                    row = cur.fetchone()
                    if row:
                        sql_used = row[0]
                        if not sql_execution_ms:
                            sql_execution_ms = row[1] or 0.0
                        if not total_records:
                            total_records = row[2]
                conn.close()
            except Exception:
                pass

        # Fallback calculations for phase timings if absent
        if phase1_rag_ms is None:
            phase1_rag_ms = round(elapsed_ms * 0.04, 2)
            phase2_schema_prompt_ms = round(elapsed_ms * 0.06, 2)
            p4 = round(sql_execution_ms, 2) if sql_execution_ms else 0.0
            phase4_sql_execution_ms = p4
            phase3_llm_reasoning_ms = round(max(0.0, elapsed_ms - (phase1_rag_ms + phase2_schema_prompt_ms + p4 + 20.0)), 2)
            phase5_ui_overhead_ms = round(max(0.0, elapsed_ms - (phase1_rag_ms + phase2_schema_prompt_ms + phase3_llm_reasoning_ms + p4)), 2)
        elif phase4_sql_execution_ms is None:
            phase4_sql_execution_ms = round(sql_execution_ms, 2) if sql_execution_ms else 0.0

        # Fallback calculations for token metrics & cost if absent
        if prompt_tokens is None:
            prompt_tokens = max(120, len(request.message) * 4)
            completion_tokens = max(40, len(full_agent_response) * 2)
            total_tokens = prompt_tokens + completion_tokens
            estimated_cost_usd = round((prompt_tokens * (0.038 / 1_000_000.0)) + (completion_tokens * (0.55 / 1_000_000.0)), 6)

        llm_and_framework_ms = round(max(0.0, elapsed_ms - (sql_execution_ms or 0.0)), 2)


        # 2. Explicitly store Agent/LLM response in pmc_metadata_db using distinct scalar columns
        meta_logger.log_agent_message(
            session_id=conversation_id,
            request_id=request_id,
            content=full_agent_response,
            sql_used=sql_used,
            execution_time_ms=elapsed_ms,
            total_records=total_records,
            llm_model=llm_model,
            nitro_routing=":nitro" in llm_model.lower(),
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            estimated_cost_usd=estimated_cost_usd,
            total_latency_ms=round(elapsed_ms, 2),
            phase1_rag_ms=phase1_rag_ms,
            phase2_schema_prompt_ms=phase2_schema_prompt_ms,
            phase3_llm_reasoning_ms=phase3_llm_reasoning_ms,
            phase4_sql_execution_ms=phase4_sql_execution_ms,
            phase5_ui_overhead_ms=phase5_ui_overhead_ms,
            llm_and_framework_ms=llm_and_framework_ms,
            status="SUCCESS",
            output_file=output_file,
        )


        # 3. Log off-topic / unmatched scope query if domain scope rule was triggered
        from vanna.prompts import DOMAIN_SCOPE_REJECTION_PHRASES
        if any(phrase in full_agent_response for phrase in DOMAIN_SCOPE_REJECTION_PHRASES):
            meta_logger.log_unmatched_query(
                query_text=request.message,
                reason="OFF_TOPIC_DOMAIN_SCOPE_REJECTION",
                session_id=conversation_id,
            )



    async def handle_poll(self, request: ChatRequest) -> ChatResponse:
        """Handle polling-based chat.

        Args:
            request: Chat request

        Returns:
            Complete chat response
        """
        chunks = []
        async for chunk in self.handle_stream(request):
            chunks.append(chunk)

        return ChatResponse.from_chunks(chunks)

    def _generate_conversation_id(self) -> str:
        """Generate new conversation ID."""
        return f"conv_{uuid.uuid4().hex[:8]}"
