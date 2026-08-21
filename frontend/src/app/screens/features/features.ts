import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Icon } from '../../shared/icon';
import { Btn, SearchBox } from '../../shared/primitives';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { PromptDialog } from '../../shared/prompt-dialog';
import { ApiService } from '../../core/api.service';
import { ProjectStateService } from '../../core/project-state.service';
import { ToastService } from '../../core/toast.service';
import { FeatureView, OpenTranslationView } from '../../core/models';

@Component({
  selector: 'tl-features-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Btn, SearchBox, ConfirmDialog, PromptDialog],
  template: `
    <div class="well">
      <div class="pad">
        <div class="phead">
          <div>
            <div class="eyebrow">Delivery</div>
            <h1 class="serif">Features</h1>
            <div class="psub">
              {{ features().length }} features · {{ openTotal() }} translations still open
            </div>
          </div>
          <div style="display:flex;gap:10px;align-items:center">
            <tl-search placeholder="Search features" [value]="query()" [width]="200" (changed)="query.set($event)" />
            <tl-btn variant="primary" icon="Plus" (clicked)="creating.set(true)">New feature</tl-btn>
          </div>
        </div>

        <table class="ttable features">
          <thead>
            <tr>
              <th>Feature</th>
              <th style="width:90px;text-align:right">Terms</th>
              <th style="width:110px;text-align:right">Needs review</th>
              <th style="width:110px;text-align:right">Open</th>
              <th style="width:190px;text-align:right">Coverage</th>
              <th style="width:44px"></th>
            </tr>
          </thead>
          <tbody>
            @for (f of filtered(); track f.id) {
              <tr class="trow" (click)="toggle(f)">
                <td>
                  <div style="display:flex;align-items:center;gap:8px">
                    <span class="expand-toggle" [class.open]="expanded() === f.id">
                      <tl-icon name="ChevronRight" [size]="15" />
                    </span>
                    <div>
                      <div class="fname">{{ f.name }}</div>
                      <div class="fkey">{{ f.key }}</div>
                    </div>
                  </div>
                </td>
                <td style="text-align:right"><span class="fnum">{{ f.terms }}</span></td>
                <td style="text-align:right">
                  @if (f.fuzzy > 0) {
                    <span class="fnum" style="color:var(--tl-st-fuzzy)">{{ f.fuzzy }}</span>
                  } @else {
                    <span class="fnum" style="color:var(--tl-muted)">—</span>
                  }
                </td>
                <td style="text-align:right">
                  @if (f.untranslated > 0) {
                    <span class="fnum" style="color:var(--tl-st-untranslated)">{{ f.untranslated }}</span>
                  } @else {
                    <span class="fnum" style="color:var(--tl-st-translated)">0</span>
                  }
                </td>
                <td>
                  <div class="covcell">
                    <span class="progress" style="width:72px;height:5px">
                      <i class="seg-translated" [style.width.%]="f.percent"></i>
                      <i class="seg-fuzzy" [style.width.%]="fuzzyPct(f)"></i>
                    </span>
                    <span class="covnum">{{ f.percent }}%</span>
                  </div>
                </td>
                <td (click)="$event.stopPropagation()">
                  <button class="btn btn--subtle btn--sm btn--icon" aria-label="Delete feature" (click)="pendingDelete.set(f)">
                    <tl-icon name="Trash2" [size]="15" color="var(--tl-muted)" />
                  </button>
                </td>
              </tr>

              @if (expanded() === f.id) {
                <tr class="trow-expand">
                  <td colspan="6">
                    <div class="expand-body">
                      <div class="row" style="margin-bottom:12px">
                        <div class="eyebrow">Coverage per language</div>
                        <div class="spacer"></div>
                        <tl-btn variant="subtle" [sm]="true" icon="List" (clicked)="openEditor(f)">
                          Open in editor
                        </tl-btn>
                      </div>
                      <div class="lang-cov">
                        @for (l of f.languages; track l.code) {
                          <button
                            class="cov-row"
                            [class.on]="openLang() === l.code"
                            (click)="showOpen(f, l.code)"
                          >
                            <span class="locale">{{ l.code }}</span>
                            <span class="cov-name">{{ l.name }}</span>
                            <span class="progress" style="width:80px;height:5px">
                              <i class="seg-translated" [style.width.%]="l.percent"></i>
                              <i class="seg-fuzzy" [style.width.%]="langFuzzyPct(f, l.fuzzy)"></i>
                            </span>
                            <span class="covnum">{{ l.percent }}%</span>
                            <span class="cov-open">
                              @if (l.untranslated + l.fuzzy > 0) {
                                {{ l.untranslated + l.fuzzy }} open
                              } @else {
                                complete
                              }
                            </span>
                          </button>
                        }
                      </div>

                      @if (openRows().length > 0) {
                        <div class="eyebrow" style="margin:18px 0 8px">
                          Open in {{ openLang() }} · {{ openRows().length }}
                        </div>
                        <div class="open-list">
                          @for (r of openRows(); track r.termId + r.languageCode) {
                            <div class="open-row">
                              <span class="keytag">{{ r.key }}</span>
                              <span class="open-src">{{ r.sourceText }}</span>
                              <span class="stcap" [style.color]="'var(--tl-st-' + r.status + ')'">
                                {{ r.status === 'fuzzy' ? 'Needs review' : 'Untranslated' }}
                              </span>
                            </div>
                          }
                        </div>
                      } @else if (openLang()) {
                        <div class="muted" style="font-size:13px;margin-top:14px">
                          Nothing open in {{ openLang() }}.
                        </div>
                      }
                    </div>
                  </td>
                </tr>
              }
            }
            @if (filtered().length === 0) {
              <tr>
                <td colspan="6" style="padding:48px 16px;text-align:center">
                  <div class="serif" style="font-size:22px;margin-bottom:6px">No features yet</div>
                  <div class="muted" style="font-size:13.5px">
                    Group a project's terms by what ships together to track coverage per feature.
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (creating()) {
      <tl-prompt-dialog
        title="New feature"
        description="Group the terms that ship together, then track how far along they are."
        [fields]="[{ name: 'name', label: 'Feature name', placeholder: 'Checkout' }]"
        submitLabel="Create feature"
        (submitted)="createFeature($event)"
        (cancelled)="creating.set(false)"
      />
    }

    @if (pendingDelete(); as f) {
      <tl-confirm-dialog
        title="Delete this feature?"
        [description]="'“' + f.name + '” stops grouping its ' + f.terms + ' terms. The terms and their translations stay.'"
        confirmLabel="Delete feature"
        (confirmed)="confirmDelete(f)"
        (cancelled)="pendingDelete.set(null)"
      />
    }
  `,
  styles: `
    .features {
      background: transparent;
    }
    .fname {
      font-size: 14px;
      font-weight: 600;
      color: var(--tl-ink);
    }
    .fkey {
      font: 500 12.5px var(--tl-mono);
      color: var(--tl-slate);
      margin-top: 2px;
    }
    .fnum {
      font: 500 13px var(--tl-mono);
      font-variant-numeric: tabular-nums;
    }
    .covcell {
      display: flex;
      align-items: center;
      gap: 9px;
      justify-content: flex-end;
    }
    .covnum {
      font: 500 12.5px var(--tl-mono);
      color: var(--tl-slate);
      width: 40px;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .expand-body {
      padding: 16px 24px 20px 44px;
    }
    .lang-cov {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 32px;
    }
    .cov-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 8px;
      margin: 0 -8px;
      border: none;
      background: none;
      border-bottom: 1px solid var(--tl-line-2);
      text-align: left;
      cursor: pointer;
      border-radius: var(--tl-r-sm);
    }
    .cov-row:hover {
      background: var(--tl-row-hover);
    }
    .cov-row.on {
      background: var(--tl-accent-soft);
    }
    .cov-name {
      flex: 1;
      font-size: 13.5px;
      color: var(--tl-ink);
    }
    .cov-open {
      width: 88px;
      text-align: right;
      font: 500 12px var(--tl-mono);
      color: var(--tl-slate);
    }
    .open-list {
      border-top: 1px solid var(--tl-line-2);
    }
    .open-row {
      display: grid;
      grid-template-columns: 240px 1fr 130px;
      gap: 16px;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid var(--tl-line-2);
    }
    .open-src {
      font-size: 13.5px;
      color: var(--tl-ink-80);
    }
  `,
})
export class FeaturesScreen implements OnInit {
  private readonly api = inject(ApiService);
  private readonly state = inject(ProjectStateService);
  private readonly router = inject(Router);
  protected readonly toast = inject(ToastService);

