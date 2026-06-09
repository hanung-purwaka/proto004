import { LEVEL_STORAGE_KEY, clampLevelIndex, levels } from '../data/levels';

const hasStorage = (): boolean => typeof window !== 'undefined' && 'localStorage' in window;

export const getSavedLevelIndex = (): number => {
  if (!hasStorage()) {
    return 0;
  }

  const rawValue = window.localStorage.getItem(LEVEL_STORAGE_KEY);
  if (!rawValue) {
    return 0;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    window.localStorage.removeItem(LEVEL_STORAGE_KEY);
    return 0;
  }

  return clampLevelIndex(parsed);
};

export const saveLevelIndex = (levelIndex: number): void => {
  if (!hasStorage()) {
    return;
  }

  window.localStorage.setItem(LEVEL_STORAGE_KEY, String(clampLevelIndex(levelIndex)));
};

export const getNextLevelIndex = (levelIndex: number): number => (clampLevelIndex(levelIndex) + 1) % levels.length;
