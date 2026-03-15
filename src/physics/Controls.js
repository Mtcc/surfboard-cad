/**
 * Controls.js — Input handling with board-type-adaptive descriptions
 *
 * Manages keyboard input and provides context-aware control descriptions
 * that change based on the board type (shortboard vs longboard behavior).
 */

// ═══════════════════════════════════════════════════════════════════════════════
// INPUT STATE
// ═══════════════════════════════════════════════════════════════════════════════

export function createInputState() {
  return {
    leftArrow: false,
    rightArrow: false,
    upArrow: false,
    downArrow: false,
    space: false,
  };
}

/**
 * bind keyboard listeners, returns cleanup function
 */
export function bindControls(inputState) {
  const keyMap = {
    'ArrowLeft': 'leftArrow',
    'ArrowRight': 'rightArrow',
    'ArrowUp': 'upArrow',
    'ArrowDown': 'downArrow',
    ' ': 'space',
  };

  function onKeyDown(e) {
    const key = keyMap[e.key];
    if (key) {
      e.preventDefault();
      inputState[key] = true;
    }
  }

  function onKeyUp(e) {
    const key = keyMap[e.key];
    if (key) {
      e.preventDefault();
      inputState[key] = false;
    }
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // cleanup
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROL DESCRIPTIONS — adapt based on board type
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * returns human-readable descriptions for each control
 * descriptions change based on whether the board is a shortboard or longboard
 *
 * @param {number} lengthM — board length in meters
 */
export function getControlDescriptions(lengthM) {
  const isLongboard = lengthM > 2.4; // > ~8ft

  return {
    leftArrow: isLongboard
      ? 'Turn down the wave. Smooth bottom turn.'
      : 'Turn down the wave (toward beach). Board angles down face, gains speed.',

    rightArrow: isLongboard
      ? 'Turn up the wave. Cutback toward curl.'
      : 'Turn up the wave (toward lip). Sets up maneuvers. Loses speed.',

    upArrow: isLongboard
      ? 'Walk toward nose. Cross-stepping. Noseriding. Trims faster.'
      : 'Front foot pressure. Drives board, accelerates, engages front rail.',

    downArrow: isLongboard
      ? 'Walk toward tail. Slows down. More control. Sets up cutback.'
      : 'Back foot pressure. Pivots tail, snaps turns, stalls for barrel.',

    space: 'Paddle / catch the wave',
  };
}
