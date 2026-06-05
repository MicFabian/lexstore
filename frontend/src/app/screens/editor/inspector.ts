import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Icon } from '../../shared/icon';
import { Avatar, Btn, StatusChip, Tag } from '../../shared/primitives';
import { HistoryModal } from '../../shared/history-modal';
import { ApiService } from '../../core/api.service';
import { ProjectStateService } from '../../core/project-state.service';
import { CommentView, EditorRow, TranslationStatus } from '../../core/models';

@Component({
  selector: 'tl-inspector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Btn, StatusChip, Avatar, Tag, HistoryModal],
  template: `
    <div class="inspector">
      <div class="inspector__head">
        <tl-status-chip [status]="row().status" />
        @if (row().isNew) {
          <span class="chip chip--new">New</span>
        }
        <div class="spacer"></div>
        <tl-btn variant="subtle" [sm]="true" [iconOnly]="true" icon="X" ariaLabel="Close" (clicked)="closed.emit()" />
      </div>

      <div class="inspector__body">
        <div>
          <div class="tl-eyebrow" style="margin-bottom:6px">Key</div>
          <div class="keytag" style="font-size:13px">{{ row().key }}</div>
          <div class="muted" style="font-size:12px;margin-top:4px">Context · {{ row().ctx }}</div>
          @if (row().tags.length) {
            <div class="row" style="gap:5px;margin-top:8px;flex-wrap:wrap">
              @for (t of row().tags; track t) {
                <tl-tag>{{ t }}</tl-tag>
              }
            </div>
          }
        </div>

        <div>
          <div class="tl-eyebrow" style="margin-bottom:6px">Source — <span class="locale">en</span></div>
          <div class="card" style="padding:11px 13px;font-size:13.5px;line-height:1.5;background:var(--tl-paper)">
            {{ row().plural ? row().plural!.one + ' / ' + row().plural!.other : row().source }}
          </div>
        </div>

        <div class="field">
          <label>Translation — <span class="locale">{{ lang() }}</span></label>
          <textarea
            class="textarea"
            rows="3"
            [value]="value()"
            (input)="value.set($any($event.target).value)"
            placeholder="Type the translation…"
          ></textarea>
        </div>

        @if (suggestion(); as s) {
          <button class="card suggestion" (click)="value.set(s)">
            <tl-icon name="WandSparkles" [size]="16" color="var(--tl-st-fuzzy)" style="margin-top:1px" />
            <div>
              <div class="suggestion-label">
                Machine suggestion
                @if (suggestionMeta(); as m) {
                  <span style="font-weight:500;text-transform:none;letter-spacing:0;opacity:.7"> · {{ m }}</span>
                }
              </div>
              <div style="font-size:13.5px;color:var(--tl-ink)">{{ s }}</div>
            </div>
          </button>
        } @else if (!row().target) {
          <button class="btn btn--subtle btn--sm" [disabled]="suggestBusy()" (click)="fetchSuggestion()" style="align-self:flex-start">
            <tl-icon name="WandSparkles" [size]="14" />{{ suggestBusy() ? 'Thinking…' : 'Suggest translation' }}
          </button>
        }

        <div class="row" style="gap:8px">
          <tl-btn variant="primary" [sm]="true" icon="Check" [disabled]="!value()" (clicked)="save(value() ? 'translated' : 'untranslated')">
            Save
          </tl-btn>
          <tl-btn variant="ghost" [sm]="true" icon="CheckCheck" [disabled]="!value()" (clicked)="save('proofread')">
            Proofread
          </tl-btn>
          <tl-btn variant="subtle" [sm]="true" icon="Flag" [disabled]="!value()" (clicked)="save('fuzzy')">
            Flag
          </tl-btn>
        </div>

        <div class="lastedit">
          @if (row().modifiedBy; as m) {
            <tl-avatar [i]="m.avatar" [name]="m.name" [sm]="true" />
            <span class="lastedit__text">
              Last edited by <b>{{ m.name }}</b> · {{ row().modifiedAt }}
            </span>
          } @else {
            <span class="muted" style="font-size:12px">Not yet translated.</span>
          }
          <div class="spacer"></div>
          <button class="btn btn--subtle btn--sm" (click)="showHistory.set(true)">
            <tl-icon name="CalendarClock" [size]="13" />History
          </button>
        </div>

        <div class="divider"></div>

        <div>
          <div class="tl-eyebrow" style="margin-bottom:12px">
            Comments
            @if (comments().length) {
              <span class="tnum" style="color:var(--tl-muted)">· {{ comments().length }}</span>
            }
          </div>
          <div style="display:flex;flex-direction:column;gap:14px">
            @for (c of comments(); track c.id) {
              <div class="row" style="gap:10px;align-items:flex-start">
                <tl-avatar [i]="c.authorAvatar" [name]="c.authorName" [sm]="true" />
                <div style="font-size:12.5px;line-height:1.45;flex:1">
                  <div class="row" style="gap:6px">
                    <b style="font-weight:600">{{ c.authorName }}</b>
                    <span class="muted" style="font-size:11.5px">{{ c.time }}</span>
                  </div>
                  <div style="color:var(--tl-ink-80);margin-top:2px">{{ c.text }}</div>
                </div>
              </div>
            }
            @if (comments().length === 0) {
              <div class="muted" style="font-size:12.5px">
                No comments yet. Start a discussion about this term.
              </div>
            }
          </div>
          <div class="row" style="gap:8px;margin-top:12px;align-items:flex-end">
            <textarea
              class="textarea"
              rows="1"
              style="resize:none"
              [value]="draft()"
              (input)="draft.set($any($event.target).value)"
              placeholder="Add a comment…"
              (keydown)="onCommentKey($event)"
            ></textarea>
            <tl-btn variant="ghost" [sm]="true" [iconOnly]="true" icon="SendHorizontal" ariaLabel="Send" (clicked)="addComment()" />
          </div>
        </div>
      </div>
    </div>

    @if (showHistory()) {
      <tl-history-modal
        [projectId]="projectId()!"
        [termId]="row().id"
        [termKey]="row().key"
        (closed)="showHistory.set(false)"
      />
    }
  `,
  styles: `
    .lastedit {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .lastedit__text {
      font-size: 12px;
      color: var(--tl-slate);
    }
    .lastedit__text b {
      color: var(--tl-ink);
      font-weight: 600;
    }
    .suggestion {
      padding: 11px 13px;
      text-align: left;
      cursor: pointer;
      display: flex;
      gap: 10px;
      align-items: flex-start;
      background: var(--tl-st-fuzzy-bg);
      border-color: transparent;
    }
    .suggestion-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--tl-st-fuzzy);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin-bottom: 3px;
    }
  `,
})
export class Inspector {
  private readonly api = inject(ApiService);
  private readonly state = inject(ProjectStateService);

