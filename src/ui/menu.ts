/**
 * MENU BAR
 * ========
 * Desktop-style menu bar with dropdown menus.
 */

export type MenuItem =
  | {
      label: string;
      shortcut?: string; // e.g., "Cmd+S" or "Ctrl+O"
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

export class MenuBar {
  private container: HTMLDivElement;
  private activeMenu: HTMLDivElement | null = null;
  private activeButton: HTMLButtonElement | null = null;

  constructor(menus: MenuDefinition[]) {
    this.container = document.createElement('div');
    this.container.className = 'menu-bar';

    for (const menu of menus) {
      const menuItem = this.createMenu(menu);
      this.container.appendChild(menuItem);
    }

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target as Node)) {
        this.closeActiveMenu();
      }
    });

    // Close menu on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeActiveMenu();
      }
    });
  }

  getElement(): HTMLDivElement {
    return this.container;
  }

  private createMenu(menu: MenuDefinition): HTMLDivElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'menu-item';

    // Menu button
    const button = document.createElement('button');
    button.className = 'menu-button';
    button.textContent = menu.label;

    // Dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'menu-dropdown';

    for (const item of menu.items) {
      if ('separator' in item && item.separator) {
        const sep = document.createElement('div');
        sep.className = 'menu-separator';
        dropdown.appendChild(sep);
      } else if ('label' in item) {
        const menuEntry = document.createElement('button');
        menuEntry.className = 'menu-entry';
        if (item.disabled) {
          menuEntry.classList.add('disabled');
          menuEntry.disabled = true;
        }

        const labelSpan = document.createElement('span');
        labelSpan.className = 'menu-entry-label';
        labelSpan.textContent = item.label;
        menuEntry.appendChild(labelSpan);

        if (item.shortcut) {
          const shortcutSpan = document.createElement('span');
          shortcutSpan.className = 'menu-entry-shortcut';
          shortcutSpan.textContent = item.shortcut;
          menuEntry.appendChild(shortcutSpan);
        }

        menuEntry.onclick = (e) => {
          e.stopPropagation();
          if (item.action && !item.disabled) {
            item.action();
            this.closeActiveMenu();
          }
        };

        dropdown.appendChild(menuEntry);
      }
    }

    // Toggle dropdown on button click
    button.onclick = (e) => {
      e.stopPropagation();

      if (this.activeMenu === dropdown) {
        this.closeActiveMenu();
      } else {
        this.closeActiveMenu();
        dropdown.classList.add('open');
        button.classList.add('active');
        this.activeMenu = dropdown;
        this.activeButton = button;
      }
    };

    // Open on hover if another menu is already open
    button.onmouseenter = () => {
      if (this.activeMenu && this.activeMenu !== dropdown) {
        this.closeActiveMenu();
        dropdown.classList.add('open');
        button.classList.add('active');
        this.activeMenu = dropdown;
        this.activeButton = button;
      }
    };

    wrapper.appendChild(button);
    wrapper.appendChild(dropdown);

    return wrapper;
  }

  private closeActiveMenu(): void {
    if (this.activeMenu) {
      this.activeMenu.classList.remove('open');
      this.activeButton?.classList.remove('active');
      this.activeMenu = null;
      this.activeButton = null;
    }
  }
}
