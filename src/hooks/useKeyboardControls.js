/**
 * @module useKeyboardControls
 * @description A custom hook that handles keyboard controls for the tournament interface.
 * This is now a wrapper around the KeyboardControlsContext for backward compatibility.
 * New components should use the useKeyboardControls hook from contexts directly.
 * 
 * @deprecated Use the useKeyboardControls hook from contexts instead
 */

import { useEffect } from 'react';
import { useKeyboardControls as useKeyboardControlsInternal } from '../contexts';

export function useKeyboardControls({
  onLeft,
  onRight,
  onBoth,
  onNone,
  onUndo,
  isDisabled = false
}) {
  const { registerHandlers, toggleControls } = useKeyboardControlsInternal();

  useEffect(() => {
    toggleControls(isDisabled);
  }, [isDisabled, toggleControls]);

  useEffect(() => {
    return registerHandlers({
      onLeft,
      onRight,
      onBoth,
      onNone,
      onUndo
    });
  }, [onLeft, onRight, onBoth, onNone, onUndo, registerHandlers]);
} 