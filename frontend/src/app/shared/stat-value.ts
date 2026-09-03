import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * One number that means something: eyebrow label above, tabular numeral below.
 * The number never carries a hue unless the quantity itself is a state —
 * untranslated grey, accent for the new, danger for failures.
 */
@Component({
  selector: 'lx-stat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="eyebrow">{{ label() }}</div>
    <div class="display statnum" [class.statnum--lg]="large()" [style.color]="numColor()">
      {{ value() }}
    </div>
    @if (sub(); as s) {
      <div class="statsub">{{ s }}</div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .statnum {
      font-size: var(--lx-size-26);
      letter-spacing: var(--lx-track-tight);
      line-height: var(--lx-leading-tight);
      font-variant-numeric: var(--lx-numeric-tabular);
      margin-top: var(--lx-space-4);
    }
    .statnum--lg {
      font-size: var(--lx-size-34);
    }
    .statsub {
      font-size: var(--lx-size-11);
      color: var(--lx-text-muted);
      margin-top: var(--lx-space-2);
    }
  `,
})
export class StatValue {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly sub = input<string | null>(null);
  readonly large = input(false);
  /** A state token when the quantity is a state; never decoration. */
  readonly numColor = input<string | null>(null);
}
