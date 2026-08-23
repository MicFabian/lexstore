import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon, IconName } from '../../shared/icon';
import { Btn } from '../../shared/primitives';
import { AppearanceControls } from '../../shell/appearance-controls';
import { PoeditorWizard } from './poeditor-wizard';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { PromptDialog } from '../../shared/prompt-dialog';
import { ApiService } from '../../core/api.service';
import { ProjectStateService } from '../../core/project-state.service';
import { ToastService } from '../../core/toast.service';
import { ApiKeyView, GlossaryEntryView } from '../../core/models';

interface IntegrationItem {
  icon: IconName;
  name: string;
  desc: string;
  on: boolean;
}

@Component({
  selector: 'lx-settings-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, Btn, AppearanceControls, PoeditorWizard, ConfirmDialog, PromptDialog],
  template: `
    <div class="well">
      <div class="pad">
        <div class="phead" style="margin-bottom:20px">
          <div>
            <div class="eyebrow">Configuration</div>
            <h1 class="serif">Settings</h1>
          </div>
        </div>
        <div class="subnav" style="margin-bottom:30px">
          @for (t of tabs; track t.id) {
            <button [class.on]="tab() === t.id" (click)="tab.set(t.id)">
              <lx-icon [name]="t.icon" [size]="14" /><span>{{ t.label }}</span>
            </button>
          }
        </div>

        <div>
          @switch (tab()) {
            @case ('api') {
              <div style="display:flex;flex-direction:column;gap:18px">
                <div class="panel">
                  <div class="panel__head">
                    <lx-icon name="KeyRound" [size]="17" color="var(--lx-accent-hi)" />
                    <h2>API keys</h2>
                    <div class="spacer"></div>
                    <lx-btn variant="primary" [sm]="true" icon="Plus" (clicked)="generating.set(true)">Generate key</lx-btn>
                  </div>
                  <div style="padding:6px 0">
                    @for (k of keys(); track k.id; let last = $last) {
                      <div class="keyrow" [style.border-bottom]="last ? 'none' : '1px solid var(--lx-line-2)'">
                        <div style="flex:1;min-width:0">
                          <div class="row" style="gap:8px;margin-bottom:6px">
                            <span style="font-weight:600;font-size:13.5px">{{ k.label }}</span>
                            <span [class]="'chip ' + (k.scope === 'Read only' ? 'chip--neutral' : 'chip--translated')">{{ k.scope }}</span>
                            @if (k.test) {
                              <span class="chip chip--untranslated">Test</span>
                            }
                          </div>
                          <div class="row" style="gap:8px">
                            <code class="keycode">{{ k.prefix }}••••••••••••{{ k.tail }}</code>
                            <span class="muted" style="font-size:12px">Shown once when created</span>
                          </div>
                        </div>
                        <div style="text-align:right;flex:none;min-width:150px">
                          <div class="muted" style="font-size:12px">Last used {{ k.used }}</div>
                          <div class="muted" style="font-size:11.5px;margin-top:2px">Created {{ k.created }}</div>
                          <button class="btn btn--subtle btn--sm" style="color:var(--lx-danger);margin-top:4px" (click)="pendingRevoke.set(k)">
                            <lx-icon name="Trash2" [size]="14" />Revoke
                          </button>
                        </div>
                      </div>
                    }
                  </div>
                </div>

                <div class="card cli-card">
                  <lx-icon name="Terminal" [size]="18" color="var(--lx-accent-text)" style="margin-top:1px" />
                  <div>
                    <div style="font-weight:600;font-size:13.5px;margin-bottom:4px">Pull translations from your terminal</div>
                    <code class="lx-mono" style="font-size:12.5px;color:var(--lx-accent-text)">$ lexstore pull --project {{ project()?.code }} --lang fr</code>
                  </div>
                </div>
              </div>
            }
            @case ('appearance') {
              <div class="panel" style="max-width:520px">
                <div class="panel__head"><h2>Appearance</h2></div>
                <div style="padding:18px">
                  <p style="margin:0 0 16px;font-size:13.5px;color:var(--lx-slate);line-height:1.55">
                    Theme, accent, and row density. Saved in this browser, for you only.
                  </p>
                  <lx-appearance-controls />
                </div>
              </div>
            }
            @case ('general') {
              <div style="display:flex;flex-direction:column;gap:18px">
                <div class="panel">
                  <div class="panel__head"><h2>Project</h2></div>
                  <div style="padding:18px;display:flex;flex-direction:column;gap:16px;max-width:520px">
                    <div class="field">
                      <label>Project image</label>
                      <div class="row" style="gap:14px">
                        <span class="proj-image" [style.background]="draftImage() ? 'none' : (project()?.mark ?? '')">
                          @if (draftImage(); as img) {
                            <img [src]="img" alt="" />
                          } @else {
                            <lx-icon name="ArrowRightLeft" [size]="18" color="#fff" />
                          }
                        </span>
                        <input
                          #imageInput
                          type="file"
                          accept="image/png,image/jpeg,image/svg+xml,image/webp"
                          style="display:none"
                          (change)="onImageFile($event)"
                        />
                        <lx-btn variant="ghost" [sm]="true" icon="Upload" (clicked)="imageInput.click()">Upload image</lx-btn>
                        @if (draftImage()) {
                          <button class="btn btn--subtle btn--sm" (click)="clearImage()">Remove</button>
                        }
                      </div>
                      <p class="hint">PNG, JPG, SVG, or WebP up to 512 KB. Replaces the color mark everywhere.</p>
                    </div>
                    <div class="field"><label>Project name</label><input class="input" [value]="draftName()" (input)="draftName.set($any($event.target).value)" /></div>
                    <div class="field"><label>Project slug</label><input class="input" style="font-size:13px" [value]="project()?.code ?? ''" disabled /></div>
                    <div class="field">
                      <label>Default source language</label>
                      <div class="row"><span class="locale" style="font-size:12px;padding:4px 8px">en</span><span style="font-size:13.5px">English</span></div>
                    </div>
                    <div class="row">
                      <div>
                        <div style="font-size:13.5px;font-weight:600">Auto-flag machine translations as fuzzy</div>
                        <div class="muted" style="font-size:12px">
                          Set for the whole workspace in
                          <a [routerLink]="['/', 'ai']">Translation AI</a>.
                        </div>
                      </div>
                    </div>
                    <div><lx-btn variant="primary" [disabled]="saving()" (clicked)="saveProject()">{{ saving() ? 'Saving…' : 'Save changes' }}</lx-btn></div>
                  </div>
                </div>

                <div class="panel">
                  <div class="panel__head">
                    <lx-icon name="WandSparkles" [size]="17" color="var(--lx-accent-hi)" />
                    <h2>Translation context</h2>
                  </div>
                  <div style="padding:18px;display:flex;flex-direction:column;gap:12px;max-width:640px">
                    <p class="hint" style="margin:0">
                      Domain and glossary rules handed to the machine translator with every suggestion and
                      auto-translation of this project. Changing it invalidates cached suggestions.
                    </p>
                    <textarea
                      class="textarea"
                      rows="5"
                      [value]="draftContext()"
                      (input)="draftContext.set($any($event.target).value)"
                      placeholder="e.g. Agricultural software. Translate &quot;Schlag&quot; as &quot;field&quot;, never &quot;hit&quot;. Keep product names untranslated."
                    ></textarea>
                    <div>
                      <lx-btn variant="primary" [sm]="true" [disabled]="saving()" (clicked)="saveContext()">Save context</lx-btn>
                    </div>
                  </div>
                </div>
              </div>
            }
            @case ('glossary') {
              <div class="panel">
                <h2 class="ptitle">Glossary</h2>
                <p class="hint">
                  Terms this project insists on. They are given to the translator as
                  instructions, and a translation that ignores one is flagged by the
                  proofreader.
                </p>

                <form class="gform" (submit)="addGlossary($event)">
                  <input
                    class="input"
                    placeholder="Source term, e.g. Dashboard"
                    [value]="gTerm()"
                    (input)="gTerm.set($any($event.target).value)"
                  />
                  <input
                    class="input"
                    placeholder="Must be translated as…"
                    [disabled]="gKeep()"
                    [value]="gTranslation()"
                    (input)="gTranslation.set($any($event.target).value)"
                  />
                  <select [value]="gLang()" (change)="gLang.set($any($event.target).value)">
                    <option value="">All languages</option>
                    @for (l of languages(); track l.code) {
                      <option [value]="l.code">{{ l.name }}</option>
                    }
                  </select>
                  <label class="gkeep">
                    <input type="checkbox" [checked]="gKeep()" (change)="gKeep.set($any($event.target).checked)" />
                    Never translate
                  </label>
                  <lx-btn variant="primary" [disabled]="!gTerm()">Add</lx-btn>
                </form>

                @if (glossary().length) {
                  <table class="gtable" aria-label="Glossary terms">
                    <thead><tr><th>Term</th><th>Rule</th><th>Language</th><th></th></tr></thead>
                    <tbody>
                      @for (g of glossary(); track g.id) {
                        <tr>
                          <td><b>{{ g.term }}</b></td>
                          <td>
                            @if (g.doNotTranslate) {
                              <span class="chip chip--neutral">leave untranslated</span>
                            } @else {
                              {{ g.translation }}
                            }
                          </td>
                          <td>
                            @if (g.languageCode) {
                              <span class="locale">{{ g.languageCode }}</span>
                            } @else {
                              <span class="muted">all</span>
                            }
                          </td>
                          <td style="text-align:right">
                            <button class="btn btn--subtle btn--sm" (click)="removeGlossary(g)">
                              <lx-icon name="Trash2" [size]="14" />Remove
                            </button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                } @else {
                  <p class="muted">No terms yet.</p>
                }
              </div>
            }

            @case ('integrations') {
              <div class="two-col">
                @for (it of integrations; track it.name) {
                  <div class="card" style="padding:16px">
                    <div class="row" style="margin-bottom:10px">
                      <span class="int-ico"><lx-icon [name]="it.icon" [size]="18" color="var(--lx-ink)" /></span>
                      <span style="font-weight:700;font-size:14px">{{ it.name }}</span>
                      <div class="spacer"></div>
                      <span class="chip chip--neutral">Available</span>
                    </div>
                    <p class="muted" style="font-size:12.5px;margin:0;line-height:1.5">{{ it.desc }}</p>
                    <p class="muted" style="font-size:12.5px;margin:10px 0 0;line-height:1.5">
                      Create a key under <b>API keys</b> for this project, or under
                      <a [routerLink]="['/', 'organisation']">Organisation → API access</a>
                      for one that reaches every project, then set
                      <code>LEXSTORE_API_KEY</code>.
                    </p>
                  </div>
                }
              </div>
            }
            @case ('export') {
              <div style="display:flex;flex-direction:column;gap:18px">
              <lx-poeditor-wizard />
              <div class="two-col">
                <div class="card" style="padding:18px">
                  <lx-icon name="FileUp" [size]="20" color="var(--lx-accent-hi)" />
                  <div style="font-weight:700;font-size:14.5px;margin:10px 0 4px">Import strings</div>
                  <p class="muted" style="font-size:12.5px;margin:0 0 14px;line-height:1.5">Upload a JSON file of key→value pairs into a language.</p>
                  <div class="field" style="margin-bottom:10px">
                    <label>Target language</label>
                    <input class="input" [value]="ioLang()" (input)="ioLang.set($any($event.target).value)" placeholder="fr" />
                  </div>
                  <input #fileInput type="file" accept=".json,application/json" style="display:none" (change)="onImportFile($event)" />
                  <lx-btn variant="ghost" icon="Upload" (clicked)="fileInput.click()">Choose JSON file</lx-btn>
                </div>
                <div class="card" style="padding:18px">
                  <lx-icon name="FileDown" [size]="20" color="var(--lx-accent-hi)" />
                  <div style="font-weight:700;font-size:14.5px;margin:10px 0 4px">Export translations</div>
                  <p class="muted" style="font-size:12.5px;margin:0 0 14px;line-height:1.5">Download one language as JSON or CSV.</p>
                  <div class="field" style="margin-bottom:10px">
                    <label>Language</label>
                    <input class="input" [value]="ioLang()" (input)="ioLang.set($any($event.target).value)" placeholder="fr" />
                  </div>
                  <div class="row" style="gap:8px">
                    <lx-btn variant="ghost" icon="Download" (clicked)="exportFile('json')">JSON</lx-btn>
                    <lx-btn variant="ghost" icon="Download" (clicked)="exportFile('csv')">CSV</lx-btn>
                  </div>
                </div>
              </div>
              </div>
            }
          }
        </div>
      </div>
    </div>

    @if (generating()) {
      <lx-prompt-dialog
        title="Generate an API key"
        description="The secret is shown once, right after it is created."
        [fields]="keyFields"
        submitLabel="Generate key"
        (submitted)="createKey($event)"
        (cancelled)="generating.set(false)"
      />
    }

    @if (pendingRevoke(); as k) {
      <lx-confirm-dialog
        title="Revoke this key?"
        [description]="'“' + k.label + '” stops working immediately. Anything using it — CI, the CLI, your apps — loses access until it is replaced.'"
        confirmLabel="Revoke key"
        (confirmed)="confirmRevoke(k)"
        (cancelled)="pendingRevoke.set(null)"
      />
    }
  `,
  styles: `
    .gform {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
      margin: 14px 0 18px;
    }
    .gform .input { flex: 1; min-width: 180px; }
    .gform select {
      padding: 8px 10px;
      border: 1px solid var(--lx-line);
      border-radius: 8px;
      background: var(--lx-card);
      color: var(--lx-ink);
      font-size: 13.5px;
    }
    .gkeep {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--lx-slate);
    }
    .gtable { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    .gtable th {
      text-align: left;
      font-size: 11.5px;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--lx-slate);
      padding: 8px 10px;
      border-bottom: 1px solid var(--lx-line);
    }
    .gtable td { padding: 10px; border-bottom: 1px solid var(--lx-line); }
    .proj-image {
      width: 44px;
      height: 44px;
      border-radius: 11px;
      display: grid;
      place-items: center;
      overflow: hidden;
      flex: none;
    }
    .proj-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .hint {
      font-size: 12px;
      color: var(--lx-slate);
      line-height: 1.5;
      margin: 6px 0 0;
    }
    .keyrow {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 13px 18px;
    }
    .keycode {
      font-family: var(--lx-mono);
      font-size: 12.5px;
      background: var(--lx-fill);
      padding: 4px 9px;
      border-radius: var(--lx-r-sm);
      color: var(--lx-ink-80);
    }
    .cli-card {
      padding: 16px;
      display: flex;
      gap: 12px;
      align-items: flex-start;
      background: var(--lx-accent-soft);
      border-color: var(--lx-accent-soft-2);
    }
    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }
    .int-ico {
      width: 36px;
      height: 36px;
      border-radius: 9px;
      background: var(--lx-fill);
      display: grid;
      place-items: center;
    }
  `,
})
export class SettingsScreen implements OnInit {
  private readonly api = inject(ApiService);
  private readonly state = inject(ProjectStateService);
  protected readonly toast = inject(ToastService);
  protected readonly project = this.state.current;

