import { spawn } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import path from "node:path";

const ROOT = process.cwd();
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PROFILE = path.join(ROOT, ".chrome-cdp-qa");
const OUT = path.join(ROOT, "qa-screenshots");
const PORT = 9333;
const BASE_URL = "http://127.0.0.1:4173/";
const ASSET_VERSION = "20260528ownerdrop";
const EXPECTED_FEATURED_CARDS = 2;

const scenarios = [
  {
    name: "cdp-desktop-home",
    width: 1440,
    height: 900,
    url: `${BASE_URL}?qa=cdp-desktop-home#home`
  },
  {
    name: "cdp-tablet-home",
    width: 820,
    height: 1180,
    url: `${BASE_URL}?qa=cdp-tablet-home#home`
  },
  {
    name: "cdp-mobile-publications",
    width: 390,
    height: 844,
    url: `${BASE_URL}?qa=cdp-mobile-publications#publications`
  }
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`HTTP ${response.statusCode}: ${body.slice(0, 200)}`));
          return;
        }
        resolve(JSON.parse(body));
      });
    });
    request.on("error", reject);
    request.setTimeout(1000, () => {
      request.destroy(new Error("Request timed out"));
    });
  });
}

async function waitForDebugPort() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      return await requestJson(`http://127.0.0.1:${PORT}/json/version`);
    } catch {
      await delay(160);
    }
  }
  throw new Error("Chrome remote debugging port did not become ready.");
}

function encodeFrame(payload) {
  const data = Buffer.from(payload);
  const mask = randomBytes(4);
  const header = [];
  header.push(0x81);
  if (data.length < 126) {
    header.push(0x80 | data.length);
  } else if (data.length < 65536) {
    header.push(0x80 | 126, (data.length >> 8) & 255, data.length & 255);
  } else {
    const length = BigInt(data.length);
    header.push(0x80 | 127);
    for (let shift = 56n; shift >= 0n; shift -= 8n) {
      header.push(Number((length >> shift) & 255n));
    }
  }
  const masked = Buffer.alloc(data.length);
  for (let index = 0; index < data.length; index += 1) {
    masked[index] = data[index] ^ mask[index % 4];
  }
  return Buffer.concat([Buffer.from(header), mask, masked]);
}

function decodeFrames(buffer) {
  const messages = [];
  let offset = 0;
  while (buffer.length - offset >= 2) {
    const first = buffer[offset];
    const second = buffer[offset + 1];
    const opcode = first & 0x0f;
    const masked = Boolean(second & 0x80);
    let length = second & 0x7f;
    let cursor = offset + 2;
    if (length === 126) {
      if (buffer.length - cursor < 2) break;
      length = buffer.readUInt16BE(cursor);
      cursor += 2;
    } else if (length === 127) {
      if (buffer.length - cursor < 8) break;
      const longLength = buffer.readBigUInt64BE(cursor);
      if (longLength > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error("Frame too large.");
      }
      length = Number(longLength);
      cursor += 8;
    }
    let mask;
    if (masked) {
      if (buffer.length - cursor < 4) break;
      mask = buffer.subarray(cursor, cursor + 4);
      cursor += 4;
    }
    if (buffer.length - cursor < length) break;
    let payload = buffer.subarray(cursor, cursor + length);
    if (masked) {
      const unmasked = Buffer.alloc(length);
      for (let index = 0; index < length; index += 1) {
        unmasked[index] = payload[index] ^ mask[index % 4];
      }
      payload = unmasked;
    }
    if (opcode === 1) messages.push(payload.toString("utf8"));
    offset = cursor + length;
  }
  return { messages, rest: buffer.subarray(offset) };
}

