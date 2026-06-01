<template>
  <div class="app">
    <header class="header">
      <h1>PTE WFD 练习 <span style="font-size:10px;color:#aaa;font-weight:400">v250601</span></h1>
      <select v-if="availableVoices.length > 0" v-model="selectedVoiceName" @change="onVoiceChange" class="voice-select">
          <option value="">Auto</option>
          <option v-for="v in availableVoices" :key="v.name" :value="v.name">{{ v.name }}</option>
        </select>
      <span class="user-info">
        <span class="user-email">{{ userEmail }}</span>
        <button class="btn-logout" @click="doLogout" title="Logout">&times;</button>
      </span>
      <span class="counter">{{ currentIndex + 1 }} / {{ sentences.length }}</span>
    </header>

    <!-- Auth Page -->
    <div v-if="!loggedIn" class="auth-page">
      <div class="auth-card">
        <h2>PTE WFD Practice</h2>
        <div class="auth-tabs">
          <button :class="{ active: authMode === 'login' }" @click="authMode = 'login'">Login</button>
          <button :class="{ active: authMode === 'register' }" @click="authMode = 'register'">Register</button>
        </div>
        <input v-model="authEmail" type="email" placeholder="Email" class="auth-input" @keyup.enter="doLogin" />
        <input v-model="authPassword" type="password" placeholder="Password" class="auth-input" @keyup.enter="doLogin" />
        <div v-if="authError" class="auth-error">{{ authError }}</div>
        <!-- Verification form -->
    <div v-if="needsVerify" class="auth-card">
      <h2>Verify Email</h2>
      <p class="verify-msg" v-html="verifyMessage"></p>
      <div v-if="!verifyEmailSent && verifyDevCode" class="verify-dev-code">
        <span>Verification code (dev mode): </span><strong>{{ verifyDevCode }}</strong>
      </div>
      <div v-if="verifyEmailSent" class="verify-email-sent">
        A verification code has been sent to <strong>{{ verifyEmailRef }}</strong>. Please check your inbox.
      </div>
      <input v-model="verifyCode" type="text" placeholder="Enter 6-digit code" class="auth-input" maxlength="6" @keyup.enter="doVerify" />
      <div v-if="authError" class="auth-error">{{ authError }}</div>
      <button class="btn-auth" @click="doVerify" :disabled="authLoading || verifyCode.length !== 6">
        {{ authLoading ? 'Verifying...' : 'Verify' }}
      </button>
      <button class="btn-link" @click="doResendCode">Resend code</button>
      <button class="btn-link" @click="needsVerify = false">Back</button>
    </div>

    <!-- Login/Register form -->
    <div v-if="!needsVerify" class="auth-card">
        <button class="btn-auth" @click="doLogin" :disabled="authLoading">
          {{ authLoading ? 'Loading...' : (authMode === 'register' ? 'Register' : 'Login') }}
        </button>
      </div>
    </div>
    </div>

    <!-- Category Selector -->
    <div v-if="loggedIn && !started" class="auth-page">
      <div class="auth-card">
        <h2>Select Category</h2>
        <div class="cat-options">
          <button class="btn-cat" :class="{ active: selectedCategory === 'all' }" @click="selectCategory('all')">All (187)</button>
          <button class="btn-cat" :class="{ active: selectedCategory === 'basic' }" @click="selectCategory('basic')">Basic (77)</button>
          <button class="btn-cat" :class="{ active: selectedCategory === 'jj' }" @click="selectCategory('jj')">JJ (110)</button>
        </div>
        <div v-if="!hasSavedState" style="color:#888;font-size:12px;margin-bottom:8px">No saved progress found</div>
        <button v-if="hasSavedState" class="btn-auth" style="margin-top:12px;background:#1a73e8" @click="resumePractice">Continue ({{ savedStateData.currentIndex + 1 }}/{{ savedStateData.sentences.length }})</button>
        <button class="btn-auth" style="margin-top:12px" @click="startWithCategory">Start New</button>
      </div>
    </div>

    <!-- Celebration Overlay -->
    <transition name="fade">
      <div v-if="showCelebration" class="celebration-overlay">
        <div class="celebration-text">{{ celebrationText }}</div>
      </div>
    </transition>
    <!-- Encouragement Toast -->
    <transition name="fade">
      <div v-if="encouragementVisible" class="encouragement-toast">{{ encouragementMsg }}</div>
    </transition>

    <div class="main" v-if="started && currentSentence">
      <div class="audio-bar">
        <button class="btn-audio" @click="playAudio" :disabled="isPlaying" title="播放语音">
          <span v-if="isPlaying">▶▶</span>
          <span v-else>▶</span>
          播放
        </button>
        <div class="audio-progress" v-if="isPlaying">
          <div class="progress-track"></div>
        </div>
      </div>

      <div class="sentence-area">
        <div class="blanks-row" ref="blanksContainer">
            <span
              v-for="(w, wi) in parsedWords"
              :key="wi"
              class="word-slot"
              :class="{
                filled: w.filled,
                active: activeWordIndex === wi,
                correct: w.filled && w.isCorrect,
                incorrect: w.filled && !w.isCorrect,
              }"
              :style="{ minWidth: w.width + 'px' }"
              @click="focusWord(wi)"
            >{{ w.filled ? w.value : '' }}</span>
            <span class="word-space">&nbsp;</span>

        </div>
      </div>

      <input ref="hiddenInput" class="hidden-input" @input="onInput" @keydown="onKeydown" @blur="refocus"
        autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />

      <div class="reference-section">
        <button class="btn-reference" @click="showReference = !showReference">
          {{ showReference ? '隐藏' : '显示' }}完整句子
        </button>
        <transition name="fade">
          <div v-if="showReference" class="reference-section-detail">
            <div class="reference-text">{{ currentText }}</div>
            <div class="reference-translation">{{ currentTranslation }}</div>
          </div>
        </transition>
      </div>

      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: totalWords ? (filledCount / totalChars * 100) + '%' : '0%' }"></div>
      </div>

      <div class="mode-bar">
        <button class="btn-mode" :class="{ active: practiceMode === 'all' }" @click="switchMode('all')">All</button>
        <button class="btn-mode" :class="{ active: practiceMode === 'wrong' }" @click="switchMode('wrong')" :disabled="wrongSentencesList.length === 0">
          Wrong ({{ wrongSentencesList.length }})
        </button>
        <span class="timer-display">{{ Math.floor(elapsedSeconds / 60) }}:{{ String(elapsedSeconds % 60).padStart(2, '0') }}</span>
      </div>
      <div class="nav-buttons">
        <label class="auto-toggle">
          <input type="checkbox" v-model="autoAdvance" />
          <span class="toggle-label">自动下一句</span>
        </label>
        <button class="btn-nav" @click="prevSentence" :disabled="currentIndex === 0">← 上一句</button>
        <button class="btn-nav" @click="resetCurrent">重置</button>
        <button class="btn-nav" @click="nextSentence"
          :disabled="currentIndex >= sentences.length - 1 && !allFilled">下一句 →</button>
      </div>
    </div>

        <div v-if="started && !currentSentence" class="completion">
      <div v-if="savingSession" style="font-size:14px;color:#666;margin-bottom:12px;">Saving...</div>
      <div class="completion-icon">🎉</div>
      <h2>练习完成!</h2>
      <div class="session-stats">
        <div class="stat-item"><span class="stat-num">{{ sentences.length }}</span><span class="stat-label">Sentences</span></div>
        <div class="stat-item"><span class="stat-num">{{ perfectCount }}</span><span class="stat-label">Perfect</span></div>
        <div class="stat-item"><span class="stat-num">{{ formatTime(elapsedSeconds) }}</span><span class="stat-label">Time</span></div>
        <div class="stat-item"><span class="stat-num">{{ sentences.length - wrongSentencesSet.size }}</span><span class="stat-label">Correct</span></div>
      </div>
      <p class="encourage-text">{{ completionMessage }}</p>
      <div class="comp-buttons">
        <button class="btn-nav btn-share" @click="shareResults">Share</button>
        <button class="btn-nav" @click="restart">再来一次</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from "vue";
