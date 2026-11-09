import { en } from "./en";
import { tr } from "./tr";

export const dictionaries = { en, tr };
export type Lang = keyof typeof dictionaries;
