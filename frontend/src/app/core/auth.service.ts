import { Injectable, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { OidcSecurityService } from 'angular-auth-oidc-client';

export interface AuthUser {
  name: string;
  email: string | null;
  username: string;
  roles: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly oidc = inject(OidcSecurityService);

  readonly authenticated = signal(false);
  readonly user = signal<AuthUser | null>(null);
  readonly ready = signal(false);
  readonly ready$ = toObservable(this.ready);

  readonly roles = computed(() => this.user()?.roles ?? []);

  private started = false;

  constructor() {
    // Eagerly process any auth callback the first time the service is injected
    // (the route guard injects it before the App component initializes).
    this.init();
  }

  /** E2E-only: a pre-fetched bearer token injected by the test harness. */
  static readonly E2E_TOKEN_KEY = 'tl.e2e.token';
  readonly e2eToken = (() => {
    try {
      return localStorage.getItem(AuthService.E2E_TOKEN_KEY);
    } catch {
      return null;
    }
  })();

  /** Run once at app start: process any auth callback, hydrate the user. */
  init(): void {
    if (this.started) return;
    this.started = true;

    // E2E bypass: skip the OIDC redirect dance, hydrate from the injected token.
    if (this.e2eToken) {
      const claims = this.decode(this.e2eToken);
      const roles: string[] = (claims?.realm_access?.roles ?? []).filter((r: string) =>
        ['owner', 'admin', 'translator', 'proofreader'].includes(r),
      );
      const name =
        [claims?.given_name, claims?.family_name].filter(Boolean).join(' ').trim() ||
        claims?.preferred_username ||
        'E2E User';
      this.authenticated.set(true);
      this.user.set({
        name,
        email: claims?.email ?? null,
        username: claims?.preferred_username ?? '',
        roles,
      });
      this.ready.set(true);
      return;
    }

    this.oidc.checkAuth().subscribe({
      next: ({ isAuthenticated, userData, accessToken }) => this.hydrate(isAuthenticated, userData, accessToken),
      error: () => {
        // A stale/invalid stored token can make checkAuth error — treat as logged out.
        this.authenticated.set(false);
        this.user.set(null);
        this.ready.set(true);
      },
    });
  }

  private hydrate(isAuthenticated: boolean, userData: any, accessToken: string | undefined): void {
    this.authenticated.set(isAuthenticated);
    if (isAuthenticated) {
        // Roles live in realm_access of the ACCESS token, not the userinfo payload.
        const claims = this.decode(accessToken);
        const roles: string[] = claims?.realm_access?.roles ?? userData?.realm_access?.roles ?? [];
        const given = userData?.given_name ?? claims?.given_name ?? '';
        const family = userData?.family_name ?? claims?.family_name ?? '';
        const name =
          `${given} ${family}`.trim() ||
          userData?.name ||
          claims?.name ||
          userData?.preferred_username ||
          claims?.preferred_username ||
          'User';
        this.user.set({
          name,
          email: userData?.email ?? claims?.email ?? null,
          username: userData?.preferred_username ?? claims?.preferred_username ?? '',
          roles: roles.filter((r) => ['owner', 'admin', 'translator', 'proofreader'].includes(r)),
        });
    }
    this.ready.set(true);
  }

  private decode(token: string | undefined): any | null {
    if (!token) return null;
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      return null;
    }
  }

  login(): void {
    this.oidc.authorize();
  }

  logout(): void {
    this.oidc.logoff().subscribe();
  }

  hasRole(...roles: string[]): boolean {
    const mine = this.roles();
    return roles.some((r) => mine.includes(r));
  }
}
