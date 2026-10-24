import { Spinner, type SpinnerProps } from './Spinner';
import type { StoryMeta, Story } from '../_story-types';

const meta: StoryMeta<SpinnerProps> = {
  title: 'Design System/Atoms/Spinner',
  component: Spinner,
  parameters: { layout: 'centered' },
};
export default meta;

export const Default: Story<SpinnerProps> = {
  args: {},
};

export const Sizes: Story<SpinnerProps> = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
      <Spinner size="xs" />
      <Spinner size="sm" />
      <Spinner size="md" />
      <Spinner size="lg" />
    </div>
  ),
};

export const InContext: Story<SpinnerProps> = {
  render: () => (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <Spinner size="sm" decorative />
      <span>Import du dossier patient…</span>
    </div>
  ),
};
