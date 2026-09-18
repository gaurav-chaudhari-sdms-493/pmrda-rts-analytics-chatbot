import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { vannaDesignTokens } from '../styles/vanna-design-tokens.js';
import { VannaApiClient, ChatStreamChunk } from '../services/api-client.js';
import { ComponentManager, RichComponent } from './rich-component-system.js';
import './vanna-status-bar.js';
import './vanna-progress-tracker.js';
import './rich-card.js';
import './rich-task-list.js';
import './rich-progress-bar.js';
import './plotly-chart.js';

@customElement('vanna-chat')
export class VannaChat extends LitElement {
  static styles = [
    vannaDesignTokens,
    css`
      *, *::before, *::after {
        box-sizing: border-box;
      }

      :host {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100vh;
        background: #ffffff;
        color: #0d0d0d;
        font-family: var(--vanna-font-family-default);
        overflow: hidden;
        position: relative;
      }

      .chat-layout {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        flex: 1;
        background: #ffffff;
        overflow: hidden;
      }

      .chat-main {
        display: flex;
        flex-direction: column;
        flex: 1;
        height: 100%;
        background: #ffffff;
        min-height: 0;
        width: 100%;
        position: relative;
      }

      /* ChatGPT Light Header Bar */
      .chat-header {
        padding: 12px 20px;
        background: #ffffff;
        border-bottom: 1px solid #e5e5e5;
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 56px;
        color: #0d0d0d;
        z-index: 10;
        flex-shrink: 0;
      }

      .header-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .chat-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #10a37f;
        display: grid;
        place-items: center;
        font-weight: 700;
        font-size: 14px;
        color: #ffffff;
      }

      .chat-title {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        color: #0d0d0d;
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .model-badge {
        font-size: 11px;
        font-weight: 500;
        padding: 3px 10px;
        border-radius: 12px;
        background: #f4f4f4;
        color: #676767;
        border: 1px solid #e5e5e5;
      }

      .header-top-actions {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .new-chat-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        border-radius: 20px;
        border: 1px solid #e5e5e5;
        background: #ffffff;
        color: #0d0d0d;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      }

      .new-chat-btn:hover {
        background: #f4f4f4;
        border-color: #d1d1d1;
      }

      .new-chat-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Messages Viewport */
      .chat-messages {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 24px 16px 140px 16px;
        background: #ffffff;
        scroll-behavior: smooth;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      .chat-messages::-webkit-scrollbar {
        width: 6px;
      }

      .chat-messages::-webkit-scrollbar-track {
        background: transparent;
      }

      .chat-messages::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.15);
        border-radius: 999px;
      }

      .rich-components-container {
        max-width: min(95%, 1400px);
        width: 100%;
        margin: 0 auto;
        padding: 0 24px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        margin: auto;
        max-width: 800px;
        padding: 40px 20px;
        color: #0d0d0d;
      }

      .empty-state-icon {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: #10a37f;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        margin-bottom: 16px;
        color: #ffffff;
        box-shadow: 0 4px 14px rgba(16, 163, 127, 0.25);
      }

      .empty-state-text {
        font-size: 20px;
        font-weight: 600;
        color: #0d0d0d;
        margin-bottom: 8px;
      }

      .empty-state-subtitle {
        font-size: 14px;
        color: #676767;
        line-height: 1.5;
      }

      /* Floating Bottom Input Area */
      .chat-input-area {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(180deg, transparent 0%, #ffffff 40%);
        padding: 12px 16px 24px 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        pointer-events: none;
        z-index: 20;
      }

      .chat-input-area > * {
        pointer-events: auto;
      }

      .chat-input-wrapper {
        max-width: min(95%, 1200px);
        width: 100%;
        margin: 0 auto;
        padding: 0 24px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .chat-input-container {
        display: flex;
        align-items: flex-end;
        gap: 10px;
        padding: 10px 12px 10px 14px;
        border-radius: 26px;
        background: #ffffff;
        border: 1px solid #e5e5e5;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
      }

      .chat-input-container.generating {
        background: #fdfdfd;
        border-color: #d1d1d1;
      }

      .chat-input-container:focus-within {
        border-color: #b4b4b4;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
      }

      /* Always-on-screen Chatbot Avatar */
      .chat-input-bot-avatar {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        margin-right: 2px;
        align-self: center;
      }

      .bot-head-wrapper {
        position: relative;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 17px;
        color: #ffffff;
        box-shadow: 0 2px 8px rgba(16, 163, 127, 0.3);
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }

      /* Idle Breathing Animation */
      .chat-input-bot-avatar.idle .bot-head-wrapper {
        animation: botIdleBreathing 3s ease-in-out infinite;
      }

      @keyframes botIdleBreathing {
        0%, 100% {
          transform: scale(1);
          box-shadow: 0 2px 8px rgba(16, 163, 127, 0.3);
        }
        50% {
          transform: scale(1.05);
          box-shadow: 0 4px 14px rgba(16, 163, 127, 0.45);
        }
      }

      /* Thinking & Writing Animation (status === 'working') */
      .chat-input-bot-avatar.working .bot-head-wrapper {
        animation: botThinkingWriting 1.2s ease-in-out infinite;
        background: linear-gradient(135deg, #10a37f 0%, #047857 100%);
      }

      @keyframes botThinkingWriting {
        0%, 100% {
          transform: translateY(0) rotate(0deg);
        }
        25% {
          transform: translateY(-4px) rotate(-5deg);
        }
        75% {
          transform: translateY(-2px) rotate(5deg);
        }
      }

      .thinking-writing-head {
        position: absolute;
        top: -14px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 2px;
        pointer-events: none;
      }

      .thinking-dots {
        display: flex;
        gap: 2.5px;
      }

      .thinking-dots .dot {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: #10a37f;
        box-shadow: 0 0 6px rgba(16, 163, 127, 0.8);
        animation: dotBounce 1.2s ease-in-out infinite;
      }

      .thinking-dots .dot.d1 { animation-delay: 0s; }
      .thinking-dots .dot.d2 { animation-delay: 0.2s; }
      .thinking-dots .dot.d3 { animation-delay: 0.4s; }

      @keyframes dotBounce {
        0%, 80%, 100% {
          transform: translateY(0) scale(0.7);
          opacity: 0.4;
        }
        40% {
          transform: translateY(-7px) scale(1.3);
          opacity: 1;
        }
      }

      .writing-icon {
        font-size: 11px;
        animation: pencilScribble 0.6s ease-in-out infinite alternate;
        margin-left: 1px;
      }

      @keyframes pencilScribble {
        0% {
          transform: translateY(0) rotate(0deg);
        }
        100% {
          transform: translateY(-2px) rotate(-15deg);
        }
      }

      /* Task Completed Animation (status === 'success') */
      .chat-input-bot-avatar.success .bot-head-wrapper {
        animation: botCompletedCelebration 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        box-shadow: 0 0 16px rgba(16, 185, 129, 0.6);
      }

      @keyframes botCompletedCelebration {
        0% {
          transform: scale(0.8) rotate(-10deg);
        }
        50% {
          transform: scale(1.25) rotate(10deg);
        }
        100% {
          transform: scale(1) rotate(0deg);
        }
      }

      .completed-head {
        position: absolute;
        top: -6px;
        right: -6px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .success-badge {
        font-size: 12px;
        animation: badgePop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }

      .success-spark {
        position: absolute;
        top: -8px;
        left: -12px;
        font-size: 12px;
        animation: sparkFloat 0.8s ease-out forwards;
      }

      @keyframes sparkFloat {
        0% {
          transform: translateY(0) scale(0.5);
          opacity: 1;
        }
        100% {
          transform: translateY(-10px) scale(1.2);
          opacity: 0;
        }
      }

      /* Error State */
      .chat-input-bot-avatar.error .bot-head-wrapper {
        animation: errorShake 0.4s ease-in-out;
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      }

      .error-head {
        position: absolute;
        top: -6px;
        right: -6px;
        font-size: 12px;
      }

      @keyframes errorShake {
        0%, 100% { transform: translateX(0); }
        20%, 60% { transform: translateX(-4px); }
        40%, 80% { transform: translateX(4px); }
      }

      .message-input {
        flex: 1;
        border: none;
        background: transparent;
        font-size: 15px;
        font-family: inherit;
        line-height: 1.5;
        color: #0d0d0d;
        resize: none;
        min-height: 24px;
        max-height: 160px;
        padding: 4px 0;
        outline: none;
      }

      .message-input:disabled {
        color: #8e8e8e;
        cursor: not-allowed;
      }

      .message-input::placeholder {
        color: #8e8e8e;
      }

      .send-button {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: none;
        background: #0d0d0d;
        color: #ffffff;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        flex-shrink: 0;
      }

      .send-button:disabled {
        background: #e5e5e5;
        color: #8e8e8e;
        cursor: not-allowed;
        opacity: 0.7;
      }

      .send-button:not(:disabled):hover {
        background: #202123;
        transform: scale(1.05);
      }
    `
  ];

