/**
 * DashboardLayout — template des pages « liste/dashboard ».
 * En-tête standardisé (titre + description + actions) : la page
 * n'écrit plus son header à la main → cohérence, clics -50 %.
 */
import type { ReactNode } from 'react';
import styles from './layouts.module.scss';

export interface DashboardLayoutProps {
  title: string;
  description?: string;
  /** Actions d'en-tête (Button principal : « Nouveau patient »). */
  actions?: ReactNode;
  /** Filtres actifs / FilterBar sous le titre. */
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const DashboardLayout = ({
  title,
  description,
  actions,
  toolbar,
  children,
  className,
}: DashboardLayoutProps) => (
  <div className={[styles.page, className].filter(Boolean).join(' ')}>
    <header className={styles.header}>
      <div className={styles.heading}>
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
    {toolbar && <div className={styles.toolbar}>{toolbar}</div>}
    {children}
  </div>
);

// ------------------------------------------------------------
// DetailLayout — fiche détail (patient, facture…) : header sticky
// avec retour + actions, contenu principal + colonne latérale.
// ------------------------------------------------------------
export interface DetailLayoutProps {
  title: string;
  breadcrumb?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  actions?: ReactNode;
  /** Colonne latérale (alertes cliniques, contacts…). */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const DetailLayout = ({
  title,
  breadcrumb,
  onBack,
  backLabel = 'Retour',
  actions,
  aside,
  children,
  className,
}: DetailLayoutProps) => (
  <div className={[styles.page, className].filter(Boolean).join(' ')}>
    <div className={styles.detailHeader}>
      {onBack && (
        <button type="button" className={styles.backButton} onClick={onBack}>
          ← {backLabel}
        </button>
      )}
      {breadcrumb}
    </div>
    <header className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
    <div className={aside ? styles.detailGrid : undefined}>
      <div>{children}</div>
      {aside && <aside className={styles.aside}>{aside}</aside>}
    </div>
  </div>
);

// ------------------------------------------------------------
// FormLayout — formulaires : carte centrée largeur maîtrisée,
// titre + description + pied d'actions (annuler / enregistrer).
// ------------------------------------------------------------
export interface FormLayoutProps {
  title: string;
  description?: string;
  /** Pied de formulaire (boutons annuler / enregistrer). */
  footer?: ReactNode;
  /** 480 (court), 640 (standard), 960 (multi-sections). */
  width?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  className?: string;
}

const WIDTH_CLASS = { sm: styles.formSm, md: styles.formMd, lg: styles.formLg } as const;

export const FormLayout = ({
  title,
  description,
  footer,
  width = 'md',
  children,
  className,
}: FormLayoutProps) => (
  <div className={[styles.formPage, className].filter(Boolean).join(' ')}>
    <form
      className={[styles.formCard, WIDTH_CLASS[width]].join(' ')}
      onSubmit={(event) => event.preventDefault()}
      noValidate
    >
      <h1 className={styles.title}>{title}</h1>
      {description && <p className={styles.description}>{description}</p>}
      <div className={styles.formBody}>{children}</div>
      {footer && <div className={styles.formFooter}>{footer}</div>}
    </form>
  </div>
);

// ------------------------------------------------------------
// AuthLayout — connexion / inscription : split 50/50 calme,
// panneau de marque à gauche (desktop), carte à droite.
// ------------------------------------------------------------
export interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export const AuthLayout = ({ title, subtitle, children, className }: AuthLayoutProps) => (
  <div className={[styles.authPage, className].filter(Boolean).join(' ')}>
    <div className={styles.authBrand} aria-hidden="true">
      <span className={styles.authMark}>H</span>
      <p className={styles.authName}>Hôpital Général de Ndjili</p>
      <p className={styles.authTagline}>
        Le dossier patient, les rendez-vous et la facturation — dans une interface calme.
      </p>
    </div>
    <div className={styles.authPanel}>
      <div className={styles.authCard}>
        <h1 className={styles.authTitle}>{title}</h1>
        {subtitle && <p className={styles.authSubtitle}>{subtitle}</p>}
        {children}
      </div>
    </div>
  </div>
);

DashboardLayout.displayName = 'DashboardLayout';
DetailLayout.displayName = 'DetailLayout';
FormLayout.displayName = 'FormLayout';
AuthLayout.displayName = 'AuthLayout';
