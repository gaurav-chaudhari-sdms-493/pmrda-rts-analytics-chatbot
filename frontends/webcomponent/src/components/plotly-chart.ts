import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
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
  // Render into Light DOM so native browser mouse/hover/scroll/drag/click events work 100% with Plotly
  createRenderRoot() {
    return this;
  }

  @property({ type: Array }) data: PlotlyData[] = [];
  @property({ type: Object }) layout: PlotlyLayout = {};
  @property({ type: Object }) config = {};
  @property({ type: Boolean }) loading = false;
  @property() error = '';
  @property() theme: 'light' | 'dark' = 'light';
  @property({ type: Boolean }) showExportButtons = true;

  private plotlyDiv?: HTMLElement;
  private resizeObserver?: ResizeObserver;

  firstUpdated() {
    this.plotlyDiv = this.querySelector('.plotly-div') as HTMLElement;
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
      if (this.plotlyDiv && this.data.length > 0 && (!this.layout || !this.layout.width)) {
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
    const { xaxis, yaxis, legend, font, hoverlabel, margin, ...restLayout } = this.layout;

    const mergedLayout: PlotlyLayout = {
      ...restLayout,
      showlegend: this.layout.showlegend !== undefined ? this.layout.showlegend : true,
      legend: {
        orientation: 'h',
        y: 1.15,
        x: 0.5,
        xanchor: 'center',
        font: { family: 'Inter, system-ui, sans-serif', size: 11, color: isDark ? 'rgb(242, 244, 247)' : 'rgb(55, 65, 81)' },
        itemclick: 'toggle',
        itemdoubleclick: 'toggleothers',
        ...(legend || {})
      },
      xaxis: {
        automargin: true,
        gridcolor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(229, 231, 235, 0.7)',
        ...(xaxis || {})
      },
      yaxis: {
        automargin: true,
        gridcolor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(229, 231, 235, 0.7)',
        ...(yaxis || {})
      },
      font: font || {
        family: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: isDark ? 'rgb(242, 244, 247)' : 'rgb(55, 65, 81)',
        size: 12
      },
      hovermode: this.layout.hovermode || 'closest',
      hoverlabel: hoverlabel || {
        font: { family: 'Inter, system-ui, sans-serif', size: 12 },
        align: 'left',
        namelength: -1
      },
      autosize: this.layout.autosize !== undefined ? this.layout.autosize : true,
      width: this.layout.width || undefined,
      height: this.layout.height || 450,
      margin: {
        t: 60,
        r: 40,
        b: 120,
        l: 95,
        ...(margin || {})
      }
    };

    if (!mergedLayout.paper_bgcolor) {
      mergedLayout.paper_bgcolor = 'transparent';
    }
    if (!mergedLayout.plot_bgcolor) {
      mergedLayout.plot_bgcolor = 'transparent';
    }

    return mergedLayout;
  }

  private _getDefaultConfig() {
    return {
      responsive: true,
      displayModeBar: false,
      displaylogo: false,
      scrollZoom: true,
      dragmode: 'zoom' as const,
      doubleClick: 'reset' as const,
      modeBarButtonsToRemove: ['sendDataToCloud'] as any,
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

      await Plotly.react(this.plotlyDiv, this.data, layout, config);

      const chartDiv = this.plotlyDiv as any;

      if (!chartDiv._hasListenersAttached) {
        chartDiv._hasListenersAttached = true;

        chartDiv.on('plotly_click', (eventData: any) => {
          if (eventData && eventData.points && eventData.points.length > 0) {
            const pt = eventData.points[0];
            const label = pt.x ?? pt.label ?? pt.category;
            const value = pt.y ?? pt.value;
            this.dispatchEvent(new CustomEvent('chart-click', {
              detail: { point: pt, label, value, traceName: pt.data?.name },
              bubbles: true,
              composed: true
            }));
          }
        });
      }
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
          <div class="chart-export-toolbar" style="display: flex; justify-content: flex-end; align-items: center; gap: 8px; padding: 6px 12px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; margin-bottom: 4px;">
            <button class="chart-export-btn" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; font-size: 11px; font-weight: 500; color: #374151; background: #ffffff; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer;" @click=${() => this.downloadPNG()} title="Download chart as PNG image">
              📷 Export PNG
            </button>
            <button class="chart-export-btn" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; font-size: 11px; font-weight: 500; color: #374151; background: #ffffff; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer;" @click=${() => this.downloadSVG()} title="Download vector SVG chart">
              📄 Export SVG
            </button>
            <button class="chart-export-btn" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; font-size: 11px; font-weight: 500; color: #374151; background: #ffffff; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer;" @click=${() => this.exportDataCSV()} title="Export chart dataset to CSV">
              📊 Export CSV
            </button>
          </div>
        ` : ''}
        <div class="plotly-div" style="width: 100%; min-height: 400px; position: relative;"></div>
      `}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'plotly-chart': PlotlyChart;
  }
}