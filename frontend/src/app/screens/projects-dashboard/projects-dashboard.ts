import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Icon } from '../../shared/icon';
import { Btn, SearchBox } from '../../shared/primitives';
import { ApiService } from '../../core/api.service';
import { ProjectStateService } from '../../core/project-state.service';
import { ToastService } from '../../core/toast.service';
import { ProjectSummary } from '../../core/models';

@Component({
  selector: 'tl-projects-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Btn, SearchBox],
  template: `
    <div class="well">
      <div class="pad">
        <div class="phead">
          <div>
            <div class="eyebrow">Workspace</div>
            <h1 class="serif">Projects</h1>
            <div class="psub">
              {{ projects().length }} projects · {{ totalTerms().toLocaleString() }} terms total
            </div>
          </div>
          <div style="display:flex;gap:10px;align-items:center">
            <tl-search placeholder="Search projects" [value]="query()" [width]="200" (changed)="query.set($event)" />
            <tl-btn variant="primary" icon="Plus" (clicked)="newProject()">New project</tl-btn>
          </div>
        </div>

        <div class="statstrip">
          <div class="statcell">
            <div class="eyebrow">Active projects</div>
            <div class="serif statnum">{{ projects().length }}</div>
          </div>
          <div class="statcell">
            <div class="eyebrow">Untranslated</div>
            <div class="serif statnum" style="color:var(--tl-st-untranslated)">{{ totalUntranslated().toLocaleString() }}</div>
          </div>
          <div class="statcell">
            <div class="eyebrow">New this week</div>
            <div class="serif statnum" style="color:var(--tl-accent-text)">{{ totalNew() }}</div>
          </div>
        </div>

        <div class="eyebrow" style="margin-bottom:6px">All projects</div>
        <div>
          @for (p of filtered(); track p.id) {
            <button class="lrow proj-row" (click)="open(p)">
              <span class="pmark" [style.background]="p.image ? 'none' : p.mark">
                @if (p.image; as img) {
                  <img class="pimg" [src]="img" alt="" />
                } @else {
                  <tl-icon name="ArrowRightLeft" [size]="17" color="#fff" />
                }
              </span>
              <span class="pid">
                <span class="pname">{{ p.name }}</span>
                <span class="pcode">{{ p.code }}</span>
              </span>
              <span class="pprog">
                <span class="pprog-head">
                  <span class="serif" style="font-size:17px">{{ p.progress }}%</span>
                  <span class="pmeta">{{ p.terms.toLocaleString() }} terms · {{ p.langs }} langs</span>
                </span>
                <span class="progress" style="height:5px"><i class="seg-translated" [style.width.%]="p.progress"></i></span>
              </span>
              <span class="ptag">
                @if (p.untranslated > 0) {
                  <span class="cap" style="color:var(--tl-st-untranslated)">{{ p.untranslated }} untranslated</span>
                } @else {
                  <span class="cap" style="color:var(--tl-st-translated)">Complete</span>
                }
                <span class="pupd">{{ p.updated }}</span>
              </span>
              <tl-icon name="ArrowUpRight" [size]="17" color="var(--tl-muted)" />
            </button>
          }
          @if (filtered().length === 0) {
            <div style="padding:48px 0;color:var(--tl-slate);font-size:13.5px">No projects match your search.</div>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .statstrip {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      border: 1px solid var(--tl-line);
      border-radius: var(--tl-r-xl);
      background: var(--tl-card);
      overflow: hidden;
      margin-bottom: 34px;
    }
    .statcell {
      padding: 22px 24px;
    }
    .statcell + .statcell {
      border-left: 1px solid var(--tl-line);
    }
    .statnum {
      font-size: 40px;
      margin-top: 8px;
    }
    .proj-row {
      width: 100%;
      border-left: none;
      border-right: none;
      border-top: none;
      background: none;
      text-align: left;
      cursor: pointer;
    }
    .pmark {
      width: 36px;
      height: 36px;
      border-radius: 9px;
      display: grid;
      place-items: center;
      flex: none;
    }
    .pimg {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: inherit;
      display: block;
    }
    .pid {
      width: 240px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .pname {
      font-size: 15px;
      font-weight: 700;
      color: var(--tl-ink);
    }
    .pcode {
      font: 500 12px var(--tl-mono);
      color: var(--tl-muted);
    }
    .pprog {
      flex: 1;
      max-width: 340px;
      display: flex;
      flex-direction: column;
    }
    .pprog-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 8px;
      gap: 16px;
    }
    .pmeta {
      font: 500 11.5px var(--tl-mono);
      color: var(--tl-muted);
      white-space: nowrap;
    }
    .ptag {
      width: 150px;
      margin-left: auto;
      text-align: right;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .pupd {
      font: 500 11px var(--tl-mono);
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

  protected newProject(): void {
    const name = window.prompt('Project name');
    if (!name) return;
    const suggested = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const code = window.prompt('Project slug (lowercase, hyphens)', suggested);
    if (!code) return;
    this.api.createProject({ name, code }).subscribe({
      next: (p) => {
        this.state.load();
        this.toast.show(`Created ${p.name}`);
      },
      error: () => this.toast.show('That slug already exists or is invalid'),
    });
  }
}
