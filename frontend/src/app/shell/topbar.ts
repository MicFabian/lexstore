import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { Icon } from '../shared/icon';
import { Btn } from '../shared/primitives';
import { ToastService } from '../core/toast.service';
import { ProjectStateService } from '../core/project-state.service';
import { CommandService } from '../core/command.service';

const LABELS: Record<string, string> = {
  editor: 'Translations',
  terms: 'Terms',
  languages: 'Languages',
  contributors: 'Contributors',
  settings: 'Settings',
  projects: 'Projects',
  ai: 'Translation AI',
};

/** Screens that belong to the workspace, not the selected project. */
const WORKSPACE = new Set(['projects', 'ai']);

@Component({
  selector: 'tl-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Btn],
  template: `
    <header class="topbar">
      <div class="crumb">
        <span>{{ crumbRoot() }}</span>
        <tl-icon name="ChevronRight" [size]="14" color="var(--tl-line)" />
        <span class="crumb-active">{{ screenLabel() }}</span>
      </div>
      <div class="spacer"></div>

      <button class="cmdk" type="button" (click)="cmd.show()">
        <tl-icon name="Search" [size]="14" color="var(--tl-muted)" />
        <span>Search</span>
        <span class="cmdk__keys"><span class="kbd">⌘</span><span class="kbd">K</span></span>
      </button>

      <button class="btn btn--icon btn--subtle bell" type="button" aria-label="Notifications">
        <tl-icon name="Bell" [size]="17" color="var(--tl-slate)" />
        <span class="bell-dot"></span>
      </button>

      <tl-btn variant="primary" [sm]="true" icon="UserPlus" (clicked)="toast.show('Invite sent')">
        Invite
      </tl-btn>
    </header>
  `,
  styles: `
    .crumb-active {
      color: var(--tl-ink);
      font-weight: 600;
    }
    .bell {
      position: relative;
    }
    .bell-dot {
      position: absolute;
      top: 7px;
      right: 8px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--tl-st-untranslated);
    }
  `,
})
export class Topbar {
  protected readonly toast = inject(ToastService);
  protected readonly cmd = inject(CommandService);
  private readonly router = inject(Router);
  protected readonly project = inject(ProjectStateService).current;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  private readonly segment = computed(
    () => this.url().split('?')[0].split('/').filter(Boolean)[0] ?? 'editor',
  );
  protected readonly screenLabel = computed(() => LABELS[this.segment()] ?? 'Translations');
  protected readonly crumbRoot = computed(() =>
    WORKSPACE.has(this.segment()) ? 'Workspace' : (this.project()?.name ?? ''),
  );
}
