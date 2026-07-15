"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateLoopingWindowRms, calculateSnrVolumes, createNoiseCycle } =
  require("../public/audio-calibration.js");

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

test("6 条噪声随机排序后循环，并分别续存播放游标", () => {
  const tracks = Array.from({ length: 6 }, (_, index) => ({ src: "noise-" + index }));
  const cycle = createNoiseCycle(tracks, () => 0);
  const firstRound = Array.from({ length: 6 }, (_, index) => cycle.getTrack(index));
  const secondRound = Array.from({ length: 6 }, (_, index) => cycle.getTrack(index + 6));
  assert.equal(new Set(firstRound).size, 6);
  assert.deepEqual(secondRound, firstRound);
  cycle.saveCursor(firstRound[0], 1.25, 10);
  cycle.saveCursor(firstRound[1], 4.5, 10);
  assert.equal(cycle.getCursor(firstRound[0], 10), 1.25);
  assert.equal(cycle.getCursor(firstRound[1], 10), 4.5);
  assert.equal(cycle.saveCursor(firstRound[0], 10.75, 10), 0.75);
});

test("RMS 只取当前游标后的 2 秒，跨末尾时回绕", () => {
  const buffer = fakeAudioBuffer([1, 1, 2, 2, 3, 3], 2);
  const rms = calculateLoopingWindowRms(buffer, 2.5, 2);
  const expected = Math.sqrt((9 + 1 + 1 + 4) / 4);
  const wholeTrackRms = Math.sqrt((1 + 1 + 4 + 4 + 9 + 9) / 6);
  assert.ok(Math.abs(rms - expected) < 1e-12);
  assert.notEqual(rms, wholeTrackRms);
});

test("动态音量使词语输出 RMS 比当前噪声窗口高 10 dB", () => {
  const speechRms = Math.pow(10, -20 / 20);
  const noiseRms = 0.02;
  const volumes = calculateSnrVolumes(-20, noiseRms, { snrDb: 10, speechTargetDbfs: -27 });
  const ratio = (speechRms * volumes.speechVolume) / (noiseRms * volumes.noiseVolume);
  assert.ok(volumes.speechVolume <= 1);
  assert.ok(volumes.noiseVolume <= 1);
  assert.ok(Math.abs(20 * Math.log10(ratio) - 10) < 1e-10);
});

test("达到音量上限时共同缩放，仍保持 +10 dB", () => {
  const speechRms = Math.pow(10, -60 / 20);
  const noiseRms = 0.1;
  const volumes = calculateSnrVolumes(-60, noiseRms, { snrDb: 10, speechTargetDbfs: -27 });
  const ratio = (speechRms * volumes.speechVolume) / (noiseRms * volumes.noiseVolume);
  assert.equal(volumes.speechVolume, 1);
  assert.ok(volumes.noiseVolume < 1);
  assert.ok(Math.abs(20 * Math.log10(ratio) - 10) < 1e-10);
});
