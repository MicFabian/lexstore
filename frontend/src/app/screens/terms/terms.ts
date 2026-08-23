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
import { Router } from '@angular/router';
import { Icon } from '../../shared/icon';
import { Avatar, Btn, SearchBox, StatusChip, Tag } from '../../shared/primitives';
import { HistoryModal } from '../../shared/history-modal';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { PromptDialog } from '../../shared/prompt-dialog';
import { ContentState } from '../../shared/content-state';
import { TableSkeleton } from '../../shared/table-skeleton';
import { ApiService } from '../../core/api.service';
import { ProjectStateService } from '../../core/project-state.service';
import { ToastService } from '../../core/toast.service';
import { TermView } from '../../core/models';

const TAGS = ['checkout', 'billing', 'auth', 'onboarding'];

@Component({
  selector: 'lx-terms-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Avatar, Btn, SearchBox, StatusChip, Tag, HistoryModal, ConfirmDialog, PromptDialog, ContentState, TableSkeleton],
  template: `
    <div class="well">
      <div class="pad">
      <div class="phead" style="margin-bottom:14px">
        <div>
          <div class="eyebrow">Source strings · English</div>
          <h1 class="serif">Terms</h1>
          <div class="psub">{{ rows().length }} terms · manage the keys; translate them per language</div>
        </div>
        <div style="display:flex;gap:8px">
          <lx-btn variant="ghost" icon="FileUp" (clicked)="goImport()">Import</lx-btn>
          <lx-btn variant="primary" icon="Plus" (clicked)="adding.set(true)">Add term</lx-btn>
        </div>
      </div>

      <div class="row" style="margin:16px 0 12px;gap:8px;flex-wrap:wrap">
        <lx-search placeholder="Search terms" [value]="query()" [width]="220" (changed)="query.set($event)" />
        <button
          [class]="'btn btn--sm ' + (newOnly() ? 'btn--ghost' : 'btn--subtle')"
          [style.border-color]="newOnly() ? 'var(--lx-st-new)' : null"
          [style.color]="newOnly() ? 'var(--lx-st-new)' : null"
          (click)="newOnly.set(!newOnly())"
        >
          <lx-icon name="Sparkles" [size]="13" />New only
        </button>
        <div class="row" style="gap:6px;flex-wrap:wrap">
          <button
            [class]="'btn btn--sm ' + (tag() === null ? 'btn--ghost' : 'btn--subtle')"
            [style.border-color]="tag() === null ? 'var(--lx-accent)' : null"
            [style.color]="tag() === null ? 'var(--lx-accent-text)' : null"
            (click)="tag.set(null)"
          >
            All tags
          </button>
          @for (t of allTags; track t) {
            <button
              [class]="'btn btn--sm ' + (tag() === t ? 'btn--ghost' : 'btn--subtle')"
              [style.border-color]="tag() === t ? 'var(--lx-accent)' : null"
              [style.color]="tag() === t ? 'var(--lx-accent-text)' : null"
              (click)="tag.set(t)"
            >
              <lx-icon name="Tag" [size]="12" />{{ t }}
            </button>
          }
        </div>
      </div>

      <div>
        @if (selectedCount() > 0) {
          <div class="bulk-bar">
            <span style="font-size:13px;font-weight:600;color:var(--lx-accent-text)">{{ selectedCount() }} selected</span>
            <div class="spacer"></div>
            <button class="btn btn--subtle btn--sm" (click)="$event.stopPropagation(); clearSelection()">Clear</button>
            <button class="btn btn--subtle btn--sm" style="color:var(--lx-danger)" (click)="$event.stopPropagation(); pendingBulkDelete.set(true)">
              <lx-icon name="Trash2" [size]="14" />Delete selected
            </button>
          </div>
        }
        @if (loading()) {
          <lx-table-skeleton [rows]="8" [columns]="5" />
        } @else if (loadError()) {
          <lx-content-state
            kind="error"
            title="Could not load terms"
            description="The request failed. This is usually temporary."
            actionLabel="Try again"
            (acted)="reload()"
          />
        } @else {
        <table class="ttable" aria-label="Source strings">
          <thead>
            <tr>
              <th style="width:40px;padding-left:18px">
                <input type="checkbox" [checked]="allSelected()" (change)="toggleAll($event)" aria-label="Select all" />
              </th>
              <th>Key</th>
              <th>Source</th>
              <th style="width:150px">Tags</th>
              <th style="width:130px;text-align:right">Coverage</th>
              <th style="width:40px"></th>
            </tr>
          </thead>
          <tbody>
            @for (r of filtered(); track r.id) {
              <tr class="trow" [class.is-expanded]="expanded() === r.id" style="cursor:pointer" (click)="toggle(r.id)">
                <td style="padding-left:18px" (click)="$event.stopPropagation()">
                  <input type="checkbox" [checked]="selected().has(r.id)" (change)="toggleOne(r.id)" [attr.aria-label]="'Select ' + r.key" />
                </td>
                <td>
                  <div style="display:flex;align-items:center">
                    <span class="expand-toggle" [class.open]="expanded() === r.id"><lx-icon name="ChevronRight" [size]="15" /></span>
                    <div>
                      <div class="keytag">{{ r.key }}</div>
                      @if (r.plural) {
                        <div class="keysub"><lx-icon name="Variable" [size]="11" /> plural</div>
                      }
                    </div>
                  </div>
                </td>
                <td class="src" style="max-width:320px">{{ r.plural ? r.plural.one + ' / ' + r.plural.other : r.source }}</td>
                <td>
                  <div class="row" style="gap:4px;flex-wrap:wrap">
                    @for (t of r.tags; track t) {
                      <lx-tag>{{ t }}</lx-tag>
                    }
                    @if (r.isNew) {
                      <span class="chip chip--new">New</span>
                    }
                  </div>
                </td>
                <td>
                  <div class="covcell">
                    <span class="progress" style="width:64px;height:5px"><i class="seg-translated" [style.width.%]="covPct(r)"></i></span>
                    <span class="covnum">{{ doneCount(r) }}/{{ r.translations.length }}</span>
                  </div>
                </td>
                <td (click)="$event.stopPropagation()">
                  <button class="btn btn--subtle btn--sm btn--icon" aria-label="Delete term" (click)="pendingDelete.set(r)">
                    <lx-icon name="Trash2" [size]="15" color="var(--lx-muted)" />
                  </button>
                </td>
              </tr>
              @if (expanded() === r.id) {
                <tr class="trow-expand">
                  <td colspan="6">
                    <div class="expand-body">
                      <div class="row" style="margin-bottom:10px">
                        <div class="lx-eyebrow">
                          Translations · <span class="tnum">{{ doneCount(r) }}/{{ r.translations.length }}</span>
                        </div>
                        <div class="spacer"></div>
                        <button class="btn btn--subtle btn--sm" (click)="$event.stopPropagation(); openHistory(r)">
                          <lx-icon name="CalendarClock" [size]="13" />View full history
                        </button>
                      </div>
                      <div class="tr-table">
                        @for (t of r.translations; track t.code) {
                          <div class="tr-row">
                            <span class="locale">{{ t.code }}</span>
                            <span class="tr-name">{{ t.name }}</span>
                            <span
                              class="tr-value"
                              [style.color]="t.value ? 'var(--lx-ink)' : 'var(--lx-muted)'"
                              [style.font-style]="t.value ? 'normal' : 'italic'"
                            >{{ t.value || 'Untranslated' }}</span>
                            <span class="tr-author">
                              @if (t.modifiedBy; as m) {
                                <lx-avatar [i]="m.avatar" [name]="m.name" [sm]="true" />
                                <span class="tr-author-meta">
                                  <span class="tr-author-name">{{ m.name }}</span>
                                  <span class="muted tnum tr-author-at">{{ m.at }}</span>
                                </span>
                              } @else {
                                <span class="muted" style="font-size:12px">—</span>
                              }
                            </span>
                            <lx-status-chip [status]="t.status" />
                          </div>
                        }
                      </div>
                    </div>
                  </td>
                </tr>
              }
            }
            @if (!loading() && !loadError() && filtered().length === 0) {
              <tr>
                <td colspan="6" style="padding:0">
                  @if (rows().length === 0) {
                    <lx-content-state
                      kind="empty"
                      title="No terms yet"
                      description="Terms are the source strings your app shows. Add one, or import them from a file or POEditor."
                      actionLabel="Add term"
                      (acted)="adding.set(true)"
                    />
                  } @else {
                    <lx-content-state
                      kind="no-results"
                      title="No terms match these filters"
                      description="Nothing matches the current search, tag, and New-only combination."
                      actionLabel="Clear filters"
                      (acted)="clearFilters()"
                    />
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
        }
      </div>
      </div>
    </div>

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

    @if (pendingDelete(); as r) {
      <lx-confirm-dialog
        title="Delete this term?"
        [description]="'“' + r.key + '” and its translations in every language are deleted. This cannot be undone.'"
        confirmLabel="Delete term"
        (confirmed)="confirmDelete(r)"
        (cancelled)="pendingDelete.set(null)"
      />
    }

    @if (pendingBulkDelete()) {
      <lx-confirm-dialog
        title="Delete selected terms?"
        [description]="selectedCount() + ' terms and their translations in every language are deleted. This cannot be undone.'"
        confirmLabel="Delete terms"
        (confirmed)="confirmBulkDelete()"
        (cancelled)="pendingBulkDelete.set(false)"
      />
    }

    @if (historyTerm(); as h) {
      <lx-history-modal
        [projectId]="projectId()!"
        [termId]="h.id"
        [termKey]="h.key"
        (closed)="historyTerm.set(null)"
      />
    }
  `,
  styles: `
    .covcell {
      display: flex;
      align-items: center;
      gap: 9px;
      justify-content: flex-end;
    }
    .covnum {
      font: 500 12.5px var(--lx-mono);
      color: var(--lx-slate);
      width: 34px;
      text-align: right;
    }
    .bulk-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: var(--lx-accent-soft);
      border-bottom: 1px solid var(--lx-line);
    }
    .expand-body {
      padding: 16px 24px 20px 56px;
    }
    .tr-table {
      display: flex;
      flex-direction: column;
    }
    .tr-row {
      display: grid;
      grid-template-columns: 56px 120px 1fr 200px 120px;
      align-items: center;
      gap: 14px;
      padding: 9px 0;
      border-bottom: 1px solid var(--lx-line-2);
    }
    .tr-row:last-child {
      border-bottom: none;
    }
    .tr-name {
      font-size: 12.5px;
      color: var(--lx-slate);
    }
    .tr-value {
      font-size: 14px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tr-author {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .tr-author-meta {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .tr-author-name {
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tr-author-at {
      font-size: 12px;
    }
  `,
})
export class TermsScreen implements OnInit {
  private readonly api = inject(ApiService);
  private readonly state = inject(ProjectStateService);
  protected readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly rows = signal<TermView[]>([]);
  protected readonly query = signal('');
  protected readonly tag = signal<string | null>(null);
  protected readonly newOnly = signal(false);

