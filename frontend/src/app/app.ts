import { ChangeDetectionStrategy, Component, OnInit, effect, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { TweaksService } from './core/tweaks.service';
import { AuthService } from './core/auth.service';
import { CommandService } from './core/command.service';
import { CommandPalette } from './shell/command-palette';

@Component({
  selector: 'lx-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, CommandPalette],
  // The palette ships in its own chunk: prefetched once the browser is idle,
  // instantiated on first open, and only the tiny CommandService stays in the
  // initial bundle to catch ⌘K.
  template: `<router-outlet />
    @defer (when cmd.open(); prefetch on idle) {
      <lx-command-palette />
    }`,
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class App implements OnInit {
  // Instantiating the tweaks service applies the theme/accent/density
  // data-attributes to <html> from app start.
  private readonly tweaks = inject(TweaksService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly cmd = inject(CommandService);

  constructor() {
    // After a login callback (URL carries ?code=&state=), the OIDC library no
    // longer auto-navigates (triggerAuthorizationResultEvent), so clean the URL
    // and send the user to the app once authentication has resolved.
    effect(() => {
      if (this.auth.ready() && this.auth.authenticated()) {
        const url = new URL(window.location.href);
        if (url.searchParams.has('code') || url.searchParams.has('state')) {
          const target = sessionStorage.getItem('tl.redirect') || '/editor';
          sessionStorage.removeItem('tl.redirect');
          this.router.navigateByUrl(target);
        }
      }
    });
  }

  ngOnInit(): void {
    this.auth.init();
  }

  protected onKeydown(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.cmd.toggle();
    }
  }
}
