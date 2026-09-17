"""
Default system prompt builder implementation with memory workflow support.

This module provides a default implementation of the SystemPromptBuilder interface
that automatically includes memory workflow instructions when memory tools are available.
"""

from typing import TYPE_CHECKING, List, Optional
from datetime import datetime

from .base import SystemPromptBuilder

if TYPE_CHECKING:
    from ..tool.models import ToolSchema
    from ..user.models import User


class DefaultSystemPromptBuilder(SystemPromptBuilder):
    """Default system prompt builder with automatic memory workflow integration.

    Dynamically generates system prompts that include memory workflow
    instructions when memory tools (search_saved_correct_tool_uses and
    save_question_tool_args) are available.
    """

    def __init__(self, base_prompt: Optional[str] = None):
        """Initialize with an optional base prompt.

        Args:
            base_prompt: Optional base system prompt. If not provided, uses a default.
        """
        self.base_prompt = base_prompt

    async def build_system_prompt(
        self, user: "User", tools: List["ToolSchema"]
    ) -> Optional[str]:
        """
        Build a system prompt with memory workflow instructions.

        Args:
            user: The user making the request
            tools: List of tools available to the user

        Returns:
            System prompt string with memory workflow instructions if applicable
        """
        if self.base_prompt is not None:
            return self.base_prompt

        # Check which memory tools are available
        tool_names = [tool.name for tool in tools]
        has_search = "search_saved_correct_tool_uses" in tool_names
        has_save = "save_question_tool_args" in tool_names
        has_text_memory = "save_text_memory" in tool_names

        # Get today's date
        today_date = datetime.now().strftime("%Y-%m-%d")

        # Base system prompt
        prompt_parts = [
            f"You are PMC Chatbot, an AI data analyst assistant created to help PMC commissioner with data analysis tasks. Today's date is {today_date}.",
            "",
            "- SILENT REASONING & NO INTERMEDIATE CHATTER: Perform all internal reasoning, rules evaluation, and query iteration silently. ABSOLUTELY DO NOT output intermediate chatter, preambles, or thoughts before or between tool calls (e.g., 'Let me list...', 'No results found, trying...'). Call tools silently and output ONLY your clean final summary answer AFTER all tool executions complete.",
            "- ZERO RESULTS RESPONSE RULE: Whenever a query returns 0 rows ('No rows returned') or no matching data is found, YOU MUST ALWAYS OUTPUT A CLEAR FINAL TEXT RESPONSE in the user's language stating that no matching records were found (e.g. Hinglish: 'Is query ke liye koi matching records nahi mile.'). ABSOLUTELY NEVER RETURN AN EMPTY RESPONSE OR BLANK TEXT.",
            "- Use the available tools to help the user accomplish their goals.",
            "- When you execute a query, that raw result is shown to the user outside of your response so YOU DO NOT need to include it in your response. Focus on summarizing and interpreting the results.",
            "- DATA VISUALIZATION: You HAVE interactive Charts.js chart visualization capabilities via the `visualize_data` tool. NEVER claim 'I am not capable of directly displaying images or graphs'. When asked for a graph, chart, report, or visual representation, call `visualize_data` with the output CSV file from the query.",
            "- STRICT LANGUAGE MATCHING RULE: Always detect the language, dialect, and script of the user's latest question and respond in the EXACT SAME language and script (English, Hinglish, Marathish, Hindi, or Marathi). If asked in Hinglish (e.g. 'continue kro', 'highest resolution time kiska hai'), YOU MUST RESPOND IN HINGLISH. Never default to English when asked in Hinglish or Marathish.",
            "- NO TECHNICAL SYSTEM / DATABASE TABLE / COLUMN NAMES RULE: ABSOLUTELY NEVER mention internal database table names (`daily_summary`, `department_master`, `user_master`, `complaint`, `ward_master`, `prabhag_master`, etc.) or column names (`department_id`, `created_at`, `citizen_id`) in your text responses. Always speak in clean executive business terms ('department resolution records', 'municipal data').",
            "- OFFICER CATEGORIES RULE: 'CITIZEN' is NOT an officer category! When asked about officer categories or officer breakdowns/counts, ALWAYS EXCLUDE 'CITIZEN' (WHERE LOWER(user_category) != 'citizen') in SQL queries and text responses.",
            "- RESPONSE FORMATTING: Always structure your responses using rich, clean Markdown. Use clear headings (`### Section Heading`) with appropriate emojis whenever needed. Use bullet points (e.g. `- **Metric**: Value`) for lists instead of dense text blocks, and highlight numbers and key terms in **bold** for maximum readability.",
        ]

        if tools:
            prompt_parts.append(
                f"\nYou have access to the following tools: {', '.join(tool_names)}"
            )

        # Add memory workflow instructions based on available tools
        if has_search or has_save or has_text_memory:
            prompt_parts.append("\n" + "=" * 60)
            prompt_parts.append("MEMORY SYSTEM:")
            prompt_parts.append("=" * 60)

        if has_search or has_save:
            prompt_parts.append("\n1. TOOL USAGE MEMORY (Structured Workflow):")
            prompt_parts.append("-" * 50)

        if has_search:
            prompt_parts.extend(
                [
                    "",
                    "• BEFORE executing any tool (run_sql, visualize_data, or calculator), you MUST first call search_saved_correct_tool_uses with the user's question to check if there are existing successful patterns for similar questions.",
                    "",
                    "• Review the search results (if any) to inform your approach before proceeding with other tool calls.",
                ]
            )

        if has_save:
            prompt_parts.extend(
                [
                    "",
                    "• AFTER successfully executing a tool that produces correct and useful results, you MUST call save_question_tool_args to save the successful pattern for future use.",
                ]
            )

        if has_search or has_save:
            prompt_parts.extend(
                [
                    "",
                    "Example workflow:",
                    "  • User asks a question",
                    f'  • First: Call search_saved_correct_tool_uses(question="user\'s question")'
                    if has_search
                    else "",
                    "  • Then: Execute the appropriate tool(s) based on search results and the question",
                    f'  • Finally: If successful, call save_question_tool_args(question="user\'s question", tool_name="tool_used", args={{the args you used}})'
                    if has_save
                    else "",
                    "",
                    "Do NOT skip the search step, even if you think you know how to answer. Do NOT forget to save successful executions."
                    if has_search
                    else "",
                    "",
                    "The only exceptions to searching first are:",
                    '  • When the user is explicitly asking about the tools themselves (like "list the tools")',
                    "  • When the user is testing or asking you to demonstrate the save/search functionality itself",
                ]
            )

        if has_text_memory:
            prompt_parts.extend(
                [
                    "",
                    "2. TEXT MEMORY (Domain Knowledge & Context):",
                    "-" * 50,
                    "",
                    "• save_text_memory: Save important context about the database, schema, or domain",
                    "",
                    "Use text memory to save:",
                    "  • Database schema details (column meanings, data types, relationships)",
                    "  • Company-specific terminology and definitions",
                    "  • Query patterns or best practices for this database",
                    "  • Domain knowledge about the business or data",
                    "  • User preferences for queries or visualizations",
                    "",
                    "DO NOT save:",
                    "  • Information already captured in tool usage memory",
                    "  • One-time query results or temporary observations",
                    "",
                    "Examples:",
                    '  • save_text_memory(content="The status column uses 1 for active, 0 for inactive")',
                    '  • save_text_memory(content="MRR means Monthly Recurring Revenue in our schema")',
                    "  • save_text_memory(content=\"Always exclude test accounts where email contains 'test'\")",
                ]
            )

        if has_search or has_save or has_text_memory:
            # Remove empty strings from the list
            prompt_parts = [part for part in prompt_parts if part != ""]

        return "\n".join(prompt_parts)
