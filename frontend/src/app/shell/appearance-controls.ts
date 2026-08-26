import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ACCENTS, Density, TweaksService } from '../core/tweaks.service';

/** Theme, accent, and density pickers — shared by the settings screen and the floating panel. */
@Component({
  selector: 'lx-appearance-controls',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tweaks-label">Mode</div>
    <div class="tweaks-seg">
      @for (m of themes; track m) {
        <button [class.on]="tw.theme() === m" (click)="tw.setTheme(m)">{{ m }}</button>
      }
    </div>

    <div class="tweaks-label">Accent</div>
    <div class="tweaks-accents">
      @for (a of accents; track a.key) {
        <button
          class="swatch"
          [class.on]="tw.accent() === a.key"
          [style.background]="a.hex"
          [attr.aria-label]="a.key"
          (click)="tw.setAccent(a.key)"
        ></button>
      }
    </div>

    <div class="tweaks-label">Density</div>
    <div class="tweaks-seg">
      @for (d of densities; track d) {
        <button [class.on]="tw.density() === d" (click)="tw.setDensity(d)">{{ d }}</button>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .tweaks-label {
      font-family: var(--lx-font-mono);
      font-size: 10.5px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--lx-text-muted);
      margin: 12px 0 6px;
    }
    :host > .tweaks-label:first-child {
      margin-top: 0;
    }
    .tweaks-seg {
      display: flex;
      gap: 4px;
      background: var(--lx-surface-hover);
      border: 1px solid var(--lx-line);
      border-radius: var(--lx-radius-2);
      padding: 3px;
      max-width: 260px;
    }
    .tweaks-seg button {
      flex: 1;
      height: 26px;
      border: none;
      background: none;
      border-radius: var(--lx-radius-2);
      font-size: 12px;
      font-weight: 600;
      text-transform: capitalize;
      color: var(--lx-text-secondary);
    }
    .tweaks-seg button.on {
      background: var(--lx-bg-card, var(--lx-bg-card));
      color: var(--lx-text-primary);
      box-shadow: var(--lx-shadow-none);
    }
    .tweaks-accents {
      display: flex;
      gap: 8px;
    }
    .swatch {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
    }
    .swatch.on {
      border-color: var(--lx-text-primary);
      box-shadow: 0 0 0 2px var(--lx-bg-card);
    }
  `,
})
export class AppearanceControls {
  protected readonly tw = inject(TweaksService);
  protected readonly accents = ACCENTS;
  protected readonly themes: ('dark' | 'light')[] = ['dark', 'light'];
  protected readonly densities: Density[] = ['compact', 'regular', 'comfy'];
}
