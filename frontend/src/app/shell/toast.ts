import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Icon } from '../shared/icon';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'tl-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    @if (toast.message(); as msg) {
      <div class="toast" role="status">
        <tl-icon name="Check" [size]="16" />
        {{ msg }}
      </div>
    }
  `,
})
export class Toast {
  protected readonly toast = inject(ToastService);
}
