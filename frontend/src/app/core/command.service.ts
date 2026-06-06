import { Injectable, signal } from '@angular/core';

/** Shared open-state for the global command palette (⌘K and topbar search). */
@Injectable({ providedIn: 'root' })
export class CommandService {
  readonly open = signal(false);

  toggle(): void {
    this.open.update((o) => !o);
  }
  show(): void {
    this.open.set(true);
  }
  hide(): void {
    this.open.set(false);
  }
}
