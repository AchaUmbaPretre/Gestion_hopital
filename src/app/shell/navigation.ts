/**
 * NAVIGATION — source unique de vérité du menu latéral.
 * Réplique les rôles de l'ancien SideBar.jsx (migration sans
 * régression). Phase 1 RDC : la palette ⌘K est RETIRÉE (les boutons
 * visibles de l'accueil RDC = hub) — QUICK_ACTIONS supprimées.
 */
import type { ComponentType } from 'react';
import type { IconProps } from '../../design-system/foundation/icons';
import {
  HomeIcon,
  UsersIcon,
  UserPlusIcon,
  GridIcon,
  ClipboardPlusIcon,
  ClipboardListIcon,
  FlaskIcon,
  LogInIcon,
  CalendarIcon,
  PillIcon,
  PackageIcon,
  FileTextIcon,
  DollarSignIcon,
  CreditCardIcon,
  UserIcon,
  BarChartIcon,
  SlidersIcon,
  ClockIcon,
} from '../../design-system/foundation/icons';

export type UserRole =
  | 'ADMINISTRATEUR'
  | 'RECEPTIONNISTE'
  | 'DOCTEUR'
  | 'TECHNICIEN';

export interface NavLinkItem {
  key: string;
  label: string;
  path: string;
  icon: ComponentType<IconProps>;
  roles: UserRole[];
  /** Entrée sans route réelle côté API/router (héritage). */
  disabled?: boolean;
}

export interface NavGroupItem {
  key: string;
  label: string;
  icon: ComponentType<IconProps>;
  roles: UserRole[];
  children: NavLinkItem[];
}

export type NavEntry = NavLinkItem | NavGroupItem;

/** Filtre par rôle : un groupe disparaît si aucun enfant n'est permis. */
export function filterNavByRole(entries: NavEntry[], role: string | undefined): NavEntry[] {
  if (!role) return [];
  return entries
    .map((entry) => {
      if ('children' in entry) {
        const children = entry.children.filter((child) => child.roles.includes(role as UserRole));
        return children.length > 0 ? { ...entry, children } : null;
      }
      return entry.roles.includes(role as UserRole) ? entry : null;
    })
    .filter((entry): entry is NavEntry => entry !== null);
}