  protected readonly tab = signal<'general' | 'appearance' | 'glossary' | 'api' | 'integrations' | 'export'>('api');
  protected readonly keys = signal<ApiKeyView[]>([]);
  protected readonly saving = signal(false);
  protected readonly draftName = signal('');
  protected readonly draftImage = signal<string | null>(null);
  protected readonly draftContext = signal('');
  protected readonly generating = signal(false);
  protected readonly pendingRevoke = signal<ApiKeyView | null>(null);
  protected readonly keyFields = [
    { name: 'label', label: 'Key label', placeholder: 'CI / GitHub Actions', hint: 'Name it after where it will be used.' },
  ];

  protected readonly tabs: {
    id: 'general' | 'appearance' | 'glossary' | 'api' | 'integrations' | 'export';
    icon: IconName;
    label: string;
  }[] = [
    { id: 'general', icon: 'Settings2', label: 'General' },
    { id: 'appearance', icon: 'Settings2', label: 'Appearance' },
    { id: 'glossary', icon: 'FileText', label: 'Glossary' },
    { id: 'api', icon: 'KeyRound', label: 'API keys' },
    { id: 'integrations', icon: 'GitBranch', label: 'Integrations' },
    { id: 'export', icon: 'FileUp', label: 'Import / Export' },
  ];