import { wfdSentences } from "./data/sentences.js";
import { isLoggedIn, getUserEmail, logout as apiLogout, login, register, savePracticeSession, getWrongSentences, savePracticeState, loadPracticeState } from "./api.js";

const sentences = ref([]);
const currentIndex = ref(0);
const userInput = ref({});
const activeSlot = ref(null);
const activeWordIndex = ref(-1);
const showReference = ref(false);
const isPlaying = ref(false);
const selectedVoiceName = ref(localStorage.getItem("pte_voice") || "");
const availableVoices = ref([]);
const autoAdvance = ref(true);
const started = ref(false);
const loggedIn = ref(isLoggedIn());
const userEmail = ref(getUserEmail() || "");
const authMode = ref("login");  // "login" | "register"
const authEmail = ref("");
const authPassword = ref("");
const authError = ref("");
const authLoading = ref(false);
const needsVerify = ref(false);
const verifyEmailRef = ref("");
const verifyCode = ref("");
const verifyPreviewUrl = ref(null);
const verifyEmailSent = ref(false);
const verifyDevCode = ref("");
const verifyMessage = ref("");
const sessionStart = ref(0);
const elapsedSeconds = ref(0);
let timerInterval = null;
const wrongSentencesSet = ref(new Set());
const practiceMode = ref("all");
const selectedCategory = ref("all"); // "all" | "basic" | "jj"  // "all" | "wrong"
const wrongSentencesList = ref([]);
const savingSession = ref(false);
const hasSavedState = ref(false);
const savedStateData = ref(null);
const perfectCount = ref(0);
const showCelebration = ref(false);
const celebrationText = ref("");
const encouragementMsg = ref("");
const encouragementVisible = ref(false);
const sessionAccuracy = ref(0);
const hiddenInput = ref(null);
const blanksContainer = ref(null);

