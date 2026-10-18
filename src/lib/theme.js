const KEY = "protektor-theme";

export const getTheme = () => (document.documentElement.dataset.theme === "light" ? "light" : "dark");

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(KEY, theme); } catch { /* modo privado */ }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#070b14" : "#ffffff");
  window.dispatchEvent(new CustomEvent("protektor:theme", { detail: theme }));
}
