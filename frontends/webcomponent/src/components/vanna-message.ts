import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
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
        white-space: pre-wrap;
        font-weight: 400;
      }

      .message-content code {
        font-family: var(--vanna-font-family-mono);
        background: rgba(0, 0, 0, 0.06);
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 13px;
        color: #0d8a6a;
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

  render() {
    return html`
      <div class="message-wrapper ${this.type}">
        ${this.type === 'assistant' ? html`
          <div class="message-avatar assistant">🤖</div>
        ` : ''}
        <div class="message ${this.type}">
          <div class="message-content">${this.content}</div>
          <div class="message-timestamp">
            ${this.formatTimestamp(this.timestamp)}
          </div>
        </div>
      </div>
    `;
  }
}
