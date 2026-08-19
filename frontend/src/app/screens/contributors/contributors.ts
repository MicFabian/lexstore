import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Icon } from '../../shared/icon';
import { Avatar, Btn, SearchBox } from '../../shared/primitives';
import { ApiService } from '../../core/api.service';
import { ProjectStateService } from '../../core/project-state.service';
import { ToastService } from '../../core/toast.service';
import { ContributorView } from '../../core/models';

@Component({
  selector: 'tl-contributors-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Avatar, Btn, SearchBox],
  template: `
    <div class="well">
      <div class="pad">
        <div class="phead">
          <div>
            <div class="eyebrow">Team</div>
            <h1 class="serif">Contributors</h1>
            <div class="psub">{{ people().length }} people · scoped by language</div>
          </div>
          <div style="display:flex;gap:10px;align-items:center">
            <tl-search placeholder="Search people" [value]="query()" [width]="200" (changed)="query.set($event)" />
            <tl-btn variant="primary" icon="UserPlus" (clicked)="invite()">Invite contributor</tl-btn>
          </div>
        </div>

        <table class="ttable people">
          <thead>
            <tr>
              <th>Person</th>
              <th style="width:150px">Role</th>
              <th>Languages</th>
              <th style="width:120px;text-align:right">Active</th>
              <th style="width:44px"></th>
            </tr>
          </thead>
          <tbody>
            @for (c of filtered(); track c.id) {
              <tr class="trow" style="cursor:default">
                <td>
                  <div class="row">
                    <tl-avatar [i]="c.avatar" [name]="c.name" />
                    <div>
                      <div style="font-size:14px;font-weight:600;white-space:nowrap;color:var(--tl-ink)">{{ c.name }}</div>
                      <div class="cmail">{{ c.email }}</div>
                    </div>
                  </div>
                </td>
                <td><span class="cap" [style.color]="roleColor(c.role)">{{ c.role }}</span></td>
                <td>
                  <div class="row" style="gap:4px;flex-wrap:wrap">
                    @for (code of c.langs.slice(0, 4); track code) {
                      <span class="locale">{{ code }}</span>
                    }
                    @if (c.langs.length > 4) {
                      <span class="muted" style="font-size:12px">+{{ c.langs.length - 4 }}</span>
                    }
                  </div>
                </td>
                <td style="text-align:right">
                  @if (c.active === 'Online') {
                    <span style="color:var(--tl-st-translated);font-weight:600;font-size:12px">● Online</span>
                  } @else {
                    <span class="cwhen">{{ c.active }}</span>
                  }
                </td>
                <td>
                  <button class="btn btn--subtle btn--sm btn--icon" aria-label="Remove contributor" (click)="remove(c)">
                    <tl-icon name="Trash2" [size]="15" color="var(--tl-muted)" />
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: `
    .people {
      background: transparent;
    }
    .cmail {
      font: 500 12.5px var(--tl-mono);
      color: var(--tl-slate);
      margin-top: 2px;
    }
    .cwhen {
      font: 500 12.5px var(--tl-mono);
      color: var(--tl-slate);
    }
  `,
})
export class ContributorsScreen implements OnInit {
  private readonly api = inject(ApiService);
  private readonly state = inject(ProjectStateService);
  protected readonly toast = inject(ToastService);

  protected readonly people = signal<ContributorView[]>([]);
  protected readonly query = signal('');

  ngOnInit(): void {
    this.state.whenReady((pid) =>
      this.api.listContributors(pid).subscribe((c) => this.people.set(c)),
    );
  }

  protected readonly filtered = computed(() => {
    const q = this.query().toLowerCase();
    if (!q) return this.people();
    return this.people().filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
    );
  });

  protected roleColor(role: string): string {
    if (role === 'Owner' || role === 'Admin') return 'var(--tl-accent-text)';
    if (role === 'Proofreader') return 'var(--tl-st-proofread)';
    return 'var(--tl-st-translated)';
  }

  protected invite(): void {
    const name = window.prompt('Contributor name');
    if (!name) return;
    const email = window.prompt('Email address');
    if (!email) return;
    const pid = this.state.current()?.id;
    if (!pid) return;
    this.api.invite(pid, { name, email, role: 'Translator' }).subscribe({
      next: () => {
        this.api.listContributors(pid).subscribe((c) => this.people.set(c));
        this.toast.show(`Invited ${name}`);
      },
      error: () => this.toast.show('Invalid email or duplicate'),
    });
  }

  protected remove(c: ContributorView): void {
    if (!window.confirm(`Remove ${c.name} from this project?`)) return;
    const pid = this.state.current()?.id;
    if (!pid) return;
    this.api.deleteContributor(pid, c.id).subscribe({
      next: () => {
        this.people.update((list) => list.filter((x) => x.id !== c.id));
        this.toast.show(`Removed ${c.name}`);
      },
      error: () => this.toast.show('Not allowed (needs admin)'),
    });
  }
}
