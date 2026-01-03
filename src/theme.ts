/**
 * THEME
 * =====
 * CSS variable names and utilities for reading theme colors at runtime.
 * Use these for canvas/visualizer drawing to support theme switching.
 */

/** CSS variable names (without the -- prefix) */
export const ThemeVars = {
  // Backgrounds
  bgBase: 'bg-base',
  bgSurface: 'bg-surface',
  bgElevated: 'bg-elevated',
  bgHover: 'bg-hover',

  // Text
  textPrimary: 'text-primary',
  textSecondary: 'text-secondary',
  textMuted: 'text-muted',

  // Borders
  border: 'border',
  borderSubtle: 'border-subtle',

  // Accent
  accent: 'accent',
  accentHover: 'accent-hover',
  accentMuted: 'accent-muted',

  // Semantic
  success: 'success',
  error: 'error',
  warning: 'warning',
} as const;

export type ThemeVar = (typeof ThemeVars)[keyof typeof ThemeVars];

/**
 * Read a single CSS variable value from the current theme.
 */
export function getThemeColor(varName: ThemeVar): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${varName}`).trim();
}

/**
 * Read multiple CSS variables at once.
 * Useful for canvas drawing where you need several colors.
 */
export function getThemeColors<T extends readonly ThemeVar[]>(
  varNames: T
): { [K in T[number]]: string } {
  const style = getComputedStyle(document.documentElement);
  const result = {} as { [K in T[number]]: string };

  for (const name of varNames) {
    result[name as T[number]] = style.getPropertyValue(`--${name}`).trim();
  }

  return result;
}

/**
 * Common color sets for visualizers.
 */
export function getVisualizerColors() {
  return getThemeColors([
    ThemeVars.bgElevated,
    ThemeVars.bgSurface,
    ThemeVars.border,
    ThemeVars.borderSubtle,
    ThemeVars.textPrimary,
    ThemeVars.textSecondary,
    ThemeVars.textMuted,
    ThemeVars.accent,
  ] as const);
}
