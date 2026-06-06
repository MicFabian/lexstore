import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { Icon, IconName } from '../shared/icon';
import { ProjectStateService } from '../core/project-state.service';
import { ToastService } from '../core/toast.service';
import { CommandService } from '../core/command.service';

interface Command {
  id: string;
  label: string;
  hint: string;
  icon: IconName;
  run: () => void;
}

@Component({
  selector: 'tl-command-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    @if (open()) {
      <div class="cmd-backdrop" (click)="close()"></div>
      <div class="cmd" role="dialog" aria-label="Command palette">
        <div class="cmd__input">
          <tl-icon name="Search" [size]="17" color="var(--tl-muted)" />
          <input
            #box
            autofocus
            [value]="query()"
            (input)="onInput($event)"
            (keydown)="onKey($event)"
            placeholder="Search projects, screens, actions…"
          />
          <span class="kbd">esc</span>
        </div>
        <div class="cmd__list">
          @for (c of results(); track c.id; let i = $index) {
            <button
              class="cmd__item"
              [class.active]="i === active()"
              (mouseenter)="active.set(i)"
              (click)="exec(c)"
            >
              <tl-icon [name]="c.icon" [size]="16" color="var(--tl-slate)" />
              <span class="cmd__label">{{ c.label }}</span>
              <span class="cmd__hint">{{ c.hint }}</span>
            </button>
          }
          @if (results().length === 0) {
            <div class="cmd__empty">No matches.</div>
          }
        </div>
      </div>
    }
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 200;
      pointer-events: none;
    }
    .cmd-backdrop {
      position: fixed;
      inset: 0;
      background: color-mix(in srgb, var(--tl-paper) 55%, transparent);
      backdrop-filter: blur(2px);
      pointer-events: auto;
    }
    .cmd {
      position: fixed;
      top: 14vh;
      left: 50%;
      transform: translateX(-50%);
      width: min(600px, calc(100vw - 32px));
      background: var(--tl-elev, var(--tl-card));
      border: 1px solid var(--tl-line);
      border-radius: var(--tl-r-xl);
      box-shadow: var(--tl-shadow-pop);
      overflow: hidden;
      pointer-events: auto;
      animation: cmdIn 0.16s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    @keyframes cmdIn {
      from { opacity: 0; transform: translate(-50%, -6px) scale(0.99); }
      to { opacity: 1; transform: translateX(-50%); }
    }
    @media (prefers-reduced-motion: reduce) {
      .cmd { animation: none; }
    }
    .cmd__input {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--tl-line);
    }
    .cmd__input input {
      flex: 1;
      border: none;
      background: none;
      outline: none;
      font-family: var(--tl-sans);
      font-size: 15px;
      color: var(--tl-ink);
    }
    .cmd__input input::placeholder {
      color: var(--tl-muted);
    }
    .cmd__list {
      max-height: 50vh;
      overflow-y: auto;
      padding: 6px;
    }
    .cmd__item {
      display: flex;
      align-items: center;
      gap: 11px;
      width: 100%;
      border: none;
      background: none;
      text-align: left;
      padding: 9px 11px;
      border-radius: var(--tl-r-sm);
      color: var(--tl-ink);
    }
    .cmd__item.active {
      background: var(--tl-accent-soft);
    }
    .cmd__label {
      font-size: 13.5px;
      font-weight: 500;
    }
    .cmd__hint {
      margin-left: auto;
      font-family: var(--tl-mono);
      font-size: 11px;
      color: var(--tl-muted);
    }
    .cmd__empty {
      padding: 24px;
      text-align: center;
      color: var(--tl-muted);
      font-size: 13px;
    }
  `,
})
export class CommandPalette {
  private readonly router = inject(Router);
  private readonly state = inject(ProjectStateService);
  private readonly toast = inject(ToastService);
  private readonly cmd = inject(CommandService);

  protected readonly open = this.cmd.open;
  protected readonly query = signal('');
  protected readonly active = signal(0);

  private readonly base = computed<Command[]>(() => {
    const nav: Command[] = [
      { id: 'go-editor', label: 'Go to Translations', hint: 'editor', icon: 'List', run: () => this.go('/editor') },
      { id: 'go-terms', label: 'Go to Terms', hint: 'terms', icon: 'FileText', run: () => this.go('/terms') },
      { id: 'go-langs', label: 'Go to Languages', hint: 'languages', icon: 'Languages', run: () => this.go('/languages') },
      { id: 'go-contrib', label: 'Go to Contributors', hint: 'contributors', icon: 'Users', run: () => this.go('/contributors') },
      { id: 'go-settings', label: 'Go to Settings', hint: 'settings', icon: 'Settings', run: () => this.go('/settings') },
      { id: 'go-ai', label: 'Open Translation AI', hint: 'ai', icon: 'WandSparkles', run: () => this.go('/ai') },
      { id: 'go-projects', label: 'All projects', hint: 'dashboard', icon: 'LayoutGrid', run: () => this.go('/projects') },
    ];
    const projects: Command[] = this.state.projects().map((p) => ({
      id: 'proj-' + p.id,
      label: `Switch to ${p.name}`,
      hint: p.code,
      icon: 'ArrowRightLeft' as IconName,
      run: () => {
        this.state.select(p.id);
        this.toast.show('Switched to ' + p.name);
        this.go('/editor');
      },
    }));
    return [...nav, ...projects];
  });

  protected readonly results = computed(() => {
    const q = this.query().toLowerCase().trim();
    if (!q) return this.base();
    return this.base().filter(
      (c) => c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q),
    );
  });

  toggle(): void {
    this.cmd.toggle();
    if (this.open()) {
      this.query.set('');
      this.active.set(0);
    }
  }

  protected close(): void {
    this.cmd.hide();
  }

  protected onInput(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
    this.active.set(0);
  }

  protected onKey(e: KeyboardEvent): void {
    const list = this.results();
    if (e.key === 'Escape') {
      this.close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.active.update((a) => Math.min(a + 1, list.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.active.update((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const c = list[this.active()];
      if (c) this.exec(c);
    }
  }

  protected exec(c: Command): void {
    this.close();
    c.run();
  }

  private go(path: string): void {
    this.router.navigate([path]);
  }
}
