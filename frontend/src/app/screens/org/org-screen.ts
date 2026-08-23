import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Icon } from '../../shared/icon';
import { Btn } from '../../shared/primitives';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { ApiService } from '../../core/api.service';
import { ProjectStateService } from '../../core/project-state.service';
import { ToastService } from '../../core/toast.service';
import {
  AgentActivityRow,
  CredentialView,
  OrgMemberView,
  OrganisationView,
  UsageSummary,
} from '../../core/models';

type Tab = 'overview' | 'keys' | 'activity' | 'members';

@Component({
  selector: 'lx-org-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Btn, ConfirmDialog],
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
          <button [class.on]="tab() === t.id" (click)="tab.set(t.id)">{{ t.label }}</button>
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
              <table class="otable">
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
            <table class="otable">
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

        @case ('activity') {
          <p class="muted">Every AI request this organisation made, newest first.</p>
          @if (activity().length) {
            <table class="otable">
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
          <table class="otable">
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
    .ohead { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; flex-wrap: wrap; }
    .otitle { font-size: 30px; font-weight: 300; letter-spacing: -0.02em; margin: 4px 0; }
    .quota { min-width: 260px; border: 1px solid var(--lx-line); border-radius: 10px; padding: 14px 16px; }
    .quota--none { border-style: dashed; }
    .quota__head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
    .quota__num { font-size: 18px; font-weight: 600; }
    .bar { height: 6px; border-radius: 3px; background: var(--lx-fill); margin: 10px 0 6px; overflow: hidden; }
    .bar i { display: block; height: 100%; background: var(--lx-accent); }
    .small { font-size: 12px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
    .card { border: 1px solid var(--lx-line); border-radius: 10px; padding: 16px; }
    .card--bad .cnum { color: var(--lx-danger); }
    .cnum { font-size: 26px; font-weight: 300; }
    .clab { font-size: 12.5px; color: var(--lx-slate); margin-top: 4px; }
    .sect { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--lx-slate); margin: 8px 0 0; }
    .otable { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    .otable th { text-align: left; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--lx-slate); padding: 8px 10px; border-bottom: 1px solid var(--lx-line); }
    .otable td { padding: 10px; border-bottom: 1px solid var(--lx-line); vertical-align: top; }
    .atext { max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .keyform { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .keyform select, .keyform .input { padding: 8px 10px; border: 1px solid var(--lx-line); border-radius: 8px; background: var(--lx-card); color: var(--lx-ink); font-size: 13.5px; }
    .keyform .input { flex: 1; min-width: 240px; }
    .spark { display: flex; align-items: flex-end; gap: 4px; height: 120px; }
    .spark__col { display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 4px; flex: 1; height: 100%; }
    .spark__col i { display: block; width: 100%; background: var(--lx-accent); border-radius: 3px 3px 0 0; min-height: 2px; }
    .spark__col span { font-size: 10px; color: var(--lx-muted); }
  `,
})
export class OrgScreen implements OnInit {
  private readonly api = inject(ApiService);
  private readonly state = inject(ProjectStateService);
  private readonly toast = inject(ToastService);

  protected readonly tabs = [
    { id: 'overview' as const, label: 'Usage' },
    { id: 'keys' as const, label: 'AI keys' },
    { id: 'activity' as const, label: 'Activity' },
    { id: 'members' as const, label: 'Members' },
  ];

  protected readonly tab = signal<Tab>('overview');
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

  private readonly busiestDay = computed(() =>
    Math.max(1, ...(this.usage()?.byDay ?? []).map((d) => d.requests)),
  );

  ngOnInit(): void {
    this.api.org().subscribe((o) => this.org.set(o));
    this.api.usage(30).subscribe((u) => this.usage.set(u));
    this.api.agentActivity(50).subscribe((a) => this.activity.set(a));
    this.api.orgMembers().subscribe((m) => this.members.set(m));
    this.loadKeys();
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
