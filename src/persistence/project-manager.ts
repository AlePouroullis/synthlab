/**
 * PROJECT MANAGER
 * ================
 * Named project storage using localStorage.
 */

import { ProjectState, CURRENT_VERSION, migrateProject } from './types';

const PROJECTS_KEY = 'synthlab-projects';
const CURRENT_PROJECT_KEY = 'synthlab-current-project';
const DEFAULT_PROJECT_NAME = 'Untitled';

export interface ProjectEntry {
  name: string;
  savedAt: string;
  state: ProjectState;
}

export interface ProjectIndex {
  [name: string]: ProjectEntry;
}

/**
 * Get all saved projects.
 */
export function getAllProjects(): ProjectIndex {
  try {
    const saved = localStorage.getItem(PROJECTS_KEY);
    if (!saved) return {};
    return JSON.parse(saved) as ProjectIndex;
  } catch (e) {
    console.warn('Failed to load projects:', e);
    return {};
  }
}

/**
 * Get list of project names sorted by most recently saved.
 */
export function getProjectNames(): string[] {
  const projects = getAllProjects();
  return Object.values(projects)
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
    .map((p) => p.name);
}

/**
 * Get the current project name.
 */
export function getCurrentProjectName(): string {
  return localStorage.getItem(CURRENT_PROJECT_KEY) || DEFAULT_PROJECT_NAME;
}

/**
 * Set the current project name.
 */
export function setCurrentProjectName(name: string): void {
  localStorage.setItem(CURRENT_PROJECT_KEY, name);
}

/**
 * Save a project by name.
 */
export function saveProject(name: string, state: ProjectState): void {
  try {
    const projects = getAllProjects();
    projects[name] = {
      name,
      savedAt: new Date().toISOString(),
      state,
    };
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    setCurrentProjectName(name);
  } catch (e) {
    console.warn('Failed to save project:', e);
  }
}

/**
 * Load a project by name.
 * Returns null if not found.
 */
export function loadProject(name: string): ProjectState | null {
  try {
    const projects = getAllProjects();
    const entry = projects[name];
    if (!entry) return null;
    setCurrentProjectName(name);
    return migrateProject(entry.state);
  } catch (e) {
    console.warn('Failed to load project:', e);
    return null;
  }
}

/**
 * Delete a project by name.
 */
export function deleteProject(name: string): void {
  try {
    const projects = getAllProjects();
    delete projects[name];
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));

    // If we deleted the current project, reset to Untitled
    if (getCurrentProjectName() === name) {
      setCurrentProjectName(DEFAULT_PROJECT_NAME);
    }
  } catch (e) {
    console.warn('Failed to delete project:', e);
  }
}

/**
 * Rename a project.
 */
export function renameProject(oldName: string, newName: string): boolean {
  if (oldName === newName) return true;

  try {
    const projects = getAllProjects();

    // Check if new name already exists
    if (projects[newName]) {
      return false;
    }

    const entry = projects[oldName];
    if (!entry) return false;

    // Create new entry with new name
    projects[newName] = {
      ...entry,
      name: newName,
      savedAt: new Date().toISOString(),
    };
    delete projects[oldName];

    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));

    // Update current project name if it was the renamed one
    if (getCurrentProjectName() === oldName) {
      setCurrentProjectName(newName);
    }

    return true;
  } catch (e) {
    console.warn('Failed to rename project:', e);
    return false;
  }
}

/**
 * Check if a project exists.
 */
export function projectExists(name: string): boolean {
  const projects = getAllProjects();
  return name in projects;
}

/**
 * Generate a unique project name.
 */
export function generateUniqueName(baseName: string = DEFAULT_PROJECT_NAME): string {
  const projects = getAllProjects();

  if (!(baseName in projects)) {
    return baseName;
  }

  let counter = 2;
  while (`${baseName} ${counter}` in projects) {
    counter++;
  }

  return `${baseName} ${counter}`;
}
