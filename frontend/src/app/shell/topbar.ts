import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Icon } from '../shared/icon';
import { ApiService } from '../core/api.service';
import { Btn } from '../shared/primitives';
import { ToastService } from '../core/toast.service';
import { ProjectStateService } from '../core/project-state.service';
import { CommandService } from '../core/command.service';

@Component({
  selector: 'lx-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Btn],
  template: `
    <header class="topbar">
      <div class="spacer"></div>

      <button class="cmdk" type="button" (click)="cmd.show()">
        <lx-icon name="Search" [size]="14" color="var(--lx-text-muted)" />
        <span>Search</span>
        <span class="cmdk__keys"><span class="kbd">⌘</span><span class="kbd">K</span></span>
      </button>

      <div style="position:relative">
        <lx-btn variant="primary" [sm]="true" icon="UserPlus" (clicked)="openInvite()">Invite</lx-btn>
        @if (inviteOpen()) {
          <div class="menu-backdrop" (click)="inviteOpen.set(false)"></div>
          <div class="menu invite" role="dialog" aria-label="Invite a contributor">
            <div class="menu__label">Invite to {{ project()?.name }}</div>
            <div class="field">
              <label for="invite-name">Name</label>
              <input id="invite-name" class="input" [value]="name()" (input)="name.set($any($event.target).value)" placeholder="Jane Doe" />
            </div>
            <div class="field">
              <label for="invite-email">Email</label>
              <input
                id="invite-email"
                class="input"
                type="email"
                [value]="email()"
                (input)="email.set($any($event.target).value)"
                (keydown.enter)="sendInvite()"
                placeholder="jane@example.com"
              />
            </div>
            <div class="field">
              <label for="invite-role">Role</label>
              <div class="row" style="gap:6px;flex-wrap:wrap">
                @for (r of roles; track r) {
                  <button
                    [class]="'btn btn--sm ' + (role() === r ? 'btn--ghost' : 'btn--subtle')"
                    [style.border-color]="role() === r ? 'var(--lx-accent)' : null"
                    (click)="role.set(r)"
                  >{{ r }}</button>
                }
              </div>
            </div>
            <div class="row" style="gap:8px;margin-top:4px">
              <lx-btn variant="primary" [sm]="true" [disabled]="!name() || !email() || busy()" (clicked)="sendInvite()">
                {{ busy() ? 'Inviting…' : 'Send invite' }}
              </lx-btn>
              <lx-btn variant="subtle" [sm]="true" (clicked)="inviteOpen.set(false)">Cancel</lx-btn>
            </div>
          </div>
        }
      </div>
    </header>
  `,
  styles: `
    .invite {
      top: calc(100% + 6px);
      right: 0;
      width: 280px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
  `,
})
export class Topbar {
  private readonly api = inject(ApiService);
  protected readonly toast = inject(ToastService);
  protected readonly inviteOpen = signal(false);
  protected readonly busy = signal(false);
  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly role = signal('Translator');
  protected readonly roles = ['Translator', 'Proofreader', 'Admin'];
  protected readonly cmd = inject(CommandService);
  protected readonly project = inject(ProjectStateService).current;

  protected openInvite(): void {
    this.name.set('');
    this.email.set('');
    this.role.set('Translator');
    this.inviteOpen.set(true);
  }

  protected sendInvite(): void {
    const pid = this.project()?.id;
    if (!pid || !this.name() || !this.email()) return;
    this.busy.set(true);
    this.api.invite(pid, { name: this.name(), email: this.email(), role: this.role() }).subscribe({
      next: (c) => {
        this.busy.set(false);
        this.inviteOpen.set(false);
        this.toast.show(`Invited ${c.name} as ${c.role.toLowerCase()}`);
      },
      error: () => {
        this.busy.set(false);
        this.toast.show({ message: 'Invalid email, or that person is already a contributor', tone: 'error' });
      },
    });
  }
}
