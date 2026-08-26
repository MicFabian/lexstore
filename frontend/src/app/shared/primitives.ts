import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Icon, IconName } from './icon';
import { STATUS_LABEL, TranslationStatus } from '../core/models';

const AV = ['#3a5bff', '#1f9d57', '#c97a09', '#7b53d6', '#0f8aa0', '#d83a3a', '#2a44e6'];

/** Deterministic avatar palette index for a display name (mirrors the backend). */
export function avatarIndexFor(name: string): number {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return h % AV.length;
}

/* ---------------- Button ---------------- */
@Component({
  selector: 'lx-btn',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <button
      [class]="cls()"
      [disabled]="disabled()"
      [attr.aria-label]="iconOnly() ? ariaLabel() : null"
      (click)="clicked.emit($event)"
    >
      @if (icon()) {
        <lx-icon [name]="icon()!" [size]="sm() ? 15 : 16" />
      }
      <ng-content />
    </button>
  `,
})
export class Btn {
  readonly variant = input<'primary' | 'ghost' | 'subtle' | 'danger'>('ghost');
  readonly sm = input(false);
  readonly icon = input<IconName | null>(null);
  readonly iconOnly = input(false);
  readonly disabled = input(false);
  readonly ariaLabel = input('');
  readonly clicked = output<MouseEvent>();

  protected readonly cls = computed(() =>
    ['btn', `btn--${this.variant()}`, this.sm() ? 'btn--sm' : '', this.iconOnly() ? 'btn--icon' : '']
      .filter(Boolean)
      .join(' '),
  );
}

/* ---------------- Status chip ---------------- */
@Component({
  selector: 'lx-status-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="'chip chip--' + chipClass()">{{ label() }}</span>`,
})
export class StatusChip {
  readonly status = input.required<TranslationStatus>();
  protected readonly label = computed(() => STATUS_LABEL[this.status()]);
  protected readonly chipClass = computed(() =>
    this.status() === 'fuzzy' ? 'fuzzy' : this.status(),
  );
}

/* ---------------- Avatar ---------------- */
@Component({
  selector: 'lx-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span
    [class]="sm() ? 'avatar avatar--sm' : 'avatar'"
    [style.background]="bg()"
    >{{ initials() }}</span
  >`,
})
export class Avatar {
  readonly i = input(0);
  readonly name = input('');
  readonly sm = input(false);
  protected readonly bg = computed(() => AV[this.i() % AV.length]);
  protected readonly initials = computed(() =>
    this.name()
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase(),
  );
}

/* ---------------- Progress bar ---------------- */
@Component({
  selector: 'lx-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="progress">
    <i class="seg-translated" [style.width.%]="translated()"></i>
    <i class="seg-fuzzy" [style.width.%]="fuzzy()"></i>
  </span>`,
})
export class Progress {
  readonly translated = input(0);
  readonly fuzzy = input(0);
}

/* ---------------- Locale code chip ---------------- */
@Component({
  selector: 'lx-locale',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="locale"><ng-content /></span>`,
})
export class Locale {}

/* ---------------- Toggle ---------------- */
@Component({
  selector: 'lx-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button
    [class]="on() ? 'toggle on' : 'toggle'"
    [attr.aria-pressed]="on()"
    type="button"
    (click)="toggled.emit()"
  >
    <i></i>
  </button>`,
})
export class Toggle {
  readonly on = input(false);
  readonly toggled = output<void>();
}

/* ---------------- Search box ---------------- */
@Component({
  selector: 'lx-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `<div class="searchbox" [style.width.px]="width()">
    <lx-icon name="Search" [size]="16" />
    <input
      [placeholder]="placeholder()"
      [value]="value()"
      [attr.aria-label]="placeholder()"
      (input)="changed.emit($any($event.target).value)"
    />
  </div>`,
})
export class SearchBox {
  readonly placeholder = input('Search');
  readonly value = input('');
  readonly width = input(280);
  readonly changed = output<string>();
}

/* ---------------- Tag ---------------- */
@Component({
  selector: 'lx-tag',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="lx-tag"><ng-content /></span>`,
  styles: `
    .lx-tag {
      display: inline-flex;
      align-items: center;
      gap: var(--lx-space-3);
      height: 20px;
      padding: 0 var(--lx-space-4);
      border-radius: var(--lx-radius-2);
      background: var(--lx-surface-sunken);
      border: var(--lx-hairline) solid var(--lx-line-strong);
      font-size: var(--lx-size-11);
      font-weight: var(--lx-weight-regular);
      color: var(--lx-text-secondary);
      white-space: nowrap;
    }
  `,
})
export class Tag {}

export { AV };
