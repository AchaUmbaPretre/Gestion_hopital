import { Skeleton, type SkeletonProps } from './Skeleton';
import type { StoryMeta, Story } from '../_story-types';

const meta: StoryMeta<SkeletonProps> = {
  title: 'Design System/Atoms/Skeleton',
  component: Skeleton,
  parameters: { layout: 'padded' },
};
export default meta;

export const Text: Story<SkeletonProps> = {
  args: { variant: 'text', width: 240 },
};

export const Circle: Story<SkeletonProps> = {
  args: { variant: 'circular', width: 48, height: 48 },
};

export const Rect: Story<SkeletonProps> = {
  args: { variant: 'rectangular', width: 240, height: 120 },
};

export const Static: Story<SkeletonProps> = {
  args: { variant: 'rectangular', width: 240, height: 80, animated: false },
};

export const PatientCardPlaceholder: Story<SkeletonProps> = {
  render: () => (
    <div style={{ display: 'flex', gap: '12px', width: 320 }}>
      <Skeleton variant="circular" width={48} height={48} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="40%" />
        <Skeleton variant="text" width="80%" />
      </div>
    </div>
  ),
};
