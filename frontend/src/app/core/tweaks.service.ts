import { Injectable, effect, signal } from '@angular/core';

export type Theme = 'dark' | 'light';
export type Accent = 'cobalt' | 'violet' | 'emerald' | 'amber';
export type Density = 'compact' | 'cozy' | 'roomy';

export const ACCENTS: { key: Accent; hex: string }[] = [
  { key: 'cobalt', hex: '#5e7bff' },
  { key: 'violet', hex: '#9a7cff' },
  { key: 'emerald', hex: '#2fd08a' },
  { key: 'amber', hex: '#f7a83b' },
];

const KEY = 'translad.tweaks';

@Injectable({ providedIn: 'root' })
export class TweaksService {
  readonly theme = signal<Theme>('dark');
  readonly accent = signal<Accent>('cobalt');
  readonly density = signal<Density>('cozy');

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
