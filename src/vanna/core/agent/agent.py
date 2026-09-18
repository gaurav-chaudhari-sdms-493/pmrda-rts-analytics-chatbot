"""
Agent implementation for the Vanna Agents framework.

This module provides the main Agent class that orchestrates the interaction
between LLM services, tools, and conversation storage.
"""

import time
import traceback
import uuid
from typing import TYPE_CHECKING, AsyncGenerator, List, Optional

from vanna.components import (
    UiComponent,
    SimpleTextComponent,
    RichTextComponent,
    StatusBarUpdateComponent,
    TaskTrackerUpdateComponent,
    ChatInputUpdateComponent,
    StatusCardComponent,
    ButtonComponent,
    Task,
)
from .config import AgentConfig
from vanna.core.storage import ConversationStore
from vanna.core.llm import LlmService
from vanna.core.system_prompt import SystemPromptBuilder
from vanna.core.storage import Conversation, Message
from vanna.core.llm import LlmMessage, LlmRequest, LlmResponse
from vanna.core.tool import ToolCall, ToolContext, ToolResult, ToolSchema
from vanna.core.user import User
from vanna.core.registry import ToolRegistry
from vanna.core.system_prompt import DefaultSystemPromptBuilder
from vanna.core.lifecycle import LifecycleHook
from vanna.core.middleware import LlmMiddleware
from vanna.core.workflow import WorkflowHandler, DefaultWorkflowHandler
from vanna.core.recovery import ErrorRecoveryStrategy, RecoveryActionType
from vanna.core.enricher import ToolContextEnricher
from vanna.core.enhancer import LlmContextEnhancer, DefaultLlmContextEnhancer
from vanna.core.filter import ConversationFilter
from vanna.core.observability import ObservabilityProvider
from vanna.core.user.resolver import UserResolver
from vanna.core.user.request_context import RequestContext
from vanna.core.agent.config import UiFeature
from vanna.core.audit import AuditLogger
from vanna.capabilities.agent_memory import AgentMemory

import logging

logger = logging.getLogger(__name__)

logger.info("Loaded vanna.core.agent.agent module")

if TYPE_CHECKING:
    pass


