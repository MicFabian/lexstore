import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { Icon } from '../../shared/icon';
import { Btn, SearchBox } from '../../shared/primitives';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { ApiService } from '../../core/api.service';
import { ProjectStateService } from '../../core/project-state.service';
import { ToastService } from '../../core/toast.service';
import {
  AgentActivityRow,
  AiSettings,
  ApiKeyView,
  CacheEntryView,
  CacheStats,
  OrgApiKeyCreated,
  CredentialView,
  OrgMemberView,
  OrganisationView,
  UsageSummary,
} from '../../core/models';

type Tab = 'overview' | 'ai' | 'keys' | 'access' | 'activity' | 'members';

@Component({
  selector: 'lx-org-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Btn, SearchBox, ConfirmDialog],
  template: `
    <div class="scr">
      <header class="ohead">
        <div>
          <div class="eyebrow">Organisation</div>
          <h1 class="otitle">{{ org()?.name || 'Loading…' }}</h1>
          <p class="muted">
            {{ org()?.projects }} projects · {{ org()?.members }} members
          </p>
        </div>
        @if (org()?.agent; as a) {
          <div class="quota">
            <div class="quota__head">
              <span class="eyebrow">Platform agent · {{ a.plan }}</span>
              <span class="quota__num">{{ a.used }} / {{ a.monthlyQuota }}</span>
            </div>
            <div class="bar"><i [style.width.%]="a.percentUsed"></i></div>
            <div class="muted small">
              {{ a.remaining }} left · resets {{ a.periodEnd }}
            </div>
          </div>
        } @else {
          <div class="quota quota--none">
            <span class="eyebrow">No agent plan</span>
            <p class="muted small">This organisation translates with its own provider keys.</p>
          </div>
        }
      </header>

      <nav class="subnav">
        @for (t of tabs; track t.id) {
          <button [class.on]="tab() === t.id" (click)="setTab(t.id)">{{ t.label }}</button>
        }
      </nav>

      @switch (tab()) {
        @case ('overview') {
          @if (usage(); as u) {
            <div class="cards">
              <div class="card"><div class="cnum">{{ u.totalRequests }}</div><div class="clab">AI requests · 30d</div></div>
              <div class="card"><div class="cnum">{{ u.cacheHitRate }}%</div><div class="clab">Served from cache</div></div>
              <div class="card"><div class="cnum">{{ (u.inputTokens + u.outputTokens).toLocaleString() }}</div><div class="clab">Tokens used</div></div>
              <div class="card" [class.card--bad]="u.failures > 0">
                <div class="cnum">{{ u.failures }}</div><div class="clab">Failed</div>
              </div>
            </div>

            <h2 class="sect">By provider</h2>
            @if (u.byProvider.length) {
              <table class="otable" aria-label="AI usage by provider">
                <thead><tr><th>Provider</th><th>Requests</th><th>Input tokens</th><th>Output tokens</th></tr></thead>
                <tbody>
                  @for (p of u.byProvider; track p.provider) {
                    <tr>
                      <td><span class="chip">{{ p.provider }}</span></td>
                      <td>{{ p.requests }}</td>
                      <td>{{ p.inputTokens.toLocaleString() }}</td>
                      <td>{{ p.outputTokens.toLocaleString() }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <p class="muted">No AI requests in this period.</p>
            }

            @if (u.byDay.length) {
              <h2 class="sect">Daily</h2>
              <div class="spark">
                @for (d of u.byDay; track d.day) {
                  <div class="spark__col" [title]="d.day + ': ' + d.requests + ' requests'">
                    <i [style.height.%]="barHeight(d.requests)"></i>
                    <span>{{ d.day.slice(5) }}</span>
                  </div>
                }
              </div>
            }
          }
        }

        @case ('ai') {
          <p class="muted">
            How on-demand translation behaves everywhere — the editor's drafts and
            suggestions, and the auto-translate runs. Identical requests are served
            from the cache below.
          </p>
          @if (settings(); as s) {
            <div class="aiform">
              <div class="field">
                <label>Provider</label>
                <div class="row" style="gap:8px">
                  @for (p of providers; track p.key) {
                    <button
                      [class]="'btn btn--sm ' + (draft().provider === p.key ? 'btn--ghost' : 'btn--subtle')"
                      [style.border-color]="draft().provider === p.key ? 'var(--lx-accent)' : null"
                      [style.color]="draft().provider === p.key ? 'var(--lx-accent)' : null"
                      [disabled]="unavailable(p.key, s)"
                      (click)="patchAi({ provider: p.key })"
                    >{{ p.label }}</button>
                  }
                </div>
                @if (!s.claudeAvailable || !s.geminiAvailable) {
                  <div class="muted small" style="margin-top:4px">{{ missingKeysHint(s) }}</div>
                }
              </div>
              <div class="field"><label>Model</label><input class="input" [value]="draft().model" (input)="patchAi({ model: $any($event.target).value })" /></div>
              <div class="field">
                <label>Formality</label>
                <div class="row" style="gap:6px">
                  @for (f of ['neutral', 'formal', 'informal']; track f) {
                    <button [class]="'btn btn--sm ' + (draft().formality === f ? 'btn--ghost' : 'btn--subtle')"
                      [style.border-color]="draft().formality === f ? 'var(--lx-accent)' : null"
                      (click)="patchAi({ formality: f })">{{ f }}</button>
                  }
                </div>
              </div>
              <div class="field">
                <label>Style guidance</label>
                <textarea class="textarea" rows="2" [value]="draft().tone || ''" (input)="patchAi({ tone: $any($event.target).value })" placeholder="e.g. Keep it concise; never translate the word 'Lexstore'."></textarea>
              </div>
              <div class="row">
                <button [class]="draft().autoFlagFuzzy ? 'toggle on' : 'toggle'" [attr.aria-pressed]="draft().autoFlagFuzzy" (click)="patchAi({ autoFlagFuzzy: !draft().autoFlagFuzzy })"><i></i></button>
                <div>
                  <div style="font-size:var(--lx-size-13)">Machine output needs review</div>
                  <div class="muted small">An accepted draft stays flagged until a person confirms it.</div>
                </div>
              </div>
              <div class="row" style="gap:14px">
                <div class="field" style="width:140px"><label>Cache TTL (hours)</label><input class="input" type="number" [value]="draft().cacheTtlHours" (input)="patchAi({ cacheTtlHours: +$any($event.target).value })" /></div>
                <lx-btn variant="primary" style="align-self:flex-end" (clicked)="saveAiSettings()">Save settings</lx-btn>
              </div>
            </div>
          }

          <h2 class="sect">
            Cache
            @if (cacheStats(); as cs) {
              <span class="muted small" style="text-transform:none;letter-spacing:0">
                · {{ cs.entries }} entries · {{ cs.hitRate }}% of {{ cs.requests }} requests served from it
              </span>
            }
          </h2>
          <div class="row" style="gap:10px">
            <lx-search placeholder="Search source or target" [value]="cacheQuery()" [width]="260" (changed)="onCacheSearch($event)" />
            <div class="spacer"></div>
            <button class="btn btn--subtle btn--sm" style="color:var(--lx-danger)" (click)="clearCache()">
              <lx-icon name="Trash2" [size]="14" />Clear all
            </button>
          </div>
          @if (cache().length) {
            <table class="otable" aria-label="Cached translations">
              <thead><tr><th>Source</th><th>Translation</th><th>Langs</th><th>Hits</th><th>Last used</th><th></th></tr></thead>
              <tbody>
                @for (c of cache(); track c.id) {
                  <tr>
                    <td class="atext">{{ c.sourceText }}</td>
                    <td class="atext">{{ c.targetText }}</td>
                    <td><span class="locale">{{ c.sourceLang }}</span> → <span class="locale">{{ c.targetLang }}</span></td>
                    <td class="tnum">{{ c.hits }}</td>
                    <td class="muted">{{ c.lastUsedAt }}</td>
                    <td style="text-align:right">
                      <button class="btn btn--subtle btn--sm btn--icon" aria-label="Delete entry" (click)="deleteCacheEntry(c)">
                        <lx-icon name="Trash2" [size]="14" color="var(--lx-text-muted)" />
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <p class="muted">Cache is empty.</p>
          }
        }

        @case ('keys') {
          <p class="muted">
            A key set on a project overrides the organisation's for that project.
            Keys are stored encrypted and shown only by their last four characters.
          </p>
          <form class="keyform" (submit)="saveKey($event)">
            <select [value]="draftProvider()" (change)="draftProvider.set($any($event.target).value)">
              <option value="claude">Claude (Anthropic)</option>
              <option value="openai">ChatGPT (OpenAI)</option>
              <option value="gemini">Gemini (Google)</option>
            </select>
            <input
              class="input"
              type="password"
              placeholder="Paste the API key"
              [value]="draftKey()"
              (input)="draftKey.set($any($event.target).value)"
            />
            <select [value]="draftScope()" (change)="draftScope.set($any($event.target).value)">
              <option value="">Whole organisation</option>
              @for (p of projects(); track p.id) {
                <option [value]="p.id">Only {{ p.name }}</option>
              }
            </select>
            <lx-btn variant="primary" [disabled]="!draftKey() || saving()">
              {{ saving() ? 'Saving…' : 'Save key' }}
            </lx-btn>
          </form>

          @if (credentials().length) {
            <table class="otable" aria-label="Stored provider keys">
              <thead><tr><th>Provider</th><th>Scope</th><th>Key</th><th>Added</th><th></th></tr></thead>
              <tbody>
                @for (c of credentials(); track c.id) {
                  <tr>
                    <td><span class="chip">{{ c.provider }}</span></td>
                    <td>{{ c.scope === 'project' ? c.projectName : 'Organisation' }}</td>
                    <td><code>••••{{ c.tail }}</code> <span class="muted small">{{ c.label }}</span></td>
                    <td class="muted">{{ c.createdAt }}<br /><span class="small">{{ c.createdBy }}</span></td>
                    <td style="text-align:right">
                      <button class="btn btn--subtle btn--sm" (click)="pendingDelete.set(c)">
                        <lx-icon name="Trash2" [size]="14" />Remove
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <p class="muted">No keys stored. Translation falls back to the server's configuration.</p>
          }
        }

        @case ('access') {
          <p class="muted">
            An organisation key reaches every project here. A key scoped to a single
            project is created in that project's settings instead.
          </p>

          @if (newKey(); as k) {
            <div class="newkey">
              <div class="eyebrow">Copy this now — it is not shown again</div>
              <code>{{ k.secret }}</code>
            </div>
          }

          <form class="keyform" (submit)="createApiKey($event)">
            <input
              class="input"
              placeholder="What is it for? e.g. Release pipeline"
              [value]="keyLabel()"
              (input)="keyLabel.set($any($event.target).value)"
            />
            <select [value]="keyScope()" (change)="keyScope.set($any($event.target).value)">
              <option value="Read only">Read only</option>
              <option value="Read & write">Read &amp; write</option>
            </select>
            <lx-btn variant="primary" [disabled]="!keyLabel() || creatingKey()">
              {{ creatingKey() ? 'Creating…' : 'Create key' }}
            </lx-btn>
          </form>

          @if (apiKeys().length) {
            <table class="otable" aria-label="Organisation API keys">
              <thead><tr><th>Label</th><th>Scope</th><th>Key</th><th>Last used</th><th></th></tr></thead>
              <tbody>
                @for (k of apiKeys(); track k.id) {
                  <tr>
                    <td>{{ k.label }}</td>
                    <td>
                      <span [class]="'chip ' + (k.scope === 'Read only' ? 'chip--neutral' : 'chip--translated')">
                        {{ k.scope }}
                      </span>
                    </td>
                    <td><code>{{ k.prefix }}••••{{ k.tail }}</code></td>
                    <td class="muted">{{ k.used }}<br /><span class="small">added {{ k.created }}</span></td>
                    <td style="text-align:right">
                      <button class="btn btn--subtle btn--sm" (click)="revokeApiKey(k)">
                        <lx-icon name="Trash2" [size]="14" />Revoke
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <p class="muted">No organisation keys yet.</p>
          }
        }

        @case ('activity') {
          <p class="muted">Every AI request this organisation made, newest first.</p>
          @if (activity().length) {
            <table class="otable" aria-label="AI activity">
              <thead><tr><th>When</th><th>Project</th><th>Language</th><th>Source</th><th>Provider</th><th>Tokens</th></tr></thead>
              <tbody>
                @for (a of activity(); track $index) {
                  <tr>
                    <td class="muted">{{ a.at }}</td>
                    <td>{{ a.projectName || '—' }}</td>
                    <td><span class="locale">{{ a.languageCode }}</span></td>
                    <td class="atext">{{ a.sourceText }}</td>
                    <td>
                      <span class="chip">{{ a.provider }}</span>
                      @if (a.cacheHit) { <span class="chip chip--translated">cached</span> }
                      @if (a.status !== 'ok') { <span class="chip chip--untranslated">{{ a.status }}</span> }
                    </td>
                    <td class="muted">{{ a.inputTokens + a.outputTokens }}</td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <p class="muted">Nothing yet.</p>
          }
        }

        @case ('members') {
          <table class="otable" aria-label="Organisation members">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
            <tbody>
              @for (m of members(); track m.id) {
                <tr>
                  <td>{{ m.name }}</td>
                  <td class="muted">{{ m.email }}</td>
                  <td><span class="chip">{{ m.role }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        }
      }

      @if (pendingDelete(); as c) {
        <lx-confirm-dialog
          title="Remove this key?"
          [description]="'Translations for ' + (c.scope === 'project' ? c.projectName : 'this organisation') + ' fall back to the next key in line.'"
          confirmLabel="Remove"
          (confirmed)="removeKey(c)"
          (cancelled)="pendingDelete.set(null)"
        />
      }
    </div>
  `,
  styles: `
    .scr { display: flex; flex-direction: column; gap: 20px; padding: 24px 28px; overflow: auto; }
    .aiform { display: flex; flex-direction: column; gap: 16px; max-width: 560px; }
    .ohead { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; flex-wrap: wrap; }
    .otitle { font-size: var(--lx-size-20); font-weight: var(--lx-weight-medium); letter-spacing: var(--lx-track-tight); margin: 4px 0; }
    .quota { min-width: 260px; border: 1px solid var(--lx-line); border-radius: var(--lx-radius-3); padding: 14px 16px; }
    .quota--none { border-style: dashed; }
    .quota__head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
    .quota__num { font-size: 18px; font-weight: 600; }
    .bar { height: 6px; border-radius: 3px; background: var(--lx-surface-hover); margin: 10px 0 6px; overflow: hidden; }
    .bar i { display: block; height: 100%; background: var(--lx-accent); }
    .small { font-size: 12px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
    .card { border: 1px solid var(--lx-line); border-radius: var(--lx-radius-3); padding: 16px; }
    .card--bad .cnum { color: var(--lx-danger); }
    .cnum { font-size: var(--lx-size-26); font-weight: var(--lx-weight-regular); letter-spacing: var(--lx-track-tight); font-variant-numeric: var(--lx-numeric-tabular); }
    .clab { font-size: 12.5px; color: var(--lx-text-secondary); margin-top: 4px; }
    .sect { font-size: var(--lx-size-10); font-weight: var(--lx-weight-medium); text-transform: uppercase; letter-spacing: var(--lx-track-caps); color: var(--lx-text-secondary); margin: 8px 0 0; }
    .otable { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    .otable th { text-align: left; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--lx-text-secondary); padding: 8px 10px; border-bottom: 1px solid var(--lx-line); }
    .otable td { padding: 10px; border-bottom: 1px solid var(--lx-line); vertical-align: top; }
    .atext { max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .keyform { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .keyform select, .keyform .input { padding: 8px 10px; border: 1px solid var(--lx-line); border-radius: 8px; background: var(--lx-bg-card); color: var(--lx-text-primary); font-size: 13.5px; }
    .keyform .input { flex: 1; min-width: 240px; }
    .spark { display: flex; align-items: flex-end; gap: 4px; height: 120px; }
    .spark__col { display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 4px; flex: 1; height: 100%; }
    .spark__col i { display: block; width: 100%; background: var(--lx-accent); border-radius: 3px 3px 0 0; min-height: 2px; }
    .spark__col span { font-size: 10px; color: var(--lx-text-muted); }
    .newkey {
      border: 1px solid var(--lx-accent);
      border-radius: var(--lx-radius-3);
      padding: 12px 14px;
      margin-bottom: 4px;
      background: var(--lx-accent-soft);
    }
    .newkey code {
      display: block;
      margin-top: 6px;
      font-size: 13px;
      word-break: break-all;
    }
  `,
})
export class OrgScreen implements OnInit {
  private readonly api = inject(ApiService);
  private readonly state = inject(ProjectStateService);
  private readonly toast = inject(ToastService);

