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

  // Validate numeric input within bounds
  validateNumber: (value, min = -Infinity, max = Infinity) => {
    const num = parseFloat(value);
    if (isNaN(num)) return null;
    if (num < min) return min;
    if (num > max) return max;
    return num;
  },

  // Clamp value between min and max
  clamp: (value, min, max) => {
    return Math.min(Math.max(value, min), max);
  },

  // Truncate string to maxLength with ellipsis
  truncateString: (str, maxLength = 50) => {
    if (!str || str.length <= maxLength) return str;
    return str.slice(0, maxLength).trim() + '…';
  },

  // Normalize rate percentage string to decimal (e.g., "2.5%" -> 0.025)
  parseRate: (rateStr) => {
    if (!rateStr) return 0;
    const clean = rateStr.replace(/[^0-9.-]/g, '');
    return parseFloat(clean) || 0;
  },

  // Format date for display
  formatDate: (dateObj, locale = 'pt-PT') => {
    if (!dateObj || isNaN(dateObj.getTime())) return '—';
    return new Date(dateObj).toLocaleDateString(locale);
  },

  // Calculate months between two dates
  monthsDifference: (date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const yearDiff = d2.getFullYear() - d1.getFullYear();
    const monthDiff = (d2.getMonth() + yearDiff * 12) - d1.getMonth();
    return Math.max(0, monthDiff);
  },

  // Round to specific decimal places
  round: (value, decimals = 2) => {
    if (!value || isNaN(value)) return 0;
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  },

  // Escape HTML to prevent XSS when inserting user content
  escapeHtml: (unsafe) => {
    if (typeof unsafe !== 'string') return String(unsafe || '');
    const div = document.createElement('div');
    div.textContent = unsafe;
    return div.innerHTML;
  },

  // Generate unique ID
  generateId: () => '_' + Math.random().toString(36).substr(2, 9),

  // Check if array is empty or contains only null/undefined
  isEmpty: (arr) => !Array.isArray(arr) || arr.length === 0 || arr.every(v => v == null)
};