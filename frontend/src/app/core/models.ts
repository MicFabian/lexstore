/** Domain models mirroring the Lexstore backend DTOs. */

export type TranslationStatus = 'untranslated' | 'translated' | 'fuzzy' | 'proofread';

export interface ProjectSummary {
  id: string;
  name: string;
  code: string;
  sourceLang: string;
  mark: string;
  /** Where to fetch the image, not the image itself. */
  imageUrl: string | null;
  terms: number;
  langs: number;
  progress: number;
  untranslated: number;
  newTerms: number;
  needsReview: number;
  updated: string | null;
}

export interface ProjectDetail {
  id: string;
  name: string;
  code: string;
  sourceLang: string;
  mark: string;
  image: string | null;
  translationContext: string | null;
  terms: number;
}

export interface LanguageView {
  id: string;
  code: string;
  name: string;
  translated: number;
  fuzzy: number;
  untranslated: number;
  contributors: number;
}

export interface PluralForms {
  one: string | null;
  other: string | null;
}

export interface CommentView {
  id: string;
  authorName: string;
  authorAvatar: number;
  text: string;
  time: string;
}

export interface TermTranslationView {
  code: string;
  name: string;
  value: string | null;
  status: TranslationStatus;
  modifiedBy: AuditEntry | null;
}

export interface AuditEntry {
  name: string;
  avatar: number;
  action: string;
  at: string;
}

export interface TermView {
  id: string;
  key: string;
  ctx: string;
  source: string;
  plural: PluralForms | null;
  tags: string[];
  isNew: boolean;
  added: string;
  createdAt: string;
  createdBy: AuditEntry | null;
  modifiedAt: string | null;
  modifiedBy: AuditEntry | null;
  translations: TermTranslationView[];
  comments: CommentView[];
  history: AuditEntry[];
}

export interface EditorRow {
  id: string;
  key: string;
  ctx: string;
  source: string;
  plural: PluralForms | null;
  tags: string[];
  isNew: boolean;
  featureId: string | null;
  target: string | null;
  version: number | null;
  status: TranslationStatus;
  origin: 'human' | 'ai';
  modifiedBy: AuditEntry | null;
  modifiedAt: string | null;
}

export interface TranslationHistoryEntry {
  languageCode: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  oldStatus: string | null;
  newStatus: string;
  authorName: string;
  authorAvatar: number;
  at: string;
}

export interface EditorCounts {
  all: number;
  untranslated: number;
  new: number;
  fuzzy: number;
  proofread: number;
}

export interface EditorResponse {
  languageCode: string;
  sourceLang: string;
  rows: EditorRow[];
  page: number;
  size: number;
  total: number;
  counts: EditorCounts;
}

export interface ContributorView {
  id: string;
  name: string;
  email: string;
  role: string;
  langs: string[];
  avatar: number;
  active: string;
}

export interface ApiKeyView {
  id: string;
  label: string;
  prefix: string;
  tail: string;
  scope: string;
  created: string;
  used: string;
  test: boolean;
}

export interface ApiKeyCreated {
  id: string;
  label: string;
  secret: string;
  scope: string;
}

// ---- AI translation service ----
export interface TranslateResponse {
  text: string;
  provider: string;
  model: string;
  cacheHit: boolean;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
}

export interface RequestLogView {
  id: string;
  sourceText: string;
  sourceLang: string;
  targetLang: string;
  provider: string;
  model: string;
  resultText: string | null;
  cacheHit: boolean;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  status: string;
  errorMessage: string | null;
  at: string;
}

export interface CacheEntryView {
  id: string;
  sourceText: string;
  sourceLang: string;
  targetLang: string;
  provider: string;
  model: string;
  targetText: string;
  hits: number;
  createdAt: string;
  lastUsedAt: string;
}

export interface CacheStats {
  entries: number;
  totalHits: number;
  requests: number;
  cacheHits: number;
  hitRate: number;
}

