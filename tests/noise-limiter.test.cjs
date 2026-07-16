"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { limitNoiseBuffer } = require("../public/audio-calibration.js");

function fakeAudioBuffer(values, sampleRate) {
  const channel = Float32Array.from(values);
  return {
    sampleRate,
    length: channel.length,
    duration: channel.length / sampleRate,
    numberOfChannels: 1,
    getChannelData: () => channel
  };
}

function db(x) { return 20 * Math.log10(x); }

function measureBuffer(buffer) {
  const data = buffer.getChannelData(0);
  let sumSq = 0, peak = 0;
  for (let i = 0; i < data.length; i++) {
    sumSq += data[i] * data[i];
    peak = Math.max(peak, Math.abs(data[i]));
  }
  const rms = Math.sqrt(sumSq / data.length);
  const crestDb = db(peak) - db(rms);
  return { rms, peak, crestDb };
}

test("噪声限制器将高波峰因子压缩到目标值", () => {
  // 模拟高波峰因子噪声：低 RMS 背景 + 几个尖峰
  const samples = Array(22050).fill(0.01); // 背景 -40dBFS
  samples[1000] = 0.8;  // 尖峰 -2dBFS
  samples[5000] = -0.9; // 尖峰 -1dBFS
  samples[10000] = 0.85;

  const buffer = fakeAudioBuffer(samples, 22050);
  const before = measureBuffer(buffer);

  // 原始波峰因子应该很高（尖峰比平均高很多）
  assert.ok(before.crestDb > 15, `原始波峰因子应 >15dB，实际 ${before.crestDb.toFixed(1)}dB`);

  limitNoiseBuffer(buffer, 8);
  const after = measureBuffer(buffer);

  // 压缩后波峰因子应接近 8dB（允许 ±1dB 误差）
  assert.ok(Math.abs(after.crestDb - 8) < 1.5, `目标 8dB，实际 ${after.crestDb.toFixed(1)}dB`);

  // RMS 会降低（硬限幅的副作用），但 calculateSnrVolumes 会用新 RMS 校准，所以 SNR 仍正确
  // 允许 RMS 降低最多 5dB（对于极端高波峰因子信号）
  const rmsDiff = db(before.rms) - db(after.rms);
  assert.ok(rmsDiff >= 0 && rmsDiff < 5, `RMS 应降低 0~5dB，实际降低 ${rmsDiff.toFixed(2)}dB`);
});

test("噪声限制器对低波峰因子信号几乎不改变", () => {
  // 模拟已经平稳的噪声（波峰因子 ~6dB）
  const samples = [];
  for (let i = 0; i < 22050; i++) {
    samples.push(0.05 * Math.sin(i * 0.1) * (0.8 + 0.4 * Math.random()));
  }

  const buffer = fakeAudioBuffer(samples, 22050);
  const before = measureBuffer(buffer);

  limitNoiseBuffer(buffer, 8);
  const after = measureBuffer(buffer);

  // 波峰因子本来就低，处理后应该基本不变
  assert.ok(Math.abs(after.crestDb - before.crestDb) < 1,
    `波峰因子变化应很小，before=${before.crestDb.toFixed(1)}dB after=${after.crestDb.toFixed(1)}dB`);

  // RMS 几乎不变
  const rmsDiff = Math.abs(db(after.rms) - db(before.rms));
  assert.ok(rmsDiff < 0.3, `RMS 变化应 <0.3dB，实际 ${rmsDiff.toFixed(2)}dB`);
});
