import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { Dialog } from './dialog';
import { Btn } from './primitives';

export interface PromptField {
  name: string;
  label: string;
  placeholder?: string;
  value?: string;
  hint?: string;
  mono?: boolean;
}

/**
 * A small form in a dialog — the in-app replacement for window.prompt(), which
 * could not label its fields, validate, or be styled.
 */
@Component({
  selector: 'lx-prompt-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Dialog, Btn],
  template: `
    <lx-dialog [title]="title()" [description]="description()" [width]="440" (closed)="cancelled.emit()">
      @for (f of fields(); track f.name) {
        <div class="field">
          <label [for]="'prompt-' + f.name">{{ f.label }}</label>
          <input
            [id]="'prompt-' + f.name"
            class="input"
            [class.mono]="f.mono"
            [value]="values()[f.name] ?? ''"
            [placeholder]="f.placeholder ?? ''"
            (input)="set(f.name, $any($event.target).value)"
            (keydown.enter)="submit()"
          />
          @if (f.hint) {
            <p class="hint">{{ f.hint }}</p>
          }
        </div>
      }
      <div dialogActions>
        <lx-btn variant="primary" [sm]="true" [disabled]="!complete() || busy()" (clicked)="submit()">
          {{ busy() ? 'Working…' : submitLabel() }}
        </lx-btn>
        <lx-btn variant="subtle" [sm]="true" (clicked)="cancelled.emit()">Cancel</lx-btn>
      </div>
    </lx-dialog>
  `,
  styles: `
    .hint {
      font-size: 12px;
      color: var(--lx-text-secondary);
      line-height: 1.5;
      margin: 6px 0 0;
    }
    .mono {
      font-family: var(--lx-font-mono);
      font-size: 13px;
    }
  `,
})
export class PromptDialog {
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
  readonly fields = input.required<PromptField[]>();
  readonly submitLabel = input('Save');
  readonly busy = input(false);
  readonly submitted = output<Record<string, string>>();
  readonly cancelled = output<void>();

  /** Seeded from the fields on first read, so typing is never overwritten. */
  protected readonly values = linkedSignal<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const f of this.fields()) seed[f.name] = f.value ?? '';
    return seed;
  });

  protected set(name: string, value: string): void {
    this.values.update((v) => ({ ...v, [name]: value }));
  }

  /** Every field is required; optional fields belong in a screen's own form. */
  protected complete(): boolean {
    return this.fields().every((f) => (this.values()[f.name] ?? '').trim().length > 0);
  }

  protected submit(): void {
    if (!this.complete()) return;
    this.submitted.emit(this.values());
  }
}