  readonly row = input.required<EditorRow>();
  readonly lang = input.required<string>();
  readonly closed = output<void>();
  readonly saved = output<EditorRow>();

  protected readonly value = signal('');
  protected readonly draft = signal('');
  protected readonly comments = signal<CommentView[]>([]);
  protected readonly showHistory = signal(false);
  protected readonly suggestion = signal<string | null>(null);
  protected readonly suggestionMeta = signal<string | null>(null);
  protected readonly suggestBusy = signal(false);

  protected readonly projectId = computed(() => this.state.current()?.id ?? null);

  constructor() {
    // Reset editable state whenever the selected row changes.
    effect(() => {
      const r = this.row();
      this.value.set(r.target ?? '');
      this.draft.set('');
      this.comments.set(r.comments);
      this.showHistory.set(false);
      this.suggestion.set(null);
      this.suggestionMeta.set(null);
    });
  }

  protected fetchSuggestion(): void {
    const pid = this.projectId();
    if (!pid) return;
    this.suggestBusy.set(true);
    this.api.suggestTranslation(pid, this.row().id, this.lang()).subscribe({
      next: (s) => {
        this.suggestion.set(s.text);
        this.suggestionMeta.set(`${s.provider} · ${s.cacheHit ? 'cached' : 'fresh'}`);
        this.suggestBusy.set(false);
      },
      error: () => {
        this.suggestBusy.set(false);
      },
    });
  }

  protected save(status: TranslationStatus): void {
    const pid = this.state.current()?.id;
    if (!pid) return;
    const val = this.value() || null;
    this.api
      .saveTranslation(pid, this.row().id, this.lang(), { value: val, status })
      .subscribe((updated) => this.saved.emit(updated));
  }

  protected onCommentKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      this.addComment();
    }
  }

  protected addComment(): void {
    const text = this.draft().trim();
    if (!text) return;
    const pid = this.state.current()?.id;
    if (!pid) return;
    this.api.addComment(pid, this.row().id, { text }).subscribe((c) => {
      this.comments.update((list) => [...list, c]);
      this.draft.set('');
    });
  }
}