function selectCategory(cat) {
  selectedCategory.value = cat;
}

function startWithCategory() {
  let list = wfdSentences;
  if (selectedCategory.value !== "all") {
    list = wfdSentences.filter(s => s.category === selectedCategory.value);
  }
  if (list.length === 0) list = wfdSentences;
  startPractice(list);
}

function startPractice(list) {
  sentences.value = [...list];
  shuffleArray(sentences.value);
  started.value = true;
  currentIndex.value = 0;
  userInput.value = {};
  sessionStart.value = Date.now();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    elapsedSeconds.value = Math.floor((Date.now() - sessionStart.value) / 1000);
  }, 1000);
  nextTick(() => focusFirstEmpty());
  setTimeout(() => playAudio(), 600);
  saveCurrentState();
}

onMounted(() => {
  if (isLoggedIn()) {
    startPractice(wfdSentences);
  }
  function loadVoices() {
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      availableVoices.value = voices.filter(v => v.lang.startsWith("en")).map(v => ({ name: v.name, lang: v.lang }));
    }
  }
  loadVoices();
  speechSynthesis.onvoiceschanged = () => {
    loadVoices();
    getBestVoice();
  };
});

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

const currentSentence = computed(() => sentences.value[currentIndex.value] ?? null);
const currentText = computed(() => currentSentence.value?.en ?? "");
const currentTranslation = computed(() => currentSentence.value?.zh ?? "");
const completionMessage = computed(() => {
  const total = sentences.value.length;
  const perfect = perfectCount.value;
  if (perfect === total) return "全部正确，太厉害了！";
  if (perfect >= total * 0.8) return "非常出色，继续保持！";
  if (perfect >= total * 0.5) return "做得不错，再来一次会更好！";
  return "每次练习都在进步，坚持下去！";
});

const parsedWords = computed(() => {
  if (!currentText.value) return [];
  const rawWords = currentText.value.split(/\s+/).filter(w => w.length > 0);
  const result = [];
  rawWords.forEach((rawWord, wi) => {
    const cleanWord = rawWord.replace(/[^a-zA-Z]/g, "");
    if (cleanWord.length === 0) return; // skip pure punctuation
    const key = String(result.length);
    const userVal = userInput.value[key] || "";
    const cleanVal = userVal.replace(/[^a-zA-Z]/g, "");
    result.push({
      word: cleanWord, display: rawWord, key,
      filled: userVal !== "", value: userVal,
      isCorrect: cleanVal.toLowerCase() === cleanWord.toLowerCase(),
      width: cleanWord.length * 17 + 10,
    });
  });
  return result;
});

const totalWords = computed(() =>
  parsedWords.value.reduce((sum, w) => sum + w.chars.filter(c => c.isLetter).length, 0)
);

const filledCount = computed(() => parsedWords.value.filter(w => w.filled).length);

const allFilled = computed(() => totalWords.value > 0 && filledCount.value === totalWords.value);

watch(allFilled, (val) => {
  if (val && autoAdvance.value) {
    setTimeout(() => {
      if (currentIndex.value < sentences.value.length - 1) {
        nextSentence();
      } else {
        checkCurrentSentence();
        finishSession();
        currentIndex.value = sentences.value.length;
        clearState();
      }
    }, 800);
  }
});

function focusSlot(wi, ci) { focusWord(wi); }
function focusWord(wi) {
  if (wi < 0 || wi >= parsedWords.value.length) return;
  activeWordIndex.value = wi;
  nextTick(() => hiddenInput.value?.focus());
}

