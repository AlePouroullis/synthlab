/**
 * TOOLTIP UTILITY
 * ================
 * Creates tooltips with styled keyboard shortcuts.
 */

/**
 * Create a tooltip element.
 * Shortcuts wrapped in [] become styled <kbd> elements.
 * Example: "Toggle with [M]" → "Toggle with <kbd>M</kbd>"
 */
export function createTooltip(text: string): HTMLSpanElement {
  const tooltip = document.createElement('span');
  tooltip.className = 'tooltip';

  // Parse text for shortcuts in [brackets]
  const parts = text.split(/(\[[^\]]+\])/g);

  for (const part of parts) {
    if (part.startsWith('[') && part.endsWith(']')) {
      // It's a shortcut - create kbd element
      const kbd = document.createElement('kbd');
      kbd.textContent = part.slice(1, -1); // Remove brackets
      tooltip.appendChild(kbd);
    } else if (part) {
      // Regular text
      tooltip.appendChild(document.createTextNode(part));
    }
  }

  return tooltip;
}
