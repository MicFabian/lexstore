import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from './toast.service';

/** Requests whose failure the screen already reports itself. */
const HANDLED_LOCALLY = [/\/translations\/[^/]+$/, /\/glossary$/, /\/org\/credentials/];

/**
 * Surfaces a failed request instead of letting it disappear.
 *
 * Most calls subscribe with a next-handler only, so without this a failed load
 * leaves the screen looking merely empty — indistinguishable from having no
 * data. Callers that show their own message are left alone, and the error is
 * still rethrown so they can.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const silent =
        err.status === 401 ||
        err.status === 0 ||
        HANDLED_LOCALLY.some((p) => p.test(req.url));
      if (!silent) {
        toast.show({
          message: messageFor(err),
          tone: 'error',
        });
      }
      return throwError(() => err);
    }),
  );
};

function messageFor(err: HttpErrorResponse): string {
  const detail = err.error?.detail as string | undefined;
  if (detail) return detail;
  if (err.status === 403) return 'You do not have access to that.';
  if (err.status === 404) return 'That is no longer there.';
  if (err.status >= 500) return 'Something went wrong on the server.';
  return 'That request could not be completed.';
}
