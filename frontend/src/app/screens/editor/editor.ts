import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Icon } from '../../shared/icon';
import { Btn, SearchBox, StatusChip } from '../../shared/primitives';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { Inspector } from './inspector';
import { ApiService } from '../../core/api.service';
import { ProjectStateService } from '../../core/project-state.service';
import { ToastService } from '../../core/toast.service';
import { EditorRow, TranslationStatus } from '../../core/models';

@Component({
  selector: 'tl-editor-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Btn, SearchBox, StatusChip, Segmented, Inspector],
  template: `
    <div class="editor" style="position:relative">
      <div class="editor__toolbar">
        <button class="btn btn--ghost btn--sm" style="font-weight:600">
          <span class="locale" style="background:var(--tl-accent-soft);color:var(--tl-accent-text)">{{ lang() }}</span>
          {{ langName() }}
          <tl-icon name="ChevronDown" [size]="15" color="var(--tl-muted)" />
        </button>

        <tl-segmented [options]="filterOptions()" [value]="filter()" (changed)="filter.set($any($event))" />

        <div class="spacer"></div>
        <tl-search placeholder="Search keys or text" [value]="query()" [width]="220" (changed)="query.set($event)" />
        <tl-btn variant="ghost" [sm]="true" icon="WandSparkles" (clicked)="toast.show('Auto-translating…')">
          Auto-translate
        </tl-btn>
        <tl-btn variant="primary" [sm]="true" icon="Plus" (clicked)="toast.show('Add term')">Add term</tl-btn>
      </div>

      <div class="editor__scroll">
        <table class="ttable">
          <thead>
            <tr>
              <th style="width:132px">Status</th>
              <th class="keycell">Key</th>
              <th>Source — <span class="locale">en</span></th>
              <th>Translation — <span class="locale">{{ lang() }}</span></th>
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
                <td>
                  <div class="row" style="gap:6px">
                    <tl-status-chip [status]="r.status" />
                    @if (r.isNew) {
                      <span class="chip chip--new">New</span>
                    }
                  </div>
                </td>
                <td class="keycell">
                  <div class="keytag">{{ r.key }}</div>
                  <div class="keysub">{{ r.ctx }}</div>
                </td>
                <td class="src">{{ r.plural ? r.plural.one + ' / ' + r.plural.other : r.source }}</td>
                <td class="tgt" [class.empty]="!r.target">{{ r.target || 'Add translation…' }}</td>
              </tr>
            }
            @if (filtered().length === 0) {
              <tr>
                <td colspan="4" style="padding:56px 16px;text-align:center">
                  <div class="tl-display-3" style="margin-bottom:6px">Nothing here</div>
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
})
export class EditorScreen implements OnInit {
  private readonly api = inject(ApiService);
  private readonly state = inject(ProjectStateService);
  protected readonly toast = inject(ToastService);

  protected readonly rows = signal<EditorRow[]>([]);
  protected readonly lang = signal('fr');
  protected readonly filter = signal('all');
  protected readonly query = signal('');
  protected readonly sel = signal<string | null>(null);
  protected readonly savedId = signal<string | null>(null);

  private readonly langNames: Record<string, string> = {
    fr: 'French',
    de: 'German',
    'es-ES': 'Spanish (Spain)',
    ja: 'Japanese',
    'pt-BR': 'Portuguese (Brazil)',
    nl: 'Dutch',
  };
  protected readonly langName = computed(() => this.langNames[this.lang()] ?? this.lang());

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
    this.state.whenReady((pid) =>
      this.api.editor(pid, this.lang()).subscribe((res) => this.rows.set(res.rows)),
    );
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
