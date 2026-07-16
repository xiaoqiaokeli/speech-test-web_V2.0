(function () {
  "use strict";

  const TEST_SIZE = 15;
  const RECORD_MAX_MS = 10000;
  const RECORD_MIN_MS = 900;
  const RECORD_SILENCE_MS = 2000;
  const RECORD_START_GRACE_MS = 2600;
  const RECORD_RMS_THRESHOLD = 0.006;
  const RECORD_SOFT_RMS_THRESHOLD = 0.004;
  const RECORD_NOISE_MULTIPLIER = 1.8;
  const RECORD_SILENCE_MULTIPLIER = 1.25;
  const RECORD_END_PEAK_MULTIPLIER = 0.35;
  const RECORD_NOISE_LEARN_RATE = 0.02;
  const RECORD_SOFT_SPEECH_MS = 180;
  const NEXT_DELAY_MS = 2000;
  const TARGET_SAMPLE_RATE = 16000;
  const XFYUN_FRAME_BYTES = 1280;
  const XFYUN_FRAME_INTERVAL_MS = 25;
  const LAST_TEST_WORDS_KEY = "speech-test-last-words-v1";
  const SNR_DB = 10;
  const SPEECH_TARGET_DBFS = -27;
  const NOISE_RMS_WINDOW_SECONDS = 2;
  const NOISE_TRACKS = [
    { name: "交通噪声", src: "./audio/noise/交通噪声.mp3" },
    { name: "雷雨声", src: "./audio/noise/打雷下雨.mp3" },
    { name: "揉纸张声", src: "./audio/noise/揉纸张声.mp3" },
    { name: "森林鸟语", src: "./audio/noise/森林鸟语.mp3" },
    { name: "言语噪声", src: "./audio/noise/言语噪音.mp3" },
    { name: "餐厅背景音", src: "./audio/noise/餐厅背景音.mp3" }
  ];
  const audioCalibration = window.SpeechTestAudio;
  const pronunciationJudge = window.SpeechTestPronunciation;

  const ICONS = {
    play: '<svg viewBox="0 0 64 64" role="img" aria-label="正在播放声音"><path d="M9 25h12l15-12v38L21 39H9Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="M43 23c5 5 5 13 0 18M49 17c9 9 9 21 0 30" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>',
    mic: '<svg viewBox="0 0 64 64" role="img" aria-label="麦克风"><path d="M32 38c6.1 0 11-4.9 11-11V16c0-6.1-4.9-11-11-11S21 9.9 21 16v11c0 6.1 4.9 11 11 11Z" fill="none" stroke="currentColor" stroke-width="5"/><path d="M14 27c0 10 8 18 18 18s18-8 18-18M32 45v12M22 57h20" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>',
    search: '<svg viewBox="0 0 64 64" role="img" aria-label="正在识别"><circle cx="27" cy="27" r="17" fill="none" stroke="currentColor" stroke-width="5"/><path d="M40 40l14 14" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M20 27h14M27 20v14" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
    correct: '<svg viewBox="0 0 64 64" role="img" aria-label="回答正确"><path d="M12 33l13 13 28-30" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    wrong: '<svg viewBox="0 0 64 64" role="img" aria-label="回答错误"><path d="M17 17l30 30M47 17L17 47" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/></svg>',
    alert: '<svg viewBox="0 0 64 64" role="img" aria-label="需要注意"><path d="M32 7 58 55H6Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="M32 23v15M32 47h.01" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/></svg>'
  };

  const elements = {
    screenTitle: document.getElementById("screenTitle"), progressText: document.getElementById("progressText"),
    progressBar: document.getElementById("progressBar"), statusOrb: document.getElementById("statusOrb"),
    statusIcon: document.getElementById("statusIcon"), phaseText: document.getElementById("phaseText"),
    hintText: document.getElementById("hintText"), answerCard: document.getElementById("answerCard"),
    answerText: document.getElementById("answerText"), heardText: document.getElementById("heardText"), resultFlash: document.getElementById("resultFlash"),
    resumeAudioButton: document.getElementById("resumeAudioButton"), recordButton: document.getElementById("recordButton"),
    retryButton: document.getElementById("retryButton"), skipButton: document.getElementById("skipButton"),
    noiseStatus: document.getElementById("noiseStatus"),
    noiseName: document.getElementById("noiseName"),
    noticeModal: document.getElementById("noticeModal"), startButton: document.getElementById("startButton"),
    restartButton: document.getElementById("restartButton"), testPanel: document.getElementById("testPanel"),
    resultPanel: document.getElementById("resultPanel"), correctCount: document.getElementById("correctCount"),
    wrongCount: document.getElementById("wrongCount"), accuracyText: document.getElementById("accuracyText"),
    resultList: document.getElementById("resultList")
  };

  const words = Array.isArray(window.SPEECH_TEST_WORDS) ? window.SPEECH_TEST_WORDS : [];

  let testItems = [];
  let answers = [];
  let currentIndex = 0;
  let countdownTimer = null;
  let currentAudio = null;
  let currentNoiseAudio = null;
  let currentNoiseTrack = null;
  let noiseCycle = null;
  let noiseDecodeContext = null;
  const noiseBufferPromises = new Map();
  let playbackRun = 0;
  let activeCleanup = null;
  let finalizing = false;
  let recordingInProgress = false;
  let recognitionRun = 0;
  let retryAction = null;

  elements.startButton.addEventListener("click", () => { elements.noticeModal.classList.add("is-hidden"); startTest(); });
  elements.resumeAudioButton.addEventListener("click", () => { elements.resumeAudioButton.classList.add("is-hidden"); playCurrentWord(); });
  elements.recordButton.addEventListener("click", () => { elements.recordButton.classList.add("is-hidden"); beginXfyunRecognition({ manual: true }); });
  elements.retryButton.addEventListener("click", () => {
    elements.retryButton.classList.add("is-hidden");
    const action = retryAction;
    retryAction = null;
    if (action) action();
  });
  elements.skipButton.addEventListener("click", skipCurrentQuestion);
  elements.restartButton.addEventListener("click", () => startTest());

  function startTest() {
    recognitionRun += 1;
    stopActiveRecording();
    stopAudio();
    resetNoisePlayback();
    clearTimeout(countdownTimer);
    answers = [];
    currentIndex = 0;
    finalizing = false;
    recordingInProgress = false;
    noiseCycle = audioCalibration.createNoiseCycle(NOISE_TRACKS);
    testItems = selectTestItems(words, TEST_SIZE);
    localStorage.setItem(LAST_TEST_WORDS_KEY, JSON.stringify(testItems.map((item) => item.word)));
    elements.testPanel.classList.remove("is-hidden");
    elements.resultPanel.classList.add("is-hidden");
    setProgress();
    if (testItems.length < TEST_SIZE) return showFatal("词库数量不足", "请检查双音节女声音频目录是否完整。当前无法开始测试。");
    playCurrentWord();
  }

  function selectTestItems(source, size) {
    const previousWords = readLastWords();
    const freshUnique = uniqueByWord(shuffle(source).filter((item) => !previousWords.has(item.word)));
    return (freshUnique.length >= size ? freshUnique : uniqueByWord(shuffle(source))).slice(0, size);
  }

  function readLastWords() {
    try { return new Set(JSON.parse(localStorage.getItem(LAST_TEST_WORDS_KEY) || "[]")); } catch { return new Set(); }
  }

  function uniqueByWord(items) {
    const seen = new Set();
    return items.filter((item) => seen.has(item.word) ? false : (seen.add(item.word), true));
  }

  function shuffle(items) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function getAudioElement() {
    if (!currentAudio) {
      currentAudio = document.createElement("audio");
      currentAudio.preload = "auto";
      currentAudio.setAttribute("playsinline", "");
      currentAudio.style.display = "none";
      document.body.appendChild(currentAudio);
    }
    return currentAudio;
  }

  function getNoiseAudioElement(track) {
    if (!currentNoiseAudio) {
      currentNoiseAudio = document.createElement("audio");
      currentNoiseAudio.preload = "auto";
      currentNoiseAudio.loop = true;
      currentNoiseAudio.setAttribute("playsinline", "");
      currentNoiseAudio.setAttribute("webkit-playsinline", "");
      currentNoiseAudio.style.display = "none";
      document.body.appendChild(currentNoiseAudio);
    }

    // iOS 微信的播放许可与具体媒体元素绑定。始终复用同一个元素，只切换
    // src，首题在“开始测试”手势中解锁后，后续题目才能继续自动播放。
    if (currentNoiseAudio.getAttribute("src") !== track.src) {
      saveNoiseCursor();
      currentNoiseAudio.src = track.src;
      currentNoiseAudio.load();
    }
    currentNoiseTrack = track;
    return currentNoiseAudio;
  }

  function getNoiseTrackForQuestion(index) {
    if (!noiseCycle) noiseCycle = audioCalibration.createNoiseCycle(NOISE_TRACKS);
    return noiseCycle.getTrack(index);
  }

  function getNoiseDecodeContext() {
    if (!noiseDecodeContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("当前浏览器不支持音频 RMS 计算");
      noiseDecodeContext = new AudioContextClass();
    }
    return noiseDecodeContext;
  }

  function loadNoiseBuffer(track) {
    if (!noiseBufferPromises.has(track.src)) {
      const promise = fetch(track.src, { cache: "force-cache" })
        .then((response) => {
          if (!response.ok) throw new Error("环境噪声加载失败");
          return response.arrayBuffer();
        })
        .then((arrayBuffer) => getNoiseDecodeContext().decodeAudioData(arrayBuffer))
        .catch((error) => {
          noiseBufferPromises.delete(track.src);
          throw error;
        });
      noiseBufferPromises.set(track.src, promise);
    }
    return noiseBufferPromises.get(track.src);
  }

  function saveNoiseCursor() {
    if (!currentNoiseAudio || !currentNoiseTrack || !noiseCycle) return;
    const duration = currentNoiseAudio.duration;
    const cursor = currentNoiseAudio.currentTime;
    if (Number.isFinite(duration) && duration > 0 && Number.isFinite(cursor)) {
      noiseCycle.saveCursor(currentNoiseTrack, cursor, duration);
    }
  }

  function setNoiseCursor(audio, track, cursor, run) {
    const applyCursor = () => {
      if (run !== playbackRun || currentNoiseTrack !== track) return;
      const duration = audio.duration;
      audio.currentTime = audioCalibration.normalizeCursor(cursor, duration);
    };
    if (audio.readyState >= 1 && Number.isFinite(audio.duration)) {
      applyCursor();
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const loaded = () => {
        cleanup();
        try { applyCursor(); resolve(); } catch (error) { reject(error); }
      };
      const failed = () => {
        cleanup();
        reject(audio.error || new Error("环境噪声加载失败"));
      };
      const cleanup = () => {
        audio.removeEventListener("loadedmetadata", loaded);
        audio.removeEventListener("error", failed);
      };
      audio.addEventListener("loadedmetadata", loaded, { once: true });
      audio.addEventListener("error", failed, { once: true });
    });
  }

  function resetNoisePlayback() {
    if (currentNoiseAudio) {
      currentNoiseAudio.onerror = null;
      currentNoiseAudio.pause();
      try { currentNoiseAudio.currentTime = 0; } catch {}
    }
    currentNoiseTrack = null;
    noiseCycle = null;
  }

  function setNoiseStatus(track, visible) {
    elements.noiseName.textContent = track?.name || "";
    elements.noiseStatus.classList.toggle("is-hidden", !visible);
  }

  function stopNoise() {
    if (currentNoiseAudio) {
      currentNoiseAudio.onerror = null;
      currentNoiseAudio.pause();
      saveNoiseCursor();
    }
    setNoiseStatus(null, false);
  }

  function handlePlaybackFailure(run, error, sourceLabel) {
    if (run !== playbackRun) return;
    stopAudio();
    if (error?.name === "NotAllowedError") {
      showPlaybackBlocked();
      return;
    }
    showRetryable(sourceLabel + "加载失败", sourceLabel + "加载失败，请检查文件或网络连接后点击重试。", () => playCurrentWord());
  }

  async function playCurrentWord() {
    const item = testItems[currentIndex];
    finalizing = false;
    stopAudio();
    setProgress();
    setPhase("playing");
    hideFlash();
    hideAnswer();
    hideActionButtons();
    const audio = getAudioElement();
    const noiseTrack = getNoiseTrackForQuestion(currentIndex);
    const noiseAudio = getNoiseAudioElement(noiseTrack);
    const run = playbackRun;
    setNoiseStatus(noiseTrack, false);
    try {
      const noiseBuffer = await loadNoiseBuffer(noiseTrack);
      if (run !== playbackRun) return;
      const cursor = noiseCycle.getCursor(noiseTrack, noiseBuffer.duration);
      const noiseRms = audioCalibration.calculateLoopingWindowRms(noiseBuffer, cursor, NOISE_RMS_WINDOW_SECONDS);
      const volumes = audioCalibration.calculateSnrVolumes(item.rmsDbfs, noiseRms, {
        snrDb: SNR_DB,
        speechTargetDbfs: SPEECH_TARGET_DBFS
      });
      audio.volume = volumes.speechVolume;
      noiseAudio.volume = volumes.noiseVolume;
      await setNoiseCursor(noiseAudio, noiseTrack, cursor, run);
      if (run !== playbackRun) return;
    } catch (error) {
      handlePlaybackFailure(run, error, "环境噪声");
      return;
    }
    audio.onended = () => {
      if (run !== playbackRun) return;
      playbackRun += 1;
      stopNoise();
      beginXfyunRecognition({ manual: false });
    };
    audio.onerror = () => handlePlaybackFailure(run, audio.error, "词语音频");
    noiseAudio.onerror = () => handlePlaybackFailure(run, noiseAudio.error, "环境音");
    audio.src = item.audio;
    audio.load();
    const speechPlay = audio.play();
    const noisePlay = noiseAudio.play();
    Promise.all([speechPlay, noisePlay])
      .then(() => { if (run === playbackRun) setNoiseStatus(noiseTrack, true); })
      .catch((error) => handlePlaybackFailure(run, error, "音频"));
  }
  function showPlaybackBlocked() {
    elements.screenTitle.textContent = "需要点击播放";
    elements.phaseText.textContent = "请点击继续播放";
    elements.hintText.textContent = "苹果浏览器限制了自动播放声音，请点一下继续。";
    elements.resumeAudioButton.classList.remove("is-hidden");
  }

  function showRetryable(title, message, action) {
    stopActiveRecording();
    stopAudio();
    clearTimeout(countdownTimer);
    hideFlash();
    hideAnswer();
    hideActionButtons();
    finalizing = false;
    recordingInProgress = false;
    retryAction = action;
    elements.screenTitle.textContent = title;
    elements.phaseText.textContent = title;
    elements.hintText.textContent = message;
    elements.statusOrb.className = "status-orb wrong";
    setStatusIcon(ICONS.alert);
    elements.retryButton.classList.remove("is-hidden");
  }

  function showManualRecordStart(message) {
    setPhase("recording-ready");
    elements.hintText.textContent = message || "浏览器限制了自动录音，请点一下开始录音。";
    elements.recordButton.classList.remove("is-hidden");
    elements.skipButton.classList.add("is-hidden");
  }

  async function beginXfyunRecognition(options = {}) {
    if (recordingInProgress || finalizing) return;
    const run = ++recognitionRun;
    stopNoise();
    recordingInProgress = true;
    const manual = options.manual === true;
    elements.recordButton.classList.add("is-hidden");
    elements.skipButton.classList.add("is-hidden");
    let signed;
    try {
      const response = await fetch("/api/xfyun-token", { cache: "no-store" });
      signed = await response.json();
      if (run !== recognitionRun) return;
      if (!response.ok || !signed.url || !signed.appId) throw new Error(signed.error || "server-config");
    } catch (error) {
      recordingInProgress = false;
      // fetch 在断网时抛 TypeError；服务器有响应但内容异常则是服务问题
      if (error instanceof TypeError) {
        return showRetryable("网络连接失败", "无法连接语音识别服务，请检查网络后点击重试。", () => beginXfyunRecognition({ manual: true }));
      }
      return showRetryable("语音服务暂不可用", "语音识别服务出现问题，请稍后点击重试。若持续出现，请联系我们。", () => beginXfyunRecognition({ manual: true }));
    }

    try {
      setPhase("recording");
      const pcm = await recordPcm(RECORD_MAX_MS, () => elements.skipButton.classList.remove("is-hidden"));
      if (run !== recognitionRun) return;
      elements.skipButton.classList.add("is-hidden");
      setPhase("recognizing");
      const text = await recognizeWithXfyun(signed, pcm);
      if (run !== recognitionRun) return;
      finalizeCurrent(text);
    } catch (error) {
      if (run !== recognitionRun) return;
      console.error(error);
      if (!manual && isRecordingStartError(error)) {
        recordingInProgress = false;
        showManualRecordStart("浏览器限制了自动录音，请点一下开始录音。");
        return;
      }
      if (isNetworkError(error)) {
        recordingInProgress = false;
        return showRetryable("网络连接失败", "识别时网络出现问题，请检查网络后点击重试，并重新朗读。", () => beginXfyunRecognition({ manual: true }));
      }
      finalizeCurrent(error.message || "识别失败");
    } finally {
      if (run === recognitionRun) {
        activeCleanup = null;
        recordingInProgress = false;
      }
    }
  }

  async function recordPcm(durationMs, onReady) {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("当前浏览器无法调用麦克风");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: { ideal: 1 }, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextClass();
    if (audioContext.state === "suspended") await audioContext.resume();

    const source = audioContext.createMediaStreamSource(stream);
    const mute = audioContext.createGain();
    mute.gain.value = 0;
    const chunks = [];
    const startedAt = performance.now();
    let speechStarted = false;
    let lastVoiceAt = 0;
    let noiseFloor = 0.004;
    let peakRms = 0;
    let softSpeechMs = 0;
    let cleaned = false;
    let maxTimer = null;
    let processor = null;
    let processorPort = null;
    let workletUrl = "";
    let resolveRecording = null;

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      window.clearTimeout(maxTimer);
      try { source.disconnect(); } catch {}
      try { processor?.disconnect(); } catch {}
      try { processorPort?.close(); } catch {}
      try { mute.disconnect(); } catch {}
      if (workletUrl) URL.revokeObjectURL(workletUrl);
      stream.getTracks().forEach((track) => track.stop());
      audioContext.close().catch(() => {});
      activeCleanup = null;
    };

    const finish = () => {
      if (cleaned) return;
      const pcm = concatInt16(chunks);
      cleanup();
      if (resolveRecording) resolveRecording(pcm);
    };

    const handleSamples = (input, sampleRate) => {
      if (cleaned || !input?.length) return;
      const now = performance.now();
      const elapsed = now - startedAt;
      const rms = calculateRms(input);
      const frameMs = ((input.length || 0) / (sampleRate || audioContext.sampleRate)) * 1000;
      const speechThreshold = Math.max(RECORD_RMS_THRESHOLD, noiseFloor * RECORD_NOISE_MULTIPLIER);
      const silenceThreshold = Math.max(RECORD_SOFT_RMS_THRESHOLD, noiseFloor * RECORD_SILENCE_MULTIPLIER);
      peakRms = Math.max(peakRms, rms);
      const endVoiceThreshold = Math.max(silenceThreshold, peakRms * RECORD_END_PEAK_MULTIPLIER);
      const isSpeechFrame = rms > speechThreshold;
      const isSoftVoiceFrame = rms > silenceThreshold;
      const isEndVoiceFrame = rms > endVoiceThreshold;

      if (isSpeechFrame || isSoftVoiceFrame) {
        softSpeechMs += frameMs;
      } else {
        softSpeechMs = Math.max(0, softSpeechMs - frameMs * 2);
      }

      if (!speechStarted && (isSpeechFrame || softSpeechMs >= RECORD_SOFT_SPEECH_MS)) {
        speechStarted = true;
        lastVoiceAt = now;
      }

      if (speechStarted && isEndVoiceFrame) {
        lastVoiceAt = now;
      } else if ((!speechStarted && elapsed < RECORD_START_GRACE_MS && !isSoftVoiceFrame) || (speechStarted && !isSpeechFrame && !isEndVoiceFrame)) {
        noiseFloor = (noiseFloor * (1 - RECORD_NOISE_LEARN_RATE)) + (rms * RECORD_NOISE_LEARN_RATE);
      }

      const pcm = downsampleTo16k(input, sampleRate || audioContext.sampleRate);
      if (pcm.length) chunks.push(pcm);

      if (speechStarted && elapsed >= RECORD_MIN_MS && now - lastVoiceAt >= RECORD_SILENCE_MS) finish();
    };

    activeCleanup = finish;

    return new Promise(async (resolve, reject) => {
      resolveRecording = resolve;
      try {
        if (audioContext.audioWorklet && window.AudioWorkletNode) {
          workletUrl = URL.createObjectURL(new Blob([`
            class SpeechTestCaptureProcessor extends AudioWorkletProcessor {
              process(inputs) {
                const channel = inputs[0] && inputs[0][0];
                if (channel) this.port.postMessage({ samples: channel, sampleRate });
                return true;
              }
            }
            registerProcessor("speech-test-capture", SpeechTestCaptureProcessor);
          `], { type: "application/javascript" }));
          await audioContext.audioWorklet.addModule(workletUrl);
          processor = new AudioWorkletNode(audioContext, "speech-test-capture");
          processorPort = processor.port;
          processorPort.onmessage = (event) => handleSamples(event.data.samples, event.data.sampleRate);
        } else {
          processor = audioContext.createScriptProcessor(2048, 1, 1);
          processor.onaudioprocess = (event) => handleSamples(event.inputBuffer.getChannelData(0), audioContext.sampleRate);
        }
        source.connect(processor);
        processor.connect(mute);
        mute.connect(audioContext.destination);
        maxTimer = window.setTimeout(finish, durationMs);
        if (typeof onReady === "function") onReady();
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }

  function isRecordingStartError(error) {
    const name = error?.name || "";
    const message = String(error?.message || "");
    return ["NotAllowedError", "SecurityError", "InvalidStateError", "NotReadableError"].includes(name) || message.includes("麦克风") || message.includes("microphone");
  }

  function isNetworkError(error) {
    const message = String(error?.message || "");
    return message.includes("连接失败") || error instanceof TypeError;
  }

  function recognizeWithXfyun({ url, appId }, pcm) {
    return new Promise((resolve, reject) => {
      if (!pcm.length) return reject(new Error("未识别到声音"));
      const socket = new WebSocket(url);
      let transcript = "";
      let resolved = false;

      const finish = () => {
        if (resolved) return;
        resolved = true;
        resolve(transcript);
      };

      socket.onopen = () => sendPcmFrames(socket, appId, pcm);
      socket.onerror = () => reject(new Error("讯飞连接失败"));
      socket.onclose = () => finish();
      socket.onmessage = (event) => {
        let message;
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.code && message.code !== 0) {
          reject(new Error(`讯飞错误：${message.message || message.code}`));
          try { socket.close(); } catch {}
          return;
        }
        const pieces = message.data?.result?.ws || [];
        const text = pieces.map((item) => item.cw?.[0]?.w || "").join("");
        if (text) transcript += text;
        if (message.data?.status === 2) {
          window.setTimeout(() => { try { socket.close(); } catch {} }, 60);
        }
      };
    });
  }

  function sendPcmFrames(socket, appId, pcm) {
    const bytes = new Uint8Array(pcm.buffer);
    let offset = 0;
    let first = true;
    const sendNext = () => {
      if (socket.readyState !== WebSocket.OPEN) return;
      if (offset >= bytes.length) {
        socket.send(JSON.stringify({ data: { status: 2, format: "audio/L16;rate=16000", encoding: "raw", audio: "" } }));
        return;
      }
      const chunk = bytes.slice(offset, offset + XFYUN_FRAME_BYTES);
      offset += XFYUN_FRAME_BYTES;
      socket.send(JSON.stringify({
        common: first ? { app_id: appId } : undefined,
        business: first ? { language: "zh_cn", domain: "iat", accent: "mandarin", vad_eos: 5000 } : undefined,
        data: { status: first ? 0 : 1, format: "audio/L16;rate=16000", encoding: "raw", audio: arrayBufferToBase64(chunk.buffer) }
      }));
      first = false;
      window.setTimeout(sendNext, XFYUN_FRAME_INTERVAL_MS);
    };
    sendNext();
  }

  function stopActiveRecording() {
    if (activeCleanup) {
      activeCleanup();
      activeCleanup = null;
    }
  }

  function calculateRms(input) {
    let sum = 0;
    for (let i = 0; i < input.length; i += 1) sum += input[i] * input[i];
    return Math.sqrt(sum / input.length);
  }
  function downsampleTo16k(input, inputSampleRate) {
    if (inputSampleRate === TARGET_SAMPLE_RATE) return floatTo16BitPcm(input);
    const ratio = inputSampleRate / TARGET_SAMPLE_RATE;
    const length = Math.floor(input.length / ratio);
    const output = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      const start = Math.floor(i * ratio);
      const end = Math.floor((i + 1) * ratio);
      let sum = 0;
      let count = 0;
      for (let j = start; j < end && j < input.length; j += 1) { sum += input[j]; count += 1; }
      output[i] = count ? sum / count : 0;
    }
    return floatTo16BitPcm(output);
  }

  function floatTo16BitPcm(input) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, input[i]));
      output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return output;
  }

  function concatInt16(chunks) {
    const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const output = new Int16Array(length);
    let offset = 0;
    chunks.forEach((chunk) => { output.set(chunk, offset); offset += chunk.length; });
    return output;
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  function finalizeCurrent(rawHeard) {
    if (finalizing) return;
    finalizing = true;
    elements.skipButton.classList.add("is-hidden");
    const item = testItems[currentIndex];
    const { correct, display } = pronunciationJudge.judgePronunciation(item.word, rawHeard);
    answers.push({ item, heard: display, correct, order: currentIndex + 1 });
    showJudgement(correct, item, display);
    startCountdown(currentIndex >= testItems.length - 1);
  }

  function showJudgement(correct, item, heard) {
    elements.statusOrb.className = `status-orb ${correct ? "correct" : "wrong"}`;
    elements.phaseText.textContent = correct ? "正确" : "错误";
    elements.screenTitle.textContent = "判断完成";
    setStatusIcon(correct ? ICONS.correct : ICONS.wrong);
    showAnswer(item.word, heard);
    showFlash(correct);
  }

  function startCountdown(isFinalQuestion) {
    let remaining = NEXT_DELAY_MS / 1000;
    const updateText = () => { elements.hintText.textContent = isFinalQuestion ? `${remaining} 秒后显示测试结果。` : `${remaining} 秒后进入下一题。`; };
    const tick = () => {
      remaining -= 1;
      if (remaining > 0) { updateText(); countdownTimer = window.setTimeout(tick, 1000); return; }
      currentIndex += 1;
      if (currentIndex >= testItems.length) showResults(); else playCurrentWord();
    };
    clearTimeout(countdownTimer);
    updateText();
    countdownTimer = window.setTimeout(tick, 1000);
  }

  function skipCurrentQuestion() {
    if (finalizing || !testItems[currentIndex]) return;
    finalizing = true;
    recognitionRun += 1;
    recordingInProgress = false;
    stopActiveRecording();
    stopAudio();
    clearTimeout(countdownTimer);
    hideActionButtons();
    const item = testItems[currentIndex];
    answers.push({ item, heard: "已跳过", correct: false, order: currentIndex + 1 });
    currentIndex += 1;
    if (currentIndex >= testItems.length) showResults();
    else playCurrentWord();
  }

  function setProgress() {
    const done = Math.min(currentIndex, TEST_SIZE);
    const current = Math.min(currentIndex + 1, TEST_SIZE);
    elements.progressText.textContent = `${current} / ${TEST_SIZE}`;
    elements.progressBar.style.width = `${(done / TEST_SIZE) * 100}%`;
  }

  function setPhase(phase) {
    if (phase !== "playing") stopNoise();
    elements.statusOrb.className = `status-orb ${phase}`;
    const phaseData = {
      playing: ["正在播放", "请认真听，词语不会显示在屏幕上。", ICONS.play, "第 " + (currentIndex + 1) + " 题"],
      "recording-ready": ["准备录音", "请点击开始录音，说完后会自动结束。", ICONS.mic, "准备录音"],
      recording: ["请朗读", "正在录音，请大声读出刚才听到的词语，说完后会自动结束。", ICONS.mic, "正在录音"],
      recognizing: ["正在识别", "录音已完成，请稍等。", ICONS.search, "正在识别"]
    }[phase];
    elements.phaseText.textContent = phaseData[0];
    elements.hintText.textContent = phaseData[1];
    setStatusIcon(phaseData[2]);
    elements.screenTitle.textContent = phaseData[3];
  }

  function setStatusIcon(icon) {
    if (String(icon).startsWith("<svg")) elements.statusIcon.innerHTML = icon;
    else elements.statusIcon.textContent = icon;
  }

  function showAnswer(word, heard) { elements.answerText.textContent = word; elements.heardText.textContent = heard || "未识别到声音"; elements.answerCard.classList.remove("is-hidden"); }
  function hideAnswer() { elements.answerText.textContent = ""; elements.heardText.textContent = ""; elements.answerCard.classList.add("is-hidden"); }
  function showFlash(correct) { elements.resultFlash.textContent = correct ? "正确" : "错误"; elements.resultFlash.className = `result-flash ${correct ? "good" : "bad"}`; }
  function hideFlash() { elements.resultFlash.className = "result-flash is-hidden"; }
  function hideActionButtons() { elements.resumeAudioButton.classList.add("is-hidden"); elements.recordButton.classList.add("is-hidden"); elements.retryButton.classList.add("is-hidden"); elements.skipButton.classList.add("is-hidden"); retryAction = null; }

  function showResults() {
    stopActiveRecording();
    stopAudio();
    clearTimeout(countdownTimer);
    hideActionButtons();
    const correct = answers.filter((answer) => answer.correct).length;
    const wrong = answers.length - correct;
    const accuracy = answers.length ? Math.round((correct / answers.length) * 100) : 0;
    elements.screenTitle.textContent = "测试结果";
    elements.progressText.textContent = `${answers.length} / ${TEST_SIZE}`;
    elements.progressBar.style.width = "100%";
    elements.correctCount.textContent = String(correct);
    elements.wrongCount.textContent = String(wrong);
    elements.accuracyText.textContent = `${accuracy}%`;
    elements.resultList.innerHTML = "";
    answers.slice().sort((a, b) => a.correct !== b.correct ? (a.correct ? 1 : -1) : a.order - b.order).forEach((answer) => {
      const li = document.createElement("li");
      li.className = answer.correct ? "correct-row" : "wrong-row";
      const seq = document.createElement("span");
      const expected = document.createElement("span");
      const heard = document.createElement("span");
      seq.className = "seq";
      expected.className = "answer";
      heard.className = "heard";
      seq.textContent = `第${answer.order}题`;
      expected.textContent = answer.item.word;
      heard.textContent = answer.heard || "未识别";
      li.append(seq, expected, heard);
      elements.resultList.appendChild(li);
    });
    elements.testPanel.classList.add("is-hidden");
    elements.resultPanel.classList.remove("is-hidden");
  }

  function showFatal(title, message) {
    stopActiveRecording();
    stopAudio();
    clearTimeout(countdownTimer);
    hideFlash();
    hideAnswer();
    hideActionButtons();
    elements.screenTitle.textContent = title;
    elements.phaseText.textContent = title;
    elements.hintText.textContent = message;
    elements.statusOrb.className = "status-orb wrong";
    setStatusIcon(ICONS.alert);
    elements.restartButton.textContent = "重新测试";
    elements.resultPanel.classList.add("is-hidden");
    elements.testPanel.classList.remove("is-hidden");
  }

  function stopAudio() {
    playbackRun += 1;
    if (currentAudio) {
      currentAudio.onended = null;
      currentAudio.onerror = null;
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    stopNoise();
  }
  window.addEventListener("pagehide", stopAudio);
  NOISE_TRACKS.forEach((track) => { loadNoiseBuffer(track).catch(() => {}); });
  if (!words.length) showFatal("没有找到词库", "请确认 words-data.js 已正确加载。");
})();
