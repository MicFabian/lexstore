import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { Icon } from '../../shared/icon';
import { Btn } from '../../shared/primitives';
import { ApiService } from '../../core/api.service';
import { ProjectStateService } from '../../core/project-state.service';
import { ToastService } from '../../core/toast.service';
import { PoeditorLanguage, PoeditorProject } from '../../core/models';

type Step = 'token' | 'project' | 'languages' | 'done';

/**
 * Import wizard for POEditor. The API token stays in this component and is sent
 * to our backend per request, which proxies POEditor; it is never persisted.
 */
@Component({
  selector: 'tl-poeditor-wizard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Btn],
  template: `
    <div class="card wiz">
      <div class="wiz__head">
        <span class="int-ico"><tl-icon name="Download" [size]="18" color="var(--tl-ink)" /></span>
        <div style="flex:1;min-width:0">
          <div class="wiz__title">Import from POEditor</div>
          <div class="wiz__sub">Pull terms and translations straight from a POEditor project.</div>
        </div>
        <span class="cap wiz__step">Step {{ stepIndex() }} of 3</span>
      </div>

      @switch (step()) {
        @case ('token') {
          <div class="wiz__body">
            <div class="field">
              <label for="poeditor-token">POEditor API token</label>
              <input
                id="poeditor-token"
                class="input"
                type="password"
                autocomplete="off"
                spellcheck="false"
                [value]="token()"
                (input)="token.set($any($event.target).value)"
                (keydown.enter)="loadProjects()"
                placeholder="Paste your API token"
              />
              <p class="wiz__hint">
                Found in POEditor under Account settings → API access. Used for this import only — TransLad never stores it.
              </p>
            </div>
            <tl-btn variant="primary" [sm]="true" [disabled]="!token() || busy()" (clicked)="loadProjects()">
              {{ busy() ? 'Connecting…' : 'Connect' }}
            </tl-btn>
          </div>
        }

        @case ('project') {
          <div class="wiz__body">
            <div class="eyebrow">Choose a POEditor project</div>
            <div class="wiz__list">
              @for (p of projects(); track p.id) {
                <button class="wiz__row" (click)="pickProject(p)">
                  <span class="wiz__row-name">{{ p.name }}</span>
                  <span class="wiz__row-meta">#{{ p.id }}</span>
                  <tl-icon name="ChevronRight" [size]="15" color="var(--tl-muted)" />
                </button>
              }
              @if (projects().length === 0) {
                <div class="wiz__hint">That account has no projects.</div>
              }
            </div>
            <tl-btn variant="subtle" [sm]="true" (clicked)="step.set('token')">Back</tl-btn>
          </div>
        }

        @case ('languages') {
          <div class="wiz__body">
            <div class="eyebrow">Languages to import into {{ target()?.name }}</div>
            <div class="wiz__list">
              @for (l of languages(); track l.code) {
                <label class="wiz__row wiz__row--check">
                  <input
                    type="checkbox"
                    [checked]="selected().has(l.code)"
                    (change)="toggle(l.code)"
                    [attr.aria-label]="l.name"
                  />
                  <span class="locale">{{ l.code }}</span>
                  <span class="wiz__row-name">{{ l.name }}</span>
                  <span class="wiz__row-meta">{{ l.translations }} translated · {{ l.percentage }}%</span>
                </label>
              }
            </div>
            <div class="row" style="gap:8px">
              <tl-btn variant="primary" [sm]="true" [disabled]="selected().size === 0 || busy()" (clicked)="runImport()">
                {{ busy() ? 'Importing…' : 'Import ' + selected().size + ' language' + (selected().size === 1 ? '' : 's') }}
              </tl-btn>
              <tl-btn variant="subtle" [sm]="true" (clicked)="step.set('project')">Back</tl-btn>
            </div>
          </div>
        }

        @case ('done') {
          <div class="wiz__body">
            <div class="wiz__done">
              <tl-icon name="CheckCheck" [size]="18" color="var(--tl-st-translated)" />
              <span>{{ summary() }}</span>
            </div>
            <tl-btn variant="subtle" [sm]="true" (clicked)="restart()">Import more</tl-btn>
          </div>
        }
      }
    </div>
  `,
  styles: `
    .wiz {
      padding: 0;
      overflow: hidden;
    }
    .wiz__head {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 18px;
      border-bottom: 1px solid var(--tl-line-2);
    }
    .wiz__title {
      font-weight: 700;
      font-size: 14px;
    }
    .wiz__sub {
      font-size: 12.5px;
      color: var(--tl-slate);
      margin-top: 2px;
    }
    .wiz__step {
      color: var(--tl-muted);
      white-space: nowrap;
    }
    .wiz__body {
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      align-items: flex-start;
    }
    .wiz__hint {
      font-size: 12px;
      color: var(--tl-slate);
      line-height: 1.5;
      margin: 6px 0 0;
    }
    .wiz__list {
      width: 100%;
      border-top: 1px solid var(--tl-line-2);
      max-height: 280px;
      overflow-y: auto;
    }
    .wiz__row {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 2px;
      border: none;
      border-bottom: 1px solid var(--tl-line-2);
      background: none;
      text-align: left;
      cursor: pointer;
      min-height: 44px;
    }
    .wiz__row:hover {
      background: var(--tl-row-hover);
    }
    .wiz__row-name {
      font-size: 13.5px;
      font-weight: 600;
      color: var(--tl-ink);
      flex: 1;
    }
    .wiz__row-meta {
      font-size: 12px;
      color: var(--tl-slate);
      font-variant-numeric: tabular-nums;
    }
    .wiz__done {
      display: flex;
      align-items: center;
      gap: 9px;
      font-size: 13.5px;
      color: var(--tl-ink);
    }
  `,
})
export class PoeditorWizard {
  private readonly api = inject(ApiService);
  private readonly state = inject(ProjectStateService);
  private readonly toast = inject(ToastService);

