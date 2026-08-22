import { ChangeDetectionStrategy, Component, OnInit, effect, inject, viewChild } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { TweaksService } from './core/tweaks.service';
import { AuthService } from './core/auth.service';
import { CommandPalette } from './shell/command-palette';

@Component({
  selector: 'lx-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, CommandPalette],
  template: `<router-outlet /><lx-command-palette />`,
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
  private readonly palette = viewChild.required(CommandPalette);

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
      this.palette().toggle();
    }
  }
}
