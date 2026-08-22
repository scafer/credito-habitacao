// ── CONFIG CONSTANTS ───────────────────────────────────────────
const CONFIG = {
  // App versions and storage
  APP_VERSION: '2.1.0',
  LS_KEY: 'loan_tracker_v2',

  // EURIBOR tenor values (in months)
  EURIBOR_TENORS: [3, 6, 12],
  EURIBOR_TENOR_LABELS: { 3: 'Euribor 3M', 6: 'Euribor 6M', 12: 'Euribor 12M' },

  // Chart.js instance names
  CHARTS: {
    CAPITAL: 'capitalChartInstance',
    INTEREST: 'interestChartInstance',
    SCENARIOS: 'scenariosChartInstance'
  },

  // Table rendering config
  TABLE: {
    INITIAL_ROWS: 36,
    PAGE_SIZE: 60,
    MAX_VISIBLE_ROWS: 1000
  },

  // Prepayment penalty defaults (contractual conventions)
  PREPAYMENT_PENALTY: {
    VARIABLE_RATE: 0.005, // 0.5% as rate for variable rate loans
    FIXED_RATE: 0.02      // 2% as flat fee for fixed rate loans
  },

  // Form validation hints
  FORM_HINTS: {
    MIN_LOAN_AMOUNT: 1000,
    MAX_LOAN_AMOUNT: 500000,
    MIN_TERM_YEARS: 1,
    MAX_TERM_YEARS: 60,
    MIN_FIXED_MONTHS: 12,
    MAX_FIXED_MONTHS: 300
  },

  // Date/time formatting defaults
  DATE_FORMAT: {
    SHORT_DATE: { day: 'numeric', month: 'short', year: 'numeric' },
    FULL_DATE: { day: 'numeric', month: 'long', year: 'numeric' },
    TIME_12H: { hour: 'numeric', minute: '2-digit', hour12: true }
  },

  // Accessibility defaults
  ARIA: {
    LOADING: 'aria-busy="true"',
    ERROR: 'role="alert"',
    DIALOG: {
      TITLE: 'aria-labelledby="dialog-title"',
      CLOSE: 'aria-haspopup="dialog"'
    }
  },

  // Storage limits (localStorage is typically 5-10MB)
  STORAGE: {
    MAX_SIZE_MB: 8,
    MAX_ITEMS_PER_KEY: 1000
  }
};