  /**
   * Only what exists. A tile reading "Connected" for an integration nobody
   * built says the work is done; the ones that are not built are not listed.
   */
  protected readonly integrations: IntegrationItem[] = [
    {
      icon: 'Terminal',
      name: 'CLI & API',
      desc: 'Pull and push translations from your terminal or CI, using an API key.',
      on: true,
    },
  ];

  protected readonly glossary = signal<GlossaryEntryView[]>([]);
  protected readonly languages = signal<{ code: string; name: string }[]>([]);
  protected readonly gTerm = signal('');
  protected readonly gTranslation = signal('');
  protected readonly gLang = signal('');
  protected readonly gKeep = signal(false);

  protected addGlossary(e: Event): void {
    e.preventDefault();
    const pid = this.state.current()?.id;
    const term = this.gTerm().trim();
    if (!pid || !term) return;
    this.api
      .addGlossaryEntry(pid, {
        term,
        languageCode: this.gLang() || null,
        translation: this.gKeep() ? null : this.gTranslation().trim() || null,
        doNotTranslate: this.gKeep(),
      })
      .subscribe({
        next: () => {
          this.gTerm.set('');
          this.gTranslation.set('');
          this.loadGlossary(pid);
          this.toast.show('Glossary updated');
        },
        error: (err) =>
          this.toast.show({
            message: err?.error?.detail ?? 'That term could not be added.',
            tone: 'error',
          }),
      });
  }

