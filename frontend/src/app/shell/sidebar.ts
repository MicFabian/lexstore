import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Icon, IconName } from '../shared/icon';
import { Avatar, avatarIndexFor } from '../shared/primitives';
import { BrandMark } from './brand-mark';
import { ProjectStateService } from '../core/project-state.service';
import { AuthService } from '../core/auth.service';

interface NavItem {
  path: string;
  icon: IconName;
  label: string;
  count?: number;
}

interface QuickItem {
  icon: IconName;
  label: string;
  count: number;
  color: string;
  link: string[];
  params: Record<string, string>;
}

@Component({
  selector: 'tl-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, Icon, Avatar, BrandMark],
  template: `
    <aside class="rail">
      <div class="rail__brand">
        <tl-brand-mark [size]="28" [radius]="7" />
        <span class="word">Trans<b>Lad</b></span>
      </div>

      <!-- Project switcher -->
      <div class="proj-switch">
        <button class="rail__proj" (click)="switcherOpen.set(!switcherOpen())" [attr.aria-expanded]="switcherOpen()">
          <span class="pmark" [style.background]="current()?.image ? 'none' : current()?.mark">
            @if (current()?.image; as img) {
              <img class="pimg" [src]="img" alt="" />
            } @else {
              <tl-icon name="ArrowRightLeft" [size]="14" color="#fff" />
            }
          </span>
          <span class="pmeta">
            <span class="pname">{{ current()?.name }}</span>
            <span class="psub">{{ current()?.code }}</span>
          </span>
          <tl-icon name="ChevronsUpDown" [size]="15" color="var(--tl-muted)" />
        </button>
        @if (switcherOpen()) {
          <div class="menu-backdrop" (click)="switcherOpen.set(false)"></div>
          <div class="menu proj-menu">
            <div class="menu__label">Switch project</div>
            @for (p of projects(); track p.id) {
              <button class="pm-item" [class.on]="p.id === current()?.id" (click)="pick(p.id)">
                <span class="pm-mark" [style.background]="p.image ? 'none' : p.mark">
                  @if (p.image; as img) {
                    <img class="pimg" [src]="img" alt="" />
                  } @else {
                    <tl-icon name="ArrowRightLeft" [size]="12" color="#fff" />
                  }
                </span>
                <span class="pm-meta">
                  <span class="pm-name">{{ p.name }}</span>
                  <span class="pm-code">{{ p.code }}</span>
                </span>
                @if (p.id === current()?.id) {
                  <tl-icon name="Check" [size]="15" color="var(--tl-accent-hi)" />
                } @else {
                  <span class="pm-prog">{{ p.progress }}%</span>
                }
              </button>
            }
            <div class="menu__divider"></div>
            <button class="menu__item" (click)="viewAll()">
              <tl-icon name="LayoutGrid" [size]="15" color="var(--tl-slate)" />
              <span>View all projects</span>
            </button>
          </div>
        }
      </div>

      <nav class="rail__nav">
        <div class="rail__group">Workspace</div>
        <a class="navitem" [routerLink]="['/', 'projects']" routerLinkActive="active">
          <tl-icon name="LayoutGrid" [size]="17" />
          <span>Projects</span>
          <span class="count">{{ projects().length }}</span>
        </a>
        <a class="navitem" [routerLink]="['/', 'ai']" routerLinkActive="active">
          <tl-icon name="WandSparkles" [size]="16" />
          <span>Translation AI</span>
        </a>

        <div class="rail__group">Project</div>
        @for (n of nav(); track n.path) {
          <a class="navitem" [routerLink]="['/', n.path]" routerLinkActive="active">
            <tl-icon [name]="n.icon" [size]="17" />
            <span>{{ n.label }}</span>
            @if (n.count != null) {
              <span class="count">{{ n.count.toLocaleString() }}</span>
            }
          </a>
        }

        <div class="rail__group">Quick filters</div>
        @for (q of quick(); track q.label) {
          <a class="navitem" [routerLink]="q.link" [queryParams]="q.params">
            <tl-icon [name]="q.icon" [size]="15" [color]="q.color" />
            <span>{{ q.label }}</span>
            <span class="count">{{ q.count }}</span>
          </a>
        }
      </nav>

      <div class="proj-switch">
        <button class="rail__foot foot-btn" (click)="userMenuOpen.set(!userMenuOpen())">
          <tl-avatar [i]="userAvatar()" [name]="userName()" [sm]="true" />
          <div style="min-width:0;flex:1;text-align:left">
            <div class="foot-name">{{ userName() }}</div>
            <div class="foot-role">{{ topRole() }}</div>
          </div>
          <tl-icon name="ChevronsUpDown" [size]="15" color="var(--tl-muted)" />
        </button>
        @if (userMenuOpen()) {
          <div class="menu-backdrop" (click)="userMenuOpen.set(false)"></div>
          <div class="menu" style="bottom:calc(100% + 6px);left:12px;right:12px">
            <div class="menu__label">{{ userEmail() || userName() }}</div>
            @for (r of roles(); track r) {
              <div class="menu__item" style="cursor:default">
                <tl-icon name="Check" [size]="14" color="var(--tl-accent-hi)" /><span style="text-transform:capitalize">{{ r }}</span>
              </div>
            }
            <div class="menu__divider"></div>
            <button class="menu__item" (click)="logout()">
              <tl-icon name="ArrowRight" [size]="15" color="var(--tl-slate)" /><span>Sign out</span>
            </button>
          </div>
        }
      </div>
    </aside>
  `,
  styles: `
    /* The host must dissolve so .rail itself is the app-grid item and
       stretches to the full viewport height. */
    :host {
      display: contents;
    }
    .pimg {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: inherit;
      display: block;
    }
    .foot-btn {
      width: 100%;
      border: none;
      background: none;
      cursor: pointer;
    }
    .foot-btn:hover {
      background: var(--tl-fill);
    }
    .foot-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--tl-ink);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .foot-role {
      font-size: 12.5px;
      color: var(--tl-slate);
      text-transform: capitalize;
    }
  `,
})
export class Sidebar {
  private readonly state = inject(ProjectStateService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly switcherOpen = signal(false);
  protected readonly userMenuOpen = signal(false);
  protected readonly roles = this.auth.roles;
  protected readonly userName = computed(() => this.auth.user()?.name ?? 'Loading…');
  protected readonly userEmail = computed(() => this.auth.user()?.email ?? null);
  protected readonly userAvatar = computed(() => avatarIndexFor(this.auth.user()?.name ?? ''));
  protected readonly topRole = computed(() => {
    const order = ['owner', 'admin', 'proofreader', 'translator'];
    const r = this.roles();
    return order.find((o) => r.includes(o)) ?? 'member';
  });
  protected readonly projects = this.state.projects;
  protected readonly current = this.state.current;

  protected readonly nav = computed<NavItem[]>(() => {
    const c = this.current();
    return [
      { path: 'editor', icon: 'Languages', label: 'Translations', count: c?.terms },
      { path: 'terms', icon: 'FileText', label: 'Terms', count: c?.terms },
      { path: 'features', icon: 'LayoutGrid', label: 'Features' },
      { path: 'languages', icon: 'Globe', label: 'Languages', count: c?.langs },
      { path: 'contributors', icon: 'Users', label: 'Contributors' },
      { path: 'settings', icon: 'Settings', label: 'Settings' },
    ];
  });

  /** Live counts from the current project; each entry deep-links with its filter applied. */
  protected readonly quick = computed<QuickItem[]>(() => {
    const c = this.current();
    const items: QuickItem[] = [
      {
        icon: 'CircleDashed',
        label: 'Untranslated',
        count: c?.untranslated ?? 0,
        color: 'var(--tl-st-untranslated)',
        link: ['/editor'],
        params: { filter: 'untranslated' },
      },
      {
        icon: 'Sparkles',
        label: 'Newly added',
        count: c?.newTerms ?? 0,
        color: 'var(--tl-st-new)',
        link: ['/terms'],
        params: { new: '1' },
      },
      {
        icon: 'Eye',
        label: 'Needs review',
        count: c?.needsReview ?? 0,
        color: 'var(--tl-st-fuzzy)',
        link: ['/editor'],
        params: { filter: 'fuzzy' },
      },
    ];
    return items;
  });

  protected pick(id: string): void {
    this.state.select(id);
    this.switcherOpen.set(false);
    this.router.navigate(['/', 'editor']);
  }

  protected viewAll(): void {
    this.switcherOpen.set(false);
    this.router.navigate(['/', 'projects']);
  }

  protected logout(): void {
    this.userMenuOpen.set(false);
    this.auth.logout();
  }
}
