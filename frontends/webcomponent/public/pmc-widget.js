/**
 * PMC AI Assistant - Floating Chatbot Widget Script
 * Allows any website to embed the PMC AI Chatbot as a floating icon widget.
 */
(function (window, document) {
  'use strict';

  const PMCWidget = {
    init: function (config = {}) {
      const apiHost = config.apiHost || window.location.origin;
      const title = config.title || 'PMC AI Assistant';
      const subtitle = config.subtitle || 'पुणे महानगरपालिका AI सहाय्यक';
      const position = config.position || 'bottom-right';
      const primaryColor = config.primaryColor || '#2563eb';
      const isRight = position.includes('right');

      // Prevent duplicate initialization
      if (document.getElementById('pmc-widget-container')) return;

      // 1. Inject Widget CSS
      const style = document.createElement('style');
      style.id = 'pmc-widget-styles';
      style.textContent = `
        #pmc-widget-container {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          z-index: 999999;
          position: fixed;
          bottom: 24px;
          ${isRight ? 'right: 24px;' : 'left: 24px;'}
          display: flex;
          flex-direction: column;
          align-items: ${isRight ? 'flex-end' : 'flex-start'};
          pointer-events: none;
        }

        #pmc-widget-container * {
          box-sizing: border-box;
          pointer-events: auto;
        }

        /* Floating Launcher Button */
        #pmc-widget-launcher {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, ${primaryColor} 0%, #1d4ed8 100%);
          color: #ffffff;
          border: none;
          box-shadow: 0 8px 24px rgba(37, 99, 235, 0.35), 0 2px 6px rgba(0, 0, 0, 0.1);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          position: relative;
          outline: none;
        }

        #pmc-widget-launcher:hover {
          transform: scale(1.08) translateY(-2px);
          box-shadow: 0 12px 30px rgba(37, 99, 235, 0.45);
        }

        #pmc-widget-launcher:active {
          transform: scale(0.95);
        }

        #pmc-widget-launcher svg {
          width: 28px;
          height: 28px;
          fill: currentColor;
          transition: transform 0.3s ease;
        }

        #pmc-widget-launcher.open #pmc-icon-chat {
          display: none;
        }

        #pmc-widget-launcher.open #pmc-icon-close {
          display: block;
        }

        #pmc-icon-close {
          display: none;
        }

        /* Pulse Badge Ring */
        .pmc-pulse-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 2px solid ${primaryColor};
          animation: pmcPulse 2.5s infinite;
          pointer-events: none;
          opacity: 0.6;
        }

        @keyframes pmcPulse {
          0% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.3); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }

        /* Floating Popup Window */
        #pmc-widget-window {
          width: 440px;
          height: 680px;
          max-width: calc(100vw - 32px);
          max-height: calc(100vh - 110px);
          background: #ffffff;
          border-radius: 20px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06);
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          opacity: 0;
          visibility: hidden;
          transform: translateY(20px) scale(0.95);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          transform-origin: ${isRight ? 'bottom right' : 'bottom left'};
        }

        #pmc-widget-window.open {
          opacity: 1;
          visibility: visible;
          transform: translateY(0) scale(1);
        }

        /* Widget Header Bar */
        .pmc-widget-header {
          background: linear-gradient(135deg, ${primaryColor} 0%, #1e40af 100%);
          color: #ffffff;
          padding: 14px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .pmc-widget-header-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .pmc-widget-avatar {
          width: 38px;
          height: 38px;
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(4px);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          border: 1px solid rgba(255, 255, 255, 0.3);
        }

        .pmc-widget-title-text h4 {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: -0.2px;
          color: #ffffff;
        }

        .pmc-widget-title-text p {
          margin: 2px 0 0 0;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.85);
          font-weight: 400;
        }

        .pmc-widget-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .pmc-widget-new-chat-btn {
          background: rgba(255, 255, 255, 0.18);
          border: 1px solid rgba(255, 255, 255, 0.35);
          color: #ffffff;
          padding: 5px 12px;
          border-radius: 20px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          height: 30px;
          transition: all 0.2s ease;
          outline: none;
        }

        .pmc-widget-new-chat-btn:hover {
          background: rgba(255, 255, 255, 0.35);
        }

        .pmc-widget-action-btn {
          background: rgba(255, 255, 255, 0.15);
          border: none;
          color: #ffffff;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }

        .pmc-widget-action-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        /* Widget Content Area */
        .pmc-widget-body {
          flex: 1;
          width: 100%;
          height: 100%;
          overflow: hidden;
          position: relative;
          background: #ffffff;
        }

        .pmc-widget-body vanna-chat {
          width: 100%;
          height: 100%;
          display: block;
        }

        /* Responsive Mobile adjustments */
        @media (max-width: 480px) {
          #pmc-widget-container {
            bottom: 16px;
            right: 16px;
            left: 16px;
            align-items: flex-end;
          }
          #pmc-widget-window {
            width: 100%;
            height: calc(100vh - 100px);
            max-width: 100%;
            border-radius: 16px;
          }
        }
      `;
      document.head.appendChild(style);

      // 2. Create Widget Markup
      const container = document.createElement('div');
      container.id = 'pmc-widget-container';

      container.innerHTML = `
        <div id="pmc-widget-window">
          <div class="pmc-widget-header">
            <div class="pmc-widget-header-info">
              <div class="pmc-widget-avatar">🏛️</div>
              <div class="pmc-widget-title-text">
                <h4>${title}</h4>
                <p>${subtitle}</p>
              </div>
            </div>
            <div class="pmc-widget-actions">
              <button class="pmc-widget-new-chat-btn" id="pmc-widget-new-chat-btn" title="Start New Chat">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                <span>New chat</span>
              </button>
              <button class="pmc-widget-action-btn" id="pmc-widget-close-btn" title="Close chat">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
          <div class="pmc-widget-body">
            <vanna-chat hide-header api-url="${apiHost}" api-base="${apiHost}" api-host="${apiHost}"></vanna-chat>
          </div>
        </div>

        <button id="pmc-widget-launcher" title="Chat with PMC AI Assistant">
          <div class="pmc-pulse-ring"></div>
          <svg id="pmc-icon-chat" viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/>
            <circle cx="8" cy="10" r="1.2"/>
            <circle cx="12" cy="10" r="1.2"/>
            <circle cx="16" cy="10" r="1.2"/>
          </svg>
          <svg id="pmc-icon-close" viewBox="0 0 24 24" style="width: 24px; height: 24px;">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      `;

      document.body.appendChild(container);

      // 3. Setup Toggle & New Chat Logic
      const launcher = document.getElementById('pmc-widget-launcher');
      const windowEl = document.getElementById('pmc-widget-window');
      const closeBtn = document.getElementById('pmc-widget-close-btn');
      const newChatBtn = document.getElementById('pmc-widget-new-chat-btn');

      function toggleChat() {
        const isOpen = windowEl.classList.contains('open');
        if (isOpen) {
          windowEl.classList.remove('open');
          launcher.classList.remove('open');
        } else {
          windowEl.classList.add('open');
          launcher.classList.add('open');
        }
      }

      launcher.addEventListener('click', toggleChat);
      closeBtn.addEventListener('click', toggleChat);

      if (newChatBtn) {
        newChatBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          const chatEl = container.querySelector('vanna-chat');
          if (chatEl && typeof chatEl.resetChat === 'function') {
            chatEl.resetChat();
          }
        });
      }
    }
  };

  window.PMCWidget = PMCWidget;
})(window, document);
