import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  PieController,
  DoughnutController,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Custom plugin to render white percentage labels inside doughnut/pie slices >= 3%
const doughnutPercentagePlugin = {
  id: 'doughnutPercentagePlugin',
  afterDraw(chart: any) {
    if (chart.config.type !== 'doughnut' && chart.config.type !== 'pie') return;

    const ctx = chart.ctx;
    const dataset = chart.data?.datasets?.[0];
    if (!dataset || !dataset.data || !Array.isArray(dataset.data)) return;

    const total = dataset.data.reduce((a: number, b: number) => a + (Number(b) || 0), 0);
    if (total <= 0) return;

    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data) return;

    ctx.save();
    ctx.font = 'bold 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    meta.data.forEach((element: any, i: number) => {
      const val = Number(dataset.data[i]) || 0;
      const pct = (val / total) * 100;
      if (pct < 3.0 || element.hidden) return; // Only draw inside slices >= 3.0%

      const angle = (element.startAngle + element.endAngle) / 2;
      const radius = element.innerRadius + (element.outerRadius - element.innerRadius) * 0.55;
      const x = element.x + Math.cos(angle) * radius;
      const y = element.y + Math.sin(angle) * radius;

      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 3;
      ctx.fillText(`${pct.toFixed(1)}%`, x, y);
    });

    ctx.restore();
  }
};

Chart.register(
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  PieController,
  DoughnutController,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  doughnutPercentagePlugin
);

export interface PlotlyData {
  x?: any[];
  y?: any[];
  type?: any;
  mode?: any;
  name?: string;
  marker?: any;
  line?: any;
  labels?: any[];
  values?: any[];
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
  [key: string]: any;
}

@customElement('plotly-chart')
export class PlotlyChart extends LitElement {
  // Render into Light DOM so native canvas events & tooltips work seamlessly
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

  private canvasElement?: HTMLCanvasElement;
  private chartInstance?: Chart;
  private resizeObserver?: ResizeObserver;