function focusFirstEmpty() {
  for (let i = 0; i < parsedWords.value.length; i++) {
    if (!parsedWords.value[i].filled) { focusWord(i); return; }
  }
  if (parsedWords.value.length > 0) focusWord(0);
}

function onInput(e) {
  if (activeWordIndex.value < 0) { hiddenInput.value.value = ""; return; }
  const val = e.target.value;
  if (!val) return;
  const cleaned = val.replace(/[^a-zA-Z]/g, "");
  if (!cleaned) { hiddenInput.value.value = ""; return; }
  const key = String(activeWordIndex.value);
  const newVal = (userInput.value[key] || "") + cleaned;
  userInput.value = { ...userInput.value, [key]: newVal };
  playKeySound();
  hiddenInput.value.value = "";
  const wordLen = parsedWords.value[activeWordIndex.value]?.word.length || 5;
  if (newVal.length >= wordLen) moveToNextEmpty(activeWordIndex.value);
}

function onKeydown(e) {
  if (e.key === "Backspace") {
    e.preventDefault();
    if (activeWordIndex.value < 0) return;
    const key = String(activeWordIndex.value);
    const cur = userInput.value[key] || "";
    if (cur.length > 0) {
      userInput.value = { ...userInput.value, [key]: cur.slice(0, -1) };
    } else if (activeWordIndex.value > 0) {
      focusWord(activeWordIndex.value - 1);
    }
    return;
  }
  if (e.key === "ArrowLeft") { e.preventDefault(); if (activeWordIndex.value > 0) focusWord(activeWordIndex.value - 1); return; }
  if (e.key === "ArrowRight") { e.preventDefault(); if (activeWordIndex.value < parsedWords.value.length - 1) focusWord(activeWordIndex.value + 1); return; }
  if (e.key === " ") {
    e.preventDefault();
    moveToNextEmpty(activeWordIndex.value);
    return;
  }
  if (/^[a-zA-Z]$/.test(e.key)) {
    e.preventDefault();
    if (activeWordIndex.value < 0) return;
    const key = String(activeWordIndex.value);
    const newVal = (userInput.value[key] || "") + e.key;
    userInput.value = { ...userInput.value, [key]: newVal }; playKeySound();
    const wordLen = parsedWords.value[activeWordIndex.value]?.word.length || 5;
    if (newVal.length >= wordLen) setTimeout(() => moveToNextEmpty(activeWordIndex.value), 50);
  }
}

function moveToNextEmpty(wi) {
  if (wi < parsedWords.value.length - 1) focusWord(wi + 1);
}

function refocus() { nextTick(() => hiddenInput.value?.focus()); }

function nextSentence() {
  checkCurrentSentence();
  if (currentIndex.value < sentences.value.length - 1) {
    const totalDone = currentIndex.value + 1;
    if (totalDone > 0 && totalDone % 5 === 0) {
      const msgs = ["Keep up the great work!", "You're making excellent progress!", "Consistency is key!", "Every sentence makes you stronger!", "Practice makes perfect!"];
      encouragementMsg.value = msgs[Math.floor(Math.random() * msgs.length)];
      encouragementVisible.value = true;
      setTimeout(() => { encouragementVisible.value = false; }, 2500);
    }
    currentIndex.value++;
    userInput.value = {};
    activeSlot.value = null;
    nextTick(() => focusFirstEmpty());
    saveCurrentState();
    setTimeout(() => playAudio(), 400);
  }
}

function prevSentence() {
  if (currentIndex.value > 0) {
    currentIndex.value--;
    userInput.value = {};
    activeSlot.value = null;
    nextTick(() => focusFirstEmpty());
    saveCurrentState();
    setTimeout(() => playAudio(), 400);
  }
}

function checkCurrentSentence() {
  // Check if current sentence has any errors
  if (!currentSentence.value) return;
  const words = parsedWords.value;
  let hasError = false;
  for (const w of words) {
    for (const c of w.chars) {
      if (c.isLetter && c.filled && !c.isCorrect) {
        hasError = true;
        break;
      }
    }
    if (hasError) break;
  }
  if (hasError) {
    const en = currentSentence.value.en;
    const s = wrongSentencesSet.value;
    s.add(en);
    wrongSentencesSet.value = new Set(s);
  }
}

