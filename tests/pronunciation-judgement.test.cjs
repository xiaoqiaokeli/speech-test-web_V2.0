"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { judgePronunciation } = require("../public/pronunciation-judge.js");

function judge(expected, heard) {
  return judgePronunciation(expected, heard);
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
  ["明确改口后的确认词才对", "大家哦不对哦是大学才对", true, "大学"],
  ["语气词分隔的重复答案", "大家哦不对哦是大学哦大学", true, "大学"],
  ["多个语气词分隔的重复答案", "大家不对是大学哦啊大学", true, "大学"],
  ["明确确认才对", "大学才对", true, "大学"],
  ["带连接词的明确确认", "是大学才对", true, "大学"],
  ["确认后带吧仍不确定", "大学才对吧", false, "大学才对吧"],
  ["可能前缀不能借才对生效", "可能是大学才对", false, "可能是大学才对"],
  ["确认错误词仍判错", "大雪才对", false, "大雪才对"],
  ["才对后带吧仍不确定", "大家不对是大学才对吧", false, "是大学才对吧"],
  ["语气词分隔不同答案仍判错", "大家不对是大学哦大雪", false, "是大学哦大雪"],
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

test("正确答案以是开头时才对规则不会误删", () => {
  assert.deepEqual(judge("是非", "是非才对"), { correct: true, display: "是非" });
  assert.deepEqual(judge("是非", "是是非才对"), { correct: true, display: "是非" });
});

for (const [name, heard, correct, display] of cases) {
  test(name, () => {
    assert.deepEqual(judge("大学", heard), { correct, display });
  });
}
