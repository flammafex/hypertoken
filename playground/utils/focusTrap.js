const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function trapFocus(modalElement) {
  const focusable = modalElement.querySelectorAll(FOCUSABLE);
  if (focusable.length === 0) return () => {};

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const previouslyFocused = document.activeElement;

  first.focus();

  function handleKeyDown(e) {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  modalElement.addEventListener('keydown', handleKeyDown);

  return () => {
    modalElement.removeEventListener('keydown', handleKeyDown);
    previouslyFocused?.focus();
  };
}
