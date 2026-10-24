/**
 * Sidebar — organisme de navigation (remplace SideBar.jsx antd).
 * - Desktop : colonne sticky, rétractable (persistée localStorage
 *   'gh.sidebar.collapsed') ; en mode réduit : icônes + tooltip.
 * - Mobile < 960px : drawer + overlay, fermé par Échap / overlay /
 *   navigation.
 * - Rôles : filtrage via navigation.ts (parité avec l'ancien menu).
 * - A11y : nav > ul > li > a, aria-current="page", aria-expanded
 *   sur les groupes, lien "Aller au contenu" géré par AppShell.
 */
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  filterNavByRole,
  NAV_ENTRIES,
  type NavGroupItem,
  type NavLinkItem,
} from './navigation';
import { Tooltip } from '../../design-system/components/atoms';
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  PanelLeftIcon,
  XIcon,
} from '../../design-system/foundation/icons';
import styles from './sidebar.module.scss';

export interface SidebarProps {
  role: string | undefined;
  /** Desktop : icônes seules (persisté par AppShell). */
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Mobile : drawer ouvert. */
  drawerOpen: boolean;
  onCloseDrawer: () => void;
}

export const Sidebar = ({
  role,
  collapsed,
  onToggleCollapsed,
  drawerOpen,
  onCloseDrawer,
}: SidebarProps) => {
  const { pathname } = useLocation();
  const entries = filterNavByRole(NAV_ENTRIES, role);
  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    // Ouvre par défaut le groupe contenant la page active.
    const active = NAV_ENTRIES.find(
      (entry) => 'children' in entry && entry.children.some((child) => child.path === pathname),
    );
    return active ? [active.key] : [];
  });

  const toggleGroup = (key: string) => {
    setOpenGroups((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    );
  };

  const handleNavigate = () => {
    if (drawerOpen) onCloseDrawer();
  };

  return (
    <>
      {/* Overlay mobile (cliqué → ferme) */}
      {drawerOpen && (
        <div
          className={styles.overlay}
          onClick={onCloseDrawer}
          aria-hidden="true"
        />
      )}
      <aside
        className={[
          styles.sidebar,
          collapsed ? styles.collapsed : '',
          drawerOpen ? styles.drawerOpen : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label="Navigation principale"
      >
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            H
          </span>
          {!collapsed && <span className={styles.brandName}>Hôpital Général de Ndjili</span>}
          <button
            type="button"
            className={styles.closeDrawer}
            aria-label="Fermer la navigation"
            onClick={onCloseDrawer}
          >
            <XIcon size={18} />
          </button>
        </div>

        <nav className={styles.nav}>
          <ul className={styles.list}>
            {entries.map((entry) => {
              if ('children' in entry) {
                return (
                  <GroupItem
                    key={entry.key}
                    group={entry as NavGroupItem}
                    collapsed={collapsed}
                    open={openGroups.includes(entry.key)}
                    onToggle={() => toggleGroup(entry.key)}
                    onNavigate={handleNavigate}
                    pathname={pathname}
                  />
                );
              }
              return (
                <LeafItem
                  key={entry.key}
                  link={entry as NavLinkItem}
                  collapsed={collapsed}
                  onNavigate={handleNavigate}
                  pathname={pathname}
                />
              );
            })}
          </ul>
        </nav>

        <button
          type="button"
          className={styles.collapseButton}
          onClick={onToggleCollapsed}
          aria-pressed={collapsed}
          aria-label={collapsed ? 'Déplier la navigation' : 'Replier la navigation'}
        >
          {collapsed ? <PanelLeftIcon size={18} /> : <ChevronLeftIcon size={18} />}
          {!collapsed && <span>Replier</span>}
        </button>
      </aside>
    </>
  );
};

function GroupItem({
  group,
  collapsed,
  open,
  onToggle,
  onNavigate,
  pathname,
}: {
  group: NavGroupItem;
  collapsed: boolean;
  open: boolean;
  onToggle: () => void;
  onNavigate: () => void;
  pathname: string;
}) {
  const isActive = group.children.some((child) => child.path === pathname);
  const first = group.children[0];

  // Mode réduit : l'icône du groupe mène au premier enfant + tooltip.
  if (collapsed) {
    if (!first) return null;
    const FirstIcon = first.icon;
    return (
      <li className={styles.item}>
        <Tooltip content={group.label} position="right">
          <NavLink
            to={first.path}
            onClick={onNavigate}
            className={({ isActive: linkActive }) =>
              [
                styles.link,
                styles.iconOnly,
                linkActive || isActive ? styles.active : '',
              ]
                .filter(Boolean)
                .join(' ')
            }
            aria-label={group.label}
          >
            <FirstIcon size={20} />
          </NavLink>
        </Tooltip>
      </li>
    );
  }

  const GroupIcon = group.icon;
  return (
    <li className={styles.item}>
      <button
        type="button"
        className={`${styles.link} ${styles.groupButton} ${isActive ? styles.active : ''}`}
        aria-expanded={open}
        onClick={onToggle}
      >
        <GroupIcon size={20} />
        <span className={styles.linkLabel}>{group.label}</span>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>
          <ChevronDownIcon size={16} />
        </span>
      </button>
      {open && (
        <ul className={styles.subList}>
          {group.children.map((child) => (
            <LeafItem
              key={child.key}
              link={child}
              collapsed={false}
              onNavigate={onNavigate}
              pathname={pathname}
              nested
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function LeafItem({
  link,
  collapsed,
  onNavigate,
  pathname,
  nested = false,
}: {
  link: NavLinkItem;
  collapsed: boolean;
  onNavigate: () => void;
  pathname: string;
  nested?: boolean;
}) {
  const Icon = link.icon;
  const isActive = pathname === link.path;

  if (link.disabled) {
    return (
      <li className={styles.item}>
        <Tooltip content="Bientôt disponible" position={collapsed ? 'right' : 'bottom'}>
          <span
            className={[styles.link, nested ? styles.nested : '', styles.disabled].join(' ')}
            aria-disabled="true"
          >
            <Icon size={nested ? 16 : 20} />
            {!collapsed && <span className={styles.linkLabel}>{link.label}</span>}
          </span>
        </Tooltip>
      </li>
    );
  }

  if (collapsed) {
    return (
      <li className={styles.item}>
        <Tooltip content={link.label} position="right">
          <NavLink
            to={link.path}
            onClick={onNavigate}
            className={({ isActive: linkActive }) =>
              [styles.link, styles.iconOnly, linkActive ? styles.active : '']
                .filter(Boolean)
                .join(' ')
            }
            aria-label={link.label}
          >
            <Icon size={20} />
          </NavLink>
        </Tooltip>
      </li>
    );
  }

  return (
    <li className={styles.item}>
      <NavLink
        to={link.path}
        onClick={onNavigate}
        end={link.path === '/'}
        className={({ isActive: linkActive }) =>
          [styles.link, nested ? styles.nested : '', linkActive ? styles.active : '']
            .filter(Boolean)
            .join(' ')
        }
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon size={nested ? 16 : 20} />
        <span className={styles.linkLabel}>{link.label}</span>
      </NavLink>
    </li>
  );
}

// Le drawer mobile se ferme via l'overlay dédié (l'overlay est HORS
// de l'aside : un clic extérieur frappe toujours l'overlay).

Sidebar.displayName = 'Sidebar';
export default Sidebar;
