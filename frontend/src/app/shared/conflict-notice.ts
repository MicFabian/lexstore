import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Icon } from './icon';
import { Btn } from './primitives';

/**
 * A 409 made visible. Someone saved this translation while it was being
 * edited; instead of a toast that evaporates, show their version and make the
 * choice explicit — take theirs, or knowingly overwrite it. Danger tokens:
 * the palette reserves them for exactly this.
 */
@Component({
  selector: 'lx-conflict-notice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Btn],
  template: `
    <div class="conflict" role="alert">
      <div class="conflict__head">
        <lx-icon name="TriangleAlert" [size]="14" />
        <span>Saved by someone else while you edited</span>
      </div>
      <div class="conflict__value" [class.conflict__value--empty]="!value()">
        {{ value() || 'They emptied this translation.' }}
      </div>
      @if (meta(); as m) {
        <div class="conflict__meta">{{ m }}</div>
      }
      <div class="conflict__actions">
        <lx-btn variant="ghost" [sm]="true" icon="Check" (clicked)="tookTheirs.emit()">
          Take theirs
        </lx-btn>
        <lx-btn variant="danger" [sm]="true" (clicked)="keptMine.emit()">
          Overwrite with mine
        </lx-btn>
      </div>
    </div>
  `,
  styles: `
    .conflict {
      display: flex;
      flex-direction: column;
      gap: var(--lx-space-3);
      padding: var(--lx-space-5) var(--lx-space-6);
      border: var(--lx-hairline) solid var(--lx-danger-line);
      border-radius: var(--lx-radius-3);
      background: var(--lx-danger-soft);
    }
    .conflict__head {
      display: flex;
      align-items: center;
      gap: var(--lx-space-3);
      color: var(--lx-danger);
      font-size: var(--lx-size-12);
      font-weight: var(--lx-weight-medium);
    }
    .conflict__value {
      font-size: var(--lx-size-13);
      line-height: var(--lx-leading-body);
      color: var(--lx-text-primary);
    }
    .conflict__value--empty {
      color: var(--lx-text-muted);
      font-style: italic;
    }
    .conflict__meta {
      font-size: var(--lx-size-11);
      color: var(--lx-text-muted);
    }
    .conflict__actions {
      display: flex;
      gap: var(--lx-space-4);
      margin-top: var(--lx-space-2);
    }
  `,
})
export class ConflictNotice {
  /** Their version of the translation — what won the race. */
  readonly value = input<string | null>(null);
  readonly author = input<string | null>(null);
  readonly at = input<string | null>(null);
  readonly tookTheirs = output<void>();
  readonly keptMine = output<void>();

  protected readonly meta = computed(() => {
    const parts = [this.author(), this.at()].filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
  });
}
