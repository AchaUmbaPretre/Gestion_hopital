import { IconButton, type IconButtonProps } from './IconButton';
import type { StoryMeta, Story } from '../_story-types';

const Icon = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M2 8C2 8 4.5 3.5 8 3.5C11.5 3.5 14 8 14 8C14 8 11.5 12.5 8 12.5C4.5 12.5 2 8 2 8Z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const meta: StoryMeta<IconButtonProps> = {
  title: 'Design System/Atoms/IconButton',
  component: IconButton,
  parameters: { layout: 'centered' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'danger', 'subtle'],
    },
    shape: { control: 'select', options: ['square', 'circle'] },
  },
};
export default meta;

export const GhostDefault: Story<IconButtonProps> = {
  args: { label: 'Aperçu du dossier', children: Icon },
};

export const Primary: Story<IconButtonProps> = {
  args: { label: 'Aperçu du dossier', variant: 'primary', children: Icon },
};

export const Danger: Story<IconButtonProps> = {
  args: { label: 'Supprimer la ligne', variant: 'danger', children: Icon },
};

export const Circle: Story<IconButtonProps> = {
  args: {
    label: 'Aperçu du dossier',
    variant: 'secondary',
    shape: 'circle',
    children: Icon,
  },
};

export const Loading: Story<IconButtonProps> = {
  args: { label: 'Enregistrement…', loading: true, children: Icon },
};
