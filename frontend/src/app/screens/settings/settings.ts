import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Icon, IconName } from '../../shared/icon';
import { Btn, Toggle } from '../../shared/primitives';
import { ApiService } from '../../core/api.service';
import { ProjectStateService } from '../../core/project-state.service';
import { ToastService } from '../../core/toast.service';
import { ApiKeyView } from '../../core/models';

interface IntegrationItem {
  icon: IconName;
  name: string;
  desc: string;
  on: boolean;
}

@Component({
  selector: 'tl-settings-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Btn, Toggle],
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
              <tl-icon [name]="t.icon" [size]="14" /><span>{{ t.label }}</span>
            </button>
          }
        </div>

        <div>
          @switch (tab()) {
            @case ('api') {
              <div style="display:flex;flex-direction:column;gap:18px">
                <div class="panel">
                  <div class="panel__head">
                    <tl-icon name="KeyRound" [size]="17" color="var(--tl-accent-hi)" />
                    <h2>API keys</h2>
                    <div class="spacer"></div>
                    <tl-btn variant="primary" [sm]="true" icon="Plus" (clicked)="generate()">Generate key</tl-btn>
                  </div>
                  <div style="padding:6px 0">
                    @for (k of keys(); track k.id; let last = $last) {
                      <div class="keyrow" [style.border-bottom]="last ? 'none' : '1px solid var(--tl-line-2)'">
                        <div style="flex:1;min-width:0">
                          <div class="row" style="gap:8px;margin-bottom:6px">
                            <span style="font-weight:600;font-size:13.5px">{{ k.label }}</span>
                            <span [class]="'chip ' + (k.scope === 'Read only' ? 'chip--neutral' : 'chip--translated')">{{ k.scope }}</span>
                            @if (k.test) {
                              <span class="chip chip--untranslated">Test</span>
                            }
                          </div>
                          <div class="row" style="gap:8px">
                            <code class="keycode">{{ k.prefix }}{{ revealed()[k.id] ? '9f2c4b8e1d7a3056' : '••••••••••••' }}{{ k.tail }}</code>
                            <button class="btn btn--subtle btn--sm" (click)="toggleReveal(k.id)">
                              <tl-icon [name]="revealed()[k.id] ? 'EyeOff' : 'Eye'" [size]="14" />{{ revealed()[k.id] ? 'Hide' : 'Reveal' }}
                            </button>
                            <button class="btn btn--subtle btn--sm" (click)="toast.show('Key copied to clipboard')">
                              <tl-icon name="Copy" [size]="14" />Copy
                            </button>
                          </div>
                        </div>
                        <div style="text-align:right;flex:none;min-width:150px">
                          <div class="muted" style="font-size:12px">Last used {{ k.used }}</div>
                          <div class="muted" style="font-size:11.5px;margin-top:2px">Created {{ k.created }}</div>
                          <button class="btn btn--subtle btn--sm" style="color:var(--tl-danger);margin-top:4px" (click)="revoke(k)">
                            <tl-icon name="Trash2" [size]="14" />Revoke
                          </button>
                        </div>
                      </div>
                    }
                  </div>
                </div>

                <div class="card cli-card">
                  <tl-icon name="Terminal" [size]="18" color="var(--tl-accent-text)" style="margin-top:1px" />
                  <div>
                    <div style="font-weight:600;font-size:13.5px;margin-bottom:4px">Pull translations from your terminal</div>
                    <code class="tl-mono" style="font-size:12.5px;color:var(--tl-accent-text)">$ translad pull --project {{ project()?.code }} --lang fr</code>
                  </div>
                </div>
              </div>
            }
            @case ('general') {
              <div class="panel">
                <div class="panel__head"><h2>Project</h2></div>
                <div style="padding:18px;display:flex;flex-direction:column;gap:16px;max-width:460px">
                  <div class="field"><label>Project name</label><input class="input" [value]="project()?.name ?? ''" /></div>
                  <div class="field"><label>Project slug</label><input class="input" style="font-family:var(--tl-mono);font-size:13px" [value]="project()?.code ?? ''" /></div>
                  <div class="field">
                    <label>Default source language</label>
                    <div class="row"><span class="locale" style="font-size:12px;padding:4px 8px">en</span><span style="font-size:13.5px">English</span></div>
                  </div>
                  <div class="row">
                    <tl-toggle [on]="autoFlag()" (toggled)="autoFlag.set(!autoFlag())" />
                    <div>
                      <div style="font-size:13.5px;font-weight:600">Auto-flag machine translations as fuzzy</div>
                      <div class="muted" style="font-size:12px">Require a human to confirm before they count as done.</div>
                    </div>
                  </div>
                  <div><tl-btn variant="primary" (clicked)="toast.show('Settings saved')">Save changes</tl-btn></div>
                </div>
              </div>
            }
            @case ('integrations') {
              <div class="two-col">
                @for (it of integrations; track it.name) {
                  <div class="card" style="padding:16px">
                    <div class="row" style="margin-bottom:10px">
                      <span class="int-ico"><tl-icon [name]="it.icon" [size]="18" color="var(--tl-ink)" /></span>
                      <span style="font-weight:700;font-size:14px">{{ it.name }}</span>
                      <div class="spacer"></div>
                      @if (it.on) {
                        <span class="chip chip--translated">Connected</span>
                      } @else {
                        <button class="btn btn--ghost btn--sm">Connect</button>
                      }
                    </div>
                    <p class="muted" style="font-size:12.5px;margin:0;line-height:1.5">{{ it.desc }}</p>
                  </div>
                }
              </div>
            }
            @case ('export') {
              <div class="two-col">
                <div class="card" style="padding:18px">
                  <tl-icon name="FileUp" [size]="20" color="var(--tl-accent-hi)" />
                  <div style="font-weight:700;font-size:14.5px;margin:10px 0 4px">Import strings</div>
                  <p class="muted" style="font-size:12.5px;margin:0 0 14px;line-height:1.5">Upload a JSON file of key→value pairs into a language.</p>
                  <div class="field" style="margin-bottom:10px">
                    <label>Target language</label>
                    <input class="input" [value]="ioLang()" (input)="ioLang.set($any($event.target).value)" placeholder="fr" />
                  </div>
                  <input #fileInput type="file" accept=".json,application/json" style="display:none" (change)="onImportFile($event)" />
                  <tl-btn variant="ghost" icon="Upload" (clicked)="fileInput.click()">Choose JSON file</tl-btn>
                </div>
                <div class="card" style="padding:18px">
                  <tl-icon name="FileDown" [size]="20" color="var(--tl-accent-hi)" />
                  <div style="font-weight:700;font-size:14.5px;margin:10px 0 4px">Export translations</div>
                  <p class="muted" style="font-size:12.5px;margin:0 0 14px;line-height:1.5">Download one language as JSON or CSV.</p>
                  <div class="field" style="margin-bottom:10px">
                    <label>Language</label>
                    <input class="input" [value]="ioLang()" (input)="ioLang.set($any($event.target).value)" placeholder="fr" />
                  </div>
                  <div class="row" style="gap:8px">
                    <tl-btn variant="ghost" icon="Download" (clicked)="exportFile('json')">JSON</tl-btn>
                    <tl-btn variant="ghost" icon="Download" (clicked)="exportFile('csv')">CSV</tl-btn>
                  </div>
                </div>
              </div>
            }
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .keyrow {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 13px 18px;
    }
    .keycode {
      font-family: var(--tl-mono);
      font-size: 12.5px;
      background: var(--tl-fill);
      padding: 4px 9px;
      border-radius: var(--tl-r-sm);
      color: var(--tl-ink-80);
    }
    .cli-card {
      padding: 16px;
      display: flex;
      gap: 12px;
      align-items: flex-start;
      background: var(--tl-accent-soft);
      border-color: var(--tl-accent-soft-2);
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
      background: var(--tl-fill);
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

  protected readonly tab = signal<'general' | 'api' | 'integrations' | 'export'>('api');
  protected readonly keys = signal<ApiKeyView[]>([]);
  protected readonly revealed = signal<Record<string, boolean>>({});
  protected readonly autoFlag = signal(true);

  protected readonly tabs: { id: 'general' | 'api' | 'integrations' | 'export'; icon: IconName; label: string }[] = [
    { id: 'general', icon: 'Settings2', label: 'General' },
    { id: 'api', icon: 'KeyRound', label: 'API keys' },
    { id: 'integrations', icon: 'GitBranch', label: 'Integrations' },
    { id: 'export', icon: 'FileUp', label: 'Import / Export' },
  ];

  protected readonly integrations: IntegrationItem[] = [
    { icon: 'Github', name: 'GitHub', desc: 'Sync source strings on every push.', on: true },
    { icon: 'Terminal', name: 'CLI & API', desc: 'Pull and push from CI/CD.', on: true },
    { icon: 'Webhook', name: 'Webhooks', desc: 'Notify your services on status changes.', on: false },
    { icon: 'MessageSquare', name: 'Slack', desc: 'Post when a language reaches 100%.', on: false },
  ];

  ngOnInit(): void {
    this.state.whenReady((pid) => this.api.listApiKeys(pid).subscribe((k) => this.keys.set(k)));
  }

  protected toggleReveal(id: string): void {
    this.revealed.update((r) => ({ ...r, [id]: !r[id] }));
  }

  protected generate(): void {
    const pid = this.state.current()?.id;
    if (!pid) return;
    const label = window.prompt('Key label', 'New key');
    if (!label) return;
    this.api.generateApiKey(pid, { label }).subscribe({
      next: (k) => {
        this.toast.show('New API key generated');
        window.alert(`Copy your key now — it won't be shown again:\n\n${k.secret}`);
        this.api.listApiKeys(pid).subscribe((list) => this.keys.set(list));
      },
      error: () => this.toast.show('Not allowed (needs admin)'),
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
        this.toast.show('Not valid JSON');
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
      error: () => this.toast.show('Export failed'),
    });
  }

  protected revoke(k: ApiKeyView): void {
    if (!window.confirm(`Revoke "${k.label}"? Apps using it will stop working.`)) return;
    const pid = this.state.current()?.id;
    if (!pid) return;
    this.api.revokeApiKey(pid, k.id).subscribe({
      next: () => {
        this.keys.update((list) => list.filter((x) => x.id !== k.id));
        this.toast.show('Key revoked');
      },
      error: () => this.toast.show('Not allowed (needs admin)'),
    });
  }
}
