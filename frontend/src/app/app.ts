import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TweaksService } from './core/tweaks.service';

@Component({
  selector: 'tl-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class App {
  // Instantiating the tweaks service applies the theme/accent/density
  // data-attributes to <html> from app start.
  private readonly tweaks = inject(TweaksService);
}