  /** Optional ?new=1 deep link (sidebar quick filter); bound by the router. */
  readonly newParam = input<string | undefined>(undefined, { alias: 'new' });

  private readonly applyNewParam = effect(() => {
    if (this.newParam() === '1') this.newOnly.set(true);
  });
  protected readonly expanded = signal<string | null>(null);
  protected readonly historyTerm = signal<TermView | null>(null);
  protected readonly pendingDelete = signal<TermView | null>(null);
  protected readonly pendingBulkDelete = signal(false);
  protected readonly adding = signal(false);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly addTermFields = [
    { name: 'key', label: 'Key', placeholder: 'checkout.button.confirm', mono: true },
    { name: 'source', label: 'Source text (English)', placeholder: 'Confirm order' },
  ];
  protected readonly projectId = computed(() => this.state.current()?.id ?? null);
  protected readonly allTags = TAGS;
  protected readonly selected = signal<Set<string>>(new Set());
  protected readonly selectedCount = computed(() => this.selected().size);
  protected readonly allSelected = computed(() => {
    const f = this.filtered();
    return f.length > 0 && f.every((r) => this.selected().has(r.id));
  });

  protected readonly filtered = computed(() => {
    const q = this.query().toLowerCase();
    const tag = this.tag();
    const newOnly = this.newOnly();
    return this.rows().filter((r) => {
      if (newOnly && !r.isNew) return false;
      if (tag && !r.tags.includes(tag)) return false;
      if (q && !(r.key.includes(q) || r.source.toLowerCase().includes(q))) return false;
      return true;
    });
  });

