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
import { PromptDialog } from '../../shared/prompt-dialog';
import { ApiService } from '../../core/api.service';
import { ProjectStateService } from '../../core/project-state.service';
import { ToastService } from '../../core/toast.service';
import { EditorRow, TranslationStatus } from '../../core/models';

@Component({
  selector: 'tl-editor-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Btn, SearchBox, Inspector, PromptDialog],
  template: `
    <div class="editor" [class.editor--split]="!!selectedRow()" style="position:relative">
      <div class="ed-head">
        <div>
          <div class="eyebrow">Editing · {{ langsLabel() }}</div>
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
              @for (c of langs(); track c) {
                <span class="locale">{{ c }}</span>
              }
              {{ langsLabel() }}
              <tl-icon name="ChevronDown" [size]="15" color="var(--tl-muted)" />
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
                      <tl-icon name="Check" [size]="14" color="var(--tl-accent-hi)" style="margin-left:auto" />
                    }
                  </button>
                }
              </div>
            }
          </div>
          <tl-btn variant="primary" [sm]="true" icon="Plus" (clicked)="adding.set(true)">Add term</tl-btn>
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
        <button class="btn btn--subtle btn--sm" [disabled]="autoBusy()" (click)="autoTranslate()">
          <tl-icon name="WandSparkles" [size]="14" />{{ autoBusy() ? 'Translating…' : 'Auto-translate' }}
        </button>
      </div>

      <div class="editor__scroll">
        <table class="ttable">
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
            @for (r of filtered(); track r.id) {
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
                  <div class="stcap" style="margin-top:7px" [style.color]="'var(--tl-st-' + r.status + ')'">
                    {{ statusLabel(r.status) }}{{ r.isNew ? ' · New' : '' }}
                  </div>
                </td>
                <td class="src" (click)="select(r.id, langs()[0])">
                  {{ r.plural ? r.plural.one + ' / ' + r.plural.other : r.source }}
                </td>
                @for (c of langs(); track c) {
                  <td
                    class="tgt"
                    [class.empty]="!cell(r.id, c)?.target"
                    [class.cell-sel]="sel()?.termId === r.id && sel()?.lang === c"
                    (click)="select(r.id, c)"
                  >
                    {{ cell(r.id, c)?.target || 'Add translation…' }}
                  </td>
                }
              </tr>
            }
            @if (filtered().length === 0) {
              <tr>
                <td [attr.colspan]="langs().length + 2" style="padding:56px 16px;text-align:center">
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
          [lang]="sel()!.lang"
          [languages]="languages()"
          (langChanged)="selectLangInInspector($event)"
          (closed)="sel.set(null)"
          (saved)="onSaved($event)"
          (savedAndNext)="advanceAfterSave()"
        />
      }

      @if (adding()) {
        <tl-prompt-dialog
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
    /* The open cell is the edited one — mark it, not just its row. */
    .tgt.cell-sel {
      box-shadow: inset 2px 0 0 var(--tl-accent);
      background: var(--tl-accent-soft);
    }

    /* Comparing many languages scrolls sideways; the key and source stay put. */
    .editor__scroll {
      overflow: auto;
    }
    .ttable th.keycell,
    .ttable td.keycell {
      position: sticky;
      left: 0;
      z-index: 2;
      background: var(--tl-card);
      min-width: 240px;
    }
    .ttable th.src-col,
    .ttable td.src {
      position: sticky;
      left: 240px;
      z-index: 2;
      background: var(--tl-card);
      min-width: 260px;
    }
    .ttable thead th {
      position: sticky;
      top: 0;
      z-index: 3;
      background: var(--tl-card);
    }
    .ttable thead th.keycell,
    .ttable thead th.src-col {
      z-index: 4;
    }
    .trow:hover .keycell,
    .trow:hover .src {
      background: var(--tl-row-hover);
    }
    .trow.sel .keycell,
    .trow.sel .src {
      background: var(--tl-accent-soft);
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
  /** Selected target languages, in display order — one table column each. */
  protected readonly langs = signal<string[]>(['fr']);
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

  protected readonly selectedRow = computed(() => {
    const s = this.sel();
    if (!s) return null;
    return this.byLang()[s.lang]?.find((r) => r.id === s.termId) ?? null;
  });

  /** The row of one term in one language column. */
  protected cell(termId: string, lang: string): EditorRow | undefined {
    return this.byLang()[lang]?.find((r) => r.id === termId);
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
    });
  }

  private loadEditor(pid: string, codes = this.langs()): void {
    for (const code of codes) {
      this.api
        .editor(pid, code)
        .subscribe((res) => this.byLang.update((m) => ({ ...m, [code]: res.rows })));
    }
  }

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
    if (pid && !this.byLang()[code]) this.loadEditor(pid, [code]);
  }

  protected selectLangInInspector(code: string): void {
    const s = this.sel();
    if (!s) return;
    const pid = this.state.current()?.id;
    if (pid && !this.byLang()[code]) this.loadEditor(pid, [code]);
    this.sel.set({ termId: s.termId, lang: code });
  }

  protected autoTranslate(): void {
    const pid = this.state.current()?.id;
    if (!pid) return;
    this.autoBusy.set(true);
    const codes = this.langs();
    let done = 0;
    let total = 0;
    for (const code of codes) {
      this.api.autoTranslate(pid, code).subscribe({
        next: (r) => {
          total += r.translated;
          this.loadEditor(pid, [code]);
          if (++done === codes.length) {
            this.autoBusy.set(false);
            this.toast.show(
              total === 0 ? 'Nothing left to translate' : `Auto-translated ${total} translations`,
            );
          }
        },
        error: () => {
          this.autoBusy.set(false);
          this.toast.show({ message: 'Auto-translate failed', tone: 'error' });
        },
      });
    }
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

  protected isCursor(index: number): boolean {
    return this.cursor() === index;
  }

  /** Arrow keys walk the list, Enter edits, Escape closes the inspector. */
  protected onRowKey(e: KeyboardEvent, index: number, row: EditorRow): void {
    const rows = this.filtered();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = e.key === 'ArrowDown'
        ? Math.min(index + 1, rows.length - 1)
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
