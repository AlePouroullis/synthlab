/**
 * STORE
 * =====
 * Simple observable store for two-way binding.
 * Subscribers are notified whenever the value changes.
 */

type Listener<T> = (value: T) => void;

export class Store<T> {
  private value: T;
  private listeners: Set<Listener<T>> = new Set();

  constructor(initial: T) {
    this.value = initial;
  }

  get(): T {
    return this.value;
  }

  set(value: T): void {
    this.value = value;
    this.listeners.forEach((fn) => fn(value));
  }

  subscribe(fn: Listener<T>): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
