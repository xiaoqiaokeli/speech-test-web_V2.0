"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { judgePronunciation } = require("../public/pronunciation-judge.js");

function judge(expected, heard) {
  const { correct, display } = judgePronunciation(expected, heard);
  return { correct, display };
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
  ["才对后带吧仍不确定", "大家不对是大学才对吧", false, "大学才对吧"],
  ["语气词分隔不同答案仍判错", "大家不对是大学哦大雪", false, "大学哦大雪"],
  ["句首连接词不能单独生效", "是大学", false, "是大学"],
  ["没有明确改口时连接词不能生效", "大家是大学", false, "大家是大学"],
  ["连接词后仍不确定", "大家不是哦是大学吧", false, "大学吧"],
  ["明确改口后带吧", "大家不是大学吧", false, "大学吧"],
  ["改口后仍不确定", "大家哦不是应该是大学吧", false, "大学吧"],
  ["有旧答案后重说", "大家重来大学", true, "大学"],
  ["连续改口以最后一次为准", "大家不是大雪不是大学", true, "大学"],
  ["最终改成错误词", "大家不是大学不是大雪", false, "大雪"],
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

test("明确改口后错误答案的显示会去掉连接词是", () => {
  assert.deepEqual(judge("希望", "正在哦不对哦是你希望"), { correct: false, display: "你希望" });
});

test("明确改口后正确答案仍正常判对并只显示答案", () => {
  assert.deepEqual(judge("希望", "正在哦不对哦是希望"), { correct: true, display: "希望" });
});

test("多层改口判错时仍只显示最终候选答案", () => {
  assert.deepEqual(judge("大学", "你好哦不对换成河马才对"), { correct: false, display: "河马" });
});

test("多层改口判对时显示最终匹配答案", () => {
  assert.deepEqual(judge("河马", "你好哦不对换成河马才对"), { correct: true, display: "河马" });
});

test("有旧答案后应该是与才对构成明确确认", () => {
  assert.deepEqual(judge("可能", "你好哦应该是可能才对"), { correct: true, display: "可能" });
});

test("有旧答案后应该是仍按现有改口规则判定", () => {
  assert.deepEqual(judge("可能", "你好哦应该是可能"), { correct: true, display: "可能" });
});

test("应该是与才对后带吧仍保持不确定", () => {
  assert.deepEqual(judge("可能", "你好哦应该是可能才对吧"), { correct: false, display: "你好哦应该是可能才对吧" });
});

test("可能作为旧答案时可通过语气停顿识别各类改口", () => {
  const markers = ["不是", "不对", "错了", "说错", "应该是", "应该说", "改成", "换成", "重说", "重来"];
  for (const marker of markers) {
    assert.deepEqual(judge("颜色", `可能哦${marker}颜色`), { correct: true, display: "颜色" }, marker);
  }
  assert.deepEqual(judge("颜色", "也许哦重来颜色"), { correct: true, display: "颜色" });
});

test("明确改口词没有语气停顿也可识别可能为旧答案", () => {
  for (const marker of ["不是", "不对", "错了", "说错", "改成", "换成", "重说", "重来"]) {
    assert.deepEqual(judge("颜色", `可能${marker}颜色`), { correct: true, display: "颜色" }, marker);
  }
});

test("明确改口前的旧答案不要求与正确答案字数相同", () => {
  assert.deepEqual(judge("整齐", "这哦不对整齐"), { correct: true, display: "整齐" });
  assert.deepEqual(judge("整齐", "这不对整齐"), { correct: true, display: "整齐" });
  assert.deepEqual(judge("整齐", "这不是那个哦不对整齐"), { correct: true, display: "整齐" });
});

test("不同字数的旧答案使用软改口词时仍需停顿边界", () => {
  assert.deepEqual(judge("整齐", "这应该是整齐"), { correct: false, display: "这应该是整齐" });
  assert.deepEqual(judge("整齐", "这哦应该是整齐"), { correct: true, display: "整齐" });
});

test("没有改口边界的软表达仍按不确定处理", () => {
  for (const marker of ["应该是", "应该说"]) {
    const heard = `可能${marker}颜色`;
    assert.deepEqual(judge("颜色", heard), { correct: false, display: heard }, marker);
  }
});

test("重新作答的常见同义词均可识别", () => {
  const markers = [
    "重新来", "再来一次", "再来一遍", "从头来", "重新说", "再说一次", "重新说一遍",
    "重新读", "再读一次", "从头读", "重新念", "再念一遍", "重新回答", "从头回答",
    "我重新来", "我再说一次", "我从头读一遍"
  ];
  for (const marker of markers) {
    assert.deepEqual(judge("颜色", `可能${marker}颜色`), { correct: true, display: "颜色" }, marker);
  }
});

test("较长的重新作答词组会被完整移除", () => {
  assert.deepEqual(judge("颜色", "可能重新说一次你好"), { correct: false, display: "你好" });
  assert.deepEqual(judge("颜色", "可能我从头回答一遍你好"), { correct: false, display: "你好" });
});

test("完整拼音转换可将同音同调的不同汉字判对", () => {
  const previousPinyinPro = globalThis.pinyinPro;
  const toneMap = { "河马": ["he2", "ma3"], "盒马": ["he2", "ma3"], "大雪": ["da4", "xue3"] };
  globalThis.pinyinPro = {
    pinyin(text, options) {
      assert.equal(options.toneType, "num");
      assert.equal(options.type, "array");
      return toneMap[text] || [];
    }
  };
  try {
    assert.deepEqual(judge("河马", "盒马"), { correct: true, display: "盒马" });
    assert.deepEqual(judge("河马", "大雪"), { correct: false, display: "大雪" });
  } finally {
    if (previousPinyinPro === undefined) delete globalThis.pinyinPro;
    else globalThis.pinyinPro = previousPinyinPro;
  }
});

test("判错原因只使用约定的三类自动判定原因", () => {
  assert.deepEqual(judgePronunciation("大学", ""), {
    correct: false, display: "未识别到声音", reasonCode: "no_sound", reason: "未识别到声音"
  });
  assert.deepEqual(judgePronunciation("大学", "大雪"), {
    correct: false, display: "大雪", reasonCode: "answer_mismatch", reason: "答案与正确答案不一致"
  });
  assert.deepEqual(judgePronunciation("大学", "大学吧"), {
    correct: false, display: "大学吧", reasonCode: "uncertain_expression", reason: "包含不确定语气"
  });
});

test("判对时不返回错误原因", () => {
  assert.deepEqual(judgePronunciation("大学", "大学"), {
    correct: true, display: "大学", reasonCode: null, reason: ""
  });
});

for (const [name, heard, correct, display] of cases) {
  test(name, () => {
    assert.deepEqual(judge("大学", heard), { correct, display });
  });
}