  protected readonly tabs = [
    { id: 'overview' as const, label: 'Usage' },
    { id: 'ai' as const, label: 'AI settings' },
    { id: 'keys' as const, label: 'AI keys' },
    { id: 'access' as const, label: 'API access' },
    { id: 'activity' as const, label: 'Activity' },
    { id: 'members' as const, label: 'Members' },
  ];

  protected readonly tab = signal<Tab>('overview');

  /** Optional ?tab= deep link, so other screens can open a section directly. */
  readonly tabParam = input<string | undefined>(undefined, { alias: 'tab' });

  private readonly applyTabParam = effect(() => {
    const t = this.tabParam();
    if (t && this.tabs.some((x) => x.id === t)) this.setTab(t as Tab);
  });

  protected setTab(t: Tab): void {
    this.tab.set(t);
    if (t === 'ai') {
      if (!this.settings()) {
        this.api.aiSettings().subscribe((s) => {
          this.settings.set(s);
          this.draft.set(s);
        });
      }
      this.loadCache();
    }
  }

  // ---- AI settings + cache (shared by every on-demand translation) ----
  protected readonly providers = [
    { key: 'mock', label: 'Mock' },
    { key: 'claude', label: 'Claude' },
    { key: 'gemini', label: 'Gemini' },
  ];
  protected readonly settings = signal<AiSettings | null>(null);
  protected readonly draft = signal<AiSettings>({
    provider: 'mock', model: '', temperature: 0.2, formality: 'neutral', tone: null,
    autoFlagFuzzy: true, cacheTtlHours: 720, claudeAvailable: false, geminiAvailable: false,
  });
  protected readonly cache = signal<CacheEntryView[]>([]);
  protected readonly cacheStats = signal<CacheStats | null>(null);
  protected readonly cacheQuery = signal('');

