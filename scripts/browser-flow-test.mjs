const base = process.env.FLOW_BASE || "http://localhost:8080";
const cdpPort = process.env.CDP_PORT || "9222";
const target = await fetch(`http://localhost:${cdpPort}/json/new?${encodeURIComponent(`${base}/shop/`)}`, {
  method: "PUT",
}).then((response) => response.json());

const socket = new WebSocket(target.webSocketDebuggerUrl);
let nextId = 1;
const pending = new Map();
const events = new Map();

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    message.error ? reject(new Error(message.error.message)) : resolve(message.result);
    return;
  }
  const listeners = events.get(message.method) || [];
  listeners.splice(0).forEach((resolve) => resolve(message.params));
});

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});

const once = (method) => new Promise((resolve) => {
  const listeners = events.get(method) || [];
  listeners.push(resolve);
  events.set(method, listeners);
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};

const navigate = async (route) => {
  const loaded = once("Page.loadEventFired");
  await send("Page.navigate", { url: `${base}${route}` });
  await loaded;
  await wait(250);
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

await send("Page.enable");
await send("Runtime.enable");
await wait(400);

await evaluate("localStorage.clear(); location.reload()");
await once("Page.loadEventFired");
await wait(300);

assert(await evaluate("document.querySelectorAll('.product-card').length") === 12, "catalog did not render");
assert(await evaluate("!!document.querySelector('demo-customizer')"), "demo customizer did not render");
const localFonts = await evaluate(`(async()=>({
  estedad:(await document.fonts.load('16px "Estedad Variable"')).length,
  sahel:(await document.fonts.load('16px "Sahel Local"')).length,
  samim:(await document.fonts.load('16px "Samim Local"')).length,
  lalezar:(await document.fonts.load('16px "Lalezar Local"')).length
}))()`);
assert(localFonts.estedad && localFonts.sahel && localFonts.samim && localFonts.lalezar, "local Persian fonts did not load");
assert(await evaluate("getComputedStyle(document.body).fontFamily.includes('Estedad Variable') && getComputedStyle(document.querySelector('h1')).fontFamily.includes('Estedad Variable')"), "Estedad was not applied to body and headings");
await evaluate("document.querySelector('[data-customizer-toggle]').click();document.querySelector('[data-theme-primary]').value='#386b5b';document.querySelector('[data-theme-primary]').dispatchEvent(new Event('input',{bubbles:true}))");
assert(await evaluate("document.querySelector('[data-customizer-panel]').classList.contains('open')"), "demo customizer did not open");
assert(await evaluate("JSON.parse(localStorage.getItem('flora-demo-theme')).primary") === "#386b5b", "theme preference was not persisted");
assert(await evaluate("JSON.parse(localStorage.getItem('flora-demo-theme')).font") === "estedad", "Estedad default font was not selected");
await evaluate("document.querySelector('[data-customizer-close]').click()");
await evaluate("document.querySelector('[data-add=aurora]').click()");
await wait(250);
assert(await evaluate("JSON.parse(localStorage.getItem('flora-premium-store-v1')).cart.length") === 1, "cart was not persisted");

await navigate("/cart/");
assert(await evaluate("document.querySelectorAll('.cart-line').length") === 1, "persisted cart did not render");
assert((await evaluate("document.querySelector('[data-total]').textContent")).includes("تومان"), "cart total is missing");

await navigate("/shop/");
await evaluate("document.querySelector('[data-wishlist=aurora]').click();document.querySelector('[data-compare=aurora]').click()");
await wait(200);
const saved = await evaluate("JSON.parse(localStorage.getItem('flora-premium-store-v1'))");
assert(saved.wishlist.includes("aurora"), "wishlist was not persisted");
assert(saved.compare.includes("aurora"), "comparison was not persisted");

await evaluate("document.querySelector('[data-search-open]').click()");
assert(await evaluate("document.querySelector('[data-search-panel]').classList.contains('open')"), "search overlay did not open");
await evaluate("document.querySelector('[data-search-close]').click()");

await navigate("/checkout/");
await evaluate(`(()=>{
  const form=document.querySelector('[data-checkout]');
  form.querySelector('[name=buyerName]').value='آرمان';
  form.querySelector('[name=buyerPhone]').value='09121234567';
  form.querySelector('[name=recipientName]').value='نیلوفر';
  form.querySelector('[name=recipientPhone]').value='09121111111';
  form.querySelector('[name=address]').value='تهران، نشانی آزمایشی';
  form.querySelector('[name=date]').value=new Date(Date.now()+86400000).toISOString().split('T')[0];
  form.querySelector('[name=zone]').value='central';
  form.querySelector('[name=zone]').dispatchEvent(new Event('change',{bubbles:true}));
  form.querySelector('[name=slot]').selectedIndex=1;
  form.querySelector('[data-next]').click();
  form.querySelectorAll('[data-next]')[1].click();
  form.requestSubmit();
})()`);
await once("Page.loadEventFired");
await wait(300);
assert((await evaluate("location.pathname")).includes("/order-success/"), "checkout did not reach confirmation");
const ordered = await evaluate("JSON.parse(localStorage.getItem('flora-premium-store-v1'))");
assert(ordered.orders.length === 1 && ordered.cart.length === 0, "order persistence or cart clearing failed");

await navigate("/account/");
assert(await evaluate("!!document.querySelector('.account-shell')"), "account dashboard did not render");

await navigate("/corporate/configure/");
await evaluate(`(()=>{
  const form=document.querySelector('[data-quote-form]');
  form.querySelector('[name=company]').value='شرکت نمونه';
  form.querySelector('[name=requester]').value='مدیر خرید';
  form.querySelector('[name=quantity]').value='20';
  form.querySelector('[name=budget]').value='3000000';
  form.querySelector('[name=date]').value=new Date(Date.now()+86400000*4).toISOString().split('T')[0];
  form.requestSubmit();
})()`);
await once("Page.loadEventFired");
await wait(300);
assert((await evaluate("location.pathname")).includes("/corporate/quote-success/"), "quote did not reach confirmation");
assert((await evaluate("JSON.parse(localStorage.getItem('flora-premium-store-v1')).quotes.length")) === 1, "quote was not persisted");

for (const route of ["/", "/home-2/", "/home-3/", "/home-4/", "/home-5/"]) {
  await navigate(route);
  assert(await evaluate("!!document.querySelector('main')"), `homepage demo failed: ${route}`);
}

await send("Page.close");
socket.close();
console.log("Verified five homepages, demo customizer, catalog, search, cart, wishlist, compare, checkout, order, account, and corporate quote flows.");
