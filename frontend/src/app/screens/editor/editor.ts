import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { forkJoin, map, of, catchError } from 'rxjs';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon';
import { Btn, SearchBox } from '../../shared/primitives';
import { SegmentOption } from '../../shared/segmented';
import { Inspector } from './inspector';
import { PromptDialog } from '../../shared/prompt-dialog';
import { ContentState } from '../../shared/content-state';
import { ApiService } from '../../core/api.service';
import { ProjectStateService } from '../../core/project-state.service';
import { ToastService } from '../../core/toast.service';
import { EditorCounts, EditorRow, FeatureView, TranslationStatus } from '../../core/models';

@Component({
  selector: 'lx-editor-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, Btn, SearchBox, Inspector, PromptDialog, ContentState],
  template: `
    <div class="editor" [class.editor--split]="!!selectedRow()" style="position:relative">
      <div class="ed-head">
        <div>
          <div class="eyebrow">Editing · {{ langsLabel() }}</div>
          <div style="display:flex;align-items:baseline;gap:14px;margin-top:12px">
            <span class="display tnum" style="font-size:var(--lx-size-34);line-height:var(--lx-leading-tight)">{{ pct().done }}%</span>
            <span style="font-size:var(--lx-size-13);color:var(--lx-text-muted)">translated</span>
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
              @for (c of langs(); track c) {
                <span class="locale">{{ c }}</span>
              }
              {{ langsLabel() }}
              <lx-icon name="ChevronDown" [size]="15" color="var(--lx-text-muted)" />
            </button>
            @if (langMenuOpen()) {
              <div class="menu-backdrop" (click)="langMenuOpen.set(false)"></div>
              <div class="menu" style="top:calc(100% + 4px);right:0;min-width:230px">
                <div class="menu__label">Compare languages</div>
                @for (l of languages(); track l.code) {
                  <button
                    class="menu__item"
                    [class.on]="langs().includes(l.code)"
                    [attr.aria-pressed]="langs().includes(l.code)"
                    (click)="toggleLang(l.code)"
                  >
                    <span class="locale">{{ l.code }}</span>
                    <span>{{ l.name }}</span>
                    @if (langs().includes(l.code)) {
                      <lx-icon name="Check" [size]="14" color="var(--lx-accent-hover)" style="margin-left:auto" />
                    }
                  </button>
                }
              </div>
            }
          </div>
          <lx-btn variant="primary" [sm]="true" icon="Plus" (clicked)="adding.set(true)">Add term</lx-btn>
        </div>
      </div>

      @if (activeFeature(); as f) {
        <div class="feature-scope">
          <lx-icon name="LayoutGrid" [size]="14" color="var(--lx-text-secondary)" />
          <span>Showing <b>{{ f.name }}</b> only</span>
          <a class="feature-scope__clear" [routerLink]="['/', 'editor']">Show all terms</a>
        </div>
      }

      <div class="ed-tabs">
        @for (o of filterOptions(); track o.value) {
          <button class="ftab" [class.on]="filter() === o.value" (click)="filter.set($any(o.value))">
            {{ o.label }}<span class="n">{{ o.n }}</span>
          </button>
        }
        <div class="spacer"></div>
        <lx-search placeholder="Search keys or text" [value]="query()" [width]="200" (changed)="query.set($event)" />
        <button class="btn btn--subtle btn--sm" [disabled]="autoBusy()" (click)="autoTranslate()">
          <lx-icon name="WandSparkles" [size]="14" />{{ autoBusy() ? 'Translating…' : 'Auto-translate' }}
        </button>
      </div>

      <div class="editor__scroll">
        <table class="ttable" aria-label="Translations">
          <thead>
            <tr>
              <th class="keycell">Key</th>
              <th class="src-col">Source · <span class="locale">en</span></th>
              @for (c of langs(); track c) {
                <th class="tgt-col">Translation · <span class="locale">{{ c }}</span></th>
              }
            </tr>
          </thead>
          <tbody>
            @for (r of visible(); track r.id) {
              <tr
                class="trow"
                [class.sel]="sel()?.termId === r.id"
                [class.cell-saved]="savedId() === r.id"
                [attr.tabindex]="isCursor($index) ? 0 : -1"
                [attr.aria-selected]="sel()?.termId === r.id"
                (keydown)="onRowKey($event, $index, r)"
                (focus)="cursor.set($index)"
              >
                <td class="keycell" (click)="select(r.id, langs()[0])">
                  <div class="keytag">{{ r.key }}</div>
                  @if (r.isNew) {
                    <div class="stcap" style="margin-top:7px;color:var(--lx-accent)">New</div>
                  }
                </td>
                <td class="src" (click)="select(r.id, langs()[0])">
                  {{ r.plural ? r.plural.one + ' / ' + r.plural.other : r.source }}
                </td>
                @for (c of langs(); track c) {
                  @let cellRow = cell(r.id, c);
                  <td
                    class="tgt"
                    [class.empty]="!cellRow?.target"
                    [class.cell-sel]="sel()?.termId === r.id && sel()?.lang === c"
                    (click)="select(r.id, c)"
                  >
                    <span class="tgt__value">{{ cellRow?.target || 'Add translation…' }}</span>
                    @if (cellRow && cellRow.status !== 'translated') {
                      <span class="stcap tgt__status" [style.color]="statusColor(cellRow.status)">
                        {{ statusLabel(cellRow.status) }}
                      </span>
                    }
                  </td>
                }
              </tr>
            }
            @if (filtered().length === 0) {
              <tr>
                <td [attr.colspan]="langs().length + 2" style="padding:0">
                  @if (rows().length === 0) {
                    <lx-content-state
                      kind="empty"
                      title="No terms in this project yet"
                      description="Add the first source string, and it appears here for every language."
                      actionLabel="Add term"
                      (acted)="adding.set(true)"
                    />
                  } @else {
                    <lx-content-state
                      kind="no-results"
                      [title]="'Nothing ' + activeFilterLabel()"
                      description="No terms match this filter and search."
                      actionLabel="Show all terms"
                      (acted)="resetFilters()"
                    />
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
        @if (hiddenCount() > 0) {
          <div class="more-rows">
            <span>Showing {{ visible().length }} of {{ loadedTotal() }} terms</span>
            <button class="btn btn--subtle btn--sm" [disabled]="loadingMore()" (click)="showMore()">
              {{ loadingMore() ? 'Loading…' : 'Load 100 more' }}
            </button>
          </div>
        }
      </div>

      @if (selectedRow(); as row) {
        <lx-inspector
          [row]="row"
          [lang]="sel()!.lang"
          [languages]="languages()"
          (langChanged)="selectLangInInspector($event)"
          (closed)="sel.set(null)"
          (saved)="onSaved($event)"
          (savedAndNext)="advanceAfterSave()"
        />
      }

      @if (adding()) {
        <lx-prompt-dialog
          title="Add a term"
          description="The key identifies this string in your code; the source text is what gets translated."
          [fields]="addTermFields"
          submitLabel="Add term"
          (submitted)="createTerm($event)"
          (cancelled)="adding.set(false)"
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
      color: var(--lx-text-secondary);
    }
    .ed-tabs {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 0 32px;
      border-bottom: 1px solid var(--lx-line);
      flex: none;
    }
    .tgt__value {
      display: block;
    }
    .tgt__status {
      display: block;
      margin-top: 6px;
    }
    /* The open cell is the edited one — mark it, not just its row. */
    .tgt.cell-sel {
      box-shadow: inset 2px 0 0 var(--lx-accent);
      background: var(--lx-accent-soft);
    }

    /* Comparing many languages scrolls sideways; the key and source stay put. */
    .feature-scope {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      font-size: 13px;
      border-bottom: 1px solid var(--lx-line);
      background: var(--lx-surface-hover);
    }
    .feature-scope__clear {
      margin-left: auto;
      font-size: 13px;
    }
    .more-rows {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 16px 20px;
      font-size: 13px;
      color: var(--lx-text-secondary);
      border-top: 1px solid var(--lx-line);
    }
    .editor__scroll {
      overflow: auto;
    }
    .ttable {
      --key-col: 240px;
    }
    .ttable th.keycell,
    .ttable td.keycell {
      position: sticky;
      left: 0;
      z-index: 2;
      background: var(--lx-bg-card);
      width: var(--key-col);
      min-width: var(--key-col);
      max-width: var(--key-col);
    }
    .keytag {
      overflow-wrap: anywhere;
    }
    .ttable th.src-col,
    .ttable td.src {
      position: sticky;
      left: var(--key-col);
      z-index: 2;
      background: var(--lx-bg-card);
      min-width: 260px;
    }
    .ttable thead th {
      position: sticky;
      top: 0;
      z-index: 3;
      background: var(--lx-bg-card);
    }
    .ttable thead th.keycell,
    .ttable thead th.src-col {
      z-index: 4;
    }
    .trow:hover .keycell,
    .trow:hover .src {
      background: var(--lx-bg-row-hover);
    }
    .trow.sel .keycell,
    .trow.sel .src {
      background: var(--lx-accent-soft);
    }
    .ttable td.tgt,
    .ttable th.tgt-col {
      min-width: 240px;
    }
  `,
})
export class EditorScreen implements OnInit {
  private readonly api = inject(ApiService);
  private readonly state = inject(ProjectStateService);
  protected readonly toast = inject(ToastService);

