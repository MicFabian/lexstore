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
import { Avatar, Btn, StatusChip } from '../../shared/primitives';
import { ConflictNotice } from '../../shared/conflict-notice';
import { PlaceholderCheck } from '../../shared/placeholder-check';
import { Provenance } from '../../shared/provenance';
import { HistoryModal } from '../../shared/history-modal';
import { PromptDialog } from '../../shared/prompt-dialog';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { ProjectStateService } from '../../core/project-state.service';
import { ProofreadResult, CommentView, EditorRow, TranslationStatus } from '../../core/models';

@Component({
  selector: 'lx-inspector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Btn, StatusChip, Avatar, ConflictNotice, PlaceholderCheck, Provenance, HistoryModal, PromptDialog],
  template: `
    <div class="inspector">
      <div class="inspector__head">
        <lx-status-chip [status]="row().status" />
        @if (row().isNew) {
          <span class="chip chip--new">New</span>
        }
        <div class="spacer"></div>
        <lx-btn variant="subtle" [sm]="true" [iconOnly]="true" icon="X" ariaLabel="Close" (clicked)="closed.emit()" />
      </div>

      <div class="inspector__body">
        <div>
          <div class="lx-eyebrow" style="margin-bottom:6px">Key</div>
          <div class="keytag" style="font-size:13px">{{ row().key }}</div>
          <div class="row" style="margin-top:4px;gap:6px">
            <span class="muted" style="font-size:12px">Context ·</span>
            <input
              class="ctx-input"
              [value]="ctx()"
              (input)="ctx.set($any($event.target).value)"
              (blur)="saveContext()"
              placeholder="Add context…"
            />
          </div>
          <div class="row" style="gap:5px;margin-top:8px;flex-wrap:wrap">
            @for (t of tags(); track t) {
              <span class="lx-tag-edit">
                {{ t }}
                <button class="tag-x" aria-label="Remove tag" (click)="removeTag(t)"><lx-icon name="X" [size]="11" /></button>
              </span>
            }
            <button class="btn btn--subtle btn--sm" style="height:20px;padding:0 6px" aria-label="Add a tag" (click)="addingTag.set(true)">
              <lx-icon name="Plus" [size]="12" />
            </button>
          </div>
        </div>

        <div>
          <div class="lx-eyebrow" style="margin-bottom:6px">Source — <span class="locale">en</span></div>
          <div class="card" style="padding:11px 13px;font-size:13.5px;line-height:1.5;background:var(--lx-bg-page)">
            {{ row().plural ? row().plural!.one + ' / ' + row().plural!.other : row().source }}
          </div>
        </div>

        <div class="field">
          <div class="tfield__head">
            <label for="lx-translation">Translation</label>
            <span style="position:relative;margin-left:auto">
              <button
                class="btn btn--subtle btn--sm lang-pick"
                [attr.aria-expanded]="langMenuOpen()"
                (click)="langMenuOpen.set(!langMenuOpen())"
              >
                <span class="locale">{{ lang() }}</span>
                {{ langName() }}
                <lx-icon name="ChevronDown" [size]="13" color="var(--lx-text-muted)" />
              </button>
              @if (langMenuOpen()) {
                <span class="menu-backdrop" (click)="langMenuOpen.set(false)"></span>
                <span class="menu" style="top:calc(100% + 4px);right:0;min-width:190px">
                  <span class="menu__label">Edit language</span>
                  @for (l of languages(); track l.code) {
                    <button class="menu__item" [class.on]="l.code === lang()" (click)="pickLang(l.code)">
                      <span class="locale">{{ l.code }}</span>
                      <span>{{ l.name }}</span>
                      @if (l.code === lang()) {
                        <lx-icon name="Check" [size]="14" color="var(--lx-accent-hover)" style="margin-left:auto" />
                      }
                    </button>
                  }
                </span>
              }
            </span>
          </div>
          <textarea
            id="lx-translation"
            class="textarea"
            rows="3"
            (keydown)="onTranslationKey($event)"
            [value]="value()"
            (input)="value.set($any($event.target).value)"
            placeholder="Type the translation…"
          ></textarea>
          <lx-placeholder-check [source]="checkSource()" [value]="value()" />
        </div>

        @if (conflict(); as c) {
          <lx-conflict-notice
            [value]="c.target"
            [author]="c.modifiedBy?.name ?? null"
            [at]="c.modifiedAt"
            (tookTheirs)="takeTheirs()"
            (keptMine)="keepMine()"
          />
        }

        <div class="row insp-actions" style="gap:8px">
          <lx-btn variant="primary" [sm]="true" icon="Check" [disabled]="!value()" (clicked)="save(value() ? 'translated' : 'untranslated')">
            Save
          </lx-btn>
          <lx-btn variant="ghost" [sm]="true" icon="ArrowRight" [disabled]="!value()" (clicked)="saveAndNext()">
            Save &amp; next
          </lx-btn>
          <lx-btn variant="ghost" [sm]="true" icon="CheckCheck" [disabled]="!value()" (clicked)="save('proofread')">
            Proofread
          </lx-btn>
          <lx-btn variant="subtle" [sm]="true" icon="Flag" [disabled]="!value()" (clicked)="save('fuzzy')">
            Flag
          </lx-btn>
        </div>

        <div class="helper suggestor" aria-live="polite">
          <div class="helper__head">
            <lx-icon name="WandSparkles" [size]="14" color="var(--lx-text-secondary)" />
            <span class="helper__title">Translation helper</span>
            <div class="spacer"></div>
            <button class="btn btn--subtle btn--sm" [disabled]="suggestBusy()" (click)="fetchSuggestion()">
              {{ suggestBusy() ? 'Thinking…' : suggestion() ? 'Regenerate' : 'Suggest' }}
            </button>
          </div>
          @if (suggestion(); as s) {
            <div class="helper__body">
              <div class="helper__text">{{ s }}</div>
              @if (suggestionMeta(); as m) {
                <div class="helper__meta">{{ m }}</div>
              }
              <div class="row" style="gap:8px;margin-top:10px">
                <lx-btn variant="ghost" [sm]="true" icon="Check" (clicked)="applySuggestion(s)">Use it</lx-btn>
                <lx-btn variant="subtle" [sm]="true" icon="Plus" (clicked)="appendSuggestion(s)">Append</lx-btn>
              </div>
            </div>
          } @else {
            <div class="helper__hint">
              Machine-translate <span class="locale">{{ lang() }}</span> from the English source, then edit before saving.
            </div>
          }
        </div>

        <div class="helper proofread" aria-live="polite">
          <div class="helper__head">
            <lx-icon name="Eye" [size]="14" color="var(--lx-text-secondary)" />
            <span class="helper__title">Proofreader</span>
            <div class="spacer"></div>
            <button
              class="btn btn--subtle btn--sm"
              [disabled]="proofBusy() || !value()"
              (click)="runProofread()"
            >
              {{ proofBusy() ? 'Reviewing…' : 'Review' }}
            </button>
          </div>
          @if (proof(); as p) {
            <div class="helper__body">
              <div class="verdict" [class.verdict--ok]="p.verdict === 'good'">
                {{ p.verdict === 'good' ? 'Reads well' : 'Needs work' }}
                <span class="helper__meta">· checked by {{ p.provider }}</span>
              </div>
              @for (i of p.issues; track $index) {
                <div class="issue" [class.issue--major]="i.severity === 'major'">
                  <span class="issue__kind">{{ i.kind }}</span>
                  <span>{{ i.message }}</span>
                </div>
              }
              @if (p.issues.length === 0) {
                <div class="helper__hint">Nothing to flag.</div>
              }
              @if (p.suggestion; as fix) {
                <div class="helper__text" style="margin-top:10px">{{ fix }}</div>
                <div class="row" style="gap:8px;margin-top:8px">
                  <lx-btn variant="ghost" [sm]="true" icon="Check" (clicked)="applySuggestion(fix)">
                    Use correction
                  </lx-btn>
                </div>
              }
            </div>
          } @else {
            <div class="helper__hint">
              Check placeholders, glossary terms, grammar and tone against the source.
            </div>
          }
        </div>

        <div class="lastedit">
          @if (row().origin === 'ai') {
            <lx-provenance label="Machine draft" [detail]="row().modifiedAt" />
          } @else if (row().modifiedBy; as m) {
            <lx-avatar [i]="m.avatar" [name]="m.name" [sm]="true" />
            <span class="lastedit__text">
              Last edited by <b>{{ m.name }}</b> · {{ row().modifiedAt }}
            </span>
          } @else {
            <span class="muted" style="font-size:12px">Not yet translated.</span>
          }
          <div class="spacer"></div>
          <button class="btn btn--subtle btn--sm" (click)="showHistory.set(true)">
            <lx-icon name="CalendarClock" [size]="13" />History
          </button>
        </div>

        <div class="divider"></div>

        <div>
          <div class="lx-eyebrow" style="margin-bottom:12px">
            Comments
            @if (comments().length) {
              <span class="tnum" style="color:var(--lx-text-muted)">· {{ comments().length }}</span>
            }
          </div>
          <div style="display:flex;flex-direction:column;gap:14px">
            @for (c of comments(); track c.id) {
              <div class="row" style="gap:10px;align-items:flex-start">
                <lx-avatar [i]="c.authorAvatar" [name]="c.authorName" [sm]="true" />
                <div style="font-size:12.5px;line-height:1.45;flex:1">
                  <div class="row" style="gap:6px">
                    <b style="font-weight:600">{{ c.authorName }}</b>
                    <span class="muted" style="font-size:11.5px">{{ c.time }}</span>
                    <div class="spacer"></div>
                    <button class="btn btn--subtle btn--sm btn--icon" style="height:24px;width:24px" aria-label="Delete comment" (click)="deleteComment(c)">
                      <lx-icon name="Trash2" [size]="12" color="var(--lx-text-muted)" />
                    </button>
                  </div>
                  <div style="color:var(--lx-text-secondary);margin-top:2px">{{ c.text }}</div>
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
            <lx-btn variant="ghost" [sm]="true" [iconOnly]="true" icon="SendHorizontal" ariaLabel="Send" (clicked)="addComment()" />
          </div>
        </div>
      </div>
    </div>

    @if (addingTag()) {
      <lx-prompt-dialog
        title="Add a tag"
        description="Tags group terms across features — checkout, billing, legal."
        [fields]="tagFields"
        submitLabel="Add tag"
        (submitted)="createTag($event)"
        (cancelled)="addingTag.set(false)"
      />
    }

    @if (showHistory()) {
      <lx-history-modal
        [projectId]="projectId()!"
        [termId]="row().id"
        [termKey]="row().key"
        (closed)="showHistory.set(false)"
      />
    }
  `,
  styles: `
    .verdict {
      font-size: 13px;
      font-weight: 600;
      color: var(--lx-unsure);
      margin-bottom: 8px;
    }
    .verdict--ok {
      color: var(--lx-translated);
    }
    .issue {
      display: flex;
      gap: 8px;
      align-items: baseline;
      font-size: 12.5px;
      padding: 6px 0;
      border-top: 1px solid var(--lx-line);
    }
    .issue--major .issue__kind {
      color: var(--lx-danger);
    }
    .issue__kind {
      font-size: 10.5px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--lx-text-secondary);
      flex: none;
      min-width: 76px;
    }
    .insp-actions {
      flex-wrap: wrap;
      row-gap: 8px;
    }
    .ctx-input {
      flex: 1;
      border: none;
      background: none;
      font-family: inherit;
      font-size: 12px;
      color: var(--lx-text-secondary);
      outline: none;
      border-bottom: 1px solid transparent;
      padding: 1px 0;
    }
    .ctx-input:focus {
      border-bottom-color: var(--lx-accent);
    }
    .ctx-input::placeholder {
      color: var(--lx-text-muted);
    }
    .lx-tag-edit {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      height: 20px;
      padding: 0 4px 0 7px;
      border-radius: 5px;
      background: var(--lx-surface-hover);
      border: 1px solid var(--lx-line);
      font-size: 11.5px;
      font-weight: 600;
      color: var(--lx-text-secondary);
    }
    .tag-x {
      border: none;
      background: none;
      padding: 0;
      cursor: pointer;
      display: grid;
      place-items: center;
      width: 24px;
      height: 24px;
      margin: -2px -6px -2px 0;
      color: var(--lx-text-muted);
    }
    .tag-x:hover {
      color: var(--lx-danger);
    }
    .lastedit {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .lastedit__text {
      font-size: 12px;
      color: var(--lx-text-secondary);
    }
    .lastedit__text b {
      color: var(--lx-text-primary);
      font-weight: 600;
    }
    .lang-pick {
      font-weight: 600;
      text-transform: none;
      letter-spacing: 0;
    }
    .helper {
      border: 1px solid var(--lx-line);
      border-radius: var(--lx-radius-3);
      background: var(--lx-bg-page);
      padding: 11px 13px;
    }
    .tfield__head {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    .tfield__head label {
      margin: 0;
    }
    .helper__head {
      display: flex;
      align-items: center;
      gap: 7px;
    }
    .helper__title {
      font-size: 11px;
      font-weight: 700;
      color: var(--lx-text-secondary);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .helper__body {
      margin-top: 10px;
    }
    .helper__text {
      font-size: 13.5px;
      line-height: 1.5;
      color: var(--lx-text-primary);
    }
    .helper__meta,
    .helper__hint {
      font-size: 11.5px;
      color: var(--lx-text-secondary);
      margin-top: 4px;
    }
    .helper__hint {
      margin-top: 8px;
    }
  `,
})
export class Inspector {
  private readonly api = inject(ApiService);
  private readonly state = inject(ProjectStateService);
  private readonly toast = inject(ToastService);

