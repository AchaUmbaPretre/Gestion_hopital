/**
 * Types Storybook CSF3 locaux (ADR-003).
 *
 * Les stories sont écrites au format CSF3 SANS dépendre de @storybook/react :
 *  - Le build CRA compile sans erreur tant que Storybook n'est pas installé.
 *  - Dès que Storybook 8 sera ajouté (voir MIGRATION_PLAN.md), ces fichiers
 *    seront consommés tels quels (Storybook lit les exports runtime).
 *
 * NB : ces types sont structurellement compatibles avec Meta<T> / StoryFn<T>.
 */
import type { ComponentType, ReactNode } from 'react';

export interface StoryMeta<P> {
  title: string;
  component: ComponentType<P>;
  parameters?: Record<string, unknown>;
  argTypes?: Record<string, unknown>;
  args?: Partial<P>;
  tags?: string[];
}

export interface Story<P> {
  name?: string;
  args?: Partial<P>;
  render?: (args: P) => ReactNode;
  parameters?: Record<string, unknown>;
}