  protected readonly features = signal<FeatureView[]>([]);
  protected readonly query = signal('');
  protected readonly expanded = signal<string | null>(null);
  protected readonly openLang = signal<string | null>(null);
  protected readonly openRows = signal<OpenTranslationView[]>([]);
  protected readonly creating = signal(false);
  protected readonly pendingDelete = signal<FeatureView | null>(null);

  protected readonly filtered = computed(() => {
    const q = this.query().toLowerCase();
    if (!q) return this.features();
    return this.features().filter(
      (f) => f.name.toLowerCase().includes(q) || f.key.includes(q),
    );
  });

  protected readonly openTotal = computed(() =>
    this.features().reduce((a, f) => a + f.untranslated + f.fuzzy, 0),
  );

  ngOnInit(): void {
    this.state.whenReady((pid) => this.load(pid));
  }

  private load(pid: string): void {
    this.api.listFeatures(pid).subscribe((f) => this.features.set(f));
  }

  /** The fuzzy share sits on top of the translated bar, so it is offset by it. */
  protected fuzzyPct(f: FeatureView): number {
    const slots = f.translated + f.fuzzy + f.untranslated;
    return slots === 0 ? 0 : Math.round((f.fuzzy / slots) * 100);
  }

  protected langFuzzyPct(f: FeatureView, fuzzy: number): number {
    return f.terms === 0 ? 0 : Math.round((fuzzy / f.terms) * 100);
  }

