import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
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

  public generatePureVectorSVG(_filename = 'chart'): string {
    const width = 1000;
    const height = 600;
    const palette = ['#0969da', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#3b82f6', '#14b8a6'];

    const escapeXml = (str: any) => String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    const titleText = typeof this.layout?.title === 'string'
      ? this.layout.title
      : (this.layout?.title?.text || 'Chart');

    const traces = Array.isArray(this.data) ? this.data : [];
    const firstTrace = traces[0] || {};
    const chartType = (firstTrace.type === 'pie' || firstTrace.type === 'doughnut') ? 'pie' : (firstTrace.type || 'bar');

    let svgElements = '';

    if (chartType === 'pie') {
      let labels: string[] = [];
      let values: number[] = [];

      if (firstTrace.labels && firstTrace.values) {
        labels = Array.isArray(firstTrace.labels) ? firstTrace.labels.map(String) : [];
        values = Array.isArray(firstTrace.values) ? firstTrace.values.map(Number) : [];
      } else if (traces.length > 1) {
        labels = traces.map(t => String(t.name || t.x?.[0] || ''));
        values = traces.map(t => Number(t.y?.[0] || t.values?.[0] || 0));
      }

      const total = values.reduce((a, b) => a + (isNaN(b) ? 0 : b), 0);
      const cx = 380;
      const cy = 320;
      const rOuter = 200;
      const rInner = 100; // doughnut hole

      let currentAngle = -Math.PI / 2;

      values.forEach((val, i) => {
        if (isNaN(val) || val <= 0 || total <= 0) return;
        const sliceAngle = (val / total) * 2 * Math.PI;
        const startAngle = currentAngle;
        const endAngle = currentAngle + sliceAngle;
        currentAngle = endAngle;

        const x1Outer = cx + rOuter * Math.cos(startAngle);
        const y1Outer = cy + rOuter * Math.sin(startAngle);
        const x2Outer = cx + rOuter * Math.cos(endAngle);
        const y2Outer = cy + rOuter * Math.sin(endAngle);

        const x1Inner = cx + rInner * Math.cos(endAngle);
        const y1Inner = cy + rInner * Math.sin(endAngle);
        const x2Inner = cx + rInner * Math.cos(startAngle);
        const y2Inner = cy + rInner * Math.sin(startAngle);

        const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;
        const color = palette[i % palette.length];

        const pathData = `M ${x1Outer.toFixed(2)} ${y1Outer.toFixed(2)} ` +
          `A ${rOuter} ${rOuter} 0 ${largeArcFlag} 1 ${x2Outer.toFixed(2)} ${y2Outer.toFixed(2)} ` +
          `L ${x1Inner.toFixed(2)} ${y1Inner.toFixed(2)} ` +
          `A ${rInner} ${rInner} 0 ${largeArcFlag} 0 ${x2Inner.toFixed(2)} ${y2Inner.toFixed(2)} Z`;

        svgElements += `<path d="${pathData}" fill="${color}" stroke="#ffffff" stroke-width="2"/>\n`;

        // Percentage label inside slice
        const pct = (val / total) * 100;
        if (pct >= 4.0) {
          const midAngle = (startAngle + endAngle) / 2;
          const rMid = rInner + (rOuter - rInner) * 0.55;
          const lx = cx + rMid * Math.cos(midAngle);
          const ly = cy + rMid * Math.sin(midAngle);
          svgElements += `<text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" text-anchor="middle" dominant-baseline="central" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="bold" fill="#ffffff">${pct.toFixed(1)}%</text>\n`;
        }

        // Legend item
        const legendY = 120 + i * 24;
        if (legendY < 560) {
          const labelStr = escapeXml(labels[i] || `Item ${i + 1}`);
          svgElements += `<rect x="680" y="${legendY}" width="14" height="14" fill="${color}" rx="3"/>\n`;
          svgElements += `<text x="702" y="${legendY + 11}" font-family="Inter, system-ui, sans-serif" font-size="12" fill="#374151">${labelStr} (${val.toLocaleString()} - ${pct.toFixed(1)}%)</text>\n`;
        }
      });

    } else {
      // Bar or Line chart
      let categories: string[] = [];
      let numericValues: number[] = [];

      if (traces.length === 1 && (firstTrace.x || firstTrace.labels)) {
        categories = Array.isArray(firstTrace.x) ? firstTrace.x.map(String) : (Array.isArray(firstTrace.labels) ? firstTrace.labels.map(String) : []);
        numericValues = Array.isArray(firstTrace.y) ? firstTrace.y.map(Number) : (Array.isArray(firstTrace.values) ? firstTrace.values.map(Number) : []);
      } else if (traces.length > 1) {
        categories = traces.map(t => String(t.name || t.x?.[0] || ''));
        numericValues = traces.map(t => Number(t.y?.[0] || t.values?.[0] || 0));
      }

      const count = Math.min(categories.length, numericValues.length);
      const cleanVals = numericValues.slice(0, count).map(v => isNaN(v) ? 0 : v);
      const maxVal = Math.max(...cleanVals, 1);

      const plotLeft = 90;
      const plotRight = 960;
      const plotTop = 70;
      const plotBottom = 490;
      const plotWidth = plotRight - plotLeft;
      const plotHeight = plotBottom - plotTop;

      // Draw 5 horizontal Y-axis gridlines
      for (let step = 0; step <= 4; step++) {
        const gridY = plotBottom - (step / 4) * plotHeight;
        const gridVal = (step / 4) * maxVal;
        const valStr = gridVal >= 1000 ? Math.round(gridVal).toLocaleString() : gridVal.toFixed(0);

        svgElements += `<line x1="${plotLeft}" y1="${gridY.toFixed(2)}" x2="${plotRight}" y2="${gridY.toFixed(2)}" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="3,3"/>\n`;
        svgElements += `<text x="${plotLeft - 10}" y="${(gridY + 4).toFixed(2)}" text-anchor="end" font-family="Inter, system-ui, sans-serif" font-size="11" fill="#6b7280">${valStr}</text>\n`;
      }

      // X-axis baseline
      svgElements += `<line x1="${plotLeft}" y1="${plotBottom}" x2="${plotRight}" y2="${plotBottom}" stroke="#9ca3af" stroke-width="1.5"/>\n`;

      // Y-axis title
      const yAxisTitle = escapeXml(this.layout?.yaxis?.title?.text || this.layout?.yaxis?.title || 'Values');
      svgElements += `<text x="25" y="${(plotTop + plotHeight / 2).toFixed(2)}" text-anchor="middle" transform="rotate(-90 25 ${(plotTop + plotHeight / 2).toFixed(2)})" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="600" fill="#374151">${yAxisTitle}</text>\n`;

      // X-axis title
      const xAxisTitle = escapeXml(this.layout?.xaxis?.title?.text || this.layout?.xaxis?.title || 'Categories');
      svgElements += `<text x="${(plotLeft + plotWidth / 2).toFixed(2)}" y="585" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="600" fill="#374151">${xAxisTitle}</text>\n`;

      if (count > 0) {
        const groupWidth = plotWidth / count;
        const barWidth = Math.max(3, Math.min(36, groupWidth * 0.72));

        if (chartType === 'line') {
          // Pure Vector Line Chart
          let pointsAttr = '';
          cleanVals.forEach((val, i) => {
            const px = plotLeft + i * groupWidth + groupWidth / 2;
            const py = plotBottom - (val / maxVal) * plotHeight;
            pointsAttr += `${px.toFixed(2)},${py.toFixed(2)} `;
            svgElements += `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="4" fill="#0969da" stroke="#ffffff" stroke-width="1.5"/>\n`;
          });
          svgElements += `<polyline points="${pointsAttr.trim()}" fill="none" stroke="#0969da" stroke-width="2.5"/>\n`;
        } else {
          // Pure Vector Bar Chart
          cleanVals.forEach((val, i) => {
            const bx = plotLeft + i * groupWidth + (groupWidth - barWidth) / 2;
            const bh = (val / maxVal) * plotHeight;
            const by = plotBottom - bh;
            const barColor = palette[i % palette.length];

            svgElements += `<rect x="${bx.toFixed(2)}" y="${by.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${bh.toFixed(2)}" fill="${barColor}" rx="2" ry="2"/>\n`;

            // X-axis Label (rotated if > 8 items or long)
            const labelStr = escapeXml(categories[i] || `Item ${i + 1}`);
            const textX = (bx + barWidth / 2).toFixed(2);
            if (count > 8) {
              const truncatedLabel = labelStr.length > 20 ? labelStr.substring(0, 18) + '…' : labelStr;
              svgElements += `<text x="${textX}" y="508" text-anchor="end" transform="rotate(-40 ${textX} 508)" font-family="Inter, system-ui, sans-serif" font-size="10" fill="#4b5563">${truncatedLabel}</text>\n`;
            } else {
              svgElements += `<text x="${textX}" y="512" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="11" fill="#4b5563">${labelStr}</text>\n`;
            }
          });
        }
      }
    }

    const titleEscaped = escapeXml(titleText);

    return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    text { font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  </style>
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="${width / 2}" y="38" text-anchor="middle" font-size="16" font-weight="600" fill="#111827">${titleEscaped}</text>
  ${svgElements}
</svg>`;
  }

  public downloadSVG(filename = 'chart') {
    try {
      const svgString = this.generatePureVectorSVG(filename);
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${filename}.svg`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate pure vector SVG:', err);
    }
  }

  public async downloadPDF(filename = 'chart') {
    try {
      // Generate pure vector SVG string
      const svgString = this.generatePureVectorSVG(filename);

      // Parse SVG string to DOM element
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
      const svgElement = svgDoc.documentElement;

      if (!svgElement || svgElement.querySelector('parsererror')) {
        throw new Error('Failed to parse SVG string for vector PDF generation');
      }

      // Create landscape A4 PDF (297mm x 210mm)
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const margin = 10;
      const maxW = pdfWidth - (margin * 2);
      const maxH = pdfHeight - (margin * 2);

      const svgWidth = 1000;
      const svgHeight = 600;

      let fitW = maxW;
      let fitH = (svgHeight / svgWidth) * fitW;
      if (fitH > maxH) {
        fitH = maxH;
        fitW = (svgWidth / svgHeight) * fitH;
      }

      const x = (pdfWidth - fitW) / 2;
      const y = (pdfHeight - fitH) / 2;

      // Draw pure vector elements directly into PDF stream
      await svg2pdf(svgElement, pdf, {
        x: x,
        y: y,
        width: fitW,
        height: fitH
      });

      pdf.save(`${filename}.pdf`);
    } catch (err) {
      console.error('Failed to export vector chart PDF:', err);
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
              <button class="chart-export-btn" style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; font-size: 11px; font-weight: 500; color: #374151; background: #ffffff; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer;" @click=${() => this.downloadSVG()} title="Export chart as SVG image with white background">
                🎨 Export SVG
              </button>

              <button class="chart-export-btn" style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; font-size: 11px; font-weight: 500; color: #374151; background: #ffffff; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer;" @click=${() => this.downloadPDF()} title="Export chart as PDF document">
                📄 Export PDF
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