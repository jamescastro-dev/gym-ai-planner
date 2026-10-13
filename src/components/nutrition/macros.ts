/**
 * Protein, carbs and fat are three different things, so each gets its own categorical colour (in this fixed order),
 * not three shades of the accent. Validated on the card surface #18181b: lightness band, chroma, colour-blind
 * separation (worst adjacent pair ΔE 9.4, deuteranopia), normal-vision separation and 3:1 contrast all pass.
 * Text never takes these colours; they only mark identity next to a label.
 */
export const MACROS = [
  { key: "protein", name: "Protein", color: "#3987e5", kcalPerGram: 4 },
  { key: "carbs", name: "Carbs", color: "#d95926", kcalPerGram: 4 },
  { key: "fat", name: "Fat", color: "#199e70", kcalPerGram: 9 },
] as const;

export type MacroKey = (typeof MACROS)[number]["key"];

/** Dark ink clears 4.5:1 on all three fills (white does not), for labels drawn inside a segment. */
export const INK_ON_MACRO = "#0a0a0a";

export const formatNumber = (n: number) => n.toLocaleString("en-US");
