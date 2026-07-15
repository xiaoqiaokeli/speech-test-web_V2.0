(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SpeechTestAudio = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function shuffle(items, random) {
    const copy = items.slice();
    const nextRandom = typeof random === "function" ? random : Math.random;
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(nextRandom() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function normalizeCursor(cursor, duration) {
    if (!Number.isFinite(cursor) || !Number.isFinite(duration) || duration <= 0) return 0;
    return ((cursor % duration) + duration) % duration;
  }

  function createNoiseCycle(tracks, random) {
    if (!Array.isArray(tracks) || !tracks.length) throw new Error("至少需要一条噪声音频");
    const order = shuffle(tracks, random);
    const cursors = new Map();
    return {
      order: order.slice(),
      getTrack(questionIndex) {
        const index = Number.isInteger(questionIndex) && questionIndex >= 0 ? questionIndex : 0;
        return order[index % order.length];
      },
      getCursor(track, duration) {
        return normalizeCursor(cursors.get(track.src) || 0, duration);
      },
      saveCursor(track, cursor, duration) {
        const normalized = normalizeCursor(cursor, duration);
        cursors.set(track.src, normalized);
        return normalized;
      }
    };
  }

  function calculateLoopingWindowRms(audioBuffer, startSeconds, windowSeconds) {
    const sampleRate = audioBuffer && audioBuffer.sampleRate;
    const frameCount = audioBuffer && audioBuffer.length;
    const channelCount = audioBuffer && audioBuffer.numberOfChannels;
    const seconds = windowSeconds === undefined ? 2 : windowSeconds;
    if (!Number.isFinite(sampleRate) || sampleRate <= 0 || !Number.isInteger(frameCount) || frameCount <= 0 ||
        !Number.isInteger(channelCount) || channelCount <= 0 || !Number.isFinite(seconds) || seconds <= 0) {
      throw new Error("无效的噪声音频缓冲区");
    }
    const duration = frameCount / sampleRate;
    const startFrame = Math.floor(normalizeCursor(startSeconds, duration) * sampleRate) % frameCount;
    const samplesToMeasure = Math.max(1, Math.round(seconds * sampleRate));
    const channels = [];
    for (let channel = 0; channel < channelCount; channel += 1) channels.push(audioBuffer.getChannelData(channel));
    let sumSquares = 0;
    for (let offset = 0; offset < samplesToMeasure; offset += 1) {
      const frame = (startFrame + offset) % frameCount;
      for (let channel = 0; channel < channelCount; channel += 1) {
        const sample = channels[channel][frame] || 0;
        sumSquares += sample * sample;
      }
    }
    return Math.sqrt(sumSquares / (samplesToMeasure * channelCount));
  }

  function dbToAmplitude(db) {
    return Math.pow(10, db / 20);
  }

  function calculateSnrVolumes(speechDbfs, noiseRms, options) {
    const settings = options || {};
    const snrDb = Number.isFinite(settings.snrDb) ? settings.snrDb : 10;
    const speechTargetDbfs = Number.isFinite(settings.speechTargetDbfs) ? settings.speechTargetDbfs : -27;
    const speechRms = dbToAmplitude(speechDbfs);
    if (!Number.isFinite(speechRms) || speechRms <= 0 || !Number.isFinite(noiseRms) || noiseRms <= 0) {
      throw new Error("音频 RMS 无法用于音量校准");
    }
    const ratio = dbToAmplitude(snrDb);
    const targetSpeechRms = dbToAmplitude(speechTargetDbfs);
    const targetNoiseRms = targetSpeechRms / ratio;
    const unscaledSpeechVolume = targetSpeechRms / speechRms;
    const unscaledNoiseVolume = targetNoiseRms / noiseRms;
    const commonScale = Math.min(1, 1 / unscaledSpeechVolume, 1 / unscaledNoiseVolume);
    return {
      speechVolume: unscaledSpeechVolume * commonScale,
      noiseVolume: unscaledNoiseVolume * commonScale,
      noiseRms,
      snrDb
    };
  }

  return { calculateLoopingWindowRms, calculateSnrVolumes, createNoiseCycle, normalizeCursor };
});
