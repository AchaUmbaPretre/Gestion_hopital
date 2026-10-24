import { Avatar, type AvatarProps } from './Avatar';
import type { StoryMeta, Story } from '../_story-types';

const meta: StoryMeta<AvatarProps> = {
  title: 'Design System/Atoms/Avatar',
  component: Avatar,
  parameters: { layout: 'centered' },
};
export default meta;

export const Initials: Story<AvatarProps> = {
  args: { name: 'Marie Dupont' },
};

export const WithImage: Story<AvatarProps> = {
  args: { name: 'Dr Prêcheur Acha Umba', src: '/logo512.png' },
};

export const DoctorOnline: Story<AvatarProps> = {
  args: { name: 'Dr Sankara', status: 'online' },
};

export const Sizes: Story<AvatarProps> = {
  render: () => (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
      <Avatar name="A" size="xs" />
      <Avatar name="B" size="sm" />
      <Avatar name="C" size="md" />
      <Avatar name="D" size="lg" />
      <Avatar name="E" size="xl" />
    </div>
  ),
};

export const AllStatuses: Story<AvatarProps> = {
  render: () => (
    <div style={{ display: 'flex', gap: '12px' }}>
      <Avatar name="En ligne" status="online" />
      <Avatar name="Occupé" status="busy" />
      <Avatar name="Absent" status="away" />
      <Avatar name="Hors ligne" status="offline" />
    </div>
  ),
};