  /** Rows per language code; the first selected language drives key/source/status. */
  protected readonly byLang = signal<Record<string, EditorRow[]>>({});
  protected readonly countsByLang = signal<Record<string, EditorCounts>>({});
  /** Selected target languages, in display order — one table column each. */
  protected readonly langs = signal<string[]>(['fr']);
  protected readonly filter = signal('all');

  /** Optional ?filter= deep link (sidebar quick filters); bound by the router. */
  readonly filterParam = input<string | undefined>(undefined, { alias: 'filter' });

  /** Optional ?lang= deep link, so other screens can open a specific language. */
  readonly langParam = input<string | undefined>(undefined, { alias: 'lang' });

  private readonly applyLangParam = effect(() => {
    const l = this.langParam();
    if (l && this.languages().some((x) => x.code === l)) this.langs.set([l]);
  });

  readonly featureParam = input<string | undefined>(undefined, { alias: 'feature' });

  private readonly applyFilterParam = effect(() => {
    const f = this.filterParam();
    if (f && ['all', 'untranslated', 'new', 'fuzzy', 'proofread'].includes(f)) {
      this.filter.set(f);
    }
  });
  protected readonly query = signal('');
  /** The open cell: which term, in which language column. */
  protected readonly sel = signal<{ termId: string; lang: string } | null>(null);
  protected readonly savedId = signal<string | null>(null);
  protected readonly langMenuOpen = signal(false);
  protected readonly autoBusy = signal(false);
  protected readonly adding = signal(false);
  /** Row the keyboard is on; Enter opens it in the inspector. */
  protected readonly cursor = signal(0);
  protected readonly addTermFields = [
    { name: 'key', label: 'Key', placeholder: 'checkout.button.confirm', mono: true },
    { name: 'source', label: 'Source text (English)', placeholder: 'Confirm order' },
  ];