async function switchMode(mode) {
  if (mode === practiceMode.value) return;
  if (mode === "wrong") {
    // Load wrong sentences from server
    const list = await getWrongSentences();
    wrongSentencesList.value = list;
    if (list.length === 0) return;
    // Find matching sentence objects
    const matched = wfdSentences.filter(s => list.includes(s.en));
    if (matched.length === 0) return;
    practiceMode.value = mode;
    if (timerInterval) clearInterval(timerInterval);
    startPractice(matched);
  } else {
    practiceMode.value = mode;
    if (timerInterval) clearInterval(timerInterval);
    startPractice(wfdSentences);
  }
}

function fmtTime(s) { if (!s) return "0:00"; const m = Math.floor(s / 60); return m + ":" + String(s % 60).padStart(2, "0"); }

function saveCurrentState() {
  if (!loggedIn.value || !started.value || sentences.value.length === 0) return;
  try {
    savePracticeState({
      sentences: sentences.value.map(s => ({ en: s.en, zh: s.zh, category: s.category })),
      currentIndex: currentIndex.value,
      userInput: userInput.value,
      category: selectedCategory.value,
      mode: practiceMode.value,
    });
  } catch (e) { console.error('[PTE] saveState failed:', e); }
}

async function clearState() {
  if (!loggedIn.value) return;
  try { await savePracticeState({}); } catch (e) {}
  hasSavedState.value = false;
  savedStateData.value = null;
}

async function checkSavedState(autoResume = false) {
  console.warn('[PTE] checkSavedState called, loggedIn:', loggedIn.value, 'autoResume:', autoResume);
  if (!loggedIn.value) return;
  try {
    const state = await loadPracticeState();
    console.warn('[PTE] loadPracticeState returned:', state);
    console.log('Loaded state from server:', JSON.stringify({ hasIds: !!state?.sentenceIds, idCount: state?.sentenceIds?.length || state?.sentences?.length || 0, index: state?.currentIndex }));
    if (state && ((state.sentenceIds && state.sentenceIds.length > 0) || (state.sentences && state.sentences.length > 0))) {
      hasSavedState.value = true;
      savedStateData.value = state;
      if (autoResume) resumePractice();
    }
  } catch (e) { console.error('[PTE] checkSavedState error:', e); }
}

function resumePractice() {
  if (!savedStateData.value) return;
  const state = savedStateData.value;
  // Restore sentence order by ID
  if (state.sentenceIds && state.sentenceIds.length > 0) {
    const lookup = {};
    wfdSentences.forEach(s => { lookup[s.id] = s; });
    const restored = state.sentenceIds.map(id => lookup[id]).filter(Boolean);
    if (restored.length > 0) sentences.value = restored;
    else sentences.value = state.sentenceIds; // fallback for old format
  } else if (state.sentences && state.sentences.length > 0) {
    sentences.value = state.sentences; // old format fallback
  } else {
    return;
  }
  currentIndex.value = Math.min(state.currentIndex || 0, sentences.value.length - 1);
  userInput.value = state.userInput || {};
  selectedCategory.value = state.category || "all";
  practiceMode.value = state.mode || "all";
  started.value = true;
  hasSavedState.value = false;
  sessionStart.value = Date.now();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => { elapsedSeconds.value = Math.floor((Date.now() - sessionStart.value) / 1000); }, 1000);
  nextTick(() => { if (parsedWords.value.length > 0) focusFirstEmpty(); });
  setTimeout(() => saveCurrentState(), 300);
}

async function finishSession() {
  if (savingSession.value) return;
  savingSession.value = true;
  if (timerInterval) clearInterval(timerInterval);
  const duration = elapsedSeconds.value;
  const practiced = sentences.value.length;
  const wrong = [...wrongSentencesSet.value];
  try {
    await savePracticeSession(duration, practiced, wrong);
  } catch (e) {
    // silently fail
  }
  savingSession.value = false;
}

function resetCurrent() { userInput.value = {}; activeSlot.value = null; nextTick(() => focusFirstEmpty()); }

function shareResults() {
  const text = `PTE WFD Practice Summary\n✔ ${sentences.value.length} sentences\n⭐ ${perfectCount.value} perfect\n⏱ ${formatTime(elapsedSeconds.value)}\n\nKeep practicing!`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      encouragementMsg.value = "Copied!";
      encouragementVisible.value = true;
      setTimeout(() => { encouragementVisible.value = false; }, 2000);
    });
  }
}

