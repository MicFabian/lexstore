import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shell/shell-layout').then((m) => m.ShellLayout),
    children: [
      { path: '', redirectTo: 'editor', pathMatch: 'full' },
      {
        path: 'projects',
        loadComponent: () =>
          import('./screens/projects-dashboard/projects-dashboard').then(
            (m) => m.ProjectsDashboard,
          ),
      },
      {
        path: 'ai',
        loadComponent: () => import('./screens/ai/ai-overview').then((m) => m.AiOverview),
      },
      {
        path: 'editor',
        loadComponent: () => import('./screens/editor/editor').then((m) => m.EditorScreen),
      },
      {
        path: 'terms',
        loadComponent: () => import('./screens/terms/terms').then((m) => m.TermsScreen),
      },
      {
        path: 'languages',
        loadComponent: () =>
          import('./screens/languages/languages').then((m) => m.LanguagesScreen),
      },
      {
        path: 'contributors',
        loadComponent: () =>
          import('./screens/contributors/contributors').then((m) => m.ContributorsScreen),
      },
      {
        path: 'settings',
        loadComponent: () => import('./screens/settings/settings').then((m) => m.SettingsScreen),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
