export type PaletteKey =
  | "sky"
  | "sage"
  | "amber"
  | "rose"
  | "violet"
  | "teal"
  | "coral"
  | "stone";

export interface BlockPalette {
  key: PaletteKey;
  label: string;
  accent: string;
  accentSoftLight: string;
  accentSoftDark: string;
  cardBgLight: string;
  cardBgDark: string;
  borderLight: string;
  borderDark: string;
  headerInkLight: string;
  headerInkDark: string;
}

export const BLOCK_PALETTES: BlockPalette[] = [
  {
    key: "sky",
    label: "雾蓝",
    accent: "#3B82F6",
    accentSoftLight: "rgba(59, 130, 246, 0.12)",
    accentSoftDark: "rgba(96, 165, 250, 0.16)",
    cardBgLight: "#F2F7FF",
    cardBgDark: "#1A2230",
    borderLight: "rgba(59, 130, 246, 0.22)",
    borderDark: "rgba(96, 165, 250, 0.24)",
    headerInkLight: "#1D4ED8",
    headerInkDark: "#93C5FD",
  },
  {
    key: "sage",
    label: "鼠尾草绿",
    accent: "#10B981",
    accentSoftLight: "rgba(16, 185, 129, 0.12)",
    accentSoftDark: "rgba(52, 211, 153, 0.16)",
    cardBgLight: "#EFFBF5",
    cardBgDark: "#172622",
    borderLight: "rgba(16, 185, 129, 0.22)",
    borderDark: "rgba(52, 211, 153, 0.24)",
    headerInkLight: "#047857",
    headerInkDark: "#6EE7B7",
  },
  {
    key: "amber",
    label: "暖杏橙",
    accent: "#F59E0B",
    accentSoftLight: "rgba(245, 158, 11, 0.14)",
    accentSoftDark: "rgba(251, 191, 36, 0.16)",
    cardBgLight: "#FFF9EB",
    cardBgDark: "#272219",
    borderLight: "rgba(245, 158, 11, 0.26)",
    borderDark: "rgba(251, 191, 36, 0.24)",
    headerInkLight: "#B45309",
    headerInkDark: "#FCD34D",
  },
  {
    key: "rose",
    label: "樱花粉",
    accent: "#F43F5E",
    accentSoftLight: "rgba(244, 63, 94, 0.11)",
    accentSoftDark: "rgba(251, 113, 133, 0.16)",
    cardBgLight: "#FFF3F5",
    cardBgDark: "#2A1B21",
    borderLight: "rgba(244, 63, 94, 0.22)",
    borderDark: "rgba(251, 113, 133, 0.24)",
    headerInkLight: "#BE123C",
    headerInkDark: "#FDA4AF",
  },
  {
    key: "violet",
    label: "薰衣草紫",
    accent: "#8B5CF6",
    accentSoftLight: "rgba(139, 92, 246, 0.12)",
    accentSoftDark: "rgba(167, 139, 250, 0.16)",
    cardBgLight: "#F6F3FF",
    cardBgDark: "#221D30",
    borderLight: "rgba(139, 92, 246, 0.22)",
    borderDark: "rgba(167, 139, 250, 0.24)",
    headerInkLight: "#6D28D9",
    headerInkDark: "#C4B5FD",
  },
  {
    key: "teal",
    label: "青碧",
    accent: "#14B8A6",
    accentSoftLight: "rgba(20, 184, 166, 0.12)",
    accentSoftDark: "rgba(45, 212, 191, 0.16)",
    cardBgLight: "#EFFCFB",
    cardBgDark: "#172627",
    borderLight: "rgba(20, 184, 166, 0.22)",
    borderDark: "rgba(45, 212, 191, 0.24)",
    headerInkLight: "#0F766E",
    headerInkDark: "#5EEAD4",
  },
  {
    key: "coral",
    label: "珊瑚橘",
    accent: "#F97316",
    accentSoftLight: "rgba(249, 115, 22, 0.12)",
    accentSoftDark: "rgba(251, 146, 60, 0.16)",
    cardBgLight: "#FFF5EE",
    cardBgDark: "#291E18",
    borderLight: "rgba(249, 115, 22, 0.24)",
    borderDark: "rgba(251, 146, 60, 0.24)",
    headerInkLight: "#C2410C",
    headerInkDark: "#FDBA74",
  },
  {
    key: "stone",
    label: "暖灰岩",
    accent: "#78716C",
    accentSoftLight: "rgba(120, 113, 108, 0.12)",
    accentSoftDark: "rgba(168, 162, 158, 0.16)",
    cardBgLight: "#F5F4F0",
    cardBgDark: "#222225",
    borderLight: "rgba(120, 113, 108, 0.22)",
    borderDark: "rgba(168, 162, 158, 0.22)",
    headerInkLight: "#44403C",
    headerInkDark: "#D6D3D1",
  },
];

const paletteMap = new Map<string, BlockPalette>(
  BLOCK_PALETTES.map((p) => [p.key, p]),
);

export function getPalette(key: string): BlockPalette {
  return paletteMap.get(key) ?? BLOCK_PALETTES[0]!;
}
