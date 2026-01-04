/**
 * HEADER (Preact)
 * ===============
 * Top toolbar with title, menu bar, and toggle buttons.
 */

import { useState, useEffect, useCallback } from 'preact/hooks';
import { MenuBar, MenuDefinition } from './MenuBar';
import { Tooltip } from './Tooltip';
import styles from './Header.module.css';

const THEME_KEY = 'synthlab-theme';

interface Props {
  projectName: string;
  menus: MenuDefinition[];
  onChatToggle: () => void;
  chatVisible: boolean;
}

export function Header({ projectName, menus, onChatToggle, chatVisible }: Props) {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'dark' | 'light') || 'dark';
  });

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <header class={styles.header}>
      <div class={styles.headerLeft}>
        <h1 class={styles.title}>SynthLab — {projectName}</h1>
        <nav>
          <MenuBar menus={menus} />
        </nav>
      </div>
      <div class={styles.headerRight}>
        <span id="mcp-status" class={styles.mcpStatus}></span>

        <button
          id="theme-toggle"
          class={styles.iconBtn}
          aria-label="Toggle theme"
          onClick={toggleTheme}
        >
          <svg
            class={styles.iconSun}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
          <svg
            class={styles.iconMoon}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </button>

        <button
          id="chat-toggle"
          class={`${styles.chatToggle} ${chatVisible ? styles.chatToggleActive : ''}`}
          aria-label="Toggle chat panel"
          onClick={onChatToggle}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <Tooltip text="Toggle chat [⌘][/]" />
        </button>
      </div>
    </header>
  );
}
