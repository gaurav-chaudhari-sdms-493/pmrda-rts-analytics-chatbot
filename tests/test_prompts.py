import pytest
from vanna.prompts import PmcSchemaSystemPromptBuilder, PMC_SYSTEM_PROMPT_TEMPLATE
from vanna.core.user.models import User as CoreUser

@pytest.mark.asyncio
async def test_pmc_system_prompt_builder_language_rules():
    builder = PmcSchemaSystemPromptBuilder(schema_provider=lambda: "Table `complaint` (id integer)")
    user = CoreUser(id="test@example.com", email="test@example.com", group_memberships=["admin"])
    
    prompt = await builder.build_system_prompt(user, [])
    
    assert prompt is not None
    assert "MANDATORY EXACT USER QUESTION LANGUAGE & SCRIPT MATCHING RULE" in prompt
    assert "English Question" in prompt
    assert "Hinglish Question" in prompt
    assert "Marathish Question" in prompt
    assert "Marathi Question (Devanagari script" in prompt
    assert "Hindi Question (Devanagari script" in prompt
    assert "MANDATORY FINAL RESPONSE LANGUAGE VERIFICATION" in prompt
