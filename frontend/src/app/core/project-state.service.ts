import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { ProjectSummary } from './models';

@Injectable({ providedIn: 'root' })
export class ProjectStateService {
  private readonly api = inject(ApiService);

  readonly projects = signal<ProjectSummary[]>([]);
  readonly currentId = signal<string | null>(null);
  readonly loaded = signal(false);

  readonly current = computed<ProjectSummary | null>(() => {
    const id = this.currentId();
    return this.projects().find((p) => p.id === id) ?? this.projects()[0] ?? null;
  });

  load(): void {
    this.api.listProjects().subscribe((list) => {
      this.projects.set(list);
      if (!this.currentId()) {
        const primary = list.find((p) => p.code === 'mosaic-web') ?? list[0];
        if (primary) this.currentId.set(primary.id);
      }
      this.loaded.set(true);
    });
  }

  select(id: string): void {
    this.currentId.set(id);
  }

  /** Invoke `cb` with the current project id as soon as one is available. */
  whenReady(cb: (projectId: string) => void): void {
    const id = this.current()?.id;
    if (id) {
      cb(id);
      return;
    }
    if (!this.loaded()) this.load();
    setTimeout(() => this.whenReady(cb), 80);
  }
}
