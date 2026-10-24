import { Tooltip, type TooltipProps } from './Tooltip';
import { Button } from '../Button/Button';
import type { StoryMeta, Story } from '../_story-types';

const meta: StoryMeta<TooltipProps> = {
  title: 'Design System/Atoms/Tooltip',
  component: Tooltip,
  parameters: { layout: 'centered' },
  argTypes: {
    position: { control: 'select', options: ['top', 'bottom', 'left', 'right'] },
  },
};
export default meta;

export const Top: Story<TooltipProps> = {
  args: {
    content: 'Numéro de dossier médical',
    position: 'top',
    children: <Button variant="secondary">DM-2024-001</Button>,
  },
};

export const Bottom: Story<TooltipProps> = {
  args: {
    content: 'Impression de l\u2019ordonnance',
    position: 'bottom',
    children: <Button>Imprimer</Button>,
  },
};

export const Positions: Story<TooltipProps> = {
  render: () => (
    <div style={{ display: 'flex', gap: '24px', padding: '40px' }}>
      <Tooltip content="Haut" position="top">
        <Button variant="secondary">Top</Button>
      </Tooltip>
      <Tooltip content="Droite" position="right">
        <Button variant="secondary">Right</Button>
      </Tooltip>
      <Tooltip content="Bas" position="bottom">
        <Button variant="secondary">Bottom</Button>
      </Tooltip>
      <Tooltip content="Gauche" position="left">
        <Button variant="secondary">Left</Button>
      </Tooltip>
    </div>
  ),
};
