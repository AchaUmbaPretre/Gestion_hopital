/**
 * TopBar — organisme d'en-tête (remplace TopBar.jsx antd).
 * Contenu : hamburger (mobile), déclencheur de recherche ⌘K,
 * bascule de thème, cloche NotificationCenter, menu utilisateur
 * (thème clair/sombre/auto + déconnexion avec ConfirmDialog).
 * Déconnexion : parité avec l'ancien flux (purge persist + reload).
 */
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Button, IconButton } from '../../design-system/components/atoms';
import { ConfirmDialog } from '../../design-system/components/molecules/ConfirmDialog/ConfirmDialog';
import { useToast } from '../../design-system/components/molecules/Toast/Toast';
import {
  BellIcon,
  ChevronDownIcon,
  CommandIcon,
  LogOutIcon,
  MenuIcon,
  MoonIcon,
  SearchIcon,
  SunIcon,
} from '../../design-system/foundation/icons';
import { useTheme, type ThemePreference } from '../providers/ThemeProvider';
import { useCommandPalette } from './CommandPalette';
import { logout } from '../../services/authService';
import { NotificationCenter } from './NotificationCenter';
import { useDismiss } from '../../shared/hooks';
import styles from './topBar.module.scss';

export interface TopBarProps {
  user: { id?: number | string; username?: string; role?: string } | undefined;
  onOpenDrawer: () => void;
}

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
  { value: 'auto', label: 'Automatique' },
];

export const TopBar = ({ user, onOpenDrawer }: TopBarProps) => {
  const navigate = useNavigate();
  const toast = useToast();
  const { preference, resolvedTheme, setPreference } = useTheme();
  const { setOpen: setPaletteOpen } = useCommandPalette();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const notificationsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useDismiss({
    enabled: notificationsOpen,
    ref: notificationsRef,
    onDismiss: () => setNotificationsOpen(false),
  });
  useDismiss({
    enabled: userMenuOpen,
    ref: userMenuRef,
    onDismiss: () => setUserMenuOpen(false),
  });

  const isDark = resolvedTheme === 'dark';

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // On purge quand même : la déconnexion locale prime.
    }
    try {
      localStorage.removeItem('persist:root');
    } catch {
      // storage indisponible : tant pis, le store se vide via reload.
    }
    toast.success('Déconnexion réussie');
    navigate('/login');
    window.location.reload();
  };


  return (
    <header className={styles.topBar}>
      <IconButton
        variant="ghost"
        label="Ouvrir la navigation"
        className={styles.hamburger}
        onClick={onOpenDrawer}
      >
        <MenuIcon size={20} />
      </IconButton>

      <button
        type="button"
        className={styles.searchTrigger}
        onClick={() => setPaletteOpen(true)}
        aria-keyshortcuts="Control+K Meta+K"
        aria-label="Rechercher (Ctrl+K)"
      >
        <SearchIcon size={16} />
        <span className={styles.searchPlaceholder}>Rechercher un patient, un médecin, une facture…</span>
        <kbd className={styles.kbd} aria-hidden="true">
          <CommandIcon size={11} />K
        </kbd>
      </button>

      <div className={styles.actions}>
        <IconButton
          variant="ghost"
          label={isDark ? 'Passer en thème clair' : 'Passer en thème sombre'}
          onClick={() => setPreference(isDark ? 'light' : 'dark')}
        >
          {isDark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
        </IconButton>

        <div ref={notificationsRef} className={styles.popoverHost}>
          <IconButton
            variant="ghost"
            label="Notifications"
            aria-expanded={notificationsOpen}
            aria-haspopup="true"
            onClick={() => setNotificationsOpen((open) => !open)}
          >
            <BellIcon size={18} />
          </IconButton>
          {notificationsOpen && (
            <div className={styles.popover}>
              <NotificationCenter role={user?.role} userId={user?.id} />
            </div>
          )}
        </div>

        <div ref={userMenuRef} className={styles.popoverHost}>
          <button
            type="button"
            className={styles.userButton}
            aria-expanded={userMenuOpen}
            aria-haspopup="true"
            onClick={() => setUserMenuOpen((open) => !open)}
          >
            <Avatar name={user?.username ?? '?'} size="sm" />
            <span className={styles.userMeta}>
              <span className={styles.userName}>{user?.username ?? 'Compte'}</span>
              <span className={styles.userRole}>{user?.role ?? ''}</span>
            </span>
            <ChevronDownIcon size={14} />
          </button>
          {userMenuOpen && (
            <div className={styles.popover} role="menu" aria-label="Menu utilisateur">
              <p className={styles.menuLabel}>Thème</p>
              <div className={styles.themeOptions} role="radiogroup" aria-label="Thème de l'interface">
                {THEME_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={preference === option.value}
                    className={`${styles.themeOption} ${preference === option.value ? styles.themeOptionActive : ''}`}
                    onClick={() => setPreference(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <hr className={styles.menuDivider} />
              <Button
                variant="ghost"
                iconLeft={<LogOutIcon size={16} />}
                className={styles.logoutButton}
                onClick={() => {
                  setUserMenuOpen(false);
                  setConfirmLogout(true);
                }}
              >
                Se déconnecter
              </Button>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={handleLogout}
        title="Se déconnecter ?"
        confirmLabel="Se déconnecter"
        tone="danger"
      >
        Vous devrez vous reconnecter pour accéder au dossier patient.
      </ConfirmDialog>
    </header>
  );
};

TopBar.displayName = 'TopBar';
export default TopBar;
