import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
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
    <div class="content content__pad">
      <div class="row" style="margin-bottom:20px">
        <div>
          <h1 class="tl-h1">Contributors</h1>
          <p class="muted" style="font-size:13.5px;margin:4px 0 0">
            {{ people().length }} people · scoped per language
          </p>
        </div>
        <div class="spacer"></div>
        <tl-btn variant="primary" icon="UserPlus" (clicked)="toast.show('Invite sent')">Invite contributor</tl-btn>
      </div>

      <div class="panel">
        <div class="panel__head">
          <h2>Team</h2>
          <div class="spacer"></div>
          <tl-search placeholder="Search people" [value]="query()" [width]="220" (changed)="query.set($event)" />
        </div>
        <table class="ttable">
          <thead>
            <tr>
              <th style="padding-left:18px">Person</th>
              <th>Role</th>
              <th>Languages</th>
              <th>Last active</th>
              <th style="width:44px"></th>
            </tr>
          </thead>
          <tbody>
            @for (c of filtered(); track c.id) {
              <tr class="trow" style="cursor:default">
                <td style="padding-left:18px">
                  <div class="row">
                    <tl-avatar [i]="c.avatar" [name]="c.name" />
                    <div>
                      <div style="font-size:13.5px;font-weight:600;white-space:nowrap">{{ c.name }}</div>
                      <div class="muted" style="font-size:12px">{{ c.email }}</div>
                    </div>
                  </div>
                </td>
                <td><span [class]="'chip ' + roleChip(c.role)">{{ c.role }}</span></td>
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
                <td>
                  @if (c.active === 'Online') {
                    <span style="color:var(--tl-st-translated);font-weight:600;font-size:12.5px">● Online</span>
                  } @else {
                    <span class="muted" style="font-size:12.5px">{{ c.active }}</span>
                  }
                </td>
                <td><tl-icon name="MoreHorizontal" [size]="17" color="var(--tl-muted)" /></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
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

  protected filtered(): ContributorView[] {
    const q = this.query().toLowerCase();
    if (!q) return this.people();
    return this.people().filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
    );
  }

  protected roleChip(role: string): string {
    if (role === 'Admin') return 'chip--new';
    if (role === 'Proofreader') return 'chip--proofread';
    return 'chip--neutral';
  }
}
