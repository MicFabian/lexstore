import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { Toast } from './toast';
import { TweaksPanel } from './tweaks-panel';
import { ProjectStateService } from '../core/project-state.service';

@Component({
  selector: 'tl-shell-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Sidebar, Topbar, Toast, TweaksPanel],
  template: `
    <div class="app">
      <tl-sidebar />
      <div class="main" style="position:relative">
        <tl-topbar />
        <router-outlet />
      </div>
      <tl-toast />
      <tl-tweaks-panel />
    </div>
  `,
})
export class ShellLayout implements OnInit {
  private readonly state = inject(ProjectStateService);

  ngOnInit(): void {
    if (!this.state.loaded()) this.state.load();
  }
}
