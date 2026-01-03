/**
 * TOOLTIP (Preact)
 * ================
 * Tooltip with styled keyboard shortcuts.
 * Shortcuts wrapped in [] become <kbd> elements.
 */

import { JSX } from 'preact';

interface Props {
  text: string;
}

export function Tooltip({ text }: Props): JSX.Element {
  // Parse text for shortcuts in [brackets]
  const parts = text.split(/(\[[^\]]+\])/g);

  const children = parts.map((part, i) => {
    if (part.startsWith('[') && part.endsWith(']')) {
      return <kbd key={i}>{part.slice(1, -1)}</kbd>;
    }
    return part || null;
  });

  return <span class="tooltip">{children}</span>;
}