  protected toggle(f: FeatureView): void {
    const next = this.expanded() === f.id ? null : f.id;
    this.expanded.set(next);
    this.openLang.set(null);
    this.openRows.set([]);
  }

  protected showOpen(f: FeatureView, code: string): void {
    const pid = this.state.current()?.id;
    if (!pid) return;
    if (this.openLang() === code) {
      this.openLang.set(null);
      this.openRows.set([]);
      return;
    }
    this.openLang.set(code);
    this.api.openTranslations(pid, f.id, code).subscribe((rows) => this.openRows.set(rows));
  }

  protected openEditor(f: FeatureView): void {
    this.router.navigate(['/', 'editor'], { queryParams: { feature: f.key } });
  }

  protected createFeature(values: Record<string, string>): void {
    const name = values['name'];
    const pid = this.state.current()?.id;
    if (!pid || !name) return;
    this.creating.set(false);
    this.api.createFeature(pid, { name }).subscribe({
      next: (f) => {
        this.features.update((list) => [...list, f].sort((a, b) => a.name.localeCompare(b.name)));
        this.toast.show(`Created ${f.name}`);
      },
      error: () => this.toast.show('That feature already exists'),
    });
  }

  protected confirmDelete(f: FeatureView): void {
    this.pendingDelete.set(null);
    const pid = this.state.current()?.id;
    if (!pid) return;
    this.api.deleteFeature(pid, f.id).subscribe({
      next: () => {
        this.features.update((list) => list.filter((x) => x.id !== f.id));
        this.toast.show(`Deleted ${f.name}`);
      },
      error: () => this.toast.show('Not allowed (needs admin)'),
    });
  }
}
