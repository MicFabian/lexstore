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
import { Icon } from './icon';
import { Avatar } from './primitives';
import { ApiService } from '../core/api.service';
import { TranslationHistoryEntry } from '../core/models';

const ACTION_META: Record<string, { label: string; icon: 'PencilLine' | 'CheckCheck' | 'Flag' | 'Sparkles' | 'X'; color: string }> = {
  translated: { label: 'Translated', icon: 'Sparkles', color: 'var(--tl-st-translated)' },
  edited: { label: 'Edited', icon: 'PencilLine', color: 'var(--tl-slate)' },
  proofread: { label: 'Proofread', icon: 'CheckCheck', color: 'var(--tl-st-proofread)' },
  flagged: { label: 'Flagged', icon: 'Flag', color: 'var(--tl-st-fuzzy)' },
  cleared: { label: 'Cleared', icon: 'X', color: 'var(--tl-st-untranslated)' },
};

@Component({
  selector: 'tl-history-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Avatar],
  template: `
    <div class="modal-backdrop" (click)="closed.emit()"></div>
    <div class="modal" role="dialog" aria-label="Translation history">
      <div class="modal__head">
        <div>
          <div class="modal__title">Translation history</div>
          <div class="modal__sub"><span class="keytag">{{ termKey() }}</span></div>
        </div>
        <div class="spacer"></div>
        <button class="btn btn--subtle btn--sm btn--icon" aria-label="Close" (click)="closed.emit()">
          <tl-icon name="X" [size]="16" />
        </button>
      </div>

      <div class="modal__body">
        @if (loading()) {
          <div class="muted" style="padding:24px;text-align:center">Loading…</div>
        } @else if (events().length === 0) {
          <div class="muted" style="padding:24px;text-align:center">
            No changes recorded yet for this term.
          </div>
        } @else {
          <div class="timeline">
            @for (e of events(); track $index) {
              <div class="event">
                <span class="event__rail">
                  <span class="event__dot" [style.background]="meta(e.action).color"></span>
                </span>
                <div class="event__body">
                  <div class="event__head">
                    <tl-avatar [i]="e.authorAvatar" [name]="e.authorName" [sm]="true" />
                    <b>{{ e.authorName }}</b>
                    <span class="event__action" [style.color]="meta(e.action).color">
                      <tl-icon [name]="meta(e.action).icon" [size]="12" />
                      {{ meta(e.action).label }}
                    </span>
                    <span class="locale">{{ e.languageCode }}</span>
                    <div class="spacer"></div>
                    <span class="muted tnum event__time">{{ e.at }}</span>
                  </div>
                  @if (e.newValue || e.oldValue) {
                    <div class="event__diff">
                      @if (e.oldValue) {
                        <span class="diff-old">{{ e.oldValue }}</span>
                        <tl-icon name="ArrowRight" [size]="12" color="var(--tl-muted)" />
                      }
                      <span class="diff-new">{{ e.newValue || '—' }}</span>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 120;
      display: grid;
      place-items: center;
    }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: color-mix(in srgb, var(--tl-paper) 55%, transparent);
      backdrop-filter: blur(2px);
    }
    .modal {
      position: relative;
      width: min(560px, calc(100vw - 32px));
      max-height: min(640px, calc(100vh - 64px));
      display: flex;
      flex-direction: column;
      background: var(--tl-elev, var(--tl-card));
      border: 1px solid var(--tl-line);
      border-radius: var(--tl-r-xl);
      box-shadow: var(--tl-shadow-pop);
      animation: modalIn 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    @keyframes modalIn {
      from { opacity: 0; transform: translateY(6px) scale(0.99); }
      to { opacity: 1; transform: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      .modal { animation: none; }
    }
    .modal__head {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 18px;
      border-bottom: 1px solid var(--tl-line);
    }
    .modal__title { font-size: 15px; font-weight: 700; }
    .modal__sub { margin-top: 4px; }
    .modal__body { overflow-y: auto; padding: 8px 18px 18px; }
    .timeline { display: flex; flex-direction: column; }
    .event { display: flex; gap: 12px; }
    .event__rail {
      position: relative;
      width: 10px;
      flex: none;
      display: flex;
      justify-content: center;
    }
    .event__rail::before {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      width: 1px;
      background: var(--tl-line);
    }
    .event:first-child .event__rail::before { top: 18px; }
    .event:last-child .event__rail::before { bottom: calc(100% - 18px); }
    .event__dot {
      position: relative;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-top: 14px;
      box-shadow: 0 0 0 3px var(--tl-elev, var(--tl-card));
    }
    .event__body { flex: 1; min-width: 0; padding: 10px 0; }
    .event__head { display: flex; align-items: center; gap: 7px; font-size: 12.5px; }
    .event__head b { font-weight: 600; }
    .event__action {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 11px;
      font-weight: 600;
    }
    .event__time { font-size: 11px; }
    .event__diff {
      display: flex;
      align-items: center;
      gap: 7px;
      margin-top: 6px;
      font-size: 12.5px;
      flex-wrap: wrap;
    }
    .diff-old {
      color: var(--tl-muted);
      text-decoration: line-through;
      text-decoration-color: color-mix(in srgb, var(--tl-muted) 60%, transparent);
    }
    .diff-new { color: var(--tl-ink); }
  `,
})
export class HistoryModal {
  private readonly api = inject(ApiService);

  readonly projectId = input.required<string>();
  readonly termId = input.required<string>();
  readonly termKey = input<string>('');
  readonly closed = output<void>();

  protected readonly events = signal<TranslationHistoryEntry[]>([]);
  protected readonly loading = signal(true);

  constructor() {
    effect(() => {
      const pid = this.projectId();
      const tid = this.termId();
      this.loading.set(true);
      this.api.termHistory(pid, tid).subscribe({
        next: (h) => {
          this.events.set(h);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    });
  }

  protected meta(action: string) {
    return ACTION_META[action] ?? ACTION_META['edited'];
  }
}