  protected removeGlossary(g: GlossaryEntryView): void {
    const pid = this.state.current()?.id;
    if (!pid) return;
    this.api.deleteGlossaryEntry(pid, g.id).subscribe({
      next: () => this.loadGlossary(pid),
      error: () => this.toast.show({ message: 'That term could not be removed.', tone: 'error' }),
    });
  }

  private loadGlossary(pid: string): void {
    this.api.glossary(pid).subscribe((g) => this.glossary.set(g));
  }

  ngOnInit(): void {
    this.state.whenReady((pid) => {
      this.api.listApiKeys(pid).subscribe((k) => this.keys.set(k));
      this.loadGlossary(pid);
      this.api
        .listLanguages(pid)
        .subscribe((l) => this.languages.set(l.map((x) => ({ code: x.code, name: x.name }))));
      this.api.getProject(pid).subscribe((p) => {
        this.draftName.set(p.name);
        this.draftImage.set(p.image);
        this.draftContext.set(p.translationContext ?? '');
      });
    });
  }

  protected onImageFile(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 512 * 1024) {
      this.toast.show({ message: 'That image is larger than 512 KB', tone: 'error' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => this.draftImage.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  protected clearImage(): void {
    this.draftImage.set(null);
  }

  protected saveProject(): void {
    const pid = this.state.current()?.id;
    if (!pid) return;
    this.saving.set(true);
    this.api
      .updateProject(pid, { name: this.draftName(), image: this.draftImage() ?? '' })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.state.load();
          this.toast.show('Project saved');
        },
        error: () => {
          this.saving.set(false);
          this.toast.show({ message: 'Not allowed (needs admin)', tone: 'error' });
        },
      });
  }

