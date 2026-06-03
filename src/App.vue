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
      <span class="counter" @click="showSentenceList = !showSentenceList" style="cursor:pointer;position:relative">{{ currentIndex + 1 }} / {{ sentences.length }} <span style="font-size:10px">&#9660;</span></span>
    </header>
    <!-- Sentence Dropdown -->
    <div v-if="showSentenceList" class="sentence-dropdown" @click.self="showSentenceList=false">
      <div class="sentence-dropdown-content">
        <div v-for="(s,i) in sentences" :key="s.id" 
             :class="['sentence-dropdown-item', { current: i===currentIndex, familiar: familiarIds.has(s.id) }]"
             @click="jumpToSentence(i); showSentenceList=false">
          <span class="sentence-dropdown-num">{{ i+1 }}</span>
          <span class="sentence-dropdown-text">{{ s.en.substring(0,50) }}{{ s.en.length>50?'...':'' }}</span>
          <span v-if="familiarIds.has(s.id)" class="sentence-dropdown-tag">Familiar</span>
        </div>
      </div>
    </div>


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
        <h2>Select Course</h2>
        <div class="cat-options" v-if="courses.length > 0">
          <button v-for="c in courses" :key="c.id" class="btn-cat" :class="{ active: selectedCourseId === c.id }" @click="startWithCourse(c.id)">{{ c.name }}</button>
        </div>
        <div v-else style="color:#888;font-size:14px;margin-bottom:12px">{{ loadingSentences ? 'Loading...' : 'No courses available' }} (courses.value.length = {{ courses.length }})</div>
        <button v-if="hasSavedState" class="btn-auth" style="margin-top:12px;background:#1a73e8" @click="resumePractice">Continue</button></div>
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
        <button class="btn-familiar" @click="markFamiliar" title="Mark as familiar"> 已熟悉</button>
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
            >{{ w.value || '' }}</span>
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
        <select v-model="repeatCount" class="voice-select" style="max-width:70px" title="Repeat">
          <option :value="1">x1</option>
          <option :value="5">x5</option>
          <option :value="10">x10</option>
        </select>
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
    <footer class="app-footer">
      <span>Visits: {{ visitCount.toLocaleString() }}</span>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from "vue";
import { isLoggedIn, getUserEmail, logout as apiLogout, login, register, savePracticeSession, getWrongSentences, savePracticeState, loadPracticeState, getCourses, getCourseSentences } from "./api.js";

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
const repeatCount = ref(1);
const currentRepeat = ref(1);
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
const selectedCourseId = ref(null);
const courses = ref([]);
const loadingSentences = ref(false);
const visitCount = ref(0);
const familiarIds = ref(new Set());
const showSentenceList = ref(false); // "all"  // "all" | "wrong"
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

async function fetchCourses() {
  try {
    const list = await getCourses();
    console.log('[PTE] fetchCourses got', list.length, 'courses:', list.map(c => c.name));
    courses.value = list;
  } catch(e) { console.error('[PTE] Failed to load courses:', e); }
}

async function startWithCourse(courseId) {
  selectedCourseId.value = courseId;
  loadingSentences.value = true;
  try {
    let list = await getCourseSentences(courseId);
    list = list.map(s => ({ id: s.id, en: s.title, zh: s.translation || "", category: s.category || "basic" }));
    if (list.length === 0) return;
    startPractice(list);
  } catch(e) { console.error('Failed to load sentences:', e); }
  finally { loadingSentences.value = false; }
}

