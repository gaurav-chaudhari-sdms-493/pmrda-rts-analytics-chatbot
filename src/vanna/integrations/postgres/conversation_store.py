"""
PostgreSQL implementation of ConversationStore interface for pmc_metadata_db.
"""

import os
import logging
from datetime import datetime
from typing import List, Optional
import psycopg2
import psycopg2.extras

from vanna.core.storage import ConversationStore, Conversation, Message
from vanna.core.user import User

logger = logging.getLogger("vanna.integrations.postgres.conversation_store")


class PostgresConversationStore(ConversationStore):
    """PostgreSQL-backed conversation store using pmc_metadata_db."""

    def __init__(self, connection_string: Optional[str] = None):
        raw_url = (
            connection_string
            or os.getenv("METADATA_DATABASE_URL")
            or os.getenv("DATABASE_URL")
            or "postgresql://postgres:postgres_password@localhost:5433/pmc_metadata_db"
        )
        self.connection_string = raw_url.replace("postgresql+asyncpg://", "postgresql://", 1)

    def _get_connection(self):
        return psycopg2.connect(self.connection_string)

    async def create_conversation(
        self, conversation_id: str, user: User, initial_message: str
    ) -> Conversation:
        """Create a new conversation session in pmc_metadata_db."""
        now = datetime.utcnow()
        title = initial_message[:50] if initial_message else "New Chat"

        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO chat_sessions (id, title, mode, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET updated_at = %s;
                    """,
                    (conversation_id, title, "agent", now, now, now),
                )
                cur.execute(
                    """
                    INSERT INTO chat_messages (session_id, sender, content, created_at)
                    VALUES (%s, %s, %s, %s);
                    """,
                    (conversation_id, "user", initial_message, now),
                )
                conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Error creating conversation {conversation_id}: {e}")
            raise
        finally:
            conn.close()

        msg = Message(role="user", content=initial_message, timestamp=now)
        return Conversation(
            id=conversation_id,
            user=user,
            messages=[msg],
            created_at=now,
            updated_at=now,
        )

    async def get_conversation(
        self, conversation_id: str, user: User
    ) -> Optional[Conversation]:
        """Get conversation by ID from pmc_metadata_db."""
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT id, title, mode, created_at, updated_at FROM chat_sessions WHERE id = %s;",
                    (conversation_id,),
                )
                session = cur.fetchone()
                if not session:
                    return None

                cur.execute(
                    """
                    SELECT id, sender, content, sql_used, execution_time_ms, created_at 
                    FROM chat_messages 
                    WHERE session_id = %s 
                    ORDER BY created_at ASC, id ASC;
                    """,
                    (conversation_id,),
                )
                rows = cur.fetchall()

                messages = []
                for r in rows:
                    role = "user" if r["sender"] == "user" else ("assistant" if r["sender"] in ("agent", "assistant") else r["sender"])
                    meta = {}
                    if r.get("sql_used"):
                        meta["sql_used"] = r["sql_used"]
                    if r.get("execution_time_ms") is not None:
                        meta["execution_time_ms"] = r["execution_time_ms"]
                    
                    messages.append(
                        Message(
                            role=role,
                            content=r["content"] or "",
                            timestamp=r["created_at"] or datetime.utcnow(),
                            metadata=meta,
                        )
                    )

                return Conversation(
                    id=session["id"],
                    user=user,
                    messages=messages,
                    created_at=session["created_at"] or datetime.utcnow(),
                    updated_at=session["updated_at"] or datetime.utcnow(),
                )
        except Exception as e:
            logger.error(f"Error fetching conversation {conversation_id}: {e}")
            return None
        finally:
            conn.close()

    async def update_conversation(self, conversation: Conversation) -> None:
        """Sync and save conversation messages to pmc_metadata_db."""
        now = datetime.utcnow()
        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                # 1. Upsert session
                first_user_msg = next((m.content for m in conversation.messages if m.role == "user"), "Chat Session")
                title = first_user_msg[:50]
                cur.execute(
                    """
                    INSERT INTO chat_sessions (id, title, mode, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET updated_at = %s, title = EXCLUDED.title;
                    """,
                    (conversation.id, title, "agent", conversation.created_at or now, now, now),
                )

                # 2. Check existing count of messages to avoid duplicate insertions
                cur.execute(
                    "SELECT COUNT(*) FROM chat_messages WHERE session_id = %s;",
                    (conversation.id,),
                )
                existing_count = cur.fetchone()[0]

                # Insert only new messages
                if len(conversation.messages) > existing_count:
                    new_messages = conversation.messages[existing_count:]
                    for msg in new_messages:
                        sender = "user" if msg.role == "user" else "agent"
                        sql_used = msg.metadata.get("sql_used")
                        execution_time_ms = msg.metadata.get("execution_time_ms")
                        cur.execute(
                            """
                            INSERT INTO chat_messages (session_id, sender, content, sql_used, execution_time_ms, created_at)
                            VALUES (%s, %s, %s, %s, %s, %s);
                            """,
                            (
                                conversation.id,
                                sender,
                                msg.content,
                                sql_used,
                                execution_time_ms,
                                msg.timestamp or now,
                            ),
                        )

                conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Error updating conversation {conversation.id}: {e}")
        finally:
            conn.close()

    async def delete_conversation(self, conversation_id: str, user: User) -> bool:
        """Delete conversation and its messages from pmc_metadata_db."""
        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM chat_messages WHERE session_id = %s;", (conversation_id,))
                cur.execute("DELETE FROM chat_sessions WHERE id = %s;", (conversation_id,))
                rows = cur.rowcount
                conn.commit()
                return rows > 0
        except Exception as e:
            conn.rollback()
            logger.error(f"Error deleting conversation {conversation_id}: {e}")
            return False
        finally:
            conn.close()

    async def list_conversations(
        self, user: User, limit: int = 50, offset: int = 0
    ) -> List[Conversation]:
        """List user conversations from pmc_metadata_db."""
        conn = self._get_connection()
        conversations = []
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT id, title, mode, created_at, updated_at 
                    FROM chat_sessions 
                    ORDER BY updated_at DESC 
                    LIMIT %s OFFSET %s;
                    """,
                    (limit, offset),
                )
                sessions = cur.fetchall()
                for s in sessions:
                    conversations.append(
                        Conversation(
                            id=s["id"],
                            user=user,
                            messages=[],
                            created_at=s["created_at"] or datetime.utcnow(),
                            updated_at=s["updated_at"] or datetime.utcnow(),
                        )
                    )
        except Exception as e:
            logger.error(f"Error listing conversations: {e}")
        finally:
            conn.close()

        return conversations