  readonly row = input.required<EditorRow>();
  /** The language column this inspector opened on — editable via the picker. */
  readonly lang = input.required<string>();
  readonly languages = input<{ code: string; name: string }[]>([]);
  readonly langChanged = output<string>();
  /** Asks the editor to move on to the next row that still needs work. */
  readonly savedAndNext = output<void>();
  readonly closed = output<void>();
  readonly saved = output<EditorRow>();
  /** The row was refreshed from the server without a save of ours — no toast. */
  readonly refreshed = output<EditorRow>();

  protected readonly langMenuOpen = signal(false);
  protected readonly langName = computed(
    () => this.languages().find((l) => l.code === this.lang())?.name ?? this.lang(),
  );

  protected readonly value = signal('');
  protected readonly draft = signal('');
  protected readonly comments = signal<CommentView[]>([]);
  protected readonly proof = signal<ProofreadResult | null>(null);
  protected readonly proofBusy = signal(false);
  protected readonly showHistory = signal(false);
  protected readonly suggestion = signal<string | null>(null);
  protected readonly suggestionMeta = signal<string | null>(null);
  protected readonly suggestBusy = signal(false);
  protected readonly ctx = signal('');
  protected readonly tags = signal<string[]>([]);
  protected readonly addingTag = signal(false);
  protected readonly tagFields = [{ name: 'tag', label: 'Tag', placeholder: 'checkout' }];

