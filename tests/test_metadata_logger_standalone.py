import uuid
import pytest
from vanna.metadata_logger import get_metadata_logger

def test_pmc_metadata_logger_standalone_workflow():
    logger = get_metadata_logger()
    session_id = f"standalone_test_{uuid.uuid4().hex[:8]}"

    # 1. Ensure Chat Session
    sess_id = logger.ensure_chat_session(session_id, title="Test Standalone Workflow")
    assert sess_id == session_id

    # 2. Log User Prompt
    user_msg_id = logger.log_user_message(session_id, "Show total complaints count")
    assert user_msg_id is not None

    # 3. Log Query Execution
    query_log_id = logger.log_query_execution(
        query_text="SELECT COUNT(*) FROM complaint;",
        status="SUCCESS",
        execution_time_ms=12.4,
        result_row_count=81413,
    )
    assert query_log_id is not None

    # 4. Log Agent Response
    agent_msg_id = logger.log_agent_message(
        session_id=session_id,
        content="Total complaints till now: 81,413",
        sql_used="SELECT COUNT(*) FROM complaint;",
        execution_time_ms=12.4,
        total_records=81413,
    )
    assert agent_msg_id is not None

    # 5. Log Unmatched / Off-topic Query
    unmatched_id = logger.log_unmatched_query(
        query_text="How to bake a cake?",
        reason="OFF_TOPIC_PMC_SCOPE_REJECTION",
        session_id=session_id,
    )
    assert unmatched_id is not None

    # 6. Fetch Chat History
    history = logger.fetch_chat_history(session_id)
    assert len(history) == 2
    assert history[0]["sender"] == "user"
    assert history[0]["content"] == "Show total complaints count"
    assert history[1]["sender"] == "agent"
    assert history[1]["sql_used"] == "SELECT COUNT(*) FROM complaint;"

    # 7. Fetch Developer Info
    dev_info_list = logger.fetch_developer_info(session_id)
    assert len(dev_info_list) == 1
    assert dev_info_list[0]["sql_used"] == "SELECT COUNT(*) FROM complaint;"

