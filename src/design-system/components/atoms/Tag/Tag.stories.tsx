import { Tag, type TagProps } from './Tag';
import type { StoryMeta, Story } from '../_story-types';

const meta: StoryMeta<TagProps> = {
  title: 'Design System/Atoms/Tag',
  component: Tag,
  parameters: { layout: 'centered' },
};
export default meta;

export const Simple: Story<TagProps> = {
  args: { children: 'Cardiologie' },
};

export const Removable: Story<TagProps> = {
  args: { children: 'Allergie pénicilline', onRemove: () => {} },
};

export const AllergyDanger: Story<TagProps> = {
  args: { variant: 'danger', children: 'Pénicilline', onRemove: () => {} },
};

export const FilterChips: Story<TagProps> = {
  render: () => (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      <Tag variant="primary" onRemove={() => {}}>
        Service : Cardiologie
      </Tag>
      <Tag variant="primary" onRemove={() => {}}>
        Statut : En attente
      </Tag>
      <Tag>＋ Ajouter un filtre</Tag>
    </div>
  ),
};
