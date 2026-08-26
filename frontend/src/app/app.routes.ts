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
      { path: 'ai', redirectTo: 'organisation' },
      {
        path: 'editor',
        loadComponent: () => import('./screens/editor/editor').then((m) => m.EditorScreen),
      },
      {
        path: 'ai-review',
        loadComponent: () => import('./screens/ai-review/ai-review').then((m) => m.AiReviewScreen),
      },
      {
        path: 'features',
        loadComponent: () => import('./screens/features/features').then((m) => m.FeaturesScreen),
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
        path: 'organisation',
        loadComponent: () => import('./screens/org/org-screen').then((m) => m.OrgScreen),
      },
      {
        path: 'settings',
        loadComponent: () => import('./screens/settings/settings').then((m) => m.SettingsScreen),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
