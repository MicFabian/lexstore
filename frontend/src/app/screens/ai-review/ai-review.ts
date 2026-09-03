import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Btn } from '../../shared/primitives';
import { ContentState } from '../../shared/content-state';
import { PageHeader } from '../../shared/page-header';
import { Provenance } from '../../shared/provenance';
import { ApiService } from '../../core/api.service';
import { ProjectStateService } from '../../core/project-state.service';
import { ToastService } from '../../core/toast.service';
import { AiReviewRow, ProofreadResult } from '../../core/models';

/**
 * The queue of machine drafts a person has not looked at yet. Every row came
 * from an AI prompt; approving moves it to proofread, editing hands it to the
 * editor, and the proofreader checks placeholders, glossary and meaning.
 */
@Component({
  selector: 'lx-ai-review-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Btn, ContentState, PageHeader, Provenance],
  template: `
    <div class="well">
      <div class="pad">
        <lx-page-header
          [eyebrow]="project()?.name ?? null"
          heading="AI review"
          [sub]="rows().length + ' machine draft' + (rows().length === 1 ? '' : 's') + ' awaiting a person'"
        />

        @if (rows().length === 0 && loaded()) {
          <lx-content-state
            kind="empty"
            title="Nothing to review"
            description="Machine drafts land here until a person confirms them. Add a term with AI drafts, or run auto-translate."
          />
        }

        @for (r of rows(); track r.termId + r.languageCode) {
          <div class="draft" [class.draft--busy]="busyKey() === key(r)">
            <div class="draft__row">
              <div class="draft__text">
                <div class="keytag">{{ r.key }}</div>
                <div class="draft__source">{{ r.source }}</div>
                <div class="draft__value">
                  <span class="locale">{{ r.languageCode }}</span>
                  <span>{{ r.value }}</span>
                </div>
                <div class="draft__meta">
                  <lx-provenance label="AI draft" [detail]="r.provider + ' · ' + r.languageName + ' · ' + r.at" />
                </div>
              </div>
              <div class="draft__actions">
                <lx-btn variant="subtle" [sm]="true" icon="Search" (clicked)="proofread(r)">Proofread</lx-btn>
                <lx-btn variant="ghost" [sm]="true" (clicked)="edit(r)">Edit</lx-btn>
                <lx-btn variant="primary" [sm]="true" icon="Check" (clicked)="approve(r)">Approve</lx-btn>
              </div>
            </div>

            @if (verdicts()[key(r)]; as v) {
              <div class="verdict" [class]="'verdict verdict--' + v.verdict">
                <span class="stcap">{{ verdictLabel(v.verdict) }}</span>
                @for (i of v.issues; track i.message) {
                  <div class="verdict__issue">
                    <span class="stcap" [style.color]="i.severity === 'major' ? 'var(--lx-danger)' : 'var(--lx-unsure)'">{{ i.kind }}</span>
                    {{ i.message }}
                  </div>
                }
                @if (v.suggestion; as s) {
                  <div class="verdict__issue">
                    Suggestion: <em>{{ s }}</em>
                    <lx-btn variant="accent-quiet" [sm]="true" style="margin-left:8px" (clicked)="applySuggestion(r, s)">Use it</lx-btn>
                  </div>
                }
                @if (v.issues.length === 0 && !v.suggestion) {
                  <div class="verdict__issue">No issues found by {{ v.provider }}.</div>
                }
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .draft {
      border-bottom: var(--lx-hairline) solid var(--lx-border-divider);
      padding: var(--lx-space-6) 0;
    }
    .draft--busy {
      opacity: 0.5;
      pointer-events: none;
    }
    .draft__row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--lx-space-7);
    }
    .draft__text {
      display: flex;
      flex-direction: column;
      gap: var(--lx-space-3);
      min-width: 0;
    }
    .draft__source {
      font-size: var(--lx-size-13);
      color: var(--lx-text-secondary);
    }
    .draft__value {
      display: flex;
      align-items: baseline;
      gap: var(--lx-space-4);
      font-size: var(--lx-size-16);
      color: var(--lx-text-primary);
    }
    .draft__meta {
      font-size: var(--lx-size-11);
      color: var(--lx-text-muted);
    }
    .draft__actions {
      display: flex;
      gap: var(--lx-space-4);
      flex: none;
    }
    .verdict {
      margin-top: var(--lx-space-5);
      padding: var(--lx-space-5);
      border-radius: var(--lx-radius-2);
      border: var(--lx-hairline) solid var(--lx-border-card);
      background: var(--lx-surface-sunken);
      display: flex;
      flex-direction: column;
      gap: var(--lx-space-3);
      font-size: var(--lx-size-12);
    }
    .verdict--good {
      border-color: var(--lx-reviewed-line);
      background: var(--lx-reviewed-soft);
    }
    .verdict--good > .stcap {
      color: var(--lx-reviewed);
    }
    .verdict--needs_work {
      border-color: var(--lx-unsure-line);
      background: var(--lx-unsure-soft);
    }
    .verdict--needs_work > .stcap {
      color: var(--lx-unsure);
    }
    .verdict--wrong {
      border-color: var(--lx-danger-line);
      background: var(--lx-danger-soft);
    }
    .verdict--wrong > .stcap {
      color: var(--lx-danger);
    }
    .verdict__issue {
      color: var(--lx-text-primary);
    }
  `,
})
export class AiReviewScreen implements OnInit {
  private readonly api = inject(ApiService);
  private readonly state = inject(ProjectStateService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly project = this.state.current;
  protected readonly rows = signal<AiReviewRow[]>([]);
  protected readonly loaded = signal(false);
  protected readonly busyKey = signal<string | null>(null);
  protected readonly verdicts = signal<Record<string, ProofreadResult>>({});
  private readonly projectId = computed(() => this.state.current()?.id ?? null);

  ngOnInit(): void {
    if (!this.state.loaded()) this.state.load();
    this.reload();
  }

  protected key(r: AiReviewRow): string {
    return r.termId + ':' + r.languageCode;
  }

  private reload(): void {
    const pid = this.projectId();
    if (!pid) {
      setTimeout(() => this.reload(), 300);
      return;
    }
    this.api.aiReview(pid).subscribe((rows) => {
      this.rows.set(rows);
      this.loaded.set(true);
    });
  }

  protected proofread(r: AiReviewRow): void {
    const pid = this.projectId();
    if (!pid) return;
    this.busyKey.set(this.key(r));
    this.api.proofread(pid, r.languageCode, r.termId).subscribe({
      next: (v) => {
        this.busyKey.set(null);
        this.verdicts.update((m) => ({ ...m, [this.key(r)]: v }));
      },
      error: () => {
        this.busyKey.set(null);
        this.toast.show({ message: 'Proofread failed', tone: 'error' });
      },
    });
  }

  protected approve(r: AiReviewRow): void {
    const pid = this.projectId();
    if (!pid) return;
    this.busyKey.set(this.key(r));
    this.api
      .saveTranslation(pid, r.termId, r.languageCode, {
        value: r.value,
        status: 'proofread',
        version: r.version,
      })
      .subscribe({
        next: () => {
          this.busyKey.set(null);
          this.rows.update((rows) => rows.filter((x) => this.key(x) !== this.key(r)));
          this.toast.show(`Proofread · ${r.key} · ${r.languageCode}`);
        },
        error: () => {
          this.busyKey.set(null);
          this.toast.show({ message: 'That draft changed in the meantime — reload', tone: 'error' });
        },
      });
  }

  protected applySuggestion(r: AiReviewRow, suggestion: string): void {
    const pid = this.projectId();
    if (!pid) return;
    this.busyKey.set(this.key(r));
    this.api
      .saveTranslation(pid, r.termId, r.languageCode, {
        value: suggestion,
        status: 'proofread',
        version: r.version,
      })
      .subscribe({
        next: () => {
          this.busyKey.set(null);
          this.rows.update((rows) => rows.filter((x) => this.key(x) !== this.key(r)));
          this.toast.show(`Proofread with the suggestion · ${r.key}`);
        },
        error: () => {
          this.busyKey.set(null);
          this.toast.show({ message: 'That draft changed in the meantime — reload', tone: 'error' });
        },
      });
  }

  protected edit(r: AiReviewRow): void {
    this.router.navigate(['/', 'editor'], { queryParams: { lang: r.languageCode, q: r.key } });
  }

  protected verdictLabel(v: ProofreadResult['verdict']): string {
    return v === 'good' ? 'Looks good' : v === 'needs_work' ? 'Needs work' : 'Wrong';
  }
}
