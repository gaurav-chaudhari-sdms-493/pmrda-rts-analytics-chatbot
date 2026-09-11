"""
Server-side data grid services and endpoints for Vanna FastAPI server.
Handles paginated queries, sorting, filtering, and streaming exports on the server side.
"""

from typing import Any, Dict, List, Optional
import os
import io
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
import pandas as pd


router = APIRouter(prefix="/api/vanna/v2/grid", tags=["Grid"])


class GridQueryRequest(BaseModel):
    output_file: str = Field(..., description="CSV filename in workspace storage")
    page: int = Field(default=1, ge=1)
    page_size: Any = Field(default=25)  # int or "all"
    sort_column: Optional[str] = None
    sort_direction: Optional[str] = None  # "asc" | "desc"
    global_search: Optional[str] = None
    column_filters: Optional[Dict[str, List[Any]]] = None
    distinct_column: Optional[str] = None


def resolve_file_path(output_file: str) -> str:
    """Locate output file in workspace or storage."""
    if not output_file:
        raise HTTPException(status_code=400, detail="No output file specified.")

    if os.path.isabs(output_file) and os.path.exists(output_file):
        return output_file

    cwd_path = os.path.join(os.getcwd(), output_file)
    if os.path.exists(cwd_path):
        return cwd_path

    target_name = os.path.basename(output_file)
    for base in [os.getcwd(), "/tmp"]:
        candidate = os.path.join(base, target_name)
        if os.path.exists(candidate):
            return candidate

        import glob
        matches = glob.glob(os.path.join(base, "**", target_name), recursive=True)
        if matches:
            matches.sort(key=os.path.getmtime, reverse=True)
            return matches[0]

    raise HTTPException(
        status_code=404,
        detail=f"Data file '{output_file}' not found on server."
    )


