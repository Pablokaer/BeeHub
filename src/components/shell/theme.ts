/** Day/night preference, stored per browser. "light" is the default when nothing is saved. */
export const THEME_STORAGE_KEY = "ch-theme";
export type Theme = "light" | "dark";

/** Runs in <head> before first paint; must stay tiny and dependency-free. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
