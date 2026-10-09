import { useState, useCallback, useEffect } from 'react';
import { DRAFT_STORAGE_KEY } from '../config/constants.js';

export function useEventDrafts() {
  const [drafts, setDrafts] = useState([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (stored) {
        setDrafts(JSON.parse(stored)); // eslint-disable-line react-hooks/set-state-in-effect
      }
    } catch (e) {
      console.error('Failed to load drafts:', e);
    }
  }, []);

  const saveDrafts = useCallback((updater) => {
    setDrafts((prevDrafts) => {
      const newDrafts = typeof updater === 'function' ? updater(prevDrafts) : updater;
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(newDrafts));
      } catch (e) {
        console.error('Failed to save drafts:', e);
      }
      return newDrafts;
    });
  }, []);

  const createDraft = useCallback((draft) => {
    const newDraft = {
      ...draft,
      id: Date.now().toString(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    saveDrafts((prev) => [...prev, newDraft]);
    return newDraft;
  }, [saveDrafts]);

  const updateDraft = useCallback((id, updates) => {
    saveDrafts((prev) => prev.map((d) => 
      d.id === id ? { ...d, ...updates, updatedAt: Date.now() } : d
    ));
  }, [saveDrafts]);

  const deleteDraft = useCallback((id) => {
    saveDrafts((prev) => prev.filter((d) => d.id !== id));
  }, [saveDrafts]);

  const getDraft = useCallback((id) => {
    return drafts.find((d) => d.id === id);
  }, [drafts]);

  const clearAllDrafts = useCallback(() => {
    saveDrafts([]);
  }, [saveDrafts]);

  return {
    drafts,
    createDraft,
    updateDraft,
    deleteDraft,
    getDraft,
    clearAllDrafts,
  };
}