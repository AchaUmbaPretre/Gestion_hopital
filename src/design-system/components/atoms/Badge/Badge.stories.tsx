import { Badge, type BadgeProps } from './Badge';
import type { StoryMeta, Story } from '../_story-types';

const meta: StoryMeta<BadgeProps> = {
  title: 'Design System/Atoms/Badge',
  component: Badge,
  parameters: { layout: 'centered' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['neutral', 'primary', 'success', 'warning', 'danger', 'info'],
    },
  },
};
export default meta;

export const Stable: Story<BadgeProps> = {
  args: { variant: 'success', dot: true, children: 'Stable' },
};

export const Critical: Story<BadgeProps> = {
  args: { variant: 'danger', dot: true, children: 'Allergies sévères' },
};

export const Pending: Story<BadgeProps> = {
  args: { variant: 'warning', dot: true, children: 'RDV à venir' },
};

export const Labo: Story<BadgeProps> = {
  args: { variant: 'info', children: 'Analyse en cours' },
};

export const Unpaid: Story<BadgeProps> = {
  args: { variant: 'primary', children: 'Impayée' },
};

export const Archived: Story<BadgeProps> = {
  args: { variant: 'neutral', children: 'Archivé' },
};

export const AllVariants: Story<BadgeProps> = {
  render: () => (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      <Badge variant="neutral">Archivé</Badge>
      <Badge variant="primary">Impayée</Badge>
      <Badge variant="success">Payée</Badge>
      <Badge variant="warning">En attente</Badge>
      <Badge variant="danger">Critique</Badge>
      <Badge variant="info">En cours</Badge>
    </div>
  ),
};
