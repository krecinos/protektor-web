import puppeteer from "puppeteer-core";
const KEY = process.argv[2];
const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome", headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
const errs = [];
page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
page.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message));
await page.setCookie({ name: "PHPSESSID", value: KEY, domain: "app.protektor.com.gt", path: "/", secure: true, httpOnly: true });

for (const mode of ["light", "dark"]) {
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: mode }]);
  await page.goto("https://app.protektor.com.gt/v2/?" + mode, { waitUntil: "networkidle0", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2500));
  await page.screenshot({ path: `/tmp/v2-${mode}.png`, clip: { x: 0, y: 0, width: 1280, height: 780 } });
  console.log(`captura ${mode} lista`);
}
console.log("errores de consola: " + (errs.length || "ninguno"));
errs.slice(0, 5).forEach((e) => console.log("  " + e));
await browser.close();