def load_and_process_dataframe(request_data: Dict[str, Any]) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Load CSV file and apply filters & sorting. Returns (full_filtered_df, original_df)."""
    output_file = request_data.get("output_file", "")
    file_path = resolve_file_path(output_file)

    try:
        df = pd.read_csv(file_path)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to read data file '{output_file}': {str(e)}"
        )

    filtered_df = df.copy()

    # 1. Global Search
    global_search = request_data.get("global_search")
    if global_search and str(global_search).strip():
        query = str(global_search).strip().lower()
        mask = pd.Series(False, index=filtered_df.index)
        for col in filtered_df.columns:
            mask |= filtered_df[col].astype(str).str.lower().str.contains(query, na=False, regex=False)
        filtered_df = filtered_df[mask]

    # 2. Column Filters
    column_filters = request_data.get("column_filters")
    if column_filters and isinstance(column_filters, dict):
        for col, allowed_vals in column_filters.items():
            if col in filtered_df.columns and allowed_vals is not None and len(allowed_vals) > 0:
                str_allowed = {str(v) for v in allowed_vals if v is not None and str(v) not in ["__NULL__", "(NULL)"]}
                has_null = None in allowed_vals or "__NULL__" in allowed_vals or "(NULL)" in allowed_vals

                col_series = filtered_df[col]
                mask = col_series.astype(str).isin(str_allowed)
                if has_null:
                    mask |= col_series.isna()

                filtered_df = filtered_df[mask]

    # 3. Sorting
    sort_column = request_data.get("sort_column")
    sort_direction = request_data.get("sort_direction")
    if sort_column and sort_column in filtered_df.columns and sort_direction in ["asc", "desc"]:
        ascending = sort_direction == "asc"
        filtered_df = filtered_df.sort_values(by=sort_column, ascending=ascending, na_position="last")

    return filtered_df, df


@router.post("/data")
async def get_grid_data(req: GridQueryRequest) -> Dict[str, Any]:
    """Execute server-side grid query with filtering, sorting, pagination, and optional distinct values."""
    filtered_df, original_df = load_and_process_dataframe(req.model_dump())

    total_rows = len(original_df)
    filtered_rows = len(filtered_df)
    columns = list(original_df.columns)

    if req.page_size == "all":
        page_size_num = max(1, filtered_rows)
    else:
        try:
            page_size_num = int(req.page_size)
            if page_size_num <= 0:
                page_size_num = 25
        except (ValueError, TypeError):
            page_size_num = 25

    total_pages = max(1, (filtered_rows + page_size_num - 1) // page_size_num)
    current_page = min(max(1, req.page), total_pages)

    start_idx = (current_page - 1) * page_size_num
    end_idx = min(start_idx + page_size_num, filtered_rows)

    page_slice = filtered_df.iloc[start_idx:end_idx]

    page_records = page_slice.where(pd.notnull(page_slice), None).to_dict(orient="records")

    distinct_values = []
    if req.distinct_column and req.distinct_column in original_df.columns:
        counts = original_df[req.distinct_column].value_counts(dropna=False)
        for val, cnt in counts.head(200).items():
            val_str = "(NULL)" if pd.isna(val) else str(val)
            distinct_values.append({
                "rawValue": None if pd.isna(val) else val,
                "label": val_str,
                "count": int(cnt)
            })

    return {
        "rows": page_records,
        "columns": columns,
        "total_rows": total_rows,
        "filtered_rows": filtered_rows,
        "page": current_page,
        "page_size": page_size_num,
        "total_pages": total_pages,
        "start_row": start_idx + 1 if filtered_rows > 0 else 0,
        "end_row": end_idx,
        "distinct_values": distinct_values,
    }


@router.get("/export")
async def export_grid_data(
    output_file: str = Query(...),
    format: str = Query("csv"),
    sort_column: Optional[str] = Query(None),
    sort_direction: Optional[str] = Query(None),
    global_search: Optional[str] = Query(None),
    column_filters_json: Optional[str] = Query(None),
) -> Response:
    """Stream exported data file (CSV, Excel, or PDF report) directly from server."""
    import json as json_lib

    column_filters = None
    if column_filters_json:
        try:
            column_filters = json_lib.loads(column_filters_json)
        except Exception:
            pass

    request_data = {
        "output_file": output_file,
        "sort_column": sort_column,
        "sort_direction": sort_direction,
        "global_search": global_search,
        "column_filters": column_filters,
    }

    filtered_df, _ = load_and_process_dataframe(request_data)

    base_name = os.path.splitext(os.path.basename(output_file))[0]

    if format.lower() == "csv":
        csv_buffer = io.StringIO()
        filtered_df.to_csv(csv_buffer, index=False)
        csv_buffer.seek(0)
        return StreamingResponse(
            io.BytesIO(csv_buffer.getvalue().encode("utf-8")),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{base_name}_export.csv"'
            }
        )
    elif format.lower() in ["excel", "xlsx"]:
        try:
            from openpyxl.cell.cell import ILLEGAL_CHARACTERS_RE
            excel_df = filtered_df.copy()
            for col in excel_df.select_dtypes(include=['object', 'string']).columns:
                excel_df[col] = excel_df[col].apply(
                    lambda x: ILLEGAL_CHARACTERS_RE.sub('', str(x)) if isinstance(x, str) else x
                )
            excel_buffer = io.BytesIO()
            with pd.ExcelWriter(excel_buffer, engine="openpyxl") as writer:
                excel_df.to_excel(writer, index=False, sheet_name="Data")
            excel_buffer.seek(0)
            return StreamingResponse(
                excel_buffer,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={
                    "Content-Disposition": f'attachment; filename="{base_name}_export.xlsx"'
                }
            )
        except ImportError:
            raise HTTPException(
                status_code=500,
                detail="Excel export requires the 'openpyxl' library. Please install openpyxl."
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate Excel file: {str(e)}"
            )
    elif format.lower() == "pdf":
        columns = list(filtered_df.columns)
        records = filtered_df.head(1000).where(pd.notnull(filtered_df), "").to_dict(orient="records")

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Data Export Report</title>
            <style>
                body {{ font-family: sans-serif; padding: 20px; color: #24292f; }}
                h2 {{ margin: 0 0 4px 0; }}
                p {{ margin: 0 0 16px 0; color: #57606a; font-size: 12px; }}
                table {{ width: 100%; border-collapse: collapse; font-size: 11px; }}
                th, td {{ border: 1px solid #d0d7de; padding: 5px 8px; text-align: left; }}
                th {{ background: #f6f8fa; font-weight: 600; }}
                tr:nth-child(even) {{ background: #fcfcfc; }}
            </style>
        </head>
        <body onload="window.print()">
            <h2>Data Export Report</h2>
            <p>Total Records: {len(filtered_df)} | Exported: {min(1000, len(filtered_df))}</p>
            <table>
                <thead>
                    <tr><th>#</th>{"".join(f"<th>{c}</th>" for c in columns)}</tr>
                </thead>
                <tbody>
                    {"".join(f"<tr><td>{i+1}</td>" + "".join(f"<td>{r[c]}</td>" for c in columns) + "</tr>" for i, r in enumerate(records))}
                </tbody>
            </table>
        </body>
        </html>
        """
        return Response(content=html_content, media_type="text/html")
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format '{format}'")
