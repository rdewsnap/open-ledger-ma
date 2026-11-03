export const SITE = {
  name: 'Open Ledger MA',
  domain: 'openledgerma.org',
  tagline: 'The Massachusetts budget, in plain sight.',
  /** Public source repository. */
  github: 'https://github.com/rdewsnap/open-ledger-ma',
  comptroller: 'https://cthru.data.socrata.com/',
} as const;

/** Human names for CTHRU datasets; falls back to the name in meta.json. */
export const DATASET_NAMES: Record<string, string> = {
  'kv7m-35wn': 'CTHRU Budget-to-Actual',
  'kcy7-ivxi': 'CTHRU Revenue Collections',
};
