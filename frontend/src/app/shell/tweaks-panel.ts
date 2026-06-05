import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Icon } from '../shared/icon';
import { ACCENTS, Accent, Density, TweaksService } from '../core/tweaks.service';

@Component({
  selector: 'tl-tweaks-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <button
      class="tweaks-fab"
      type="button"
      aria-label="Appearance"
      (click)="open.set(!open())"
    >
      <tl-icon name="Settings2" [size]="18" />
    </button>

    @if (open()) {
      <div class="tweaks-card" role="dialog" aria-label="Appearance settings">
        <div class="tweaks-row tweaks-title">Appearance</div>

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
      </div>
    }
  `,
  styles: `
    :host {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 90;
    }
    .tweaks-fab {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 1px solid var(--tl-line);
      background: var(--tl-elev, var(--tl-card));
      color: var(--tl-slate);
      box-shadow: var(--tl-shadow-md);
      display: grid;
      place-items: center;
    }
    .tweaks-fab:hover {
      color: var(--tl-ink);
      border-color: color-mix(in srgb, var(--tl-accent) 45%, var(--tl-line));
    }
    .tweaks-card {
      position: absolute;
      right: 0;
      bottom: 50px;
      width: 232px;
      padding: 14px;
      background: var(--tl-elev, var(--tl-card));
      border: 1px solid var(--tl-line);
      border-radius: var(--tl-r-lg);
      box-shadow: var(--tl-shadow-pop);
    }
    .tweaks-title {
      font-weight: 700;
      font-size: 13px;
      margin-bottom: 12px;
    }
    .tweaks-label {
      font-family: var(--tl-mono);
      font-size: 10.5px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--tl-muted);
      margin: 12px 0 6px;
    }
    .tweaks-seg {
      display: flex;
      gap: 4px;
      background: var(--tl-fill);
      border: 1px solid var(--tl-line);
      border-radius: var(--tl-r-md);
      padding: 3px;
    }
    .tweaks-seg button {
      flex: 1;
      height: 26px;
      border: none;
      background: none;
      border-radius: var(--tl-r-sm);
      font-size: 12px;
      font-weight: 600;
      text-transform: capitalize;
      color: var(--tl-slate);
    }
    .tweaks-seg button.on {
      background: var(--tl-elev, var(--tl-card));
      color: var(--tl-ink);
      box-shadow: var(--tl-shadow-xs);
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
      border-color: var(--tl-ink);
      box-shadow: 0 0 0 2px var(--tl-card);
    }
  `,
})
export class TweaksPanel {
  protected readonly tw = inject(TweaksService);
  protected readonly open = signal(false);
  protected readonly accents = ACCENTS;
  protected readonly themes: ('dark' | 'light')[] = ['dark', 'light'];
  protected readonly densities: Density[] = ['compact', 'cozy', 'roomy'];
}
