import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Icon } from '../../shared/icon';
import { Avatar, Btn, SearchBox, StatusChip, Tag } from '../../shared/primitives';
import { HistoryModal } from '../../shared/history-modal';
import { ApiService } from '../../core/api.service';
import { ProjectStateService } from '../../core/project-state.service';
import { ToastService } from '../../core/toast.service';
import { TermView } from '../../core/models';

const TAGS = ['checkout', 'billing', 'auth', 'onboarding'];

@Component({
  selector: 'tl-terms-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Avatar, Btn, SearchBox, StatusChip, Tag, HistoryModal],
  template: `
    <div class="content content__pad">
      <div class="row" style="margin-bottom:6px">
        <div>
          <h1 class="tl-h1">Terms</h1>
          <p class="muted" style="font-size:13.5px;margin:4px 0 0">
            {{ rows().length }} source strings · <span class="locale">en</span> English. Manage the keys; translate them per language.
          </p>
        </div>
        <div class="spacer"></div>
        <tl-btn variant="ghost" icon="FileUp" (clicked)="toast.show('Import terms')">Import</tl-btn>
        <tl-btn variant="primary" icon="Plus" (clicked)="toast.show('Add term')">Add term</tl-btn>
      </div>

      <div class="row" style="margin:16px 0 12px;gap:8px;flex-wrap:wrap">
        <tl-search placeholder="Search terms" [value]="query()" [width]="220" (changed)="query.set($event)" />
        <button
          [class]="'btn btn--sm ' + (newOnly() ? 'btn--ghost' : 'btn--subtle')"
          [style.border-color]="newOnly() ? 'var(--tl-st-new)' : null"
          [style.color]="newOnly() ? 'var(--tl-st-new)' : null"
          (click)="newOnly.set(!newOnly())"
        >
          <tl-icon name="Sparkles" [size]="13" />New only
        </button>
        <div class="row" style="gap:6px;flex-wrap:wrap">
          <button
            [class]="'btn btn--sm ' + (tag() === null ? 'btn--ghost' : 'btn--subtle')"
            [style.border-color]="tag() === null ? 'var(--tl-accent)' : null"
            [style.color]="tag() === null ? 'var(--tl-accent-text)' : null"
            (click)="tag.set(null)"
          >
            All tags
          </button>
          @for (t of allTags; track t) {
            <button
              [class]="'btn btn--sm ' + (tag() === t ? 'btn--ghost' : 'btn--subtle')"
              [style.border-color]="tag() === t ? 'var(--tl-accent)' : null"
              [style.color]="tag() === t ? 'var(--tl-accent-text)' : null"
              (click)="tag.set(t)"
            >
              <tl-icon name="Tag" [size]="12" />{{ t }}
            </button>
          }
        </div>
      </div>

      <div class="panel">
        @if (selectedCount() > 0) {
          <div class="bulk-bar">
            <span style="font-size:13px;font-weight:600;color:var(--tl-accent-text)">{{ selectedCount() }} selected</span>
            <div class="spacer"></div>
            <button class="btn btn--subtle btn--sm" (click)="$event.stopPropagation(); clearSelection()">Clear</button>
            <button class="btn btn--subtle btn--sm" style="color:var(--tl-danger)" (click)="$event.stopPropagation(); deleteSelected()">
              <tl-icon name="Trash2" [size]="14" />Delete selected
            </button>
          </div>
        }
        <table class="ttable">
          <thead>
            <tr>
              <th style="width:40px;padding-left:18px">
                <input type="checkbox" [checked]="allSelected()" (change)="toggleAll($event)" aria-label="Select all" />
              </th>
              <th>Key</th>
              <th>Source text</th>
              <th>Tags</th>
              <th style="width:92px">Added</th>
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
                    <span class="expand-toggle" [class.open]="expanded() === r.id"><tl-icon name="ChevronRight" [size]="15" /></span>
                    <div>
                      <div class="keytag">{{ r.key }}</div>
                      @if (r.plural) {
                        <div class="keysub"><tl-icon name="Variable" [size]="11" /> plural</div>
                      }
                    </div>
                  </div>
                </td>
                <td class="src" style="max-width:320px">{{ r.plural ? r.plural.one + ' / ' + r.plural.other : r.source }}</td>
                <td>
                  <div class="row" style="gap:4px;flex-wrap:wrap">
                    @for (t of r.tags; track t) {
                      <tl-tag>{{ t }}</tl-tag>
                    }
                    @if (r.isNew) {
                      <span class="chip chip--new">New</span>
                    }
                  </div>
                </td>
                <td><span class="muted tnum" style="font-size:12px">{{ r.added }}</span></td>
                <td (click)="$event.stopPropagation()">
                  <button class="btn btn--subtle btn--sm btn--icon" aria-label="Delete term" (click)="deleteTerm(r)">
                    <tl-icon name="Trash2" [size]="15" color="var(--tl-muted)" />
                  </button>
                </td>
              </tr>
              @if (expanded() === r.id) {
                <tr class="trow-expand">
                  <td colspan="6">
                    <div class="expand-body">
                      <div class="row" style="margin-bottom:10px">
                        <div class="tl-eyebrow">
                          Translations · <span class="tnum">{{ doneCount(r) }}/{{ r.translations.length }}</span>
                        </div>
                        <div class="spacer"></div>
                        <button class="btn btn--subtle btn--sm" (click)="$event.stopPropagation(); openHistory(r)">
                          <tl-icon name="CalendarClock" [size]="13" />View full history
                        </button>
                      </div>
                      <div class="tr-table">
                        @for (t of r.translations; track t.code) {
                          <div class="tr-row">
                            <span class="locale">{{ t.code }}</span>
                            <span class="tr-name">{{ t.name }}</span>
                            <span
                              class="tr-value"
                              [style.color]="t.value ? 'var(--tl-ink)' : 'var(--tl-muted)'"
                              [style.font-style]="t.value ? 'normal' : 'italic'"
                            >{{ t.value || 'Untranslated' }}</span>
                            <span class="tr-author">
                              @if (t.modifiedBy; as m) {
                                <tl-avatar [i]="m.avatar" [name]="m.name" [sm]="true" />
                                <span class="tr-author-meta">
                                  <span class="tr-author-name">{{ m.name }}</span>
                                  <span class="muted tnum tr-author-at">{{ m.at }}</span>
                                </span>
                              } @else {
                                <span class="muted" style="font-size:12px">—</span>
                              }
                            </span>
                            <tl-status-chip [status]="t.status" />
                          </div>
                        }
                      </div>
                    </div>
                  </td>
                </tr>
              }
            }
            @if (filtered().length === 0) {
              <tr>
                <td colspan="6" style="padding:48px 16px;text-align:center">
                  <div class="tl-display-3" style="margin-bottom:6px;font-size:22px">No terms found</div>
                  <div class="muted" style="font-size:13.5px">Try another search, tag, or time range.</div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (historyTerm(); as h) {
      <tl-history-modal
        [projectId]="projectId()!"
        [termId]="h.id"
        [termKey]="h.key"
        (closed)="historyTerm.set(null)"
      />
    }
  `,
  styles: `
    .bulk-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: var(--tl-accent-soft);
      border-bottom: 1px solid var(--tl-line);
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
      border-bottom: 1px solid var(--tl-line-2);
    }
    .tr-row:last-child {
      border-bottom: none;
    }
    .tr-name {
      font-size: 12px;
      color: var(--tl-muted);
    }
    .tr-value {
      font-size: 13.5px;
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
      font-size: 12.5px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tr-author-at {
      font-size: 11px;
    }
  `,
})
export class TermsScreen implements OnInit {
  private readonly api = inject(ApiService);
  private readonly state = inject(ProjectStateService);
  protected readonly toast = inject(ToastService);

