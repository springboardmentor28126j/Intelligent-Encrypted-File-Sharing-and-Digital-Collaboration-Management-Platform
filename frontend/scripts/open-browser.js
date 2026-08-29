// Waits for the Next.js dev server to respond, then opens it in the
// default browser. Works on Windows, macOS, and Linux without extra
// browser-launcher dependencies.

const http = require("http");
const { exec } = require("child_process");

const URL = "http://localhost:3000";
const POLL_INTERVAL_MS = 400;
const MAX_ATTEMPTS = 150; // ~60 seconds

let attempts = 0;

function openBrowser() {
  const platform = process.platform;
  let cmd;
  if (platform === "win32") {
    // 'start' is a cmd.exe builtin; the empty "" title arg avoids quoting issues
    cmd = `start "" "${URL}"`;
  } else if (platform === "darwin") {
    cmd = `open "${URL}"`;
  } else {
    cmd = `xdg-open "${URL}"`;
  }

  exec(cmd, (err) => {
    if (err) {
      console.log(`Could not auto-open the browser. Open this manually: ${URL}`);
    } else {
      console.log(`Opened ${URL} in your browser.`);
    }
  });
}

function checkServer() {
  attempts += 1;

  const req = http.get(URL, (res) => {
    res.resume(); // discard body
    openBrowser();
  });

  req.on("error", () => {
    if (attempts >= MAX_ATTEMPTS) {
      console.log(`Dev server didn't respond after ${MAX_ATTEMPTS * POLL_INTERVAL_MS / 1000}s. Open manually: ${URL}`);
      return;
    }
    setTimeout(checkServer, POLL_INTERVAL_MS);
  });

  req.setTimeout(2000, () => req.destroy());
}

checkServer();
