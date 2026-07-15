"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const appPath = path.join(__dirname, "..", "public", "app.js");
const source = fs.readFileSync(appPath, "utf8");

function extractBetween(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, "无法从 app.js 提取实际判定代码");
  return source.slice(start, end);
}

const judgeSource = extractBetween("  function judgePronunciation", "  function getToneKey");
const cleanSource = extractBetween("  function cleanChinese", "  function setProgress");

function judge(expected, heard) {
  const context = {
    Set,
    Array,
    String,
    Boolean,
    getToneKey: () => "",
    result: null
  };
  vm.runInNewContext(
    judgeSource + "\n" + cleanSource +
      "\nresult = judgePronunciation(" + JSON.stringify(expected) + ", " + JSON.stringify(heard) + ");",
    context
  );
  return { ...context.result };
}

const cases = [
  ["明确回答", "大学", true, "大学"],
  ["未完成的不确定表达", "大学应该是", false, "大学应该是"],
  ["带吧的不确定表达", "大学应该是吧", false, "大学应该是吧"],
  ["句首应该是", "应该是大学", false, "应该是大学"],
  ["主观猜测", "我觉得应该是大学", false, "我觉得应该是大学"],
  ["好像猜测", "好像应该是大学", false, "好像应该是大学"],
  ["直接否定", "不是大学", false, "不是大学"],
  ["没有旧答案就要求重来", "重来大学", false, "重来大学"],
  ["明确改口", "大家哦不是应该是大学", true, "大学"],
  ["开头语气词后明确改口", "嗯大家不是大学", true, "大学"],
  ["明确改口后的连接词是", "大家哦不是哦是大学", true, "大学"],
  ["句首连接词不能单独生效", "是大学", false, "是大学"],
  ["没有明确改口时连接词不能生效", "大家是大学", false, "大家是大学"],
  ["连接词后仍不确定", "大家不是哦是大学吧", false, "是大学吧"],
  ["明确改口后带吧", "大家不是大学吧", false, "大学吧"],
  ["改口后仍不确定", "大家哦不是应该是大学吧", false, "应该是大学吧"],
  ["有旧答案后重说", "大家重来大学", true, "大学"],
  ["连续改口以最后一次为准", "大家不是大雪不是大学", true, "大学"],
  ["最终改成错误词", "大家不是大学不是大雪", false, "大学不是大雪"],
  ["重复明确答案", "大学大学", true, "大学"],
  ["重复后仍不确定", "大学大学吧", false, "大学大学吧"]
];

test("正确答案本身以是开头时不会误删", () => {
  assert.deepEqual(judge("是非", "大家不是是非"), { correct: true, display: "是非" });
});

for (const [name, heard, correct, display] of cases) {
  test(name, () => {
    assert.deepEqual(judge("大学", heard), { correct, display });
  });
}
