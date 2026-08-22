import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { Toast } from './toast';
import { ProjectStateService } from '../core/project-state.service';

@Component({
  selector: 'lx-shell-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Sidebar, Topbar, Toast],
  template: `
    <div class="app">
      <lx-sidebar />
      <div class="main" style="position:relative">
        <lx-topbar />
        <router-outlet />
      </div>
      <lx-toast />
    </div>
  `,
})
export class ShellLayout implements OnInit {
  private readonly state = inject(ProjectStateService);

  ngOnInit(): void {
    if (!this.state.loaded()) this.state.load();
  }
}
