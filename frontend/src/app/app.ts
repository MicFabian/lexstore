import { ChangeDetectionStrategy, Component, OnInit, inject, viewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TweaksService } from './core/tweaks.service';
import { AuthService } from './core/auth.service';
import { CommandPalette } from './shell/command-palette';

@Component({
  selector: 'tl-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, CommandPalette],
  template: `<router-outlet /><tl-command-palette />`,
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class App implements OnInit {
  // Instantiating the tweaks service applies the theme/accent/density
  // data-attributes to <html> from app start.
  private readonly tweaks = inject(TweaksService);
  private readonly auth = inject(AuthService);
  private readonly palette = viewChild.required(CommandPalette);

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