  /** Their version of the row after a 409 — what won the race. */
  protected readonly conflict = signal<EditorRow | null>(null);
  /** The status the rejected save asked for, so "keep mine" retries it. */
  private pendingStatus: TranslationStatus = 'translated';

  protected readonly projectId = computed(() => this.state.current()?.id ?? null);

  /** Mirrors EditorService's proofread source: every plural form joins in,
      because checking the singular alone would miss {count}. */
  protected readonly checkSource = computed(() => {
    const r = this.row();
    const parts = [r.source, r.plural?.one, r.plural?.other].filter(
      (s): s is string => !!s,
    );
    return [...new Set(parts)].join(' ');
  });

  constructor() {
    // Reset editable state whenever the selected row or language changes.
    effect(() => {
      const r = this.row();
      this.lang();
      this.value.set(r.target ?? '');
      this.langMenuOpen.set(false);
      this.draft.set('');
      this.comments.set([]);
      const pid = this.state.current()?.id;
      if (pid) {
        this.api.listComments(pid, r.id).subscribe((c) => this.comments.set(c));
      }
      this.ctx.set(r.ctx);
      this.tags.set([...r.tags]);
      this.showHistory.set(false);
      this.suggestion.set(null);
      this.suggestionMeta.set(null);
      this.proof.set(null);
      this.conflict.set(null);
    });
  }

