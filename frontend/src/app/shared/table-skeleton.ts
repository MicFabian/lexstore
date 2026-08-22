import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Placeholder rows while a table loads, so the screen keeps its shape instead
 * of collapsing to an empty body that reads like "nothing here".
 */
@Component({
  selector: 'tl-table-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="skel" [attr.aria-busy]="true" aria-label="Loading">
      @for (r of rowList(); track r) {
        <div class="skel__row">
          @for (c of colList(); track c) {
            <span class="skel__cell" [style.width.%]="width(c)"></span>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .skel__row {
      display: flex;
      align-items: center;
      gap: 24px;
      padding: 16px 16px;
      border-bottom: 1px solid var(--tl-line-2);
    }
    .skel__cell {
      height: 12px;
      border-radius: 4px;
      background: var(--tl-fill);
      animation: skelPulse 1.4s ease-in-out infinite;
    }
    @keyframes skelPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.45; }
    }
    @media (prefers-reduced-motion: reduce) {
      .skel__cell { animation: none; }
    }
  `,
})
export class TableSkeleton {
  readonly rows = input(6);
  readonly columns = input(4);

  protected rowList(): number[] {
    return Array.from({ length: this.rows() }, (_, i) => i);
  }

  protected colList(): number[] {
    return Array.from({ length: this.columns() }, (_, i) => i);
  }

  /** Uneven widths read as content rather than as a grid of bars. */
  protected width(col: number): number {
    const pattern = [26, 34, 18, 12, 16];
    return pattern[col % pattern.length];
  }
}
