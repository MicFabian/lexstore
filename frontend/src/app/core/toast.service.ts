import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastOptions {
  message: string;
  tone?: ToastTone;
  durationMs?: number;
  /** Label of an inline action, e.g. "Undo". */
  actionLabel?: string;
  action?: () => void;
}

export interface ToastItem extends Required<Pick<ToastOptions, 'message'>> {
  id: number;
  tone: ToastTone;
  durationMs: number;
  actionLabel?: string;
  action?: () => void;
}

const DEFAULT_MS = 3200;
/** An offer to undo has to outlast a glance. */
const ACTION_MS = 8000;

@Injectable({ providedIn: 'root' })
export class ToastService {
  /** Newest last; the view renders them stacked. */
  readonly items = signal<ToastItem[]>([]);

  private nextId = 1;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  /** Accepts a plain string for the common case, or options for the rest. */
  show(input: string | ToastOptions): number {
    const opts: ToastOptions = typeof input === 'string' ? { message: input } : input;
    const id = this.nextId++;
    const item: ToastItem = {
      id,
      message: opts.message,
      tone: opts.tone ?? 'success',
      durationMs: opts.durationMs ?? (opts.action ? ACTION_MS : DEFAULT_MS),
      actionLabel: opts.actionLabel,
      action: opts.action,
    };
    this.items.update((list) => [...list, item]);
    this.arm(item);
    return id;
  }

  /** Runs the toast's action and dismisses it. */
  run(id: number): void {
    const item = this.items().find((t) => t.id === id);
    item?.action?.();
    this.dismiss(id);
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer);
    this.timers.delete(id);
    this.items.update((list) => list.filter((t) => t.id !== id));
  }

  /** Hovering or focusing a toast holds it open. */
  hold(id: number): void {
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer);
    this.timers.delete(id);
  }

  resume(id: number): void {
    const item = this.items().find((t) => t.id === id);
    if (item) this.arm(item);
  }

  private arm(item: ToastItem): void {
    this.timers.set(
      item.id,
      setTimeout(() => this.dismiss(item.id), item.durationMs),
    );
  }
}
