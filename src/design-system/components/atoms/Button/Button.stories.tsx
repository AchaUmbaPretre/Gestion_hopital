import { Button, type ButtonProps } from './Button';
import type { StoryMeta, Story } from '../_story-types';

const meta: StoryMeta<ButtonProps> = {
  title: 'Design System/Atoms/Button',
  component: Button,
  parameters: { layout: 'centered' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'danger', 'subtle'],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
};
export default meta;

export const Primary: Story<ButtonProps> = {
  args: { variant: 'primary', children: 'Enregistrer la consultation' },
};

export const Secondary: Story<ButtonProps> = {
  args: { variant: 'secondary', children: 'Annuler' },
};

export const Ghost: Story<ButtonProps> = {
  args: { variant: 'ghost', children: 'Voir le détail' },
};

export const Danger: Story<ButtonProps> = {
  args: { variant: 'danger', children: 'Supprimer définitivement' },
};

export const Subtle: Story<ButtonProps> = {
  args: { variant: 'subtle', children: 'Nouvelle ordonnance' },
};

export const Loading: Story<ButtonProps> = {
  args: { variant: 'primary', loading: true, children: 'Enregistrement…' },
};

export const Disabled: Story<ButtonProps> = {
  args: { variant: 'primary', disabled: true, children: 'Enregistrer' },
};

export const WithIcons: Story<ButtonProps> = {
  args: {
    variant: 'primary',
    children: 'Nouveau patient',
    iconLeft: <span aria-hidden="true">＋</span>,
  },
};

export const FullWidth: Story<ButtonProps> = {
  args: { variant: 'primary', fullWidth: true, children: 'Se connecter' },
  parameters: { layout: 'padded' },
};

export const Sizes: Story<ButtonProps> = {
  render: () => (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
      <Button size="sm">Petit</Button>
      <Button size="md">Moyen</Button>
      <Button size="lg">Grand</Button>
    </div>
  ),
};
