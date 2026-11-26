export interface AccentPalette {
  id: string;
  name: string;
  primary: string;
  secondary: string;
}

export const kAccentPalettes: AccentPalette[] = [
  { id: 'emerald', name: 'Emerald Volt', primary: '#00E5A3', secondary: '#38BDF8' },
  { id: 'cyan', name: 'Cyber Cyan', primary: '#06B6D4', secondary: '#6366F1' },
  { id: 'amber', name: 'Amber Sport', primary: '#F59E0B', secondary: '#FB7185' },
  { id: 'crimson', name: 'Crimson Track', primary: '#F43F5E', secondary: '#FB923C' },
  { id: 'cobalt', name: 'Cobalt Touring', primary: '#3B82F6', secondary: '#22D3EE' },
  { id: 'violet', name: 'Violet Flux', primary: '#A855F7', secondary: '#EC4899' },
  { id: 'lime', name: 'Lime Eco', primary: '#84CC16', secondary: '#10B981' },
  { id: 'gold', name: 'Gold Edition', primary: '#EAB308', secondary: '#14B8A6' },
];

export interface GarageLivery {
  id: string;
  name: string;
  bodyColor: string;
  trimColor: string;
}

export const kGarageLiveries: GarageLivery[] = [
  { id: 'stealth_obsidian', name: 'Stealth Obsidian', bodyColor: '#1E293B', trimColor: '#00E5A3' },
  { id: 'arctic_pearl', name: 'Arctic Pearl', bodyColor: '#E2E8F0', trimColor: '#0284C7' },
  { id: 'crimson_gt', name: 'Crimson GT', bodyColor: '#DC2626', trimColor: '#FACC15' },
  { id: 'forest_matte', name: 'Matte Olive', bodyColor: '#365314', trimColor: '#A3E635' },
  { id: 'electric_cobalt', name: 'Electric Cobalt', bodyColor: '#1D4ED8', trimColor: '#22D3EE' },
  { id: 'sunset_copper', name: 'Sunset Copper', bodyColor: '#C2410C', trimColor: '#FDE047' },
];

export interface CockpitColors {
  background: string;
  surfaceCard: string;
  surfaceElevated: string;
  borderSubtle: string;
  textPrimary: string;
  textMuted: string;
  accent: string;
  accentSecondary: string;
  warning: string;
  danger: string;
  regen: string;
  isDark: boolean;
}

export function getPaletteById(id: string): AccentPalette {
  return kAccentPalettes.find((p) => p.id === id) ?? kAccentPalettes[0];
}

export function getLiveryById(id: string): GarageLivery {
  return kGarageLiveries.find((l) => l.id === id) ?? kGarageLiveries[0];
}

export function getCockpitColors(isDark: boolean, accentId: string): CockpitColors {
  const pal = getPaletteById(accentId);
  return {
    background: isDark ? '#0A0E14' : '#F3F6FA',
    surfaceCard: isDark ? '#121822' : '#FFFFFF',
    surfaceElevated: isDark ? '#1A2331' : '#E9EFF6',
    borderSubtle: isDark ? '#253244' : '#D5DFEC',
    textPrimary: isDark ? '#F1F5F9' : '#0F172A',
    textMuted: isDark ? '#8A9BAE' : '#5B6B7C',
    accent: pal.primary,
    accentSecondary: pal.secondary,
    warning: '#F59E0B',
    danger: '#EF4444',
    regen: '#38BDF8',
    isDark,
  };
}
