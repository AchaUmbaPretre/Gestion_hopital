import { act, renderHook } from '@testing-library/react';
import { useDraftAutosave } from './useDraftAutosave';

describe('useDraftAutosave', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('écrit le brouillon après le debounce', () => {
    const { result } = renderHook(() => useDraftAutosave<{ nom: string }>('gh.draft.test'));
    act(() => {
      result.current.saveDraft({ nom: 'Kabila' });
      result.current.saveDraft({ nom: 'Kabila Jean' }); // la 1re écriture est annulée
    });
    expect(window.localStorage.getItem('gh.draft.test')).toBeNull();
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(JSON.parse(window.localStorage.getItem('gh.draft.test') ?? '')).toEqual({
      nom: 'Kabila Jean',
    });
  });

  it('charge un brouillon existant', () => {
    window.localStorage.setItem('gh.draft.test2', JSON.stringify({ age: 42 }));
    const { result } = renderHook(() => useDraftAutosave<{ age: number }>('gh.draft.test2'));
    expect(result.current.loadDraft()).toEqual({ age: 42 });
    expect(result.current.loadDraft).not.toBeNull();
  });

  it('clearDraft supprime le brouillon (et annule l’écriture en attente)', () => {
    const { result } = renderHook(() => useDraftAutosave<{ ok: boolean }>('gh.draft.test3'));
    act(() => {
      result.current.saveDraft({ ok: true });
      result.current.clearDraft();
      jest.advanceTimersByTime(1000);
    });
    expect(window.localStorage.getItem('gh.draft.test3')).toBeNull();
  });
});