export const NAV_ENTRIES: NavEntry[] = [
  { key: 'home', label: 'Accueil', path: '/', icon: HomeIcon, roles: ['ADMINISTRATEUR', 'RECEPTIONNISTE', 'DOCTEUR', 'TECHNICIEN'] },
  // Ancien tableau de bord : conservé pour cohabitation (phase 7
  // décidera de son retrait) — ne JAMAIS laisser d'orphelin.
  { key: 'dashboard', label: 'Tableau de bord (hérité)', path: '/dashboard', icon: BarChartIcon, roles: ['ADMINISTRATEUR'] },
  {
    key: 'personnel',
    label: 'Personnel médical',
    icon: UsersIcon,
    roles: ['ADMINISTRATEUR'],
    children: [
      { key: 'form_personnel', label: 'Nouveau personnel', path: '/form_personnel', icon: UserPlusIcon, roles: ['ADMINISTRATEUR'] },
      { key: 'liste_docteur', label: 'Liste des personnels', path: '/liste_docteur', icon: UsersIcon, roles: ['ADMINISTRATEUR'] },
    ],
  },
  {
    key: 'patient',
    label: 'Patient',
    icon: UserIcon,
    roles: ['ADMINISTRATEUR', 'RECEPTIONNISTE'],
    children: [
      { key: 'form_patient', label: 'Nouveau patient', path: '/form_patient', icon: UserPlusIcon, roles: ['ADMINISTRATEUR', 'RECEPTIONNISTE'] },
      { key: 'liste_patient', label: 'Liste des patients', path: '/liste_patient', icon: UserIcon, roles: ['ADMINISTRATEUR', 'RECEPTIONNISTE'] },
    ],
  },
  {
    key: 'service',
    label: 'Service',
    icon: GridIcon,
    roles: ['ADMINISTRATEUR'],
    children: [
      { key: 'liste_service', label: 'Liste des services', path: '/liste_service', icon: GridIcon, roles: ['ADMINISTRATEUR'] },
    ],
  },
  {
    key: 'consultation',
    label: 'Consultation',
    icon: ClipboardPlusIcon,
    roles: ['ADMINISTRATEUR', 'DOCTEUR'],
    children: [
      { key: 'nouvelle_consultation', label: 'Nouvelle consultation', path: '/consultation', icon: ClipboardPlusIcon, roles: ['ADMINISTRATEUR', 'DOCTEUR'] },
      { key: 'liste_consultation', label: 'Liste des consultations', path: '/liste_consultation', icon: ClipboardListIcon, roles: ['ADMINISTRATEUR', 'DOCTEUR'] },
    ],
  },
  { key: 'labo', label: 'Laboratoire', path: '/labo', icon: FlaskIcon, roles: ['ADMINISTRATEUR', 'TECHNICIEN'] },
  { key: 'prescription_labo', label: 'Prescription labo', path: '/prescription_labo', icon: ClipboardListIcon, roles: ['ADMINISTRATEUR', 'TECHNICIEN'] },
  { key: 'admission', label: 'Admission', path: '/admission', icon: LogInIcon, roles: ['ADMINISTRATEUR', 'RECEPTIONNISTE'] },
  { key: 'rdv', label: 'Rendez-vous', path: '/liste_rdv', icon: CalendarIcon, roles: ['ADMINISTRATEUR', 'RECEPTIONNISTE', 'DOCTEUR'] },
  { key: 'traitement', label: 'Traitement', path: '/traitement', icon: PillIcon, roles: ['ADMINISTRATEUR', 'DOCTEUR'] },
  { key: 'medicament', label: 'Médicament', path: '/medicament', icon: PackageIcon, roles: ['ADMINISTRATEUR', 'DOCTEUR'] },
  { key: 'ordonnance', label: 'Ordonnance', path: '/ordonnance', icon: FileTextIcon, roles: ['ADMINISTRATEUR', 'DOCTEUR'] },
  {
    key: 'paiement',
    label: 'Paiement',
    icon: DollarSignIcon,
    roles: ['ADMINISTRATEUR', 'DOCTEUR'],
    children: [
      { key: 'paiements_attente', label: 'Paiements en attente', path: '/paiement', icon: DollarSignIcon, roles: ['ADMINISTRATEUR', 'DOCTEUR'] },
      // Route héritée sans destination réelle : conservée pour parité,
      // désactivée (affichée mais non cliquable).
      { key: 'historique_paiement', label: 'Historique des paiements', path: '/historique_paiement', icon: ClockIcon, roles: ['ADMINISTRATEUR', 'DOCTEUR'], disabled: true },
    ],
  },
  {
    key: 'facturation',
    label: 'Facturation',
    icon: CreditCardIcon,
    roles: ['ADMINISTRATEUR'],
    children: [
      { key: 'liste_factures', label: 'Liste des factures', path: '/factures', icon: CreditCardIcon, roles: ['ADMINISTRATEUR'] },
    ],
  },
  {
    key: 'utilisateur',
    label: 'Utilisateur',
    icon: UserIcon,
    roles: ['ADMINISTRATEUR'],
    children: [
      { key: 'liste_user', label: 'Liste des utilisateurs', path: '/liste_user', icon: UsersIcon, roles: ['ADMINISTRATEUR'] },
    ],
  },
  {
    key: 'rapports',
    label: 'Rapports',
    icon: BarChartIcon,
    roles: ['ADMINISTRATEUR'],
    children: [
      { key: 'rapports_activite', label: "Rapports d'activité", path: '/rapports_activite', icon: BarChartIcon, roles: ['ADMINISTRATEUR'], disabled: true },
      { key: 'stats_patients', label: 'Statistiques des patients', path: '/stats_patients', icon: BarChartIcon, roles: ['ADMINISTRATEUR'], disabled: true },
    ],
  },
  { key: 'parametres', label: 'Paramètres', path: '/parametres', icon: SlidersIcon, roles: ['ADMINISTRATEUR'], disabled: true },
];
