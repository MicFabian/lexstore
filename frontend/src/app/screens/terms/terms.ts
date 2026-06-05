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
        <table class="ttable">
          <thead>
            <tr>
              <th style="width:40px;padding-left:18px"></th>
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
                <td style="padding-left:18px"></td>
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
                <td><tl-icon name="MoreHorizontal" [size]="16" color="var(--tl-muted)" /></td>
              </tr>
              @if (expanded() === r.id) {
                <tr class="trow-expand">
                  <td colspan="6">
                    <div class="expand-grid">
                      <div>
                        <div class="tl-eyebrow" style="margin-bottom:8px">
                          Translations · <span class="tnum">{{ doneCount(r) }}/{{ r.translations.length }}</span>
                        </div>
                        @for (t of r.translations; track t.code) {
                          <div class="tr-line">
                            <span class="locale">{{ t.code }}</span>
                            <span class="muted" style="width:96px;font-size:12px;flex:none">{{ t.name }}</span>
                            <span
                              style="flex:1;font-size:13.5px"
                              [style.color]="t.value ? 'var(--tl-ink-80)' : 'var(--tl-muted)'"
                              [style.font-style]="t.value ? 'normal' : 'italic'"
                            >{{ t.value || 'Untranslated' }}</span>
                            <tl-status-chip [status]="t.status" />
                          </div>
                        }
                      </div>
                      <div>
                        <div class="row" style="margin-bottom:10px">
                          <div class="tl-eyebrow">Audit history</div>
                          <div class="spacer"></div>
                          <button class="btn btn--subtle btn--sm" (click)="$event.stopPropagation(); openHistory(r)">
                            <tl-icon name="CalendarClock" [size]="13" />View full history
                          </button>
                        </div>
                        <div class="card" style="padding:13px;display:flex;flex-direction:column;gap:14px;margin-bottom:14px">
                          @if (r.createdBy) {
                            <div class="audit-line">
                              <span class="audit-ico"><tl-icon name="Sparkles" [size]="13" color="var(--tl-slate)" /></span>
                              <div style="flex:1;min-width:0">
                                <div class="audit-label">Created</div>
                                <div class="row" style="gap:7px;margin-top:3px">
                                  <tl-avatar [i]="r.createdBy.avatar" [name]="r.createdBy.name" [sm]="true" />
                                  <span style="font-size:12.5px;font-weight:600">{{ r.createdBy.name }}</span>
                                </div>
                              </div>
                              <span class="muted tnum" style="font-size:11.5px">{{ r.createdAt }}</span>
                            </div>
                          }
                          <div style="height:1px;background:var(--tl-line-2)"></div>
                          @if (r.modifiedBy) {
                            <div class="audit-line">
                              <span class="audit-ico"><tl-icon name="PencilLine" [size]="13" color="var(--tl-slate)" /></span>
                              <div style="flex:1;min-width:0">
                                <div class="audit-label">Last modified</div>
                                <div class="row" style="gap:7px;margin-top:3px">
                                  <tl-avatar [i]="r.modifiedBy.avatar" [name]="r.modifiedBy.name" [sm]="true" />
                                  <span style="font-size:12.5px;font-weight:600">{{ r.modifiedBy.name }}</span>
                                </div>
                              </div>
                              <span class="muted tnum" style="font-size:11.5px">{{ r.modifiedAt }}</span>
                            </div>
                          }
                        </div>
                        <div style="display:flex;flex-direction:column;gap:11px;padding-left:4px">
                          @for (h of r.history; track $index) {
                            <div class="row" style="gap:9px;align-items:flex-start">
                              <span class="hist-dot" [style.background]="$index === 0 ? 'var(--tl-accent)' : 'var(--tl-line)'"></span>
                              <div style="font-size:12.5px;line-height:1.4;flex:1">
                                <b style="font-weight:600">{{ h.name }}</b> <span class="muted">{{ h.action }}</span>
                                <div class="muted tnum" style="font-size:11px;margin-top:1px">{{ h.at }}</div>
                              </div>
                            </div>
                          }
                        </div>
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
    .expand-grid {
      display: grid;
      grid-template-columns: 1.5fr 1fr;
      gap: 28px;
      padding: 18px 24px 22px 56px;
    }
    .audit-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 600;
      color: var(--tl-muted);
    }
    .hist-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      margin-top: 6px;
      flex: none;
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
}
