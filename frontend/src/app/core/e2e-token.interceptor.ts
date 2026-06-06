import { HttpInterceptorFn } from '@angular/common/http';
import { AuthService } from './auth.service';

/**
 * E2E-only: attach the injected bearer token to /api requests. No-op in normal
 * runs (the OIDC authInterceptor handles tokens then). Lets Playwright auth via
 * a password-grant token instead of driving the full OIDC redirect flow.
 */
export const e2eTokenInterceptor: HttpInterceptorFn = (req, next) => {
  let token: string | null = null;
  try {
    token = localStorage.getItem(AuthService.E2E_TOKEN_KEY);
  } catch {
    token = null;
  }
  if (token && req.url.startsWith('/api')) {
    return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  }
  return next(req);
};
