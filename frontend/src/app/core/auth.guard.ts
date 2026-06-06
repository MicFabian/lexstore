import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { filter, map, take } from 'rxjs/operators';
import { AuthService } from './auth.service';

/**
 * Block a route until the single app-level checkAuth has resolved, then allow
 * when authenticated or kick off login. Avoids a second checkAuth (which would
 * try to redeem the one-time auth code twice and 400).
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.ready$.pipe(
    filter((r) => r),
    take(1),
    map(() => {
      if (!auth.authenticated()) {
        auth.login();
        return false;
      }
      return true;
    }),
  );
};
