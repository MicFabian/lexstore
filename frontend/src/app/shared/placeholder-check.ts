import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Icon } from './icon';

/* Mirrors the backend's PlaceholderCheck.kt, pattern for pattern, so what the
   inspector shows while typing is exactly what the server will flag on save. */
const PATTERNS = [
  /\{[^{}]{1,60}\}/g, // {count}, {0}, {count, plural, ...}
  /%[sdfx@]/g, // %s, %d, printf style
  /%\d+\$[sdfx@]/g, // %1$s, positional printf
  /\$\{[^{}]{1,60}\}/g, // ${name}
  /<[a-zA-Z][^<>]{0,40}>/g, // <b>, <link>
];

export function placeholdersIn(text: string): string[] {
  return PATTERNS.flatMap((p) => text.match(p) ?? []).sort();
}

export interface PlaceholderDiff {
  missing: string[];
  added: string[];
}

/** Placeholders the translation is missing, and ones it invented. */
export function comparePlaceholders(source: string, translation: string): PlaceholderDiff {
  const missing = [...placeholdersIn(source)];
  const added: string[] = [];
  for (const t of placeholdersIn(translation)) {
    const i = missing.indexOf(t);
    if (i >= 0) missing.splice(i, 1);
    else added.push(t);
  }
  return { missing, added };
}

interface Chip {
  text: string;
  state: 'pending' | 'ok' | 'missing' | 'added';
}

/**
 * The one class of translation bug that breaks software rather than merely
 * reading badly: {count} rendered as {cout} throws at runtime. This checks it
 * live, while the translator types, instead of leaving it to the proofreader.
 * Quiet when there is nothing to carry over; loud only when something is wrong.
 */
@Component({
  selector: 'lx-placeholder-check',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    @if (visible()) {
      <div class="phc" aria-live="polite">
        <span class="phc__head">
          <lx-icon name="Variable" [size]="13" />
          <span class="phc__title">Placeholders</span>
        </span>
        @for (c of chips(); track c.text + '·' + $index) {
          <code class="phc__ph" [class]="'phc__ph phc__ph--' + c.state">{{ c.text }}</code>
        }
        @if (message(); as m) {
          <span class="phc__msg">{{ m }}</span>
        }
      </div>
    }
  `,
  styles: `
    .phc {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--lx-space-3);
      font-size: var(--lx-size-11);
    }
    .phc__head {
      display: inline-flex;
      align-items: center;
      gap: var(--lx-space-2);
      color: var(--lx-text-muted);
    }
    .phc__title {
      font: var(--lx-weight-medium) var(--lx-size-10) var(--lx-font-sans);
      letter-spacing: var(--lx-track-caps);
      text-transform: uppercase;
    }
    .phc__ph {
      font-family: var(--lx-font-mono);
      font-size: var(--lx-size-11);
      padding: 1px 5px;
      border-radius: var(--lx-radius-1);
      border: var(--lx-hairline) solid var(--lx-line-strong);
      color: var(--lx-text-secondary);
      background: var(--lx-surface-sunken);
    }
    .phc__ph--ok {
      border-color: var(--lx-reviewed-line);
      background: var(--lx-reviewed-soft);
      color: var(--lx-reviewed);
    }
    .phc__ph--missing {
      border-style: dashed;
      border-color: var(--lx-danger-line);
      background: transparent;
      color: var(--lx-danger);
    }
    .phc__ph--added {
      border-color: var(--lx-danger-line);
      background: var(--lx-danger-soft);
      color: var(--lx-danger);
    }
    .phc__msg {
      color: var(--lx-danger);
      font-size: var(--lx-size-11);
    }
  `,
})
export class PlaceholderCheck {
  /** The source string whose placeholders must survive translation. */
  readonly source = input.required<string>();
  /** What the translator has typed so far. */
  readonly value = input.required<string>();

  private readonly sourcePlaceholders = computed(() => placeholdersIn(this.source()));
  private readonly diff = computed(() => comparePlaceholders(this.source(), this.value()));
  private readonly typing = computed(() => this.value().trim().length > 0);

  protected readonly visible = computed(
    () => this.sourcePlaceholders().length > 0 || (this.typing() && this.diff().added.length > 0),
  );

  protected readonly chips = computed<Chip[]>(() => {
    const { missing, added } = this.diff();
    const seen = [...missing];
    const out: Chip[] = this.sourcePlaceholders().map((text) => {
      if (!this.typing()) return { text, state: 'pending' };
      const i = seen.indexOf(text);
      if (i >= 0) {
        seen.splice(i, 1);
        return { text, state: 'missing' };
      }
      return { text, state: 'ok' };
    });
    return out.concat(added.map((text) => ({ text, state: 'added' })));
  });

  protected readonly message = computed(() => {
    if (!this.typing()) return null;
    const { missing, added } = this.diff();
    const parts: string[] = [];
    if (missing.length) parts.push(`${missing.join(', ')} missing from the translation`);
    if (added.length) parts.push(`${added.join(', ')} not in the source`);
    return parts.length ? parts.join(' · ') : null;
  });
}
