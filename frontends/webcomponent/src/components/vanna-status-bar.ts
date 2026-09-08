import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { vannaDesignTokens } from '../styles/vanna-design-tokens.js';

@customElement('vanna-status-bar')
export class VannaStatusBar extends LitElement {
  static styles = [
    vannaDesignTokens,
    css`
      :host {
        display: block;
        background: #ffffff;
        border: 1px solid #e5e5e5;
        border-radius: 20px;
        padding: 8px 16px;
        margin-bottom: 8px;
        font-family: var(--vanna-font-family-default);
        font-size: 13px;
        font-weight: 500;
        color: #0d0d0d;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
        
        /* Animation properties */
        opacity: 1;
        transform: translateY(0) scale(1);
        max-height: 200px;
        overflow: hidden;
        transition: 
          opacity var(--vanna-duration-300) cubic-bezier(0.4, 0, 0.2, 1),
          transform var(--vanna-duration-300) cubic-bezier(0.4, 0, 0.2, 1),
          max-height var(--vanna-duration-300) ease,
          margin var(--vanna-duration-300) ease,
          padding var(--vanna-duration-300) ease;
      }

      /* Hide when there's no actual content */
      :host(.no-content) {
        opacity: 0;
        transform: translateY(-8px) scale(0.95);
        max-height: 0;
        margin: 0;
        padding: 0;
        border: none;
        pointer-events: none;
      }

      :host(:empty) {
        display: none;
      }

      .status-content {
        display: flex;
        align-items: center;
        gap: 12px;
        animation: contentFadeIn var(--vanna-duration-200) ease-out;
      }

      @keyframes contentFadeIn {
        0% {
          opacity: 0;
          transform: translateY(4px);
        }
        100% {
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* Chatbot Avatar & Head Animations */
      .chatbot-avatar {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .chatbot-head {
        position: relative;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #10a37f;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        color: #ffffff;
        box-shadow: 0 2px 8px rgba(16, 163, 127, 0.25);
        transition: transform 0.2s ease, background-color 0.2s ease;
      }

      :host([status="working"]) .chatbot-head {
        animation: headBob 1.5s ease-in-out infinite;
      }

      @keyframes headBob {
        0%, 100% {
          transform: translateY(0) scale(1);
        }
        50% {
          transform: translateY(-3px) scale(1.05);
        }
      }

      /* Thinking Animation on Top of Head */
      .thinking-head-animation {
        position: absolute;
        top: -12px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
        pointer-events: none;
      }

      .thinking-dot {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: #10a37f;
        box-shadow: 0 0 6px rgba(16, 163, 127, 0.6);
        animation: dotBounce 1.2s ease-in-out infinite;
      }

      .thinking-dot.d1 {
        animation-delay: 0s;
      }

      .thinking-dot.d2 {
        animation-delay: 0.2s;
      }

      .thinking-dot.d3 {
        animation-delay: 0.4s;
      }

      @keyframes dotBounce {
        0%, 80%, 100% {
          transform: translateY(0) scale(0.8);
          opacity: 0.4;
        }
        40% {
          transform: translateY(-6px) scale(1.3);
          opacity: 1;
        }
      }

      .head-glow-ring {
        position: absolute;
        top: -4px;
        width: 24px;
        height: 8px;
        border-radius: 50%;
        border: 1.5px solid rgba(16, 163, 127, 0.5);
        animation: ringPulse 1.5s infinite ease-out;
      }

      @keyframes ringPulse {
        0% {
          transform: scale(0.6);
          opacity: 1;
        }
        100% {
          transform: scale(1.6);
          opacity: 0;
        }
      }

      /* Success Icon Badge on Head */
      .success-head-badge {
        position: absolute;
        top: -3px;
        right: -3px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #10b981;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #ffffff;
        box-shadow: 0 2px 6px rgba(16, 185, 129, 0.4);
        animation: badgePop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }

      /* Error Icon Badge on Head */
      .error-head-badge {
        position: absolute;
        top: -3px;
        right: -3px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #ef4444;
        color: #ffffff;
        font-size: 10px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #ffffff;
        box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4);
        animation: badgePop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }

      @keyframes badgePop {
        0% {
          transform: scale(0);
          opacity: 0;
        }
        100% {
          transform: scale(1);
          opacity: 1;
        }
      }

      .status-text-container {
        display: flex;
        flex-direction: column;
        flex: 1;
      }

      .status-text {
        font-size: 13px;
        font-weight: 600;
        color: #0d0d0d;
        line-height: 1.4;
      }

      .status-detail {
        font-size: 12px;
        color: #676767;
        font-weight: 400;
      }
    `
  ];

  @property() status: 'idle' | 'working' | 'error' | 'success' = 'idle';
  @property() message = '';
  @property() detail = '';
  @property() theme = 'light';

  private _previousHasContent = false;
  private _enterTimeout: number | null = null;
  private _exitTimeout: number | null = null;
  private _lastUpdateTime = 0;

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._enterTimeout !== null) {
      clearTimeout(this._enterTimeout);
      this._enterTimeout = null;
    }
    if (this._exitTimeout !== null) {
      clearTimeout(this._exitTimeout);
      this._exitTimeout = null;
    }
  }

  updated(_changedProperties: Map<string | number | symbol, unknown>) {
    const hasContent = Boolean(this.message && this.message.trim());

    if (this._enterTimeout !== null) {
      clearTimeout(this._enterTimeout);
      this._enterTimeout = null;
    }
    if (this._exitTimeout !== null) {
      clearTimeout(this._exitTimeout);
      this._exitTimeout = null;
    }

    const now = Date.now();
    const timeSinceLastUpdate = now - this._lastUpdateTime;
    const shouldDebounce = timeSinceLastUpdate < 100;

    if (hasContent !== this._previousHasContent) {
      if (hasContent) {
        this.classList.remove('no-content', 'exiting');

        if (!shouldDebounce) {
          this.classList.add('entering');
          this._enterTimeout = window.setTimeout(() => {
            this.classList.remove('entering');
            this._enterTimeout = null;
          }, 300);
        }
      } else {
        this.classList.remove('entering');

        if (!shouldDebounce) {
          this.classList.add('exiting');
          this._exitTimeout = window.setTimeout(() => {
            this.classList.remove('exiting');
            this.classList.add('no-content');
            this._exitTimeout = null;
          }, 300);
        } else {
          this.classList.add('no-content');
        }
      }
    } else if (!hasContent) {
      this.classList.add('no-content');
    }

    this._previousHasContent = hasContent;
    this._lastUpdateTime = now;
  }

  render() {
    if (!this.message || !this.message.trim()) {
      return html``;
    }

    return html`
      <div class="status-content">
        <div class="chatbot-avatar ${this.status}">
          <div class="chatbot-head">
            <span class="bot-icon">🤖</span>

            ${this.status === 'working' ? html`
              <div class="thinking-head-animation">
                <span class="thinking-dot d1"></span>
                <span class="thinking-dot d2"></span>
                <span class="thinking-dot d3"></span>
                <div class="head-glow-ring"></div>
              </div>
            ` : ''}

            ${this.status === 'success' ? html`
              <div class="success-head-badge" title="Response generated successfully">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            ` : ''}

            ${this.status === 'error' ? html`
              <div class="error-head-badge" title="Generation error">!</div>
            ` : ''}
          </div>
        </div>

        <div class="status-text-container">
          <span class="status-text">${this.message}</span>
          ${this.detail ? html`<span class="status-detail">${this.detail}</span>` : ''}
        </div>
      </div>
    `;
  }
}