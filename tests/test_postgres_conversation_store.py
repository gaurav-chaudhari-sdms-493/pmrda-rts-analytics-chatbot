import os
import pytest
from vanna.integrations.postgres import PostgresConversationStore
from vanna.core.user import User

@pytest.mark.asyncio
async def test_postgres_conversation_store_crud():
    connection_url = os.getenv(
        "METADATA_DATABASE_URL",
        "postgresql://postgres:postgres_password@localhost:5433/pmc_metadata_db",
    )
    store = PostgresConversationStore(connection_string=connection_url)
    user = User(id="test_user_pytest", email="pytest@example.com", group_memberships=["user"])
    session_id = "pytest_session_001"

    try:
        # Create
        conv = await store.create_conversation(session_id, user, "Pytest test query for PMC")
        assert conv.id == session_id
        assert len(conv.messages) == 1
        assert conv.messages[0].content == "Pytest test query for PMC"

        # Get
        fetched = await store.get_conversation(session_id, user)
        assert fetched is not None
        assert fetched.id == session_id
        assert len(fetched.messages) == 1

        # List
        all_convs = await store.list_conversations(user, limit=10)
        assert any(c.id == session_id for c in all_convs)

    finally:
        # Cleanup
        await store.delete_conversation(session_id, user)
