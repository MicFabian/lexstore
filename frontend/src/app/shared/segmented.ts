import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface SegmentOption {
  value: string;
  label: string;
  n?: number;
}

@Component({
  selector: 'lx-segmented',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="segmented" role="tablist">
      @for (o of options(); track o.value) {
        <button
          role="tab"
          [class.on]="o.value === value()"
          [attr.aria-selected]="o.value === value()"
          (click)="changed.emit(o.value)"
        >
          {{ o.label }}
          @if (o.n != null) {
            <span class="n">{{ o.n }}</span>
          }
        </button>
      }
    </div>
  `,
})
export class Segmented {
  readonly options = input.required<SegmentOption[]>();
  readonly value = input.required<string>();
  readonly changed = output<string>();
}
