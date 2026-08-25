// ── CONFIG CONSTANTS ───────────────────────────────────────────
const CONFIG = {
  // App version and storage
  APP_VERSION: '2.1.0',
  LS_KEY: 'mortgage_tracker_v1',

  // Table rendering config
  TABLE: {
    INITIAL_ROWS: 36,
    PAGE_SIZE: 60
  },

  // Prepayment penalty defaults (contractual conventions)
  PREPAYMENT_PENALTY: {
    VARIABLE_RATE: 0.005, // 0.5% as rate for variable rate loans
    FIXED_RATE: 0.02      // 2% as flat fee for fixed rate loans
  }
};
