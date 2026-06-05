import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'tl-brand-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      [style.borderRadius.px]="radius()"
      style="display:block"
    >
      <rect width="120" height="120" rx="27" fill="var(--tl-accent)" />
      <g
        stroke="#fff"
        stroke-width="8"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      >
        <path d="M34 47 H82" />
        <path d="M70 35 L83 47 L70 59" />
        <path d="M86 73 H38" />
        <path d="M50 61 L37 73 L50 85" />
      </g>
    </svg>
  `,
})
export class BrandMark {
  readonly size = input(28);
  readonly radius = input(7);
}