  protected readonly rows = signal<TermView[]>([]);
  protected readonly query = signal('');
  protected readonly tag = signal<string | null>(null);
  protected readonly newOnly = signal(false);
  protected readonly expanded = signal<string | null>(null);
  protected readonly historyTerm = signal<TermView | null>(null);
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
    this.state.whenReady((pid) => this.api.listTerms(pid).subscribe((t) => this.rows.set(t)));
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
  protected deleteTerm(r: TermView): void {
    if (!window.confirm(`Delete term "${r.key}" and all its translations?`)) return;
    const pid = this.state.current()?.id;
    if (!pid) return;
    this.api.deleteTerm(pid, r.id).subscribe({
      next: () => {
        this.rows.update((list) => list.filter((x) => x.id !== r.id));
        this.toast.show('Term deleted');
      },
      error: () => this.toast.show('Not allowed (needs admin)'),
    });
  }

  protected deleteSelected(): void {
    const ids = [...this.selected()];
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} terms?`)) return;
    const pid = this.state.current()?.id;
    if (!pid) return;
    let done = 0;
    for (const id of ids) {
      this.api.deleteTerm(pid, id).subscribe({
        next: () => {
          this.rows.update((list) => list.filter((x) => x.id !== id));
          if (++done === ids.length) {
            this.clearSelection();
            this.toast.show(`Deleted ${ids.length} terms`);
          }
        },
        error: () => this.toast.show('Not allowed (needs admin)'),
      });
    }
  }
}
