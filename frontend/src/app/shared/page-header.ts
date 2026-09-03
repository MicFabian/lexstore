import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The page opening every screen shares: eyebrow, display title, quiet subline,
 * actions on the right baseline. One component instead of the same eight lines
 * per screen — the classes stay, they are the app's stable contract.
 */
@Component({
  selector: 'lx-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="phead">
      <div>
        @if (eyebrow(); as e) {
          <div class="eyebrow">{{ e }}</div>
        }
        <h1 class="display">{{ heading() }}</h1>
        @if (sub(); as s) {
          <div class="psub">{{ s }}</div>
        }
      </div>
      <div class="phead__actions"><ng-content /></div>
    </div>
  `,
  styles: `
    .phead__actions {
      display: flex;
      align-items: center;
      gap: var(--lx-space-5);
    }
    .phead__actions:empty {
      display: none;
    }
  `,
})
export class PageHeader {
  readonly eyebrow = input<string | null>(null);
  readonly heading = input.required<string>();
  readonly sub = input<string | null>(null);
}
