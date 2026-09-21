"""Generic SQL query execution tool with dependency injection."""

from typing import Any, Dict, List, Optional, Type, cast
import uuid
from vanna.core.tool import Tool, ToolContext, ToolResult
from vanna.components import (
    UiComponent,
    DataFrameComponent,
    NotificationComponent,
    ComponentType,
    SimpleTextComponent,
)
from vanna.capabilities.sql_runner import SqlRunner, RunSqlToolArgs
from vanna.capabilities.file_system import FileSystem
from vanna.integrations.local import LocalFileSystem


class RunSqlTool(Tool[RunSqlToolArgs]):
    """Tool that executes SQL queries using an injected SqlRunner implementation."""

    def __init__(
        self,
        sql_runner: SqlRunner,
        file_system: Optional[FileSystem] = None,
        custom_tool_name: Optional[str] = None,
        custom_tool_description: Optional[str] = None,
    ):
        """Initialize the tool with a SqlRunner implementation.

        Args:
            sql_runner: SqlRunner implementation that handles actual query execution
            file_system: FileSystem implementation for saving results (defaults to LocalFileSystem)
            custom_tool_name: Optional custom name for the tool (overrides default "run_sql")
            custom_tool_description: Optional custom description for the tool (overrides default description)
        """
        self.sql_runner = sql_runner
        self.file_system = file_system or LocalFileSystem()
        self._custom_name = custom_tool_name
        self._custom_description = custom_tool_description

    @property
    def name(self) -> str:
        return self._custom_name if self._custom_name else "run_sql"

    @property
    def description(self) -> str:
        return (
            self._custom_description
            if self._custom_description
            else "Execute SQL queries against the configured database"
        )

    def get_args_schema(self) -> Type[RunSqlToolArgs]:
        return RunSqlToolArgs

    async def execute(self, context: ToolContext, args: RunSqlToolArgs) -> ToolResult:
        """Execute a SQL query using the injected SqlRunner."""
        import time
        from vanna.metadata_logger import get_metadata_logger

        sql_upper = args.sql.strip().upper()
        if sql_upper.startswith("COPY") or " COPY " in sql_upper or "\nCOPY " in sql_upper:
            error_message = (
                "PostgreSQL COPY commands are strictly forbidden and will fail with permission denied. "
                "Execute a standard SELECT query instead (e.g., SELECT column_name, COUNT(*) AS total_count FROM table_name GROUP BY column_name). "
                "run_sql automatically executes SELECT queries and saves the output to a CSV file for visualization."
            )
            return ToolResult(
                success=False,
                result_for_llm=error_message,
                ui_component=None,
                error=error_message,
                metadata={"error_type": "copy_forbidden"},
            )

        start_time = time.time()
        try:
            # Use the injected SqlRunner to execute the query
            df = await self.sql_runner.run_sql(args, context)
            elapsed_ms = (time.time() - start_time) * 1000.0
            row_count = len(df) if not df.empty else 0

            # Explicitly store query execution in pmc_metadata_db
            try:
                get_metadata_logger().log_query_execution(
                    query_text=args.sql,
                    session_id=context.conversation_id,
                    status="SUCCESS",
                    execution_time_ms=elapsed_ms,
                    result_row_count=row_count,
                )
                if hasattr(context, "metadata") and isinstance(context.metadata, dict):
                    context.metadata["last_sql_used"] = args.sql
                    context.metadata["last_sql_execution_ms"] = elapsed_ms
                    context.metadata["last_sql_total_records"] = row_count
            except Exception:
                pass



            # Determine query type
            query_type = args.sql.strip().upper().split()[0]

            if query_type == "SELECT":
                # Handle SELECT queries with results
                if df.empty:
                    result = "Query executed successfully. No rows returned."
                    ui_component = None
                    metadata = {
                        "row_count": 0,
                        "columns": [],
                        "query_type": query_type,
                        "results": [],
                    }
                else:
                    import pandas as pd
                    import numpy as np

                    columns = [str(col) for col in df.columns.tolist()]
                    row_count = len(df)

                    # Replace NaN/NaT with None and sanitize types for Pydantic JSON serialization
                    df_clean = df.where(pd.notnull(df), None)
                    raw_records = df_clean.to_dict("records")

                    results_data = []
                    for row in raw_records:
                        clean_row = {}
                        for k, v in row.items():
                            key_str = str(k)
                            if v is None or pd.isna(v):
                                clean_row[key_str] = None
                            elif isinstance(v, (np.integer, int)):
                                clean_row[key_str] = int(v)
                            elif isinstance(v, (np.floating, float)):
                                if np.isnan(v) or np.isinf(v):
                                    clean_row[key_str] = None
                                else:
                                    clean_row[key_str] = float(v)
                            elif isinstance(v, (pd.Timestamp, np.datetime64)):
                                clean_row[key_str] = str(v)
                            else:
                                clean_row[key_str] = v
                        results_data.append(clean_row)

                    # Cap UI payload records to 1,000 for high performance rendering
                    MAX_UI_ROWS = 1000
                    ui_records = results_data[:MAX_UI_ROWS]

                    # Write DataFrame to CSV file for downstream tools
                    file_id = str(uuid.uuid4())[:8]
                    filename = f"query_results_{file_id}.csv"
                    csv_content = df.to_csv(index=False)
                    await self.file_system.write_file(
                        filename, csv_content, context, overwrite=True
                    )
                    if hasattr(context, "metadata") and isinstance(context.metadata, dict):
                        context.metadata["last_sql_output_file"] = filename

                    # Create result text for LLM with clean preview
                    results_preview = csv_content
                    if len(results_preview) > 1000:
                        results_preview = (
                            results_preview[:1000]
                            + "\n(Results preview truncated. Summarize key totals or findings directly for the user.)"
                        )

                    result = (
                        f"Query executed successfully ({row_count} total rows returned, output cached as '{filename}'). "
                        f"To visualize this data with a chart/graph, call visualize_data(filename='{filename}'). "
                        "NOTE: DO NOT write Markdown image tags (e.g. `![...](...)`) or mention internal CSV filenames in your response text. "
                        f"Data preview:\n{results_preview}"
                    )

                    # Create DataFrame component for UI with capped records and total row count
                    description_str = (
                        f"SQL query returned {row_count} total rows with {len(columns)} columns"
                        if row_count <= MAX_UI_ROWS
                        else f"SQL query returned {row_count} total rows (showing first {MAX_UI_ROWS} in grid for performance)"
                    )

                    grid_component_id = f"dataframe-{context.request_id}" if getattr(context, "request_id", None) else f"dataframe-{context.conversation_id}"

                    dataframe_component = DataFrameComponent.from_records(
                        id=grid_component_id,
                        records=cast(List[Dict[str, Any]], ui_records),
                        title="Query Results",
                        description=description_str,
                        row_count=len(ui_records),
                        total_rows=row_count,
                        output_file=filename,
                    )

                    ui_component = UiComponent(
                        rich_component=dataframe_component,
                        simple_component=SimpleTextComponent(text=result),
                    )

                    metadata = {
                        "row_count": row_count,
                        "columns": columns,
                        "query_type": query_type,
                        "results": results_data,
                        "output_file": filename,
                        "sql": args.sql,
                        "execution_time_ms": elapsed_ms,
                    }

            else:
                # For non-SELECT queries (INSERT, UPDATE, DELETE, etc.)
                # The SqlRunner should return a DataFrame with affected row count
                rows_affected = len(df) if not df.empty else 0
                result = (
                    f"Query executed successfully. {rows_affected} row(s) affected."
                )

                metadata = {"rows_affected": rows_affected, "query_type": query_type}
                ui_component = None

            return ToolResult(
                success=True,
                result_for_llm=result,
                ui_component=ui_component,
                metadata=metadata,
            )

        except Exception as e:
            error_message = f"Error executing query: {str(e)}"
            return ToolResult(
                success=False,
                result_for_llm=error_message,
                ui_component=None,
                error=str(e),
                metadata={"error_type": "sql_error"},
            )
