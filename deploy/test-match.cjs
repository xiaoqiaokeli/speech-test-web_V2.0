// 临时测试：验证 judgePronunciation 的判断与显示逻辑（不部署）
const fs = require("fs");
const path = require("path");

const stubEl = () => ({
  addEventListener() {}, classList: { add() {}, remove() {} },
  style: {}, textContent: "", innerHTML: "", appendChild() {},
  setAttribute() {}, load() {}, play() { return { catch() {} }; }, pause() {},
});
global.document = { getElementById: stubEl, createElement: stubEl, body: { appendChild() {} } };
global.window = {
  SPEECH_TEST_WORDS: [{ word: "占位", audio: "x" }],
  setTimeout, clearTimeout,
  addEventListener() {},
};
global.localStorage = { getItem: () => null, setItem() {} };
global.navigator = {};
global.performance = { now: () => 0 };

// 在 IIFE 末尾注入导出钩子
let code = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");
code = code.replace('  if (!words.length) showFatal("没有找到词库"', '  global.__judge = judgePronunciation;\n  if (!words.length) showFatal("没有找到词库"');
eval(code);
const judge = global.__judge;

const cases = [
  // [期望词, 识别文本, 应判正确?, 期望显示]
  ["大学", "大学", true, "大学"],
  ["大学", "大家", false, "大家"],
  ["大学", "大家不是大学", true, "大学"],            // 自我纠正 -> 只显示改口后的
  ["大学", "大家哦不是大学", true, "大学"],
  ["大学", "大家不对大学", true, "大学"],
  ["大学", "大家说错了应该是大学", true, "大学"],
  ["大学", "大家还是大学", false, "大家还是大学"],     // 不确定表述，判错并显示原文
  ["大学", "大学大学", true, "大学"],                // 重复 -> 合并显示
  ["大学", "大学大学大学", true, "大学"],
  ["大学", "大家大学", false, "大家大学"],            // 无改口词，判错
  ["大学", "嗯大学", true, "大学"],                  // 语气词 -> 去掉后显示
  ["大学", "大学啊", true, "大学"],
  ["大学", "哦大学嘛", true, "大学"],
  ["大学", "大血", false, "大血"],                   // 血(xue4)与学(xue2)声调不同
  ["大学", "打学", false, "打学"],
  ["工作", "工作工作", true, "工作"],
  ["工作", "共作不是工作", true, "工作"],
  ["不但", "不但", true, "不但"],                    // 期望词本身含“不”
  ["错误", "错误", true, "错误"],                    // 期望词本身含“错”
  ["大学", "不是大学", true, "大学"],
  ["大学", "", false, "未识别到声音"],
  ["大学", "大学不是", false, "大学不是"],            // 改口后为空 -> 回退显示整体
  ["大学", "未识别到声音", false, "未识别到声音"],      // 错误消息透传
  ["大血", "大血大血", true, "大血"],                // 判对时同音字显示用户实际所说
];

let pass = 0;
for (const [expected, actual, wantCorrect, wantDisplay] of cases) {
  const { correct, display } = judge(expected, actual);
  const ok = correct === wantCorrect && display === wantDisplay;
  if (ok) pass += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${expected} <- "${actual}"  判定=${correct}(期望${wantCorrect}) 显示="${display}"(期望"${wantDisplay}")`);
}
console.log(`\n${pass}/${cases.length} 通过`);
process.exit(pass === cases.length ? 0 : 1);
