import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon, IconName } from './icon';
import { Btn } from './primitives';

export type ContentStateKind = 'empty' | 'no-results' | 'error' | 'forbidden';

const ICONS: Record<ContentStateKind, IconName> = {
  empty: 'Sparkles',
  'no-results': 'Search',
  error: 'X',
  forbidden: 'EyeOff',
};

/**
 * Says why a region is blank: nothing exists yet, a filter excluded everything,
 * a request failed, or the role is not allowed to see it. Each case reads
 * differently, so none of them is left to a bare "Nothing here".
 */
@Component({
  selector: 'tl-content-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Btn],
  template: `
    <div class="cstate" [class.cstate--compact]="compact()">
      <span class="cstate__icon" [class.cstate__icon--error]="kind() === 'error'">
        <tl-icon [name]="icon()" [size]="compact() ? 16 : 20" />
      </span>
      <div class="cstate__title">{{ title() }}</div>
      @if (description(); as d) {
        <p class="cstate__desc">{{ d }}</p>
      }
      @if (actionLabel(); as label) {
        <tl-btn variant="primary" [sm]="true" (clicked)="acted.emit()">{{ label }}</tl-btn>
      }
    </div>
  `,
  styles: `
    .cstate {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 56px 16px;
      text-align: center;
    }
    .cstate--compact {
      padding: 28px 16px;
    }
    .cstate__icon {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--tl-fill);
      color: var(--tl-slate);
    }
    .cstate__icon--error {
      background: var(--tl-danger-bg, var(--tl-fill));
      color: var(--tl-danger);
    }
    .cstate__title {
      font-size: 17px;
      font-weight: 600;
      color: var(--tl-ink);
    }
    .cstate__desc {
      font-size: 13.5px;
      color: var(--tl-slate);
      line-height: 1.55;
      max-width: 46ch;
      margin: 0;
    }
  `,
})
export class ContentState {
  readonly kind = input<ContentStateKind>('empty');
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
  readonly actionLabel = input<string | null>(null);
  readonly compact = input(false);
  readonly acted = output<void>();

  protected icon(): IconName {
    return ICONS[this.kind()];
  }
}
