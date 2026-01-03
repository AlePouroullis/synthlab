/**
 * MENU BAR (Preact)
 * =================
 * Desktop-style menu bar with dropdown menus.
 */

import { useEffect, useRef, useState } from 'preact/hooks';

export type MenuItem =
  | {
      label: string;
      shortcut?: string;
      action?: () => void;
      disabled?: boolean;
      separator?: false;
    }
  | {
      separator: true;
    };

export interface MenuDefinition {
  label: string;
  items: MenuItem[];
}

interface Props {
  menus: MenuDefinition[];
}

export function MenuBar({ menus }: Props) {
  const [openMenuLabel, setOpenMenuLabel] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenuLabel(null);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenMenuLabel(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const handleMenuButtonClick = (label: string, e: MouseEvent) => {
    e.stopPropagation();
    setOpenMenuLabel(openMenuLabel === label ? null : label);
  };

  const handleMenuButtonHover = (label: string) => {
    // Only switch if a menu is already open
    if (openMenuLabel && openMenuLabel !== label) {
      setOpenMenuLabel(label);
    }
  };

  const handleItemClick = (item: MenuItem, e: MouseEvent) => {
    e.stopPropagation();
    if (!('separator' in item && item.separator) && item.action && !item.disabled) {
      item.action();
      setOpenMenuLabel(null);
    }
  };

  return (
    <div class="menu-bar" ref={containerRef}>
      {menus.map((menu) => (
        <div class="menu-item" key={menu.label}>
          <button
            class={`menu-button ${openMenuLabel === menu.label ? 'active' : ''}`}
            onClick={(e) => handleMenuButtonClick(menu.label, e)}
            onMouseEnter={() => handleMenuButtonHover(menu.label)}
          >
            {menu.label}
          </button>
          <div class={`menu-dropdown ${openMenuLabel === menu.label ? 'open' : ''}`}>
            {menu.items.map((item, index) =>
              'separator' in item && item.separator ? (
                <div class="menu-separator" key={`sep-${index}`} />
              ) : (
                <button
                  class={`menu-entry ${item.disabled ? 'disabled' : ''}`}
                  disabled={item.disabled}
                  onClick={(e) => handleItemClick(item, e)}
                  key={item.label}
                >
                  <span class="menu-entry-label">{item.label}</span>
                  {item.shortcut && <span class="menu-entry-shortcut">{item.shortcut}</span>}
                </button>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
