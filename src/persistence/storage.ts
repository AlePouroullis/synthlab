/**
 * STORAGE
 * =======
 * localStorage auto-save and file export/import.
 */

import { ProjectState, migrateProject } from './types';

const STORAGE_KEY = 'synthlab-project';

/**
 * Save project state to localStorage.
 */
export function saveToLocalStorage(state: ProjectState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save project to localStorage:', e);
  }
}

/**
 * Load project state from localStorage.
 * Returns null if no saved state or if parsing fails.
 */
export function loadFromLocalStorage(): ProjectState | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;

    const state = JSON.parse(saved) as ProjectState;
    return migrateProject(state);
  } catch (e) {
    console.warn('Failed to load project from localStorage:', e);
    return null;
  }
}

/**
 * Clear saved project from localStorage.
 */
export function clearLocalStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Export project state to a downloadable JSON file.
 */
export function exportToFile(state: ProjectState, filename?: string): void {
  const name = filename ?? `synthlab-${formatDate(new Date())}.json`;
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * Import project state from a JSON file.
 * Returns a promise that resolves with the parsed state.
 */
export function importFromFile(): Promise<ProjectState> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        try {
          const state = JSON.parse(reader.result as string) as ProjectState;

          // Basic validation
          if (typeof state.version !== 'number' || !state.pattern) {
            reject(new Error('Invalid project file format'));
            return;
          }

          resolve(migrateProject(state));
        } catch (e) {
          reject(new Error('Failed to parse project file'));
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsText(file);
    };

    // Handle cancel (no file selected)
    input.oncancel = () => {
      reject(new Error('File selection cancelled'));
    };

    input.click();
  });
}

/**
 * Format date for filename: YYYY-MM-DD-HHmm
 */
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}-${h}${min}`;
}