async function connectWebSocket(wsUrl) {
  const url = new URL(wsUrl);
  const key = randomBytes(16).toString("base64");
  const expectedAccept = createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");
  const socket = net.connect(Number(url.port), url.hostname);
  await new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("error", reject);
  });
  socket.write(
    [
      `GET ${url.pathname}${url.search} HTTP/1.1`,
      `Host: ${url.host}`,
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Key: ${key}`,
      "Sec-WebSocket-Version: 13",
      "",
      ""
    ].join("\r\n")
  );

  let pendingBuffer = Buffer.alloc(0);
  await new Promise((resolve, reject) => {
    const onData = (chunk) => {
      pendingBuffer = Buffer.concat([pendingBuffer, chunk]);
      const split = pendingBuffer.indexOf("\r\n\r\n");
      if (split === -1) return;
      socket.off("data", onData);
      const headers = pendingBuffer.subarray(0, split).toString("utf8");
      pendingBuffer = pendingBuffer.subarray(split + 4);
      if (!headers.startsWith("HTTP/1.1 101") || !headers.includes(expectedAccept)) {
        reject(new Error(`WebSocket handshake failed:\n${headers}`));
        return;
      }
      resolve();
    };
    socket.on("data", onData);
    socket.once("error", reject);
  });

  let id = 0;
  const callbacks = new Map();
  let frameBuffer = pendingBuffer;

  socket.on("data", (chunk) => {
    frameBuffer = Buffer.concat([frameBuffer, chunk]);
    const decoded = decodeFrames(frameBuffer);
    frameBuffer = decoded.rest;
    decoded.messages.forEach((message) => {
      const parsed = JSON.parse(message);
      if (!parsed.id || !callbacks.has(parsed.id)) return;
      const { resolve, reject } = callbacks.get(parsed.id);
      callbacks.delete(parsed.id);
      if (parsed.error) reject(new Error(JSON.stringify(parsed.error)));
      else resolve(parsed.result);
    });
  });

  return {
    send(method, params = {}) {
      id += 1;
      const currentId = id;
      const payload = JSON.stringify({ id: currentId, method, params });
      socket.write(encodeFrame(payload));
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          callbacks.delete(currentId);
          reject(new Error(`Timed out waiting for ${method}`));
        }, 12000);
        callbacks.set(currentId, {
          resolve: (value) => {
            clearTimeout(timer);
            resolve(value);
          },
          reject: (error) => {
            clearTimeout(timer);
            reject(error);
          }
        });
      });
    },
    close() {
      socket.end();
    }
  };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await rm(PROFILE, { recursive: true, force: true });
  const chrome = spawn(CHROME, [
    "--headless=new",
    "--disable-gpu",
    "--disable-crash-reporter",
    "--disable-breakpad",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    "about:blank"
  ], { stdio: ["ignore", "ignore", "pipe"] });

  let stderr = "";
  chrome.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  try {
    await waitForDebugPort();
    const targets = await requestJson(`http://127.0.0.1:${PORT}/json/list`);
    const pageTarget = targets.find((target) => target.type === "page");
    if (!pageTarget) throw new Error("No page target found.");
    const cdp = await connectWebSocket(pageTarget.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");

    const results = [];
    for (const scenario of scenarios) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: scenario.width,
        height: scenario.height,
        deviceScaleFactor: 1,
        mobile: scenario.width < 700
      });
      await cdp.send("Page.navigate", { url: scenario.url });
      await delay(4800);
      const evaluation = await cdp.send("Runtime.evaluate", {
        returnByValue: true,
        expression: `(() => {
          const heading = document.querySelector("#publications .section-heading");
          const publications = document.getElementById("publications");
          const hero = document.querySelector(".hero");
          const snapshot = document.querySelector(".snapshot-section");
          const header = document.querySelector(".site-header");
          return {
            url: location.href,
            title: document.title,
            width: window.innerWidth,
            height: window.innerHeight,
            scrollY: Math.round(window.scrollY),
            scrollWidth: document.documentElement.scrollWidth,
            cssHref: document.querySelector('link[rel="stylesheet"]')?.href,
            hasScrollProgress: Boolean(document.querySelector(".scroll-progress, [data-scroll-progress]")),
            oldSections: ["projects", "experience", "workflow", "compass"].filter((id) => document.getElementById(id)),
            heroHeight: hero ? Math.round(hero.getBoundingClientRect().height) : null,
            snapshotTop: snapshot ? Math.round(snapshot.getBoundingClientRect().top) : null,
            publicationTop: publications ? Math.round(publications.getBoundingClientRect().top) : null,
            publicationHeadingTop: heading ? Math.round(heading.getBoundingClientRect().top) : null,
            publicationHeadingOpacity: heading ? getComputedStyle(heading).opacity : null,
            headerHeight: header ? Math.round(header.getBoundingClientRect().height) : null
          };
        })()`
      });
      const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
      const screenshotPath = path.join(OUT, `${scenario.name}.png`);
      await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));

      let interactions = null;
      let interactionScreenshotPath = null;
      if (scenario.name === "cdp-mobile-publications") {
        const interactionResult = await cdp.send("Runtime.evaluate", {
          returnByValue: true,
          expression: `(() => {
            const featured = document.querySelector('[data-filter="featured"]');
            featured?.click();
            const countAfterFeatured = document.querySelector('[data-publication-count]')?.textContent?.trim();
            const activeFilter = document.querySelector('.filter-btn.is-active')?.dataset?.filter;
            const visibleCards = Array.from(document.querySelectorAll('.publication-card')).filter((card) => getComputedStyle(card).display !== 'none').length;
            const navToggle = document.querySelector('.nav-toggle');
            const mobileTheme = document.querySelector('[data-theme-toggle-mobile]');
            navToggle?.click();
            return {
              activeFilter,
              countAfterFeatured,
              visibleCards,
              navOpen: document.body.classList.contains('nav-open'),
              navExpanded: navToggle?.getAttribute('aria-expanded'),
              mobileThemeVisible: mobileTheme ? getComputedStyle(mobileTheme).display !== 'none' : false
            };
          })()`
        });
        interactions = interactionResult.result.value;
        await delay(260);
        const menuScreenshot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
        interactionScreenshotPath = path.join(OUT, "cdp-mobile-menu.png");
        await writeFile(interactionScreenshotPath, Buffer.from(menuScreenshot.data, "base64"));
        const themeResult = await cdp.send("Runtime.evaluate", {
          returnByValue: true,
          expression: `(() => {
            const mobileTheme = document.querySelector('[data-theme-toggle-mobile]');
            mobileTheme?.click();
            const themeAfterMobileToggle = document.documentElement.dataset.theme;
            mobileTheme?.click();
            return {
              themeAfterMobileToggle,
              themeAfterReset: document.documentElement.dataset.theme
            };
          })()`
        });
        interactions = { ...interactions, ...themeResult.result.value };
      }

      results.push({ name: scenario.name, screenshotPath, interactionScreenshotPath, metrics: evaluation.result.value, interactions });
    }
    cdp.close();
    const failures = [];
    results.forEach((result) => {
      const { name, metrics, interactions } = result;
      if (metrics.hasScrollProgress) failures.push(`${name}: scroll progress line is present.`);
      if (metrics.oldSections.length) failures.push(`${name}: removed sections still exist: ${metrics.oldSections.join(", ")}`);
      if (metrics.scrollWidth > metrics.width + 1) failures.push(`${name}: horizontal overflow ${metrics.scrollWidth} > ${metrics.width}.`);
      if (!String(metrics.cssHref).includes(ASSET_VERSION)) failures.push(`${name}: asset cache version is missing.`);
      if (name === "cdp-desktop-home" && !(metrics.snapshotTop > 0 && metrics.snapshotTop < metrics.height)) {
        failures.push(`${name}: academic snapshot is not visible in the first desktop viewport.`);
      }
      if (name === "cdp-mobile-publications") {
        if (metrics.publicationTop < 70 || metrics.publicationTop > 220) failures.push(`${name}: publications anchor lands at ${metrics.publicationTop}px.`);
        if (metrics.publicationHeadingOpacity !== "1") failures.push(`${name}: publications heading is not visible.`);
        if (interactions?.activeFilter !== "featured") failures.push(`${name}: featured filter did not become active.`);
        if (interactions?.visibleCards !== EXPECTED_FEATURED_CARDS) {
          failures.push(`${name}: featured filter should show ${EXPECTED_FEATURED_CARDS} card(s).`);
        }
        if (!interactions?.navOpen || interactions?.navExpanded !== "true") failures.push(`${name}: mobile menu did not open.`);
        if (!interactions?.mobileThemeVisible) failures.push(`${name}: mobile theme control is not visible.`);
        if (interactions?.themeAfterMobileToggle !== "dark" || interactions?.themeAfterReset !== "light") {
          failures.push(`${name}: mobile theme toggle did not switch dark and back to light.`);
        }
      }
    });
    console.log(JSON.stringify(results, null, 2));
    if (failures.length) {
      console.error("QA failures:");
      failures.forEach((failure) => console.error(`- ${failure}`));
      process.exitCode = 1;
    }
  } finally {
    chrome.kill();
    await delay(300);
    await rm(PROFILE, { recursive: true, force: true }).catch(() => {});
    if (chrome.exitCode && stderr) {
      console.error(stderr.split("\n").slice(-8).join("\n"));
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
