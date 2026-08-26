import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
} from '@angular/core';
import { Icon } from './icon';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Modal shell: traps focus, closes on Escape or backdrop, and restores focus to
 * whatever opened it. Content is projected, so every dialog in the app shares
 * one focus lifecycle instead of hand-rolling its own.
 */
@Component({
  selector: 'lx-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: {
    // Capture on the host: focus usually sits in a projected field, whose
    // keydown would otherwise never reach this element.
    '(document:keydown.escape)': 'closed.emit()',
    '(keydown.tab)': 'trapFocus($any($event))',
  },
  template: `
    <div class="modal-backdrop" (click)="closed.emit()"></div>
    <div
      class="modal dlg"
      role="dialog"
      aria-modal="true"
      [attr.aria-labelledby]="titleId"
      [style.width.px]="width()"
    >
      <div class="modal__head">
        <div>
          <div class="modal__title" [id]="titleId">{{ title() }}</div>
          @if (description(); as d) {
            <div class="dlg__desc">{{ d }}</div>
          }
        </div>
        <div class="spacer"></div>
        <button class="btn btn--subtle btn--sm btn--icon" aria-label="Close" (click)="closed.emit()">
          <lx-icon name="X" [size]="16" />
        </button>
      </div>
      <div class="dlg__body">
        <ng-content />
      </div>
      <div class="dlg__foot">
        <ng-content select="[dialogActions]" />
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
      background: color-mix(in srgb, var(--lx-bg-page) 55%, transparent);
      backdrop-filter: blur(2px);
    }
    .modal {
      position: relative;
      max-width: calc(100vw - 32px);
      background: var(--lx-bg-card, var(--lx-bg-card));
      border: 1px solid var(--lx-line);
      border-radius: var(--lx-radius-3);
      box-shadow: var(--lx-shadow-dialog);
    }
    .modal__head {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 16px 18px;
      border-bottom: 1px solid var(--lx-line-soft);
    }
    .modal__title {
      font-size: 15px;
      font-weight: 700;
      color: var(--lx-text-primary);
    }
    .dlg {
      display: flex;
      flex-direction: column;
      max-height: 80vh;
    }
    .dlg__desc {
      font-size: 13px;
      color: var(--lx-text-secondary);
      margin-top: 4px;
      line-height: 1.5;
    }
    .dlg__body {
      padding: 18px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .dlg__foot:not(:empty) {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 14px 18px;
      border-top: 1px solid var(--lx-line-soft);
    }
  `,
})
export class Dialog {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
  readonly width = input(420);
  readonly closed = output<void>();

  protected readonly titleId = `dlg-${Math.random().toString(36).slice(2, 9)}`;
  private readonly opener = document.activeElement as HTMLElement | null;

  constructor() {
    // Wait a frame past the first render so projected fields exist to focus.
    afterNextRender(() => requestAnimationFrame(() => this.focusInitial()));
  }

  ngOnDestroy(): void {
    this.opener?.focus();
  }

  /** Keep Tab inside the dialog so the page behind stays unreachable. */
  protected trapFocus(e: KeyboardEvent): void {
    const items = this.focusables();
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  /** Prefer the first field over the close button, which comes first in the DOM. */
  private focusInitial(): void {
    const body = this.host.nativeElement.querySelector<HTMLElement>('.dlg__body');
    const field = body?.querySelector<HTMLElement>(FOCUSABLE);
    (field ?? this.focusables()[0])?.focus();
  }

  private focusables(): HTMLElement[] {
    return Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>(`.dlg ${FOCUSABLE}`),
    ).filter((el) => el.offsetParent !== null);
  }
}
