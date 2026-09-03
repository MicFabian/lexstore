import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Icon } from '../../shared/icon';
import { Avatar, Btn, SearchBox } from '../../shared/primitives';
import { PageHeader } from '../../shared/page-header';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { PromptDialog } from '../../shared/prompt-dialog';
import { ApiService } from '../../core/api.service';
import { ProjectStateService } from '../../core/project-state.service';
import { ToastService } from '../../core/toast.service';
import { ContributorView } from '../../core/models';

@Component({
  selector: 'lx-contributors-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Avatar, Btn, SearchBox, PageHeader, ConfirmDialog, PromptDialog],
  template: `
    <div class="well">
      <div class="pad">
        <lx-page-header
          eyebrow="Team"
          heading="Contributors"
          [sub]="people().length + ' people · scoped by language'"
        >
          <lx-search placeholder="Search people" [value]="query()" [width]="200" (changed)="query.set($event)" />
          <lx-btn variant="primary" icon="UserPlus" (clicked)="inviting.set(true)">Invite contributor</lx-btn>
        </lx-page-header>

        <table class="ttable people" aria-label="Contributors">
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
                    <lx-avatar [i]="c.avatar" [name]="c.name" />
                    <div>
                      <div style="font-size:14px;font-weight:600;white-space:nowrap;color:var(--lx-text-primary)">{{ c.name }}</div>
                      <div class="cmail">{{ c.email }}</div>
                    </div>
                  </div>
                </td>
                <td style="position:relative">
                  <button
                    class="role-btn cap"
                    [style.color]="roleColor(c.role)"
                    [attr.aria-expanded]="roleMenu() === c.id"
                    (click)="roleMenu.set(roleMenu() === c.id ? null : c.id)"
                  >
                    {{ c.role }}
                    <lx-icon name="ChevronDown" [size]="13" color="var(--lx-text-muted)" />
                  </button>
                  @if (roleMenu() === c.id) {
                    <div class="menu-backdrop" (click)="roleMenu.set(null)"></div>
                    <div class="menu" style="top:calc(100% - 4px);left:0;min-width:170px">
                      <div class="menu__label">Role</div>
                      @for (r of roles; track r) {
                        <button class="menu__item" [class.on]="r === c.role" (click)="setRole(c, r)">
                          <span class="cap" [style.color]="roleColor(r)">{{ r }}</span>
                          @if (r === c.role) {
                            <lx-icon name="Check" [size]="14" color="var(--lx-accent-hover)" style="margin-left:auto" />
                          }
                        </button>
                      }
                    </div>
                  }
                </td>
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
                    <span style="color:var(--lx-translated);font-weight:600;font-size:12px">● Online</span>
                  } @else {
                    <span class="cwhen">{{ c.active }}</span>
                  }
                </td>
                <td>
                  <button class="btn btn--subtle btn--sm btn--icon" aria-label="Remove contributor" (click)="pendingRemove.set(c)">
                    <lx-icon name="Trash2" [size]="15" color="var(--lx-text-muted)" />
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (inviting()) {
      <lx-prompt-dialog
        title="Invite a contributor"
        description="They join as a translator; change the role from the table afterwards."
        [fields]="inviteFields"
        submitLabel="Send invite"
        (submitted)="sendInvite($event)"
        (cancelled)="inviting.set(false)"
      />
    }

    @if (pendingRemove(); as c) {
      <lx-confirm-dialog
        title="Remove this contributor?"
        [description]="c.name + ' loses access to this project. Their past translations and history stay.'"
        confirmLabel="Remove contributor"
        (confirmed)="confirmRemove(c)"
        (cancelled)="pendingRemove.set(null)"
      />
    }
  `,
  styles: `
    .role-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 28px;
      padding: 0 6px;
      margin-left: -6px;
      border: none;
      background: none;
      border-radius: var(--lx-radius-2);
      cursor: pointer;
    }
    .role-btn:hover {
      background: var(--lx-surface-hover);
    }
    .people {
      background: transparent;
    }
    .cmail {
      font: 500 12.5px var(--lx-font-mono);
      color: var(--lx-text-secondary);
      margin-top: 2px;
    }
    .cwhen {
      font: 500 12.5px var(--lx-font-mono);
      color: var(--lx-text-secondary);
    }
  `,
})
export class ContributorsScreen implements OnInit {
  private readonly api = inject(ApiService);
  private readonly state = inject(ProjectStateService);
  protected readonly toast = inject(ToastService);

  protected readonly people = signal<ContributorView[]>([]);
  protected readonly query = signal('');
  protected readonly roleMenu = signal<string | null>(null);
  protected readonly roles = ['Owner', 'Admin', 'Proofreader', 'Translator'];
  protected readonly inviting = signal(false);
  protected readonly pendingRemove = signal<ContributorView | null>(null);
  protected readonly inviteFields = [
    { name: 'name', label: 'Name', placeholder: 'Jane Doe' },
    { name: 'email', label: 'Email', placeholder: 'jane@example.com' },
  ];

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
    if (role === 'Owner' || role === 'Admin') return 'var(--lx-accent)';
    if (role === 'Proofreader') return 'var(--lx-reviewed)';
    return 'var(--lx-translated)';
  }

  protected setRole(c: ContributorView, role: string): void {
    this.roleMenu.set(null);
    if (role === c.role) return;
    const pid = this.state.current()?.id;
    if (!pid) return;
    this.api.updateContributor(pid, c.id, { role }).subscribe({
      next: (updated) => {
        this.people.update((list) => list.map((x) => (x.id === c.id ? updated : x)));
        this.toast.show(`${c.name} is now ${role.toLowerCase()}`);
      },
      error: () => this.toast.show({ message: 'Not allowed (needs admin)', tone: 'error' }),
    });
  }

  protected sendInvite(values: Record<string, string>): void {
    const name = values['name'];
    const email = values['email'];
    const pid = this.state.current()?.id;
    if (!pid) return;
    this.inviting.set(false);
    this.api.invite(pid, { name, email, role: 'Translator' }).subscribe({
      next: () => {
        this.api.listContributors(pid).subscribe((c) => this.people.set(c));
        this.toast.show(`Invited ${name}`);
      },
      error: () => this.toast.show({ message: 'Invalid email or duplicate', tone: 'error' }),
    });
  }

  protected confirmRemove(c: ContributorView): void {
    this.pendingRemove.set(null);
    const pid = this.state.current()?.id;
    if (!pid) return;
    this.api.deleteContributor(pid, c.id).subscribe({
      next: () => {
        this.people.update((list) => list.filter((x) => x.id !== c.id));
        this.toast.show(`Removed ${c.name}`);
      },
      error: () => this.toast.show({ message: 'Not allowed (needs admin)', tone: 'error' }),
    });
  }
}
