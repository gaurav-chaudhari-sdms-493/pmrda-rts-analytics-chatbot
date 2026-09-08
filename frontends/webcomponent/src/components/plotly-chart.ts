import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { vannaDesignTokens } from '../styles/vanna-design-tokens.js';
import Plotly from 'plotly.js-dist-min';

export interface PlotlyData {
  x?: any[];
  y?: any[];
  type?: any;
  mode?: any;
  name?: string;
  marker?: any;
  line?: any;
  [key: string]: any;
}

export interface PlotlyLayout {
  title?: any;
  xaxis?: any;
  yaxis?: any;
  font?: any;
  paper_bgcolor?: string;
  plot_bgcolor?: string;
  margin?: any;
  showlegend?: boolean;
  height?: number;
  width?: number;
  modebar?: any;
  [key: string]: any;
}

@customElement('plotly-chart')
export class PlotlyChart extends LitElement {
  static styles = [
    vannaDesignTokens,
    css`
      :host {
        display: block;
        font-family: var(--vanna-font-family-default);
        width: 100%;
        height: 100%;
      }

      .plotly-div {
        width: 100%;
        min-height: 400px;
      }

      /* Plotly layering fix for Shadow DOM */
      .plotly-div,
      .plotly-div .js-plotly-plot,
      .plotly-div .plot-container,
      .plotly-div .svg-container {
        position: relative;
        width: 100%;
        height: 100%;
      }

      .plotly-div svg.main-svg {
        position: absolute;
        top: 0;
        left: 0;
      }

      .plotly-div .hoverlayer {
        pointer-events: none;
      }

      .chart-export-toolbar {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        background: rgba(255, 255, 255, 0.04);
        border-bottom: 1px solid var(--vanna-outline-dimmer, rgba(255, 255, 255, 0.1));
        margin-bottom: 4px;
      }

      .chart-export-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        font-size: 11px;
        font-weight: 500;
        color: var(--vanna-foreground-default, #e1e4e8);
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid var(--vanna-outline-default, rgba(255, 255, 255, 0.15));
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .chart-export-btn:hover {
        background: rgba(255, 255, 255, 0.16);
        border-color: var(--vanna-accent-primary-default, #0969da);
        color: #ffffff;
      }
    `
  ];

  @property({ type: Array }) data: PlotlyData[] = [];
  @property({ type: Object }) layout: PlotlyLayout = {};
  @property({ type: Object }) config = {};
  @property({ type: Boolean }) loading = false;
  @property() error = '';
  @property() theme: 'light' | 'dark' = 'dark';
  @property({ type: Boolean }) showExportButtons = true;

  private plotlyDiv?: HTMLElement;
  private resizeObserver?: ResizeObserver;

  firstUpdated() {
    this.plotlyDiv = this.shadowRoot?.querySelector('.plotly-div') as HTMLElement;
    this._renderChart();
    this._setupResizeObserver();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
  }

  private _setupResizeObserver() {
    if (!this.plotlyDiv) return;

    this.resizeObserver = new ResizeObserver(() => {
      if (this.plotlyDiv && this.data.length > 0) {
        const width = this.plotlyDiv.offsetWidth;
        Plotly.relayout(this.plotlyDiv, { width });
      }
    });

    this.resizeObserver.observe(this.plotlyDiv);
  }

  updated(changedProperties: Map<string | number | symbol, unknown>) {
    if (changedProperties.has('data') || changedProperties.has('layout') || changedProperties.has('theme')) {
      this._renderChart();
    }
  }

  private _getDefaultLayout(): PlotlyLayout {
    const isDark = this.theme === 'dark';

    const mergedLayout = {
      ...this.layout,
      font: this.layout.font || {
        family: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: isDark ? 'rgb(242, 244, 247)' : 'rgb(17, 24, 39)',
        size: 12
      },
      modebar: this.layout.modebar || {
        bgcolor: isDark ? 'rgba(21, 26, 38, 0.8)' : 'rgba(255, 255, 255, 0.8)',
        color: isDark ? 'rgb(177, 186, 196)' : 'rgb(75, 85, 99)',
        activecolor: isDark ? 'rgb(242, 244, 247)' : 'rgb(17, 24, 39)',
        orientation: 'h'
      },
      autosize: false,
      width: this.layout.width || undefined,
      height: this.layout.height || 400,
    };

    if (!this.layout.paper_bgcolor) {
      mergedLayout.paper_bgcolor = 'transparent';
    }
    if (!this.layout.plot_bgcolor) {
      mergedLayout.plot_bgcolor = 'transparent';
    }

    return mergedLayout;
  }

