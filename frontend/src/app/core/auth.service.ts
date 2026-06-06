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

  /** Run once at app start: process any auth callback, hydrate the user. */
  init(): void {
    if (this.started) return;
    this.started = true;
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
