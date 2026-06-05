import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Icon, IconName } from '../../shared/icon';
import { Avatar, Btn, Progress, SearchBox } from '../../shared/primitives';
import { BrandMark } from '../../shell/brand-mark';
import { Toast } from '../../shell/toast';
import { TweaksPanel } from '../../shell/tweaks-panel';
import { ApiService } from '../../core/api.service';
import { ProjectStateService } from '../../core/project-state.service';
import { ToastService } from '../../core/toast.service';
import { ProjectSummary } from '../../core/models';

@Component({
  selector: 'tl-projects-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Avatar, Btn, Progress, SearchBox, BrandMark, Toast, TweaksPanel],
  template: `
    <div class="dash-root">
      <header class="topbar topbar--grid" style="padding-left:20px">
        <div class="rail__brand" style="padding:0">
          <tl-brand-mark [size]="26" [radius]="7" />
          <span class="word" style="font-weight:800;font-size:16px;letter-spacing:-.02em">Trans<b style="color:var(--tl-accent)">Lad</b></span>
        </div>
        <div class="spacer"></div>
        <button class="cmdk" type="button" (click)="toast.show('Command palette')">
          <tl-icon name="Search" [size]="14" color="var(--tl-muted)" />
          <span>Search</span>
          <span class="cmdk__keys"><span class="kbd">⌘</span><span class="kbd">K</span></span>
        </button>
        <button class="btn btn--icon btn--subtle" type="button" aria-label="Notifications">
          <tl-icon name="Bell" [size]="17" color="var(--tl-slate)" />
        </button>
        <tl-avatar [i]="0" name="You There" [sm]="true" />
      </header>

      <div class="content">
        <div class="content__pad">
          <div class="row" style="margin-bottom:22px">
            <div>
              <h1 class="tl-display-3" style="font-size:28px">Projects</h1>
              <p class="muted" style="font-size:13.5px;margin:5px 0 0">
                {{ projects().length }} projects · {{ totalTerms().toLocaleString() }} terms total
              </p>
            </div>
            <div class="spacer"></div>
            <tl-search placeholder="Search projects" [value]="query()" [width]="220" (changed)="query.set($event)" />
            <tl-btn variant="primary" icon="Plus" (clicked)="toast.show('New project')">New project</tl-btn>
          </div>

          <div class="stat-grid">
            <div class="card stat-card">
              <span class="stat-ico"><tl-icon name="FolderGit2" [size]="18" color="var(--tl-slate)" /></span>
              <div>
                <div class="stat-num">{{ projects().length }}</div>
                <div class="muted stat-label">Active projects</div>
              </div>
            </div>
            <div class="card stat-card">
              <span class="stat-ico"><tl-icon name="Circle" [size]="18" color="var(--tl-st-untranslated)" /></span>
              <div>
                <div class="stat-num" style="color:var(--tl-st-untranslated)">{{ totalUntranslated().toLocaleString() }}</div>
                <div class="muted stat-label">Untranslated terms</div>
              </div>
            </div>
            <div class="card stat-card">
              <span class="stat-ico"><tl-icon name="Sparkles" [size]="18" color="var(--tl-st-new)" /></span>
              <div>
                <div class="stat-num" style="color:var(--tl-st-new)">{{ totalNew() }}</div>
                <div class="muted stat-label">New this week</div>
              </div>
            </div>
          </div>

          <div class="proj-grid">
            @for (p of filtered(); track p.id) {
              <button class="card proj-card" (click)="open(p)">
                <div class="row" style="margin-bottom:14px">
                  <span class="pmark" [style.background]="p.mark"><tl-icon name="ArrowRightLeft" [size]="16" color="#fff" /></span>
                  <div style="min-width:0;flex:1">
                    <div class="proj-name">{{ p.name }}</div>
                    <div class="proj-code">{{ p.code }}</div>
                  </div>
                  <div class="spacer"></div>
                  <tl-icon name="ArrowUpRight" [size]="17" color="var(--tl-muted)" />
                </div>
                <div class="row" style="align-items:baseline;margin-bottom:7px">
                  <span class="tnum" style="font-size:15px;font-weight:700">{{ p.progress }}%</span>
                  <span class="muted" style="font-size:12px">translated</span>
                  <div class="spacer"></div>
                  <span class="muted tnum" style="font-size:12px">{{ p.terms.toLocaleString() }} terms · {{ p.langs }} langs</span>
                </div>
                <tl-progress [translated]="p.progress" [fuzzy]="0" />
                <div class="row" style="margin-top:13px;gap:7px">
                  @if (p.untranslated > 0) {
                    <span class="chip chip--untranslated">{{ p.untranslated }} untranslated</span>
                  } @else {
                    <span class="chip chip--translated">Complete</span>
                  }
                  @if (p.newTerms > 0) {
                    <span class="chip chip--new">{{ p.newTerms }} new</span>
                  }
                  <div class="spacer"></div>
                  <span class="muted" style="font-size:11.5px">{{ p.updated }}</span>
                </div>
              </button>
            }
          </div>
        </div>
      </div>

      <tl-toast />
      <tl-tweaks-panel />
    </div>
  `,
  styles: `
    .dash-root {
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--tl-paper);
    }
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 22px;
    }
    .stat-card {
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 13px;
    }
    .stat-ico {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: var(--tl-fill);
      display: grid;
      place-items: center;
      flex: none;
    }
    .stat-num {
      font-family: var(--tl-mono);
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.1;
    }
    .stat-label {
      font-size: 12px;
      white-space: nowrap;
    }
    .proj-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 14px;
    }
    .proj-card {
      padding: 16px;
      text-align: left;
      cursor: pointer;
      display: block;
      width: 100%;
      transition: border-color 0.14s, box-shadow 0.14s;
    }
    .proj-card:hover {
      border-color: var(--tl-accent);
      box-shadow: var(--tl-shadow-md);
    }
    .pmark {
      width: 32px;
      height: 32px;
      border-radius: 9px;
      display: grid;
      place-items: center;
      flex: none;
    }
    .proj-name {
      font-weight: 700;
      font-size: 15px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .proj-code {
      font-family: var(--tl-mono);
      font-size: 11.5px;
      color: var(--tl-muted);
    }
  `,
})
export class ProjectsDashboard implements OnInit {
  private readonly api = inject(ApiService);
  private readonly state = inject(ProjectStateService);
  private readonly router = inject(Router);
  protected readonly toast = inject(ToastService);

  protected readonly projects = this.state.projects;
  protected readonly query = signal('');

  protected readonly totalTerms = computed(() =>
    this.projects().reduce((a, p) => a + p.terms, 0),
  );
  protected readonly totalUntranslated = computed(() =>
    this.projects().reduce((a, p) => a + p.untranslated, 0),
  );
  protected readonly totalNew = computed(() =>
    this.projects().reduce((a, p) => a + p.newTerms, 0),
  );

  protected readonly filtered = computed(() => {
    const q = this.query().toLowerCase();
    if (!q) return this.projects();
    return this.projects().filter((p) => p.name.toLowerCase().includes(q) || p.code.includes(q));
  });

  ngOnInit(): void {
    if (!this.state.loaded()) this.state.load();
  }

  protected open(p: ProjectSummary): void {
    this.state.select(p.id);
    this.toast.show('Switched to ' + p.name);
    this.router.navigate(['/', 'editor']);
  }
}
