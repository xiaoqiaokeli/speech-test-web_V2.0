(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SpeechTestPronunciation = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const PHRASE_TONES = {
    "安排": "an1_pai2", "安全": "an1_quan2", "比较": "bi3_jiao4", "必须": "bi4_xu1", "表示": "biao3_shi4",
    "不但": "bu2_dan4", "参加": "can1_jia1", "车站": "che1_zhan4", "宠物": "chong3_wu4", "出来": "chu1_lai2",
    "错误": "cuo4_wu4", "大家": "da4_jia1", "大学": "da4_xue2", "代表": "dai4_biao3", "但是": "dan4_shi4",
    "当然": "dang1_ran2", "道理": "dao4_li3", "得到": "de2_dao4", "电影": "dian4_ying3", "调控": "tiao2_kong4",
    "冬天": "dong1_tian1", "动物": "dong4_wu4", "多少": "duo1_shao3", "而且": "er2_qie3", "发生": "fa1_sheng1",
    "反对": "fan3_dui4", "扶贫": "fu2_pin2", "辐射": "fu2_she4", "负责": "fu4_ze2", "复杂": "fu4_za2",
    "干部": "gan4_bu4", "刚才": "gang1_cai2", "各种": "ge4_zhong3", "工作": "gong1_zuo4", "国家": "guo2_jia1",
    "合适": "he2_shi4", "环保": "huan2_bao3", "活动": "huo2_dong4", "火车": "huo3_che1", "或者": "huo4_zhe3",
    "基本": "ji1_ben3", "简单": "jian3_dan1", "健身": "jian4_shen1", "紧张": "jin3_zhang1", "经过": "jing1_guo4",
    "精神": "jing1_shen2", "决定": "jue2_ding4", "科研": "ke1_yan2", "可能": "ke3_neng2", "可是": "ke3_shi4",
    "可以": "ke3_yi3", "空气": "kong1_qi4", "老师": "lao3_shi1", "历史": "li4_shi3", "利用": "li4_yong4",
    "领导": "ling3_dao3", "马上": "ma3_shang4", "没有": "mei2_you3", "门口": "men2_kou3", "民族": "min2_zu2",
    "那样": "na4_yang4", "难道": "nan2_dao4", "农民": "nong2_min2", "努力": "nu3_li4", "批评": "pi1_ping2",
    "品牌": "pin3_pai2", "汽车": "qi4_che1", "去年": "qu4_nian2", "全部": "quan2_bu4", "热情": "re4_qing2",
    "任何": "ren4_he2", "上网": "shang4_wang3", "社会": "she4_hui4", "社区": "she4_qu1", "身体": "shen1_ti3",
    "生产": "sheng1_chan3", "生活": "sheng1_huo2", "时代": "shi2_dai4", "时间": "shi2_jian1", "实现": "shi2_xian4",
    "水平": "shui3_ping2", "睡觉": "shui4_jiao4", "思想": "si1_xiang3", "虽然": "sui1_ran2", "所有": "suo3_you3",
    "太阳": "tai4_yang2", "特别": "te4_bie2", "提高": "ti2_gao1", "同志": "tong2_zhi4", "突然": "tu1_ran2",
    "伟大": "wei3_da4", "希望": "xi1_wang4", "现代": "xian4_dai4", "小时": "xiao3_shi2", "星期": "xing1_qi1",
    "许多": "xu3_duo1", "颜色": "yan2_se4", "要求": "yao1_qiu2", "也许": "ye3_xu3", "一定": "yi2_ding4",
    "一起": "yi4_qi3", "已经": "yi3_jing1", "以后": "yi3_hou4", "艺术": "yi4_shu4", "意义": "yi4_yi4",
    "尤其": "you2_qi2", "有名": "you3_ming2", "这些": "zhe4_xie1", "这样": "zhe4_yang4", "整齐": "zheng3_qi2",
    "正在": "zheng4_zai4", "中午": "zhong1_wu3", "中学": "zhong1_xue2", "主要": "zhu3_yao4", "自己": "zi4_ji3",
    "祖国": "zu3_guo2", "最后": "zui4_hou4", "最近": "zui4_jin4", "昨天": "zuo2_tian1"
  };

  const charToneMap = buildCharToneMap(PHRASE_TONES);
  const INCORRECT_REASONS = {
    no_sound: "未识别到声音",
    answer_mismatch: "答案与正确答案不一致",
    uncertain_expression: "包含不确定语气"
  };

  function judgePronunciation(expected, rawHeard) {
    const cleanExpected = cleanChinese(expected);
    const rawText = String(rawHeard || "");
    const cleanActual = cleanChinese(rawText);
    const base = normalizeStandaloneConfirmation(stripFillers(cleanActual), cleanExpected);
    const correction = getCorrectionParts(cleanActual, cleanExpected.length);
    const rawTail = stripFillers(correction.tail);
    const tail = normalizeCorrectionTail(rawTail, cleanExpected, correction.hasExplicit);

    // 依次尝试：改口后的内容（优先）、去语气词后的整体
    let matchedCandidate = "";
    if (cleanExpected) {
      for (const candidate of [tail, base]) {
        if (candidate && (isBasicMatch(cleanExpected, candidate) || isRepeatedMatch(cleanExpected, candidate))) {
          matchedCandidate = candidate;
          break;
        }
      }
    }

    // 无论判对或判错，明确改口后的展示都使用最后一次改口后的候选答案。
    // 只有“应该是”等软标记而没有明确改口词时，仍显示完整识别原话。
    const correctionDisplay = normalizeCorrectionDisplay(rawTail, cleanExpected, correction.hasExplicit);
    const displaySource = matchedCandidate || correctionDisplay || cleanActual;
    const display = collapseRepeats(displaySource, cleanExpected.length) || displaySource || rawText || "未识别到声音";
    const correct = Boolean(matchedCandidate);
    const reasonCode = correct ? null : getIncorrectReasonCode(rawText, cleanActual, cleanExpected, correction);
    return { correct, display, reasonCode, reason: reasonCode ? INCORRECT_REASONS[reasonCode] : "" };
  }

  function isBasicMatch(cleanExpected, cleanActual) {
    if (cleanActual.length !== cleanExpected.length) return false;
    if (cleanActual === cleanExpected) return true;
    const expectedTone = getToneKey(cleanExpected);
    const actualTone = getToneKey(cleanActual);
    return Boolean(expectedTone && actualTone && expectedTone === actualTone);
  }

  const SOFT_CORRECTION_MARKERS = ["应该是", "应该说"];
  const RESTART_MARKERS = buildRestartMarkers();
  const EXPLICIT_CORRECTION_MARKERS = new Set([
    "不是", "不对", "错了", "说错了", "说错", "改成", "改为", "换成", "换为", ...RESTART_MARKERS
  ]);
  const CORRECTION_MARKERS = [...EXPLICIT_CORRECTION_MARKERS, ...SOFT_CORRECTION_MARKERS];
  const FILLER_CHARS = new Set(Array.from("嗯啊呃哦噢喔唉哎呀嘛"));
  const NON_ANSWER_PREFIXES = new Set(["我觉得", "我猜", "好像", "也许", "可能", "大概", "似乎", "答案", "我说", "应该", "肯定", "绝对"]);

  function buildRestartMarkers() {
    const markers = new Set(["重来", "重说", "重读", "重念", "重新开始", "从头开始"]);
    const suffixes = ["", "一次", "一遍", "一下"];
    for (const prefix of ["重新", "再", "从头"]) {
      for (const action of ["来", "说", "读", "念", "回答"]) {
        for (const suffix of suffixes) markers.add(prefix + action + suffix);
      }
    }
    for (const marker of Array.from(markers)) markers.add("我" + marker);
    return Array.from(markers);
  }

  function stripFillers(text) {
    const chars = Array.from(text);
    let start = 0;
    let end = chars.length;
    while (start < end && FILLER_CHARS.has(chars[start])) start += 1;
    while (end > start && FILLER_CHARS.has(chars[end - 1])) end -= 1;
    return chars.slice(start, end).join("");
  }

  function normalizeStandaloneConfirmation(text, cleanExpected) {
    if (!text.endsWith("才对")) return text;
    const confirmed = stripFillers(text.slice(0, -2));
    if (isBasicMatch(cleanExpected, confirmed)) return confirmed;
    if (confirmed.startsWith("是")) {
      const candidate = stripFillers(confirmed.slice(1));
      if (isBasicMatch(cleanExpected, candidate)) return candidate;
    }
    return text;
  }

  function normalizeCorrectionTail(text, cleanExpected, hasExplicit) {
    const variants = [text];
    if (hasExplicit && text.startsWith("是")) variants.push(stripFillers(text.slice(1)));

    for (const variant of variants) {
      if (hasExplicit) {
        if (isBasicMatch(cleanExpected, variant) || isRepeatedMatch(cleanExpected, variant)) return variant;
        if (isFillerSeparatedRepeatedMatch(cleanExpected, variant)) return cleanExpected;
      }

      if (variant.endsWith("才对")) {
        const confirmed = stripFillers(variant.slice(0, -2));
        if (isBasicMatch(cleanExpected, confirmed) || isRepeatedMatch(cleanExpected, confirmed)) return confirmed;
        if (isFillerSeparatedRepeatedMatch(cleanExpected, confirmed)) return cleanExpected;
      }
    }
    return text;
  }

  function normalizeCorrectionDisplay(text, cleanExpected, hasExplicit) {
    if (!hasExplicit) return "";
    let display = stripFillers(text);
    if (display.startsWith("是") && !cleanExpected.startsWith("是")) display = stripFillers(display.slice(1));
    if (display.endsWith("才对")) display = stripFillers(display.slice(0, -2));
    return display;
  }

  function getIncorrectReasonCode(rawText, cleanActual, cleanExpected, correction) {
    if (!cleanActual || /未识别到声音|未检测到声音|没有识别到声音/.test(rawText)) return "no_sound";
    if (containsUncertainExpression(cleanActual, cleanExpected, correction)) return "uncertain_expression";
    return "answer_mismatch";
  }

  function containsUncertainExpression(text, cleanExpected, correction) {
    if (text.includes("吧") || SOFT_CORRECTION_MARKERS.some((marker) => text.includes(marker))) return true;
    if (correction.hasExplicit) return false;
    return ["我觉得", "我猜", "好像", "也许", "可能", "大概", "似乎"].some((prefix) => (
      text.startsWith(prefix) && text.length > cleanExpected.length
    ));
  }

  function isFillerSeparatedRepeatedMatch(cleanExpected, text) {
    if (!cleanExpected || !text) return false;
    let index = 0;
    let matches = 0;
    while (index < text.length) {
      const segment = text.slice(index, index + cleanExpected.length);
      if (!isBasicMatch(cleanExpected, segment)) return false;
      matches += 1;
      index += cleanExpected.length;
      if (index === text.length) return matches >= 2;

      const fillerStart = index;
      while (index < text.length && FILLER_CHARS.has(text[index])) index += 1;
      if (index === fillerStart || index === text.length) return false;
    }
    return false;
  }

  function isRepeatedMatch(cleanExpected, cleanActual) {
    const unit = cleanExpected.length;
    if (!unit || cleanActual.length < unit * 2 || cleanActual.length % unit !== 0) return false;
    for (let i = 0; i < cleanActual.length; i += unit) {
      if (!isBasicMatch(cleanExpected, cleanActual.slice(i, i + unit))) return false;
    }
    return true;
  }

  // 形如“大学大学”的完整重复，显示时合并为“大学”（各段必须完全一致）
  function collapseRepeats(text, unitLen) {
    if (!text || !unitLen || text.length < unitLen * 2 || text.length % unitLen !== 0) return "";
    const unit = text.slice(0, unitLen);
    for (let i = unitLen; i < text.length; i += unitLen) {
      if (text.slice(i, i + unitLen) !== unit) return "";
    }
    return unit;
  }

  function getCorrectionParts(text, expectedLength) {
    const occurrences = [];
    for (const marker of CORRECTION_MARKERS) {
      let fromIndex = 0;
      while (fromIndex < text.length) {
        const index = text.indexOf(marker, fromIndex);
        if (index === -1) break;
        occurrences.push({ marker, index, end: index + marker.length });
        fromIndex = index + marker.length;
      }
    }
    // 同一位置优先使用较长词组，例如“重新说一次”不能只按“重新说”截取。
    occurrences.sort((a, b) => a.index - b.index || b.end - a.end);

    const firstCorrection = occurrences.find(({ marker, index }) => {
      const priorAnswer = stripFillers(text.slice(0, index));
      if (priorAnswer.length !== expectedLength) return false;
      if (!NON_ANSWER_PREFIXES.has(priorAnswer)) return true;

      // “可能、也许”等既可能是语气前缀，也可能是用户第一次读出的词。
      // 明确改口词可直接消除歧义；软改口词需要“哦、嗯”等停顿边界。
      const hasFillerBoundary = index > 0 && FILLER_CHARS.has(text[index - 1]);
      return hasFillerBoundary || EXPLICIT_CORRECTION_MARKERS.has(marker);
    });
    if (!firstCorrection) return { tail: "", displayTail: "", hasExplicit: false };

    let bestEnd = firstCorrection.end;
    let firstExplicit = null;
    for (const occurrence of occurrences) {
      if (occurrence.index < firstCorrection.index) continue;
      if (!firstExplicit && EXPLICIT_CORRECTION_MARKERS.has(occurrence.marker)) firstExplicit = occurrence;
      if (occurrence.end > bestEnd) bestEnd = occurrence.end;
    }
    return {
      tail: text.slice(bestEnd),
      displayTail: firstExplicit ? text.slice(firstExplicit.end) : "",
      hasExplicit: Boolean(firstExplicit)
    };
  }

  function getToneKey(text) {
    const extra = (root && root.SPEECH_TEST_EXTRA_TONES) || {};
    if (extra[text]) return extra[text];
    if (PHRASE_TONES[text]) return PHRASE_TONES[text];
    const automaticTone = getAutomaticToneKey(text);
    if (automaticTone) return automaticTone;
    const parts = Array.from(text).map((char) => charToneMap[char]);
    return parts.every(Boolean) ? parts.join("_") : "";
  }

  function getAutomaticToneKey(text) {
    const converter = root && root.pinyinPro && root.pinyinPro.pinyin;
    if (typeof converter !== "function") return "";
    try {
      const parts = converter(text, {
        toneType: "num",
        type: "array",
        v: true,
        toneSandhi: true,
        nonZh: "removed"
      });
      return Array.isArray(parts) && parts.length === Array.from(text).length ? parts.join("_") : "";
    } catch {
      return "";
    }
  }

  function buildCharToneMap(phraseMap) {
    const result = {};
    Object.entries(phraseMap).forEach(([word, toneKey]) => {
      const chars = Array.from(word);
      const tones = toneKey.split("_");
      chars.forEach((char, index) => { if (!result[char]) result[char] = tones[index]; });
    });
    return result;
  }

  function cleanChinese(text) {
    return String(text || "").replace(/[，。！？、,.!?\s]/g, "").match(/[\u4e00-\u9fff]/g)?.join("") || "";
  }

  return { judgePronunciation };
});