function restart() {
  checkCurrentSentence();
  finishSession();
  wrongSentencesSet.value = new Set();
  if (practiceMode.value === "wrong" && wrongSentencesList.value.length > 0) {
    const matched = wfdSentences.filter(s => wrongSentencesList.value.includes(s.en));
    startPractice(matched.length > 0 ? matched : wfdSentences);
  } else {
    practiceMode.value = "all";
    startPractice(wfdSentences);
  }
  showReference.value = false;
  clearState();
}

// Preload best English voice
let preferredVoice = null;
function getBestVoice() {
  if (preferredVoice) return preferredVoice;
  const voices = speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  // Priority: native en-US voices with highest quality
  const ranked = voices.filter(v => v.lang.startsWith("en"));
  const best = ranked.find(v => v.name.includes("Google")) ||
               ranked.find(v => v.name.includes("Natural")) ||
               ranked.find(v => v.name.includes("Samantha")) ||
               ranked.find(v => v.name.includes("Zira")) ||
               ranked.find(v => v.name.includes("David")) ||
               ranked.find(v => v.name.includes("Mark")) ||
               ranked.find(v => v.name.includes("Susan")) ||
               ranked.find(v => v.lang === "en-US") ||
               ranked[0];
  preferredVoice = best;
  return best;
}

async function doLogin() {
  authError.value = ""; authLoading.value = true;
  try {
    const fn = authMode.value === "register" ? register : login;
    const data = await fn(authEmail.value, authPassword.value);
    loggedIn.value = true;
    userEmail.value = data.email;
  } catch (e) {
    authError.value = e.message;
  } finally {
    authLoading.value = false;
  }
}

async function doVerify() {
  authError.value = ""; authLoading.value = true;
  try {
    const data = await verifyEmail(verifyEmailRef.value, verifyCode.value);
    loggedIn.value = true;
    userEmail.value = data.email;
    needsVerify.value = false;
    checkSavedState(true);
  } catch (e) {
    authError.value = e.message;
  } finally {
    authLoading.value = false;
  }
}

async function doResendCode() {
  authError.value = "";
  try {
    const data = await resendVerificationCode(verifyEmailRef.value);
    verifyPreviewUrl.value = data.previewUrl;
    verifyMessage.value = "Code resent to your email";
  } catch (e) {
    authError.value = e.message;
  }
}

function doLogout() {
  apiLogout();
  loggedIn.value = false;
  userEmail.value = "";
  sentences.value = [];
  started.value = false;
  if (timerInterval) clearInterval(timerInterval);
  saveCurrentState();
}

function onVoiceChange() {
  localStorage.setItem("pte_voice", selectedVoiceName.value);
}

function playAudio() {
  if (!currentText.value || isPlaying.value) return;
  speechSynthesis.cancel();

  const voices = speechSynthesis.getVoices();
  if (voices.length === 0) {
    speechSynthesis.onvoiceschanged = () => {
      speechSynthesis.onvoiceschanged = null;
      playAudio();
    };
    return;
  }

  let voice;
  if (selectedVoiceName.value) {
    const voices = speechSynthesis.getVoices();
    voice = voices.find(v => v.name === selectedVoiceName.value) || getBestVoice();
  } else {
    voice = getBestVoice();
  }
  isPlaying.value = true;

  const u = new SpeechSynthesisUtterance(currentText.value);
  u.lang = "en-US";
  u.rate = 0.82;
  u.pitch = 1;
  if (voice) u.voice = voice;

  u.onend = () => { isPlaying.value = false; };
  u.onerror = () => { isPlaying.value = false; };

  speechSynthesis.speak(u);
}

// Key press sound
let audioCtx = null;
function playKeySound() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.05);
  gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.1);
}

