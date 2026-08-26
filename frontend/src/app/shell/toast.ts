import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Icon } from '../shared/icon';
import { ToastItem, ToastService } from '../core/toast.service';

@Component({
  selector: 'lx-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="toast-region" aria-live="polite" aria-atomic="false">
      @for (t of toast.items(); track t.id) {
        <div
          class="toast"
          [class.toast--error]="t.tone === 'error'"
          [attr.role]="t.tone === 'error' ? 'alert' : 'status'"
          (mouseenter)="toast.hold(t.id)"
          (mouseleave)="toast.resume(t.id)"
          (focusin)="toast.hold(t.id)"
          (focusout)="toast.resume(t.id)"
        >
          <lx-icon [name]="icon(t)" [size]="16" />
          <span class="toast__text">{{ t.message }}</span>
          @if (t.actionLabel) {
            <button class="toast__action" (click)="toast.run(t.id)">{{ t.actionLabel }}</button>
          }
          <button class="toast__close" aria-label="Dismiss" (click)="toast.dismiss(t.id)">
            <lx-icon name="X" [size]="14" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toast-region {
      position: fixed;
      bottom: 22px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: center;
      z-index: 100;
      pointer-events: none;
    }
    .toast-region .toast {
      position: static;
      transform: none;
      left: auto;
      bottom: auto;
      pointer-events: auto;
    }
    .toast--error {
      border-color: var(--lx-danger);
    }
    .toast__text {
      flex: 1;
    }
    .toast__action {
      border: none;
      background: none;
      padding: 2px 6px;
      margin-left: 2px;
      font: 600 13px var(--lx-font-sans);
      color: var(--lx-accent-hover);
      cursor: pointer;
      border-radius: var(--lx-radius-2);
    }
    .toast__action:hover {
      background: rgba(255, 255, 255, 0.12);
    }
    .toast__close {
      border: none;
      background: none;
      padding: 0;
      margin-left: 2px;
      display: grid;
      place-items: center;
      width: 24px;
      height: 24px;
      color: inherit;
      opacity: 0.6;
      cursor: pointer;
    }
    .toast__close:hover {
      opacity: 1;
    }
  `,
})
export class Toast {
  protected readonly toast = inject(ToastService);

  protected icon(t: ToastItem): 'Check' | 'X' | 'Sparkles' {
    if (t.tone === 'error') return 'X';
    return t.tone === 'info' ? 'Sparkles' : 'Check';
  }
}
