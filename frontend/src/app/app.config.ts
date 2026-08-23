import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { authInterceptor, provideAuth } from 'angular-auth-oidc-client';

import { routes } from './app.routes';
import { errorInterceptor } from './core/error.interceptor';
import { e2eTokenInterceptor } from './core/e2e-token.interceptor';
import { runtimeConfig } from './core/runtime-config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([e2eTokenInterceptor, errorInterceptor, authInterceptor()])),
    provideAuth({
      config: {
        authority: runtimeConfig().authority,
        redirectUrl: window.location.origin,
        postLogoutRedirectUri: window.location.origin,
        clientId: runtimeConfig().clientId,
        scope: 'openid profile email',
        responseType: 'code',
        silentRenew: true,
        useRefreshToken: true,
        // Don't let the library auto-navigate after checkAuth; the Angular
        // router owns routing (otherwise deep links like /projects get
        // overridden by a redirect to redirectUrl).
        triggerAuthorizationResultEvent: true,
        // Attach the bearer token only to backend API calls.
        secureRoutes: ['/api'],
      },
    }),
  ],
};