  protected unavailable(key: string, s: AiSettings): boolean {
    return (key === 'claude' && !s.claudeAvailable) || (key === 'gemini' && !s.geminiAvailable);
  }

  /** Names the providers whose server-side API key is missing. */
  protected missingKeysHint(s: AiSettings): string {
    const missing: string[] = [];
    if (!s.claudeAvailable) missing.push('Claude needs ANTHROPIC_API_KEY');
    if (!s.geminiAvailable) missing.push('Gemini needs GEMINI_API_KEY');
    return `${missing.join(', ')} on the server; mock is used until then.`;
  }

  protected patchAi(patch: Partial<AiSettings>): void {
    this.draft.update((d) => ({ ...d, ...patch }));
  }

  protected saveAiSettings(): void {
    this.api.aiUpdateSettings(this.draft()).subscribe((s) => {
      this.settings.set(s);
      this.draft.set(s);
      this.toast.show('AI settings saved');
    });
  }

  private loadCache(): void {
    this.api.aiCache(this.cacheQuery()).subscribe((c) => this.cache.set(c));
    this.api.aiCacheStats().subscribe((s) => this.cacheStats.set(s));
  }

  protected onCacheSearch(q: string): void {
    this.cacheQuery.set(q);
    this.api.aiCache(q).subscribe((c) => this.cache.set(c));
  }

