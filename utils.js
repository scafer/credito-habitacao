// ── UTILITY FUNCTIONS ────────────────────────────────────────────────
const Utils = {
  // Format currency with locale-specific formatting
  formatCurrency: (value, lang) => {
    if (value == null || isNaN(value)) return '—';
    const locale = lang === 'en' ? 'en-GB' : 'pt-PT';
    return value.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' €';
  },

  // Format percentage with configurable decimals
  formatPercent: (value, decimals = 3) => {
    if (value == null || isNaN(value)) return '—';
    return value.toFixed(decimals) + '%';
  },

  // Debounce function for input handlers
  debounce: (fn, delay = 250) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  },

  // Escape HTML to prevent XSS when inserting user content
  escapeHtml: (unsafe) => {
    if (typeof unsafe !== 'string') return String(unsafe || '');
    const div = document.createElement('div');
    div.textContent = unsafe;
    return div.innerHTML;
  },

  // Generate unique ID
  generateId: () => '_' + Math.random().toString(36).substr(2, 9)
};
