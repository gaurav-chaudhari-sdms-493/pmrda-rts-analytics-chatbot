/**
 * Rich Component System for Vanna Agents
 *
 * Provides a generic component registry and rendering system that can display
 * any rich component sent from the Python backend.
 */

import { richComponentStyleText } from '../styles/rich-component-styles.js';

// Component interfaces matching Python backend
export interface RichComponent {
  id: string;
  type: string;
  lifecycle: 'create' | 'update' | 'replace' | 'remove';
  data: Record<string, any>;
  children: string[];
  timestamp: string;
  visible: boolean;
  interactive: boolean;
}

// Artifact event interfaces
export interface ArtifactOpenedEventDetail {
  // Core identification
  artifactId: string;

  // Artifact content
  content: string; // Full HTML/SVG/JS content
  type: 'html' | 'svg' | 'visualization' | 'interactive' | 'd3' | 'threejs';
  title?: string;
  description?: string;

  // Trigger context
  trigger: 'created' | 'user-action'; // How this event was fired

  // Control
  preventDefault: () => void; // Prevent default behavior

  // Helpers
  getStandaloneHTML: () => string; // Full page HTML with dependencies

  // Metadata
  timestamp: string;
}

declare global {
  interface GlobalEventHandlersEventMap {
    'artifact-opened': CustomEvent<ArtifactOpenedEventDetail>;
  }
}


const RICH_COMPONENT_STYLE_ATTR = 'data-vanna-rich-component-styles';

function ensureRichComponentStyles(container: HTMLElement): void {
  const doc = container.ownerDocument;
  if (!doc) {
    return;
  }

  if (container.querySelector(`style[${RICH_COMPONENT_STYLE_ATTR}]`)) {
    return;
  }

  const styleEl = doc.createElement('style');
  styleEl.setAttribute(RICH_COMPONENT_STYLE_ATTR, 'true');
  styleEl.textContent = richComponentStyleText;
  container.prepend(styleEl);
}

export interface ComponentUpdate {
  operation: 'create' | 'update' | 'replace' | 'remove' | 'reorder' | 'bulk_update';
  target_id: string;
  component?: RichComponent;
  updates?: Record<string, any>;
  position?: any;
  timestamp: string;
  batch_id?: string;
}

// Component renderer interface
export interface ComponentRenderer {
  render(component: RichComponent): HTMLElement;
  update(element: HTMLElement, component: RichComponent, updates?: Record<string, any>): void;
  remove(element: HTMLElement): void;
}

// Base component renderer with common functionality
export abstract class BaseComponentRenderer implements ComponentRenderer {
  abstract render(component: RichComponent): HTMLElement;

  update(element: HTMLElement, component: RichComponent, _updates?: Record<string, any>): void {
    // Default implementation - re-render completely
    const newElement = this.render(component);
    element.parentNode?.replaceChild(newElement, element);
  }

  remove(element: HTMLElement): void {
    element.remove();
  }

}

// Card component renderer
export class CardComponentRenderer extends BaseComponentRenderer {
  render(component: RichComponent): HTMLElement {
    console.log('🎴 CardComponentRenderer.render() called', {
      componentId: component.id,
      componentData: component.data,
      actions: component.data?.actions
    });

    const card = document.createElement('div');
    card.className = 'rich-component rich-card';
    card.dataset.componentId = component.id;

    const { title, content, subtitle, icon, status, actions = [], collapsible, collapsed } = component.data;

    console.log('🎴 Extracted actions:', actions, 'Length:', actions?.length);

    card.innerHTML = `
      <div class="card-header ${collapsible ? 'collapsible' : ''}">
        ${icon ? `<span class="card-icon">${icon}</span>` : ''}
        <div class="card-title-section">
          <h3 class="card-title">${title}</h3>
          ${subtitle ? `<p class="card-subtitle">${subtitle}</p>` : ''}
        </div>
        ${status ? `<span class="card-status status-${status}">${status}</span>` : ''}
        ${collapsible ? `<button class="card-toggle">${collapsed ? '▶' : '▼'}</button>` : ''}
      </div>
      <div class="card-content ${collapsed ? 'collapsed' : ''}">
        ${content}
      </div>
      ${actions && actions.length > 0 ? `
        <div class="card-actions">
          ${actions.map((action: any) => `
            <button class="card-action ${action.variant || 'secondary'}" data-action="${action.action}">
              ${action.label}
            </button>
          `).join('')}
        </div>
      ` : ''}
    `;


    // Add collapsible functionality
    if (collapsible) {
      const toggle = card.querySelector('.card-toggle') as HTMLButtonElement;
      const content = card.querySelector('.card-content') as HTMLElement;

      toggle?.addEventListener('click', () => {
        content.classList.toggle('collapsed');
        toggle.textContent = content.classList.contains('collapsed') ? '▶' : '▼';
      });
    }

    // Add click handlers for action buttons
    console.log('🎴 Checking if should add click handlers:', {
      hasActions: !!actions,
      actionsLength: actions?.length
    });

    if (actions && actions.length > 0) {
      const actionButtons = card.querySelectorAll('.card-action') as NodeListOf<HTMLButtonElement>;
      console.log('🎴 Found action buttons:', actionButtons.length);

      actionButtons.forEach((button, index) => {
        const action = actions[index];
        console.log(`🎴 Setting up listener for button ${index}:`, {
          hasAction: !!action,
          hasActionProperty: !!action?.action,
          action: action
        });

        if (action && action.action) {
          console.log('🎴 Adding click listener to button:', button);
          button.addEventListener('click', async () => {
            console.log('🔘 Card action button clicked:', action.label);
            console.log('   Sending action:', action.action);

            // Apply visual feedback
            button.disabled = true;
            button.classList.add('button-transitioning', 'button-clicked');

            // Find vanna-chat component and send message
            const vannaChat = document.querySelector('vanna-chat') as any;

            if (vannaChat && typeof vannaChat.sendMessage === 'function') {
              try {
                const success = await vannaChat.sendMessage(action.action);

                if (success) {
                  console.log('✅ Card action sent successfully');
                  // Keep button disabled after successful action
                } else {
                  console.error('❌ Failed to send card action');
                  // Re-enable button on failure
                  button.disabled = false;
                  button.classList.remove('button-transitioning', 'button-clicked');
                }
              } catch (error) {
                console.error('❌ Error sending card action:', error);
                // Re-enable button on error
                button.disabled = false;
                button.classList.remove('button-transitioning', 'button-clicked');
              }
            } else {
              console.warn('⚠️ vanna-chat component not found or sendMessage not available');
              button.disabled = false;
              button.classList.remove('button-transitioning', 'button-clicked');
            }
          });
        }
      });
    }

    return card;
  }

  update(element: HTMLElement, component: RichComponent, updates?: Record<string, any>): void {
    if (!updates) return super.update(element, component);

    // Optimized updates for common properties
    if (updates.title) {
      const titleEl = element.querySelector('.card-title');
      if (titleEl) titleEl.textContent = updates.title;
    }

    if (updates.content) {
      const contentEl = element.querySelector('.card-content');
      if (contentEl) contentEl.innerHTML = updates.content;
    }

    if (updates.status) {
      const statusEl = element.querySelector('.card-status');
      if (statusEl) {
        statusEl.className = `card-status status-${updates.status}`;
        statusEl.textContent = updates.status;
      }
    }

    // For complex updates, fall back to full re-render
    if (updates.actions || updates.collapsible) {
      super.update(element, component);
    }
  }
}

// Task list component renderer
export class TaskListComponentRenderer extends BaseComponentRenderer {
  render(component: RichComponent): HTMLElement {
    const container = document.createElement('div');
    container.className = 'rich-component rich-task-list';
    container.dataset.componentId = component.id;

    const { title, tasks = [], show_progress, show_timestamps } = component.data;

    const completedTasks = tasks.filter((task: any) => task.status === 'completed').length;
    const progress = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;

    container.innerHTML = `
      <div class="task-list-header">
        <h3 class="task-list-title">${title}</h3>
        ${show_progress ? `
          <div class="task-list-progress">
            <span class="progress-text">${completedTasks}/${tasks.length} completed</span>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
          </div>
        ` : ''}
      </div>
      <div class="task-list-items">
        ${tasks.map((task: any) => this.renderTask(task, show_timestamps)).join('')}
      </div>
    `;


    return container;
  }

  private renderTask(task: any, showTimestamps: boolean): string {
    const statusIcon = this.getStatusIcon(task.status);
    const progressBar = task.progress !== null && task.progress !== undefined ? `
      <div class="task-progress">
        <div class="task-progress-bar">
          <div class="task-progress-fill" style="width: ${task.progress * 100}%"></div>
        </div>
        <span class="task-progress-text">${Math.round(task.progress * 100)}%</span>
      </div>
    ` : '';

    return `
      <div class="task-item status-${task.status}" data-task-id="${task.id}">
        <div class="task-icon">${statusIcon}</div>
        <div class="task-content">
          <div class="task-title">${task.title}</div>
          ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
          ${progressBar}
          ${showTimestamps && task.created_at ? `
            <div class="task-timestamp">
              Created: ${new Date(task.created_at).toLocaleString()}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'completed': return '✅';
      case 'running': return '🔄';
      case 'failed': return '❌';
      default: return '⭕';
    }
  }
}

// Progress bar component renderer
export class ProgressBarComponentRenderer extends BaseComponentRenderer {
  render(component: RichComponent): HTMLElement {
    const container = document.createElement('div');
    container.className = 'rich-component rich-progress-bar';
    container.dataset.componentId = component.id;

    const { value, label, show_percentage, status, animated } = component.data;
    const percentage = Math.round(value * 100);

    container.innerHTML = `
      <div class="progress-header">
        ${label ? `<span class="progress-label">${label}</span>` : ''}
        ${show_percentage ? `<span class="progress-percentage">${percentage}%</span>` : ''}
      </div>
      <div class="progress-track">
        <div class="progress-fill ${animated ? 'animated' : ''} ${status ? `status-${status}` : ''}"
             style="width: ${percentage}%"></div>
      </div>
    `;


    return container;
  }

  update(element: HTMLElement, component: RichComponent, updates?: Record<string, any>): void {
    if (!updates) return super.update(element, component);

    if (updates.value !== undefined) {
      const fill = element.querySelector('.progress-fill') as HTMLElement;
      const percentage = Math.round(updates.value * 100);

      if (fill) {
        fill.style.width = `${percentage}%`;
      }

      const percentageEl = element.querySelector('.progress-percentage');
      if (percentageEl) {
        percentageEl.textContent = `${percentage}%`;
      }
    }

    if (updates.label) {
      const labelEl = element.querySelector('.progress-label');
      if (labelEl) labelEl.textContent = updates.label;
    }

    if (updates.status) {
      const fill = element.querySelector('.progress-fill') as HTMLElement;
      if (fill) {
        fill.className = fill.className.replace(/status-\w+/, `status-${updates.status}`);
      }
    }
  }
}

// Notification component renderer
export class NotificationComponentRenderer extends BaseComponentRenderer {
  render(component: RichComponent): HTMLElement {
    const container = document.createElement('div');
    container.className = 'rich-component rich-notification';
    container.dataset.componentId = component.id;

    const { message, title, level = 'info', icon, dismissible, auto_dismiss, actions = [] } = component.data;

    const levelIcon = icon || this.getLevelIcon(level);
    const dismissButton = dismissible ? `
      <button class="notification-dismiss" onclick="this.parentElement.remove()">×</button>
    ` : '';

    container.innerHTML = `
      <div class="notification-content level-${level}">
        ${levelIcon ? `<span class="notification-icon">${levelIcon}</span>` : ''}
        <div class="notification-body">
          ${title ? `<div class="notification-title">${title}</div>` : ''}
          <div class="notification-message">${message}</div>
        </div>
        ${actions.length > 0 ? `
          <div class="notification-actions">
            ${actions.map((action: any) => `
              <button class="notification-action ${action.variant || 'secondary'}" data-action="${action.action}">
                ${action.label}
              </button>
            `).join('')}
          </div>
        ` : ''}
        ${dismissButton}
      </div>
    `;

    // Auto-dismiss functionality
    if (auto_dismiss && component.data.auto_dismiss_delay) {
      setTimeout(() => {
        if (container.parentElement) {
          container.remove();
        }
      }, component.data.auto_dismiss_delay);
    }


    return container;
  }

  private getLevelIcon(level: string): string {
    switch (level) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'info':
      default: return 'ℹ️';
    }
  }
}

// Status indicator component renderer
export class StatusIndicatorComponentRenderer extends BaseComponentRenderer {
  render(component: RichComponent): HTMLElement {
    const container = document.createElement('div');
    container.className = 'rich-component rich-status-indicator';
    container.dataset.componentId = component.id;

    const { status, message, icon, pulse } = component.data;

    const statusIcon = icon || this.getStatusIcon(status);
    const pulseClass = pulse ? 'pulse' : '';

    container.innerHTML = `
      <div class="status-indicator-content status-${status} ${pulseClass}">
        <span class="status-icon">${statusIcon}</span>
        <span class="status-message">${message}</span>
      </div>
    `;


    return container;
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'loading': return '🔄';
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return 'ℹ️';
    }
  }

  update(element: HTMLElement, component: RichComponent, updates?: Record<string, any>): void {
    if (!updates) return super.update(element, component);

    const content = element.querySelector('.status-indicator-content');
    if (content && updates.status) {
      content.className = content.className.replace(/status-\w+/, `status-${updates.status}`);
    }

    if (updates.pulse !== undefined) {
      const content = element.querySelector('.status-indicator-content');
      if (content) {
        if (updates.pulse) {
          content.classList.add('pulse');
        } else {
          content.classList.remove('pulse');
        }
      }
    }

    if (updates.message) {
      const messageEl = element.querySelector('.status-message');
      if (messageEl) {
        messageEl.textContent = updates.message;
      }
    }
  }
}

