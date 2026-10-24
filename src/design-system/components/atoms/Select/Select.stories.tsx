import { Select, type SelectProps } from './Select';
import type { StoryMeta, Story } from '../_story-types';

const SERVICES = [
  { label: 'Médecine générale', value: 'mg' },
  { label: 'Cardiologie', value: 'cardio' },
  { label: 'Pédiatrie', value: 'pedia' },
  { label: 'Gynécologie', value: 'gyneco' },
];

const meta: StoryMeta<SelectProps> = {
  title: 'Design System/Atoms/Select',
  component: Select,
  parameters: { layout: 'padded' },
};
export default meta;

export const Default: Story<SelectProps> = {
  args: { label: 'Service', options: SERVICES },
};

export const WithPlaceholder: Story<SelectProps> = {
  args: {
    label: 'Service',
    options: SERVICES,
    placeholder: 'Choisir un service',
    helperText: 'Le service détermine la tarification de la consultation',
  },
};

export const Error: Story<SelectProps> = {
  args: {
    label: 'Service',
    options: SERVICES,
    placeholder: 'Choisir un service',
    error: 'Ce champ est requis',
  },
};

export const DisabledOption: Story<SelectProps> = {
  args: {
    label: 'Service',
    options: [
      ...SERVICES,
      { label: 'Bloc opératoire (fermé)', value: 'bloc', disabled: true },
    ],
  },
};