function startPractice(list) {
  sentences.value = [...list];
  shuffleArray(sentences.value);
  started.value = true;
  currentIndex.value = 0;
  userInput.value = {};
  currentRepeat.value = 1;
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
    // no default sentences, user selects course
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
    const cleanWord = rawWord.replace(/[^a-zA-Z'\-]/g, "").replace(/^['\-]+|['\-]+$/g, "");
    if (cleanWord.length === 0) return; // skip pure punctuation
    const key = String(result.length);
    const userVal = userInput.value[key] || "";
    const cleanVal = userVal.replace(/[^a-zA-Z'\-]/g, "").replace(/^['\-]+|['\-]+$/g, "");
    result.push({
      word: cleanWord, display: rawWord, key,
      filled: cleanVal.length >= cleanWord.length, value: userVal,
      isCorrect: cleanVal.toLowerCase() === cleanWord.toLowerCase(),
      width: cleanWord.length * 17 + 10,
    });
  });
  return result;
});

const totalWords = computed(() =>
  parsedWords.value.length
);

const filledCount = computed(() => (parsedWords.value || []).filter(w => w.filled).length);

const allFilled = computed(() => totalWords.value > 0 && filledCount.value === totalWords.value);

watch(allFilled, (val) => {
  console.log('[PTE] allFilled:', val, 'filled:', filledCount.value, 'total:', totalWords.value, 'auto:', autoAdvance.value);
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
  const cleaned = val.replace(/[^a-zA-Z'\-]/g, "");
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
    if (allFilled.value) {
      if (currentIndex.value < sentences.value.length - 1) nextSentence();
      return;
    }
    moveToNextEmpty(activeWordIndex.value);
    return;
  }
  if (/^[a-zA-Z'\-]$/.test(e.key)) {
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
  if (repeatCount.value > 1 && currentRepeat.value < repeatCount.value) {
    currentRepeat.value++;
    userInput.value = {};
    activeWordIndex.value = -1;
    nextTick(() => focusFirstEmpty());
    setTimeout(() => playAudio(), 400);
    return;
  }
  currentRepeat.value = 1;
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
    activeWordIndex.value = -1;
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
  if (!currentSentence.value) return;
  const hasError = parsedWords.value.some(w => w.filled && !w.isCorrect);
  if (hasError) {
    const s = wrongSentencesSet.value;
    s.add(currentSentence.value.en);
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
    const matched = (sentences.value.length > 0 ? sentences.value : []).filter(s => list.includes(s.en));
    if (matched.length === 0) return;
    practiceMode.value = mode;
    if (timerInterval) clearInterval(timerInterval);
    startPractice(matched);
  } else {
    practiceMode.value = mode;
    if (timerInterval) clearInterval(timerInterval);
    // no default sentences, user selects course
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
      category: selectedCourseId.value || 'all',
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
    if (state.sentences && state.sentences.length > 0) sentences.value = state.sentences;
    else if (state.sentenceIds && state.sentenceIds.length > 0) sentences.value = state.sentenceIds; // fallback for old format
  } else if (state.sentences && state.sentences.length > 0) {
    sentences.value = state.sentences; // old format fallback
  } else {
    return;
  }
  currentIndex.value = Math.min(state.currentIndex || 0, sentences.value.length - 1);
  userInput.value = state.userInput || {};
  selectedCourseId.value = state.category || "all";
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
    const currentSents = sentences.value.length > 0 ? sentences.value : [];
    const matched = currentSents.filter(s => wrongSentencesList.value.includes(s.en));
    startPractice(matched.length > 0 ? matched : currentSents);
  } else {
    practiceMode.value = "all";
    // no default sentences, user selects course
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
    fetchCourses();
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

async function trackVisit() {
  try {
    const res = await fetch("/api/stats/visit", { method: "POST" });
    const data = await res.json();
    visitCount.value = data.visits;
  } catch(e) {}
}

function markFamiliar() {
  if (!currentSentence.value) return;
  const id = currentSentence.value.id;
  const s = new Set(familiarIds.value);
  s.add(id);
  familiarIds.value = s;
  // Remove current sentence from list
  sentences.value = sentences.value.filter((_, i) => i !== currentIndex.value);
  if (sentences.value.length === 0) {
    currentIndex.value = -1;
    finishSession();
    return;
  }
  if (currentIndex.value >= sentences.value.length) {
    currentIndex.value = sentences.value.length - 1;
  }
  userInput.value = {};
  activeWordIndex.value = -1;
  saveCurrentState();
  nextTick(() => focusFirstEmpty());
  setTimeout(() => playAudio(), 400);
}

function jumpToSentence(idx) {
  if (idx < 0 || idx >= sentences.value.length) return;
  currentIndex.value = idx;
  userInput.value = {};
  activeWordIndex.value = -1;
  saveCurrentState();
  nextTick(() => focusFirstEmpty());
  setTimeout(() => playAudio(), 400);
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
@keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
@keyframes popIn { 0% { transform: scale(0.3); opacity: 0; } 70% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
.hidden-input { position: fixed; left: -9999px; top: -9999px; opacity: 0; width: 0; height: 0; }
.word-slot { border-bottom-width: 1.5px; }
.word-slot.filled { border-color: #2d6a4f; color: #1a1a2e; }
.word-slot.correct { color: #2d6a4f; }
.word-slot.incorrect { color: #d32f2f; border-color: #d32f2f; }
.word-slot.active { border-color: #1a73e8; color: #1a73e8; box-shadow: 0 1px 0 #1a73e8; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