class Agent:
    """Main agent implementation.

    The Agent class orchestrates LLM interactions, tool execution, and conversation
    management. It provides 7 extensibility points for customization:

    - lifecycle_hooks: Hook into message and tool execution lifecycle
    - llm_middlewares: Intercept and transform LLM requests/responses
    - error_recovery_strategy: Handle errors with retry logic
    - context_enrichers: Add data to tool execution context
    - llm_context_enhancer: Enhance LLM system prompts and messages with context
    - conversation_filters: Filter conversation history before LLM calls
    - observability_provider: Collect telemetry and monitoring data

    Example:
        agent = Agent(
            llm_service=AnthropicLlmService(api_key="..."),
            tool_registry=registry,
            conversation_store=store,
            lifecycle_hooks=[QuotaCheckHook()],
            llm_middlewares=[CachingMiddleware()],
            llm_context_enhancer=DefaultLlmContextEnhancer(agent_memory),
            observability_provider=LoggingProvider()
        )
    """

    def __init__(
        self,
        llm_service: LlmService,
        tool_registry: ToolRegistry,
        user_resolver: UserResolver,
        agent_memory: AgentMemory,
        conversation_store: Optional[ConversationStore] = None,
        config: AgentConfig = AgentConfig(),
        system_prompt_builder: SystemPromptBuilder = DefaultSystemPromptBuilder(),
        lifecycle_hooks: List[LifecycleHook] = [],
        llm_middlewares: List[LlmMiddleware] = [],
        workflow_handler: Optional[WorkflowHandler] = None,
        error_recovery_strategy: Optional[ErrorRecoveryStrategy] = None,
        context_enrichers: List[ToolContextEnricher] = [],
        llm_context_enhancer: Optional[LlmContextEnhancer] = None,
        conversation_filters: List[ConversationFilter] = [],
        observability_provider: Optional[ObservabilityProvider] = None,
        audit_logger: Optional[AuditLogger] = None,
    ):
        self.llm_service = llm_service
        self.tool_registry = tool_registry
        self.user_resolver = user_resolver
        self.agent_memory = agent_memory

        # Import here to avoid circular dependency
        if conversation_store is None:
            from vanna.integrations.local import MemoryConversationStore

            conversation_store = MemoryConversationStore()

        self.conversation_store = conversation_store
        self.config = config
        self.system_prompt_builder = system_prompt_builder
        self.lifecycle_hooks = lifecycle_hooks
        self.llm_middlewares = llm_middlewares

        # Use DefaultWorkflowHandler if none provided
        if workflow_handler is None:
            workflow_handler = DefaultWorkflowHandler()
        self.workflow_handler = workflow_handler

        self.error_recovery_strategy = error_recovery_strategy
        self.context_enrichers = context_enrichers

        # Use DefaultLlmContextEnhancer if none provided
        if llm_context_enhancer is None:
            llm_context_enhancer = DefaultLlmContextEnhancer(agent_memory)
        self.llm_context_enhancer = llm_context_enhancer

        self.conversation_filters = conversation_filters
        self.observability_provider = observability_provider
        self.audit_logger = audit_logger

        # Wire audit logger into tool registry
        if self.audit_logger and self.config.audit_config.enabled:
            self.tool_registry.audit_logger = self.audit_logger
            self.tool_registry.audit_config = self.config.audit_config

        logger.info("Initialized Agent")

    async def send_message(
        self,
        request_context: RequestContext,
        message: str,
        *,
        conversation_id: Optional[str] = None,
    ) -> AsyncGenerator[UiComponent, None]:
        """
        Process a user message and yield UI components with error handling.

        Args:
            request_context: Request context for user resolution (includes metadata)
            message: User's message content
            conversation_id: Optional conversation ID; if None, creates new conversation

        Yields:
            UiComponent instances for UI updates
        """
        try:
            # Delegate to internal method
            async for component in self._send_message(
                request_context, message, conversation_id=conversation_id
            ):
                yield component
        except Exception as e:
            # Log full stack trace
            stack_trace = traceback.format_exc()
            logger.error(
                f"Error in send_message (conversation_id={conversation_id}): {e}\n{stack_trace}",
                exc_info=True,
            )

            # Log to observability provider if available
            if self.observability_provider:
                try:
                    error_span = await self.observability_provider.create_span(
                        "agent.send_message.error",
                        attributes={
                            "error_type": type(e).__name__,
                            "error_message": str(e),
                            "conversation_id": conversation_id or "none",
                        },
                    )
                    await self.observability_provider.end_span(error_span)
                    await self.observability_provider.record_metric(
                        "agent.error.count",
                        1.0,
                        "count",
                        tags={"error_type": type(e).__name__},
                    )
                except Exception as obs_error:
                    logger.error(
                        f"Failed to log error to observability provider: {obs_error}",
                        exc_info=True,
                    )

            error_msg_str = str(e)
            error_lower = error_msg_str.lower()

            is_timeout = any(k in error_lower for k in ["timeout", "timed out", "idle timeout", "connection closed"])
            is_credit_limit = not is_timeout and any(k in error_lower for k in ["402", "credit", "quota", "budget_exceeded", "spending limit", "rate_limit"])

            if is_timeout:
                error_title = "Upstream AI Connection Timeout"
                error_description = "The AI model connection timed out while waiting for a response."
                one_line_chat_response = "⚠️ **AI Connection Timeout:** Upstream model connection timed out. Please click 'Try again' to re-send your question."
                error_metadata = {
                    "Reason": "Upstream LLM network stream idle timeout",
                    "Details": error_msg_str
                }
                if conversation_id:
                    error_metadata["Conversation ID"] = conversation_id
            elif is_credit_limit:
                error_title = "AI Service Credit / Weekly Limit Reached"
                error_description = "OpenRouter API key weekly spending limit or account credit balance has been reached."
                one_line_chat_response = "⚠️ **AI Service Limit Reached:** OpenRouter key weekly spending limit or account credit balance has been reached. Please check key limits or top up credits."
                error_metadata = {
                    "Reason": "Key weekly limit or account balance reached",
                    "How to Fix (Step 1)": "Visit openrouter.ai/settings/keys and increase weekly limit (e.g. set to $5.00)",
                    "How to Fix (Step 2)": "Visit openrouter.ai/settings/credits to top up credits",
                    "मराठी माहिती": "ओपनराऊटर की ची वरची खर्च मर्यादा पूर्ण झाली आहे. कृपया मर्यादा वाढवा.",
                }
                if conversation_id:
                    error_metadata["Conversation ID"] = conversation_id
            else:
                error_title = "Error Processing Message"
                error_description = "An unexpected error occurred while processing your message."
                one_line_chat_response = f"⚠️ **Message Processing Error:** {error_msg_str}"
                error_metadata = {"Details": error_msg_str}
                if conversation_id:
                    error_metadata["Conversation ID"] = conversation_id

            # Yield 1-line text message directly to primary chat response screen
            yield UiComponent(
                rich_component=RichTextComponent(
                    content=one_line_chat_response, markdown=True
                ),
                simple_component=SimpleTextComponent(text=one_line_chat_response),
            )

            # Yield technical StatusCardComponent to Developer Info container
            yield UiComponent(
                rich_component=StatusCardComponent(
                    title=error_title,
                    status="error",
                    description=error_description,
                    icon="⚠️",
                    metadata=error_metadata,
                ),
                simple_component=SimpleTextComponent(text=error_description),
            )

            # Update status bar to show error state
            yield UiComponent(  # type: ignore
                rich_component=StatusBarUpdateComponent(
                    status="error",
                    message="Error occurred",
                    detail="An unexpected error occurred while processing your message",
                )
            )

            # Re-enable chat input so user can try again
            yield UiComponent(  # type: ignore
                rich_component=ChatInputUpdateComponent(
                    placeholder="Try again...", disabled=False
                )
            )

    async def _send_message(
        self,
        request_context: RequestContext,
        message: str,
        *,
        conversation_id: Optional[str] = None,
    ) -> AsyncGenerator[UiComponent, None]:
        """
        Internal method to process a user message and yield UI components.

        Args:
            request_context: Request context for user resolution (includes metadata)
            message: User's message content
            conversation_id: Optional conversation ID; if None, creates new conversation

        Yields:
            UiComponent instances for UI updates
        """
        # Resolve user from request context with observability
        user_resolution_span = None
        if self.observability_provider:
            user_resolution_span = await self.observability_provider.create_span(
                "agent.user_resolution",
                attributes={"has_context": request_context is not None},
            )

        user = await self.user_resolver.resolve_user(request_context)

        if self.observability_provider and user_resolution_span:
            user_resolution_span.set_attribute("user_id", user.id)
            await self.observability_provider.end_span(user_resolution_span)
            if user_resolution_span.duration_ms():
                await self.observability_provider.record_metric(
                    "agent.user_resolution.duration",
                    user_resolution_span.duration_ms() or 0,
                    "ms",
                )

        # Check if this is a starter UI request (empty message or explicit metadata flag)
        is_starter_request = (not message.strip()) or request_context.metadata.get(
            "starter_ui_request", False
        )

        if is_starter_request and self.workflow_handler:
            # Handle starter UI request with observability
            starter_span = None
            if self.observability_provider:
                starter_span = await self.observability_provider.create_span(
                    "agent.workflow_handler.starter_ui", attributes={"user_id": user.id}
                )

            try:
                # Load or create conversation for context
                if conversation_id is None:
                    conversation_id = str(uuid.uuid4())

                conversation = await self.conversation_store.get_conversation(
                    conversation_id, user
                )
                if not conversation:
                    # Create empty conversation (will be saved if workflow produces components)
                    conversation = Conversation(
                        id=conversation_id, user=user, messages=[]
                    )

                # Get starter UI from workflow handler
                components = await self.workflow_handler.get_starter_ui(
                    self, user, conversation
                )

                if self.observability_provider and starter_span:
                    starter_span.set_attribute("has_components", components is not None)
                    starter_span.set_attribute(
                        "component_count", len(components) if components else 0
                    )

                if components:
                    # Yield the starter UI components
                    for component in components:
                        yield component

                    # Yield finalization components
                    yield UiComponent(  # type: ignore
                        rich_component=StatusBarUpdateComponent(
                            status="idle",
                            message="Ready",
                            detail="Choose an option or type a message",
                        )
                    )
                    yield UiComponent(  # type: ignore
                        rich_component=ChatInputUpdateComponent(
                            placeholder="Ask a question...", disabled=False
                        )
                    )

                if self.observability_provider and starter_span:
                    await self.observability_provider.end_span(starter_span)
                    if starter_span.duration_ms():
                        await self.observability_provider.record_metric(
                            "agent.workflow_handler.starter_ui.duration",
                            starter_span.duration_ms() or 0,
                            "ms",
                        )

                # Save the conversation if it was newly created
                if self.config.auto_save_conversations:
                    await self.conversation_store.update_conversation(conversation)

                return  # Exit without calling LLM

            except Exception as e:
                logger.error(f"Error generating starter UI: {e}", exc_info=True)
                if self.observability_provider and starter_span:
                    starter_span.set_attribute("error", str(e))
                    await self.observability_provider.end_span(starter_span)
                # Fall through to normal processing on error

        # Don't process actual empty messages (that aren't starter requests)
        if not message.strip():
            return

        # Create observability span for entire message processing
        message_span = None
        if self.observability_provider:
            message_span = await self.observability_provider.create_span(
                "agent.send_message",
                attributes={
                    "user_id": user.id,
                    "conversation_id": conversation_id or "new",
                },
            )

        # Run before_message hooks with observability
        modified_message = message
        for hook in self.lifecycle_hooks:
            hook_span = None
            if self.observability_provider:
                hook_span = await self.observability_provider.create_span(
                    "agent.hook.before_message",
                    attributes={"hook": hook.__class__.__name__},
                )

            hook_result = await hook.before_message(user, modified_message)
            if hook_result is not None:
                modified_message = hook_result

            if self.observability_provider and hook_span:
                hook_span.set_attribute("modified_message", hook_result is not None)
                await self.observability_provider.end_span(hook_span)
                if hook_span.duration_ms():
                    await self.observability_provider.record_metric(
                        "agent.hook.duration",
                        hook_span.duration_ms() or 0,
                        "ms",
                        tags={
                            "hook": hook.__class__.__name__,
                            "phase": "before_message",
                        },
                    )

        # Use the potentially modified message
        message = modified_message

        # Generate conversation ID and request ID if not provided
        if conversation_id is None:
            conversation_id = str(uuid.uuid4())

        request_id = str(uuid.uuid4())

        # Update status to working
        yield UiComponent(  # type: ignore
            rich_component=StatusBarUpdateComponent(
                status="working",
                message="Processing your request...",
                detail="Analyzing query",
            )
        )

        # Load or create conversation with observability (but don't add message yet)
        conversation_span = None
        if self.observability_provider:
            conversation_span = await self.observability_provider.create_span(
                "agent.conversation.load",
                attributes={"conversation_id": conversation_id, "user_id": user.id},
            )

        conversation = await self.conversation_store.get_conversation(
            conversation_id, user
        )

        is_new_conversation = conversation is None

        if not conversation:
            # Create empty conversation (will add message after workflow handler check)
            conversation = Conversation(id=conversation_id, user=user, messages=[])

        if self.observability_provider and conversation_span:
            conversation_span.set_attribute("is_new", is_new_conversation)
            conversation_span.set_attribute("message_count", len(conversation.messages))
            await self.observability_provider.end_span(conversation_span)
            if conversation_span.duration_ms():
                await self.observability_provider.record_metric(
                    "agent.conversation.load.duration",
                    conversation_span.duration_ms() or 0,
                    "ms",
                    tags={"is_new": str(is_new_conversation)},
                )

        # Try workflow handler before adding message to conversation
        if self.workflow_handler:
            trigger_span = None
            if self.observability_provider:
                trigger_span = await self.observability_provider.create_span(
                    "agent.workflow_handler.try_handle",
                    attributes={"user_id": user.id, "conversation_id": conversation_id},
                )

            try:
                workflow_result = await self.workflow_handler.try_handle(
                    self, user, conversation, message
                )

                if self.observability_provider and trigger_span:
                    trigger_span.set_attribute(
                        "should_skip_llm", workflow_result.should_skip_llm
                    )

                if workflow_result.should_skip_llm:
                    # Workflow handled the message, short-circuit LLM

                    # Apply conversation mutation if provided
                    if workflow_result.conversation_mutation:
                        await workflow_result.conversation_mutation(conversation)

                    # Stream components
                    if workflow_result.components:
                        if isinstance(workflow_result.components, list):
                            for component in workflow_result.components:
                                yield component
                        else:
                            # AsyncGenerator
                            async for component in workflow_result.components:
                                yield component

                    # Finalize response (status bar + chat input)
                    yield UiComponent(  # type: ignore
                        rich_component=StatusBarUpdateComponent(
                            status="idle",
                            message="Workflow complete",
                            detail="Ready for next message",
                        )
                    )
                    yield UiComponent(  # type: ignore
                        rich_component=ChatInputUpdateComponent(
                            placeholder="Ask a question...", disabled=False
                        )
                    )

                    # Save conversation if auto-save enabled
                    if self.config.auto_save_conversations:
                        await self.conversation_store.update_conversation(conversation)

                    if self.observability_provider and trigger_span:
                        await self.observability_provider.end_span(trigger_span)

                    # Exit without calling LLM
                    return

            except Exception as e:
                logger.error(f"Error in workflow handler: {e}", exc_info=True)
                if self.observability_provider and trigger_span:
                    trigger_span.set_attribute("error", str(e))
                    await self.observability_provider.end_span(trigger_span)
                # Fall through to normal LLM processing on error

            finally:
                if self.observability_provider and trigger_span:
                    await self.observability_provider.end_span(trigger_span)

        # Persist new conversation to store before adding message
        if is_new_conversation:
            await self.conversation_store.update_conversation(conversation)

        # Not triggered, add user message to conversation now
        conversation.add_message(Message(role="user", content=message))

        # Start timing full pipeline execution
        turn_start_time = time.perf_counter()
        executed_tool_names: List[str] = []
        llm_time_ms = 0.0
        tool_exec_time_ms = 0.0
        llm_turn_counter = 0
        llm_turn_details: List[tuple] = []
        total_prompt_tokens = 0
        total_completion_tokens = 0

        t_context_start = time.perf_counter()

        # Add initial task
        context_task = Task(
            title="Load conversation context",
            description="Reading message history and user context",
            status="pending",
        )
        yield UiComponent(  # type: ignore
            rich_component=TaskTrackerUpdateComponent.add_task(context_task)
        )

        # Collect available UI features for auditing
        ui_features_available = []
        for feature_name in self.config.ui_features.feature_group_access.keys():
            if self.config.ui_features.can_user_access_feature(feature_name, user):
                ui_features_available.append(feature_name)

        # Create context with observability provider and UI features
        context = ToolContext(
            user=user,
            conversation_id=conversation_id,
            request_id=request_id,
            agent_memory=self.agent_memory,
            observability_provider=self.observability_provider,
            metadata={"ui_features_available": ui_features_available},
        )

        # Enrich context with additional data with observability
        for enricher in self.context_enrichers:
            enrichment_span = None
            if self.observability_provider:
                enrichment_span = await self.observability_provider.create_span(
                    "agent.context.enrichment",
                    attributes={"enricher": enricher.__class__.__name__},
                )

            context = await enricher.enrich_context(context)

            if self.observability_provider and enrichment_span:
                await self.observability_provider.end_span(enrichment_span)
                if enrichment_span.duration_ms():
                    await self.observability_provider.record_metric(
                        "agent.enrichment.duration",
                        enrichment_span.duration_ms() or 0,
                        "ms",
                        tags={"enricher": enricher.__class__.__name__},
                    )

        context_ms = (time.perf_counter() - t_context_start) * 1000
        t_prompt_start = time.perf_counter()

        # Get available tools for user with observability
        schema_span = None
        if self.observability_provider:
            schema_span = await self.observability_provider.create_span(
                "agent.tool_schemas.fetch", attributes={"user_id": user.id}
            )

        tool_schemas = await self.tool_registry.get_schemas(user)

        if self.observability_provider and schema_span:
            schema_span.set_attribute("schema_count", len(tool_schemas))
            await self.observability_provider.end_span(schema_span)
            if schema_span.duration_ms():
                await self.observability_provider.record_metric(
                    "agent.tool_schemas.duration",
                    schema_span.duration_ms() or 0,
                    "ms",
                    tags={"schema_count": str(len(tool_schemas))},
                )

        # Update task status to completed
        yield UiComponent(  # type: ignore
            rich_component=TaskTrackerUpdateComponent.update_task(
                context_task.id, status="completed"
            )
        )

        # Build system prompt with observability
        prompt_span = None
        if self.observability_provider:
            prompt_span = await self.observability_provider.create_span(
                "agent.system_prompt.build",
                attributes={"tool_count": len(tool_schemas)},
            )

        system_prompt = await self.system_prompt_builder.build_system_prompt(
            user, tool_schemas
        )

        # Enhance system prompt with LLM context enhancer
        if self.llm_context_enhancer and system_prompt is not None:
            enhancement_span = None
            if self.observability_provider:
                enhancement_span = await self.observability_provider.create_span(
                    "agent.llm_context.enhance_system_prompt",
                    attributes={
                        "enhancer": self.llm_context_enhancer.__class__.__name__
                    },
                )

            system_prompt = await self.llm_context_enhancer.enhance_system_prompt(
                system_prompt, message, user
            )

            if self.observability_provider and enhancement_span:
                await self.observability_provider.end_span(enhancement_span)
                if enhancement_span.duration_ms():
                    await self.observability_provider.record_metric(
                        "agent.llm_context.enhance_system_prompt.duration",
                        enhancement_span.duration_ms() or 0,
                        "ms",
                        tags={"enhancer": self.llm_context_enhancer.__class__.__name__},
                    )

        if self.observability_provider and prompt_span:
            prompt_span.set_attribute(
                "prompt_length", len(system_prompt) if system_prompt else 0
            )
            await self.observability_provider.end_span(prompt_span)
            if prompt_span.duration_ms():
                await self.observability_provider.record_metric(
                    "agent.system_prompt.duration", prompt_span.duration_ms() or 0, "ms"
                )

        # Build LLM request
        request = await self._build_llm_request(
            conversation, tool_schemas, user, system_prompt
        )

        prompt_ms = (time.perf_counter() - t_prompt_start) * 1000

        # Process with tool loop
        tool_iterations = 0

        while tool_iterations < self.config.max_tool_iterations:
            if self.config.include_thinking_indicators and tool_iterations == 0:
                # TODO: Yield thinking indicator
                pass

            # Get LLM response
            llm_turn_counter += 1
            t_llm_start = time.perf_counter()
            if self.config.stream_responses:
                response = await self._handle_streaming_response(request)
            else:
                response = await self._send_llm_request(request)
            turn_dur_ms = (time.perf_counter() - t_llm_start) * 1000
            llm_time_ms += turn_dur_ms

            # Accumulate token usage for this turn
            p_tok = getattr(response, "usage", {}).get("prompt_tokens", 0) if getattr(response, "usage", None) else 0
            c_tok = getattr(response, "usage", {}).get("completion_tokens", 0) if getattr(response, "usage", None) else 0
            if not p_tok:
                req_text = (request.system_prompt or "") + "".join(m.content or "" for m in request.messages)
                p_tok = max(1, len(req_text) // 4)
            if not c_tok:
                res_text = (response.content or "") + "".join(tc.name + str(tc.arguments) for tc in response.tool_calls or [])
                c_tok = max(1, len(res_text) // 4)

            total_prompt_tokens += p_tok
            total_completion_tokens += c_tok

            if response.is_tool_call():
                tool_names = [tc.name for tc in response.tool_calls or []]
                llm_turn_details.append((f"3.{llm_turn_counter} LLM Turn #{llm_turn_counter} (Generate {', '.join(tool_names)})", turn_dur_ms))
            else:
                llm_turn_details.append((f"3.{llm_turn_counter} LLM Turn #{llm_turn_counter} (Synthesize Text Answer)", turn_dur_ms))

            # Handle tool calls
            if response.is_tool_call():
                tool_iterations += 1

                # First, add the assistant message with tool_calls to the conversation
                # This is required for OpenAI API - tool messages must follow assistant messages with tool_calls
                assistant_message = Message(
                    role="assistant",
                    content=response.content or "",  # Ensure content is not None
                    tool_calls=response.tool_calls,
                )
                conversation.add_message(assistant_message)

                if response.content is not None:
                    # Yield any partial content from the assistant before tool execution
                    has_tool_invocation_message_in_chat = (
                        self.config.ui_features.can_user_access_feature(
                            UiFeature.UI_FEATURE_SHOW_TOOL_INVOCATION_MESSAGE_IN_CHAT,
                            user,
                        )
                    )
                    if has_tool_invocation_message_in_chat:
                        yield UiComponent(
                            rich_component=RichTextComponent(
                                content=response.content, markdown=True
                            ),
                            simple_component=SimpleTextComponent(text=response.content),
                        )

                        # Update status to executing tools
                        yield UiComponent(  # type: ignore
                            rich_component=StatusBarUpdateComponent(
                                status="working",
                                message="Executing tools...",
                                detail=f"Running {len(response.tool_calls or [])} tools",
                            )
                        )
                    else:
                        # Yield as a status update instead
                        yield UiComponent(  # type: ignore
                            rich_component=StatusBarUpdateComponent(
                                status="working", message=response.content, detail=""
                            )
                        )

                # Collect all tool results first
                tool_results = []
                for i, tool_call in enumerate(response.tool_calls or []):
                    # Add task for this tool execution
                    tool_task = Task(
                        title=f"Execute {tool_call.name}",
                        description=f"Running tool with provided arguments",
                        status="in_progress",
                    )

                    has_tool_names_access = (
                        self.config.ui_features.can_user_access_feature(
                            UiFeature.UI_FEATURE_SHOW_TOOL_NAMES, user
                        )
                    )

                    # Audit UI feature access check
                    if (
                        self.audit_logger
                        and self.config.audit_config.enabled
                        and self.config.audit_config.log_ui_feature_checks
                    ):
                        await self.audit_logger.log_ui_feature_access(
                            user=user,
                            feature_name=UiFeature.UI_FEATURE_SHOW_TOOL_NAMES,
                            access_granted=has_tool_names_access,
                            required_groups=self.config.ui_features.feature_group_access.get(
                                UiFeature.UI_FEATURE_SHOW_TOOL_NAMES, []
                            ),
                            conversation_id=conversation.id,
                            request_id=request_id,
                        )

                    if has_tool_names_access:
                        yield UiComponent(  # type: ignore
                            rich_component=TaskTrackerUpdateComponent.add_task(
                                tool_task
                            )
                        )

                    response_str = response.content

                    # Use primitive StatusCard instead of semantic ToolExecutionComponent
                    tool_status_card = StatusCardComponent(
                        title=f"Executing {tool_call.name}",
                        status="running",
                        description=f"Running tool with {len(tool_call.arguments)} arguments",
                        icon="⚙️",
                        metadata=tool_call.arguments,
                    )

                    has_tool_args_access = (
                        self.config.ui_features.can_user_access_feature(
                            UiFeature.UI_FEATURE_SHOW_TOOL_ARGUMENTS, user
                        )
                    )

                    # Audit UI feature access check
                    if (
                        self.audit_logger
                        and self.config.audit_config.enabled
                        and self.config.audit_config.log_ui_feature_checks
                    ):
                        await self.audit_logger.log_ui_feature_access(
                            user=user,
                            feature_name=UiFeature.UI_FEATURE_SHOW_TOOL_ARGUMENTS,
                            access_granted=has_tool_args_access,
                            required_groups=self.config.ui_features.feature_group_access.get(
                                UiFeature.UI_FEATURE_SHOW_TOOL_ARGUMENTS, []
                            ),
                            conversation_id=conversation.id,
                            request_id=request_id,
                        )

                    if has_tool_args_access:
                        yield UiComponent(
                            rich_component=tool_status_card,
                            simple_component=SimpleTextComponent(
                                text=response_str or ""
                            ),
                        )

                    # Run before_tool hooks with observability
                    tool = await self.tool_registry.get_tool(tool_call.name)
                    if tool:
                        for hook in self.lifecycle_hooks:
                            hook_span = None
                            if self.observability_provider:
                                hook_span = (
                                    await self.observability_provider.create_span(
                                        "agent.hook.before_tool",
                                        attributes={
                                            "hook": hook.__class__.__name__,
                                            "tool": tool_call.name,
                                        },
                                    )
                                )

                            await hook.before_tool(tool, context)

                            if self.observability_provider and hook_span:
                                await self.observability_provider.end_span(hook_span)
                                if hook_span.duration_ms():
                                    await self.observability_provider.record_metric(
                                        "agent.hook.duration",
                                        hook_span.duration_ms() or 0,
                                        "ms",
                                        tags={
                                            "hook": hook.__class__.__name__,
                                            "phase": "before_tool",
                                            "tool": tool_call.name,
                                        },
                                    )

                    # Execute tool with observability
                    tool_exec_span = None
                    if self.observability_provider:
                        tool_exec_span = await self.observability_provider.create_span(
                            "agent.tool.execute",
                            attributes={
                                "tool": tool_call.name,
                                "arg_count": len(tool_call.arguments),
                            },
                        )

                    executed_tool_names.append(tool_call.name)
                    t_tool_start = time.perf_counter()
                    result = await self.tool_registry.execute(tool_call, context)
                    tool_exec_time_ms += (time.perf_counter() - t_tool_start) * 1000

                    if self.observability_provider and tool_exec_span:
                        tool_exec_span.set_attribute("success", result.success)
                        if not result.success:
                            tool_exec_span.set_attribute(
                                "error", result.error or "unknown"
                            )
                        await self.observability_provider.end_span(tool_exec_span)
                        if tool_exec_span.duration_ms():
                            await self.observability_provider.record_metric(
                                "agent.tool.duration",
                                tool_exec_span.duration_ms() or 0,
                                "ms",
                                tags={
                                    "tool": tool_call.name,
                                    "success": str(result.success),
                                },
                            )

                    # Run after_tool hooks with observability
                    for hook in self.lifecycle_hooks:
                        hook_span = None
                        if self.observability_provider:
                            hook_span = await self.observability_provider.create_span(
                                "agent.hook.after_tool",
                                attributes={
                                    "hook": hook.__class__.__name__,
                                    "tool": tool_call.name,
                                },
                            )

                        modified_result = await hook.after_tool(result)
                        if modified_result is not None:
                            result = modified_result

                        if self.observability_provider and hook_span:
                            hook_span.set_attribute(
                                "modified_result", modified_result is not None
                            )
                            await self.observability_provider.end_span(hook_span)
                            if hook_span.duration_ms():
                                await self.observability_provider.record_metric(
                                    "agent.hook.duration",
                                    hook_span.duration_ms() or 0,
                                    "ms",
                                    tags={
                                        "hook": hook.__class__.__name__,
                                        "phase": "after_tool",
                                        "tool": tool_call.name,
                                    },
                                )

                    # Update status card to show completion
                    final_status = "success" if result.success else "error"
                    final_description = (
                        f"Tool completed successfully"
                        if result.success
                        else f"Tool failed: {result.error or 'Unknown error'}"
                    )

                    has_tool_args_access_2 = (
                        self.config.ui_features.can_user_access_feature(
                            UiFeature.UI_FEATURE_SHOW_TOOL_ARGUMENTS, user
                        )
                    )

                    # Audit UI feature access check
                    if (
                        self.audit_logger
                        and self.config.audit_config.enabled
                        and self.config.audit_config.log_ui_feature_checks
                    ):
                        await self.audit_logger.log_ui_feature_access(
                            user=user,
                            feature_name=UiFeature.UI_FEATURE_SHOW_TOOL_ARGUMENTS,
                            access_granted=has_tool_args_access_2,
                            required_groups=self.config.ui_features.feature_group_access.get(
                                UiFeature.UI_FEATURE_SHOW_TOOL_ARGUMENTS, []
                            ),
                            conversation_id=conversation.id,
                            request_id=request_id,
                        )

                    if has_tool_args_access_2:
                        yield UiComponent(
                            rich_component=tool_status_card.set_status(
                                final_status, final_description
                            ),
                            simple_component=SimpleTextComponent(
                                text=final_description
                            ),
                        )

                    has_tool_names_access_2 = (
                        self.config.ui_features.can_user_access_feature(
                            UiFeature.UI_FEATURE_SHOW_TOOL_NAMES, user
                        )
                    )

                    # Audit UI feature access check
                    if (
                        self.audit_logger
                        and self.config.audit_config.enabled
                        and self.config.audit_config.log_ui_feature_checks
                    ):
                        await self.audit_logger.log_ui_feature_access(
                            user=user,
                            feature_name=UiFeature.UI_FEATURE_SHOW_TOOL_NAMES,
                            access_granted=has_tool_names_access_2,
                            required_groups=self.config.ui_features.feature_group_access.get(
                                UiFeature.UI_FEATURE_SHOW_TOOL_NAMES, []
                            ),
                            conversation_id=conversation.id,
                            request_id=request_id,
                        )

                    if has_tool_names_access_2:
                        # Update tool task to completed
                        yield UiComponent(  # type: ignore
                            rich_component=TaskTrackerUpdateComponent.update_task(
                                tool_task.id,
                                status="completed",
                                detail=f"Tool {'completed successfully' if result.success else 'return an error'}",
                            )
                        )

                    # Yield tool result
                    if result.ui_component:
                        # For errors, check if user has access to see error details
                        if not result.success:
                            has_tool_error_access = (
                                self.config.ui_features.can_user_access_feature(
                                    UiFeature.UI_FEATURE_SHOW_TOOL_ERROR, user
                                )
                            )

                            # Audit UI feature access check
                            if (
                                self.audit_logger
                                and self.config.audit_config.enabled
                                and self.config.audit_config.log_ui_feature_checks
                            ):
                                await self.audit_logger.log_ui_feature_access(
                                    user=user,
                                    feature_name=UiFeature.UI_FEATURE_SHOW_TOOL_ERROR,
                                    access_granted=has_tool_error_access,
                                    required_groups=self.config.ui_features.feature_group_access.get(
                                        UiFeature.UI_FEATURE_SHOW_TOOL_ERROR, []
                                    ),
                                    conversation_id=conversation.id,
                                    request_id=request_id,
                                )

                            if has_tool_error_access:
                                yield result.ui_component
                        else:
                            # Success results are always shown if they exist
                            yield result.ui_component

                    # Collect tool result data
                    tool_results.append(
                        {
                            "tool_call_id": tool_call.id,
                            "content": (
                                result.result_for_llm
                                if result.success
                                else result.error or "Tool execution failed"
                            ),
                        }
                    )

                # Add tool responses to conversation
                # For APIs that need all tool results in one message, this helps
                for tool_result in tool_results:
                    tool_response_message = Message(
                        role="tool",
                        content=tool_result["content"],
                        tool_call_id=tool_result["tool_call_id"],
                    )
                    conversation.add_message(tool_response_message)

                # Rebuild request with tool responses
                request = await self._build_llm_request(
                    conversation, tool_schemas, user, system_prompt
                )
            else:
                total_turn_ms = (time.perf_counter() - turn_start_time) * 1000
                other_ms = max(0.0, total_turn_ms - (context_ms + prompt_ms + llm_time_ms + tool_exec_time_ms))

                ctx_pct = (context_ms / total_turn_ms * 100) if total_turn_ms > 0 else 0
                prompt_pct = (prompt_ms / total_turn_ms * 100) if total_turn_ms > 0 else 0
                llm_pct = (llm_time_ms / total_turn_ms * 100) if total_turn_ms > 0 else 0
                tool_pct = (tool_exec_time_ms / total_turn_ms * 100) if total_turn_ms > 0 else 0
                other_pct = (other_ms / total_turn_ms * 100) if total_turn_ms > 0 else 0

                tool_label = f"4. Tool Execution ({', '.join(executed_tool_names)})" if executed_tool_names else "4. Tool Execution (SQL)"

                metadata_dict = {
                    "1. Context & Agent Memory (RAG)": f"{context_ms:.1f} ms ({ctx_pct:.1f}%)",
                    "2. Schema & System Prompt Assembly": f"{prompt_ms:.1f} ms ({prompt_pct:.1f}%)",
                }

                for turn_title, dur in llm_turn_details:
                    turn_pct = (dur / total_turn_ms * 100) if total_turn_ms > 0 else 0
                    metadata_dict[turn_title] = f"{dur:.1f} ms ({turn_pct:.1f}%)"

                metadata_dict["3. Total LLM Reasoning Time"] = f"{llm_time_ms:.1f} ms ({llm_pct:.1f}%)"
                metadata_dict[tool_label] = f"{tool_exec_time_ms:.1f} ms ({tool_pct:.1f}%)"
                metadata_dict["5. UI Formatting & Overhead"] = f"{other_ms:.1f} ms ({other_pct:.1f}%)"
                metadata_dict["Total Response Time"] = f"{total_turn_ms / 1000:.2f} s ({total_turn_ms:.0f} ms)"

                tot_tok = total_prompt_tokens + total_completion_tokens
                p_cost_usd = total_prompt_tokens * 0.0000004
                c_cost_usd = total_completion_tokens * 0.0000008
                tot_cost_usd = p_cost_usd + c_cost_usd
                tot_cost_inr = tot_cost_usd * 86.5

                cost_usd_fmt = f"${tot_cost_usd:.5f}" if tot_cost_usd < 0.01 else f"${tot_cost_usd:.4f}"
                cost_inr_fmt = f"₹{tot_cost_inr:.3f}" if tot_cost_inr < 0.1 else f"₹{tot_cost_inr:.2f}"

                metadata_dict["Prompt Tokens"] = f"{total_prompt_tokens:,} tokens"
                metadata_dict["Completion Tokens"] = f"{total_completion_tokens:,} tokens"
                metadata_dict["Total Tokens Used"] = f"{tot_tok:,} tokens"
                metadata_dict["Cost (USD)"] = f"{cost_usd_fmt} USD"
                metadata_dict["Cost (INR)"] = f"{cost_inr_fmt} INR"
                metadata_dict["_raw_metrics"] = {
                    "phase1_rag_ms": round(context_ms, 2),
                    "phase2_schema_prompt_ms": round(prompt_ms, 2),
                    "phase3_llm_reasoning_ms": round(llm_time_ms, 2),
                    "phase4_sql_execution_ms": round(tool_exec_time_ms, 2),
                    "phase5_ui_overhead_ms": round(other_ms, 2),
                    "prompt_tokens": total_prompt_tokens,
                    "completion_tokens": total_completion_tokens,
                    "total_tokens": tot_tok,
                    "estimated_cost_usd": round(tot_cost_usd, 6),
                }

                timing_card = StatusCardComponent(
                    title="⚡ Phase-Wise Execution Timing Breakdown",
                    status="completed",
                    description=f"Total response time: {total_turn_ms / 1000:.2f}s ({total_turn_ms:.0f} ms)",
                    icon="⏱️",
                    metadata=metadata_dict,
                )

                # Determine final text response content
                raw_text = response.content.strip() if (response.content and response.content.strip()) else ""
                
                # Sanitize out any leaked internal model thinking monologue
                final_text_content = raw_text
                if raw_text:
                    import re
                    # Remove <thought>...</thought> blocks if emitted
                    cleaned = re.sub(r"<thought>.*?</thought>", "", raw_text, flags=re.DOTALL)
                    
                    thinking_phrases = [
                        "Here the user wants", "I need to output", "However, there's a strict rule",
                        "The rule says", "Let me think", "I'll respond with", "Let's output:",
                        "Given the strict rule", "Better to output", "I could provide a simple"
                    ]
                    if any(phrase.lower() in cleaned.lower() for phrase in thinking_phrases):
                        # Extract the actual final answer part after thinking monologue
                        # Look for common final answer start markers
                        match = re.search(
                            r"(?:Here are|Here is|Below is|Note:|\n\n###|\n\n\*\*|\|[^\n]+\|[^\n]*\n|[A-Z\u0900-\u097F][^\n]+:\n).*",
                            cleaned,
                            flags=re.DOTALL | re.IGNORECASE
                        )
                        if match:
                            cleaned = match.group(0)
                        else:
                            # Fallback: remove lines matching thinking phrases
                            cleaned_lines = [
                                line for line in cleaned.split("\n")
                                if not any(phrase.lower() in line.lower() for phrase in thinking_phrases)
                            ]
                            cleaned = "\n".join(cleaned_lines)
                    final_text_content = cleaned.strip()

                if not final_text_content and executed_tool_names:
                    final_text_content = "Is query ke liye koi matching records / data nahi mil paya."

                # Yield final text response FIRST so it appears before developer info
                if final_text_content:
                    conversation.add_message(
                        Message(role="assistant", content=final_text_content)
                    )
                    yield UiComponent(
                        rich_component=RichTextComponent(
                            content=final_text_content, markdown=True
                        ),
                        simple_component=SimpleTextComponent(text=final_text_content),
                    )

                # Yield timing card (Developer Info) AFTER final text response
                yield UiComponent(
                    rich_component=timing_card,
                    simple_component=SimpleTextComponent(
                        text=f"Total response time: {total_turn_ms / 1000:.2f}s"
                    ),
                )

                # Update status to idle and clear status bar
                yield UiComponent(  # type: ignore
                    rich_component=StatusBarUpdateComponent(
                        status="idle",
                        message="",
                        detail="",
                    )
                )

                # Update chat input placeholder
                yield UiComponent(  # type: ignore
                    rich_component=ChatInputUpdateComponent(
                        placeholder="Ask a follow-up question...", disabled=False
                    )
                )
                break

        # Check if we hit the tool iteration limit
        if tool_iterations >= self.config.max_tool_iterations:
            # The loop exited due to hitting the limit, not due to a natural completion
            logger.warning(
                f"Tool iteration limit reached: {tool_iterations}/{self.config.max_tool_iterations}"
            )

            # Update status bar to show warning
            yield UiComponent(  # type: ignore
                rich_component=StatusBarUpdateComponent(
                    status="warning",
                    message="Search loop limit reached",
                    detail=f"Stopped after {tool_iterations} tool executions.",
                )
            )

            # Provide detailed warning message to user
            warning_message = f"""⚠️ **Search Loop Limit Reached**

The AI stopped searching because it reached the limit of {tool_iterations} search iterations. It may need more information or continued execution for better results.

You can:
- Click the **Continue** button below to let the AI resume searching where it left off.
- Or rephrase/rewrite your question with more specific details to be more informative."""

            yield UiComponent(
                rich_component=RichTextComponent(
                    content=warning_message, markdown=True
                ),
                simple_component=SimpleTextComponent(
                    text=f"Search limit reached after {tool_iterations} executions. Click Continue or rewrite your question."
                ),
            )

            # Yield an interactive 'Continue' button component so the user can click it directly
            yield UiComponent(
                rich_component=ButtonComponent(
                    label="Continue",
                    action="continue",
                    variant="primary",
                    icon="▶️",
                ),
                simple_component=SimpleTextComponent(text="[Button: Continue]"),
            )

            # Update chat input placeholder
            yield UiComponent(  # type: ignore
                rich_component=ChatInputUpdateComponent(
                    placeholder="Click 'Continue' above, or type your own question...",
                    disabled=False,
                )
            )

        # Save conversation if configured
        if self.config.auto_save_conversations:
            save_span = None
            if self.observability_provider:
                save_span = await self.observability_provider.create_span(
                    "agent.conversation.save",
                    attributes={
                        "conversation_id": conversation_id,
                        "message_count": len(conversation.messages),
                    },
                )

            await self.conversation_store.update_conversation(conversation)

            if self.observability_provider and save_span:
                await self.observability_provider.end_span(save_span)
                if save_span.duration_ms():
                    await self.observability_provider.record_metric(
                        "agent.conversation.save.duration",
                        save_span.duration_ms() or 0,
                        "ms",
                    )

        # Run after_message hooks with observability
        for hook in self.lifecycle_hooks:
            hook_span = None
            if self.observability_provider:
                hook_span = await self.observability_provider.create_span(
                    "agent.hook.after_message",
                    attributes={"hook": hook.__class__.__name__},
                )

            await hook.after_message(conversation)

            if self.observability_provider and hook_span:
                await self.observability_provider.end_span(hook_span)
                if hook_span.duration_ms():
                    await self.observability_provider.record_metric(
                        "agent.hook.duration",
                        hook_span.duration_ms() or 0,
                        "ms",
                        tags={
                            "hook": hook.__class__.__name__,
                            "phase": "after_message",
                        },
                    )

        # End observability span and record metrics
        if self.observability_provider and message_span:
            message_span.set_attribute("tool_iterations", tool_iterations)

            # Track if we hit the tool iteration limit
            hit_tool_limit = tool_iterations >= self.config.max_tool_iterations
            message_span.set_attribute("hit_tool_limit", hit_tool_limit)
            if hit_tool_limit:
                message_span.set_attribute("incomplete_response", True)
                logger.info(
                    f"Tool limit reached - marking response as potentially incomplete"
                )

            await self.observability_provider.end_span(message_span)
            if message_span.duration_ms():
                await self.observability_provider.record_metric(
                    "agent.message.duration",
                    message_span.duration_ms() or 0,
                    "ms",
                    tags={"user_id": user.id, "hit_tool_limit": str(hit_tool_limit)},
                )

    async def get_available_tools(self, user: User) -> List[ToolSchema]:
        """Get tools available to the user."""
        return await self.tool_registry.get_schemas(user)

    async def _build_llm_request(
        self,
        conversation: Conversation,
        tool_schemas: List[ToolSchema],
        user: User,
        system_prompt: Optional[str] = None,
    ) -> LlmRequest:
        """Build LLM request from conversation and tools."""
        # Apply conversation filters with observability
        filtered_messages = conversation.messages
        for filter in self.conversation_filters:
            filter_span = None
            if self.observability_provider:
                filter_span = await self.observability_provider.create_span(
                    "agent.conversation.filter",
                    attributes={
                        "filter": filter.__class__.__name__,
                        "message_count_before": len(filtered_messages),
                    },
                )

            filtered_messages = await filter.filter_messages(filtered_messages)

            if self.observability_provider and filter_span:
                filter_span.set_attribute("message_count_after", len(filtered_messages))
                await self.observability_provider.end_span(filter_span)
                if filter_span.duration_ms():
                    await self.observability_provider.record_metric(
                        "agent.filter.duration",
                        filter_span.duration_ms() or 0,
                        "ms",
                        tags={"filter": filter.__class__.__name__},
                    )

        messages = []
        for msg in filtered_messages:
            llm_msg = LlmMessage(
                role=msg.role,
                content=msg.content,
                tool_calls=msg.tool_calls,
                tool_call_id=msg.tool_call_id,
            )
            messages.append(llm_msg)

        # Enhance messages with LLM context enhancer
        if self.llm_context_enhancer:
            enhancement_span = None
            if self.observability_provider:
                enhancement_span = await self.observability_provider.create_span(
                    "agent.llm_context.enhance_user_messages",
                    attributes={
                        "enhancer": self.llm_context_enhancer.__class__.__name__,
                        "message_count": len(messages),
                    },
                )

            messages = await self.llm_context_enhancer.enhance_user_messages(
                messages, user
            )

            if self.observability_provider and enhancement_span:
                enhancement_span.set_attribute("message_count_after", len(messages))
                await self.observability_provider.end_span(enhancement_span)
                if enhancement_span.duration_ms():
                    await self.observability_provider.record_metric(
                        "agent.llm_context.enhance_user_messages.duration",
                        enhancement_span.duration_ms() or 0,
                        "ms",
                        tags={"enhancer": self.llm_context_enhancer.__class__.__name__},
                    )

        return LlmRequest(
            messages=messages,
            tools=tool_schemas if tool_schemas else None,
            user=user,
            temperature=self.config.temperature,
            max_tokens=self.config.max_tokens,
            stream=self.config.stream_responses,
            system_prompt=system_prompt,
        )

    async def _send_llm_request(self, request: LlmRequest) -> LlmResponse:
        """Send LLM request with middleware and observability."""
        # Apply before_llm_request middlewares with observability
        for middleware in self.llm_middlewares:
            mw_span = None
            if self.observability_provider:
                mw_span = await self.observability_provider.create_span(
                    "agent.middleware.before_llm",
                    attributes={"middleware": middleware.__class__.__name__},
                )

            request = await middleware.before_llm_request(request)

            if self.observability_provider and mw_span:
                await self.observability_provider.end_span(mw_span)
                if mw_span.duration_ms():
                    await self.observability_provider.record_metric(
                        "agent.middleware.duration",
                        mw_span.duration_ms() or 0,
                        "ms",
                        tags={
                            "middleware": middleware.__class__.__name__,
                            "phase": "before_llm",
                        },
                    )

        # Create observability span for LLM call
        llm_span = None
        if self.observability_provider:
            llm_span = await self.observability_provider.create_span(
                "llm.request",
                attributes={
                    "model": getattr(self.llm_service, "model", "unknown"),
                    "stream": request.stream,
                },
            )

        # Send request
        response = await self.llm_service.send_request(request)

        # End span and record metrics
        if self.observability_provider and llm_span:
            await self.observability_provider.end_span(llm_span)
            if llm_span.duration_ms():
                await self.observability_provider.record_metric(
                    "llm.request.duration", llm_span.duration_ms() or 0, "ms"
                )

        # Apply after_llm_response middlewares with observability
        for middleware in self.llm_middlewares:
            mw_span = None
            if self.observability_provider:
                mw_span = await self.observability_provider.create_span(
                    "agent.middleware.after_llm",
                    attributes={"middleware": middleware.__class__.__name__},
                )

            response = await middleware.after_llm_response(request, response)

            if self.observability_provider and mw_span:
                await self.observability_provider.end_span(mw_span)
                if mw_span.duration_ms():
                    await self.observability_provider.record_metric(
                        "agent.middleware.duration",
                        mw_span.duration_ms() or 0,
                        "ms",
                        tags={
                            "middleware": middleware.__class__.__name__,
                            "phase": "after_llm",
                        },
                    )

        return response

    async def _handle_streaming_response(self, request: LlmRequest) -> LlmResponse:
        """Handle streaming response from LLM."""
        # Apply before_llm_request middlewares with observability
        for middleware in self.llm_middlewares:
            mw_span = None
            if self.observability_provider:
                mw_span = await self.observability_provider.create_span(
                    "agent.middleware.before_llm",
                    attributes={
                        "middleware": middleware.__class__.__name__,
                        "stream": True,
                    },
                )

            request = await middleware.before_llm_request(request)

            if self.observability_provider and mw_span:
                await self.observability_provider.end_span(mw_span)
                if mw_span.duration_ms():
                    await self.observability_provider.record_metric(
                        "agent.middleware.duration",
                        mw_span.duration_ms() or 0,
                        "ms",
                        tags={
                            "middleware": middleware.__class__.__name__,
                            "phase": "before_llm",
                            "stream": "true",
                        },
                    )

        accumulated_content = ""
        accumulated_tool_calls = []

        # Create span for streaming
        stream_span = None
        if self.observability_provider:
            stream_span = await self.observability_provider.create_span(
                "llm.stream",
                attributes={"model": getattr(self.llm_service, "model", "unknown")},
            )

        async for chunk in self.llm_service.stream_request(request):
            if chunk.content:
                accumulated_content += chunk.content
                # Could yield intermediate TextChunk here

            if chunk.tool_calls:
                accumulated_tool_calls.extend(chunk.tool_calls)

        # End streaming span
        if self.observability_provider and stream_span:
            stream_span.set_attribute("content_length", len(accumulated_content))
            stream_span.set_attribute("tool_call_count", len(accumulated_tool_calls))
            await self.observability_provider.end_span(stream_span)
            if stream_span.duration_ms():
                await self.observability_provider.record_metric(
                    "llm.stream.duration", stream_span.duration_ms() or 0, "ms"
                )

        response = LlmResponse(
            content=accumulated_content if accumulated_content else None,
            tool_calls=accumulated_tool_calls if accumulated_tool_calls else None,
        )

        # Apply after_llm_response middlewares with observability
        for middleware in self.llm_middlewares:
            mw_span = None
            if self.observability_provider:
                mw_span = await self.observability_provider.create_span(
                    "agent.middleware.after_llm",
                    attributes={
                        "middleware": middleware.__class__.__name__,
                        "stream": True,
                    },
                )

            response = await middleware.after_llm_response(request, response)

            if self.observability_provider and mw_span:
                await self.observability_provider.end_span(mw_span)
                if mw_span.duration_ms():
                    await self.observability_provider.record_metric(
                        "agent.middleware.duration",
                        mw_span.duration_ms() or 0,
                        "ms",
                        tags={
                            "middleware": middleware.__class__.__name__,
                            "phase": "after_llm",
                            "stream": "true",
                        },
                    )

        return response