  protected deleteCacheEntry(c: CacheEntryView): void {
    this.api.aiDeleteCacheEntry(c.id).subscribe(() => {
      this.loadCache();
      this.toast.show('Cache entry removed');
    });
  }

  protected clearCache(): void {
    this.api.aiClearCache().subscribe(() => {
      this.loadCache();
      this.toast.show('Cache cleared');
    });
  }
  protected readonly org = signal<OrganisationView | null>(null);
  protected readonly usage = signal<UsageSummary | null>(null);
  protected readonly activity = signal<AgentActivityRow[]>([]);
  protected readonly credentials = signal<CredentialView[]>([]);
  protected readonly members = signal<OrgMemberView[]>([]);
  protected readonly projects = this.state.projects;

  protected readonly draftProvider = signal('claude');
  protected readonly draftKey = signal('');
  protected readonly draftScope = signal('');
  protected readonly saving = signal(false);
  protected readonly pendingDelete = signal<CredentialView | null>(null);

  protected readonly apiKeys = signal<ApiKeyView[]>([]);
  protected readonly keyLabel = signal('');
  protected readonly keyScope = signal('Read only');
  protected readonly creatingKey = signal(false);
  protected readonly newKey = signal<OrgApiKeyCreated | null>(null);

  protected createApiKey(e: Event): void {
    e.preventDefault();
    const label = this.keyLabel().trim();
    if (!label || this.creatingKey()) return;
    this.creatingKey.set(true);
    this.api.createOrgApiKey({ label, scope: this.keyScope(), test: false }).subscribe({
      next: (k) => {
        this.creatingKey.set(false);
        this.keyLabel.set('');
        this.newKey.set(k);
        this.loadApiKeys();
      },
      error: (err) => {
        this.creatingKey.set(false);
        this.toast.show({
          message: err?.error?.detail ?? 'That key could not be created.',
          tone: 'error',
        });
      },
    });
  }

