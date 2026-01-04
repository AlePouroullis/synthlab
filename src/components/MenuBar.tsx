/**
 * MENU BAR (Preact)
 * =================
 * Desktop-style menu bar with dropdown menus and submenus.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import styles from './Header.module.css';

export type MenuItem =
  | {
      label: string;
      shortcut?: string;
      action?: () => void;
      disabled?: boolean;
      separator?: false;
      submenu?: MenuItem[];
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
  const [openSubmenuLabel, setOpenSubmenuLabel] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenuLabel(null);
        setOpenSubmenuLabel(null);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenMenuLabel(null);
        setOpenSubmenuLabel(null);
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
    setOpenSubmenuLabel(null);
  };

  const handleMenuButtonHover = (label: string) => {
    if (openMenuLabel && openMenuLabel !== label) {
      setOpenMenuLabel(label);
      setOpenSubmenuLabel(null);
    }
  };

  const handleItemClick = (item: MenuItem, e: MouseEvent) => {
    e.stopPropagation();
    if (!('separator' in item && item.separator) && !item.submenu && item.action && !item.disabled) {
      item.action();
      setOpenMenuLabel(null);
      setOpenSubmenuLabel(null);
    }
  };

  const handleSubmenuHover = (label: string) => {
    setOpenSubmenuLabel(label);
  };

  const handleItemHover = (item: MenuItem) => {
    // Close submenu when hovering non-submenu items
    if (!('separator' in item && item.separator) && !item.submenu) {
      setOpenSubmenuLabel(null);
    }
  };

  const renderMenuItem = (item: MenuItem, index: number) => {
    if ('separator' in item && item.separator) {
      return <div class={styles.menuSeparator} key={`sep-${index}`} />;
    }

    const hasSubmenu = item.submenu && item.submenu.length > 0;

    return (
      <div
        class={styles.menuEntryWrapper}
        key={item.label}
        onMouseEnter={() => {
          if (hasSubmenu) {
            handleSubmenuHover(item.label);
          } else {
            handleItemHover(item);
          }
        }}
      >
        <button
          class={`${styles.menuEntry} ${item.disabled ? styles.menuEntryDisabled : ''}`}
          disabled={item.disabled && !hasSubmenu}
          onClick={(e) => handleItemClick(item, e)}
        >
          <span class={styles.menuEntryLabel}>{item.label}</span>
          {item.shortcut && <span class={styles.menuEntryShortcut}>{item.shortcut}</span>}
          {hasSubmenu && <span class={styles.menuEntryArrow}>›</span>}
        </button>
        {hasSubmenu && openSubmenuLabel === item.label && (
          <div class={`${styles.menuSubmenu} ${styles.menuSubmenuOpen}`}>
            {item.submenu!.map((subItem, subIndex) =>
              'separator' in subItem && subItem.separator ? (
                <div class={styles.menuSeparator} key={`sub-sep-${subIndex}`} />
              ) : (
                <button
                  class={`${styles.menuEntry} ${subItem.disabled ? styles.menuEntryDisabled : ''}`}
                  disabled={subItem.disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (subItem.action && !subItem.disabled) {
                      subItem.action();
                      setOpenMenuLabel(null);
                      setOpenSubmenuLabel(null);
                    }
                  }}
                  key={subItem.label}
                >
                  <span class={styles.menuEntryLabel}>{subItem.label}</span>
                  {subItem.shortcut && <span class={styles.menuEntryShortcut}>{subItem.shortcut}</span>}
                </button>
              )
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div class={styles.menuBar} ref={containerRef}>
      {menus.map((menu) => (
        <div class={styles.menuItem} key={menu.label}>
          <button
            class={`${styles.menuButton} ${openMenuLabel === menu.label ? styles.menuButtonActive : ''}`}
            onClick={(e) => handleMenuButtonClick(menu.label, e)}
            onMouseEnter={() => handleMenuButtonHover(menu.label)}
          >
            {menu.label}
          </button>
          <div class={`${styles.menuDropdown} ${openMenuLabel === menu.label ? styles.menuDropdownOpen : ''}`}>
            {menu.items.map((item, index) => renderMenuItem(item, index))}
          </div>
        </div>
      ))}
    </div>
  );
}
