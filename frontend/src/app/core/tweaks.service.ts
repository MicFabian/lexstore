import { Injectable, effect, signal } from '@angular/core';

export type Theme = 'dark' | 'light';
export type Accent = 'slate' | 'cobalt' | 'teal' | 'graphite';
export type Density = 'compact' | 'regular' | 'comfy';

export const ACCENTS: { key: Accent; hex: string }[] = [
  { key: 'slate', hex: '#4e6fa8' },
  { key: 'cobalt', hex: '#3a5bff' },
  { key: 'teal', hex: '#0f7b8a' },
  { key: 'graphite', hex: '#4a4a52' },
];

/* v3: the Locali design system replaced the accent set — the bump discards
   persisted tweaks so everyone starts from the new baseline. */
const KEY = 'lexstore.tweaks.v3';

@Injectable({ providedIn: 'root' })
export class TweaksService {
  readonly theme = signal<Theme>('light');
  readonly accent = signal<Accent>('slate');
  readonly density = signal<Density>('regular');

  constructor() {
    this.restore();
    effect(() => {
      const root = document.documentElement;
      root.dataset['theme'] = this.theme();
      root.dataset['accent'] = this.accent();
      root.dataset['density'] = this.density();
      this.persist();
    });
  }

  setTheme(t: Theme): void {
    this.theme.set(t);
  }
  setAccent(a: Accent): void {
    this.accent.set(a);
  }
  setDensity(d: Density): void {
    this.density.set(d);
  }

  private persist(): void {
    localStorage.setItem(
      KEY,
      JSON.stringify({ theme: this.theme(), accent: this.accent(), density: this.density() }),
    );
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const v = JSON.parse(raw);
      if (v.theme) this.theme.set(v.theme);
      if (v.accent) this.accent.set(v.accent);
      if (v.density) this.density.set(v.density);
    } catch {
      /* ignore corrupt state */
    }
  }
}
