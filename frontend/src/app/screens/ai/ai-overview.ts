import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Icon } from '../../shared/icon';
import { Avatar, Btn, SearchBox } from '../../shared/primitives';
import { Segmented } from '../../shared/segmented';
import { BrandMark } from '../../shell/brand-mark';
import { Toast } from '../../shell/toast';
import { TweaksPanel } from '../../shell/tweaks-panel';
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
  imports: [Icon, Avatar, Btn, SearchBox, Segmented, BrandMark, Toast, TweaksPanel],
  template: `
    <div class="ai-root">
      <header class="topbar topbar--grid" style="padding-left:20px">
        <button class="rail__brand brand-btn" (click)="goHome()" style="padding:0;border:none;background:none">
          <tl-brand-mark [size]="26" [radius]="7" />
          <span class="word" style="font-weight:800;font-size:16px;letter-spacing:-.02em">Trans<b style="color:var(--tl-accent)">Lad</b></span>
        </button>
        <tl-icon name="ChevronRight" [size]="14" color="var(--tl-line)" />
        <span style="font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px">
          <tl-icon name="WandSparkles" [size]="15" color="var(--tl-accent)" />Translation AI
        </span>
        <div class="spacer"></div>
        <tl-btn variant="ghost" [sm]="true" icon="LayoutGrid" (clicked)="goHome()">Projects</tl-btn>
        <tl-avatar [i]="0" name="You There" [sm]="true" />
      </header>

      <div class="content">
        <div class="content__pad" style="max-width:1240px">
          <div class="row" style="margin-bottom:18px">
            <div>
              <h1 class="tl-display-3" style="font-size:28px">Translation AI</h1>
              <p class="muted" style="font-size:13.5px;margin:5px 0 0">
                A caching machine-translation service. Every call is logged; identical requests are served from cache.
              </p>
            </div>
          </div>

          <div class="stat-grid">
            <div class="card stat-card">
              <span class="stat-ico"><tl-icon name="Sparkles" [size]="18" color="var(--tl-accent)" /></span>
              <div><div class="stat-num">{{ stats()?.requests ?? 0 }}</div><div class="muted stat-label">Requests</div></div>
            </div>
            <div class="card stat-card">
              <span class="stat-ico"><tl-icon name="KeyRound" [size]="18" color="var(--tl-st-translated)" /></span>
              <div><div class="stat-num" style="color:var(--tl-st-translated)">{{ stats()?.hitRate ?? 0 }}%</div><div class="muted stat-label">Cache hit rate</div></div>
            </div>
            <div class="card stat-card">
              <span class="stat-ico"><tl-icon name="FileText" [size]="18" color="var(--tl-slate)" /></span>
              <div><div class="stat-num">{{ stats()?.entries ?? 0 }}</div><div class="muted stat-label">Cached entries</div></div>
            </div>
            <div class="card stat-card">
              <span class="stat-ico"><tl-icon name="CheckCheck" [size]="18" color="var(--tl-st-proofread)" /></span>
              <div><div class="stat-num">{{ stats()?.totalHits ?? 0 }}</div><div class="muted stat-label">Cache hits served</div></div>
            </div>
          </div>

          <div style="margin:20px 0 16px">
            <tl-segmented [options]="tabs" [value]="tab()" (changed)="setTab($any($event))" />
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
                            [disabled]="p.key === 'claude' && !s.claudeAvailable"
                            (click)="patch({ provider: p.key })"
                          >{{ p.label }}</button>
                        }
                      </div>
                      @if (!s.claudeAvailable) {
                        <div class="muted" style="font-size:11.5px;margin-top:4px">Claude needs ANTHROPIC_API_KEY on the server; mock is used until then.</div>
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

      <tl-toast />
      <tl-tweaks-panel />
    </div>
  `,
  styles: `
    .ai-root { height: 100vh; display: flex; flex-direction: column; overflow: hidden; background: var(--tl-paper); }
    .brand-btn { display: flex; align-items: center; gap: 10px; cursor: pointer; }
    .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .stat-card { padding: 16px; display: flex; align-items: center; gap: 13px; }
    .stat-ico { width: 38px; height: 38px; border-radius: 10px; background: var(--tl-fill); display: grid; place-items: center; flex: none; }
    .stat-num { font-family: var(--tl-mono); font-size: 22px; font-weight: 700; letter-spacing: -.02em; line-height: 1.1; }
    .stat-label { font-size: 12px; white-space: nowrap; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  `,
})
export class AiOverview implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
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
    autoFlagFuzzy: true, cacheTtlHours: 720, claudeAvailable: false,
  });

  protected readonly providers = [
    { key: 'mock', label: 'Mock' },
    { key: 'claude', label: 'Claude' },
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

  protected goHome(): void {
    this.router.navigate(['/', 'projects']);
  }

  protected truncate(s: string, n: number): string {
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }
}