// DataFrame component renderer (JetBrains DataGrip Style - Server-Driven)
export class DataFrameComponentRenderer extends BaseComponentRenderer {
  render(component: RichComponent): HTMLElement {
    const container = document.createElement('div');
    container.className = 'rich-component rich-dataframe';
    container.dataset.componentId = component.id;
    ensureRichComponentStyles(container);

    const {
      data = [],
      columns = [],
      title,
      description,
      searchable = true,
      sortable = true,
      filterable = true,
      exportable = true,
      striped = true,
      bordered = true,
      compact = false,
      column_types = {},
      total_rows = data.length,
      output_file = null
    } = component.data;

    // Table state
    const state = {
      outputFile: output_file,
      pageData: data.slice(0, 25),
      filteredData: [...data],
      columns: columns.length > 0 ? columns : (data[0] ? Object.keys(data[0]) : []),
      totalRows: total_rows || data.length,
      filteredRows: total_rows || data.length,
      currentPage: 1,
      pageSize: 25 as number | 'all',
      sortColumn: null as string | null,
      sortDirection: null as 'asc' | 'desc' | null,
      globalSearch: '',
      columnFilters: {} as Record<string, Set<any>>,
      startRow: data.length > 0 ? 1 : 0,
      endRow: Math.min(25, data.length),
      isLoading: false,
      activeView: 'table' as 'table' | 'bar' | 'line' | 'pie'
    };

    // Client-side chart builder for view tabs
    const renderChartForView = (viewType: 'bar' | 'line' | 'pie') => {
      const chartElement = container.querySelector('plotly-chart') as any;
      if (!chartElement) return;

      const rows = state.pageData && state.pageData.length > 0 ? state.pageData : data;
      const cols = state.columns && state.columns.length > 0 ? state.columns : (rows[0] ? Object.keys(rows[0]) : []);

      if (!rows || rows.length === 0 || !cols || cols.length === 0) {
        chartElement.data = [];
        chartElement.layout = { title: { text: 'No Data Available', font: { size: 14 } } };
        return;
      }

      const sampleRow = rows[0] || {};

      // Identify date column
      const dateCol = cols.find((c: string) => {
        const lower = String(c).toLowerCase();
        return ['date', 'time', 'created_at', 'timestamp', 'updated_at', 'year', 'month', 'day'].some((kw: string) => lower.includes(kw));
      });

      // Filter non-metric numeric columns (IDs, zip codes, coordinates, status codes)
      const nonMetricKeywords = ['id', 'index', 'row_id', 'complaint_number', 'sr_no', 'ward_id', 'zone_id', 'pincode', 'zip', 'zipcode', 'mobile', 'phone', 'lat', 'latitude', 'lng', 'longitude', 'status_code', 'dept_id'];
      const numCols = cols.filter((c: string) => {
        const lower = String(c).toLowerCase();
        if (nonMetricKeywords.some(kw => lower.includes(kw))) return false;
        const val = sampleRow[c];
        return typeof val === 'number' || (!isNaN(Number(val)) && val !== '' && val !== null);
      });

      // Identify categorical column (e.g., Ward Name, Category, Status, Department)
      const catCol = cols.find((c: string) => {
        const lower = String(c).toLowerCase();
        if (nonMetricKeywords.some(kw => lower.includes(kw))) return false;
        return c !== dateCol && !numCols.includes(c);
      }) || dateCol || cols[0];

      const xAxisTitleText = catCol
        ? String(catCol).replace(/_/g, ' ').toUpperCase()
        : (dateCol ? 'DATE / TIME' : 'CATEGORIES');
      const yAxisTitleText = numCols.length > 0
        ? numCols.map((c: string) => String(c).replace(/_/g, ' ').toUpperCase()).join(' / ')
        : 'COUNT';

      const isMultiTrace = numCols.length > 1;
      const topRows = rows.length > 25 ? rows.slice(0, 25) : rows;

      const defaultChartTitle = (title && title !== 'Query Results' && title !== 'DataFrame')
        ? title
        : (catCol && yAxisTitleText
            ? `${yAxisTitleText} BY ${xAxisTitleText}`
            : 'Query Results Chart');

      let plotlyTraces: any[] = [];
      const palette = ['#0969da', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#3b82f6', '#10b981'];

      let plotlyLayout: any = {
        title: {
          text: defaultChartTitle,
          font: { family: 'Inter, system-ui, sans-serif', size: 13, color: '#111827', weight: '600' }
        },
        autosize: true,
        height: 480,
        margin: { t: 40, r: 35, b: 100, l: 75 },
        font: { family: 'Inter, system-ui, sans-serif', color: '#374151', size: 11 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        hovermode: 'closest',
        hoverlabel: {
          font: { family: 'Inter, system-ui, sans-serif', size: 12, color: '#374151' },
          align: 'left',
          namelength: -1
        },
        showlegend: isMultiTrace,
        legend: {
          itemclick: 'toggle',
          itemdoubleclick: 'toggleothers',
          orientation: 'h',
          y: 1.08,
          x: 0.5,
          xanchor: 'center',
          yanchor: 'bottom',
          font: { family: 'Inter, system-ui, sans-serif', size: 11, color: '#374151' }
        },
        xaxis: {
          title: {
            text: xAxisTitleText,
            font: { family: 'Inter, system-ui, sans-serif', size: 11, color: '#1f2937' }
          },
          automargin: true,
          tickangle: -45,
          tickfont: { size: 10, color: '#4b5563' },
          gridcolor: 'rgba(229, 231, 235, 0.7)',
          zeroline: false
        },
        yaxis: {
          title: {
            text: yAxisTitleText,
            font: { family: 'Inter, system-ui, sans-serif', size: 11, color: '#1f2937' }
          },
          automargin: true,
          tickfont: { size: 11, color: '#4b5563' },
          gridcolor: 'rgba(229, 231, 235, 0.7)',
          zerolinecolor: 'rgba(209, 213, 219, 0.8)'
        }
      };

      if (viewType === 'bar') {
        if (catCol && numCols.length > 0) {
          const xVals = topRows.map((r: any) => r[catCol]);
          plotlyTraces = numCols.slice(0, 3).map((nc: string, idx: number) => ({
            x: xVals,
            y: topRows.map((r: any) => Number(r[nc]) || 0),
            name: String(nc).replace(/_/g, ' ').toUpperCase(),
            type: 'bar',
            showlegend: isMultiTrace,
            marker: { color: palette[idx % palette.length], opacity: 0.9 },
            hovertemplate: '<b>%{x}</b><br>' + String(nc).replace(/_/g, ' ') + ': <b>%{y:,.0f}</b><extra></extra>'
          }));
          plotlyLayout.barmode = numCols.length > 1 ? 'group' : 'stack';
        } else if (catCol) {
          const freqMap: Record<string, number> = {};
          rows.forEach((r: any) => {
            const k = String(r[catCol] ?? 'N/A');
            freqMap[k] = (freqMap[k] || 0) + 1;
          });
          const sorted = Object.entries(freqMap).sort((a, b) => b[1] - a[1]).slice(0, 25);
          plotlyTraces = [{
            x: sorted.map(e => e[0]),
            y: sorted.map(e => e[1]),
            type: 'bar',
            name: String(catCol).replace(/_/g, ' ').toUpperCase(),
            showlegend: false,
            marker: { color: palette[0], opacity: 0.9 },
            hovertemplate: '<b>%{x}</b><br>Total Count: <b>%{y:,.0f}</b><extra></extra>'
          }];
        }
      } else if (viewType === 'line') {
        if (dateCol && numCols.length > 0) {
          const valCol = numCols[0];
          const aggregated: Record<string, number> = {};
          rows.forEach((r: any) => {
            let d = r[dateCol];
            if (d) {
              const strVal = String(d).split('T')[0].split(' ')[0];
              const v = Number(r[valCol]) || 0;
              aggregated[strVal] = (aggregated[strVal] || 0) + v;
            }
          });
          const sortedEntries = Object.entries(aggregated).sort((a, b) => a[0].localeCompare(b[0]));

          plotlyTraces = [{
            x: sortedEntries.map(e => e[0]),
            y: sortedEntries.map(e => e[1]),
            mode: 'lines+markers',
            type: 'scatter',
            name: String(valCol).replace(/_/g, ' ').toUpperCase(),
            showlegend: false,
            line: { shape: 'spline', width: 3, color: palette[0] },
            fill: 'tozeroy',
            fillcolor: 'rgba(9, 105, 218, 0.08)',
            marker: { size: 7, color: palette[0] },
            hovertemplate: `<b>%{x}</b><br>${String(valCol).replace(/_/g, ' ')}: <b>%{y:,.0f}</b><extra></extra>`
          }];
        } else if (dateCol) {
          // Time-series trend: group and sort by date ascending
          const freqMap: Record<string, number> = {};
          rows.forEach((r: any) => {
            let val = r[dateCol];
            if (val) {
              const strVal = String(val).split('T')[0].split(' ')[0];
              freqMap[strVal] = (freqMap[strVal] || 0) + 1;
            }
          });
          const sortedEntries = Object.entries(freqMap).sort((a, b) => a[0].localeCompare(b[0]));

          plotlyTraces = [{
            x: sortedEntries.map(e => e[0]),
            y: sortedEntries.map(e => e[1]),
            mode: 'lines+markers',
            type: 'scatter',
            name: 'Trend Over Time',
            showlegend: false,
            line: { shape: 'spline', width: 3, color: palette[0] },
            fill: 'tozeroy',
            fillcolor: 'rgba(9, 105, 218, 0.08)',
            marker: { size: 7, color: palette[0] },
            hovertemplate: '<b>%{x}</b><br>Count: <b>%{y:,.0f}</b><extra></extra>'
          }];
        } else if (catCol && numCols.length > 0) {
          const xVals = topRows.map((r: any) => r[catCol]);
          plotlyTraces = numCols.slice(0, 3).map((nc: string, idx: number) => ({
            x: xVals,
            y: topRows.map((r: any) => Number(r[nc]) || 0),
            name: String(nc).replace(/_/g, ' ').toUpperCase(),
            showlegend: isMultiTrace,
            mode: 'lines+markers',
            type: 'scatter',
            line: { shape: 'spline', width: 3, color: palette[idx % palette.length] },
            fill: idx === 0 ? 'tozeroy' : undefined,
            fillcolor: idx === 0 ? 'rgba(9, 105, 218, 0.08)' : undefined,
            marker: { size: 7, color: palette[idx % palette.length] },
            hovertemplate: '<b>%{x}</b><br>' + String(nc).replace(/_/g, ' ') + ': <b>%{y:,.0f}</b><extra></extra>'
          }));
        } else if (catCol) {
          // Categorical aggregation sorted by count/value
          const freqMap: Record<string, number> = {};
          rows.forEach((r: any) => {
            const k = String(r[catCol] ?? 'N/A');
            freqMap[k] = (freqMap[k] || 0) + 1;
          });
          const sorted = Object.entries(freqMap).sort((a, b) => b[1] - a[1]).slice(0, 25);
          plotlyTraces = [{
            x: sorted.map(e => e[0]),
            y: sorted.map(e => e[1]),
            mode: 'lines+markers',
            type: 'scatter',
            name: String(catCol).replace(/_/g, ' ').toUpperCase(),
            showlegend: false,
            line: { shape: 'spline', width: 3, color: palette[0] },
            fill: 'tozeroy',
            fillcolor: 'rgba(9, 105, 218, 0.08)',
            marker: { size: 8, color: palette[0] },
            hovertemplate: '<b>%{x}</b><br>Count: <b>%{y:,.0f}</b><extra></extra>'
          }];
        }
      } else if (viewType === 'pie') {
        plotlyLayout.autosize = true;
        plotlyLayout.width = undefined;
        plotlyLayout.margin = { t: 25, r: 25, b: 25, l: 25 };
        plotlyLayout.showlegend = true;
        plotlyLayout.legend = {
          orientation: 'v',
          x: 0.68,
          y: 0.5,
          xanchor: 'left',
          yanchor: 'middle',
          font: { family: 'Inter, system-ui, sans-serif', size: 11, color: '#374151' }
        };

        if (catCol && numCols.length > 0) {
          const valCol = numCols[0];
          const aggregated: Record<string, number> = {};
          rows.forEach((r: any) => {
            const k = String(r[catCol] ?? 'N/A');
            const v = Number(r[valCol]) || 0;
            aggregated[k] = (aggregated[k] || 0) + v;
          });
          const sorted = Object.entries(aggregated).sort((a, b) => b[1] - a[1]).slice(0, 15);
          plotlyTraces = [{
            labels: sorted.map(e => e[0]),
            values: sorted.map(e => e[1]),
            type: 'pie',
            hole: 0.45,
            domain: { x: [0, 0.64] },
            showlegend: true,
            textinfo: 'percent',
            textposition: 'inside',
            marker: { colors: palette, line: { color: '#ffffff', width: 2 } },
            hovertemplate: `<b>%{label}</b><br>${String(valCol).replace(/_/g, ' ')}: <b>%{value:,.0f}</b> (%{percent})<extra></extra>`
          }];
        } else if (catCol) {
          const freqMap: Record<string, number> = {};
          rows.forEach((r: any) => {
            const k = String(r[catCol] ?? 'N/A');
            freqMap[k] = (freqMap[k] || 0) + 1;
          });
          const sorted = Object.entries(freqMap).sort((a, b) => b[1] - a[1]).slice(0, 15);
          plotlyTraces = [{
            labels: sorted.map(e => e[0]),
            values: sorted.map(e => e[1]),
            type: 'pie',
            hole: 0.45,
            domain: { x: [0, 0.64] },
            showlegend: true,
            textinfo: 'percent',
            textposition: 'inside',
            marker: { colors: palette, line: { color: '#ffffff', width: 2 } },
            hovertemplate: '<b>%{label}</b><br>Count: <b>%{value:,.0f}</b> (%{percent})<extra></extra>'
          }];
        }
      }

      chartElement.data = plotlyTraces;
      chartElement.layout = plotlyLayout;
      chartElement.config = {
        responsive: true,
        displayModeBar: false,
        displaylogo: false,
        scrollZoom: true,
        dragmode: 'zoom',
        doubleClick: 'reset'
      };

      // Enable interactive click-to-filter on chart elements
      if (!chartElement._hasClickListener) {
        chartElement._hasClickListener = true;
        chartElement.addEventListener('chart-click', (evt: CustomEvent) => {
          const clickedLabel = evt.detail?.label;
          if (clickedLabel) {
            const searchInput = container.querySelector('.search-input') as HTMLInputElement;
            if (searchInput) {
              searchInput.value = String(clickedLabel);
            }
            state.globalSearch = String(clickedLabel);
            state.currentPage = 1;
            fetchServerData();
          }
        });
      }
    };

    // Server-side data fetcher
    const fetchServerData = async (distinctCol?: string) => {
      if (!state.outputFile) return null;

      state.isLoading = true;
      showLoadingState();

      try {
        const formattedFilters: Record<string, any[]> = {};
        Object.keys(state.columnFilters).forEach(col => {
          const setVal = state.columnFilters[col];
          if (setVal && setVal.size > 0) {
            formattedFilters[col] = Array.from(setVal);
          }
        });

        const resolveGridApiUrl = (path: string) => {
          const customBase = (window as any).VANNA_API_BASE_URL;
          if (customBase) {
            return `${customBase.replace(/\/+$/, '')}${path}`;
          }
          if (window.location.port === '5173') {
            return `http://${window.location.hostname}:8000${path}`;
          }
          return path;
        };

        const res = await fetch(resolveGridApiUrl('/api/vanna/v2/grid/data'), {


          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            output_file: state.outputFile,
            page: state.currentPage,
            page_size: state.pageSize,
            sort_column: state.sortColumn,
            sort_direction: state.sortDirection,
            global_search: state.globalSearch,
            column_filters: formattedFilters,
            distinct_column: distinctCol || null
          })
        });

        if (!res.ok) throw new Error(`Grid API error: ${res.status}`);

        const result = await res.json();
        state.pageData = result.rows || [];
        state.columns = result.columns || state.columns;
        state.totalRows = result.total_rows ?? state.totalRows;
        state.filteredRows = result.filtered_rows ?? state.filteredRows;
        state.currentPage = result.page ?? state.currentPage;
        state.startRow = result.start_row ?? 0;
        state.endRow = result.end_row ?? 0;

        if (state.activeView !== 'table') {
          renderChartForView(state.activeView);
        }
        return result;
      } catch (err) {
        console.warn('⚠️ Server-side grid fetch failed, using local slice:', err);
        return null;
      } finally {
        state.isLoading = false;
        hideLoadingState();
      }
    };

    // Client-side fallback slice calculator
    const computeClientFallback = () => {
      let result = [...data];

      if (state.globalSearch.trim()) {
        const query = state.globalSearch.toLowerCase().trim();
        result = result.filter(row =>
          state.columns.some((col: string) =>
            String(row[col] ?? '').toLowerCase().includes(query)
          )
        );
      }

      Object.keys(state.columnFilters).forEach(col => {
        const allowedSet = state.columnFilters[col];
        if (allowedSet && allowedSet.size > 0) {
          const strSet = new Set(Array.from(allowedSet).map(v => v === null || v === undefined ? '__NULL__' : String(v)));
          const hasNull = strSet.has('__NULL__') || strSet.has('(NULL)');

          result = result.filter(row => {
            const val = row[col];
            if (val === null || val === undefined) return hasNull;
            if (allowedSet.has(val)) return true;
            return strSet.has(String(val));
          });
        }
      });

      if (state.sortColumn && state.sortDirection) {
        const col = state.sortColumn;
        const dir = state.sortDirection;
        result.sort((a, b) => {
          const aVal = a[col];
          const bVal = b[col];
          if (aVal === null || aVal === undefined) return 1;
          if (bVal === null || bVal === undefined) return -1;
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return dir === 'asc' ? aVal - bVal : bVal - aVal;
          }
          const aStr = String(aVal).toLowerCase();
          const bStr = String(bVal).toLowerCase();
          const comp = aStr.localeCompare(bStr);
          return dir === 'asc' ? comp : -comp;
        });
      }

      state.filteredData = result;
      state.filteredRows = result.length;
      let pageSizeNum = state.pageSize === 'all' ? result.length : Number(state.pageSize);
      if (pageSizeNum <= 0) pageSizeNum = 25;

      const totalPages = Math.max(1, Math.ceil(result.length / pageSizeNum));
      if (state.currentPage > totalPages) state.currentPage = totalPages;
      if (state.currentPage < 1) state.currentPage = 1;

      const start = state.pageSize === 'all' ? 0 : (state.currentPage - 1) * pageSizeNum;
      const end = state.pageSize === 'all' ? result.length : Math.min(start + pageSizeNum, result.length);

      state.pageData = result.slice(start, end);
      state.startRow = result.length > 0 ? start + 1 : 0;
      state.endRow = end;

      if (state.activeView !== 'table') {
        renderChartForView(state.activeView);
      }
    };

