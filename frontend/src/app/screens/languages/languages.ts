import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Icon } from '../../shared/icon';
import { Avatar, Btn, Progress } from '../../shared/primitives';
import { ApiService } from '../../core/api.service';
import { ProjectStateService } from '../../core/project-state.service';
import { ToastService } from '../../core/toast.service';
import { LanguageView } from '../../core/models';

@Component({
  selector: 'tl-languages-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Btn, Avatar, Progress],
  template: `
    <div class="content content__pad">
      <div class="row" style="margin-bottom:20px">
        <div>
          <h1 class="tl-h1">Languages</h1>
          <p class="muted" style="font-size:13.5px;margin:4px 0 0">
            {{ langs().length }} languages · source is <span class="locale">en</span> English
          </p>
        </div>
        <div class="spacer"></div>
        <tl-btn variant="ghost" icon="FileDown" (clicked)="exportAll()">Export all</tl-btn>
        <tl-btn variant="primary" icon="Plus" (clicked)="addLanguage()">Add language</tl-btn>
      </div>

      <div class="lang-grid">
        @for (l of langs(); track l.id) {
          <div class="card" style="padding:16px">
            <div class="row" style="margin-bottom:14px">
              <span class="locale" style="font-size:12px;padding:3px 7px">{{ l.code }}</span>
              <span style="font-weight:700;font-size:14.5px">{{ l.name }}</span>
              <div class="spacer"></div>
              <button class="btn btn--subtle btn--sm btn--icon" aria-label="Remove language" (click)="removeLanguage(l)">
                <tl-icon name="Trash2" [size]="15" color="var(--tl-muted)" />
              </button>
            </div>
            <div class="row" style="align-items:baseline;margin-bottom:8px">
              <span class="tl-display-3" style="font-size:26px">{{ l.translated }}%</span>
              <span class="muted" style="font-size:12.5px">translated</span>
              <div class="spacer"></div>
              @if (l.untranslated > 0) {
                <span class="chip chip--untranslated">{{ l.untranslated }}% left</span>
              } @else {
                <span class="chip chip--translated">Complete</span>
              }
            </div>
            <tl-progress [translated]="l.translated" [fuzzy]="l.fuzzy" />
            <div class="row" style="margin-top:14px">
              <div class="avatar-stack">
                @for (a of contributorSlots(l); track a) {
                  <tl-avatar [i]="a" name="A B" [sm]="true" />
                }
                @if (l.contributors === 0) {
                  <span class="muted" style="font-size:12px">No contributors</span>
                }
              </div>
              <div class="spacer"></div>
              <button class="btn btn--subtle btn--sm">Open <tl-icon name="ArrowRight" [size]="14" /></button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .lang-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
      gap: 14px;
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

  protected contributorSlots(l: LanguageView): number[] {
    return Array.from({ length: Math.min(l.contributors, 3) }, (_, i) => i + l.code.length);
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
