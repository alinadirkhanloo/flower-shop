import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const target = path.join(dir, entry.name);
  return entry.isDirectory() && entry.name !== "node_modules" ? walk(target) : [target];
});

const files = walk(root);
const pages = files.filter((file) => file.endsWith(".html"));
const errors = [];
const external = /(?:https?:)?\/\//i;
const benchmark = /(golkala|golteh|plantlandtehran|googletagmanager)/i;

for (const file of pages) {
  const html = fs.readFileSync(file, "utf8");
  const relative = path.relative(root, file);

  if (!/<html lang="fa" dir="rtl"/.test(html)) errors.push(`${relative}: missing Persian RTL root`);
  if (!/<main id="main"/.test(html)) errors.push(`${relative}: missing main landmark`);
  if (!/<title>[^<]+<\/title>/.test(html)) errors.push(`${relative}: missing title`);
  if (benchmark.test(html)) errors.push(`${relative}: contains benchmark reference`);

  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const value = match[1];
    if (!value || value.startsWith("#") || value.startsWith("mailto:") || value.startsWith("tel:")) continue;
    if (external.test(value)) {
      errors.push(`${relative}: network dependency ${value}`);
      continue;
    }
    const clean = decodeURIComponent(value.split(/[?#]/)[0]);
    if (!clean) continue;
    let target = path.resolve(path.dirname(file), clean);
    if (clean.endsWith("/")) target = path.join(target, "index.html");
    if (!path.extname(target)) target = path.join(target, "index.html");
    if (!fs.existsSync(target)) errors.push(`${relative}: broken reference ${value}`);
  }
}

const required = [
  "index.html", "home-2/index.html", "home-3/index.html", "home-4/index.html", "home-5/index.html",
  "shop/index.html", "product/index.html", "cart/index.html",
  "checkout/index.html", "order-success/index.html", "track/index.html",
  "gift-finder/index.html", "corporate/configure/index.html", "auth/index.html",
  "account/orders/index.html", "care/index.html", "journal/index.html",
  "help/contact/index.html", "privacy/index.html", "404/index.html",
];

for (const route of required) {
  if (!fs.existsSync(path.join(root, route))) errors.push(`missing required route ${route}`);
}

for (const asset of [
  "assets/vendor/bootstrap/bootstrap.rtl.min.css",
  "assets/vendor/bootstrap/bootstrap.bundle.min.js",
  "assets/vendor/bootstrap-icons/bootstrap-icons.min.css",
  "assets/vendor/bootstrap-icons/fonts/bootstrap-icons.woff2",
  "assets/vendor/swiper/swiper-bundle.min.css",
  "assets/vendor/swiper/swiper-bundle.min.js",
  "assets/vendor/aos/aos.css",
  "assets/vendor/aos/aos.js",
  "assets/vendor/glightbox/glightbox.min.css",
  "assets/vendor/glightbox/glightbox.min.js",
  "assets/vendor/vazirmatn/index.css",
  "assets/vendor/vazirmatn/files/vazirmatn-arabic-wght-normal.woff2",
  "assets/vendor/noto-sans-arabic/index.css",
  "assets/vendor/noto-sans-arabic/files/noto-sans-arabic-arabic-wght-normal.woff2",
  "assets/vendor/lalezar/arabic.css",
  "assets/vendor/lalezar/files/lalezar-arabic-400-normal.woff2",
  "assets/vendor/estedad/index.css",
  "assets/vendor/estedad/files/estedad-arabic-wght-normal.woff2",
  "assets/fonts/Sahel/Sahel.woff",
  "assets/fonts/Sahel/Sahel-Bold.woff",
  "assets/fonts/Sahel/Sahel-Black.woff",
  "assets/fonts/Samim/Samim.woff2",
  "assets/fonts/Samim/Samim-Bold.woff2",
  "assets/fonts/Lalezar-Font/TTF/Lalezar-Regular.ttf",
  "assets/css/site.css",
  "assets/js/data.js",
  "assets/js/store.js",
  "assets/js/app.js",
]) {
  if (!fs.existsSync(path.join(root, asset))) errors.push(`missing local asset ${asset}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Verified ${pages.length} HTML pages, ${files.length} files, local routes, RTL landmarks, and offline assets.`);
