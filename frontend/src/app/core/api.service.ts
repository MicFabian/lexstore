import { HttpClient, HttpParams } from '@angular/common/http';
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
  TranslateResponse,
  RequestLogView,
  CacheEntryView,
  CacheStats,
  AiSettings,
  PoeditorProject,
  PoeditorLanguage,
  PoeditorImportResult,
  PoeditorPreview,
  AutoTranslateResult,
  OrganisationView,
  OrgMemberView,
  CredentialView,
  UsageSummary,
  AgentActivityRow,
  ProofreadResult,
  GlossaryEntryView,
  FeatureView,
  OpenTranslationView,
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
  updateProject(
    projectId: string,
    body: { name?: string; mark?: string; sourceLang?: string; image?: string; translationContext?: string },
  ): Observable<ProjectDetail> {
    return this.http.patch<ProjectDetail>(`${BASE}/projects/${projectId}`, body);
  }

  // ---- Features (a project's terms grouped by what ships together) ----
  listFeatures(projectId: string): Observable<FeatureView[]> {
    return this.http.get<FeatureView[]>(`${BASE}/projects/${projectId}/features`);
  }
  createFeature(
    projectId: string,
    body: { name: string; key?: string; description?: string },
  ): Observable<FeatureView> {
    return this.http.post<FeatureView>(`${BASE}/projects/${projectId}/features`, body);
  }
  deleteFeature(projectId: string, featureId: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/projects/${projectId}/features/${featureId}`);
  }
  /** Translation slots of one feature that still need work. */
  openTranslations(projectId: string, featureId: string, lang?: string): Observable<OpenTranslationView[]> {
    return this.http.get<OpenTranslationView[]>(
      `${BASE}/projects/${projectId}/features/${featureId}/open`,
      { params: lang ? { lang } : {} },
    );
  }
  assignTerms(projectId: string, featureId: string, termIds: string[]): Observable<FeatureView> {
    return this.http.post<FeatureView>(`${BASE}/projects/${projectId}/features/${featureId}/terms`, { termIds });
  }

  // ---- POEditor import wizard (the token is per request, never stored) ----
  poeditorProjects(apiToken: string): Observable<PoeditorProject[]> {
    return this.http.post<PoeditorProject[]>(`${BASE}/poeditor/projects`, { apiToken });
  }
  poeditorLanguages(apiToken: string, poeditorProjectId: number): Observable<PoeditorLanguage[]> {
    return this.http.post<PoeditorLanguage[]>(`${BASE}/poeditor/languages`, { apiToken, poeditorProjectId });
  }
  poeditorImport(
    projectId: string,
    body: { apiToken: string; poeditorProjectId: number; languages: string[] },
  ): Observable<PoeditorImportResult> {
    return this.http.post<PoeditorImportResult>(`${BASE}/poeditor/projects/${projectId}/import`, body);
  }
  /** What the selected languages would bring in, before importing. */
  poeditorPreview(body: {
    apiToken: string;
    poeditorProjectId: number;
    languages: string[];
  }): Observable<PoeditorPreview> {
    return this.http.post<PoeditorPreview>(`${BASE}/poeditor/preview`, body);
  }
  /** Import a whole POEditor project into a new Lexstore project. */
  poeditorImportAsProject(body: {
    apiToken: string;
    poeditorProjectId: number;
    languages: string[];
    name?: string;
  }): Observable<PoeditorImportResult> {
    return this.http.post<PoeditorImportResult>(`${BASE}/poeditor/import`, body);
  }

  // ---- Languages ----
  listLanguages(projectId: string): Observable<LanguageView[]> {
    return this.http.get<LanguageView[]>(`${BASE}/projects/${projectId}/languages`);
  }
  addLanguage(projectId: string, body: { code: string; name: string }): Observable<LanguageView> {
    return this.http.post<LanguageView>(`${BASE}/projects/${projectId}/languages`, body);
  }
  deleteLanguage(projectId: string, code: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/projects/${projectId}/languages/${code}`);
  }

  // ---- Translations (the editor view is the translations collection of a language) ----
  editor(
    projectId: string,
    lang: string,
    opts: { page?: number; size?: number; status?: string; q?: string; featureId?: string } = {},
  ): Observable<EditorResponse> {
    let params = new HttpParams()
      .set('page', String(opts.page ?? 0))
      .set('size', String(opts.size ?? 100));
    if (opts.status && opts.status !== 'all') params = params.set('status', opts.status);
    if (opts.q) params = params.set('q', opts.q);
    if (opts.featureId) params = params.set('featureId', opts.featureId);
    return this.http.get<EditorResponse>(
      `${BASE}/projects/${projectId}/languages/${lang}/translations`,
      { params },
    );
  }
  saveTranslation(
    projectId: string,
    termId: string,
    lang: string,
    body: {
      value: string | null;
      pluralOne?: string | null;
      status: TranslationStatus;
      version?: number | null;
    },
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
  updateTerm(
    projectId: string,
    termId: string,
    body: { source?: string; ctx?: string; tags?: string[] },
  ): Observable<TermView> {
    return this.http.patch<TermView>(`${BASE}/projects/${projectId}/terms/${termId}`, body);
  }
  deleteTerm(projectId: string, termId: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/projects/${projectId}/terms/${termId}`);
  }
  // ---- organisation, keys, usage ----

  org(): Observable<OrganisationView> {
    return this.http.get<OrganisationView>(`${BASE}/org`);
  }

  orgMembers(): Observable<OrgMemberView[]> {
    return this.http.get<OrgMemberView[]>(`${BASE}/org/members`);
  }

  credentials(): Observable<CredentialView[]> {
    return this.http.get<CredentialView[]>(`${BASE}/org/credentials`);
  }

  saveCredential(body: {
    provider: string;
    apiKey: string;
    label?: string;
    projectId?: string;
  }): Observable<CredentialView> {
    return this.http.post<CredentialView>(`${BASE}/org/credentials`, body);
  }

  deleteCredential(id: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/org/credentials/${id}`);
  }

  updateAgentPlan(body: { plan: string | null; monthlyQuota?: number }): Observable<OrganisationView> {
    return this.http.put<OrganisationView>(`${BASE}/org/agent`, body);
  }

  usage(days = 30): Observable<UsageSummary> {
    return this.http.get<UsageSummary>(`${BASE}/org/usage`, { params: { days } });
  }

  agentActivity(limit = 50): Observable<AgentActivityRow[]> {
    return this.http.get<AgentActivityRow[]>(`${BASE}/org/activity`, { params: { limit } });
  }

  // ---- proofreading and glossary ----

  proofread(projectId: string, lang: string, termId: string): Observable<ProofreadResult> {
    return this.http.get<ProofreadResult>(
      `${BASE}/projects/${projectId}/languages/${lang}/translations/${termId}/proofread`,
    );
  }

  glossary(projectId: string): Observable<GlossaryEntryView[]> {
    return this.http.get<GlossaryEntryView[]>(`${BASE}/projects/${projectId}/glossary`);
  }

  addGlossaryEntry(
    projectId: string,
    body: {
      term: string;
      languageCode?: string | null;
      translation?: string | null;
      doNotTranslate?: boolean;
      note?: string | null;
    },
  ): Observable<GlossaryEntryView> {
    return this.http.post<GlossaryEntryView>(`${BASE}/projects/${projectId}/glossary`, body);
  }

  deleteGlossaryEntry(projectId: string, id: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/projects/${projectId}/glossary/${id}`);
  }

  listComments(projectId: string, termId: string): Observable<CommentView[]> {
    return this.http.get<CommentView[]>(
      `${BASE}/projects/${projectId}/terms/${termId}/comments`,
    );
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

  deleteComment(projectId: string, termId: string, commentId: string): Observable<void> {
    return this.http.delete<void>(
      `${BASE}/projects/${projectId}/terms/${termId}/comments/${commentId}`,
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
  updateContributor(
    projectId: string,
    id: string,
    body: { role?: string; langs?: string[] },
  ): Observable<ContributorView> {
    return this.http.patch<ContributorView>(`${BASE}/projects/${projectId}/contributors/${id}`, body);
  }
  deleteContributor(projectId: string, id: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/projects/${projectId}/contributors/${id}`);
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
  revokeApiKey(projectId: string, id: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/projects/${projectId}/api-keys/${id}`);
  }

  // ---- Import / Export ----
  importTranslations(
    projectId: string,
    lang: string,
    entries: Record<string, string>,
  ): Observable<{ created: number; updated: number; total: number }> {
    return this.http.post<{ created: number; updated: number; total: number }>(
      `${BASE}/projects/${projectId}/import`,
      entries,
      { params: { lang } },
    );
  }
  exportTranslations(projectId: string, lang: string, format: 'json' | 'csv'): Observable<Blob> {
    return this.http.get(`${BASE}/projects/${projectId}/export`, {
      params: { lang, format },
      responseType: 'blob',
    });
  }

  // ---- AI translation service (project-independent) ----
  aiTranslate(body: {
    sourceText: string;
    sourceLang: string;
    targetLang: string;
    noCache?: boolean;
  }): Observable<TranslateResponse> {
    return this.http.post<TranslateResponse>(`${BASE}/ai/translate`, body);
  }
  aiRequests(page = 0, size = 80): Observable<RequestLogView[]> {
    return this.http.get<RequestLogView[]>(`${BASE}/ai/requests`, { params: { page, size } });
  }
  aiCache(q = '', page = 0, size = 80): Observable<CacheEntryView[]> {
    const params: Record<string, string | number> = { page, size };
    if (q) params['q'] = q;
    return this.http.get<CacheEntryView[]>(`${BASE}/ai/cache`, { params });
  }
  aiCacheStats(): Observable<CacheStats> {
    return this.http.get<CacheStats>(`${BASE}/ai/cache/stats`);
  }
  aiDeleteCacheEntry(id: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/ai/cache/${id}`);
  }
  aiInvalidateContent(sourceText: string): Observable<unknown> {
    return this.http.delete(`${BASE}/ai/cache`, { params: { sourceText } });
  }
  aiClearCache(): Observable<unknown> {
    return this.http.delete(`${BASE}/ai/cache`, { params: { all: true } });
  }
  aiSettings(): Observable<AiSettings> {
    return this.http.get<AiSettings>(`${BASE}/ai/settings`);
  }
  aiUpdateSettings(body: Partial<AiSettings>): Observable<AiSettings> {
    return this.http.put<AiSettings>(`${BASE}/ai/settings`, body);
  }

  // ---- editor AI actions ----
  suggestTranslation(projectId: string, termId: string, lang: string): Observable<{ text: string; provider: string; model: string; cacheHit: boolean }> {
    return this.http.get<{ text: string; provider: string; model: string; cacheHit: boolean }>(
      `${BASE}/projects/${projectId}/languages/${lang}/translations/${termId}/suggestion`,
    );
  }
  autoTranslate(projectId: string, lang: string): Observable<AutoTranslateResult> {
    return this.http.post<AutoTranslateResult>(
      `${BASE}/projects/${projectId}/languages/${lang}/translations/auto`,
      {},
    );
  }
}