  // ---- term-detail editing ----
  private patchTerm(body: { ctx?: string; tags?: string[] }): void {
    const pid = this.projectId();
    if (!pid) return;
    this.api.updateTerm(pid, this.row().id, body).subscribe({
      error: () => {},
    });
  }

  protected saveContext(): void {
    if (this.ctx() !== this.row().ctx) this.patchTerm({ ctx: this.ctx() });
  }

  protected createTag(values: Record<string, string>): void {
    this.addingTag.set(false);
    const t = values['tag']?.trim().toLowerCase();
    if (!t || this.tags().includes(t)) return;
    const next = [...this.tags(), t];
    this.tags.set(next);
    this.patchTerm({ tags: next });
  }

  protected removeTag(tag: string): void {
    const next = this.tags().filter((t) => t !== tag);
    this.tags.set(next);
    this.patchTerm({ tags: next });
  }

  protected deleteComment(c: CommentView): void {
    const pid = this.projectId();
    if (!pid) return;
    this.api.deleteComment(pid, this.row().id, c.id).subscribe({
      next: () => this.comments.update((list) => list.filter((x) => x.id !== c.id)),
      error: () => {},
    });
  }

  protected pickLang(code: string): void {
    this.langMenuOpen.set(false);
    if (code !== this.lang()) this.langChanged.emit(code);
  }

