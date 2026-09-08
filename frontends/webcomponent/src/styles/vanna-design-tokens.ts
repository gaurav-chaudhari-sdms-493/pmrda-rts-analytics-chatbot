import { css } from 'lit';

// ChatGPT Light Theme UI Design Tokens
export const vannaDesignTokens = css`
  :host {
    /* Brand Colors - ChatGPT Light Aesthetic */
    --vanna-navy: #0d0d0d;
    --vanna-cream: #ffffff;
    --vanna-teal: #10a37f;
    --vanna-orange: #f97316;
    --vanna-magenta: #ec4899;

    /* Color Palette - ChatGPT Light Mode (Default) */
    --vanna-background-root: #ffffff;
    --vanna-background-default: #ffffff;
    --vanna-background-higher: #f9f9f9;
    --vanna-background-highest: #f4f4f4;
    --vanna-background-subtle: #fafafa;
    --vanna-background-lower: #f0f0f0;

    --vanna-foreground-default: #0d0d0d;
    --vanna-foreground-dimmer: #676767;
    --vanna-foreground-dimmest: #8e8e8e;

    --vanna-accent-primary-default: #10a37f;
    --vanna-accent-primary-stronger: #0d8a6a;
    --vanna-accent-primary-strongest: #0a6b52;
    --vanna-accent-primary-subtle: rgba(16, 163, 127, 0.1);
    --vanna-accent-primary-hover: #1abf95;

    --vanna-accent-positive-default: #10a37f;
    --vanna-accent-positive-stronger: #0d8a6a;
    --vanna-accent-positive-subtle: rgba(16, 163, 127, 0.1);

    --vanna-accent-negative-default: #ef4444;
    --vanna-accent-negative-stronger: #dc2626;
    --vanna-accent-negative-subtle: rgba(239, 68, 68, 0.1);

    --vanna-accent-warning-default: #f97316;
    --vanna-accent-warning-stronger: #ea580c;
    --vanna-accent-warning-subtle: rgba(249, 115, 22, 0.1);

    /* Outline/Border colors */
    --vanna-outline-default: rgba(0, 0, 0, 0.1);
    --vanna-outline-dimmer: rgba(0, 0, 0, 0.06);
    --vanna-outline-dimmest: rgba(0, 0, 0, 0.03);
    --vanna-outline-hover: rgba(0, 0, 0, 0.2);

    /* Typography */
    --vanna-font-family-default: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --vanna-font-family-serif: Georgia, serif;
    --vanna-font-family-mono: "Fira Code", "Space Mono", Monaco, Consolas, "Ubuntu Mono", monospace;

    /* Spacing scale */
    --vanna-space-0: 0px;
    --vanna-space-1: 4px;
    --vanna-space-2: 8px;
    --vanna-space-3: 12px;
    --vanna-space-4: 16px;
    --vanna-space-5: 20px;
    --vanna-space-6: 24px;
    --vanna-space-7: 28px;
    --vanna-space-8: 32px;
    --vanna-space-10: 40px;
    --vanna-space-12: 48px;
    --vanna-space-16: 64px;

    /* Border radius */
    --vanna-border-radius-sm: 6px;
    --vanna-border-radius-md: 12px;
    --vanna-border-radius-lg: 16px;
    --vanna-border-radius-xl: 24px;
    --vanna-border-radius-2xl: 32px;
    --vanna-border-radius-full: 9999px;

    /* Shadows - Light ChatGPT style */
    --vanna-shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    --vanna-shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.08);
    --vanna-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.08);
    --vanna-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.08);
    --vanna-shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.08);
    --vanna-shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.12);

    /* Animation durations */
    --vanna-duration-75: 75ms;
    --vanna-duration-100: 100ms;
    --vanna-duration-150: 150ms;
    --vanna-duration-200: 200ms;
    --vanna-duration-300: 300ms;
    --vanna-duration-500: 500ms;
    --vanna-duration-700: 700ms;

    /* Z-index scale */
    --vanna-z-dropdown: 1000;
    --vanna-z-sticky: 1020;
    --vanna-z-fixed: 1030;
    --vanna-z-modal: 1040;
    --vanna-z-popover: 1050;
    --vanna-z-tooltip: 1060;

    /* Chat-specific tokens */
    --vanna-chat-bubble-radius: 18px;
    --vanna-chat-bubble-radius-sm: 12px;
    --vanna-chat-spacing: 20px;
    --vanna-chat-avatar-size: 32px;
  }
`;
