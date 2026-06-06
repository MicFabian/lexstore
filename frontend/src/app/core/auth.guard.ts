import { inject } from '@angular/core';
import { CanActivateFn, RouterStateSnapshot } from '@angular/router';
import { filter, map, take } from 'rxjs/operators';
import { AuthService } from './auth.service';

/**
 * Block a route until the single app-level checkAuth has resolved, then allow
 * when authenticated or kick off login (remembering the target so the App can
 * restore it after the callback). Avoids a second checkAuth.
 */
export const authGuard: CanActivateFn = (_route, state: RouterStateSnapshot) => {
  const auth = inject(AuthService);
  return auth.ready$.pipe(
    filter((r) => r),
    take(1),
    map(() => {
      if (!auth.authenticated()) {
        if (state.url && state.url !== '/') sessionStorage.setItem('tl.redirect', state.url);
        auth.login();
        return false;
      }
      return true;
    }),
  );
};
