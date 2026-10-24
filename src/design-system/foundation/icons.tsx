/**
 * ICONS — bibliothèque SVG inline du design system (étape 3).
 * Zéro dépendance : remplace @ant-design/icons (qui tire ~100 KB).
 * Style : trait 1.75px, currentColor, aria-hidden par défaut (les
 * libellés accessibles portent le sens ; pour une icône informative,
 * passer aria-hidden={false} + <title> via props SVG).
 */
import type { ReactNode, SVGProps } from 'react';

export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function makeIcon(displayName: string, content: ReactNode) {
  const Icon = ({ size = 20, ...rest }: IconProps) => (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {content}
    </svg>
  );
  Icon.displayName = displayName;
  return Icon;
}

// ---------- Navigation & actions ----------
export const HomeIcon = makeIcon('HomeIcon', <path d="M3 10.5 12 3l9 7.5" />);
export const SearchIcon = makeIcon('SearchIcon', <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>);
export const PlusIcon = makeIcon('PlusIcon', <path d="M12 5v14M5 12h14" />);
export const XIcon = makeIcon('XIcon', <path d="M18 6 6 18M6 6l12 12" />);
export const MenuIcon = makeIcon('MenuIcon', <path d="M4 6h16M4 12h16M4 18h16" />);
export const ArrowLeftIcon = makeIcon('ArrowLeftIcon', <><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>);
export const CheckIcon = makeIcon('CheckIcon', <path d="M20 6 9 17l-5-5" />);
export const ChevronDownIcon = makeIcon('ChevronDownIcon', <path d="m6 9 6 6 6-6" />);
export const ChevronRightIcon = makeIcon('ChevronRightIcon', <path d="m9 18 6-6-6-6" />);
export const ChevronLeftIcon = makeIcon('ChevronLeftIcon', <path d="m15 18-6-6 6-6" />);
export const PanelLeftIcon = makeIcon('PanelLeftIcon', <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></>);
export const LogOutIcon = makeIcon('LogOutIcon', <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>);
export const CommandIcon = makeIcon('CommandIcon', <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />);

// ---------- Thème ----------
export const SunIcon = makeIcon('SunIcon', <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" /></>);
export const MoonIcon = makeIcon('MoonIcon', <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />);

// ---------- Notifications ----------
export const BellIcon = makeIcon('BellIcon', <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>);
export const ActivityIcon = makeIcon('ActivityIcon', <path d="M22 12h-4l-3 8-6-16-3 8H2" />);
export const ClockIcon = makeIcon('ClockIcon', <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);

// ---------- Statuts (Toast, alertes cliniques) ----------
export const CheckCircleIcon = makeIcon('CheckCircleIcon', <><circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.5 2.5 5-5.5" /></>);
export const AlertTriangleIcon = makeIcon('AlertTriangleIcon', <><path d="m10.3 3.9-8 13.8A2 2 0 0 0 4 20.8h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>);
export const InfoIcon = makeIcon('InfoIcon', <><circle cx="12" cy="12" r="9" /><path d="M12 8h.01" /><path d="M12 12v4" /></>);
export const XCircleIcon = makeIcon('XCircleIcon', <><circle cx="12" cy="12" r="9" /><path d="m15 9-6 6m0-6 6 6" /></>);

// ---------- Métier (sidebar, palette ⌘K) ----------
export const UsersIcon = makeIcon('UsersIcon', <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>);
export const UserIcon = makeIcon('UserIcon', <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>);
export const UserPlusIcon = makeIcon('UserPlusIcon', <><path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6M23 11h-6" /></>);
export const GridIcon = makeIcon('GridIcon', <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>);
export const ClipboardPlusIcon = makeIcon('ClipboardPlusIcon', <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 2h6v4H9z" /><path d="M12 10v6M9 13h6" /></>);
export const ClipboardListIcon = makeIcon('ClipboardListIcon', <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 2h6v4H9z" /><path d="M9 12h6M9 16h4" /></>);
export const FlaskIcon = makeIcon('FlaskIcon', <><path d="M10 2v6L4.5 18a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 8V2" /><path d="M8.5 2h7" /><path d="M7 15h10" /></>);
export const LogInIcon = makeIcon('LogInIcon', <><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="m10 17 5-5-5-5" /><path d="M15 12H3" /></>);
export const CalendarIcon = makeIcon('CalendarIcon', <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 9h18" /></>);
export const PillIcon = makeIcon('PillIcon', <><path d="m10.5 20.5 7-7a4.95 4.95 0 1 0-7-7l-7 7a4.95 4.95 0 1 0 7 7Z" /><path d="m8.5 8.5 7 7" /></>);
export const PackageIcon = makeIcon('PackageIcon', <><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></>);
export const FileTextIcon = makeIcon('FileTextIcon', <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M16 13H8M16 17H8" /></>);
export const DollarSignIcon = makeIcon('DollarSignIcon', <><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>);
export const CreditCardIcon = makeIcon('CreditCardIcon', <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>);
export const SlidersIcon = makeIcon('SlidersIcon', <><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" /><path d="M1 14h6M9 8h6M17 16h6" /></>);
export const BarChartIcon = makeIcon('BarChartIcon', <><path d="M3 3v18h18" /><path d="M8 17v-6M13 17V7M18 17v-3" /></>);
export const BuildingIcon = makeIcon('BuildingIcon', <><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M12 8v6M9 11h6" /></>);
export const InboxIcon = makeIcon('InboxIcon', <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" /></>);

// ---------- Tendances (StatCard) ----------
export const TrendingUpIcon = makeIcon('TrendingUpIcon', <><path d="m3 17 6-6 4 4 8-8" /><path d="M14 7h7v7" /></>);
export const TrendingDownIcon = makeIcon('TrendingDownIcon', <><path d="m3 7 6 6 4-4 8 8" /><path d="M14 17h7v-7" /></>);
export const TrendingFlatIcon = makeIcon('TrendingFlatIcon', <path d="M3 12h18" />);
