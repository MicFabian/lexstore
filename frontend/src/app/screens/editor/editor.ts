import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Icon } from '../../shared/icon';
import { Btn, SearchBox } from '../../shared/primitives';
import { SegmentOption } from '../../shared/segmented';
import { Inspector } from './inspector';
import { ApiService } from '../../core/api.service';
import { ProjectStateService } from '../../core/project-state.service';
import { ToastService } from '../../core/toast.service';
import { EditorRow, TranslationStatus } from '../../core/models';

@Component({
  selector: 'tl-editor-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Btn, SearchBox, Inspector],
  template: `
    <div class="editor" style="position:relative">
      <div class="ed-head">
        <div>
          <div class="eyebrow">Editing · {{ langName() }} <span style="color:var(--tl-slate)">{{ lang() }}</span></div>
          <div style="display:flex;align-items:baseline;gap:14px;margin-top:12px">
            <span class="serif" style="font-size:52px;line-height:1">{{ pct().done }}%</span>
            <span class="serif" style="font-size:22px;color:var(--tl-slate);font-style:italic">translated</span>
          </div>
          <div class="progress" style="width:340px;margin-top:16px;height:5px">
            <i class="seg-translated" [style.width.%]="pct().done"></i>
            <i class="seg-fuzzy" [style.width.%]="pct().fuzzy"></i>
            <i class="seg-untranslated" [style.width.%]="pct().open"></i>
          </div>
          <div class="ed-counts">
            {{ counts().all - counts().untranslated - counts().fuzzy }} translated ·
            {{ counts().fuzzy }} need review · {{ counts().untranslated }} untranslated
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <div style="position:relative">
            <button
              class="btn btn--ghost btn--sm"
              style="font-weight:600"
              [attr.aria-expanded]="langMenuOpen()"
              (click)="langMenuOpen.set(!langMenuOpen())"
            >
              <span class="locale">{{ lang() }}</span>
              {{ langName() }}
              <tl-icon name="ChevronDown" [size]="15" color="var(--tl-muted)" />
            </button>
            @if (langMenuOpen()) {
              <div class="menu-backdrop" (click)="langMenuOpen.set(false)"></div>
              <div class="menu" style="top:calc(100% + 4px);right:0;min-width:200px">
                <div class="menu__label">Translate into</div>
                @for (l of languages(); track l.code) {
                  <button class="menu__item" [class.on]="l.code === lang()" (click)="selectLang(l.code)">
                    <span class="locale">{{ l.code }}</span>
                    <span>{{ l.name }}</span>
                    @if (l.code === lang()) {
                      <tl-icon name="Check" [size]="14" color="var(--tl-accent-hi)" style="margin-left:auto" />
                    }
                  </button>
                }
              </div>
            }
          </div>
          <tl-btn variant="ghost" [sm]="true" icon="WandSparkles" [disabled]="autoBusy()" (clicked)="autoTranslate()">
            {{ autoBusy() ? 'Translating…' : 'Auto-translate' }}
          </tl-btn>
          <tl-btn variant="primary" [sm]="true" icon="Plus" (clicked)="addTerm()">Add term</tl-btn>
        </div>
      </div>

      <div class="ed-tabs">
        @for (o of filterOptions(); track o.value) {
          <button class="ftab" [class.on]="filter() === o.value" (click)="filter.set($any(o.value))">
            {{ o.label }}<span class="n">{{ o.n }}</span>
          </button>
        }
        <div class="spacer"></div>
        <tl-search placeholder="Search keys or text" [value]="query()" [width]="200" (changed)="query.set($event)" />
      </div>

      <div class="editor__scroll">
        <table class="ttable">
          <thead>
            <tr>
              <th class="keycell" style="width:280px">Key</th>
              <th>Source · <span class="locale">en</span></th>
              <th>Translation · <span class="locale">{{ lang() }}</span></th>
            </tr>
          </thead>
          <tbody>
            @for (r of filtered(); track r.id) {
              <tr
                class="trow"
                [class.sel]="sel() === r.id"
                [class.cell-saved]="savedId() === r.id"
                (click)="select(r.id)"
              >
                <td class="keycell">
                  <div class="keytag">{{ r.key }}</div>
                  <div class="stcap" style="margin-top:7px" [style.color]="'var(--tl-st-' + r.status + ')'">
                    {{ statusLabel(r.status) }}{{ r.isNew ? ' · New' : '' }}
                  </div>
                </td>
                <td class="src">{{ r.plural ? r.plural.one + ' / ' + r.plural.other : r.source }}</td>
                <td class="tgt" [class.empty]="!r.target">{{ r.target || 'Add translation…' }}</td>
              </tr>
            }
            @if (filtered().length === 0) {
              <tr>
                <td colspan="3" style="padding:56px 16px;text-align:center">
                  <div class="serif" style="font-size:26px;margin-bottom:6px">Nothing here</div>
                  <div class="muted" style="font-size:13.5px">No terms match this filter — try another.</div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (selectedRow(); as row) {
        <tl-inspector
          [row]="row"
          [lang]="lang()"
          (closed)="sel.set(null)"
          (saved)="onSaved($event)"
        />
      }
    </div>
  `,
  styles: `
    .ed-head {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 24px;
      padding: 28px 32px 22px;
    }
    .ed-counts {
      margin-top: 10px;
      font-size: 12.5px;
      color: var(--tl-slate);
    }
    .ed-tabs {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 0 32px;
      border-bottom: 1px solid var(--tl-line);
      flex: none;
    }
  `,
})
export class EditorScreen implements OnInit {
  private readonly api = inject(ApiService);
  private readonly state = inject(ProjectStateService);
  protected readonly toast = inject(ToastService);