  /** Emitted after a successful import so the caller can refresh its data. */
  readonly imported = output<void>();

  protected readonly step = signal<Step>('token');
  protected readonly token = signal('');
  protected readonly busy = signal(false);
  protected readonly projects = signal<PoeditorProject[]>([]);
  protected readonly languages = signal<PoeditorLanguage[]>([]);
  protected readonly target = signal<PoeditorProject | null>(null);
  protected readonly selected = signal<Set<string>>(new Set());
  protected readonly summary = signal('');

  protected readonly stepIndex = computed(() => {
    switch (this.step()) {
      case 'token':
        return 1;
      case 'project':
        return 2;
      default:
        return 3;
    }
  });

  protected loadProjects(): void {
    this.busy.set(true);
    this.api.poeditorProjects(this.token()).subscribe({
      next: (list) => {
        this.projects.set(list);
        this.step.set('project');
        this.busy.set(false);
      },
      error: () => {
        this.busy.set(false);
        this.toast.show('POEditor rejected that token');
      },
    });
  }

  protected pickProject(p: PoeditorProject): void {
    this.target.set(p);
    this.busy.set(true);
    this.api.poeditorLanguages(this.token(), p.id).subscribe({
      next: (list) => {
        this.languages.set(list);
        this.selected.set(new Set());
        this.step.set('languages');
        this.busy.set(false);
      },
      error: () => {
        this.busy.set(false);
        this.toast.show('Could not read that project');
      },
    });
  }

  protected toggle(code: string): void {
    this.selected.update((s) => {
      const next = new Set(s);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }

  protected runImport(): void {
    const pid = this.state.current()?.id;
    const target = this.target();
    if (!pid || !target) return;
    this.busy.set(true);
    this.api
      .poeditorImport(pid, {
        apiToken: this.token(),
        poeditorProjectId: target.id,
        languages: [...this.selected()],
      })
      .subscribe({
        next: (r) => {
          this.busy.set(false);
          this.summary.set(
            `Imported ${r.translationsImported} translations into ${r.languages.length} language${r.languages.length === 1 ? '' : 's'}` +
              (r.termsCreated > 0 ? `, creating ${r.termsCreated} terms.` : '.'),
          );
          this.step.set('done');
          this.state.load();
          this.imported.emit();
        },
        error: () => {
          this.busy.set(false);
          this.toast.show('Import failed');
        },
      });
  }

  protected restart(): void {
    this.step.set('project');
    this.summary.set('');
  }
}