export interface AiSettings {
  provider: string;
  model: string;
  temperature: number;
  formality: string;
  tone: string | null;
  autoFlagFuzzy: boolean;
  cacheTtlHours: number;
  claudeAvailable: boolean;
  geminiAvailable: boolean;
}

export interface PoeditorProject {
  id: number;
  name: string;
  terms: number | null;
}

export interface PoeditorLanguage {
  code: string;
  name: string;
  translations: number;
  percentage: number;
}

export interface FeatureLanguageCoverage {
  code: string;
  name: string;
  translated: number;
  fuzzy: number;
  untranslated: number;
  percent: number;
}

export interface AutoTranslateResult {
  translated: number;
  status: string;
  failed: number;
  remaining: number;
}

export interface AiDraftResult {
  drafted: number;
  failed: number;
  skipped: number;
  status: string;
}

export interface AiReviewRow {
  termId: string;
  key: string;
  source: string;
  languageCode: string;
  languageName: string;
  value: string;
  version: number;
  provider: string;
  at: string;
}

export interface FeatureView {
  id: string;
  name: string;
  key: string;
  description: string | null;
  terms: number;
  translated: number;
  fuzzy: number;
  untranslated: number;
  percent: number;
  languages: FeatureLanguageCoverage[];
}

export interface OpenTranslationView {
  termId: string;
  key: string;
  sourceText: string;
  languageCode: string;
  languageName: string;
  status: string;
  value: string | null;
}

export interface PoeditorPreview {
  languages: { code: string; name: string; imported: number }[];
  rows: { key: string; context: string | null; translations: Record<string, string | null> }[];
  totalTerms: number;
}

export interface PoeditorImportResult {
  projectId: string;
  projectName: string;
  languages: { code: string; name: string; imported: number }[];
  termsCreated: number;
  translationsImported: number;
  duplicateKeysSkipped: number;
}

export const STATUS_LABEL: Record<TranslationStatus, string> = {
  untranslated: 'Untranslated',
  translated: 'Translated',
  fuzzy: 'Needs review',
  proofread: 'Proofread',
};

export interface AgentPlanView {
  plan: string;
  monthlyQuota: number;
  used: number;
  remaining: number;
  percentUsed: number;
  periodStart: string;
  periodEnd: string;
}

export interface OrganisationView {
  id: string;
  name: string;
  slug: string;
  projects: number;
  members: number;
  agent: AgentPlanView | null;
}

export interface OrgMemberView {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface OrgApiKeyCreated {
  id: string;
  label: string;
  secret: string;
  scope: string;
}

export interface CredentialView {
  id: string;
  provider: string;
  label: string;
  tail: string;
  scope: 'organisation' | 'project';
  projectName: string | null;
  createdAt: string;
  createdBy: string | null;
}

export interface ProviderUsage {
  provider: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
}

export interface DailyUsage {
  day: string;
  requests: number;
  tokens: number;
}

export interface UsageSummary {
  totalRequests: number;
  cacheHits: number;
  cacheHitRate: number;
  inputTokens: number;
  outputTokens: number;
  failures: number;
  byProvider: ProviderUsage[];
  byDay: DailyUsage[];
}

export interface AgentActivityRow {
  at: string;
  projectName: string | null;
  languageCode: string | null;
  sourceText: string;
  provider: string;
  model: string;
  cacheHit: boolean;
  inputTokens: number;
  outputTokens: number;
  status: string;
}

export interface ProofreadIssue {
  kind: string;
  severity: 'minor' | 'major';
  message: string;
}

export interface ProofreadResult {
  verdict: 'good' | 'needs_work' | 'wrong';
  issues: ProofreadIssue[];
  suggestion: string | null;
  provider: string;
  model: string;
}

export interface GlossaryEntryView {
  id: string;
  term: string;
  languageCode: string | null;
  translation: string | null;
  doNotTranslate: boolean;
  note: string | null;
}
