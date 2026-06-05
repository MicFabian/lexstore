/** Domain models mirroring the TransLad backend DTOs. */

export type TranslationStatus = 'untranslated' | 'translated' | 'fuzzy' | 'proofread';

export interface ProjectSummary {
  id: string;
  name: string;
  code: string;
  sourceLang: string;
  mark: string;
  terms: number;
  langs: number;
  progress: number;
  untranslated: number;
  newTerms: number;
  updated: string | null;
}

export interface ProjectDetail {
  id: string;
  name: string;
  code: string;
  sourceLang: string;
  mark: string;
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
  target: string | null;
  status: TranslationStatus;
  comments: CommentView[];
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

export interface EditorResponse {
  languageCode: string;
  sourceLang: string;
  rows: EditorRow[];
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

export const STATUS_LABEL: Record<TranslationStatus, string> = {
  untranslated: 'Untranslated',
  translated: 'Translated',
  fuzzy: 'Needs review',
  proofread: 'Proofread',
};