  protected readonly rows = signal<EditorRow[]>([]);
  protected readonly lang = signal('fr');
  protected readonly filter = signal('all');

  /** Optional ?filter= deep link (sidebar quick filters); bound by the router. */
  readonly filterParam = input<string | undefined>(undefined, { alias: 'filter' });

  private readonly applyFilterParam = effect(() => {
    const f = this.filterParam();
    if (f && ['all', 'untranslated', 'new', 'fuzzy', 'proofread'].includes(f)) {
      this.filter.set(f);
    }
  });
  protected readonly query = signal('');
  protected readonly sel = signal<string | null>(null);
  protected readonly savedId = signal<string | null>(null);
  protected readonly langMenuOpen = signal(false);
  protected readonly autoBusy = signal(false);

  /** Target languages available for this project (from the API). */
  protected readonly languages = signal<{ code: string; name: string }[]>([]);
  protected readonly langName = computed(
    () => this.languages().find((l) => l.code === this.lang())?.name ?? this.lang(),
  );

  protected readonly counts = computed(() => {
    const r = this.rows();
    return {
      all: r.length,
      untranslated: r.filter((x) => x.status === 'untranslated').length,
      new: r.filter((x) => x.isNew).length,
      fuzzy: r.filter((x) => x.status === 'fuzzy').length,
      proofread: r.filter((x) => x.status === 'proofread').length,
    };
  });

  /** Stacked progress segments for the editorial headline. */
  protected readonly pct = computed(() => {
    const c = this.counts();
    if (c.all === 0) return { done: 0, fuzzy: 0, open: 0 };
    const done = Math.round(((c.all - c.untranslated - c.fuzzy) / c.all) * 100);
    const fuzzy = Math.round((c.fuzzy / c.all) * 100);
    return { done, fuzzy, open: Math.max(0, 100 - done - fuzzy) };
  });

  protected statusLabel(s: TranslationStatus): string {
    return s === 'fuzzy' ? 'Needs review' : s.charAt(0).toUpperCase() + s.slice(1);
  }

  protected readonly filterOptions = computed<SegmentOption[]>(() => {
    const c = this.counts();
    return [
      { value: 'all', label: 'All', n: c.all },
      { value: 'untranslated', label: 'Untranslated', n: c.untranslated },
      { value: 'new', label: 'New', n: c.new },
      { value: 'fuzzy', label: 'Needs review', n: c.fuzzy },
      { value: 'proofread', label: 'Proofread', n: c.proofread },
    ];
  });

  protected readonly filtered = computed(() => {
    const f = this.filter();
    const q = this.query().toLowerCase();
    return this.rows().filter((r) => {
      if (f === 'untranslated' && r.status !== 'untranslated') return false;
      if (f === 'new' && !r.isNew) return false;
      if (f === 'fuzzy' && r.status !== 'fuzzy') return false;
      if (f === 'proofread' && r.status !== 'proofread') return false;
      if (q && !(r.key.includes(q) || r.source.toLowerCase().includes(q))) return false;
      return true;
    });
  });

  protected readonly selectedRow = computed(() =>
    this.rows().find((r) => r.id === this.sel()) ?? null,
  );

  ngOnInit(): void {
    this.state.whenReady((pid) => {
      this.api.listLanguages(pid).subscribe((langs) => {
        // Only languages with at least one term make sense; backend returns all.
        this.languages.set(langs.map((l) => ({ code: l.code, name: l.name })));
        // Default to the first language if the current one isn't in the project.
        if (langs.length && !langs.some((l) => l.code === this.lang())) {
          this.lang.set(langs[0].code);
        }
      });
      this.loadEditor(pid);
    });
  }

  private loadEditor(pid: string): void {
    this.api.editor(pid, this.lang()).subscribe((res) => this.rows.set(res.rows));
  }

  protected selectLang(code: string): void {
    this.langMenuOpen.set(false);
    if (code === this.lang()) return;
    this.lang.set(code);
    this.sel.set(null);
    const pid = this.state.current()?.id;
    if (pid) this.loadEditor(pid);
  }

  protected autoTranslate(): void {
    const pid = this.state.current()?.id;
    if (!pid) return;
    this.autoBusy.set(true);
    this.api.autoTranslate(pid, this.lang()).subscribe({
      next: (r) => {
        this.autoBusy.set(false);
        this.loadEditor(pid);
        this.toast.show(
          r.translated === 0 ? 'Nothing left to translate' : `Auto-translated ${r.translated} terms (${r.status})`,
        );
      },
      error: () => {
        this.autoBusy.set(false);
        this.toast.show('Auto-translate failed');
      },
    });
  }

  protected addTerm(): void {
    const key = window.prompt('New term key (e.g. checkout.button.confirm)');
    if (!key) return;
    const source = window.prompt('Source text (English)');
    if (!source) return;
    const pid = this.state.current()?.id;
    if (!pid) return;
    this.api.createTerm(pid, { key, source }).subscribe({
      next: () => {
        this.loadEditor(pid);
        this.toast.show('Term added');
      },
      error: () => this.toast.show('That key already exists'),
    });
  }

  protected select(id: string): void {
    this.sel.set(id);
  }

  protected onSaved(updated: EditorRow): void {
    this.rows.update((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
    this.savedId.set(updated.id);
    setTimeout(() => this.savedId.update((s) => (s === updated.id ? null : s)), 700);
    this.toast.show('Translation saved');
  }
}
