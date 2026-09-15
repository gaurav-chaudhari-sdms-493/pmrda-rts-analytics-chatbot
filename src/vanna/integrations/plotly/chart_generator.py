"""Plotly-based chart generator with automatic chart type selection."""

from typing import Dict, Any, List, Optional, cast
import json
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
import plotly.io as pio


class PlotlyChartGenerator:
    """Generate Plotly charts using heuristics based on DataFrame characteristics."""

    # Vanna brand colors from landing page
    THEME_COLORS = {
        "navy": "#023d60",
        "cream": "#e7e1cf",
        "teal": "#15a8a8",
        "orange": "#fe5d26",
        "magenta": "#bf1363",
    }

    # Color palette for charts (excluding cream as it's too light for data)
    COLOR_PALETTE = ["#15a8a8", "#fe5d26", "#bf1363", "#023d60"]

    def generate_chart(
        self, df: pd.DataFrame, title: str = "Chart", preferred_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate a Plotly chart based on DataFrame shape, types, and preferred chart type."""
        if df.empty:
            raise ValueError("Cannot visualize empty DataFrame")

        # Identify column types
        raw_numeric = df.select_dtypes(include=["number"]).columns.tolist()
        # Filter out ID columns from metric candidates unless no other metric exists
        numeric_cols = [c for c in raw_numeric if not (c.lower().endswith("_id") or c.lower() == "id")]
        if not numeric_cols and raw_numeric:
            numeric_cols = raw_numeric

        categorical_cols = df.select_dtypes(
            include=["object", "category", "string"]
        ).columns.tolist()
        datetime_cols = df.select_dtypes(include=["datetime64"]).columns.tolist()

        # Check for time series
        is_timeseries = len(datetime_cols) > 0

        # Check if pie or line chart was explicitly requested
        title_lower = title.lower() if title else ""
        type_lower = preferred_type.lower() if preferred_type else ""
        is_pie_requested = "pie" in type_lower or "doughnut" in type_lower or "pie" in title_lower or "doughnut" in title_lower
        is_line_requested = "line" in type_lower or "trend" in type_lower or "line" in title_lower or "trend" in title_lower

        if is_pie_requested and len(df.columns) >= 2:
            cat_col = categorical_cols[0] if categorical_cols else df.columns[0]
            num_col = numeric_cols[0] if numeric_cols else df.columns[1]
            if cat_col == num_col and len(df.columns) > 1:
                num_col = df.columns[1] if cat_col == df.columns[0] else df.columns[0]
            fig = self._create_pie_chart(df, cat_col, num_col, title)
        # Apply heuristics
        elif len(numeric_cols) >= 1 and len(categorical_cols) >= 1:
            # Select best primary categorical column (e.g. department_name over department_name_mar or IDs)
            cat_col = categorical_cols[0]
            for c in categorical_cols:
                lower = c.lower()
                if "name" in lower and not lower.endswith("_mar") and not lower.endswith("_mr"):
                    cat_col = c
                    break

            num_col = numeric_cols[0]

            if is_line_requested:
                fig = self._create_line_chart(df, cat_col, num_col, title)
            else:
                fig = self._create_bar_chart(df, cat_col, num_col, title)
        elif is_timeseries and len(numeric_cols) > 0:
            # Time series line chart
            fig = self._create_time_series_chart(
                df, datetime_cols[0], numeric_cols, title
            )
        elif len(numeric_cols) == 1 and len(categorical_cols) == 0:
            # Single numeric column: histogram
            fig = self._create_histogram(df, numeric_cols[0], title)
        elif len(numeric_cols) == 2:
            # Two numeric columns: scatter plot
            fig = self._create_scatter_plot(df, numeric_cols[0], numeric_cols[1], title)
        elif len(numeric_cols) >= 3:
            # Multiple numeric columns: correlation heatmap
            fig = self._create_correlation_heatmap(df, numeric_cols, title)
        elif len(categorical_cols) >= 2:
            # Multiple categorical: grouped bar chart
            fig = self._create_grouped_bar_chart(df, categorical_cols, title)
        elif len(df.columns) >= 4:
            # Fallback for complex multi-column metadata without clear numeric metrics: table
            fig = self._create_table(df, title)
        else:
            # Fallback: show first two columns as scatter/bar
            if len(df.columns) >= 2:
                fig = self._create_generic_chart(
                    df, df.columns[0], df.columns[1], title
                )
            else:
                raise ValueError(
                    "Cannot determine appropriate visualization for this DataFrame"
                )

        # Convert to JSON-serializable dict using native python data types
        result = json.loads(json.dumps(fig.to_dict(), default=str))
        return result

    def _apply_standard_layout(self, fig: go.Figure) -> go.Figure:
        """Apply consistent Vanna brand styling to all charts.

        Uses Vanna brand colors from the landing page for a cohesive look.

        Args:
            fig: Plotly figure to update

        Returns:
            Updated figure with Vanna brand styling
        """
        fig.update_layout(
            template="plotly_white",
            hovermode="closest",
            autosize=True,
            legend=dict(itemclick="toggle", itemdoubleclick="toggleothers"),
            font={"family": 'Inter, system-ui, sans-serif', "color": "#1f2937", "size": 12},
            colorway=["#5465ff", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"],
            margin=dict(t=50, r=30, b=50, l=50),
        )
        return fig

    def _create_histogram(self, df: pd.DataFrame, column: str, title: str) -> go.Figure:
        """Create a histogram for a single numeric column."""
        fig = px.histogram(
            df,
            x=column,
            title=title,
            color_discrete_sequence=[self.THEME_COLORS["teal"]],
        )
        fig.update_layout(xaxis_title=column, yaxis_title="Count", showlegend=False)
        self._apply_standard_layout(fig)
        return fig

    def _create_bar_chart(
        self, df: pd.DataFrame, x_col: str, y_col: str, title: str
    ) -> go.Figure:
        """Create a bar chart for categorical vs numeric data."""
        df_copy = df.copy()
        # Clean numeric column
        df_copy[y_col] = pd.to_numeric(
            df_copy[y_col].astype(str).str.replace(",", "").str.strip(), errors="coerce"
        ).fillna(0)

        # Aggregate by category
        agg_df = df_copy.groupby(x_col, as_index=False)[y_col].sum()
        # Sort descending by numeric value
        agg_df = agg_df.sort_values(by=y_col, ascending=False)

        # Limit to top 25 categories for clean display
        if len(agg_df) > 25:
            agg_df = agg_df.head(25)

        x_list = [str(x) for x in agg_df[x_col].tolist()]
        y_list = [float(y) for y in agg_df[y_col].tolist()]

        fig = go.Figure(
            data=[
                go.Bar(
                    x=x_list,
                    y=y_list,
                    marker=dict(color="#0969da"),
                    hovertemplate="<b>%{x}</b><br>" + str(y_col) + ": <b>%{y:,.0f}</b><extra></extra>",
                )
            ]
        )
        fig.update_layout(
            title=title,
            xaxis_title=x_col.replace("_", " ").title(),
            yaxis_title=y_col.replace("_", " ").title(),
            showlegend=False,
        )
        self._apply_standard_layout(fig)
        return fig

    def _create_pie_chart(
        self, df: pd.DataFrame, cat_col: str, num_col: str, title: str
    ) -> go.Figure:
        """Create a Pie/Doughnut chart for categorical vs numeric data."""
        df_copy = df.copy()
        df_copy[num_col] = pd.to_numeric(
            df_copy[num_col].astype(str).str.replace(",", "").str.strip(), errors="coerce"
        ).fillna(0)

        agg_df = df_copy.groupby(cat_col, as_index=False)[num_col].sum()
        agg_df = agg_df.sort_values(by=num_col, ascending=False)

        if len(agg_df) > 10:
            top10 = agg_df.head(10)
            other_sum = agg_df.iloc[10:][num_col].sum()
            if other_sum > 0:
                other_df = pd.DataFrame([{cat_col: "Others", num_col: other_sum}])
                agg_df = pd.concat([top10, other_df], ignore_index=True)
            else:
                agg_df = top10

        labels = [str(x) for x in agg_df[cat_col].tolist()]
        values = [float(y) for y in agg_df[num_col].tolist()]

        fig = go.Figure(
            data=[
                go.Pie(
                    labels=labels,
                    values=values,
                    hole=0.4,
                    textinfo="label+percent",
                    hovertemplate="<b>%{label}</b><br>" + str(num_col) + ": <b>%{value:,.0f}</b> (%{percent})<extra></extra>",
                )
            ]
        )
        fig.update_layout(
            title=title,
            showlegend=True,
        )
        self._apply_standard_layout(fig)
        return fig

    def _create_line_chart(
        self, df: pd.DataFrame, x_col: str, y_col: str, title: str
    ) -> go.Figure:
        """Create a line chart for data trends."""
        df_copy = df.copy()
        df_copy[y_col] = pd.to_numeric(
            df_copy[y_col].astype(str).str.replace(",", "").str.strip(), errors="coerce"
        ).fillna(0)

        x_list = [str(x) for x in df_copy[x_col].tolist()]
        y_list = [float(y) for y in df_copy[y_col].tolist()]

        fig = go.Figure(
            data=[
                go.Scatter(
                    x=x_list,
                    y=y_list,
                    mode="lines+markers",
                    line=dict(color="#0969da", width=2),
                    marker=dict(size=6),
                    hovertemplate="<b>%{x}</b><br>" + str(y_col) + ": <b>%{y:,.0f}</b><extra></extra>",
                )
            ]
        )
        fig.update_layout(
            title=title,
            xaxis_title=x_col.replace("_", " ").title(),
            yaxis_title=y_col.replace("_", " ").title(),
            showlegend=False,
        )
        self._apply_standard_layout(fig)
        return fig

    def _create_scatter_plot(
        self, df: pd.DataFrame, x_col: str, y_col: str, title: str
    ) -> go.Figure:
        """Create a scatter plot for two numeric columns."""
        fig = px.scatter(
            df,
            x=x_col,
            y=y_col,
            title=title,
            color_discrete_sequence=[self.THEME_COLORS["magenta"]],
        )
        fig.update_layout(xaxis_title=x_col, yaxis_title=y_col)
        self._apply_standard_layout(fig)
        return fig

    def _create_correlation_heatmap(
        self, df: pd.DataFrame, columns: List[str], title: str
    ) -> go.Figure:
        """Create a correlation heatmap for multiple numeric columns."""
        corr_matrix = df[columns].corr()
        # Custom Vanna color scale: navy (negative) -> cream (neutral) -> teal (positive)
        vanna_colorscale = [
            [0.0, self.THEME_COLORS["navy"]],
            [0.5, self.THEME_COLORS["cream"]],
            [1.0, self.THEME_COLORS["teal"]],
        ]
        fig = cast(
            go.Figure,
            px.imshow(
                corr_matrix,
                title=title,
                labels=dict(color="Correlation"),
                x=columns,
                y=columns,
                color_continuous_scale=vanna_colorscale,
                zmin=-1,
                zmax=1,
            ),
        )
        self._apply_standard_layout(fig)
        return fig

    def _create_time_series_chart(
        self, df: pd.DataFrame, time_col: str, value_cols: List[str], title: str
    ) -> go.Figure:
        """Create a time series line chart."""
        fig = go.Figure()

        for i, col in enumerate(value_cols[:5]):  # Limit to 5 lines for readability
            color = self.COLOR_PALETTE[i % len(self.COLOR_PALETTE)]
            fig.add_trace(
                go.Scatter(
                    x=df[time_col],
                    y=df[col],
                    mode="lines",
                    name=col,
                    line=dict(color=color),
                )
            )

        fig.update_layout(
            title=title,
            xaxis_title=time_col,
            yaxis_title="Value",
            hovermode="x unified",
        )
        self._apply_standard_layout(fig)
        return fig

    def _create_grouped_bar_chart(
        self, df: pd.DataFrame, categorical_cols: List[str], title: str
    ) -> go.Figure:
        """Create a grouped bar chart for multiple categorical columns."""
        # Use first two categorical columns
        if len(categorical_cols) >= 2:
            # Count occurrences
            grouped = df.groupby(categorical_cols[:2]).size().reset_index(name="count")
            fig = px.bar(
                grouped,
                x=categorical_cols[0],
                y="count",
                color=categorical_cols[1],
                title=title,
                barmode="group",
                color_discrete_sequence=self.COLOR_PALETTE,
            )
            self._apply_standard_layout(fig)
            return fig
        else:
            # Single categorical: value counts
            counts = df[categorical_cols[0]].value_counts().reset_index()
            counts.columns = [categorical_cols[0], "count"]
            fig = px.bar(
                counts,
                x=categorical_cols[0],
                y="count",
                title=title,
                color_discrete_sequence=[self.THEME_COLORS["teal"]],
            )
            self._apply_standard_layout(fig)
            return fig

    def _create_generic_chart(
        self, df: pd.DataFrame, col1: str, col2: str, title: str
    ) -> go.Figure:
        """Create a generic chart for any two columns."""
        # Try to determine the best representation
        if pd.api.types.is_numeric_dtype(df[col1]) and pd.api.types.is_numeric_dtype(
            df[col2]
        ):
            return self._create_scatter_plot(df, col1, col2, title)
        else:
            # Treat first as categorical, second as value
            fig = px.bar(
                df,
                x=col1,
                y=col2,
                title=title,
                color_discrete_sequence=[self.THEME_COLORS["orange"]],
            )
            self._apply_standard_layout(fig)
            return fig

    def _create_table(self, df: pd.DataFrame, title: str) -> go.Figure:
        """Create a Plotly table for DataFrames with 4 or more columns."""
        # Prepare header
        header_values = list(df.columns)

        # Prepare cell values (transpose to get columns)
        cell_values = [df[col].tolist() for col in df.columns]

        # Create the table
        fig = go.Figure(
            data=[
                go.Table(
                    header=dict(
                        values=header_values,
                        fill_color=self.THEME_COLORS["navy"],
                        font=dict(color="white", size=12),
                        align="left",
                    ),
                    cells=dict(
                        values=cell_values,
                        fill_color=[
                            [
                                self.THEME_COLORS["cream"] if i % 2 == 0 else "white"
                                for i in range(len(df))
                            ]
                        ],
                        font=dict(color=self.THEME_COLORS["navy"], size=11),
                        align="left",
                    ),
                )
            ]
        )

        fig.update_layout(title=title, font={"color": self.THEME_COLORS["navy"]})

        return fig
