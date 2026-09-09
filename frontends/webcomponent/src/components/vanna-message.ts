import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { vannaDesignTokens } from '../styles/vanna-design-tokens.js';

@customElement('vanna-message')
export class VannaMessage extends LitElement {
  static styles = [
    vannaDesignTokens,
    css`
      :host {
        display: block;
        margin-bottom: var(--vanna-space-4);
        font-family: var(--vanna-font-family-default);
        animation: fade-in-up 0.2s ease-out;
      }

      :host(:last-of-type) {
        margin-bottom: 0;
      }

      @keyframes fade-in-up {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .message-wrapper {
        display: flex;
        gap: 14px;
        width: 100%;
      }

      .message-wrapper.user {
        justify-content: flex-end;
      }

      .message-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        flex-shrink: 0;
      }

      .message-avatar.assistant {
        background: #10a37f;
        color: #ffffff;
      }

      .message {
        position: relative;
        padding: 12px 18px;
        border-radius: 18px;
        word-wrap: break-word;
        line-height: 1.6;
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 15px;
        color: #0d0d0d;
      }

      .message.assistant {
        background: transparent;
        border: none;
        padding: 4px 0;
        max-width: 100%;
      }

      .message.user {
        background: #f4f4f4;
        border: 1px solid rgba(0, 0, 0, 0.08);
        color: #0d0d0d;
        border-radius: 20px;
        max-width: min(85%, 600px);
      }

      .message-content {
        margin: 0;
        font-weight: 400;
      }

      .message-content p {
        margin: 0 0 8px 0;
      }

      .message-content p:last-child {
        margin-bottom: 0;
      }

      .message-content code {
        font-family: var(--vanna-font-family-mono);
        background: rgba(0, 0, 0, 0.06);
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 13px;
        color: #0d8a6a;
      }

      /* Markdown Table Styles */
      .table-wrapper {
        width: 100%;
        overflow-x: auto;
        margin: 12px 0;
        border-radius: 10px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      }

      .markdown-table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
        font-size: 14px;
        background: #ffffff;
      }

      .markdown-table th {
        background-color: #f8fafc;
        color: #334155;
        font-weight: 600;
        padding: 10px 14px;
        border-bottom: 2px solid #e2e8f0;
      }

      .markdown-table td {
        padding: 10px 14px;
        border-bottom: 1px solid #f1f5f9;
        color: #1e293b;
      }

      .markdown-table tr:last-child td {
        border-bottom: none;
      }

      .markdown-table tr:nth-child(even) {
        background-color: #f8fafc;
      }

      .message-timestamp {
        font-size: 11px;
        color: #8e8e8e;
        margin-top: 2px;
      }

      .message.user .message-timestamp {
        align-self: flex-end;
      }
    `
  ];

  @property() content = '';
  @property() type: 'user' | 'assistant' = 'user';
  @property({ type: Number }) timestamp = Date.now();
  @property({ reflect: true }) theme = 'light';

  private formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private renderMarkdown(text: string): string {
    if (!text) return '';
    let str = text.replace(/\r\n/g, '\n');

    // Fix blank lines between markdown table rows
    while (/(^\|[^\n]+\|\s*\n)\s*\n+(?=\|[^\n]+\|)/m.test(str)) {
      str = str.replace(/(^\|[^\n]+\|\s*\n)\s*\n+(?=\|[^\n]+\|)/gm, '$1');
    }

    function formatInline(s: string): string {
      return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
    }

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

    const blocks = str.split(/\n\n+/);
    const htmlBlocks = blocks.map(block => {
      block = block.trim();
      if (!block) return '';
      if (block.startsWith('<div class="table-wrapper">')) return block;
      if (block.startsWith('# ')) return `<h3>${formatInline(block.substring(2))}</h3>`;
      if (block.startsWith('## ')) return `<h4>${formatInline(block.substring(3))}</h4>`;
      if (block.startsWith('### ')) return `<h5>${formatInline(block.substring(4))}</h5>`;
      if (block.startsWith('- ') || block.startsWith('* ')) {
        const items = block.split('\n').map(item => `<li>${formatInline(item.replace(/^[-*]\s+/, ''))}</li>`).join('');
        return `<ul>${items}</ul>`;
      }
      return `<p>${formatInline(block).replace(/\n/g, '<br/>')}</p>`;
    });

    return htmlBlocks.filter(Boolean).join('');
  }

  render() {
    return html`
      <div class="message-wrapper ${this.type}">
        ${this.type === 'assistant' ? html`
          <div class="message-avatar assistant">🤖</div>
        ` : ''}
        <div class="message ${this.type}">
          <div class="message-content">
            ${this.type === 'assistant'
              ? unsafeHTML(this.renderMarkdown(this.content))
              : this.content}
          </div>
          <div class="message-timestamp">
            ${this.formatTimestamp(this.timestamp)}
          </div>
        </div>
      </div>
    `;
  }
}

