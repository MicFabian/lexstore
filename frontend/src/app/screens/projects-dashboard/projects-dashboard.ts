import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Icon } from '../../shared/icon';
import { Btn, SearchBox } from '../../shared/primitives';
import { PromptDialog } from '../../shared/prompt-dialog';
import { ApiService } from '../../core/api.service';
import { ProjectStateService } from '../../core/project-state.service';
import { ToastService } from '../../core/toast.service';
import { ProjectSummary } from '../../core/models';

@Component({
  selector: 'lx-projects-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Btn, SearchBox, PromptDialog],
  template: `
    <div class="well">
      <div class="pad">
        <div class="phead">
          <div>
            <div class="eyebrow">Workspace</div>
            <h1 class="display">Projects</h1>
            <div class="psub">
              {{ projects().length }} projects · {{ totalTerms().toLocaleString() }} terms total
            </div>
          </div>
          <div style="display:flex;gap:10px;align-items:center">
            <lx-search placeholder="Search projects" [value]="query()" [width]="200" (changed)="query.set($event)" />
            <lx-btn variant="primary" icon="Plus" (clicked)="creating.set(true)">New project</lx-btn>
          </div>
        </div>

        <div class="statstrip">
          <div class="statcell">
            <div class="eyebrow">Active projects</div>
            <div class="display statnum">{{ projects().length }}</div>
          </div>
          <div class="statcell">
            <div class="eyebrow">Untranslated</div>
            <div class="display statnum" style="color:var(--lx-untranslated)">{{ totalUntranslated().toLocaleString() }}</div>
          </div>
          <div class="statcell">
            <div class="eyebrow">New this week</div>
            <div class="display statnum" style="color:var(--lx-accent)">{{ totalNew() }}</div>
          </div>
        </div>

        @if (needsWork().length > 0) {
          <div class="eyebrow" style="margin-bottom:6px">Pick up where the work is</div>
          <div class="worklist">
            @for (p of needsWork(); track p.id) {
              <button class="lrow work-row" (click)="continueWork(p)">
                <span class="pmark" [style.background]="p.imageUrl ? 'none' : p.mark">
                  @if (p.imageUrl; as img) {
                    <img class="pimg" [src]="img" alt="" />
                  } @else {
                    <lx-icon name="ArrowRightLeft" [size]="15" color="#fff" />
                  }
                </span>
                <span class="work-name">{{ p.name }}</span>
                <span class="work-open">
                  <span class="cap" style="color:var(--lx-untranslated)">{{ p.untranslated }} untranslated</span>
                  @if (p.needsReview > 0) {
                    <span class="cap" style="color:var(--lx-unsure)">{{ p.needsReview }} need review</span>
                  }
                </span>
                <span class="work-go">Continue<lx-icon name="ArrowRight" [size]="15" /></span>
              </button>
            }
          </div>
        }

        <div class="eyebrow" style="margin-bottom:6px">All projects</div>
        <div>
          @for (p of filtered(); track p.id) {
            <button class="lrow proj-row" (click)="open(p)">
              <span class="pmark" [style.background]="p.imageUrl ? 'none' : p.mark">
                @if (p.imageUrl; as img) {
                  <img class="pimg" [src]="img" alt="" />
                } @else {
                  <lx-icon name="ArrowRightLeft" [size]="17" color="#fff" />
                }
              </span>
              <span class="pid">
                <span class="pname">{{ p.name }}</span>
                <span class="pcode">{{ p.code }}</span>
              </span>
              <span class="pprog">
                <span class="pprog-head">
                  <span class="display" style="font-size:17px">{{ p.progress }}%</span>
                  <span class="pmeta">{{ p.terms.toLocaleString() }} terms · {{ p.langs }} langs</span>
                </span>
                <span class="progress" style="height:5px"><i class="seg-translated" [style.width.%]="p.progress"></i></span>
              </span>
              <span class="ptag">
                @if (p.terms === 0) {
                  <span class="cap" style="color:var(--lx-text-secondary)">No terms yet</span>
                } @else if (p.untranslated > 0) {
                  <span class="cap" style="color:var(--lx-untranslated)">{{ p.untranslated }} untranslated</span>
                } @else {
                  <span class="cap" style="color:var(--lx-translated)">Complete</span>
                }
                <span class="pupd">{{ p.updated }}</span>
              </span>
              <lx-icon name="ArrowUpRight" [size]="17" color="var(--lx-text-muted)" />
            </button>
          }
          @if (filtered().length === 0) {
            <div style="padding:48px 0;color:var(--lx-text-secondary);font-size:13.5px">No projects match your search.</div>
          }
        </div>
      </div>
    </div>

    @if (creating()) {
      <lx-prompt-dialog
        title="New project"
        description="The slug is what the CLI and API use; it cannot be changed later."
        [fields]="newProjectFields"
        submitLabel="Create project"
        (submitted)="createProject($event)"
        (cancelled)="creating.set(false)"
      />
    }
  `,
  styles: `
    .statstrip {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      border: 1px solid var(--lx-line);
      border-radius: var(--lx-radius-3);
      background: var(--lx-bg-card);
      overflow: hidden;
      margin-bottom: 34px;
    }
    .statcell {
      padding: 22px 24px;
    }
    .statcell + .statcell {
      border-left: 1px solid var(--lx-line);
    }
    .statnum {
      font-size: var(--lx-size-34);
      letter-spacing: var(--lx-track-tight);
      font-variant-numeric: var(--lx-numeric-tabular);
      margin-top: 8px;
    }
    .worklist {
      margin-bottom: 34px;
      border-top: 1px solid var(--lx-line);
    }
    .work-row {
      width: 100%;
      border-left: none;
      border-right: none;
      border-top: none;
      background: none;
      text-align: left;
      cursor: pointer;
      padding: 14px 0;
    }
    .work-name {
      font-size: var(--lx-size-13);
      font-weight: var(--lx-weight-medium);
      color: var(--lx-text-primary);
      flex: 1;
    }
    .work-open {
      display: flex;
      gap: 14px;
      align-items: center;
    }
    .work-go {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      width: 110px;
      justify-content: flex-end;
      font-size: var(--lx-size-12);
      font-weight: var(--lx-weight-medium);
      color: var(--lx-accent);
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
      border-radius: var(--lx-radius-3);
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
      font-size: var(--lx-size-13);
      font-weight: var(--lx-weight-medium);
      color: var(--lx-text-primary);
    }
    .pcode {
      font: 500 12.5px var(--lx-font-mono);
      color: var(--lx-text-muted);
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
      font: 500 12.5px var(--lx-font-mono);
      color: var(--lx-text-muted);
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
      font: 500 12px var(--lx-font-mono);
      color: var(--lx-text-secondary);
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
  protected readonly creating = signal(false);
  protected readonly newProjectFields = [
    { name: 'name', label: 'Project name', placeholder: 'Mosaic Web App' },
    { name: 'code', label: 'Slug', placeholder: 'mosaic-web', hint: 'Lowercase letters, numbers, and hyphens.', mono: true },
  ];

  protected readonly totalTerms = computed(() =>
    this.projects().reduce((a, p) => a + p.terms, 0),
  );
  protected readonly totalUntranslated = computed(() =>
    this.projects().reduce((a, p) => a + p.untranslated, 0),
  );
  protected readonly totalNew = computed(() =>
    this.projects().reduce((a, p) => a + p.newTerms, 0),
  );

  /** Projects with open work, worst first — the answer to "what now?". */
  protected readonly needsWork = computed(() =>
    this.projects()
      .filter((p) => p.untranslated > 0 || p.needsReview > 0)
      .sort((a, b) => b.untranslated + b.needsReview - (a.untranslated + a.needsReview))
      .slice(0, 3),
  );

  protected readonly filtered = computed(() => {
    const q = this.query().toLowerCase();
    if (!q) return this.projects();
    return this.projects().filter((p) => p.name.toLowerCase().includes(q) || p.code.includes(q));
  });

  ngOnInit(): void {
    if (!this.state.loaded()) this.state.load();
  }

  /** Opens the project on the work that is actually outstanding. */
  protected continueWork(p: ProjectSummary): void {
    this.state.select(p.id);
    this.router.navigate(['/', 'editor'], {
      queryParams: { filter: p.untranslated > 0 ? 'untranslated' : 'fuzzy' },
    });
  }

  protected open(p: ProjectSummary): void {
    this.state.select(p.id);
    this.toast.show('Switched to ' + p.name);
    this.router.navigate(['/', 'editor']);
  }

  protected createProject(values: Record<string, string>): void {
    const name = values['name'];
    const code = values['code'];
    this.creating.set(false);
    this.api.createProject({ name, code }).subscribe({
      next: (p) => {
        this.state.load();
        this.toast.show(`Created ${p.name}`);
      },
      error: () => this.toast.show({ message: 'That slug already exists or is invalid', tone: 'error' }),
    });
  }
}