  private _getDefaultConfig() {
    return {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      toImageButtonOptions: {
        format: 'png' as const,
        filename: 'chart_export',
        height: 600,
        width: 1000,
        scale: 2
      },
      ...this.config
    };
  }

  public async downloadPNG(filename = 'chart') {
    if (this.plotlyDiv && this.data.length > 0) {
      await Plotly.downloadImage(this.plotlyDiv, {
        format: 'png',
        width: 1200,
        height: 700,
        filename: filename
      });
    }
  }

  public async downloadSVG(filename = 'chart') {
    if (this.plotlyDiv && this.data.length > 0) {
      await Plotly.downloadImage(this.plotlyDiv, {
        format: 'svg',
        width: 1200,
        height: 700,
        filename: filename
      });
    }
  }

  public exportDataCSV(filename = 'chart_data') {
    if (!this.data || this.data.length === 0) return;

    try {
      const rows: string[] = [];
      const traces = this.data;

      // Extract traces data into CSV format
      if (traces.length === 1 && (traces[0].labels || traces[0].x)) {
        const trace = traces[0];
        if (trace.type === 'pie' && trace.labels && trace.values) {
          rows.push('Label,Value');
          for (let i = 0; i < trace.labels.length; i++) {
            rows.push(`"${String(trace.labels[i]).replace(/"/g, '""')}",${trace.values[i]}`);
          }
        } else if (trace.x && trace.y) {
          const xName = trace.name || 'X';
          const yName = trace.name || 'Y';
          rows.push(`"${xName}","${yName}"`);
          for (let i = 0; i < trace.x.length; i++) {
            rows.push(`"${String(trace.x[i]).replace(/"/g, '""')}",${trace.y[i]}`);
          }
        }
      } else {
        // Multi-trace dataset
        const traceNames = traces.map((t, idx) => t.name || `Series ${idx + 1}`);
        rows.push(`"X",${traceNames.map(n => `"${n.replace(/"/g, '""')}"`).join(',')}`);
        const refTrace = traces[0];
        if (refTrace && refTrace.x) {
          for (let i = 0; i < refTrace.x.length; i++) {
            const xVal = refTrace.x[i];
            const yVals = traces.map(t => (t.y && t.y[i] !== undefined ? t.y[i] : ''));
            rows.push(`"${String(xVal).replace(/"/g, '""')}",${yVals.join(',')}`);
          }
        }
      }

      const csvBlob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(csvBlob);
      link.download = `${filename}.csv`;
      link.click();
    } catch (err) {
      console.error('Failed to export chart data CSV:', err);
    }
  }

  private async _renderChart() {
    if (!this.plotlyDiv || this.loading || this.error || this.data.length === 0) {
      return;
    }

    try {
      const layout = this._getDefaultLayout();
      const config = this._getDefaultConfig();

      await Plotly.newPlot(this.plotlyDiv, this.data, layout, config);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to render chart';
      console.error('Plotly chart error:', err);
    }
  }

  render() {
    return html`
      ${this.loading ? html`
        <div class="loading-message">Loading chart...</div>
      ` : this.error ? html`
        <div class="error-message">Error: ${this.error}</div>
      ` : html`
        ${this.showExportButtons && this.data.length > 0 ? html`
          <div class="chart-export-toolbar">
            <button class="chart-export-btn" @click=${() => this.downloadPNG()} title="Download chart as PNG image">
              📷 Export PNG
            </button>
            <button class="chart-export-btn" @click=${() => this.downloadSVG()} title="Download vector SVG chart">
              📄 Export SVG
            </button>
            <button class="chart-export-btn" @click=${() => this.exportDataCSV()} title="Export chart dataset to CSV">
              📊 Export CSV
            </button>
          </div>
        ` : ''}
        <div class="plotly-div"></div>
      `}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'plotly-chart': PlotlyChart;
  }
}