  firstUpdated() {
    this.canvasElement = this.querySelector('canvas.chartjs-canvas') as HTMLCanvasElement;
    this._renderChart();
    this._setupResizeObserver();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = undefined;
    }
  }

  private _setupResizeObserver() {
    const container = this.querySelector('.chart-canvas-container');
    if (!container) return;

    this.resizeObserver = new ResizeObserver(() => {
      if (this.chartInstance) {
        this.chartInstance.resize();
      }
    });
    this.resizeObserver.observe(container);
  }

  updated(changedProperties: Map<string | number | symbol, unknown>) {
    if (changedProperties.has('data') || changedProperties.has('layout') || changedProperties.has('theme')) {
      this._renderChart();
    }
  }

  private _buildChartConfig() {
    const isDark = this.theme === 'dark';
    const textColor = isDark ? '#f2f4f7' : '#374151';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(229, 231, 235, 0.7)';
    const palette = ['#0969da', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#3b82f6', '#10b981'];

    let chartType: 'bar' | 'line' | 'doughnut' = 'bar';
    let labels: string[] = [];
    let datasets: any[] = [];

    const toArr = (val: any): any[] => {
      if (Array.isArray(val)) return val;
      if (val === null || val === undefined) return [];
      if (typeof val === 'object') return Object.values(val);
      return [val];
    };

    const parseNum = (val: any): number => {
      if (typeof val === 'number') return isNaN(val) ? 0 : val;
      if (typeof val === 'string') {
        const cleaned = val.replace(/,/g, '').trim();
        const n = parseFloat(cleaned);
        return isNaN(n) ? 0 : n;
      }
      return 0;
    };

    const traces = Array.isArray(this.data) ? this.data : [];
    if (traces.length > 0) {
      const firstTrace = traces[0];
      const traceType = firstTrace.type || 'bar';

      // Detect if Plotly sent 1 trace per category (e.g. 65 separate traces with 1 value each)
      const isPlotlyCategoryTraces = traces.length > 1 && traces.every((t: any) => {
        const xArr = toArr(t.x);
        return xArr.length <= 1;
      });

      if (isPlotlyCategoryTraces) {
        chartType = (traceType === 'pie' || traceType === 'doughnut') ? 'doughnut' : 'bar';
        const rawLabels = traces.map((t: any) => {
          const xArr = toArr(t.x || t.labels);
          return String(t.name || xArr[0] || 'Category');
        });
        const rawVals = traces.map((t: any) => {
          const yArr = toArr(t.y ?? t.values ?? t.val ?? t.marker?.color);
          return parseNum(yArr[0]);
        });

        const combined = rawLabels.map((l, i) => ({ label: l, val: rawVals[i] }));
        if (chartType === 'bar') {
          combined.sort((a, b) => b.val - a.val);
        }
        const topCombined = combined.length > 25 ? combined.slice(0, 25) : combined;

        labels = topCombined.map(c => c.label);
        const dataVals = topCombined.map(c => c.val);

        if (chartType === 'doughnut') {
          datasets = [{
            data: dataVals,
            backgroundColor: palette,
            borderWidth: 2,
            borderColor: isDark ? '#1e293b' : '#ffffff'
          }];
        } else {
          datasets = [{
            label: typeof firstTrace.name === 'string' && firstTrace.name !== 'Total' ? firstTrace.name : 'Total',
            data: dataVals,
            backgroundColor: palette[0],
            borderRadius: 4,
            borderSkipped: false
          }];
        }
      } else if (traceType === 'table' || firstTrace.cells) {
        chartType = 'bar';
        const cellCols: any[][] = toArr(firstTrace.cells?.values);
        let catColVals: string[] = [];
        let numColVals: number[] = [];

        if (cellCols.length > 0) {
          for (const col of cellCols) {
            const arr = toArr(col);
            if (arr.length > 0) {
              const numArr = arr.map(v => parseNum(v));
              const hasNums = numArr.some(n => n > 0);
              if (hasNums && numColVals.length === 0) {
                numColVals = numArr;
              } else if (!hasNums && catColVals.length === 0) {
                catColVals = arr.map(v => String(v));
              }
            }
          }
        }

        const combined = catColVals.map((l, i) => ({ label: l, val: numColVals[i] || 0 }));
        combined.sort((a, b) => b.val - a.val);
        const topCombined = combined.length > 25 ? combined.slice(0, 25) : combined;

        labels = topCombined.map(c => c.label);
        const dataVals = topCombined.map(c => c.val);

        datasets = [{
          label: 'Total',
          data: dataVals,
          backgroundColor: palette[0],
          borderRadius: 4,
          borderSkipped: false
        }];
      } else if (traceType === 'pie') {
        chartType = 'doughnut';
        labels = toArr(firstTrace.labels || firstTrace.x).map((l: any) => String(l));
        datasets = [{
          data: toArr(firstTrace.values || firstTrace.y).map(v => parseNum(v)),
          backgroundColor: palette,
          borderWidth: 2,
          borderColor: isDark ? '#1e293b' : '#ffffff'
        }];
      } else {
        chartType = (traceType === 'scatter' || traceType === 'line') ? 'line' : 'bar';
        labels = toArr(firstTrace.x || firstTrace.labels).map((l: any) => String(l));

        datasets = traces.map((trace: any, idx: number) => {
          const color = trace.marker?.color || trace.line?.color || palette[idx % palette.length];
          const name = trace.name || (traces.length > 1 ? `Series ${idx + 1}` : '');
          const yArr = toArr(trace.y || trace.values).map(v => parseNum(v));

          if (chartType === 'line') {
            return {
              label: name,
              data: yArr,
              borderColor: color,
              backgroundColor: trace.fill === 'tozeroy' || trace.fill ? (typeof color === 'string' && color.startsWith('#') ? color + '22' : 'rgba(9, 105, 218, 0.12)') : color,
              fill: !!trace.fill,
              tension: 0.35,
              pointRadius: 4,
              pointHoverRadius: 6
            };
          } else {
            return {
              label: name,
              data: yArr,
              backgroundColor: color,
              borderRadius: 4,
              borderSkipped: false
            };
          }
        });

        // Slice top 25 categories for single-series bar charts to prevent unreadable 65-bar clutter
        if (chartType === 'bar' && labels.length > 25 && datasets.length === 1) {
          const rawVals = toArr(datasets[0].data).map(v => parseNum(v));
          const combined = labels.map((l, i) => ({ label: l, val: rawVals[i] }));
          combined.sort((a, b) => b.val - a.val);
          const topCombined = combined.slice(0, 25);
          labels = topCombined.map(c => c.label);
          datasets[0].data = topCombined.map(c => c.val);
        }
      }
    }

    // Extract title texts
    const titleText = this.layout?.title?.text || (typeof this.layout?.title === 'string' ? this.layout.title : '');
    const xAxisTitleText = this.layout?.xaxis?.title?.text || (typeof this.layout?.xaxis?.title === 'string' ? this.layout.xaxis.title : '');
    const yAxisTitleText = this.layout?.yaxis?.title?.text || (typeof this.layout?.yaxis?.title === 'string' ? this.layout.yaxis.title : '');
    
    // For Bar / Line charts, show legend ONLY if there are multiple datasets (multiple series)
    const showLegend = chartType === 'doughnut'
      ? (this.layout?.showlegend !== undefined ? this.layout.showlegend : true)
      : (datasets.length > 1);

    const maxLabelLength = Array.isArray(labels) ? labels.reduce((max: number, l: any) => Math.max(max, String(l).length), 0) : 0;
    const isShortLabels = maxLabelLength <= 10;

    const options: any = {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          bottom: 0,
          left: 4,
          right: 4,
          top: 2
        }
      },
      plugins: {
        legend: {
          display: showLegend,
          position: chartType === 'doughnut' ? 'right' : 'top',
          labels: {
            font: { family: 'Inter, system-ui, sans-serif', size: 11, weight: '500' },
            color: textColor,
            boxWidth: 12,
            padding: 8,
            generateLabels: (chart: any) => {
              if (chartType === 'doughnut') {
                const data = chart.data;
                if (data?.labels && data.labels.length && data.datasets && data.datasets.length) {
                  const dataset = data.datasets[0];
                  const datasetData = Array.isArray(dataset?.data) ? dataset.data : [];
                  const total = datasetData.reduce((a: number, b: number) => a + (Number(b) || 0), 0);
                  return data.labels.map((label: string, i: number) => {
                    const val = Number(datasetData[i]) || 0;
                    const pct = total > 0 ? ((val / total) * 100).toFixed(1) + '%' : '0%';
                    const fill = Array.isArray(dataset.backgroundColor)
                      ? dataset.backgroundColor[i % dataset.backgroundColor.length]
                      : dataset.backgroundColor;

                    return {
                      text: `${label} (${pct})`,
                      fillStyle: fill,
                      strokeStyle: fill,
                      lineWidth: 0,
                      hidden: isNaN(val) || chart.getDatasetMeta(0)?.data[i]?.hidden,
                      index: i
                    };
                  });
                }
                return [];
              }
              return Chart.defaults.plugins.legend.labels.generateLabels(chart);
            }
          }
        },
        title: {
          display: !!titleText,
          text: titleText,
          font: { family: 'Inter, system-ui, sans-serif', size: 13, weight: '600' },
          color: textColor,
          padding: { bottom: 6 }
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(17, 24, 39, 0.9)',
          titleFont: { family: 'Inter, system-ui, sans-serif', size: 12, weight: 'bold' },
          bodyFont: { family: 'Inter, system-ui, sans-serif', size: 12 },
          padding: 10,
          cornerRadius: 6,
          callbacks: {
            label: (context: any) => {
              const label = context.label || '';
              const val = Number(context.raw) || 0;
              const chart = context.chart;
              const dataset = chart?.data?.datasets?.[0];
              const datasetData = Array.isArray(dataset?.data) ? dataset.data : [];
              const total = datasetData.reduce((a: number, b: number) => a + (Number(b) || 0), 0);
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) + '%' : '0%';

              if (chart.config.type === 'doughnut' || (chart.config.type as string) === 'pie') {
                return ` ${label}: ${val.toLocaleString()} (${pct})`;
              }
              return ` ${context.dataset?.label || label}: ${val.toLocaleString()}`;
            }
          }
        }
      }
    };

    if (chartType !== 'doughnut') {
      options.scales = {
        x: {
          title: {
            display: !!xAxisTitleText,
            text: xAxisTitleText,
            font: { family: 'Inter, system-ui, sans-serif', size: 11, weight: 'bold' },
            color: textColor,
            padding: { top: 2, bottom: 0 }
          },
          ticks: {
            font: { family: 'Inter, system-ui, sans-serif', size: 10 },
            color: isDark ? '#94a3b8' : '#4b5563',
            maxRotation: isShortLabels ? 0 : 45,
            minRotation: 0,
            autoSkip: true,
            maxTicksLimit: 25,
            callback: function(this: any, val: any): string {
              const labelStr: string = String(this.getLabelForValue ? this.getLabelForValue(val) : (labels[val] ?? val));
              if (labelStr.length > 20) {
                return labelStr.substring(0, 18) + '…';
              }
              return labelStr;
            }
          },
          grid: {
            color: gridColor,
            drawBorder: false
          }
        },
        y: {
          title: {
            display: !!yAxisTitleText,
            text: yAxisTitleText,
            font: { family: 'Inter, system-ui, sans-serif', size: 11, weight: 'bold' },
            color: textColor,
            padding: { bottom: 4 }
          },
          ticks: {
            font: { family: 'Inter, system-ui, sans-serif', size: 10 },
            color: isDark ? '#94a3b8' : '#4b5563'
          },
          grid: {
            color: gridColor,
            drawBorder: false
          },
          beginAtZero: true
        }
      };
    }

    return { type: chartType, data: { labels, datasets }, options };
  }

  public downloadPNG(filename = 'chart') {
    if (this.canvasElement) {
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = this.canvasElement.toDataURL('image/png');
      link.click();
    }
  }

  public downloadSVG(filename = 'chart') {
    this.downloadPNG(filename);
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
          const xName = trace.name || 'Category';
          const yName = trace.name || 'Value';
          rows.push(`"${xName}","${yName}"`);
          for (let i = 0; i < trace.x.length; i++) {
            rows.push(`"${String(trace.x[i]).replace(/"/g, '""')}",${trace.y[i]}`);
          }
        }
      } else {
        const traceNames = traces.map((t, idx) => t.name || `Series ${idx + 1}`);
        rows.push(`"Category",${traceNames.map(n => `"${n.replace(/"/g, '""')}"`).join(',')}`);
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

  private _renderChart() {
    this.canvasElement = this.querySelector('canvas.chartjs-canvas') as HTMLCanvasElement;
    if (!this.canvasElement || this.loading || this.error || !this.data || this.data.length === 0) {
      return;
    }

    try {
      if (this.chartInstance) {
        this.chartInstance.destroy();
        this.chartInstance = undefined;
      }

      const config = this._buildChartConfig();
      this.chartInstance = new Chart(this.canvasElement, config);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to render chart';
      console.error('Chart.js render error:', err);
    }
  }

  render() {
    return html`
      <div class="chart-component-wrapper" style="display: flex; flex-direction: column; width: 100%; height: 100%; flex: 1; min-height: 0;">
        ${this.loading ? html`
          <div class="loading-message">Loading chart...</div>
        ` : this.error ? html`
          <div class="error-message">Error: ${this.error}</div>
        ` : html`
          ${this.showExportButtons && this.data.length > 0 ? html`
            <div class="chart-export-toolbar" style="display: flex; justify-content: flex-end; align-items: center; gap: 8px; padding: 3px 8px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; margin-bottom: 2px; flex-shrink: 0;">
              <button class="chart-export-btn" style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; font-size: 11px; font-weight: 500; color: #374151; background: #ffffff; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer;" @click=${() => this.downloadPNG()} title="Download chart as PNG image">
                📷 Export PNG
              </button>

              <button class="chart-export-btn" style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; font-size: 11px; font-weight: 500; color: #374151; background: #ffffff; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer;" @click=${() => this.exportDataCSV()} title="Export chart dataset to CSV">
                📊 Export CSV
              </button>
            </div>
          ` : ''}
          <div class="chart-canvas-container" style="width: 100%; height: 100%; flex: 1; min-height: 0; position: relative;">
            <canvas class="chartjs-canvas" style="width: 100%; height: 100%; display: block;"></canvas>
          </div>
        `}
      </div>
    `;
  }
}

// Alias chartjs-chart custom element as well
if (!customElements.get('chartjs-chart')) {
  customElements.define('chartjs-chart', class extends PlotlyChart {});
}

declare global {
  interface HTMLElementTagNameMap {
    'plotly-chart': PlotlyChart;
    'chartjs-chart': PlotlyChart;
  }
}