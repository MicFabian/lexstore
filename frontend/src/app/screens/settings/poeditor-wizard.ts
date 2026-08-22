import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { Icon } from '../../shared/icon';
import { Btn } from '../../shared/primitives';
import { ApiService } from '../../core/api.service';
import { ProjectStateService } from '../../core/project-state.service';
import { ToastService } from '../../core/toast.service';
import { PoeditorLanguage, PoeditorPreview, PoeditorProject } from '../../core/models';

type Step = 'token' | 'project' | 'target' | 'languages' | 'preview' | 'done';
type Target = 'existing' | 'new';

/**
 * Import wizard for POEditor. The API token stays in this component and is sent
 * to our backend per request, which proxies POEditor; it is never persisted.
 */
@Component({
  selector: 'lx-poeditor-wizard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Btn],
  template: `
    <div class="card wiz">
      <div class="wiz__head">
        <span class="int-ico"><lx-icon name="Download" [size]="18" color="var(--lx-ink)" /></span>
        <div style="flex:1;min-width:0">
          <div class="wiz__title">Import from POEditor</div>
          <div class="wiz__sub">Pull terms and translations straight from a POEditor project.</div>
        </div>
        <span class="cap wiz__step">Step {{ stepIndex() }} of 5</span>
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
                Found in POEditor under Account settings → API access. Used for this import only — Lexstore never stores it.
              </p>
            </div>
            <lx-btn variant="primary" [sm]="true" [disabled]="!token() || busy()" (clicked)="loadProjects()">
              {{ busy() ? 'Connecting…' : 'Connect' }}
            </lx-btn>
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
                  <lx-icon name="ChevronRight" [size]="15" color="var(--lx-muted)" />
                </button>
              }
              @if (projects().length === 0) {
                <div class="wiz__hint">That account has no projects.</div>
              }
            </div>
            <lx-btn variant="subtle" [sm]="true" (clicked)="step.set('token')">Back</lx-btn>
          </div>
        }

        @case ('target') {
          <div class="wiz__body">
            <div class="eyebrow">Where should “{{ target()?.name }}” land?</div>
            <div class="wiz__list">
              <button class="wiz__row" (click)="pickTarget('existing')">
                <span class="wiz__row-name">
                  Import into {{ currentProject()?.name }}
                  <span class="wiz__row-note">Adds languages and terms to the project you are in.</span>
                </span>
                <lx-icon name="ChevronRight" [size]="15" color="var(--lx-muted)" />
              </button>
              <button class="wiz__row" (click)="pickTarget('new')">
                <span class="wiz__row-name">
                  Import as a new project
                  <span class="wiz__row-note">Creates “{{ target()?.name }}” in Lexstore and imports everything into it.</span>
                </span>
                <lx-icon name="ChevronRight" [size]="15" color="var(--lx-muted)" />
              </button>
            </div>
            <lx-btn variant="subtle" [sm]="true" (clicked)="step.set('project')">Back</lx-btn>
          </div>
        }

        @case ('languages') {
          <div class="wiz__body">
            <div class="eyebrow">
              {{ mode() === 'new' ? 'Languages for the new project' : 'Languages to import into ' + (currentProject()?.name ?? 'this project') }}
            </div>
            <p class="wiz__hint" style="margin:0">
              POEditor limits how often its API may be called, so each language is fetched one at a time —
              importing many at once takes a moment.
            </p>
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
              <lx-btn variant="primary" [sm]="true" [disabled]="selected().size === 0 || busy()" (clicked)="loadPreview()">
                {{ busy() ? 'Reading…' : 'Preview ' + selected().size + ' language' + (selected().size === 1 ? '' : 's') }}
              </lx-btn>
              <lx-btn variant="subtle" [sm]="true" (clicked)="step.set('target')">Back</lx-btn>
            </div>
          </div>
        }

        @case ('preview') {
          <div class="wiz__body">
            <div class="eyebrow">
              {{ preview()?.totalTerms }} terms · showing the first {{ preview()?.rows?.length }}
            </div>
            <div class="wiz__table">
              <table class="ttable">
                <thead>
                  <tr>
                    <th>Key</th>
                    @for (l of preview()?.languages ?? []; track l.code) {
                      <th>{{ l.name }} · <span class="locale">{{ l.code }}</span></th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (r of preview()?.rows ?? []; track r.key) {
                    <tr class="trow" style="cursor:default">
                      <td class="keycell">
                        <div class="keytag">{{ r.key }}</div>
                        @if (r.context) {
                          <div class="keysub">{{ r.context }}</div>
                        }
                      </td>
                      @for (l of preview()?.languages ?? []; track l.code) {
                        <td class="tgt" [class.empty]="!r.translations[l.code]">
                          {{ r.translations[l.code] || 'Not translated' }}
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <p class="wiz__hint" style="margin:0">
              {{ importTargetLabel() }}
            </p>
            <div class="row" style="gap:8px">
              <lx-btn variant="primary" [sm]="true" [disabled]="busy()" (clicked)="runImport()">
                {{ busy() ? 'Importing…' : 'Import these' }}
              </lx-btn>
              <lx-btn variant="subtle" [sm]="true" (clicked)="step.set('languages')">Back</lx-btn>
            </div>
          </div>
        }

        @case ('done') {
          <div class="wiz__body">
            <div class="wiz__done">
              <lx-icon name="CheckCheck" [size]="18" color="var(--lx-st-translated)" />
              <span>{{ summary() }}</span>
            </div>
            <lx-btn variant="subtle" [sm]="true" (clicked)="restart()">Import more</lx-btn>
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
      border-bottom: 1px solid var(--lx-line-2);
    }
    .wiz__title {
      font-weight: 700;
      font-size: 14px;
    }
    .wiz__sub {
      font-size: 12.5px;
      color: var(--lx-slate);
      margin-top: 2px;
    }
    .wiz__step {
      color: var(--lx-muted);
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
      color: var(--lx-slate);
      line-height: 1.5;
      margin: 6px 0 0;
    }
    .wiz__list {
      width: 100%;
      border-top: 1px solid var(--lx-line-2);
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
      border-bottom: 1px solid var(--lx-line-2);
      background: none;
      text-align: left;
      cursor: pointer;
      min-height: 44px;
    }
    .wiz__row:hover {
      background: var(--lx-row-hover);
    }
    .wiz__row-name {
      font-size: 13.5px;
      font-weight: 600;
      color: var(--lx-ink);
      flex: 1;
    }
    .wiz__row-note {
      display: block;
      font-size: 12.5px;
      font-weight: 400;
      color: var(--lx-slate);
      margin-top: 3px;
    }
    .wiz__row-meta {
      font-size: 12px;
      color: var(--lx-slate);
      font-variant-numeric: tabular-nums;
    }
    .wiz__table {
      width: 100%;
      max-height: 320px;
      overflow: auto;
      border: 1px solid var(--lx-line);
      border-radius: var(--lx-r-lg);
    }
    .wiz__table .ttable {
      background: transparent;
    }
    .wiz__done {
      display: flex;
      align-items: center;
      gap: 9px;
      font-size: 13.5px;
      color: var(--lx-ink);
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
  protected readonly mode = signal<Target>('existing');
  protected readonly currentProject = this.state.current;
  protected readonly selected = signal<Set<string>>(new Set());
  protected readonly summary = signal('');
  protected readonly preview = signal<PoeditorPreview | null>(null);

  protected readonly stepIndex = computed(() => {
    switch (this.step()) {
      case 'token':
        return 1;
      case 'project':
        return 2;
      case 'target':
        return 3;
      case 'languages':
        return 4;
      default:
        return 5;
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
        this.toast.show({ message: 'POEditor rejected that token', tone: 'error' });
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
        this.step.set('target');
        this.busy.set(false);
      },
      error: () => {
        this.busy.set(false);
        this.toast.show({ message: 'Could not read that project', tone: 'error' });
      },
    });
  }

  protected pickTarget(mode: Target): void {
    this.mode.set(mode);
    this.step.set('languages');
  }

  /** Where the confirmed import will land, spelled out before committing. */
  protected importTargetLabel(): string {
    return this.mode() === 'new'
      ? `Creates “${this.target()?.name}” as a new project and imports every term, not only the rows above.`
      : `Imports every term into ${this.currentProject()?.name ?? 'this project'}, not only the rows above.`;
  }

  protected loadPreview(): void {
    const target = this.target();
    if (!target) return;
    this.busy.set(true);
    this.api
      .poeditorPreview({
        apiToken: this.token(),
        poeditorProjectId: target.id,
        languages: [...this.selected()],
      })
      .subscribe({
        next: (p) => {
          this.preview.set(p);
          this.step.set('preview');
          this.busy.set(false);
        },
        error: (e: { status?: number }) => {
          this.busy.set(false);
          this.toast.show(
            e?.status === 429
              ? 'POEditor rate limit reached — wait a minute, then preview fewer languages'
              : 'Could not read that project',
          );
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
    const target = this.target();
    if (!target) return;
    const body = {
      apiToken: this.token(),
      poeditorProjectId: target.id,
      languages: [...this.selected()],
    };

    const pid = this.state.current()?.id;
    if (this.mode() === 'existing' && !pid) return;

    this.busy.set(true);
    const request =
      this.mode() === 'new'
        ? this.api.poeditorImportAsProject({ ...body, name: target.name })
        : this.api.poeditorImport(pid!, body);

    request.subscribe({
      next: (r) => {
        this.busy.set(false);
        this.summary.set(
          `Imported ${r.translationsImported} translations into ${r.languages.length} language${r.languages.length === 1 ? '' : 's'} ` +
            `of ${r.projectName}` +
            (r.termsCreated > 0 ? `, creating ${r.termsCreated} terms.` : '.'),
        );
        this.step.set('done');
        this.state.load();
        this.imported.emit();
      },
      error: (e: { status?: number }) => {
        this.busy.set(false);
        this.toast.show(
          e?.status === 429
            ? 'POEditor rate limit reached — wait a minute, then import fewer languages'
            : 'Import failed',
        );
      },
    });
  }

  protected restart(): void {
    this.step.set('project');
    this.mode.set('existing');
    this.summary.set('');
    this.preview.set(null);
  }
}