  protected readonly features = signal<FeatureView[]>([]);
  protected readonly activeFeature = computed(() => {
    const key = this.featureParam();
    return key ? (this.features().find((f) => f.key === key) ?? null) : null;
  });

  /** Target languages available for this project (from the API). */
  protected readonly languages = signal<{ code: string; name: string }[]>([]);
  protected readonly langsLabel = computed(() => {
    const names = this.langs().map(
      (c) => this.languages().find((l) => l.code === c)?.name ?? c,
    );
    return names.length <= 2 ? names.join(' · ') : `${names.length} languages`;
  });

  /** Rows of the leading language carry key, source, and status for the table. */
  protected readonly rows = computed(() => this.byLang()[this.langs()[0]] ?? []);

  /**
   * Counts describe the whole project and come from the server, because the
   * browser now only holds one page. Summed across the visible languages,
   * which is what the headline percentage is about.
   */
  protected readonly counts = computed(() => {
    const per = Object.entries(this.countsByLang())
      .filter(([code]) => this.langs().includes(code))
      .map(([, c]) => c);
    return {
      all: per.reduce((n, c) => n + c.all, 0),
      untranslated: per.reduce((n, c) => n + c.untranslated, 0),
      new: this.termTotals().new,
      fuzzy: per.reduce((n, c) => n + c.fuzzy, 0),
      proofread: per.reduce((n, c) => n + c.proofread, 0),
    };
  });

