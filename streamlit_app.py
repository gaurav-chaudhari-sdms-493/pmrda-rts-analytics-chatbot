import asyncio
import os
import sys
import pandas as pd
import streamlit as st
from dotenv import load_dotenv

# Ensure local vanna source is in python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from main import vanna_agent, agent_memory, seed_domain_knowledge
from vanna.core.user import User, RequestContext

# Load environment variables
load_dotenv()

# Page configuration
st.set_page_config(
    page_title="PMC CMS AI - Specialized Data Assistant",
    page_icon="🏛️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Modern UI Styling
st.markdown("""
    <style>
    .main-header {
        font-size: 2.2rem;
        font-weight: 700;
        background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0.2rem;
    }
    .sub-header {
        color: #64748b;
        font-size: 1rem;
        margin-bottom: 1.5rem;
    }
    .stChatMessage {
        border-radius: 10px;
    }
    </style>
""", unsafe_allow_html=True)

@st.cache_resource
def initialize_specialized_agent():
    # Seed domain knowledge once during initialization
    default_user = User(id="admin@example.com", email="admin@example.com", group_memberships=["admin"])
    asyncio.run(seed_domain_knowledge(agent_memory, default_user))
    return vanna_agent

agent = initialize_specialized_agent()

def render_ui_component(comp):
    """Renders Vanna UI Components dynamically in Streamlit."""
    rc = getattr(comp, "rich_component", None)
    sc = getattr(comp, "simple_component", None)

    if rc:
        # 1. Render DataFrames
        if hasattr(rc, "rows") and hasattr(rc, "columns") and rc.columns:
            df = pd.DataFrame(rc.rows, columns=rc.columns)
            st.dataframe(df, use_container_width=True)
            return
        elif hasattr(rc, "df") and rc.df is not None:
            st.dataframe(rc.df, use_container_width=True)
            return

        # 2. Render Text or Code Blocks
        if hasattr(rc, "text") and rc.text:
            st.markdown(rc.text)
            return
        if hasattr(rc, "code") and rc.code:
            st.code(rc.code, language=getattr(rc, "language", "sql"))
            return

        # 3. Render Plotly Charts
        if hasattr(rc, "figure") and rc.figure:
            st.plotly_chart(rc.figure, use_container_width=True)
            return

    # Fallback to SimpleComponent text
    if sc and hasattr(sc, "text") and sc.text:
        st.markdown(sc.text)

async def get_agent_response(prompt: str):
    context = RequestContext()
    components = []
    async for component in agent.send_message(context, prompt):
        components.append(component)
    return components

# Sidebar
with st.sidebar:
    st.title("🏛️ PMC CMS Assistant")
    st.markdown("### Domain Knowledge & Status")
    st.info(f"**LLM:** `{os.getenv('OPENROUTER_LLM_MODEL', 'meta-llama/llama-3.3-70b-instruct')}`")
    st.success("✅ **Database:** PMC PostgreSQL Connected")
    st.success("🧠 **Memory:** Business Context Seeded")

    if st.button("🗑️ Clear Chat History", use_container_width=True):
        st.session_state.messages = []
        st.rerun()

# Page Header
st.markdown('<div class="main-header">Pune Municipal Corporation (PMC) Data Assistant</div>', unsafe_allow_html=True)
st.markdown('<div class="sub-header">Specialized AI trained on PMC CMS business rules, ward alias mappings, and complaint schema.</div>', unsafe_allow_html=True)

# Initialize Session Chat History
if "messages" not in st.session_state:
    st.session_state.messages = []

# Display Chat History
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        if "content" in msg and msg["content"]:
            st.markdown(msg["content"])
        if "components" in msg:
            for comp in msg["components"]:
                render_ui_component(comp)

# Chat Input Handler
if prompt := st.chat_input("Ask a complaint or ward question (e.g. 'Show total complaints in Bibwewadi from 17 March to 2 September')..."):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        with st.spinner("Analyzing schema, ward aliases & domain knowledge..."):
            components = asyncio.run(get_agent_response(prompt))
            st.session_state.messages.append({"role": "assistant", "components": components})
            for comp in components:
                render_ui_component(comp)