</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background: #f0f2f5; color: #1a1a2e; min-height: 100vh; }
.app { max-width: 720px; margin: 0 auto; padding: 24px 16px; min-height: 100vh; }
.header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 20px; border-bottom: 1px solid #e0e0e0; margin-bottom: 24px; }
.header h1 { font-size: 22px; font-weight: 700; color: #1a1a2e; }
.counter { font-size: 14px; color: #666; background: #e8e8ec; padding: 4px 12px; border-radius: 12px; font-weight: 600; }
.audio-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.btn-audio { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; background: #2d6a4f; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
.btn-audio:hover:not(:disabled) { background: #1b4332; }
.btn-audio:disabled { opacity: 0.6; cursor: not-allowed; }
.audio-progress { flex: 1; }
.progress-track { height: 4px; background: #e0e0e0; border-radius: 2px; animation: pulse 1.5s infinite; }
@keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
.sentence-area { background: #fff; border-radius: 12px; padding: 28px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); margin-bottom: 16px; }
.blanks-row { display: flex; flex-wrap: wrap; align-items: flex-end; line-height: 2.2; }
.word-group { display: inline-flex; font-size: 26px; gap: 4px; }
.word-space { width: 20px; display: inline-block; font-size: 26px; }
.word-slot { display: inline-flex; align-items: center; justify-content: center; height: 46px; font-size: 22px; font-weight: 600; color: #333; cursor: pointer; transition: border-color 0.15s, color 0.15s; user-select: none; border-bottom: 1.5px solid #bbb; padding: 0 10px; margin: 0 3px; min-width: 40px; }
.word-slot.filled { border-bottom: 1.5px solid #2d6a4f; color: #1a1a2e; }
.word-slot.correct { color: #2d6a4f; }
.word-slot.incorrect { color: #d32f2f; border-bottom: 1.5px solid #d32f2f; }
.word-slot.active { border-bottom: 1.5px solid #1a73e8; color: #1a73e8; box-shadow: 0 1px 0 #1a73e8; }
.char-slot { display: inline-flex; align-items: center; justify-content: center; min-width: 32px; height: 46px; font-size: 26px; font-weight: 600; color: #333; cursor: pointer; transition: border-color 0.15s, color 0.15s; user-select: none; border-bottom: 1.5px solid #bbb; }
.char-slot.punctuation { border-bottom: none; min-width: auto; width: auto; cursor: default; color: #555; padding: 0 1px; }
.char-slot.filled { border-bottom: 1.5px solid #2d6a4f; color: #1a1a2e; }
.char-slot.correct { color: #2d6a4f; }
.char-slot.incorrect { color: #d32f2f; border-bottom: 1.5px solid #d32f2f; }
.char-slot.active { border-bottom: 1.5px solid #1a73e8; color: #1a73e8; }
.hidden-input { position: fixed; left: -9999px; top: -9999px; opacity: 0; width: 0; height: 0; }
.reference-section { margin-bottom: 12px; }
.btn-reference { padding: 8px 16px; background: transparent; color: #1a73e8; border: 1px solid #1a73e8; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
.btn-reference:hover { background: #e8f0fe; }
.reference-text { margin-top: 10px; padding: 12px 16px; background: #fff; border-radius: 8px; border-left: 4px solid #2d6a4f; font-size: 18px; font-weight: 500; color: #333; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.progress-bar { height: 6px; background: #e0e0e0; border-radius: 3px; margin-bottom: 16px; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #2d6a4f, #52b788); border-radius: 3px; transition: width 0.3s ease; }
.nav-buttons { display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap; }
.auto-toggle { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; color: #666; user-select: none; }
.auto-toggle input { width: 16px; height: 16px; accent-color: #2d6a4f; cursor: pointer; }
.toggle-label { line-height: 1; }
.btn-nav { padding: 10px 20px; background: #fff; color: #333; border: 1px solid #d0d0d0; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
.btn-nav:hover:not(:disabled) { background: #f0f0f0; border-color: #bbb; }
.btn-nav:disabled { opacity: 0.4; cursor: not-allowed; }
.completion { text-align: center; padding: 60px 20px; }
.completion-icon { font-size: 64px; margin-bottom: 16px; }
.completion h2 { font-size: 24px; margin-bottom: 8px; }
.completion p { font-size: 16px; color: #666; margin-bottom: 24px; }
.completion .btn-nav { background: #2d6a4f; color: #fff; border-color: #2d6a4f; font-size: 16px; padding: 12px 28px; }
.reference-section-detail { }
.reference-translation {
  margin-top: 8px;
  padding: 10px 16px;
  background: #f8f9fa;
  border-radius: 8px;
  font-size: 15px;
  color: #666;
  border-left: 3px solid #ddd;
}
.auth-page { display: flex; justify-content: center; align-items: center; min-height: 60vh; }
.auth-card { background: #fff; border-radius: 12px; padding: 32px; width: 100%; max-width: 380px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: center; }
.auth-card h2 { font-size: 20px; margin-bottom: 20px; color: #1a1a2e; }
.auth-tabs { display: flex; gap: 0; margin-bottom: 16px; border-radius: 8px; overflow: hidden; border: 1px solid #d0d0d0; }
.auth-tabs button { flex: 1; padding: 8px; border: none; background: #f5f5f5; font-size: 14px; cursor: pointer; color: #666; }
.auth-tabs button.active { background: #2d6a4f; color: #fff; }
.auth-input { width: 100%; padding: 10px 12px; border: 1px solid #d0d0d0; border-radius: 8px; font-size: 14px; margin-bottom: 10px; outline: none; }
.auth-input:focus { border-color: #2d6a4f; }
.cat-options { display: flex; gap: 8px; margin-bottom: 4px; }
.btn-cat { flex: 1; padding: 10px 8px; border: 2px solid #d0d0d0; border-radius: 8px; background: #fff; font-size: 14px; font-weight: 500; cursor: pointer; color: #666; transition: all 0.2s; }
.btn-cat:hover { border-color: #2d6a4f; color: #2d6a4f; }
.btn-cat.active { border-color: #2d6a4f; background: #2d6a4f; color: #fff; }
.auth-error { color: #d32f2f; font-size: 13px; margin-bottom: 10px; }
.btn-auth { width: 100%; padding: 10px; background: #2d6a4f; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; }
.btn-auth:disabled { opacity: 0.6; cursor: not-allowed; }
.verify-msg { font-size: 13px; color: #666; margin-bottom: 12px; }
.verify-link { display: block; font-size: 13px; color: #1a73e8; margin-bottom: 12px; text-decoration: underline; }
.verify-link:hover { color: #1557b0; }
.btn-link { background: none; border: none; color: #1a73e8; font-size: 13px; cursor: pointer; margin-top: 8px; display: block; width: 100%; text-align: center; }
.btn-link:hover { text-decoration: underline; }
.verify-dev-code { background: #e8f5e9; border: 1px solid #a5d6a7; border-radius: 8px; padding: 12px; margin-bottom: 12px; text-align: center; }
.verify-dev-code span { font-size: 13px; color: #2e7d32; }
.verify-dev-code strong { font-size: 24px; letter-spacing: 6px; color: #1b5e20; display: block; margin-top: 4px; }
.verify-email-sent { background: #e3f2fd; border: 1px solid #90caf9; border-radius: 8px; padding: 12px; margin-bottom: 12px; font-size: 13px; color: #1565c0; text-align: center; }
.user-info { display: flex; align-items: center; gap: 8px; }
.user-email { font-size: 12px; color: #888; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.btn-logout { background: none; border: none; color: #999; font-size: 18px; cursor: pointer; padding: 0 4px; line-height: 1; }
.btn-logout:hover { color: #d32f2f; }
.mode-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.btn-mode { padding: 6px 12px; border: 1px solid #d0d0d0; border-radius: 6px; background: #fff; font-size: 12px; cursor: pointer; color: #666; }
.btn-mode.active { background: #2d6a4f; color: #fff; border-color: #2d6a4f; }
.btn-mode:disabled { opacity: 0.4; cursor: not-allowed; }
.voice-select { padding: 4px 8px; border: 1px solid #d0d0d0; border-radius: 6px; font-size: 12px; color: #666; background: #fff; max-width: 140px; outline: none; }
.voice-select:focus { border-color: #2d6a4f; }
.timer-display { margin-left: auto; font-size: 13px; color: #888; font-variant-numeric: tabular-nums; }
.celebration-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.celebration-text { font-size: 48px; font-weight: 800; color: #fff; text-shadow: 0 4px 20px rgba(0,0,0,0.3); animation: popIn 0.4s ease-out; }
@keyframes popIn { 0% { transform: scale(0.3); opacity: 0; } 70% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
.encouragement-toast { position: fixed; top: 80px; left: 50%; transform: translateX(-50%); background: #2d6a4f; color: #fff; padding: 12px 28px; border-radius: 24px; font-size: 16px; font-weight: 600; z-index: 99; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
.session-stats { display: flex; gap: 12px; justify-content: center; margin: 16px 0; flex-wrap: wrap; }
.stat-item { background: #f8f9fa; border-radius: 12px; padding: 14px 18px; text-align: center; min-width: 70px; }
.stat-num { display: block; font-size: 26px; font-weight: 700; color: #2d6a4f; }
.stat-label { display: block; font-size: 11px; color: #888; margin-top: 2px; }
.encourage-text { font-size: 16px; color: #555; margin-bottom: 16px; font-style: italic; }
.comp-buttons { display: flex; gap: 10px; justify-content: center; }
.btn-share { background: #1a73e8; color: #fff; border-color: #1a73e8; }
.btn-share:hover { background: #1557b0; }
.completion .btn-nav:hover { background: #1b4332; }
</style>
