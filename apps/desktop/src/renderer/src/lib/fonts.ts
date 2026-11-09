export interface UiFont {
  id: string;
  family: string;
  style: string;
}

export const UI_FONTS: UiFont[] = [
  { id: "geist", family: "Geist Variable", style: "Neo-grotesque" },
  { id: "rondel", family: "Rondel", style: "Geometric" },
  { id: "beacon", family: "Beacon", style: "Legible sans" },
  { id: "cove", family: "Cove", style: "Rounded geometric" },
  { id: "aurelia", family: "Aurelia", style: "Flared sans" },
  { id: "halden", family: "Halden", style: "Neo-grotesque" },
  { id: "alder", family: "Alder", style: "Humanist" },
  { id: "tessera", family: "Tessera", style: "Squared grotesque" },
  { id: "mallow", family: "Mallow", style: "Rounded" },
];

const FALLBACK = "ui-sans-serif, system-ui, sans-serif";

export const fontById = (id: string) => UI_FONTS.find((f) => f.id === id) ?? UI_FONTS[0]!;

export function applyUiFont(id: string) {
  document.documentElement.style.setProperty(
    "--font-sans",
    `"${fontById(id).family}", ${FALLBACK}`,
  );
}