    const showLoadingState = () => {
      const tbody = container.querySelector('tbody');
      if (tbody) {
        tbody.style.opacity = '0.5';
        tbody.style.pointerEvents = 'none';
      }
    };

    const hideLoadingState = () => {
      const tbody = container.querySelector('tbody');
      if (tbody) {
        tbody.style.opacity = '1';
        tbody.style.pointerEvents = 'auto';
      }
    };

    const updateView = async () => {
      let serverSuccess = false;
      if (state.outputFile) {
        const result = await fetchServerData();
        if (result) serverSuccess = true;
      }

      if (!serverSuccess) {
        computeClientFallback();
      }

      // Capture active search input state AFTER network fetch completes so typing during fetch is preserved
      const currentSearchInput = container.querySelector('.search-input') as HTMLInputElement;
      const rootNode = container.getRootNode();
      const isSearchFocused = currentSearchInput && (
        document.activeElement === currentSearchInput ||
        (rootNode instanceof ShadowRoot && rootNode.activeElement === currentSearchInput)
      );
      const liveValue = currentSearchInput ? currentSearchInput.value : state.globalSearch;
      const selectionStart = currentSearchInput ? currentSearchInput.selectionStart : null;
      const selectionEnd = currentSearchInput ? currentSearchInput.selectionEnd : null;

      if (currentSearchInput && liveValue !== state.globalSearch) {
        state.globalSearch = liveValue;
      }

      const totalPages = state.pageSize === 'all'
        ? 1
        : Math.max(1, Math.ceil(state.filteredRows / Number(state.pageSize || 25)));

      // Render Top Bar with View Switcher Tabs
      const headerHTML = `
        <div class="dataframe-header">
          <div class="dataframe-header-top">
            <div>
              <h3 class="dataframe-title">${this.escapeHtml(title || 'Query Results')}</h3>
              ${description ? `<p class="dataframe-description">${this.escapeHtml(description)}</p>` : ''}
              <div class="dataframe-meta">
                <span class="row-count">${state.filteredRows} of ${state.totalRows} total rows</span>
                <span class="column-count">${state.columns.length} columns</span>
              </div>
            </div>

            <div class="view-switcher-tabs">
              <button class="view-tab-btn ${state.activeView === 'table' ? 'active' : ''}" data-view="table">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>
                Table
              </button>
              <button class="view-tab-btn ${state.activeView === 'bar' ? 'active' : ''}" data-view="bar">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
                Bar Chart
              </button>
              <button class="view-tab-btn ${state.activeView === 'line' ? 'active' : ''}" data-view="line">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 9l-5 5-4-4-5 5"/></svg>
                Trend Graph
              </button>
              <button class="view-tab-btn ${state.activeView === 'pie' ? 'active' : ''}" data-view="pie">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
                Pie Chart
              </button>
            </div>
          </div>
        </div>
      `;

      const isAnyFilterActive = state.globalSearch.trim() !== '' || Object.values(state.columnFilters).some(s => s && s.size > 0);

      let actionsHTML = '';
      if (searchable || exportable) {
        actionsHTML = `
          <div class="dataframe-actions" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--vanna-outline-dimmer, #e1e4e8);">
            <div style="display: flex; align-items: center; gap: 8px;">
              ${searchable ? `
                <div class="dataframe-search" style="position: relative;">
                  <input type="text" placeholder="Search grid (Ctrl+F)..." value="${this.escapeHtml(state.globalSearch)}" class="search-input" style="padding: 4px 8px; font-size: 12px; border: 1px solid #d0d7de; border-radius: 6px; width: 200px;">
                </div>
              ` : ''}
              ${isAnyFilterActive ? `
                <button class="clear-filters-btn" style="padding: 4px 8px; font-size: 11px; color: #cf222e; background: #ffebe9; border: 1px solid rgba(255,129,130,0.4); border-radius: 4px; cursor: pointer;">
                  ✕ Clear Filters
                </button>
              ` : ''}
            </div>

            <div class="dataframe-actions-right">
              ${exportable ? `
                <div class="export-dropdown-container">
                  <button class="export-main-btn">
                    <span>📥 Export</span>
                    <span style="font-size: 9px;">▼</span>
                  </button>
                  <div class="export-menu">
                    <button class="export-menu-item" data-export-type="csv">📄 Export to CSV (.csv)</button>
                    <button class="export-menu-item" data-export-type="excel">📊 Export to Excel (.xlsx)</button>
                    <button class="export-menu-item" data-export-type="pdf">🖨️ Export to PDF / Print</button>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }

      // Render Table Grid
      let tableHTML = '';
      if (state.columns.length > 0 && state.pageData.length > 0) {
        const tableClasses = [
          'dataframe-table',
          'jetbrains-table',
          striped ? 'striped' : '',
          bordered ? 'bordered' : '',
          compact ? 'compact' : ''
        ].filter(Boolean).join(' ');

        tableHTML = `
          <div class="dataframe-table-container" style="overflow-x: auto;">
            <table class="${tableClasses}">
              <thead>
                <tr>
                  <th class="row-num-cell" style="width: 44px; text-align: center; color: #8c959f; font-weight: 600;">#</th>
                  ${state.columns.map((col: string) => {
          const isSorted = state.sortColumn === col;
          const sortIcon = isSorted ? (state.sortDirection === 'asc' ? '↑' : '↓') : '';
          const isFiltered = !!(state.columnFilters[col] && state.columnFilters[col].size > 0);

          return `
                      <th class="${sortable ? 'sortable' : ''}" data-column="${this.escapeHtml(col)}">
                        <div class="th-content">
                          <span class="col-name" title="${this.escapeHtml(col)}">${this.escapeHtml(col)}</span>
                          ${sortable ? `<span class="sort-indicator">${sortIcon}</span>` : ''}
                          ${filterable ? `
                            <button class="col-filter-btn ${isFiltered ? 'active' : ''}" data-column="${this.escapeHtml(col)}" title="Filter column ${this.escapeHtml(col)}">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                            </button>
                          ` : ''}
                        </div>
                      </th>
                    `;
        }).join('')}
                </tr>
              </thead>
              <tbody>
                ${state.pageData.map((row: any, idx: number) => {
          const globalRowIndex = state.startRow + idx;
          return `
                    <tr>
                      <td class="row-num-cell">${globalRowIndex}</td>
                      ${state.columns.map((col: string) => {
            const value = row[col];
            const columnType = column_types[col] || (typeof value === 'number' ? 'number' : 'string');
            const formattedValue = this.formatCellValue(value, columnType);
            return `<td class="cell-${columnType}">${formattedValue}</td>`;
          }).join('')}
                    </tr>
                  `;
        }).join('')}
              </tbody>
            </table>
          </div>
        `;
      } else {
        tableHTML = `
          <div class="dataframe-empty" style="padding: 24px; text-align: center; color: #8c959f;">
            <p>No matching data found</p>
          </div>
        `;
      }

      // Render Pagination Bar only when columns and total rows exist
      let paginationHTML = '';
      if (state.columns.length > 0 && state.totalRows > 0) {
        const rangeText = state.filteredRows > 0
          ? `${state.startRow} - ${state.endRow} of ${state.filteredRows}`
          : '0 rows';

        paginationHTML = `
          <div class="jetbrains-pagination-bar">
            <div class="page-nav-group">
              <button class="page-nav-btn page-first" ${state.currentPage <= 1 ? 'disabled' : ''} title="First Page">|◄</button>
              <button class="page-nav-btn page-prev" ${state.currentPage <= 1 ? 'disabled' : ''} title="Previous Page">◄</button>
              <span class="page-range-info">${rangeText}</span>
              <button class="page-nav-btn page-next" ${state.currentPage >= totalPages ? 'disabled' : ''} title="Next Page">►</button>
              <button class="page-nav-btn page-last" ${state.currentPage >= totalPages ? 'disabled' : ''} title="Last Page">►|</button>
            </div>

            <div class="page-size-selector">
              <span>Rows:</span>
              <select class="page-size-select">
                <option value="10" ${state.pageSize === 10 ? 'selected' : ''}>10</option>
                <option value="25" ${state.pageSize === 25 ? 'selected' : ''}>25</option>
                <option value="50" ${state.pageSize === 50 ? 'selected' : ''}>50</option>
                <option value="100" ${state.pageSize === 100 ? 'selected' : ''}>100</option>
                <option value="500" ${state.pageSize === 500 ? 'selected' : ''}>500</option>
                <option value="all" ${state.pageSize === 'all' ? 'selected' : ''}>All</option>
              </select>
            </div>
          </div>
        `;
      }

      const showTable = state.activeView === 'table';

      container.innerHTML = `
        ${headerHTML}
        <div class="grid-view-table-section" style="display: ${showTable ? 'block' : 'none'};">
          ${actionsHTML}
          ${tableHTML}
          ${paginationHTML}
        </div>
        <div class="grid-view-chart-section" style="display: ${showTable ? 'none' : 'flex'}; flex-direction: column; width: 100%; height: 500px; padding: 6px; border-radius: 8px; border: 1px solid #e5e7eb; box-sizing: border-box; background: #ffffff; overflow: hidden;">
          <plotly-chart style="display: flex; flex-direction: column; width: 100%; height: 100%; flex: 1; min-height: 0;"></plotly-chart>
        </div>
      `;

      // Re-bind interactive event listeners
      bindEvents();

      if (isSearchFocused) {
        const newSearchInput = container.querySelector('.search-input') as HTMLInputElement;
        if (newSearchInput) {
          newSearchInput.focus({ preventScroll: true });
          if (selectionStart !== null && selectionEnd !== null) {
            try {
              newSearchInput.setSelectionRange(selectionStart, selectionEnd);
            } catch {}
          }
        }
      }

      if (!showTable) {
        requestAnimationFrame(() => {
          renderChartForView(state.activeView as 'bar' | 'line' | 'pie');
        });
      }
    };

