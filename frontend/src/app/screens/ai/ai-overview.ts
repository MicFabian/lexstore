import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Icon } from '../../shared/icon';
import { Btn, SearchBox } from '../../shared/primitives';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import {
  AiSettings,
  CacheEntryView,
  CacheStats,
  RequestLogView,
  TranslateResponse,
} from '../../core/models';

type Tab = 'playground' | 'requests' | 'cache' | 'settings';

@Component({
  selector: 'tl-ai-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Btn, SearchBox],
  template: `
    <div class="well">
      <div class="pad" style="max-width:1180px">
          <div class="phead" style="margin-bottom:26px">
            <div>
              <div class="eyebrow">Workspace</div>
              <h1 class="serif">Translation AI</h1>
              <div class="psub">
                A caching machine-translation service. Every call is logged; identical requests are served from cache.
              </div>
            </div>
          </div>

          <div class="statstrip">
            <div class="statcell"><div class="eyebrow">Requests</div><div class="serif statnum">{{ stats()?.requests ?? 0 }}</div></div>
            <div class="statcell"><div class="eyebrow">Cache hit rate</div><div class="serif statnum" style="color:var(--tl-st-translated)">{{ stats()?.hitRate ?? 0 }}%</div></div>
            <div class="statcell"><div class="eyebrow">Cached entries</div><div class="serif statnum">{{ stats()?.entries ?? 0 }}</div></div>
            <div class="statcell"><div class="eyebrow">Cache hits served</div><div class="serif statnum" style="color:var(--tl-st-proofread)">{{ stats()?.totalHits ?? 0 }}</div></div>
          </div>

          <div class="subnav" style="margin-bottom:26px">
            @for (t of tabs; track t.value) {
              <button [class.on]="tab() === t.value" (click)="setTab($any(t.value))">{{ t.label }}</button>
            }
          </div>

          @switch (tab()) {
            @case ('playground') {
              <div class="panel" style="padding:18px;max-width:720px">
                <div class="two-col" style="margin-bottom:14px">
                  <div class="field"><label>Source language</label><input class="input" [value]="srcLang()" (input)="srcLang.set($any($event.target).value)" /></div>
                  <div class="field"><label>Target language</label><input class="input" [value]="tgtLang()" (input)="tgtLang.set($any($event.target).value)" /></div>
                </div>
                <div class="field" style="margin-bottom:14px">
                  <label>Source text</label>
                  <textarea class="textarea" rows="3" [value]="srcText()" (input)="srcText.set($any($event.target).value)" placeholder="Type a string to translate…"></textarea>
                </div>
                <div class="row" style="gap:8px;margin-bottom:14px">
                  <tl-btn variant="primary" icon="WandSparkles" [disabled]="!srcText()" (clicked)="translate(false)">Translate</tl-btn>
                  <tl-btn variant="ghost" icon="Sparkles" [disabled]="!srcText()" (clicked)="translate(true)">Skip cache</tl-btn>
                </div>
                @if (result(); as r) {
                  <div class="card" style="padding:14px;background:var(--tl-paper)">
                    <div class="row" style="gap:8px;margin-bottom:8px">
                      @if (r.cacheHit) {
                        <span class="chip chip--translated">Cache hit</span>
                      } @else {
                        <span class="chip chip--new">Fresh</span>
                      }
                      <span class="muted tnum" style="font-size:12px">{{ r.provider }} · {{ r.model }}</span>
                      <div class="spacer"></div>
                      <span class="muted tnum" style="font-size:12px">{{ r.latencyMs }}ms · {{ r.inputTokens + r.outputTokens }} tok</span>
                    </div>
                    <div style="font-size:15px;color:var(--tl-ink)">{{ r.text }}</div>
                  </div>
                }
              </div>
            }

            @case ('requests') {
              <div class="panel">
                <div class="panel__head">
                  <h2>Request log</h2>
                  <div class="spacer"></div>
                  <tl-btn variant="subtle" [sm]="true" icon="Settings2" (clicked)="loadRequests()">Refresh</tl-btn>
                </div>
                <table class="ttable">
                  <thead>
                    <tr>
                      <th style="padding-left:18px">Source → Target</th>
                      <th>Result</th>
                      <th style="width:90px">Cache</th>
                      <th style="width:84px">Latency</th>
                      <th style="width:80px">Tokens</th>
                      <th style="width:90px">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (r of requests(); track r.id) {
                      <tr class="trow" style="cursor:default">
                        <td style="padding-left:18px">
                          <div style="font-size:13px">{{ truncate(r.sourceText, 48) }}</div>
                          <div class="row" style="gap:5px;margin-top:3px">
                            <span class="locale">{{ r.sourceLang }}</span>
                            <tl-icon name="ArrowRight" [size]="12" color="var(--tl-muted)" />
                            <span class="locale">{{ r.targetLang }}</span>
                          </div>
                        </td>
                        <td>
                          @if (r.status === 'error') {
                            <span style="color:var(--tl-danger);font-size:12.5px">{{ r.errorMessage }}</span>
                          } @else {
                            <span style="font-size:13px">{{ truncate(r.resultText || '', 56) }}</span>
                          }
                        </td>
                        <td>
                          @if (r.cacheHit) {
                            <span class="chip chip--translated">Hit</span>
                          } @else {
                            <span class="chip chip--neutral">Miss</span>
                          }
                        </td>
                        <td><span class="muted tnum" style="font-size:12.5px">{{ r.latencyMs }}ms</span></td>
                        <td><span class="muted tnum" style="font-size:12.5px">{{ r.inputTokens + r.outputTokens }}</span></td>
                        <td><span class="muted tnum" style="font-size:12px">{{ r.at }}</span></td>
                      </tr>
                    }
                    @if (requests().length === 0) {
                      <tr><td colspan="6" style="padding:40px;text-align:center" class="muted">No requests yet. Try the Translate tab.</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            }

            @case ('cache') {
              <div class="panel">
                <div class="panel__head">
                  <h2>Cache</h2>
                  <div class="spacer"></div>
                  <tl-search placeholder="Search source or target" [value]="cacheQuery()" [width]="240" (changed)="onCacheSearch($event)" />
                  <button class="btn btn--subtle btn--sm" style="color:var(--tl-danger)" (click)="clearAll()">
                    <tl-icon name="Trash2" [size]="14" />Clear all
                  </button>
                </div>
                <table class="ttable">
                  <thead>
                    <tr>
                      <th style="padding-left:18px">Source</th>
                      <th>Translation</th>
                      <th style="width:90px">Langs</th>
                      <th style="width:64px">Hits</th>
                      <th style="width:90px">Last used</th>
                      <th style="width:44px"></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (c of cache(); track c.id) {
                      <tr class="trow" style="cursor:default">
                        <td style="padding-left:18px"><span style="font-size:13px">{{ truncate(c.sourceText, 44) }}</span></td>
                        <td><span style="font-size:13px;color:var(--tl-ink)">{{ truncate(c.targetText, 48) }}</span></td>
                        <td>
                          <div class="row" style="gap:5px">
                            <span class="locale">{{ c.sourceLang }}</span>
                            <tl-icon name="ArrowRight" [size]="11" color="var(--tl-muted)" />
                            <span class="locale">{{ c.targetLang }}</span>
                          </div>
                        </td>
                        <td><span class="tnum" style="font-size:12.5px">{{ c.hits }}</span></td>
                        <td><span class="muted tnum" style="font-size:12px">{{ c.lastUsedAt }}</span></td>
                        <td>
                          <button class="btn btn--subtle btn--sm btn--icon" aria-label="Delete entry" (click)="deleteEntry(c)">
                            <tl-icon name="Trash2" [size]="14" color="var(--tl-muted)" />
                          </button>
                        </td>
                      </tr>
                    }
                    @if (cache().length === 0) {
                      <tr><td colspan="6" style="padding:40px;text-align:center" class="muted">Cache is empty.</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            }

            @case ('settings') {
              @if (settings(); as s) {
                <div class="panel" style="max-width:640px">
                  <div class="panel__head"><tl-icon name="WandSparkles" [size]="17" color="var(--tl-accent-hi)" /><h2>AI translation settings</h2></div>
                  <div style="padding:18px;display:flex;flex-direction:column;gap:18px">
                    <div class="field">
                      <label>Provider</label>
                      <div class="row" style="gap:8px">
                        @for (p of providers; track p.key) {
                          <button
                            [class]="'btn btn--sm ' + (draft().provider === p.key ? 'btn--ghost' : 'btn--subtle')"
                            [style.border-color]="draft().provider === p.key ? 'var(--tl-accent)' : null"
                            [style.color]="draft().provider === p.key ? 'var(--tl-accent-text)' : null"
                            [disabled]="unavailable(p.key, s)"
                            (click)="patch({ provider: p.key })"
                          >{{ p.label }}</button>
                        }
                      </div>
                      @if (!s.claudeAvailable || !s.geminiAvailable) {
                        <div class="muted" style="font-size:11.5px;margin-top:4px">
                          {{ missingKeysHint(s) }}
                        </div>
                      }
                    </div>
                    <div class="field"><label>Model</label><input class="input" [value]="draft().model" (input)="patch({ model: $any($event.target).value })" /></div>
                    <div class="field">
                      <label>Temperature · {{ draft().temperature }}</label>
                      <input type="range" min="0" max="1" step="0.1" [value]="draft().temperature" (input)="patch({ temperature: +$any($event.target).value })" />
                    </div>
                    <div class="field">
                      <label>Formality</label>
                      <div class="row" style="gap:6px">
                        @for (f of ['neutral','formal','informal']; track f) {
                          <button [class]="'btn btn--sm ' + (draft().formality === f ? 'btn--ghost' : 'btn--subtle')"
                            [style.border-color]="draft().formality === f ? 'var(--tl-accent)' : null"
                            (click)="patch({ formality: f })">{{ f }}</button>
                        }
                      </div>
                    </div>
                    <div class="field">
                      <label>Style / glossary guidance</label>
                      <textarea class="textarea" rows="2" [value]="draft().tone || ''" (input)="patch({ tone: $any($event.target).value })" placeholder="e.g. Keep it concise; never translate the word 'TransLad'."></textarea>
                    </div>
                    <div class="row">
                      <button [class]="draft().autoFlagFuzzy ? 'toggle on' : 'toggle'" (click)="patch({ autoFlagFuzzy: !draft().autoFlagFuzzy })"><i></i></button>
                      <div><div style="font-size:13.5px;font-weight:600">Auto-flag machine translations as fuzzy</div><div class="muted" style="font-size:12px">Require a human to confirm before they count as done.</div></div>
                    </div>
                    <div class="field"><label>Cache TTL (hours)</label><input class="input" type="number" [value]="draft().cacheTtlHours" (input)="patch({ cacheTtlHours: +$any($event.target).value })" /></div>
                    <div><tl-btn variant="primary" (clicked)="saveSettings()">Save settings</tl-btn></div>
                  </div>
                </div>
              }
            }
          }
      </div>
    </div>
  `,
  styles: `
    .statstrip {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      border: 1px solid var(--tl-line);
      border-radius: var(--tl-r-xl);
      background: var(--tl-card);
      overflow: hidden;
      margin-bottom: 26px;
    }
    .statcell { padding: 20px 22px; }
    .statcell + .statcell { border-left: 1px solid var(--tl-line); }
    .statnum { font-size: 34px; margin-top: 8px; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  `,
})
export class AiOverview implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly toast = inject(ToastService);

  protected readonly tab = signal<Tab>('playground');
  protected readonly tabs = [
    { value: 'playground', label: 'Translate' },
    { value: 'requests', label: 'Requests' },
    { value: 'cache', label: 'Cache' },
    { value: 'settings', label: 'Settings' },
  ];

  protected readonly stats = signal<CacheStats | null>(null);
  protected readonly requests = signal<RequestLogView[]>([]);
  protected readonly cache = signal<CacheEntryView[]>([]);
  protected readonly settings = signal<AiSettings | null>(null);
  protected readonly draft = signal<AiSettings>({
    provider: 'mock', model: '', temperature: 0.2, formality: 'neutral', tone: null,
    autoFlagFuzzy: true, cacheTtlHours: 720, claudeAvailable: false, geminiAvailable: false,
  });

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

  protected readonly providers = [
    { key: 'mock', label: 'Mock' },
    { key: 'claude', label: 'Claude' },
    { key: 'gemini', label: 'Gemini' },
  ];

  // Playground
  protected readonly srcText = signal('');
  protected readonly srcLang = signal('en');
  protected readonly tgtLang = signal('fr');
  protected readonly result = signal<TranslateResponse | null>(null);
  protected readonly cacheQuery = signal('');

  ngOnInit(): void {
    this.loadStats();
    this.api.aiSettings().subscribe((s) => { this.settings.set(s); this.draft.set(s); });
  }

  protected setTab(t: Tab): void {
    this.tab.set(t);
    if (t === 'requests') this.loadRequests();
    if (t === 'cache') this.loadCache();
  }

  private loadStats(): void {
    this.api.aiCacheStats().subscribe((s) => this.stats.set(s));
  }
  protected loadRequests(): void {
    this.api.aiRequests().subscribe((r) => this.requests.set(r));
  }
  private loadCache(): void {
    this.api.aiCache(this.cacheQuery()).subscribe((c) => this.cache.set(c));
  }

  protected translate(noCache: boolean): void {
    this.api
      .aiTranslate({ sourceText: this.srcText(), sourceLang: this.srcLang(), targetLang: this.tgtLang(), noCache })
      .subscribe({
        next: (r) => { this.result.set(r); this.loadStats(); },
        error: () => this.toast.show('Translation failed'),
      });
  }

  protected onCacheSearch(q: string): void {
    this.cacheQuery.set(q);
    this.loadCache();
  }

  protected deleteEntry(c: CacheEntryView): void {
    this.api.aiDeleteCacheEntry(c.id).subscribe(() => { this.loadCache(); this.loadStats(); this.toast.show('Cache entry removed'); });
  }
  protected clearAll(): void {
    this.api.aiClearCache().subscribe(() => { this.loadCache(); this.loadStats(); this.toast.show('Cache cleared'); });
  }

  protected patch(p: Partial<AiSettings>): void {
    this.draft.update((d) => ({ ...d, ...p }));
  }
  protected saveSettings(): void {
    this.api.aiUpdateSettings(this.draft()).subscribe((s) => {
      this.settings.set(s);
      this.draft.set(s);
      this.toast.show('AI settings saved');
    });
  }

  protected truncate(s: string, n: number): string {
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }
}