  ngOnInit(): void {
    this.state.whenReady((pid) => this.load(pid));
  }

  private load(pid: string): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api.listTerms(pid).subscribe({
      next: (t) => {
        this.rows.set(t);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  protected reload(): void {
    const pid = this.state.current()?.id;
    if (pid) this.load(pid);
  }

  protected clearFilters(): void {
    this.query.set('');
    this.tag.set(null);
    this.newOnly.set(false);
  }

  /** Import lives in Settings, where the file and POEditor flows already are. */
  protected goImport(): void {
    this.router.navigate(['/', 'settings']);
    this.toast.show('Import lives under Settings → Import / Export');
  }

  protected createTerm(values: Record<string, string>): void {
    const pid = this.state.current()?.id;
    if (!pid) return;
    this.adding.set(false);
    this.api.createTerm(pid, { key: values['key'], source: values['source'] }).subscribe({
      next: () => {
        this.api.listTerms(pid).subscribe((t) => this.rows.set(t));
        this.toast.show('Term added');
      },
      error: () => this.toast.show({ message: 'That key already exists', tone: 'error' }),
    });
  }

  protected toggle(id: string): void {
    this.expanded.update((e) => (e === id ? null : id));
  }

  protected openHistory(term: TermView): void {
    this.historyTerm.set(term);
  }

  protected doneCount(r: TermView): number {
    return r.translations.filter((t) => t.value).length;
  }

  protected covPct(r: TermView): number {
    const total = r.translations.length;
    return total === 0 ? 0 : Math.round((this.doneCount(r) / total) * 100);
  }

  // ---- selection ----
  protected toggleOne(id: string): void {
    this.selected.update((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  protected toggleAll(e: Event): void {
    const checked = (e.target as HTMLInputElement).checked;
    this.selected.set(checked ? new Set(this.filtered().map((r) => r.id)) : new Set());
  }
  protected clearSelection(): void {
    this.selected.set(new Set());
  }

  // ---- delete ----
  /**
   * Deleting cascades in the database, so Undo cannot restore a term. Instead
   * the row leaves at once and the request is held back until the offer to undo
   * expires — the only way an Undo here can be honest.
   */
  protected confirmDelete(r: TermView): void {
    this.pendingDelete.set(null);
    const pid = this.state.current()?.id;
    if (!pid) return;

    const before = this.rows();
    this.rows.update((list) => list.filter((x) => x.id !== r.id));

    let undone = false;
    const timer = setTimeout(() => {
      if (undone) return;
      this.api.deleteTerm(pid, r.id).subscribe({
        error: () => {
          this.rows.set(before);
          this.toast.show({ message: 'Could not delete that term', tone: 'error' });
        },
      });
    }, 8000);

    this.toast.show({
      message: `Deleted ${r.key}`,
      actionLabel: 'Undo',
      action: () => {
        undone = true;
        clearTimeout(timer);
        this.rows.set(before);
      },
    });
  }

  protected confirmBulkDelete(): void {
    this.pendingBulkDelete.set(false);
    const ids = [...this.selected()];
    if (ids.length === 0) return;
    const pid = this.state.current()?.id;
    if (!pid) return;

    const before = this.rows();
    this.rows.update((list) => list.filter((x) => !ids.includes(x.id)));
    this.clearSelection();

    let undone = false;
    const timer = setTimeout(() => {
      if (undone) return;
      // Every id is attempted; the ones that fail come back and stay selected.
      Promise.allSettled(
        ids.map(
          (id) =>
            new Promise<string>((resolve, reject) =>
              this.api.deleteTerm(pid, id).subscribe({ next: () => resolve(id), error: reject }),
            ),
        ),
      ).then((results) => {
        const failed = ids.filter((_, i) => results[i].status === 'rejected');
        if (failed.length === 0) return;
        this.rows.set(before.filter((r) => !ids.includes(r.id) || failed.includes(r.id)));
        this.selected.set(new Set(failed));
        this.toast.show({
          message: `${failed.length} of ${ids.length} terms could not be deleted`,
          tone: 'error',
        });
      });
    }, 8000);

    this.toast.show({
      message: `Deleted ${ids.length} terms`,
      actionLabel: 'Undo',
      action: () => {
        undone = true;
        clearTimeout(timer);
        this.rows.set(before);
        this.selected.set(new Set(ids));
      },
    });
  }
}