  protected applySuggestion(text: string): void {
    this.value.set(text);
  }

  protected appendSuggestion(text: string): void {
    const current = this.value().trim();
    this.value.set(current ? `${current} ${text}` : text);
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

  /** Cmd/Ctrl+Enter saves and moves on — the translator's main loop. */
  protected onTranslationKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      this.saveAndNext();
    }
  }

  protected saveAndNext(): void {
    if (!this.value()) return;
    this.save('translated');
    this.savedAndNext.emit();
  }

  protected save(status: TranslationStatus, version: number | null = this.row().version): void {
    const pid = this.state.current()?.id;
    if (!pid) return;
    // Save & next moves the selection before this response lands; everything
    // about the request is captured now so a late 409 cannot attach itself to
    // whichever row the inspector shows by then.
    const row = this.row();
    const lang = this.lang();
    const val = this.value() || null;
    this.api
      .saveTranslation(pid, row.id, lang, {
        value: val,
        status,
        version,
      })
      .subscribe({
        next: (updated) => {
          this.conflict.set(null);
          this.saved.emit(updated);
        },
        error: (err) => {
          if (err?.status === 409) {
            this.pendingStatus = status;
            this.loadConflict(row, lang);
            return;
          }
          this.toast.show({ message: 'That translation could not be saved.', tone: 'error' });
        },
      });
  }

  /** Still looking at the cell whose save conflicted? */
  private stillOn(row: EditorRow, lang: string): boolean {
    return this.row().id === row.id && this.lang() === lang;
  }

  /** A 409 names no winner — fetch their version so the notice can show it. */
  private loadConflict(row: EditorRow, lang: string): void {
    const pid = this.projectId();
    if (!pid) return;
    // The selection already moved on: the inline notice would point at the
    // wrong row, so the conflict is reported by name instead.
    if (!this.stillOn(row, lang)) {
      this.conflictToast(row, lang);
      return;
    }
    this.api.editor(pid, lang, { q: row.key }).subscribe({
      next: (res) => {
        const theirs = res.rows.find((r) => r.id === row.id) ?? null;
        if (theirs && this.stillOn(row, lang)) {
          this.conflict.set(theirs);
        } else {
          this.conflictToast(row, lang);
        }
      },
      error: () => this.conflictToast(row, lang),
    });
  }

  private conflictToast(row: EditorRow, lang: string): void {
    this.toast.show({
      message: `Someone else saved ${row.key} · ${lang} first — their version stands.`,
      tone: 'error',
    });
  }

  /** Their version wins: adopt it, and the row is up to date without a save. */
  protected takeTheirs(): void {
    const theirs = this.conflict();
    if (!theirs) return;
    this.conflict.set(null);
    this.value.set(theirs.target ?? '');
    this.refreshed.emit(theirs);
  }

  /** Mine wins, knowingly: retry the save against their version number. */
  protected keepMine(): void {
    const theirs = this.conflict();
    if (!theirs) return;
    this.conflict.set(null);
    this.save(this.pendingStatus, theirs.version);
  }

  /** Review what is stored, not what is typed but unsaved. */
  protected runProofread(): void {
    const pid = this.state.current()?.id;
    if (!pid || this.proofBusy()) return;
    this.proofBusy.set(true);
    this.api.proofread(pid, this.lang(), this.row().id).subscribe({
      next: (r) => {
        this.proof.set(r);
        this.proofBusy.set(false);
      },
      error: () => {
        this.proofBusy.set(false);
        this.toast.show({ message: 'That review could not be run.', tone: 'error' });
      },
    });
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
