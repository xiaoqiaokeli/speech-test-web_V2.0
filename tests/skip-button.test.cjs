"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const publicDir = path.join(__dirname, "..", "public");
const html = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");
const appScript = fs.readFileSync(path.join(publicDir, "app.js"), "utf8");

test("跳过按钮明确说明该题会计为错误", () => {
  assert.match(html, /不会，跳过此题/);
  assert.match(html, /此题将计为错误/);
});

test("跳过按钮只在录音真正开始后显示", () => {
  const playStart = appScript.indexOf("async function playCurrentWord");
  const playEnd = appScript.indexOf("function showPlaybackBlocked");
  const recognitionStart = appScript.indexOf("async function beginXfyunRecognition");
  const recordStart = appScript.indexOf("async function recordPcm");
  const playbackCode = appScript.slice(playStart, playEnd);
  const recognitionCode = appScript.slice(recognitionStart, recordStart);

  assert.doesNotMatch(playbackCode, /skipButton\.classList\.remove/);
  assert.match(recognitionCode, /recordPcm\(RECORD_MAX_MS, \(\) => elements\.skipButton\.classList\.remove\("is-hidden"\)\)/);
  assert.match(recognitionCode, /skipButton\.classList\.add\("is-hidden"\);\s*setPhase\("recognizing"\)/);
  assert.doesNotMatch(appScript.slice(appScript.indexOf("function showManualRecordStart"), recognitionStart), /skipButton\.classList\.remove/);
});

test("跳过题会记录独立的错误原因", () => {
  assert.match(appScript, /heard: "已跳过", correct: false, reason: "已跳过"/);
  assert.match(appScript, /判错原因：\$\{answer\.reason/);
});
