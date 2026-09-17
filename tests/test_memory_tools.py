"""
Tests for agent memory tools, including UI feature access control.
"""

import pytest
import uuid
from vanna.tools.agent_memory import (
    SearchSavedCorrectToolUsesTool,
    SearchSavedCorrectToolUsesParams,
)
from vanna.core.tool import ToolContext
from vanna.core.user import User
from vanna.core.agent.config import UiFeature
from vanna.integrations.local.agent_memory import DemoAgentMemory
from vanna.core.rich_component import ComponentType


@pytest.fixture
def demo_agent_memory():
    """Create a demo agent memory instance."""
    return DemoAgentMemory(max_items=100)


@pytest.fixture
def admin_user():
    """Create an admin user."""
    return User(id="admin", email="admin@example.com", group_memberships=["admin"])


@pytest.fixture
def regular_user():
    """Create a regular user."""
    return User(id="user", email="user@example.com", group_memberships=["user"])


@pytest.fixture
def search_tool():
    """Create a search tool instance."""
    return SearchSavedCorrectToolUsesTool()


class TestMemoryToolDetailedResults:
    """Test memory tool detailed results feature."""

    @pytest.mark.asyncio
    async def test_admin_sees_detailed_results(
        self, search_tool, demo_agent_memory, admin_user
    ):
        """Test that admin users see detailed memory results in a collapsible card."""
        # Create context with admin user and feature enabled
        context = ToolContext(
            user=admin_user,
            conversation_id=str(uuid.uuid4()),
            request_id=str(uuid.uuid4()),
            agent_memory=demo_agent_memory,
            metadata={
                "ui_features_available": [
                    UiFeature.UI_FEATURE_SHOW_MEMORY_DETAILED_RESULTS
                ]
            },
        )

        # Save some memories
        await demo_agent_memory.save_tool_usage(
            question="What is the total sales?",
            tool_name="run_sql",
            args={"query": "SELECT SUM(total) FROM invoices"},
            context=context,
            success=True,
        )

        # Search for similar patterns
        search_params = SearchSavedCorrectToolUsesParams(
            question="What are the total sales?", limit=10, similarity_threshold=0.5
        )

        result = await search_tool.execute(context, search_params)

        # Verify result
        assert result.success is True
        assert result.ui_component is None

    @pytest.mark.asyncio
    async def test_non_admin_sees_simple_status(
        self, search_tool, demo_agent_memory, regular_user
    ):
        """Test that memory search returns ui_component=None."""
        # Create context with regular user
        context = ToolContext(
            user=regular_user,
            conversation_id=str(uuid.uuid4()),
            request_id=str(uuid.uuid4()),
            agent_memory=demo_agent_memory,
            metadata={"ui_features_available": []},
        )

        # Save some memories
        await demo_agent_memory.save_tool_usage(
            question="What is the total sales?",
            tool_name="run_sql",
            args={"query": "SELECT SUM(total) FROM invoices"},
            context=context,
            success=True,
        )

        # Search for similar patterns
        search_params = SearchSavedCorrectToolUsesParams(
            question="What are the total sales?", limit=10, similarity_threshold=0.5
        )

        result = await search_tool.execute(context, search_params)

        # Verify result
        assert result.success is True
        assert result.ui_component is None

    @pytest.mark.asyncio
    async def test_detailed_results_include_all_memory_fields(
        self, search_tool, demo_agent_memory, admin_user
    ):
        """Test that memory search returns results for LLM with ui_component=None."""
        # Create context with admin user and feature enabled
        context = ToolContext(
            user=admin_user,
            conversation_id=str(uuid.uuid4()),
            request_id=str(uuid.uuid4()),
            agent_memory=demo_agent_memory,
            metadata={
                "ui_features_available": [
                    UiFeature.UI_FEATURE_SHOW_MEMORY_DETAILED_RESULTS
                ]
            },
        )

        # Save a memory
        await demo_agent_memory.save_tool_usage(
            question="Show me customer names",
            tool_name="run_sql",
            args={"query": "SELECT name FROM customers"},
            context=context,
            success=True,
        )

        # Search for it
        search_params = SearchSavedCorrectToolUsesParams(
            question="Show customer names", limit=10, similarity_threshold=0.3
        )

        result = await search_tool.execute(context, search_params)

        # Verify content passed to LLM
        content = result.result_for_llm
        assert result.ui_component is None

        # Check for all expected fields in LLM result
        assert "Question:" in content
        assert "Show me customer names" in content
        assert "run_sql" in content

    @pytest.mark.asyncio
    async def test_no_results_works_for_both_admin_and_user(
        self, search_tool, demo_agent_memory, admin_user, regular_user
    ):
        """Test that memory search returns 0 results to LLM with ui_component=None."""
        # Test with admin
        admin_context = ToolContext(
            user=admin_user,
            conversation_id=str(uuid.uuid4()),
            request_id=str(uuid.uuid4()),
            agent_memory=demo_agent_memory,
            metadata={
                "ui_features_available": [
                    UiFeature.UI_FEATURE_SHOW_MEMORY_DETAILED_RESULTS
                ]
            },
        )

        search_params = SearchSavedCorrectToolUsesParams(
            question="This query will not match anything",
            limit=10,
            similarity_threshold=0.99,
        )

        admin_result = await search_tool.execute(admin_context, search_params)

        assert admin_result.success is True
        assert "No similar tool usage patterns found" in admin_result.result_for_llm
        assert admin_result.ui_component is None

        # Test with regular user
        user_context = ToolContext(
            user=regular_user,
            conversation_id=str(uuid.uuid4()),
            request_id=str(uuid.uuid4()),
            agent_memory=demo_agent_memory,
            metadata={"ui_features_available": []},
        )

        user_result = await search_tool.execute(user_context, search_params)

        assert user_result.success is True
        assert "No similar tool usage patterns found" in user_result.result_for_llm
        assert user_result.ui_component is None

    @pytest.mark.asyncio
    async def test_llm_result_same_for_admin_and_user(
        self, search_tool, demo_agent_memory, admin_user, regular_user
    ):
        """Test that the LLM receives the same information regardless of UI feature access."""
        # Save a memory
        admin_context = ToolContext(
            user=admin_user,
            conversation_id=str(uuid.uuid4()),
            request_id=str(uuid.uuid4()),
            agent_memory=demo_agent_memory,
            metadata={
                "ui_features_available": [
                    UiFeature.UI_FEATURE_SHOW_MEMORY_DETAILED_RESULTS
                ]
            },
        )

        await demo_agent_memory.save_tool_usage(
            question="Count all records",
            tool_name="run_sql",
            args={"query": "SELECT COUNT(*) FROM table"},
            context=admin_context,
            success=True,
        )

        search_params = SearchSavedCorrectToolUsesParams(
            question="Count records", limit=10, similarity_threshold=0.3
        )

        # Get admin result
        admin_result = await search_tool.execute(admin_context, search_params)

        # Get regular user result
        user_context = ToolContext(
            user=regular_user,
            conversation_id=str(uuid.uuid4()),
            request_id=str(uuid.uuid4()),
            agent_memory=demo_agent_memory,
            metadata={"ui_features_available": []},
        )

        user_result = await search_tool.execute(user_context, search_params)

        # Both should have the same result_for_llm
        assert admin_result.result_for_llm == user_result.result_for_llm
        assert "Found" in admin_result.result_for_llm
        assert "similar tool usage pattern" in admin_result.result_for_llm


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
