import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { loadRuntimeConfig } from './app/core/runtime-config';

// Deployment settings are read before Angular boots, so the OIDC provider is
// configured with the environment's real authority rather than a compiled one.
loadRuntimeConfig()
  .then(() => bootstrapApplication(App, appConfig))
  .catch((err) => console.error(err));
