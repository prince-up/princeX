import { useState } from 'react';

const MobileControls = ({ onKeyPress, onSpecialKey }) => {
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [shiftPressed, setShiftPressed] = useState(false);
  const [ctrlPressed, setCtrlPressed] = useState(false);
  const [altPressed, setAltPressed] = useState(false);

  const specialKeys = [
    { label: 'Ctrl', key: 'Control', modifier: 'ctrl' },
    { label: 'Alt', key: 'Alt', modifier: 'alt' },
    { label: 'Shift', key: 'Shift', modifier: 'shift' },
    { label: 'Tab', key: 'Tab' },
    { label: '⌫', key: 'Backspace' },
    { label: '⏎', key: 'Enter' },
    { label: 'Esc', key: 'Escape' },
    { label: 'Del', key: 'Delete' },
  ];

  const arrowKeys = [
    { label: '↑', key: 'ArrowUp' },
    { label: '↓', key: 'ArrowDown' },
    { label: '←', key: 'ArrowLeft' },
    { label: '→', key: 'ArrowRight' },
  ];

  const handleModifierToggle = (modifier) => {
    if (modifier === 'ctrl') setCtrlPressed(!ctrlPressed);
    if (modifier === 'alt') setAltPressed(!altPressed);
    if (modifier === 'shift') setShiftPressed(!shiftPressed);
  };

  const handleKeyPress = (key, modifier) => {
    if (modifier) {
      handleModifierToggle(modifier);
      return;
    }

    onSpecialKey({
      key,
      ctrlKey: ctrlPressed,
      altKey: altPressed,
      shiftKey: shiftPressed,
    });

    // Reset modifiers after key press (except for sticky modifiers)
    setTimeout(() => {
      setCtrlPressed(false);
      setAltPressed(false);
      setShiftPressed(false);
    }, 100);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-white/10 p-4 z-50">
      {/* Toggle Keyboard Button */}
      <button
        onClick={() => setShowKeyboard(!showKeyboard)}
        className="w-full mb-4 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl text-sm font-bold"
      >
        {showKeyboard ? '⌨️ Hide Keyboard' : '⌨️ Show Keyboard'}
      </button>

      {showKeyboard && (
        <div className="space-y-3">
          {/* Special Keys */}
          <div className="grid grid-cols-4 gap-2">
            {specialKeys.map((key) => (
              <button
                key={key.label}
                onClick={() => handleKeyPress(key.key, key.modifier)}
                className={`py-3 px-2 rounded-lg text-xs font-bold transition-all ${
                  (key.modifier === 'ctrl' && ctrlPressed) ||
                  (key.modifier === 'alt' && altPressed) ||
                  (key.modifier === 'shift' && shiftPressed)
                    ? 'bg-green-600 text-white'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {key.label}
              </button>
            ))}
          </div>

          {/* Arrow Keys */}
          <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
            <div></div>
            <button
              onClick={() => handleKeyPress('ArrowUp')}
              className="py-4 bg-white/10 text-white rounded-lg text-xl hover:bg-white/20"
            >
              ↑
            </button>
            <div></div>
            <button
              onClick={() => handleKeyPress('ArrowLeft')}
              className="py-4 bg-white/10 text-white rounded-lg text-xl hover:bg-white/20"
            >
              ←
            </button>
            <button
              onClick={() => handleKeyPress('ArrowDown')}
              className="py-4 bg-white/10 text-white rounded-lg text-xl hover:bg-white/20"
            >
              ↓
            </button>
            <button
              onClick={() => handleKeyPress('ArrowRight')}
              className="py-4 bg-white/10 text-white rounded-lg text-xl hover:bg-white/20"
            >
              →
            </button>
          </div>

          {/* Quick Text Input */}
          <input
            type="text"
            placeholder="Type here..."
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace') {
                onKeyPress(e);
              }
            }}
            className="w-full bg-white/10 text-white px-4 py-3 rounded-lg border border-white/20 focus:outline-none focus:border-indigo-500"
          />

          {/* Common Shortcuts */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleKeyPress('c', 'ctrl')}
              className="py-2 bg-white/5 text-white/70 rounded-lg text-xs hover:bg-white/10"
            >
              Ctrl+C (Copy)
            </button>
            <button
              onClick={() => handleKeyPress('v', 'ctrl')}
              className="py-2 bg-white/5 text-white/70 rounded-lg text-xs hover:bg-white/10"
            >
              Ctrl+V (Paste)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileControls;
