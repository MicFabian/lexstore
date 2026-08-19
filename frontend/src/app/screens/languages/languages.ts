import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Icon } from '../../shared/icon';
import { Btn } from '../../shared/primitives';
import { ApiService } from '../../core/api.service';
import { ProjectStateService } from '../../core/project-state.service';
import { ToastService } from '../../core/toast.service';
import { LanguageView } from '../../core/models';

@Component({
  selector: 'tl-languages-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Btn],
  template: `
    <div class="well">
      <div class="pad">
        <div class="phead">
          <div>
            <div class="eyebrow">Localization</div>
            <h1 class="serif">Languages</h1>
            <div class="psub">{{ langs().length }} languages · source is English</div>
          </div>
          <div style="display:flex;gap:8px">
            <div style="position:relative">
              <tl-btn variant="ghost" icon="FileDown" (clicked)="exportOpen.set(!exportOpen())">Export all</tl-btn>
              @if (exportOpen()) {
                <div class="menu-backdrop" (click)="exportOpen.set(false)"></div>
                <div class="menu export" role="dialog" aria-label="Export translations">
                  <div class="menu__label">Export</div>
                  <div class="field">
                    <label>Languages</label>
                    <div class="row" style="gap:6px;flex-wrap:wrap">
                      <button
                        [class]="'btn btn--sm ' + (exportLangs().size === 0 ? 'btn--ghost' : 'btn--subtle')"
                        [style.border-color]="exportLangs().size === 0 ? 'var(--tl-accent)' : null"
                        (click)="selectAllLangs()"
                      >All</button>
                      @for (l of langs(); track l.id) {
                        <button
                          [class]="'btn btn--sm ' + (exportLangs().has(l.code) ? 'btn--ghost' : 'btn--subtle')"
                          [style.border-color]="exportLangs().has(l.code) ? 'var(--tl-accent)' : null"
                          (click)="toggleExportLang(l.code)"
                        >{{ l.code }}</button>
                      }
                    </div>
                  </div>
                  <div class="field">
                    <label>Format</label>
                    <div class="row" style="gap:6px">
                      @for (f of formats; track f) {
                        <button
                          [class]="'btn btn--sm ' + (exportFormat() === f ? 'btn--ghost' : 'btn--subtle')"
                          [style.border-color]="exportFormat() === f ? 'var(--tl-accent)' : null"
                          (click)="exportFormat.set(f)"
                        >{{ f.toUpperCase() }}</button>
                      }
                    </div>
                  </div>
                  <p class="export__hint">{{ exportSummary() }}</p>
                  <div class="row" style="gap:8px">
                    <tl-btn variant="primary" [sm]="true" [disabled]="exportBusy()" (clicked)="runExport()">
                      {{ exportBusy() ? 'Exporting…' : 'Download' }}
                    </tl-btn>
                    <tl-btn variant="subtle" [sm]="true" (clicked)="exportOpen.set(false)">Cancel</tl-btn>
                  </div>
                </div>
              }
            </div>
            <tl-btn variant="primary" icon="Plus" (clicked)="addLanguage()">Add language</tl-btn>
          </div>
        </div>

        <div class="lang-grid" style="border-top:1px solid var(--tl-line)">
          @for (l of langs(); track l.id) {
            <div class="lang-row">
              <span class="locale" style="font-size:12px">{{ l.code }}</span>
              <div style="flex:1;min-width:0">
                <div style="font-size:14.5px;font-weight:600;color:var(--tl-ink)">{{ l.name }}</div>
                <div class="lmeta">
                  {{ l.contributors }} contributor{{ l.contributors === 1 ? '' : 's' }}
                  @if (l.fuzzy > 0) { · {{ l.fuzzy }}% in review }
                </div>
              </div>
              <span class="serif" style="font-size:24px">{{ l.translated }}%</span>
              <span class="progress" style="width:90px;height:5px">
                <i class="seg-translated" [style.width.%]="l.translated"></i>
                <i class="seg-fuzzy" [style.width.%]="l.fuzzy"></i>
              </span>
              <button class="btn btn--subtle btn--sm btn--icon" aria-label="Remove language" (click)="removeLanguage(l)">
                <tl-icon name="Trash2" [size]="15" color="var(--tl-muted)" />
              </button>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .lang-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 40px;
    }
    .lang-row {
      display: flex;
      align-items: center;
      gap: 18px;
      padding: 22px 0;
      border-bottom: 1px solid var(--tl-line-2);
    }
    .export {
      top: calc(100% + 6px);
      right: 0;
      width: 300px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      text-align: left;
    }
    .export__hint {
      font-size: 12px;
      color: var(--tl-slate);
      line-height: 1.5;
      margin: 0;
    }
    .lmeta {
      font: 500 12.5px var(--tl-mono);
      color: var(--tl-slate);
      margin-top: 3px;
    }
  `,
})
export class LanguagesScreen implements OnInit {
  private readonly api = inject(ApiService);
  private readonly state = inject(ProjectStateService);
  protected readonly toast = inject(ToastService);

