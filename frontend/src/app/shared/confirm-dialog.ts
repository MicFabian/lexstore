import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Dialog } from './dialog';
import { Btn } from './primitives';

/**
 * Confirmation for an action that cannot be undone. Reversible actions should
 * act immediately and offer Undo in the toast instead of asking first.
 */
@Component({
  selector: 'lx-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Dialog, Btn],
  template: `
    <lx-dialog [title]="title()" [description]="description()" [width]="400" (closed)="cancelled.emit()">
      <div dialogActions>
        <lx-btn
          [variant]="tone() === 'danger' ? 'danger' : 'primary'"
          [sm]="true"
          [disabled]="busy()"
          (clicked)="confirmed.emit()"
        >
          {{ busy() ? 'Working…' : confirmLabel() }}
        </lx-btn>
        <lx-btn variant="subtle" [sm]="true" (clicked)="cancelled.emit()">Cancel</lx-btn>
      </div>
    </lx-dialog>
  `,
})
export class ConfirmDialog {
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
  readonly confirmLabel = input('Confirm');
  readonly tone = input<'danger' | 'primary'>('danger');
  readonly busy = input(false);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}
