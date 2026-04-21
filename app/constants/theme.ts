import { Platform } from 'react-native';

// ─── Retro Constructivist Palette ────────────────────────────────────────────
// Warm archival surfaces, hunter-green precision, ink-red accents.
export const RC = {
  // Base surfaces
  parchment:  '#F4EDD8',  // primary background — warm cream
  aged:       '#EAE0C8',  // secondary bg / input fill — older paper
  vellum:     '#DDD4B8',  // pressed state / panel tint
  linen:      '#F9F4E8',  // lightest surface

  // Accent colours
  hunter:     '#1C3829',  // primary accent — deep hunter green
  forest:     '#2A5240',  // secondary green
  inkRed:     '#8C1A10',  // destructive / strong accent — ink red
  crimson:    '#B82929',  // error highlight

  // Text
  ink:        '#1E1A14',  // primary text
  graphite:   '#3D3830',  // secondary text
  dust:       '#786F62',  // muted / placeholder

  // Lines & borders
  rule:       '#C4B49A',  // decorative rules / dividers
  heavyRule:  '#3D3830',  // thick accent borders

  // Semantic
  amber:      '#7A5C18',  // cover badge / gold
} as const;

// ── Legacy Colors (kept for themed-* components) ─────────────────────────────
export const Colors = {
  light: {
    text:            RC.ink,
    background:      RC.parchment,
    tint:            RC.hunter,
    icon:            RC.dust,
    tabIconDefault:  RC.dust,
    tabIconSelected: RC.hunter,
  },
  dark: {
    text:            '#ECEDEE',
    background:      '#151718',
    tint:            '#fff',
    icon:            '#9BA1A6',
    tabIconDefault:  '#9BA1A6',
    tabIconSelected: '#fff',
  },
};

// ── Typography ────────────────────────────────────────────────────────────────
export const Fonts = Platform.select({
  ios: {
    sans:    'system-ui',
    serif:   'Georgia',
    mono:    'Courier New',
    rounded: 'ui-rounded',
  },
  default: {
    sans:    'normal',
    serif:   'serif',
    mono:    'monospace',
    rounded: 'normal',
  },
  web: {
    sans:    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    serif:   "Georgia, 'Times New Roman', serif",
    mono:    "'Courier New', Courier, monospace",
    rounded: "'SF Pro Rounded', sans-serif",
  },
});
