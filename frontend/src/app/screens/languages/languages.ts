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
            <tl-btn variant="ghost" icon="FileDown" (clicked)="exportAll()">Export all</tl-btn>
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

  protected exportAll(): void {
    this.toast.show('Use the CLI: translad pull --project … --lang …');
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
