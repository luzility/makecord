import type { MakecordApi } from "../../../shared/api";

declare global {
  interface Window {
    makecord: MakecordApi;
  }
}

export const api = window.makecord;
export type * from "../../../shared/api";
