import { Input, type InputProps } from './Input';
import type { StoryMeta, Story } from '../_story-types';

const meta: StoryMeta<InputProps> = {
  title: 'Design System/Atoms/Input',
  component: Input,
  parameters: { layout: 'padded' },
};
export default meta;

export const Default: Story<InputProps> = {
  args: { label: 'Nom du patient', placeholder: 'ex. : Jean Dupont' },
};

export const Required: Story<InputProps> = {
  args: {
    label: 'Numéro de sécurité sociale',
    placeholder: '15 chiffres',
    helperText: 'Sans espaces, format 1 84 12 76 451 089 12',
    required: true,
  },
};

export const Error: Story<InputProps> = {
  args: {
    label: 'Numéro de sécurité sociale',
    defaultValue: '1841276',
    error:
      'Le numéro de sécurité sociale doit contenir 15 chiffres. Vérifiez la saisie.',
  },
};

export const Disabled: Story<InputProps> = {
  args: { label: 'Dossier verrouillé', value: 'DM-2024-001', disabled: true },
};

export const HiddenLabel: Story<InputProps> = {
  args: { label: 'Rechercher un patient', hideLabel: true, placeholder: 'Rechercher…' },
};

export const Sizes: Story<InputProps> = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <Input label="Petit" inputSize="sm" />
      <Input label="Moyen" inputSize="md" />
      <Input label="Grand" inputSize="lg" />
    </div>
  ),
};
