// ============================================================
// ATOMS — Design System Gestion_hopital
// Barrel d'export. Importer via :
//   import { Button, Badge, … } from 'design-system/components/atoms';
// (alias à configurer avec CRA : jsconfig/tsconfig paths + CRACO
//  — en attendant, chemins relatifs)
// ============================================================

export { default as Button } from './Button/Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button/Button';

export { default as IconButton } from './IconButton/IconButton';
export type {
  IconButtonProps,
  IconButtonVariant,
  IconButtonSize,
  IconButtonShape,
} from './IconButton/IconButton';

export { default as Input } from './Input/Input';
export type { InputProps, InputSize } from './Input/Input';

export { default as Select } from './Select/Select';
export type {
  SelectProps,
  SelectOptionItem,
  SelectSize,
} from './Select/Select';

export { default as Badge } from './Badge/Badge';
export type { BadgeProps, BadgeVariant, BadgeSize } from './Badge/Badge';

export { default as Tag } from './Tag/Tag';
export type { TagProps, TagVariant } from './Tag/Tag';

export { default as Avatar } from './Avatar/Avatar';
export type { AvatarProps, AvatarSize, AvatarStatus } from './Avatar/Avatar';

export { default as Spinner } from './Spinner/Spinner';
export type { SpinnerProps, SpinnerSize } from './Spinner/Spinner';

export { default as Skeleton } from './Skeleton/Skeleton';
export type { SkeletonProps, SkeletonVariant } from './Skeleton/Skeleton';

export { default as Tooltip } from './Tooltip/Tooltip';
export type {
  TooltipProps,
  TooltipPosition,
  TooltipTriggerProps,
} from './Tooltip/Tooltip';