  protected readonly langs = signal<LanguageView[]>([]);
  protected readonly exportOpen = signal(false);
  protected readonly exportBusy = signal(false);
  protected readonly exportFormat = signal<'json' | 'csv'>('json');
  /** Empty means every language. */
  protected readonly exportLangs = signal<Set<string>>(new Set());
  protected readonly formats: ('json' | 'csv')[] = ['json', 'csv'];

  ngOnInit(): void {
    this.state.whenReady((pid) =>
      this.api.listLanguages(pid).subscribe((l) => this.langs.set(l)),
    );
  }

  protected addLanguage(): void {
    const code = window.prompt('Language code (e.g. it, ko, pt-BR)');
    if (!code) return;
    const name = window.prompt('Language name (e.g. Italian)');
    if (!name) return;
    const pid = this.state.current()?.id;
    if (!pid) return;
    this.api.addLanguage(pid, { code, name }).subscribe({
      next: () => {
        this.api.listLanguages(pid).subscribe((l) => this.langs.set(l));
        this.toast.show(`Added ${name}`);
      },
      error: () => this.toast.show(`'${code}' is already in this project`),
    });
  }

  protected selectAllLangs(): void {
    this.exportLangs.set(new Set());
  }

  protected toggleExportLang(code: string): void {
    this.exportLangs.update((s) => {
      const next = new Set(s);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }

  protected exportSummary(): string {
    const chosen = this.exportLangs();
    const count = chosen.size === 0 ? this.langs().length : chosen.size;
    const format = this.exportFormat().toUpperCase();
    return count === 1
      ? `Downloads one ${format} file.`
      : `Downloads ${count} ${format} files, one per language.`;
  }

  protected runExport(): void {
    const pid = this.state.current()?.id;
    if (!pid) return;
    const chosen = this.exportLangs();
    const codes = chosen.size === 0 ? this.langs().map((l) => l.code) : [...chosen];
    const format = this.exportFormat();

    this.exportBusy.set(true);
    let done = 0;
    for (const code of codes) {
      this.api.exportTranslations(pid, code, format).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `translations-${code}.${format}`;
          a.click();
          URL.revokeObjectURL(url);
          if (++done === codes.length) {
            this.exportBusy.set(false);
            this.exportOpen.set(false);
            this.toast.show(`Exported ${codes.length} language${codes.length === 1 ? '' : 's'}`);
          }
        },
        error: () => {
          this.exportBusy.set(false);
          this.toast.show(`Export of ${code} failed`);
        },
      });
    }
  }

  protected removeLanguage(l: LanguageView): void {
    if (!window.confirm(`Remove ${l.name} and its translations?`)) return;
    const pid = this.state.current()?.id;
    if (!pid) return;
    this.api.deleteLanguage(pid, l.code).subscribe({
      next: () => {
        this.langs.update((list) => list.filter((x) => x.code !== l.code));
        this.toast.show(`Removed ${l.name}`);
      },
      error: () => this.toast.show('Not allowed (needs admin)'),
    });
  }
}
