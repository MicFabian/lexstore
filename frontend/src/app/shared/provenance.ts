import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Says that a machine wrote a translation, in the design's own vocabulary: the
 * half-filled state mark drawn in CSS — never a glyph, glyph metrics differ
 * per font — a small-caps label, and optionally where and when it came from.
 */
@Component({
  selector: 'lx-provenance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="ai-mark" [title]="title()">
      <i class="ai-mark__dot" aria-hidden="true"></i>
      <span class="ai-mark__label">{{ label() }}</span>
      @if (detail(); as d) {
        <span class="ai-mark__detail">{{ d }}</span>
      }
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 1;
    }
    .ai-mark {
      display: inline-flex;
      align-items: center;
      gap: var(--lx-space-3);
      color: var(--lx-unsure);
    }
    .ai-mark__dot {
      width: 9px;
      height: 9px;
      flex: none;
      border-radius: 50%;
      box-sizing: border-box;
      border: 1.5px solid currentColor;
      background: linear-gradient(90deg, currentColor 50%, transparent 50%);
    }
    .ai-mark__label {
      font: var(--lx-weight-medium) var(--lx-size-10) var(--lx-font-sans);
      letter-spacing: var(--lx-track-caps);
      text-transform: uppercase;
    }
    .ai-mark__detail {
      font: var(--lx-weight-regular) var(--lx-size-11) var(--lx-font-sans);
      letter-spacing: normal;
      text-transform: none;
      color: var(--lx-text-muted);
    }
  `,
})
export class Provenance {
  readonly label = input('AI');
  readonly detail = input<string | null>(null);
  protected readonly title = computed(() => 'Machine translation');
}
