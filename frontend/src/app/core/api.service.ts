import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ApiKeyCreated,
  ApiKeyView,
  CommentView,
  ContributorView,
  EditorResponse,
  EditorRow,
  LanguageView,
  ProjectDetail,
  ProjectSummary,
  TermView,
  TranslationHistoryEntry,
  TranslationStatus,
} from './models';

const BASE = '/api';

interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  // ---- Projects ----
  listProjects(): Observable<ProjectSummary[]> {
    return this.http.get<ProjectSummary[]>(`${BASE}/projects`);
  }
  getProject(id: string): Observable<ProjectDetail> {
    return this.http.get<ProjectDetail>(`${BASE}/projects/${id}`);
  }
  createProject(body: { name: string; code: string; mark?: string }): Observable<ProjectDetail> {
    return this.http.post<ProjectDetail>(`${BASE}/projects`, body);
  }

  // ---- Languages ----
  listLanguages(projectId: string): Observable<LanguageView[]> {
    return this.http.get<LanguageView[]>(`${BASE}/projects/${projectId}/languages`);
  }
  addLanguage(projectId: string, body: { code: string; name: string }): Observable<LanguageView> {
    return this.http.post<LanguageView>(`${BASE}/projects/${projectId}/languages`, body);
  }

  // ---- Translations (the editor view is the translations collection of a language) ----
  editor(projectId: string, lang: string): Observable<EditorResponse> {
    return this.http.get<EditorResponse>(
      `${BASE}/projects/${projectId}/languages/${lang}/translations`,
    );
  }
  saveTranslation(
    projectId: string,
    termId: string,
    lang: string,
    body: { value: string | null; pluralOne?: string | null; status: TranslationStatus },
  ): Observable<EditorRow> {
    // Idempotent upsert of the (term, language) translation.
    return this.http.put<EditorRow>(
      `${BASE}/projects/${projectId}/languages/${lang}/translations/${termId}`,
      body,
    );
  }

  // ---- Terms (paginated) ----
  listTerms(projectId: string, page = 0, size = 100): Observable<TermView[]> {
    return this.http
      .get<PagedResponse<TermView>>(`${BASE}/projects/${projectId}/terms`, {
        params: { page, size },
      })
      .pipe(map((p) => p.content));
  }
  createTerm(
    projectId: string,
    body: { key: string; source: string; ctx?: string; tags?: string[] },
  ): Observable<TermView> {
    return this.http.post<TermView>(`${BASE}/projects/${projectId}/terms`, body);
  }
  addComment(
    projectId: string,
    termId: string,
    body: { text: string; authorName?: string; authorAvatar?: number },
  ): Observable<CommentView> {
    return this.http.post<CommentView>(
      `${BASE}/projects/${projectId}/terms/${termId}/comments`,
      body,
    );
  }

  termHistory(projectId: string, termId: string): Observable<TranslationHistoryEntry[]> {
    return this.http.get<TranslationHistoryEntry[]>(
      `${BASE}/projects/${projectId}/terms/${termId}/history`,
    );
  }

  // ---- Contributors ----
  listContributors(projectId: string): Observable<ContributorView[]> {
    return this.http.get<ContributorView[]>(`${BASE}/projects/${projectId}/contributors`);
  }
  invite(
    projectId: string,
    body: { name: string; email: string; role?: string; langs?: string[] },
  ): Observable<ContributorView> {
    return this.http.post<ContributorView>(`${BASE}/projects/${projectId}/contributors`, body);
  }

  // ---- API keys ----
  listApiKeys(projectId: string): Observable<ApiKeyView[]> {
    return this.http.get<ApiKeyView[]>(`${BASE}/projects/${projectId}/api-keys`);
  }
  generateApiKey(
    projectId: string,
    body: { label: string; scope?: string; test?: boolean },
  ): Observable<ApiKeyCreated> {
    return this.http.post<ApiKeyCreated>(`${BASE}/projects/${projectId}/api-keys`, body);
  }
}