  /** Filter tabs count terms, so they use the leading language's counts. */
  protected readonly termCounts = computed(() => this.termTotals());

  private readonly termTotals = computed(() => {
    const lead = this.langs()[0];
    return (
      this.countsByLang()[lead] ?? { all: 0, untranslated: 0, new: 0, fuzzy: 0, proofread: 0 }
    );
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

  protected statusColor(s: TranslationStatus): string {
    const token = { untranslated: 'untranslated', translated: 'translated', fuzzy: 'unsure', proofread: 'reviewed' }[s];
    return `var(--lx-${token})`;
  }

  protected readonly filterOptions = computed<SegmentOption[]>(() => {
    const c = this.termCounts();
    return [
      { value: 'all', label: 'All', n: c.all },
      { value: 'untranslated', label: 'Untranslated', n: c.untranslated },
      { value: 'new', label: 'New', n: c.new },
      { value: 'fuzzy', label: 'Needs review', n: c.fuzzy },
      { value: 'proofread', label: 'Proofread', n: c.proofread },
    ];
  });

  /** The server already applied the filter, so the page is what is shown. */
  protected readonly filtered = computed(() => this.rows());
  protected readonly visible = computed(() => this.rows());
  protected readonly loadedTotal = signal(0);
  protected readonly hiddenCount = computed(() =>
    Math.max(this.loadedTotal() - this.rows().length, 0),
  );
  protected readonly loadingMore = signal(false);

  private readonly pageSize = 100;
  private nextPage = 1;

  protected showMore(): void {
    const pid = this.state.current()?.id;
    if (!pid || this.loadingMore()) return;
    this.loadingMore.set(true);
    const page = this.nextPage;
    const codes = this.langs();
    const generation = this.loadGeneration;
    forkJoin(
      codes.map((code) =>
        this.api
          .editor(pid, code, this.queryOptions(page))
          .pipe(map((res) => ({ code, res }))),
      ),
    ).subscribe({
      next: (results) => {
        this.loadingMore.set(false);
        if (generation !== this.loadGeneration) return;
        this.byLang.update((m) => {
          const next = { ...m };
          for (const { code, res } of results) next[code] = [...(next[code] ?? []), ...res.rows];
          return next;
        });
        this.nextPage = page + 1;
      },
      error: () => this.loadingMore.set(false),
    });
  }

  private queryOptions(page: number) {
    return {
      page,
      size: this.pageSize,
      status: this.filter(),
      q: this.query().trim() || undefined,
      featureId: this.activeFeature()?.id,
    };
  }

  protected readonly selectedRow = computed(() => {
    const s = this.sel();
    if (!s) return null;
    return this.indexed()[s.lang]?.get(s.termId) ?? null;
  });

  /** The row of one term in one language column. */
  private readonly indexed = computed(() => {
    const out: Record<string, Map<string, EditorRow>> = {};
    for (const [code, rows] of Object.entries(this.byLang())) {
      out[code] = new Map(rows.map((r) => [r.id, r]));
    }
    return out;
  });

  protected cell(termId: string, lang: string): EditorRow | undefined {
    return this.indexed()[lang]?.get(termId);
  }

  ngOnInit(): void {
    this.state.whenReady((pid) => {
      this.api.listLanguages(pid).subscribe((langs) => {
        this.languages.set(langs.map((l) => ({ code: l.code, name: l.name })));
        // Fall back to the project's first language if the default isn't in it.
        if (langs.length && !langs.some((l) => l.code === this.langs()[0])) {
          this.langs.set([langs[0].code]);
        }
        this.loadEditor(pid);
      });
      this.api.listFeatures(pid).subscribe((f) => this.features.set(f));
    });
  }

  /**
   * Loads page one for the given languages.
   *
   * `replacing` distinguishes the two callers: a filter or language change
   * starts a new view and must invalidate slower earlier loads, while adding a
   * column only fills a gap and must not cancel the load already in flight.
   */
  private loadEditor(pid: string, codes = this.langs(), replacing = true): void {
    if (!codes.length) return;
    if (replacing) this.nextPage = 1;
    const generation = replacing ? ++this.loadGeneration : this.loadGeneration;
    forkJoin(
      codes.map((code) =>
        this.api.editor(pid, code, this.queryOptions(0)).pipe(map((res) => ({ code, res }))),
      ),
    ).subscribe((results) => {
      if (generation !== this.loadGeneration) return;
      this.byLang.update((m) => {
        const next = { ...m };
        for (const { code, res } of results) next[code] = res.rows;
        return next;
      });
      this.countsByLang.update((m) => {
        const next = { ...m };
        for (const { code, res } of results) next[code] = res.counts;
        return next;
      });
      this.loadedTotal.set(results[0]?.res.total ?? 0);
    });
  }

  /**
   * Filter, search and feature changes go back to the server for page one.
   * Typing is debounced so a query is one request, not one per keystroke, and
   * each load carries a generation so a slow earlier response cannot land on
   * top of a newer one.
   */
  private readonly reloadOnFilter = effect(() => {
    this.filter();
    this.query();
    this.featureParam();
    // The language set is a dependency too: a ?lang= deep link changes it after
    // the first load. Adding a column already fetches just that column, so only
    // languages with nothing loaded need a fetch here.
    const codes = this.langs();
    untracked(() => {
      const pid = this.state.current()?.id;
      if (!pid || !codes.length || !this.languages().length) return;
      const loaded = this.byLang();
      const missing = codes.filter((c) => !loaded[c]);
      if (missing.length && missing.length < codes.length) {
        this.loadEditor(pid, missing, false);
        return;
      }
      clearTimeout(this.reloadTimer);
      this.reloadTimer = setTimeout(() => this.loadEditor(pid, codes), 200);
    });
  });

  private reloadTimer: ReturnType<typeof setTimeout> | undefined;
  private loadGeneration = 0;

  protected toggleLang(code: string): void {
    const current = this.langs();
    if (current.includes(code)) {
      // Keep at least one column.
      if (current.length === 1) return;
      this.langs.set(current.filter((c) => c !== code));
      if (this.sel()?.lang === code) this.sel.set(null);
      return;
    }
    this.langs.set([...current, code]);
    const pid = this.state.current()?.id;
    if (pid && !this.byLang()[code]) this.loadEditor(pid, [code], false);
  }

  protected selectLangInInspector(code: string): void {
    const s = this.sel();
    if (!s) return;
    const pid = this.state.current()?.id;
    if (pid && !this.byLang()[code]) this.loadEditor(pid, [code], false);
    this.sel.set({ termId: s.termId, lang: code });
  }

  protected autoTranslate(): void {
    const pid = this.state.current()?.id;
    if (!pid) return;
    const codes = this.langs();
    if (!codes.length) return;
    this.autoBusy.set(true);

    forkJoin(
      codes.map((code) =>
        this.api.autoTranslate(pid, code).pipe(
          map((r) => ({ code, translated: r.translated, remaining: r.remaining, failed: r.failed })),
          catchError(() => of({ code, translated: 0, remaining: 0, failed: -1 })),
        ),
      ),
    ).subscribe((results) => {
      this.autoBusy.set(false);
      this.loadEditor(pid, codes);

      const translated = results.reduce((n, r) => n + r.translated, 0);
      const remaining = results.reduce((n, r) => n + Math.max(r.remaining, 0), 0);
      const broken = results.filter((r) => r.failed !== 0);

      if (broken.length === results.length) {
        this.toast.show({ message: 'Auto-translate failed', tone: 'error' });
        return;
      }
      if (translated === 0 && !broken.length) {
        this.toast.show('Nothing left to translate');
        return;
      }

      const parts = [`Auto-translated ${translated} ${translated === 1 ? 'translation' : 'translations'}`];
      if (remaining > 0) parts.push(`${remaining} still to go — run it again`);
      if (broken.length) parts.push(`${broken.map((r) => r.code).join(', ')} failed`);
      this.toast.show({
        message: parts.join(' · '),
        tone: broken.length ? 'error' : 'success',
      });
    });
  }

  protected createTerm(values: Record<string, string>): void {
    const pid = this.state.current()?.id;
    if (!pid) return;
    this.adding.set(false);
    this.api.createTerm(pid, { key: values['key'], source: values['source'] }).subscribe({
      next: () => {
        this.loadEditor(pid);
        this.toast.show('Term added');
      },
      error: () => this.toast.show({ message: 'That key already exists', tone: 'error' }),
    });
  }

  protected activeFilterLabel(): string {
    const f = this.filter();
    return f === 'all' ? 'to show' : `is ${this.statusLabel(f as TranslationStatus).toLowerCase()}`;
  }

  protected resetFilters(): void {
    this.filter.set('all');
    this.query.set('');
  }

  protected isCursor(index: number): boolean {
    const count = this.visible().length;
    if (!count) return false;
    return Math.min(this.cursor(), count - 1) === index;
  }

  /** Arrow keys walk the list, Enter edits, Escape closes the inspector. */
  protected onRowKey(e: KeyboardEvent, index: number, row: EditorRow): void {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      // Arrowing past the window pulls the next page in rather than stopping.
      if (e.key === 'ArrowDown' && index === this.visible().length - 1 && this.hiddenCount() > 0) {
        this.showMore();
      }
      const next = e.key === 'ArrowDown'
        ? Math.min(index + 1, this.visible().length - 1)
        : Math.max(index - 1, 0);
      this.focusRow(next);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this.select(row.id, this.sel()?.lang ?? this.langs()[0]);
    } else if (e.key === 'Escape') {
      this.sel.set(null);
      this.focusRow(index);
    }
  }

  /** Moves to a row and takes the caret with it. */
  private focusRow(index: number): void {
    this.cursor.set(index);
    queueMicrotask(() => {
      const rows = document.querySelectorAll<HTMLElement>('.editor .trow');
      rows[index]?.focus();
      rows[index]?.scrollIntoView({ block: 'nearest' });
    });
  }

  /** Saving from the inspector moves to the next row that still needs work. */
  protected advanceAfterSave(): void {
    const rows = this.filtered();
    const current = rows.findIndex((r) => r.id === this.sel()?.termId);
    const lang = this.sel()?.lang ?? this.langs()[0];
    const nextOpen = rows.findIndex((r, i) => i > current && !this.cell(r.id, lang)?.target);
    const target = nextOpen === -1 ? current + 1 : nextOpen;
    if (target >= rows.length) {
      this.sel.set(null);
      return;
    }
    this.cursor.set(target);
    this.select(rows[target].id, lang);
  }

  protected select(termId: string, lang: string): void {
    this.sel.set({ termId, lang });
  }

  protected onSaved(updated: EditorRow): void {
    const lang = this.sel()?.lang;
    if (!lang) return;
    this.byLang.update((m) => ({
      ...m,
      [lang]: (m[lang] ?? []).map((r) => (r.id === updated.id ? updated : r)),
    }));
    this.savedId.set(updated.id);
    setTimeout(() => this.savedId.update((s) => (s === updated.id ? null : s)), 700);
    this.toast.show('Translation saved');
  }
}