  protected saveContext(): void {
    const pid = this.state.current()?.id;
    if (!pid) return;
    this.saving.set(true);
    this.api.updateProject(pid, { translationContext: this.draftContext() }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.show('Translation context saved');
      },
      error: () => {
        this.saving.set(false);
        this.toast.show({ message: 'Not allowed (needs admin)', tone: 'error' });
      },
    });
  }

  protected createKey(values: Record<string, string>): void {
    const pid = this.state.current()?.id;
    if (!pid) return;
    const label = values['label'];
    this.generating.set(false);
    this.api.generateApiKey(pid, { label }).subscribe({
      next: (k) => {
        this.toast.show('New API key generated');
        window.alert(`Copy your key now — it won't be shown again:\n\n${k.secret}`);
        this.api.listApiKeys(pid).subscribe((list) => this.keys.set(list));
      },
      error: () => this.toast.show({ message: 'Not allowed (needs admin)', tone: 'error' }),
    });
  }

  protected readonly ioLang = signal('fr');

  protected onImportFile(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const pid = this.state.current()?.id;
    if (!pid) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as Record<string, string>;
        this.api.importTranslations(pid, this.ioLang(), data).subscribe({
          next: (r) => this.toast.show(`Imported ${r.total} strings (${r.created} new)`),
          error: () => this.toast.show('Import failed (check the language and file)'),
        });
      } catch {
        this.toast.show({ message: 'Not valid JSON', tone: 'error' });
      }
      input.value = '';
    };
    reader.readAsText(file);
  }

  protected exportFile(format: 'json' | 'csv'): void {
    const pid = this.state.current()?.id;
    if (!pid) return;
    this.api.exportTranslations(pid, this.ioLang(), format).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `translations-${this.ioLang()}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
        this.toast.show(`Exported ${this.ioLang()}.${format}`);
      },
      error: () => this.toast.show({ message: 'Export failed', tone: 'error' }),
    });
  }

  protected confirmRevoke(k: ApiKeyView): void {
    this.pendingRevoke.set(null);
    const pid = this.state.current()?.id;
    if (!pid) return;
    this.api.revokeApiKey(pid, k.id).subscribe({
      next: () => {
        this.keys.update((list) => list.filter((x) => x.id !== k.id));
        this.toast.show('Key revoked');
      },
      error: () => this.toast.show({ message: 'Not allowed (needs admin)', tone: 'error' }),
    });
  }
}