    const bindEvents = () => {
      // 0. View Switcher Tabs
      container.querySelectorAll('.view-tab-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const targetView = (btn as HTMLElement).dataset.view as 'table' | 'bar' | 'line' | 'pie';
          if (!targetView || targetView === state.activeView) return;

          state.activeView = targetView;

          container.querySelectorAll('.view-tab-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');

          const tableSec = container.querySelector('.grid-view-table-section') as HTMLElement;
          const chartSec = container.querySelector('.grid-view-chart-section') as HTMLElement;

          if (targetView === 'table') {
            if (tableSec) tableSec.style.display = 'block';
            if (chartSec) chartSec.style.display = 'none';
          } else {
            if (tableSec) tableSec.style.display = 'none';
            if (chartSec) chartSec.style.display = 'block';
            renderChartForView(targetView);
          }
        });
      });

      // 1. Global Search Input (Debounced 250ms)
      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      if (searchInput) {
        let debounceTimer: any = null;
        searchInput.addEventListener('input', (e) => {
          const val = (e.target as HTMLInputElement).value;
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            state.globalSearch = val;
            state.currentPage = 1;
            updateView();
          }, 250);
        });
      }

      // Clear filters button
      const clearFiltersBtn = container.querySelector('.clear-filters-btn') as HTMLButtonElement;
      if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
          state.globalSearch = '';
          state.columnFilters = {};
          state.currentPage = 1;
          updateView();
        });
      }

      // 2. Export Menu Toggle & Streaming Export Handlers
      const exportMainBtn = container.querySelector('.export-main-btn') as HTMLButtonElement;
      const exportMenu = container.querySelector('.export-menu') as HTMLElement;
      if (exportMainBtn && exportMenu) {
        exportMainBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          exportMenu.classList.toggle('open');
        });

        document.addEventListener('click', () => {
          exportMenu.classList.remove('open');
        }, { once: true });

        const exportItems = container.querySelectorAll('.export-menu-item');
        exportItems.forEach(item => {
          item.addEventListener('click', (e) => {
            const exportType = (e.currentTarget as HTMLElement).dataset.exportType as 'csv' | 'excel' | 'pdf';
            this.handleExport(state, exportType, title);
            exportMenu.classList.remove('open');
          });
        });
      }

      // 3. Sorting on Column Header Click (excluding filter button click)
      if (sortable) {
        const sortableHeaders = container.querySelectorAll('th.sortable');
        sortableHeaders.forEach(header => {
          header.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).closest('.col-filter-btn')) {
              return;
            }

            const col = (header as HTMLElement).dataset.column;
            if (!col) return;

            if (state.sortColumn === col) {
              if (state.sortDirection === 'asc') {
                state.sortDirection = 'desc';
              } else if (state.sortDirection === 'desc') {
                state.sortColumn = null;
                state.sortDirection = null;
              }
            } else {
              state.sortColumn = col;
              state.sortDirection = 'asc';
            }
            updateView();
          });
        });
      }

      // 4. Filter Button Click (Opens JetBrains Filter Popup with Server Distinct Values)
      if (filterable) {
        const filterBtns = container.querySelectorAll('.col-filter-btn');
        filterBtns.forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const col = (btn as HTMLElement).dataset.column;
            if (!col) return;

            this.openFilterPopup(container, btn as HTMLElement, col, data, state, fetchServerData, () => {
              state.currentPage = 1;
              updateView();
            });
          });
        });
      }

      // 5. Pagination Controls
      const firstBtn = container.querySelector('.page-first') as HTMLButtonElement;
      const prevBtn = container.querySelector('.page-prev') as HTMLButtonElement;
      const nextBtn = container.querySelector('.page-next') as HTMLButtonElement;
      const lastBtn = container.querySelector('.page-last') as HTMLButtonElement;
      const pageSizeSelect = container.querySelector('.page-size-select') as HTMLSelectElement;

      if (firstBtn) {
        firstBtn.addEventListener('click', () => {
          state.currentPage = 1;
          updateView();
        });
      }
      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          if (state.currentPage > 1) {
            state.currentPage--;
            updateView();
          }
        });
      }
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          state.currentPage++;
          updateView();
        });
      }
      if (lastBtn) {
        lastBtn.addEventListener('click', () => {
          const pageSizeNum = state.pageSize === 'all' ? state.filteredRows : Number(state.pageSize || 25);
          state.currentPage = Math.max(1, Math.ceil(state.filteredRows / pageSizeNum));
          updateView();
        });
      }
      if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', (e) => {
          const val = (e.target as HTMLSelectElement).value;
          state.pageSize = val === 'all' ? 'all' : parseInt(val, 10);
          state.currentPage = 1;
          updateView();
        });
      }
    };

    // Initial render call
    updateView();

    return container;
  }

  private handleExport(state: any, exportType: 'csv' | 'excel' | 'pdf', title?: string): void {
    if (state.outputFile) {
      // Server-side streaming export
      const formattedFilters: Record<string, any[]> = {};
      Object.keys(state.columnFilters).forEach(col => {
        const setVal = state.columnFilters[col];
        if (setVal && setVal.size > 0) {
          formattedFilters[col] = Array.from(setVal);
        }
      });

      const params = new URLSearchParams();
      params.set('output_file', state.outputFile);
      params.set('format', exportType);
      if (state.sortColumn) params.set('sort_column', state.sortColumn);
      if (state.sortDirection) params.set('sort_direction', state.sortDirection);
      if (state.globalSearch) params.set('global_search', state.globalSearch);
      if (Object.keys(formattedFilters).length > 0) {
        params.set('column_filters_json', JSON.stringify(formattedFilters));
      }

      const exportUrl = `/api/vanna/v2/grid/export?${params.toString()}`;
      if (exportType === 'pdf') {
        window.open(exportUrl, '_blank');
      } else {
        window.location.href = exportUrl;
      }
    } else {
      // Fallback client-side export - export full filtered dataset
      const exportRows = (state.filteredData && state.filteredData.length > 0) ? state.filteredData : state.pageData;
      if (exportType === 'csv') this.exportToCSV(exportRows, state.columns);
      else if (exportType === 'excel') this.exportToExcel(exportRows, state.columns, title);
      else if (exportType === 'pdf') this.exportToPDF(exportRows, state.columns, title);
    }
  }

  private async openFilterPopup(
    container: HTMLElement,
    targetBtn: HTMLElement,
    column: string,
    allData: any[],
    state: any,
    fetchServerData: (distinctCol?: string) => Promise<any>,
    onApply: () => void
  ): Promise<void> {
    const existingPopup = container.querySelector('.jetbrains-filter-popup');
    if (existingPopup) {
      existingPopup.remove();
    }

    let uniqueItems: Array<{ rawValue: any; label: string; count: number }> = [];

    if (state.outputFile) {
      const serverResult = await fetchServerData(column);
      if (serverResult && serverResult.distinct_values && serverResult.distinct_values.length > 0) {
        uniqueItems = serverResult.distinct_values;
      }
    }

    if (uniqueItems.length === 0) {
      const countsMap = new Map<any, { rawValue: any; label: string; count: number }>();
      allData.forEach(row => {
        const val = row[column];
        const key = val === null || val === undefined ? '__NULL__' : String(val);
        const label = val === null || val === undefined ? '(NULL)' : String(val);
        if (!countsMap.has(key)) {
          countsMap.set(key, { rawValue: val, label, count: 0 });
        }
        countsMap.get(key)!.count++;
      });
      uniqueItems = Array.from(countsMap.values()).sort((a, b) => a.label.localeCompare(b.label));
    }

    const activeSet = state.columnFilters[column];
    const tempSelected = new Set<any>();
    if (activeSet && activeSet.size > 0) {
      activeSet.forEach((v: any) => tempSelected.add(v));
    } else {
      uniqueItems.forEach(item => tempSelected.add(item.rawValue));
    }

    const popup = document.createElement('div');
    popup.className = 'jetbrains-filter-popup';

    const btnRect = targetBtn.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const top = btnRect.bottom - containerRect.top + container.scrollTop + 4;
    const left = Math.min(
      btnRect.left - containerRect.left + container.scrollLeft,
      containerRect.width - 280
    );

    popup.style.top = `${top}px`;
    popup.style.left = `${Math.max(8, left)}px`;

    let popupSearch = '';
    let filterDebounceTimer: any = null;

    const renderPopupContent = () => {
      const filteredItems = uniqueItems.filter(item =>
        item.label.toLowerCase().includes(popupSearch.toLowerCase())
      );

      const MAX_POPUP_ITEMS = 200;
      const displayedItems = filteredItems.slice(0, MAX_POPUP_ITEMS);
      const isTruncated = filteredItems.length > MAX_POPUP_ITEMS;

      popup.innerHTML = `
        <div class="jetbrains-filter-header">Filter: ${this.escapeHtml(column)}</div>
        <input type="text" class="jetbrains-filter-search" placeholder="Search values..." value="${this.escapeHtml(popupSearch)}">
        <div class="jetbrains-filter-actions-row">
          <span class="select-all-btn">Select All</span>
          <span class="clear-all-btn">Clear All</span>
        </div>
        ${isTruncated ? `<div style="font-size: 10px; color: #57606a; padding: 2px 4px; border-bottom: 1px solid #f0f0f0; background: #f6f8fa;">Showing top ${MAX_POPUP_ITEMS} of ${filteredItems.length} items.</div>` : ''}
        <div class="jetbrains-filter-list">
          ${displayedItems.length > 0 ? displayedItems.map((item, idx) => {
        const isChecked = tempSelected.has(item.rawValue) || (Array.from(tempSelected).some(v => String(v) === String(item.rawValue)));
        return `
              <label class="jetbrains-filter-item">
                <input type="checkbox" class="filter-item-checkbox" data-idx="${idx}" ${isChecked ? 'checked' : ''}>
                <span class="filter-val-text">${this.escapeHtml(item.label)}</span>
                <span class="jetbrains-filter-count">${item.count}</span>
              </label>
            `;
      }).join('') : '<div style="font-size: 11px; color: #8c959f; padding: 4px;">No values match</div>'}
        </div>
        <div class="jetbrains-filter-footer">
          <button class="filter-btn-clear" style="padding: 4px 8px; font-size: 11px; border: 1px solid #d0d7de; background: #f6f8fa; border-radius: 4px; cursor: pointer;">Clear</button>
          <button class="filter-btn-cancel" style="padding: 4px 8px; font-size: 11px; border: 1px solid #d0d7de; background: #f6f8fa; border-radius: 4px; cursor: pointer;">Cancel</button>
          <button class="filter-btn-apply" style="padding: 4px 10px; font-size: 11px; border: 1px solid #0969da; background: #0969da; color: #fff; border-radius: 4px; cursor: pointer; font-weight: 600;">OK</button>
        </div>
      `;

      const searchInput = popup.querySelector('.jetbrains-filter-search') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus({ preventScroll: true });
        searchInput.selectionStart = searchInput.selectionEnd = searchInput.value.length;

        searchInput.addEventListener('input', (e) => {
          const query = (e.target as HTMLInputElement).value;
          if (filterDebounceTimer) clearTimeout(filterDebounceTimer);
          filterDebounceTimer = setTimeout(() => {
            popupSearch = query;
            renderPopupContent();
          }, 200);
        });
      }

      const selectAllBtn = popup.querySelector('.select-all-btn');
      if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
          filteredItems.forEach(item => tempSelected.add(item.rawValue));
          renderPopupContent();
        });
      }

      const clearAllBtn = popup.querySelector('.clear-all-btn');
      if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
          filteredItems.forEach(item => tempSelected.delete(item.rawValue));
          renderPopupContent();
        });
      }

      const checkboxes = popup.querySelectorAll('.filter-item-checkbox');
      checkboxes.forEach((cb) => {
        cb.addEventListener('change', (e) => {
          const target = e.target as HTMLInputElement;
          const idx = parseInt(target.dataset.idx || '-1', 10);
          const found = displayedItems[idx];
          if (found) {
            if (target.checked) {
              tempSelected.add(found.rawValue);
            } else {
              tempSelected.delete(found.rawValue);
              // Also remove any stringified matching value
              Array.from(tempSelected).forEach(v => {
                if (String(v) === String(found.rawValue)) tempSelected.delete(v);
              });
            }
          }
        });
      });

      const btnClear = popup.querySelector('.filter-btn-clear');
      if (btnClear) {
        btnClear.addEventListener('click', () => {
          delete state.columnFilters[column];
          popup.remove();
          document.removeEventListener('click', onClickOutside);
          onApply();
        });
      }

      const btnCancel = popup.querySelector('.filter-btn-cancel');
      if (btnCancel) {
        btnCancel.addEventListener('click', () => {
          popup.remove();
          document.removeEventListener('click', onClickOutside);
        });
      }

      const btnApply = popup.querySelector('.filter-btn-apply');
      if (btnApply) {
        btnApply.addEventListener('click', () => {
          if (tempSelected.size === uniqueItems.length) {
            delete state.columnFilters[column];
          } else {
            state.columnFilters[column] = new Set(tempSelected);
          }
          popup.remove();
          document.removeEventListener('click', onClickOutside);
          onApply();
        });
      }
    };

    renderPopupContent();
    popup.addEventListener('click', (e) => e.stopPropagation());
    container.appendChild(popup);

    const onClickOutside = (e: MouseEvent) => {
      const path = e.composedPath ? e.composedPath() : [];
      if (path.includes(popup) || path.includes(targetBtn)) {
        return;
      }
      if (popup.contains(e.target as Node) || targetBtn.contains(e.target as Node)) {
        return;
      }
      popup.remove();
      document.removeEventListener('click', onClickOutside);
    };
    setTimeout(() => {
      document.addEventListener('click', onClickOutside);
    }, 10);
  }

  private formatCellValue(value: any, columnType: string): string {
    if (value === null || value === undefined) {
      return '<em class="null-value" style="color: #8c959f; font-style: italic;">NULL</em>';
    }

    switch (columnType) {
      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : String(value);
      case 'date':
        try {
          return new Date(value).toLocaleDateString();
        } catch {
          return String(value);
        }
      case 'boolean':
        return value ? '✓' : '✗';
      default:
        return this.escapeHtml(String(value));
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private exportToCSV(data: any[], columns: string[]): void {
    const csvContent = [
      columns.join(','),
      ...data.map(row =>
        columns.map(col => {
          const value = row[col];
          const strValue = value === null || value === undefined ? '' : String(value);
          if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
            return `"${strValue.replace(/"/g, '""')}"`;
          }
          return strValue;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'dataframe_export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private exportToExcel(data: any[], columns: string[], title?: string): void {
    const tableHTML = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Data</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        <style>
          table { border-collapse: collapse; width: 100%; font-family: sans-serif; font-size: 12px; }
          th { background-color: #f2f4f7; font-weight: bold; border: 1px solid #d0d7de; padding: 6px 10px; }
          td { border: 1px solid #d0d7de; padding: 6px 10px; }
        </style>
      </head>
      <body>
        <h3>${this.escapeHtml(title || 'Data Export')}</h3>
        <table>
          <thead>
            <tr>${columns.map(c => `<th>${this.escapeHtml(c)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${data.map(row => `
              <tr>${columns.map(c => `<td>${this.escapeHtml(row[c] ?? '')}</td>`).join('')}</tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([tableHTML], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'dataframe_export.xlsx');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private exportToPDF(data: any[], columns: string[], title?: string): void {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${this.escapeHtml(title || 'DataFrame Export')}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; color: #24292f; }
            h2 { margin: 0 0 6px 0; font-size: 18px; }
            p { margin: 0 0 16px 0; font-size: 12px; color: #57606a; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th, td { border: 1px solid #d0d7de; padding: 6px 10px; text-align: left; }
            th { background-color: #f6f8fa; font-weight: 600; }
            tr:nth-child(even) { background-color: #fcfcfc; }
          </style>
        </head>
        <body>
          <h2>${this.escapeHtml(title || 'DataFrame Export')}</h2>
          <p>Exported ${data.length} rows on ${new Date().toLocaleString()}</p>
          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                ${columns.map(c => `<th>${this.escapeHtml(c)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${data.map((row, idx) => `
                <tr>
                  <td style="text-align: center; color: #8c959f;">${idx + 1}</td>
                  ${columns.map(c => `<td>${this.escapeHtml(row[c] ?? '')}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
}

// Text component renderer
export class TextComponentRenderer extends BaseComponentRenderer {
  render(component: RichComponent): HTMLElement {
    const container = document.createElement('div');
    container.className = 'rich-component rich-text';
    container.dataset.componentId = component.id;

    const {
      content,
      markdown = false,
      code_language,
      font_size,
      font_weight,
      text_align
    } = component.data;

    // Apply text styling
    let textStyle = '';
    if (font_size) textStyle += `font-size: ${font_size}; `;
    if (font_weight) textStyle += `font-weight: ${font_weight}; `;
    if (text_align) textStyle += `text-align: ${text_align}; `;

    const isMarkdown = markdown || /^#|^\*|^\-|^\||```/.test((content || '').trim()) || (content || '').includes('\n|');

    if (code_language) {
      // Code block
      container.innerHTML = `
        <pre class="text-code" style="${textStyle}"><code class="language-${code_language}">${this.escapeHtml(content)}</code></pre>
      `;
    } else if (content.trim().startsWith('<')) {
      // HTML payload - render directly as DOM elements
      container.innerHTML = content;
    } else if (isMarkdown) {
      // Markdown text with support for tables, headers, formatting & lists
      container.innerHTML = `
        <div class="text-markdown" style="${textStyle}">${this.renderMarkdown(content)}</div>
      `;
    } else {
      // Plain text
      container.innerHTML = `
        <div class="text-content" style="${textStyle}">${this.escapeHtml(content)}</div>
      `;
    }


    // Attach click listeners to PMC suggestion chips if present
    const chips = container.querySelectorAll('.pmc-suggestion-chip') as NodeListOf<HTMLElement>;
    chips.forEach(chip => {
      chip.addEventListener('click', async () => {
        const query = chip.getAttribute('data-query');
        if (query) {
          const vannaChat = document.querySelector('vanna-chat') as any;
          if (vannaChat && typeof vannaChat.sendMessage === 'function') {
            await vannaChat.sendMessage(query);
          }
        }
      });
    });

    return container;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private renderMarkdown(text: string): string {
    if (!text) return '';
    let str = text.replace(/\r\n/g, '\n');

    // Fix blank lines between markdown table rows
    while (/(^\|[^\n]+\|\s*\n)\s*\n+(?=\|[^\n]+\|)/m.test(str)) {
      str = str.replace(/(^\|[^\n]+\|\s*\n)\s*\n+(?=\|[^\n]+\|)/gm, '$1');
    }

    const formatInline = (s: string): string => {
      return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code style="font-family: monospace; background: rgba(0,0,0,0.06); padding: 2px 6px; border-radius: 4px; font-size: 13px; color: #0d8a6a;">$1</code>');
    };

    // Parse Markdown Tables (GFM pipe tables)
    const tableRegex = /((?:(?:^|\n)\|[^\n]+\|)+)/g;
    str = str.replace(tableRegex, (match) => {
      const lines = match.trim().split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) return match;

      let html = '<div class="table-wrapper"><table class="markdown-table">';
      let inBody = false;

      lines.forEach((line, index) => {
        if (/^\|[\s\-:|]+\|$/.test(line)) {
          if (index === 1) {
            html += '</thead><tbody>';
            inBody = true;
          }
          return;
        }

        const cells = line.split('|').slice(1, -1).map(c => c.trim());
        if (index === 0 && !inBody) {
          html += '<thead><tr>';
          cells.forEach(c => { html += `<th>${formatInline(c)}</th>`; });
          html += '</tr>';
        } else {
          if (!inBody) {
            html += '<tbody>';
            inBody = true;
          }
          html += '<tr>';
          cells.forEach(c => { html += `<td>${formatInline(c)}</td>`; });
          html += '</tr>';
        }
      });

      if (inBody) html += '</tbody>';
      html += '</table></div>';
      return '\n\n' + html + '\n\n';
    });

    // Parse Horizontal Rules (---, ***, ___)
    str = str.replace(/^[\-\*_]{3,}\s*$/gm, '<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />');

    // Parse Headers
    str = str
      .replace(/^#### (.*$)/gm, '<h4 style="margin: 10px 0 6px 0; font-size: 1.05em; font-weight: 600; color: #1e293b;">$1</h4>')
      .replace(/^### (.*$)/gm, '<h3 style="margin: 12px 0 8px 0; font-size: 1.15em; font-weight: 600; color: #1e293b;">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 style="margin: 16px 0 10px 0; font-size: 1.25em; font-weight: 600; color: #1e293b;">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 style="margin: 20px 0 12px 0; font-size: 1.4em; font-weight: 700; color: #0f172a;">$1</h1>');

    // Parse Inline Formatting
    str = str
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Parse Lists
    str = str
      .replace(/^[•\-]\s+(.*$)/gm, '<li style="margin-bottom: 4px;">$1</li>')
      .replace(/((?:<li[^>]*>.*?<\/li>\s*)+)/gs, '<ul style="margin: 8px 0; padding-left: 20px; list-style-type: disc;">$1</ul>');

    // Parse Paragraphs & Linebreaks
    const parts = str.split(/\n\n+/);
    return parts.map(part => {
      const trimmed = part.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<hr') || trimmed.startsWith('<div class="table-wrapper">')) return trimmed;
      return `<p style="margin: 0 0 8px 0; line-height: 1.6; color: #334155;">${trimmed.replace(/\n/g, '<br/>')}</p>`;
    }).filter(Boolean).join('');
  }
}

// Primitive Component Renderers (Domain-Agnostic)

// Status card component renderer
export class StatusCardComponentRenderer extends BaseComponentRenderer {
  render(component: RichComponent): HTMLElement {
    const container = document.createElement('div');
    container.className = 'rich-component rich-status-card';
    container.dataset.componentId = component.id;

    const { title, status, description, icon, actions = [], collapsible, collapsed, metadata = {} } = component.data;

    const statusIcon = icon || this.getStatusIcon(status);
    const hasMetadata = Object.keys(metadata).length > 0;

    const isTimingCard = title && (title.includes('Timing') || title.includes('Latency'));

    container.innerHTML = `
      <div class="status-card-header ${collapsible ? 'collapsible' : ''}">
        <div class="status-card-icon">${statusIcon}</div>
        <div class="status-card-title-section">
          <h3 class="status-card-title">${title}</h3>
          <span class="status-card-badge status-${status}">${status}</span>
        </div>
        ${collapsible ? `<button class="status-card-toggle">${collapsed ? '▶' : '▼'}</button>` : ''}
      </div>
      ${description ? `
        <div class="status-card-content ${collapsed ? 'collapsed' : ''}">
          ${description}
        </div>
      ` : ''}
      ${hasMetadata ? `
        <details class="status-card-metadata" ${isTimingCard ? 'open' : ''}>
          <summary class="status-card-metadata-summary">${isTimingCard ? '⏱️ Phase Metrics Breakdown' : 'Parameters'}</summary>
          <div class="status-card-metadata-content">
            ${this.renderMetadataTable(metadata, title)}
          </div>
        </details>
      ` : ''}
      ${actions.length > 0 ? `
        <div class="status-card-actions">
          ${actions.map((action: any) => `
            <button class="status-card-action ${action.variant || 'secondary'}" data-action="${action.action}">
              ${action.label}
            </button>
          `).join('')}
        </div>
      ` : ''}
    `;

    // Add collapsible functionality
    if (collapsible) {
      const toggle = container.querySelector('.status-card-toggle') as HTMLButtonElement;
      const content = container.querySelector('.status-card-content') as HTMLElement;

      toggle?.addEventListener('click', () => {
        if (content) {
          content.classList.toggle('collapsed');
          toggle.textContent = content.classList.contains('collapsed') ? '▶' : '▼';
        }
      });
    }

    return container;
  }

  private renderMetadataTable(metadata: Record<string, any>, title?: string): string {
    const isTiming = title && (title.includes('Timing') || title.includes('Latency'));

    const rows = Object.entries(metadata).map(([key, value]) => {
      const formattedValue = this.formatMetadataValue(value);
      let barHtml = '';

      if (typeof value === 'string') {
        const match = value.match(/\(([\d\.]+)%\)/);
        if (match) {
          const pct = parseFloat(match[1]);
          if (!isNaN(pct)) {
            let barColor = '#0969da'; // Default blue
            if (key.includes('LLM')) barColor = '#8a2be2'; // Purple for LLM
            else if (key.includes('Tool') || key.includes('SQL')) barColor = '#2ea44f'; // Green for SQL/Tool
            else if (key.includes('Schema') || key.includes('Prompt')) barColor = '#d97706'; // Amber for Prompt
            else if (key.includes('Context') || key.includes('Memory')) barColor = '#0284c7'; // Cyan for Context

            barHtml = `
              <div class="timing-bar-bg" style="margin-top: 4px; height: 6px; width: 100%; background: #e1e4e8; border-radius: 3px; overflow: hidden;">
                <div class="timing-bar-fill" style="height: 100%; width: ${Math.min(100, Math.max(2, pct))}%; background: ${barColor}; border-radius: 3px; transition: width 0.3s ease;"></div>
              </div>
            `;
          }
        }
      }

      const isTotalRow = isTiming && (key.includes('Total') || key.toLowerCase().includes('total response'));

      return `
        <tr style="${isTotalRow ? 'background-color: #f6f8fa; font-weight: 600;' : ''}">
          <td class="metadata-key" style="${isTotalRow ? 'font-weight: 700; color: #111;' : ''}">${this.escapeHtml(key)}</td>
          <td class="metadata-value" style="${isTotalRow ? 'font-weight: 700; color: #0969da;' : ''}">
            ${formattedValue}
            ${barHtml}
          </td>
        </tr>
      `;
    }).join('');

    return `
      <table class="metadata-table">
        <thead>
          <tr>
            <th>${isTiming ? 'Pipeline Phase' : 'Parameter'}</th>
            <th>${isTiming ? 'Duration (% Total)' : 'Value'}</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  private formatMetadataValue(value: any): string {
    if (value === null) {
      return '<span class="metadata-null">null</span>';
    }
    if (value === undefined) {
      return '<span class="metadata-undefined">undefined</span>';
    }
    if (typeof value === 'boolean') {
      return `<span class="metadata-boolean">${value}</span>`;
    }
    if (typeof value === 'number') {
      return `<span class="metadata-number">${value}</span>`;
    }
    if (typeof value === 'string') {
      return `<span class="metadata-string">${this.escapeHtml(value)}</span>`;
    }
    if (Array.isArray(value) || typeof value === 'object') {
      return `<pre class="metadata-json">${JSON.stringify(value, null, 2)}</pre>`;
    }
    return this.escapeHtml(String(value));
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'pending': return '⏳';
      case 'running': return '⚙️';
      case 'completed': return '✅';
      case 'success': return '✅';
      case 'failed': return '❌';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  }
}

// Progress display component renderer
export class ProgressDisplayComponentRenderer extends BaseComponentRenderer {
  render(component: RichComponent): HTMLElement {
    const container = document.createElement('div');
    container.className = 'rich-component rich-progress-display';
    container.dataset.componentId = component.id;

    const { label, value, description, status, show_percentage, animated, indeterminate } = component.data;
    const percentage = Math.round(value * 100);

    container.innerHTML = `
      <div class="progress-display-container">
        <div class="progress-display-header">
          <span class="progress-display-label">${label}</span>
          ${show_percentage && !indeterminate ? `<span class="progress-display-percentage">${percentage}%</span>` : ''}
        </div>
        <div class="progress-display-track">
          <div class="progress-display-fill ${animated ? 'animated' : ''} ${status ? `status-${status}` : ''} ${indeterminate ? 'indeterminate' : ''}"
               style="width: ${indeterminate ? '100' : percentage}%"></div>
        </div>
        ${description ? `<div class="progress-display-description">${description}</div>` : ''}
      </div>
    `;

    return container;
  }
}

// Log viewer component renderer
export class LogViewerComponentRenderer extends BaseComponentRenderer {
  render(component: RichComponent): HTMLElement {
    const container = document.createElement('div');
    container.className = 'rich-component rich-log-viewer';
    container.dataset.componentId = component.id;

    const { title, entries = [], searchable, show_timestamps, auto_scroll } = component.data;

    container.innerHTML = `
      <div class="log-viewer-container">
        <div class="log-viewer-header">
          <h3 class="log-viewer-title">${title}</h3>
          ${searchable ? `
            <div class="log-viewer-search">
              <input type="text" placeholder="Search logs..." class="log-search-input">
            </div>
          ` : ''}
        </div>
        <div class="log-viewer-content ${auto_scroll ? 'auto-scroll' : ''}">
          ${entries.map((entry: any) => `
            <div class="log-entry log-${entry.level}">
              ${show_timestamps ? `<span class="log-timestamp">${new Date(entry.timestamp).toLocaleTimeString()}</span>` : ''}
              <span class="log-level">[${entry.level.toUpperCase()}]</span>
              <span class="log-message">${entry.message}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Auto-scroll to bottom if enabled
    if (auto_scroll) {
      const content = container.querySelector('.log-viewer-content');
      if (content) {
        content.scrollTop = content.scrollHeight;
      }
    }

    return container;
  }
}

// Badge component renderer
export class BadgeComponentRenderer extends BaseComponentRenderer {
  render(component: RichComponent): HTMLElement {
    const container = document.createElement('span');
    container.className = `rich-component rich-badge badge-${component.data.variant} badge-${component.data.size}`;
    container.dataset.componentId = component.id;

    const { text, icon } = component.data;

    container.innerHTML = `
      ${icon ? `<span class="badge-icon">${icon}</span>` : ''}
      <span class="badge-text">${text}</span>
    `;

    return container;
  }
}

// Icon text component renderer
export class IconTextComponentRenderer extends BaseComponentRenderer {
  render(component: RichComponent): HTMLElement {
    const container = document.createElement('div');
    container.className = `rich-component rich-icon-text icon-text-${component.data.variant} icon-text-${component.data.size} icon-text-${component.data.alignment}`;
    container.dataset.componentId = component.id;

    const { icon, text } = component.data;

    container.innerHTML = `
      <span class="icon-text-icon">${icon}</span>
      <span class="icon-text-text">${text}</span>
    `;

    return container;
  }
}

// Button component renderer
export class ButtonComponentRenderer extends BaseComponentRenderer {
  render(component: RichComponent): HTMLElement {
    const button = document.createElement('button');
    button.className = `rich-component rich-button button-${component.data.variant} button-${component.data.size}`;
    button.dataset.componentId = component.id;

    const { label, action, disabled, icon, icon_position, full_width, loading } = component.data;

    if (disabled || loading) {
      button.disabled = true;
    }

    if (full_width) {
      button.classList.add('button-full-width');
    }

    if (loading) {
      button.classList.add('button-loading');
    }

    // Build button content
    let buttonContent = '';
    if (loading) {
      buttonContent = `<span class="button-spinner">⏳</span><span class="button-label">${label}</span>`;
    } else if (icon) {
      if (icon_position === 'right') {
        buttonContent = `<span class="button-label">${label}</span><span class="button-icon">${icon}</span>`;
      } else {
        buttonContent = `<span class="button-icon">${icon}</span><span class="button-label">${label}</span>`;
      }
    } else {
      buttonContent = `<span class="button-label">${label}</span>`;
    }

    button.innerHTML = buttonContent;

    // Add click handler
    if (action && !disabled && !loading) {
      button.addEventListener('click', async () => {
        console.log('🔘 Button clicked:', label);
        console.log('   Sending action:', action);

        // Apply visual feedback immediately
        button.disabled = true;
        button.classList.add('button-transitioning', 'button-clicked');

        // Find vanna-chat component and send message with button action
        const vannaChat = document.querySelector('vanna-chat') as any;
        console.log('   Found vanna-chat:', !!vannaChat);

        if (vannaChat && typeof vannaChat.sendMessage === 'function') {
          console.log('   Calling sendMessage...');
          try {
            const success = await vannaChat.sendMessage(action);
            if (success) {
              console.log('   ✓ Message sent successfully');
            } else {
              console.log('   ✗ Message failed, restoring button state');
              // Restore button state if it wasn't originally disabled
              if (!disabled) {
                button.disabled = false;
              }
              button.classList.remove('button-transitioning', 'button-clicked');
            }
          } catch (error) {
            console.error('   ✗ Message failed with error:', error);
            // Restore button state if it wasn't originally disabled
            if (!disabled) {
              button.disabled = false;
            }
            button.classList.remove('button-transitioning', 'button-clicked');
          }
        } else {
          console.error('   ✗ vanna-chat not found or sendMessage not available');
          // Restore button state if it wasn't originally disabled
          if (!disabled) {
            button.disabled = false;
          }
          button.classList.remove('button-transitioning', 'button-clicked');
        }
      });
    }

    return button;
  }

  update(element: HTMLElement, component: RichComponent, updates?: Record<string, any>): void {
    if (!updates) return super.update(element, component);

    const button = element as HTMLButtonElement;

    if (updates.disabled !== undefined) {
      button.disabled = updates.disabled;
    }

    if (updates.loading !== undefined) {
      button.disabled = updates.loading;
      if (updates.loading) {
        button.classList.add('button-loading');
      } else {
        button.classList.remove('button-loading');
      }
    }

    if (updates.label || updates.icon || updates.icon_position) {
      // Re-render content
      super.update(element, component);
    }
  }
}

// Button group component renderer
export class ButtonGroupComponentRenderer extends BaseComponentRenderer {
  render(component: RichComponent): HTMLElement {
    const container = document.createElement('div');
    container.className = `rich-component rich-button-group button-group-${component.data.orientation} button-group-spacing-${component.data.spacing} button-group-align-${component.data.align}`;
    container.dataset.componentId = component.id;

    const { buttons = [], full_width } = component.data;

    if (full_width) {
      container.classList.add('button-group-full-width');
    }

    // Render each button
    buttons.forEach((buttonConfig: any, index: number) => {
      const button = document.createElement('button');
      button.className = `rich-button button-${buttonConfig.variant || 'secondary'} button-${buttonConfig.size || 'medium'}`;
      button.dataset.buttonIndex = String(index);

      // Store original disabled state
      if (buttonConfig.disabled) {
        button.disabled = true;
        button.dataset.originallyDisabled = 'true';
      } else {
        button.dataset.originallyDisabled = 'false';
      }

      // Build button content
      let buttonContent = '';
      if (buttonConfig.icon) {
        if (buttonConfig.icon_position === 'right') {
          buttonContent = `<span class="button-label">${buttonConfig.label}</span><span class="button-icon">${buttonConfig.icon}</span>`;
        } else {
          buttonContent = `<span class="button-icon">${buttonConfig.icon}</span><span class="button-label">${buttonConfig.label}</span>`;
        }
      } else {
        buttonContent = `<span class="button-label">${buttonConfig.label}</span>`;
      }

      button.innerHTML = buttonContent;

      // Add click handler with enhanced functionality
      if (buttonConfig.action && !buttonConfig.disabled) {
        button.addEventListener('click', async () => {
          console.log('🔘 Button Group button clicked:', buttonConfig.label);
          console.log('   Button index:', index);
          console.log('   Sending action:', buttonConfig.action);

          // Immediately apply visual changes to all buttons in the group
          this.applyButtonGroupClickState(container, index);

          // Find vanna-chat component and send message with button action
          const vannaChat = document.querySelector('vanna-chat') as any;
          console.log('   Found vanna-chat:', !!vannaChat);

          if (vannaChat && typeof vannaChat.sendMessage === 'function') {
            console.log('   Calling sendMessage...');
            try {
              const success = await vannaChat.sendMessage(buttonConfig.action);
              if (success) {
                console.log('   ✓ Message sent successfully');
              } else {
                console.log('   ✗ Message failed, restoring button state');
                this.restoreButtonGroupState(container);
              }
            } catch (error) {
              console.error('   ✗ Message failed with error:', error);
              this.restoreButtonGroupState(container);
            }
          } else {
            console.error('   ✗ vanna-chat not found or sendMessage not available');
            this.restoreButtonGroupState(container);
          }
        });
      }

      container.appendChild(button);
    });

    return container;
  }

  private applyButtonGroupClickState(container: HTMLElement, clickedIndex: number): void {
    const buttons = container.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;

    buttons.forEach((button, index) => {
      // Disable all buttons
      button.disabled = true;

      // Add transition class for animation
      button.classList.add('button-transitioning');

      if (index === clickedIndex) {
        // Highlight the clicked button
        button.classList.add('button-clicked', 'button-highlighted');
      } else {
        // Gray out other buttons
        button.classList.add('button-grayed-out');
      }
    });
  }

  private restoreButtonGroupState(container: HTMLElement): void {
    const buttons = container.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;

    buttons.forEach((button) => {
      // Re-enable buttons (unless they were originally disabled)
      const originallyDisabled = button.dataset.originallyDisabled === 'true';
      if (!originallyDisabled) {
        button.disabled = false;
      }

      // Remove all state classes
      button.classList.remove(
        'button-clicked',
        'button-highlighted',
        'button-grayed-out',
        'button-transitioning'
      );
    });
  }
}

// Chart component renderer (for Plotly charts)
export class ChartComponentRenderer extends BaseComponentRenderer {
  render(component: RichComponent): HTMLElement {
    const container = document.createElement('div');
    container.className = 'rich-component rich-chart';
    container.setAttribute('style', 'display: flex; flex-direction: column; width: 100%; height: 500px; min-height: 500px;');
    container.dataset.componentId = component.id;

    const dataObj = component.data || {};
    let plotlyData = dataObj.data;
    let layout = dataObj.layout || {};
    const config = (component as any).config || dataObj.config || {};

    if (!plotlyData && Array.isArray(dataObj)) {
      plotlyData = dataObj;
    }

    console.log('ChartComponentRenderer: Received component:', component);
    console.log('ChartComponentRenderer: plotlyData:', plotlyData);
    console.log('ChartComponentRenderer: layout:', layout);

    // Check if we have a valid Plotly figure structure
    if (plotlyData && Array.isArray(plotlyData)) {
      // Create plotly-chart web component
      const chartElement = document.createElement('plotly-chart') as any;
      chartElement.setAttribute('style', 'display: flex; flex-direction: column; width: 100%; height: 100%; flex: 1; min-height: 460px;');

      // Set theme to match current theme
      const vannaChat = document.querySelector('vanna-chat');
      if (vannaChat) {
        chartElement.theme = vannaChat.getAttribute('theme') || 'light';
      } else {
        chartElement.theme = 'light';
      }

      // Append chart element directly to container (title is displayed inside the graph itself)
      container.appendChild(chartElement);

      // Set data AFTER the element is in the DOM
      // This ensures the web component is fully initialized
      requestAnimationFrame(() => {
        chartElement.data = plotlyData; // Plotly traces (array)
        chartElement.layout = { showlegend: true, ...layout }; // Plotly layout (object)
        chartElement.config = { displayModeBar: false, scrollZoom: true, responsive: true, ...config };

        console.log('ChartComponentRenderer: Set properties after DOM attachment');
      });
    } else {
      // Fallback for invalid chart data
      container.innerHTML = `
        <div class="chart-error">
          <p>Invalid chart data format</p>
          <pre>${JSON.stringify(component.data, null, 2).substring(0, 200)}...</pre>
        </div>
      `;
    }

    return container;
  }
}

// Artifact component renderer
export class ArtifactComponentRenderer extends BaseComponentRenderer {
  private defaultPrevented = false;

  render(component: RichComponent): HTMLElement {
    console.log('🔧 ArtifactComponentRenderer.render called with:', component);

    const container = document.createElement('div');
    container.className = 'rich-component rich-artifact';
    container.dataset.componentId = component.id;
    container.dataset.artifactId = component.data.artifact_id;

    const {
      content,
      artifact_type,
      title,
      description,
      editable,
      fullscreen_capable,
      external_renderable
    } = component.data;

    // Create artifact preview and controls
    container.innerHTML = `
      <div class="artifact-header">
        <div class="artifact-meta">
          <h3 class="artifact-title">${title || 'Artifact'}</h3>
          ${description ? `<p class="artifact-description">${description}</p>` : ''}
          <span class="artifact-type-badge">${artifact_type}</span>
        </div>
        <div class="artifact-controls">
          ${editable ? '<button class="artifact-btn edit-btn" title="Edit">✏️</button>' : ''}
          ${fullscreen_capable ? '<button class="artifact-btn fullscreen-btn" title="Fullscreen">⛶</button>' : ''}
          ${external_renderable ? '<button class="artifact-btn external-btn" title="Open External">🔗</button>' : ''}
        </div>
      </div>
      <div class="artifact-preview">
        <iframe class="artifact-iframe" sandbox="allow-scripts allow-same-origin" srcdoc="${this.escapeHtml(content)}"></iframe>
      </div>
    `;

    // Attach event listeners
    this.attachEventListeners(container, component);

    // Fire artifact-opened event for creation
    const shouldRenderInChat = this.fireArtifactOpenedEvent(component, 'created', container);

    // If default was prevented, show a placeholder instead
    if (!shouldRenderInChat) {
      container.innerHTML = `
        <div class="artifact-placeholder">
          <div class="placeholder-content">
            <span class="placeholder-icon">🎨</span>
            <div class="placeholder-text">
              <strong>${title || 'Artifact'}</strong> opened externally
              <div class="placeholder-type">${artifact_type}</div>
            </div>
            <button class="placeholder-reopen" title="Reopen">↗</button>
          </div>
        </div>
      `;

      // Add reopen functionality
      const reopenBtn = container.querySelector('.placeholder-reopen') as HTMLButtonElement;
      if (reopenBtn) {
        reopenBtn.addEventListener('click', () => {
          this.fireArtifactOpenedEvent(component, 'user-action', container);
        });
      }
    }

    return container;
  }

  private attachEventListeners(container: HTMLElement, component: RichComponent): void {
    // External button click
    const externalBtn = container.querySelector('.external-btn') as HTMLButtonElement;
    if (externalBtn) {
      externalBtn.addEventListener('click', () => {
        this.fireArtifactOpenedEvent(component, 'user-action', container);
      });
    }

    // Fullscreen button click
    const fullscreenBtn = container.querySelector('.fullscreen-btn') as HTMLButtonElement;
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => {
        this.openFullscreen(component);
      });
    }

    // Edit button click (placeholder for future implementation)
    const editBtn = container.querySelector('.edit-btn') as HTMLButtonElement;
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        this.openEditor(component);
      });
    }
  }

  private fireArtifactOpenedEvent(component: RichComponent, trigger: 'created' | 'user-action', container: HTMLElement): boolean {
    console.log('🎯 fireArtifactOpenedEvent called:', { trigger, artifactId: component.data.artifact_id });

    this.defaultPrevented = false;

    const eventDetail: ArtifactOpenedEventDetail = {
      artifactId: component.data.artifact_id,
      content: component.data.content,
      type: component.data.artifact_type,
      title: component.data.title,
      description: component.data.description,
      trigger,
      preventDefault: () => {
        console.log('🛑 preventDefault called!');
        this.defaultPrevented = true;
      },
      getStandaloneHTML: () => this.generateStandaloneHTML(component),
      timestamp: new Date().toISOString()
    };

    const event = new CustomEvent('artifact-opened', {
      detail: eventDetail,
      bubbles: true,
      cancelable: true
    });

    console.log('📡 Dispatching artifact-opened event:', event);

    // Fire the event from the container element (should bubble up to vanna-chat)
    container.dispatchEvent(event);

    // Also dispatch directly on the vanna-chat element as backup
    const vannaChat = container.closest('vanna-chat');
    if (vannaChat) {
      console.log('📡 Also dispatching on vanna-chat element');
      vannaChat.dispatchEvent(new CustomEvent('artifact-opened', {
        detail: eventDetail,
        bubbles: true,
        cancelable: true
      }));
    }

    console.log('📨 Event dispatched. defaultPrevented:', this.defaultPrevented);

    // Handle default behavior if not prevented and user triggered
    if (!this.defaultPrevented && trigger === 'user-action') {
      this.handleDefaultAction(component);
    }

    // Return whether we should render in chat (true if default not prevented)
    return !this.defaultPrevented;
  }

  private generateStandaloneHTML(component: RichComponent): string {
    const { content, title, dependencies = [] } = component.data;

    let dependenciesHTML = '';

    // Add common CDN links for dependencies
    if (dependencies.includes('d3')) {
      dependenciesHTML += '<script src="https://d3js.org/d3.v7.min.js"></script>\n';
    }
    if (dependencies.includes('plotly')) {
      dependenciesHTML += '<script src="https://cdn.plot.ly/plotly-latest.min.js"></script>\n';
    }
    if (dependencies.includes('three') || dependencies.includes('threejs')) {
      dependenciesHTML += '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n';
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title || 'Artifact'}</title>
    ${dependenciesHTML}
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .artifact-container {
            width: 100%;
            min-height: 100vh;
        }
    </style>
</head>
<body>
    <div class="artifact-container">
        ${content}
    </div>
</body>
</html>`;
  }

  private handleDefaultAction(component: RichComponent): void {
    // Default action: open in new window
    const newWindow = window.open('', '_blank', 'width=800,height=600');
    if (newWindow) {
      newWindow.document.write(this.generateStandaloneHTML(component));
      newWindow.document.close();
    }
  }

  private openFullscreen(component: RichComponent): void {
    // Create fullscreen overlay
    const overlay = document.createElement('div');
    overlay.className = 'artifact-fullscreen-overlay';
    overlay.innerHTML = `
      <div class="fullscreen-header">
        <h3>${component.data.title || 'Artifact'}</h3>
        <button class="close-fullscreen">✕</button>
      </div>
      <div class="fullscreen-content">
        <iframe class="fullscreen-iframe" sandbox="allow-scripts allow-same-origin" srcdoc="${this.escapeHtml(component.data.content)}"></iframe>
      </div>
    `;

    // Add styles
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: white;
      z-index: 10000;
      display: flex;
      flex-direction: column;
    `;

    const header = overlay.querySelector('.fullscreen-header') as HTMLElement;
    header.style.cssText = `
      padding: 16px;
      border-bottom: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    const content = overlay.querySelector('.fullscreen-content') as HTMLElement;
    content.style.cssText = `
      flex: 1;
      padding: 16px;
    `;

    const iframe = overlay.querySelector('.fullscreen-iframe') as HTMLIFrameElement;
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
    `;

    // Close button functionality
    const closeBtn = overlay.querySelector('.close-fullscreen') as HTMLButtonElement;
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
    });

    // Escape key to close
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        document.body.removeChild(overlay);
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    document.body.appendChild(overlay);
  }

  private openEditor(component: RichComponent): void {
    // Placeholder for future editor implementation
    console.log('Editor functionality not yet implemented for artifact:', component.data.artifact_id);
  }

  private escapeHtml(html: string): string {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML.replace(/"/g, '&quot;');
  }
}

// User message component renderer
export class UserMessageComponentRenderer extends BaseComponentRenderer {
  render(component: RichComponent): HTMLElement {
    const messageEl = document.createElement('vanna-message');
    messageEl.setAttribute('theme', 'light');
    messageEl.dataset.componentId = component.id;

    (messageEl as any).content = component.data.content || '';
    (messageEl as any).type = 'user';
    (messageEl as any).timestamp = Date.parse(component.timestamp) || Date.now();

    return messageEl;
  }

  update(element: HTMLElement, component: RichComponent, updates?: Record<string, any>): void {
    const content = updates?.content ?? component.data?.content;
    if (content !== undefined) {
      (element as any).content = content;
    }
  }
}

// Assistant message component renderer  
export class AssistantMessageComponentRenderer extends BaseComponentRenderer {
  render(component: RichComponent): HTMLElement {
    const messageEl = document.createElement('vanna-message');
    messageEl.setAttribute('theme', 'light');
    messageEl.dataset.componentId = component.id;

    (messageEl as any).content = component.data.content || '';
    (messageEl as any).type = 'assistant';
    (messageEl as any).timestamp = Date.parse(component.timestamp) || Date.now();

    return messageEl;
  }

  update(element: HTMLElement, component: RichComponent, updates?: Record<string, any>): void {
    const content = updates?.content ?? component.data?.content;
    if (content !== undefined) {
      (element as any).content = content;
    }
  }
}

// Component registry for managing all component types
export class ComponentRegistry {
  private renderers: Map<string, ComponentRenderer> = new Map();

  constructor() {
    // Register primitive component renderers (domain-agnostic)
    this.register('status_card', new StatusCardComponentRenderer());
    this.register('progress_display', new ProgressDisplayComponentRenderer());
    this.register('log_viewer', new LogViewerComponentRenderer());
    this.register('badge', new BadgeComponentRenderer());
    this.register('icon_text', new IconTextComponentRenderer());

    // Register existing component renderers
    this.register('card', new CardComponentRenderer());
    this.register('task_list', new TaskListComponentRenderer());
    this.register('progress_bar', new ProgressBarComponentRenderer());
    this.register('notification', new NotificationComponentRenderer());
    this.register('status_indicator', new StatusIndicatorComponentRenderer());
    this.register('text', new TextComponentRenderer());
    this.register('dataframe', new DataFrameComponentRenderer());
    this.register('chart', new ChartComponentRenderer());

    // Register interactive component renderers
    this.register('button', new ButtonComponentRenderer());
    this.register('button_group', new ButtonGroupComponentRenderer());

    // Register artifact component renderer
    this.register('artifact', new ArtifactComponentRenderer());

    // Register message component renderers
    this.register('user-message', new UserMessageComponentRenderer());
    this.register('assistant-message', new AssistantMessageComponentRenderer());
  }

  register(type: string, renderer: ComponentRenderer): void {
    this.renderers.set(type, renderer);
  }

  render(component: RichComponent): HTMLElement {
    // Check if this is a component that should use web components
    const webComponentTag = this.getWebComponentTag(component.type);
    if (webComponentTag) {
      return this.renderWebComponent(webComponentTag, component);
    }

    // Use the old renderer system for other components
    const renderer = this.renderers.get(component.type);
    if (!renderer) {
      return this.renderFallback(component);
    }
    return renderer.render(component);
  }

  private getWebComponentTag(type: string): string | null {
    const mapping: Record<string, string> = {
      'card': 'rich-card',
      'task_list': 'rich-task-list',
      'progress_bar': 'rich-progress-bar',
      // We'll add more mappings as we convert other components
    };
    return mapping[type] || null;
  }

  private renderWebComponent(tagName: string, component: RichComponent): HTMLElement {
    const element = document.createElement(tagName) as any;

    // Set properties based on component data
    Object.keys(component.data).forEach(key => {
      if (key === 'actions' && Array.isArray(component.data[key])) {
        element.actions = component.data[key];
      } else {
        element[key] = component.data[key];
      }
    });

    // Set theme to match the parent VannaChat theme
    element.setAttribute('theme', this.getCurrentTheme());


    return element;
  }

  private getCurrentTheme(): string {
    // Try to get theme from the parent VannaChat component
    const vannaChat = document.querySelector('vanna-chat');
    if (vannaChat) {
      return vannaChat.getAttribute('theme') || 'dark';
    }
    return 'dark';
  }


  update(element: HTMLElement, component: RichComponent, updates?: Record<string, any>): void {
    const renderer = this.renderers.get(component.type);
    if (renderer) {
      renderer.update(element, component, updates);
    }
  }

  remove(element: HTMLElement): void {
    element.remove();
  }

  private renderFallback(component: RichComponent): HTMLElement {
    const container = document.createElement('div');
    container.className = 'rich-component rich-fallback';
    container.dataset.componentId = component.id;

    container.innerHTML = `
      <div class="fallback-header">
        <strong>Unknown Component: ${component.type}</strong>
      </div>
      <pre class="fallback-data">${JSON.stringify(component.data, null, 2)}</pre>
    `;

    return container;
  }
}

// Component manager for handling component lifecycle
export class ComponentManager {
  private components: Map<string, RichComponent> = new Map();
  private elements: Map<string, HTMLElement> = new Map();
  private registry: ComponentRegistry = new ComponentRegistry();
  private container: HTMLElement;
  private currentTurnDevInfoContainer: HTMLElement | null = null;
  private currentTurnDevInfoContent: HTMLElement | null = null;

  private readonly sharedFields = new Set([
    'id',
    'type',
    'lifecycle',
    'layout',
    'theme',
    'children',
    'timestamp',
    'visible',
    'interactive',
  ]);

  constructor(container: HTMLElement) {
    this.container = container;
    ensureRichComponentStyles(this.container);
  }

  processUpdate(update: ComponentUpdate): void {
    // Handle UI state updates with special processing
    if (update.component && this.isUIStateUpdate(update.component)) {
      this.processUIStateUpdate(update.component);
      return;
    }

    switch (update.operation) {
      case 'create':
        this.createComponent(update);
        break;
      case 'update':
        this.updateComponent(update);
        break;
      case 'replace':
        this.replaceComponent(update);
        break;
      case 'remove':
        this.removeComponent(update);
        break;
    }
  }

  private isTechnicalComponent(component: RichComponent): boolean {
    // Only tool execution status cards (Executing run_sql) and raw log viewers are encapsulated in Developer Info
    return component.type === 'status_card' || component.type === 'log_viewer';
  }

  private getOrCreateDevInfoContainer(): { wrapper: HTMLElement; content: HTMLElement } {
    if (!this.currentTurnDevInfoContainer || !this.currentTurnDevInfoContent) {
      const wrapper = document.createElement('div');
      wrapper.className = 'dev-info-container';

      const btn = document.createElement('button');
      btn.className = 'dev-info-toggle-btn';
      btn.type = 'button';
      btn.setAttribute('aria-expanded', 'false');
      btn.innerHTML = `
        <span class="dev-info-icon">🛠️</span>
        <span class="dev-info-title">Developer Info</span>
        <span class="dev-info-badge">SQL & Execution Logs</span>
        <span class="dev-info-chevron">▼</span>
      `;

      const content = document.createElement('div');
      content.className = 'dev-info-content collapsed';

      btn.addEventListener('click', () => {
        const isCollapsed = content.classList.contains('collapsed');
        if (isCollapsed) {
          content.classList.remove('collapsed');
          btn.setAttribute('aria-expanded', 'true');
          btn.classList.add('expanded');
        } else {
          content.classList.add('collapsed');
          btn.setAttribute('aria-expanded', 'false');
          btn.classList.remove('expanded');
        }
      });

      wrapper.appendChild(btn);
      wrapper.appendChild(content);

      this.currentTurnDevInfoContainer = wrapper;
      this.currentTurnDevInfoContent = content;

      this.container.appendChild(wrapper);
    }
    return {
      wrapper: this.currentTurnDevInfoContainer,
      content: this.currentTurnDevInfoContent
    };
  }

  private createComponent(update: ComponentUpdate): void {
    if (!update.component) return;

    const component = this.normalizeComponent(update.component);

    // If a component with this ID already exists, replace it in-place
    if (this.components.has(component.id)) {
      this.replaceComponent({
        operation: 'replace',
        target_id: component.id,
        component: component,
        timestamp: update.timestamp
      });
      return;
    }

    const element = this.registry.render(component);
    this.components.set(component.id, component);
    this.elements.set(component.id, element);

    // Determine where to place the component
    this.positionComponent(component, element);
  }

  private updateComponent(update: ComponentUpdate): void {
    if (!update.component) return;

    const element = this.elements.get(update.target_id);
    if (element) {
      const component = this.normalizeComponent(update.component);
      this.registry.update(element, component, update.updates);
      this.components.set(update.target_id, component);
      this.triggerScroll();
    }
  }

  private replaceComponent(update: ComponentUpdate): void {
    if (!update.component) return;

    const oldElement = this.elements.get(update.target_id);
    if (oldElement) {
      const component = this.normalizeComponent(update.component);
      const newElement = this.registry.render(component);
      oldElement.parentNode?.replaceChild(newElement, oldElement);

      this.elements.set(component.id, newElement);
      this.components.set(component.id, component);

      // Clean up old references if ID changed
      if (update.target_id !== component.id) {
        this.elements.delete(update.target_id);
        this.components.delete(update.target_id);
      }
      this.triggerScroll();
    }
  }

  private removeComponent(update: ComponentUpdate): void {
    const element = this.elements.get(update.target_id);
    if (element) {
      element.remove();
      this.elements.delete(update.target_id);
      this.components.delete(update.target_id);
    }
  }

  private positionComponent(component: RichComponent, element: HTMLElement): void {
    if (component.type === 'user-message') {
      // Start of a new turn
      this.currentTurnDevInfoContainer = null;
      this.currentTurnDevInfoContent = null;
      this.container.appendChild(element);
    } else if (this.isTechnicalComponent(component)) {
      // Put technical component into Developer Info container
      const { content, wrapper } = this.getOrCreateDevInfoContainer();
      content.appendChild(element);

      // If this is a timing breakdown card, update header badge
      const data = component.data || {};
      const title = data.title || '';
      if (title.includes('Timing') || title.includes('Latency')) {
        const badge = wrapper.querySelector('.dev-info-badge');
        if (badge && data.metadata && data.metadata['Total Response Time']) {
          const totalTime = data.metadata['Total Response Time'];
          const totalTokens = data.metadata['Total Tokens Used'];
          const costUsd = data.metadata['Cost (USD)'];
          const costInr = data.metadata['Cost (INR)'];

          if (totalTokens && costUsd && costInr) {
            badge.textContent = `⏱️ ${totalTime} | 🪙 ${totalTokens} | 💵 ${costUsd} (${costInr})`;
          } else {
            badge.textContent = `⏱️ ${totalTime}`;
          }
        }
      }

      // Ensure wrapper stays at the bottom of the turn
      this.container.appendChild(wrapper);
    } else {
      // Primary user-facing component (assistant-message, chart, artifact, final answer)
      if (this.currentTurnDevInfoContainer && this.container.contains(this.currentTurnDevInfoContainer)) {
        this.container.insertBefore(element, this.currentTurnDevInfoContainer);
      } else {
        this.container.appendChild(element);
      }
    }

    // Trigger scroll to bottom in parent chat component
    this.triggerScroll();
  }

  private triggerScroll(): void {
    // Find parent vanna-chat component via shadow DOM or document query
    let vannaChat: any = this.container.closest('vanna-chat');
    if (!vannaChat) {
      const rootNode = this.container.getRootNode();
      if (rootNode && rootNode instanceof ShadowRoot) {
        vannaChat = (rootNode.host as HTMLElement).closest('vanna-chat') || rootNode.host;
      }
    }
    if (!vannaChat) {
      vannaChat = document.querySelector('vanna-chat');
    }

    if (vannaChat && typeof vannaChat.scrollToLastMessage === 'function') {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          vannaChat.scrollToLastMessage();
        });
      });
    }
  }

  clear(): void {
    this.components.clear();
    this.elements.clear();
    this.currentTurnDevInfoContainer = null;
    this.currentTurnDevInfoContent = null;
    this.container.innerHTML = '';
    ensureRichComponentStyles(this.container);
  }

  getComponent(id: string): RichComponent | undefined {
    return this.components.get(id);
  }

  getAllComponents(): RichComponent[] {
    return Array.from(this.components.values());
  }

  private normalizeComponent(component: RichComponent): RichComponent {
    const data = { ...(component.data ?? {}) };

    for (const [key, value] of Object.entries(component as Record<string, any>)) {
      if (this.sharedFields.has(key) || key === 'data') continue;
      data[key] = value;
    }

    if (component.data && Object.keys(component.data).length === Object.keys(data).length) {
      return component;
    }

    return {
      ...component,
      data,
    };
  }

  private isUIStateUpdate(component: RichComponent): boolean {
    return component.type === 'status_bar_update' ||
      component.type === 'task_tracker_update' ||
      component.type === 'chat_input_update';
  }

  private processUIStateUpdate(component: RichComponent): void {
    console.log('processUIStateUpdate called with type:', component.type, 'component:', component);

    switch (component.type) {
      case 'status_bar_update':
        this.updateStatusBar(component);
        break;
      case 'task_tracker_update':
        this.updateTaskTracker(component);
        break;
      case 'chat_input_update':
        this.updateChatInput(component);
        break;
    }
  }

  private updateStatusBar(component: RichComponent): void {
    // Find the status bar component - first try shadow DOM, then document
    let statusBar: HTMLElement | null = null;

    // Look for vanna-chat and search within its shadow root
    const vannaChat = document.querySelector('vanna-chat') as any;
    if (vannaChat && vannaChat.shadowRoot) {
      statusBar = vannaChat.shadowRoot.querySelector('vanna-status-bar') as HTMLElement | null;
    }

    // Fallback to document search
    if (!statusBar) {
      statusBar = document.querySelector('vanna-status-bar') as HTMLElement | null;
    }

    if (statusBar) {
      const { status, message, detail } = component.data || {};

      // Keep vannaChat status updated
      if (vannaChat) {
        vannaChat.status = status;
      }

      // Hide status bar when status is idle or response is complete
      if (status === 'idle' || message === 'Response complete' || message === 'Ready') {
        (statusBar as any).status = 'idle';
        (statusBar as any).message = '';
        (statusBar as any).detail = '';
      } else {
        (statusBar as any).status = status;
        (statusBar as any).message = message || '';
        (statusBar as any).detail = detail || '';
      }
    }
  }

  private updateTaskTracker(component: RichComponent): void {
    // Debug logging
    console.log('updateTaskTracker called with component:', component);
    console.log('component.data:', component.data);

    // Find the progress tracker component - first try shadow DOM, then document
    let progressTracker = null;

    // Look for vanna-chat and search within its shadow root
    const vannaChat = document.querySelector('vanna-chat') as any;
    if (vannaChat && vannaChat.shadowRoot) {
      progressTracker = vannaChat.shadowRoot.querySelector('vanna-progress-tracker');
    }

    // Fallback to document search
    if (!progressTracker) {
      progressTracker = document.querySelector('vanna-progress-tracker');
    }

    console.log('Found progressTracker:', progressTracker);
    if (!progressTracker) return;

    const { operation, task, task_id, status, detail } = component.data || {};
    console.log('Extracted data:', { operation, task, task_id, status, detail });

    switch (operation) {
      case 'add_task':
        console.log('Adding task:', task);
        if (task && progressTracker.addItem) {
          // Use the backend task ID instead of generating a new one
          const result = progressTracker.addItem(task.title || task.text, task.description || task.detail, task.id);
          console.log('addItem result:', result, 'using backend ID:', task.id);
        }
        break;
      case 'update_task':
        console.log('Updating task:', task_id, status, detail);
        if (task_id && progressTracker.updateItem) {
          progressTracker.updateItem(task_id, status, detail);
        }
        break;
      case 'remove_task':
        if (task_id && progressTracker.removeItem) {
          progressTracker.removeItem(task_id);
        }
        break;
      case 'clear_tasks':
        if (progressTracker.clear) {
          progressTracker.clear();
        }
        break;
    }
  }

  private updateChatInput(component: RichComponent): void {
    // Find the chat input element - first try shadow DOM, then document
    let chatInput = null;

    // Look for vanna-chat and search within its shadow root
    const vannaChat = document.querySelector('vanna-chat') as any;
    if (vannaChat && vannaChat.shadowRoot) {
      chatInput = vannaChat.shadowRoot.querySelector('textarea.message-input, input.message-input');
    }

    // Fallback to document search with multiple selectors
    if (!chatInput) {
      chatInput = document.querySelector('textarea[data-testid="message-input"], input[type="text"].message-input, .message-input input, .message-input textarea');
    }

    if (!chatInput) return;

    const { placeholder, disabled, value, focus } = component.data || {};

    if (placeholder !== undefined) {
      chatInput.placeholder = placeholder;
    }
    if (disabled !== undefined) {
      chatInput.disabled = disabled;
    }
    if (value !== undefined) {
      chatInput.value = value;
    }
    if (focus !== undefined) {
      if (focus) {
        chatInput.focus();
      } else {
        chatInput.blur();
      }
    }
  }
}