  protected revokeApiKey(k: ApiKeyView): void {
    this.api.revokeOrgApiKey(k.id).subscribe({
      next: () => {
        if (this.newKey()?.id === k.id) this.newKey.set(null);
        this.loadApiKeys();
        this.toast.show('Key revoked');
      },
      error: () => this.toast.show({ message: 'That key could not be revoked.', tone: 'error' }),
    });
  }

  private loadApiKeys(): void {
    this.api.orgApiKeys().subscribe({
      next: (k) => this.apiKeys.set(k),
      error: () => this.apiKeys.set([]),
    });
  }

  private readonly busiestDay = computed(() =>
    Math.max(1, ...(this.usage()?.byDay ?? []).map((d) => d.requests)),
  );

  ngOnInit(): void {
    this.api.org().subscribe((o) => this.org.set(o));
    this.api.usage(30).subscribe((u) => this.usage.set(u));
    this.api.agentActivity(50).subscribe((a) => this.activity.set(a));
    this.api.orgMembers().subscribe((m) => this.members.set(m));
    this.loadKeys();
    this.loadApiKeys();
  }

  protected barHeight(requests: number): number {
    return Math.round((requests / this.busiestDay()) * 100);
  }

  protected saveKey(e: Event): void {
    e.preventDefault();
    const key = this.draftKey().trim();
    if (!key) return;
    this.saving.set(true);
    this.api
      .saveCredential({
        provider: this.draftProvider(),
        apiKey: key,
        projectId: this.draftScope() || undefined,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.draftKey.set('');
          this.loadKeys();
          this.toast.show('Key saved');
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.show({
            message: err?.error?.detail ?? 'That key could not be saved.',
            tone: 'error',
          });
        },
      });
  }

  protected removeKey(c: CredentialView): void {
    this.pendingDelete.set(null);
    this.api.deleteCredential(c.id).subscribe({
      next: () => {
        this.loadKeys();
        this.toast.show('Key removed');
      },
      error: () => this.toast.show({ message: 'That key could not be removed.', tone: 'error' }),
    });
  }

  private loadKeys(): void {
    this.api.credentials().subscribe({
      next: (c) => this.credentials.set(c),
      error: () => this.credentials.set([]),
    });
  }
}