  @property() title = 'PMC AI Assistant';
  @property() placeholder = 'Ask PMC AI Assistant anything...';
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) showProgress = false;
  @property({ type: Boolean }) allowMinimize = false;
  @property({ reflect: true }) theme = 'light';
  @property({ attribute: 'api-base' }) apiBaseUrl = '';
  @property({ attribute: 'api-url' }) set apiUrl(val: string) { if (val) this.apiBaseUrl = val; }
  @property({ attribute: 'sse-endpoint' }) sseEndpoint = '/api/vanna/v2/chat_sse';
  @property({ attribute: 'ws-endpoint' }) wsEndpoint = '/api/vanna/v2/chat_websocket';
  @property({ attribute: 'poll-endpoint' }) pollEndpoint = '/api/vanna/v2/chat_poll';
  @property() subtitle = '';

  @state() private currentMessage = '';
  @state() private status: 'idle' | 'working' | 'error' | 'success' = 'idle';
  @state() private statusMessage = '';
  @state() private statusDetail = '';

  private apiClient!: VannaApiClient;
  private conversationId: string;
  private componentManager: ComponentManager | null = null;
  private componentObserver: MutationObserver | null = null;

  constructor() {
    super();
    this.conversationId = this.generateId();
  }

  private ensureApiClient() {
    let baseUrl = this.apiBaseUrl;
    if (typeof window !== 'undefined' && window.location) {
      const currentHost = window.location.hostname;
      if (!baseUrl || baseUrl === 'http://127.0.0.1:8000' || baseUrl === 'http://localhost:8000') {
        baseUrl = `${window.location.protocol}//${currentHost}:8000`;
      } else if (baseUrl.includes('127.0.0.1') || baseUrl.includes('localhost')) {
        if (currentHost !== '127.0.0.1' && currentHost !== 'localhost') {
          baseUrl = baseUrl.replace('127.0.0.1', currentHost).replace('localhost', currentHost);
        }
      }
    }
    this.apiClient = new VannaApiClient({
      baseUrl: baseUrl,
      sseEndpoint: this.sseEndpoint,
      wsEndpoint: this.wsEndpoint,
      pollEndpoint: this.pollEndpoint
    });
  }

  firstUpdated() {
    this.ensureApiClient();

    const richContainer = this.shadowRoot?.querySelector('.rich-components-container') as HTMLElement;
    if (richContainer) {
      this.componentManager = new ComponentManager(richContainer);
      this.componentObserver = new MutationObserver(() => {
        this.updateEmptyState();
        this.scrollToLastMessage();
      });
      
      this.componentObserver.observe(richContainer, {
        childList: true,
        subtree: false,
        characterData: false,
        attributes: false
      });
    }

    this.requestStarterUI();
  }

  private async requestStarterUI(): Promise<void> {
    try {
      const request = {
        message: "",
        conversation_id: this.conversationId,
        request_id: this.generateId(),
        metadata: {
          starter_ui_request: true
        }
      };
      await this.handleStreamingResponse(request);
    } catch (error) {
      console.error('Error requesting starter UI:', error);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.componentObserver) {
      this.componentObserver.disconnect();
      this.componentObserver = null;
    }
  }

  resetChat() {
    if (this.disabled) return;
    
    if (this.componentManager) {
      this.componentManager.clear();
    }
    this.clearStatus();
    this.currentMessage = '';
    this.conversationId = this.generateId();

    const input = this.shadowRoot?.querySelector('.message-input') as HTMLTextAreaElement;
    if (input) {
      input.value = '';
      input.style.height = 'auto';
    }
    this.updateEmptyState();
    this.requestStarterUI();
    this.requestUpdate();
  }

  private handleInput(e: Event) {
    const input = e.target as HTMLInputElement;
    this.currentMessage = input.value;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 160) + 'px';
  }

  private handleKeyPress(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!this.disabled && this.currentMessage.trim()) {
        this.sendMessage();
      }
    }
  }

  sendMessage(messageText?: string): Promise<boolean> {
    const textToSend = (typeof messageText === 'string') ? messageText : this.currentMessage;
    if (!textToSend.trim() || this.disabled) {
      return Promise.resolve(false);
    }
    return this._sendMessageInternal(textToSend);
  }

  private async _sendMessageInternal(messageText: string): Promise<boolean> {
    if (this.disabled) {
      return false;
    }

    // Lock input field and send button during generation
    this.disabled = true;

    const userRichComponent: RichComponent = {
      id: `user-message-${Date.now()}`,
      type: 'user-message',
      lifecycle: 'create',
      data: {
        content: messageText,
        sender: 'user'
      },
      children: [],
      timestamp: new Date().toISOString(),
      visible: true,
      interactive: false
    };

    if (this.componentManager) {
      const update = {
        operation: 'create' as const,
        target_id: userRichComponent.id,
        component: userRichComponent,
        timestamp: userRichComponent.timestamp
      };
      this.componentManager.processUpdate(update);
    }

    setTimeout(() => {
      this.updateEmptyState();
      this.scrollToLastMessage();
    }, 0);
    this.setStatus('working', 'Thinking...', '');

    if (messageText === this.currentMessage) {
      this.currentMessage = '';
      const input = this.shadowRoot?.querySelector('.message-input') as HTMLTextAreaElement;
      if (input) {
        input.value = '';
        input.style.height = 'auto';
      }
    }

    this.requestUpdate();

    this.dispatchEvent(new CustomEvent('message-sent', {
      detail: { message: { content: messageText, type: 'user' } },
      bubbles: true,
      composed: true
    }));

    try {
      const request = {
        message: messageText,
        conversation_id: this.conversationId,
        request_id: this.generateId(),
        metadata: {}
      };

      await this.handleStreamingResponse(request);
      
      // Trigger success status indicator on chatbot head
      this.setStatus('success', 'Response generated successfully', '');
      setTimeout(() => {
        if (this.status === 'success') {
          this.clearStatus();
        }
      }, 2500);

      return true;

    } catch (error) {
      console.error('Error sending message:', error);
      this.setStatus('error', 'Failed to generate response', error instanceof Error ? error.message : 'Unknown error');
      this.addMessage(
        `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'assistant'
      );
      return false;
    } finally {
      // Unlock input after response completes or fails
      this.disabled = false;
      this.requestUpdate();
    }
  }

  addMessage(content: string, type: 'user' | 'assistant') {
    const richComponent: RichComponent = {
      id: `${type}-message-${Date.now()}`,
      type: `${type}-message`,
      lifecycle: 'create',
      data: {
        content: content,
        sender: type
      },
      children: [],
      timestamp: new Date().toISOString(),
      visible: true,
      interactive: false
    };

    if (this.componentManager) {
      const update = {
        operation: 'create' as const,
        target_id: richComponent.id,
        component: richComponent,
        timestamp: richComponent.timestamp
      };
      this.componentManager.processUpdate(update);
    }
  }

  setStatus(status: typeof this.status, message: string, detail?: string) {
    this.status = status;
    this.statusMessage = message;
    this.statusDetail = detail || '';
    if (this.statusMessage || this.statusDetail) {
      console.log(`[Status: ${this.status}] ${this.statusMessage} ${this.statusDetail}`);
    }
  }

  clearStatus() {
    this.statusMessage = '';
    this.statusDetail = '';
    this.status = 'idle';
  }

  private async handleStreamingResponse(request: any) {
    if (!this.apiClient || this.apiClient.baseUrl !== this.apiBaseUrl) {
      this.ensureApiClient();
    }

    try {
      const stream = this.apiClient.streamChat(request);
      const chunks: ChatStreamChunk[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      for (const chunk of chunks) {
        await this.processChunk(chunk);
      }
    } catch (error) {
      console.warn('SSE streaming failed, falling back to polling:', error);
      try {
        this.setStatus('working', 'Connection issue, retrying...', 'Using fallback method');
        const response = await this.apiClient.sendPollMessage(request);
        for (const chunk of response.chunks) {
          await this.processChunk(chunk);
        }
      } catch (pollError) {
        this.setStatus('error', 'Connection failed', 'Unable to reach server');
        throw pollError;
      }
    }
  }

  private async processChunk(chunk: ChatStreamChunk) {
    this.dispatchEvent(new CustomEvent('chunk-received', {
      detail: { chunk },
      bubbles: true,
      composed: true
    }));

    if (chunk.rich && this.componentManager) {
      if (chunk.rich.id && chunk.rich.lifecycle) {
        const component = chunk.rich as RichComponent;
        const update = {
          operation: chunk.rich.lifecycle as any,
          target_id: chunk.rich.id,
          component: component,
          timestamp: new Date().toISOString()
        };
        this.componentManager.processUpdate(update);
      } else if (chunk.rich.type === 'component_update') {
        this.componentManager.processUpdate(chunk.rich as any);
      } else {
        const component = chunk.rich as RichComponent;
        const update = {
          operation: 'create' as const,
          target_id: component.id || `component-${Date.now()}`,
          component: component,
          timestamp: new Date().toISOString()
        };
        this.componentManager.processUpdate(update);
      }
    } else if (chunk.simple && this.componentManager) {
      const text = chunk.simple.content || chunk.simple.text || (typeof chunk.simple === 'string' ? chunk.simple : '');
      if (text) {
        this.addMessage(text, 'assistant');
      }
    }

    this.scrollToLastMessage();
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  updateApiBaseUrl(baseUrl: string) {
    this.apiBaseUrl = baseUrl;
    this.ensureApiClient();
  }

  getApiClient(): VannaApiClient {
    if (!this.apiClient) {
      this.ensureApiClient();
    }
    return this.apiClient;
  }

  setCustomHeaders(headers: Record<string, string>) {
    this.apiClient.setCustomHeaders(headers);
  }

  scrollToLastMessage(smooth: boolean = true) {
    const chatMessages = this.shadowRoot?.querySelector('.chat-messages') as HTMLElement;
    if (chatMessages) {
      requestAnimationFrame(() => {
        chatMessages.scrollTo({
          top: chatMessages.scrollHeight,
          behavior: smooth ? 'smooth' : 'auto'
        });
      });
    }
  }

  private updateEmptyState() {
    const emptyState = this.shadowRoot?.querySelector('#empty-state') as HTMLElement;
    const richContainer = this.shadowRoot?.querySelector('.rich-components-container') as HTMLElement;
    
    if (emptyState && richContainer) {
      const hasContent = richContainer.children.length > 0;
      emptyState.style.display = hasContent ? 'none' : 'flex';
    }
  }

  clearMessages() {
    if (this.componentManager) {
      this.componentManager.clear();
    }
    this.updateEmptyState();
    this.requestUpdate();
  }

  render() {
    return html`
      <div class="chat-layout">
        <div class="chat-main">
          <div class="chat-header">
            <div class="header-left">
              <div class="chat-avatar" aria-hidden="true">⚡</div>
              <h2 class="chat-title">
                ${this.title}
                <span class="model-badge">Llama 3.3 70B</span>
              </h2>
            </div>
            <div class="header-top-actions">
              <button
                class="new-chat-btn"
                @click=${this.resetChat}
                .disabled=${this.disabled}
                title="Start New Chat">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                <span>New chat</span>
              </button>
            </div>
          </div>

          <div class="chat-messages">
            <div class="empty-state" id="empty-state">
              <div class="empty-state-icon">⚡</div>
              <div class="empty-state-text">PMC AI Assistant</div>
              <div class="empty-state-subtitle">Ask any question about PMC complaints, ward status, categories, or trends.</div>
            </div>

            <div class="rich-components-container"></div>
          </div>

          <div class="chat-input-area">
            <div class="chat-input-wrapper">
              <div class="chat-input-container ${this.disabled ? 'generating' : ''}">
                <div class="chat-input-bot-avatar ${this.status}" title="${this.status}">
                  <div class="bot-head-wrapper">
                    <span class="bot-face">🤖</span>

                    ${this.status === 'working' ? html`
                      <div class="thinking-writing-head">
                        <div class="thinking-dots">
                          <span class="dot d1"></span>
                          <span class="dot d2"></span>
                          <span class="dot d3"></span>
                        </div>
                        <span class="writing-icon">✍️</span>
                      </div>
                    ` : ''}

                    ${this.status === 'success' ? html`
                      <div class="completed-head">
                        <span class="success-spark">✨</span>
                        <span class="success-badge">✅</span>
                      </div>
                    ` : ''}

                    ${this.status === 'error' ? html`
                      <div class="error-head">
                        <span class="error-badge">⚠️</span>
                      </div>
                    ` : ''}
                  </div>
                </div>

                <textarea
                  class="message-input"
                  .placeholder=${this.placeholder}
                  .disabled=${this.disabled}
                  @input=${this.handleInput}
                  @keydown=${this.handleKeyPress}
                  rows="1"
                ></textarea>
                <button
                  class="send-button"
                  type="button"
                  aria-label="Send message"
                  .disabled=${this.disabled || !this.currentMessage.trim()}
                  @click=${this.sendMessage}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M12 19V5M5 12l7-7 7 7"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
