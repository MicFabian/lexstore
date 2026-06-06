import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TweaksService } from './core/tweaks.service';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'tl-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class App implements OnInit {
  // Instantiating the tweaks service applies the theme/accent/density
  // data-attributes to <html> from app start.
  private readonly tweaks = inject(TweaksService);
  private readonly auth = inject(AuthService);

  ngOnInit(): void {
    this.auth.init();
  }
}
