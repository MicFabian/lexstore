import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { ProjectSummary } from './models';

@Injectable({ providedIn: 'root' })
export class ProjectStateService {
  private readonly api = inject(ApiService);

  readonly projects = signal<ProjectSummary[]>([]);
  readonly currentId = signal<string | null>(null);
  readonly loaded = signal(false);
  private loading = false;

  readonly current = computed<ProjectSummary | null>(() => {
    const id = this.currentId();
    return this.projects().find((p) => p.id === id) ?? this.projects()[0] ?? null;
  });

  load(): void {
    if (this.loading) return; // single-flight
    this.loading = true;
    this.api.listProjects().subscribe({
      next: (list) => {
        this.projects.set(list);
        if (!this.currentId()) {
          const primary = list.find((p) => p.code === 'mosaic-web') ?? list[0];
          if (primary) this.currentId.set(primary.id);
        }
        this.loaded.set(true);
        this.loading = false;
      },
      error: () => {
        // Mark loaded so dependent screens stop polling; they'll show empty.
        this.loaded.set(true);
        this.loading = false;
      },
    });
  }

  select(id: string): void {
    this.currentId.set(id);
  }

  /** Invoke `cb` with the current project id as soon as one is available. */
  whenReady(cb: (projectId: string) => void, attempts = 0): void {
    const id = this.current()?.id;
    if (id) {
      cb(id);
      return;
    }
    if (!this.loaded() && !this.loading) this.load();
    // Give up after ~4s (loaded but no project = unauthorized or empty).
    if (this.loaded() || attempts > 50) return;
    setTimeout(() => this.whenReady(cb, attempts + 1), 80);
  }
}
