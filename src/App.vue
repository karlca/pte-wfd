<template>
  <div class="app max-w-5xl mx-auto px-6 py-8 min-h-screen bg-[var(--tw-bg-main)] text-[var(--tw-text-main)]">
    <header class="header flex items-center justify-between pb-5 border-b border-[var(--tw-border)] mb-6">
      <div class="flex items-center gap-3">
        <button v-if="started" @click="goBack" class="flex items-center justify-center w-9 h-9 rounded-lg border border-[var(--tw-border)] bg-[var(--tw-bg-card)] text-[var(--tw-text-muted)] hover:text-[var(--tw-primary)] hover:border-[var(--tw-primary)] transition-all cursor-pointer" title="Back to courses">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
      <h1 class="text-2xl font-bold">PTE WFD 练习 <span style="font-size:10px;color:#aaa;font-weight:400">v250601</span></h1>
      </div>
      <select v-model="currentTheme" @change="onThemeChange"
          class="px-2 py-1 border border-[var(--tw-border)] rounded-md text-xs text-[var(--tw-text-muted)] bg-[var(--tw-bg-card)] max-w-[90px] outline-none focus:border-primary">
          <option value="tech">Tech</option>
          <option value="ocean">Ocean</option>
          <option value="forest">Forest</option>
          <option value="dark">Dark</option>
        </select>
      <select v-if="availableVoices.length > 0" v-model="selectedVoiceName" @change="onVoiceChange" class="voice-select px-2 py-1 border border-[var(--tw-border)] rounded-md text-xs text-[var(--tw-text-muted)] bg-[var(--tw-bg-card)] max-w-[140px] outline-none focus:border-primary">
          <option value="">Auto</option>
          <option v-for="v in availableVoices" :key="v.name" :value="v.name">{{ v.name }}</option>
        </select>
      <span class="user-info flex items-center gap-2">
        <span class="user-email text-xs text-[var(--tw-text-muted)] max-w-[140px] truncate">{{ userEmail }}</span>
        <button class="btn-logout bg-transparent border-none text-[var(--tw-text-muted)] text-lg cursor-pointer px-1 hover:text-danger transition-colors" @click="doLogout" title="Logout">&times;</button>
      </span>
      <span class="counter text-sm text-[var(--tw-text-muted)] bg-[var(--tw-border)] px-3 py-1 rounded-xl font-semibold cursor-pointer relative" @click="showSentenceList = !showSentenceList" style="cursor:pointer;position:relative">{{ currentIndex + 1 }} / {{ sentences.length }} <span style="font-size:10px">&#9660;</span></span>
    </header>
    <!-- Sentence Dropdown -->
    <div v-if="showSentenceList" class="sentence-dropdown fixed inset-0 bg-black/20 z-[200] flex items-start justify-center pt-[60px]" @click.self="showSentenceList=false">
      <div class="sentence-dropdown-content bg-[var(--tw-bg-card)] rounded-xl shadow-2xl max-h-[70vh] overflow-y-auto w-[90%] max-w-[600px] p-2">
        <div v-for="(s,i) in sentences" :key="s.id" 
             :class="['sentence-dropdown-item', { current: i===currentIndex, familiar: familiarIds.has(s.id) }]"
             @click="jumpToSentence(i); showSentenceList=false">
          <span class="sentence-dropdown-num min-w-[30px] text-right text-xs text-[var(--tw-text-muted)]">{{ i+1 }}</span>
          <span class="sentence-dropdown-text flex-1 truncate">{{ s.en.substring(0,50) }}{{ s.en.length>50?'...':'' }}</span>
          <span v-if="familiarIds.has(s.id)" class="sentence-dropdown-tag text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded">Familiar</span>
        </div>
      </div>
    </div>


    <!-- Auth Page -->
    <div v-if="!loggedIn" class="auth-page flex justify-center items-center min-h-[60vh]">
      <div class="auth-card bg-[var(--tw-bg-card)] rounded-xl p-8 w-full max-w-[420px] shadow-md text-center">
        <h2>PTE WFD Practice</h2>
        <div class="auth-tabs flex mb-4 rounded-lg overflow-hidden border border-[var(--tw-border)]">
          <button :class="{ active: authMode === 'login' }" @click="authMode = 'login'">Login</button>
          <button :class="{ active: authMode === 'register' }" @click="authMode = 'register'">Register</button>
        </div>
        <input v-model="authEmail" type="email" placeholder="Email" class="auth-input w-full px-3 py-2.5 border border-[var(--tw-border)] rounded-lg text-sm mb-2.5 outline-none focus:border-primary" @keyup.enter="doLogin" />
        <input v-model="authPassword" type="password" placeholder="Password" class="auth-input w-full px-3 py-2.5 border border-[var(--tw-border)] rounded-lg text-sm mb-2.5 outline-none focus:border-primary" @keyup.enter="doLogin" />
        <div v-if="authError" class="auth-error text-danger text-xs mb-2.5">{{ authError }}</div>
        <!-- Verification form -->
    <div v-if="needsVerify" class="auth-card bg-[var(--tw-bg-card)] rounded-xl p-8 w-full max-w-[420px] shadow-md text-center">
      <h2>Verify Email</h2>
      <p class="verify-msg text-xs text-[var(--tw-text-muted)] mb-3" v-html="verifyMessage"></p>
      <div v-if="!verifyEmailSent && verifyDevCode" class="verify-dev-code bg-green-50 border border-green-200 rounded-lg p-3 mb-3 text-center">
        <span>Verification code (dev mode): </span><strong>{{ verifyDevCode }}</strong>
      </div>
      <div v-if="verifyEmailSent" class="verify-email-sent bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-xs text-blue-700 text-center">
        A verification code has been sent to <strong>{{ verifyEmailRef }}</strong>. Please check your inbox.
      </div>
      <input v-model="verifyCode" type="text" placeholder="Enter 6-digit code" class="auth-input w-full px-3 py-2.5 border border-[var(--tw-border)] rounded-lg text-sm mb-2.5 outline-none focus:border-primary" maxlength="6" @keyup.enter="doVerify" />
      <div v-if="authError" class="auth-error text-danger text-xs mb-2.5">{{ authError }}</div>
      <button class="btn-auth w-full py-2.5 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed" @click="doVerify" :disabled="authLoading || verifyCode.length !== 6">
        {{ authLoading ? 'Verifying...' : 'Verify' }}
      </button>
      <button class="btn-link bg-transparent border-none text-accent text-xs cursor-pointer mt-2 block w-full text-center hover:underline" @click="doResendCode">Resend code</button>
      <button class="btn-link bg-transparent border-none text-accent text-xs cursor-pointer mt-2 block w-full text-center hover:underline" @click="needsVerify = false">Back</button>
    </div>

    <!-- Login/Register form -->
    <div v-if="!needsVerify" class="auth-card bg-[var(--tw-bg-card)] rounded-xl p-8 w-full max-w-[420px] shadow-md text-center">
        <button class="btn-auth w-full py-2.5 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed" @click="doLogin" :disabled="authLoading">
          {{ authLoading ? 'Loading...' : (authMode === 'register' ? 'Register' : 'Login') }}
        </button>
      </div>
    </div>
    </div>

    <!-- Dashboard -->
    <div v-if="loggedIn && !started" class="dashboard w-full max-w-5xl mx-auto px-6 py-8">
      <!-- Welcome -->
      <div style="margin-bottom:28px">
        <h2 style="font-size:26px;font-weight:700;color:var(--tw-text-main);margin:0 0 4px">Welcome back</h2>
        <span style="font-size:14px;color:var(--tw-text-muted)">{{ userEmail }}</span>
      </div>

      <!-- Stats Row -->
      <div class="stats-row-dash" style="display:flex;gap:16px;margin-bottom:28px;flex-wrap:wrap">
        <div class="stat-card-dash" style="flex:1;min-width:130px;background:var(--tw-bg-card);padding:16px 20px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.06);text-align:center">
          <div style="font-size:24px;font-weight:700;color:var(--tw-primary)">{{ formatTime(userStats.totalTimeSeconds || 0) }}</div>
          <div style="font-size:11px;color:var(--tw-text-muted);margin-top:4px;text-transform:uppercase;letter-spacing:.04em">Practice Time</div>
        </div>
        <div class="stat-card-dash" style="flex:1;min-width:130px;background:var(--tw-bg-card);padding:16px 20px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.06);text-align:center">
          <div style="font-size:24px;font-weight:700;color:var(--tw-primary)">{{ userStats.totalSessions || 0 }}</div>
          <div style="font-size:11px;color:var(--tw-text-muted);margin-top:4px;text-transform:uppercase;letter-spacing:.04em">Sessions</div>
        </div>
        <div class="stat-card-dash" style="flex:1;min-width:130px;background:var(--tw-bg-card);padding:16px 20px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.06);text-align:center">
          <div style="font-size:24px;font-weight:700;color:var(--tw-danger)">{{ userStats.wrongSentencesCount || 0 }}</div>
          <div style="font-size:11px;color:var(--tw-text-muted);margin-top:4px;text-transform:uppercase;letter-spacing:.04em">Wrong</div>
        </div>
      </div>

      <!-- Resume Card -->
      <div v-if="hasSavedState" style="background:linear-gradient(135deg, var(--tw-primary), var(--tw-primary-dark));border-radius:14px;padding:22px 24px;margin-bottom:28px;color:#fff;box-shadow:0 4px 20px rgba(79,70,229,.3)">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div>
            <div style="font-size:12px;opacity:.8;margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em">Continue Learning</div>
            <div style="font-size:18px;font-weight:700">{{ getSavedCourseName(savedStateData?.courseId) }}</div>
            <div style="font-size:13px;opacity:.85;margin-top:6px">
              Progress: <strong>{{ (savedStateData?.currentIndex || 0) + 1 }}</strong> / <strong>{{ (savedStateData?.sentenceIds?.length || savedStateData?.sentences?.length || 0) }}</strong> sentences
            </div>
          </div>
          <button @click="resumePractice" style="padding:10px 28px;background:#fff;color:var(--tw-primary);border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;transition:all .15s;box-shadow:0 2px 8px rgba(0,0,0,.15)">Continue</button>
        </div>
      </div>

      <!-- Courses Section -->
      <h2 style="font-size:18px;font-weight:700;color:var(--tw-text-main);margin:0 0 16px">{{ hasSavedState ? 'All Courses' : 'Choose a Course' }}</h2>
      
      <div v-if="courses.length > 0" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">
        <div v-for="c in courses" :key="c.id" @click="startWithCourse(c.id)" 
             :class="{active:selectedCourseId === c.id}"
             style="background:var(--tw-bg-card);border-radius:14px;padding:22px;box-shadow:0 2px 12px rgba(0,0,0,.06);cursor:pointer;transition:all .2s;border:2px solid transparent"
             onmouseover="this.style.borderColor='var(--tw-primary)';this.style.boxShadow='0 4px 24px rgba(79,70,229,.12)'" 
             onmouseout="this.style.borderColor='transparent';this.style.boxShadow='0 2px 12px rgba(0,0,0,.06)'">
          <div style="font-size:18px;font-weight:700;color:var(--tw-text-main);margin-bottom:6px">{{ c.name }}</div>
          <div style="font-size:13px;color:var(--tw-text-muted);margin-bottom:12px;line-height:1.5">{{ c.description || 'A collection of WFD practice sentences to help you prepare for the PTE exam.' }}</div>
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span style="font-size:15px;font-weight:700;color:var(--tw-primary)">{{ c.price > 0 ? '$' + c.price : 'Free' }}</span>
            <span style="font-size:12px;color:var(--tw-text-muted);background:var(--tw-surface);padding:4px 10px;border-radius:20px">{{ c.sentence_count || '?' }} sentences</span>
          </div>
        </div>
      </div>
      <div v-else style="color:var(--tw-text-muted);font-size:14px;text-align:center;padding:40px 0">
        {{ loadingSentences ? 'Loading courses...' : 'No courses available' }}
      </div>
    </div>

    <!-- Celebration Overlay -->
    <transition name="fade">
      <div v-if="showCelebration" class="celebration-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
        <div class="celebration-text text-5xl font-extrabold text-white animate-popIn">{{ celebrationText }}</div>
      </div>
    </transition>
    <!-- Encouragement Toast -->
    <transition name="fade">
      <div v-if="encouragementVisible" class="encouragement-toast fixed top-20 left-1/2 -translate-x-1/2 bg-primary text-white px-7 py-3 rounded-3xl text-base font-semibold z-[99] shadow-lg">{{ encouragementMsg }}</div>
    </transition>

    <div class="main" v-if="started && currentSentence">
      <div class="flex items-center gap-3 mb-5">
        <button class="btn-familiar inline-flex items-center gap-1 px-4 py-2.5 border border-[var(--tw-border)] rounded-lg text-sm text-[var(--tw-text-muted)] font-medium hover:bg-green-50 hover:text-green-700 hover:border-green-700 transition-all" @click="markFamiliar" title="Mark as familiar"> 已熟悉</button>
        <button class="btn-audio inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity" @click="playAudio" :disabled="isPlaying" title="播放语音">
          <span v-if="isPlaying">▶▶</span>
          <span v-else>▶</span>
          播放
        </button>
        <div class="flex-1" v-if="isPlaying">
          <div class="h-1 bg-[var(--tw-border)] rounded animate-pulse"></div>
        </div>
      </div>

      <div class="sentence-area bg-[var(--tw-bg-card)] rounded-xl p-6 sm:p-8 shadow-sm mb-4">
        <div class="blanks-row flex flex-wrap items-end leading-[2.2]" ref="blanksContainer">
            <span
              v-for="(w, wi) in parsedWords"
              :key="wi"
              class="word-slot inline-flex items-center justify-center min-w-[40px] h-[52px] text-[24px] font-semibold border-b-[1.5px] px-3 mx-[4px] cursor-pointer select-none transition-colors border-[var(--tw-border)]"
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

      <div class="reference-section mb-3">
        <button class="btn-reference px-4 py-2 bg-transparent text-accent border border-accent rounded-md text-xs font-medium hover:bg-blue-50 transition-colors" @click="showReference = !showReference">
          {{ showReference ? '隐藏' : '显示' }}完整句子
        </button>
        <transition name="fade">
          <div v-if="showReference" class="reference-section-detail">
            <div class="reference-text mt-2.5 p-3 bg-[var(--tw-bg-card)] rounded-lg border-l-4 border-primary text-lg font-medium text-[var(--tw-text-main)] shadow-sm">{{ currentText }}</div>
            <div class="reference-translation mt-2 p-2.5 bg-[var(--tw-surface)] rounded-lg border-l-[3px] border-[var(--tw-border)] text-sm text-[var(--tw-text-muted)]">{{ currentTranslation }}</div>
          </div>
        </transition>
      </div>

      <div class="progress-bar h-1.5 bg-[var(--tw-border)] rounded mb-4 overflow-hidden">
        <div class="progress-fill h-full bg-gradient-to-r from-primary to-primary-light rounded transition-all duration-300" :style="{ width: totalWords ? (filledCount / totalChars * 100) + '%' : '0%' }"></div>
      </div>

      <div class="mode-bar flex items-center gap-2 mb-3">
        <button class="btn-mode px-3 py-1.5 border border-[var(--tw-border)] rounded-md bg-[var(--tw-bg-card)] text-xs text-[var(--tw-text-muted)] cursor-pointer" :class="{ active: practiceMode === 'all' }" @click="switchMode('all')">All</button>
        <button class="btn-mode px-3 py-1.5 border border-[var(--tw-border)] rounded-md bg-[var(--tw-bg-card)] text-xs text-[var(--tw-text-muted)] cursor-pointer" :class="{ active: practiceMode === 'wrong' }" @click="switchMode('wrong')" :disabled="wrongSentencesList.length === 0">
          Wrong ({{ wrongSentencesList.length }})
        </button>
        <select v-model="repeatCount" class="voice-select px-2 py-1 border border-[var(--tw-border)] rounded-md text-xs text-[var(--tw-text-muted)] bg-[var(--tw-bg-card)] max-w-[140px] outline-none focus:border-primary" style="max-width:70px" title="Repeat">
          <option :value="1">x1</option>
          <option :value="5">x5</option>
          <option :value="10">x10</option>
        </select>
        <span class="timer-display ml-auto text-xs text-[var(--tw-text-muted)] tabular-nums">{{ Math.floor(elapsedSeconds / 60) }}:{{ String(elapsedSeconds % 60).padStart(2, '0') }}</span>
      </div>
      <div class="nav-buttons flex gap-2.5 justify-center items-center flex-wrap">
        <label class="auto-toggle inline-flex items-center gap-1.5 text-xs text-[var(--tw-text-muted)] cursor-pointer select-none">
          <input type="checkbox" v-model="autoAdvance" />
          <span class="toggle-label leading-none">自动下一句</span>
        </label>
        <button class="btn-nav px-5 py-2.5 bg-[var(--tw-bg-card)] text-[var(--tw-text-main)] border border-[var(--tw-border)] rounded-lg text-sm font-medium hover:bg-[var(--tw-bg-main)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors" @click="prevSentence" :disabled="currentIndex === 0">← 上一句</button>
        <button class="btn-nav px-5 py-2.5 bg-[var(--tw-bg-card)] text-[var(--tw-text-main)] border border-[var(--tw-border)] rounded-lg text-sm font-medium hover:bg-[var(--tw-bg-main)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors" @click="resetCurrent">重置</button>
        <button class="btn-nav px-5 py-2.5 bg-[var(--tw-bg-card)] text-[var(--tw-text-main)] border border-[var(--tw-border)] rounded-lg text-sm font-medium hover:bg-[var(--tw-bg-main)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors" @click="nextSentence"
          :disabled="currentIndex >= sentences.length - 1 && !allFilled">下一句 →</button>
      </div>
    </div>

        <div v-if="started && !currentSentence" class="completion text-center py-16 px-5">
      <canvas ref="fireworksCanvas" class="fireworks-canvas" style="position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:50"></canvas>
      <div v-if="savingSession" style="font-size:14px;color:#666;margin-bottom:12px;">Saving...</div>
      <div class="completion-icon text-7xl mb-4">🎉</div>
      <h2>练习完成!</h2>
      <div class="session-stats flex gap-3 justify-center my-4 flex-wrap">
        <div class="stat-item bg-[var(--tw-surface)] rounded-xl p-3.5 text-center min-w-[70px]"><span class="stat-num block text-2xl font-bold text-primary">{{ sentences.length }}</span><span class="stat-label block text-[11px] text-[var(--tw-text-muted)] mt-0.5">Sentences</span></div>
        <div class="stat-item bg-[var(--tw-surface)] rounded-xl p-3.5 text-center min-w-[70px]"><span class="stat-num block text-2xl font-bold text-primary">{{ perfectCount }}</span><span class="stat-label block text-[11px] text-[var(--tw-text-muted)] mt-0.5">Perfect</span></div>
        <div class="stat-item bg-[var(--tw-surface)] rounded-xl p-3.5 text-center min-w-[70px]"><span class="stat-num block text-2xl font-bold text-primary">{{ formatTime(elapsedSeconds) }}</span><span class="stat-label block text-[11px] text-[var(--tw-text-muted)] mt-0.5">Time</span></div>
        <div class="stat-item bg-[var(--tw-surface)] rounded-xl p-3.5 text-center min-w-[70px]"><span class="stat-num block text-2xl font-bold text-primary">{{ sentences.length - wrongSentencesSet.size }}</span><span class="stat-label block text-[11px] text-[var(--tw-text-muted)] mt-0.5">Correct</span></div>
      </div>
      <p class="encourage-text text-base text-[var(--tw-text-muted)] mb-4 italic">{{ completionMessage }}</p>
      <div class="comp-buttons flex gap-2.5 justify-center">
        <button class="btn-nav btn-share" @click="shareResults">Share</button>
        <button class="btn-nav px-5 py-2.5 bg-[var(--tw-primary)] text-white border-[var(--tw-primary)] rounded-lg text-sm font-medium hover:opacity-90 transition-all" @click="backToCourses">返回课程</button>
        <button class="btn-nav px-5 py-2.5 bg-[var(--tw-bg-card)] text-[var(--tw-text-main)] border border-[var(--tw-border)] rounded-lg text-sm font-medium hover:bg-[var(--tw-bg-main)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors" @click="restart">再来一次</button>
      </div>
    </div>
    <footer class="app-footer text-center py-4 text-xs text-[var(--tw-text-muted)] mt-6">
      <span>Visits: {{ visitCount.toLocaleString() }}</span>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from "vue";
import { isLoggedIn, getUserEmail, logout as apiLogout, login, register, savePracticeSession, getWrongSentences, savePracticeState, loadPracticeState, getCourses, getCourseSentences, getStats } from "./api.js";

const sentences = ref([]);
const currentIndex = ref(0);
const userInput = ref({});
const activeSlot = ref(null);
const activeWordIndex = ref(-1);
const showReference = ref(false);
const isPlaying = ref(false);
const currentTheme = ref(localStorage.getItem("pte_theme") || "tech");
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
const userStats = ref({ totalTimeSeconds: 0, totalSessions: 0, wrongSentencesCount: 0 });
const familiarIds = ref(new Set());
const showSentenceList = ref(false); // "all"  // "all" | "wrong"
const wrongSentencesList = ref([]);
const savingSession = ref(false);
const courseSentences = ref([]);
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
const fireworksCanvas = ref(null);
let fireworksRunning = false;

async function fetchCourses() {
  try {
    const list = await getCourses();
    console.log('[PTE] fetchCourses got', list.length, 'courses:', list.map(c => c.name));
    courses.value = list;
  } catch(e) { console.error('[PTE] Failed to load courses:', e); }
}

async function fetchUserStats() {
  try {
    const stats = await getStats();
    userStats.value = stats;
  } catch(e) { console.error('[PTE] Failed to load stats:', e); }
}

async function startWithCourse(courseId) {
  hasSavedState.value = false;
  savedStateData.value = null;
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
  // Fireworks triggered inline on completion
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
  if (!val) return;
  const isLast = currentIndex.value >= sentences.value.length - 1;
  if (isLast) {
    // Course complete - always finish, regardless of autoAdvance
    setTimeout(() => {
      checkCurrentSentence();
      finishSession();
      currentIndex.value = sentences.value.length;
      clearState();
      nextTick(() => { setTimeout(() => startFireworks(), 300); });
    }, 600);
  } else if (autoAdvance.value) {
    // Normal auto-advance to next sentence
    setTimeout(() => {
      nextSentence();
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
  } else if (allFilled.value) {
    // Last sentence completed via manual advance (space/button)
    finishSession();
    currentIndex.value = sentences.value.length;
    clearState();
    nextTick(() => { setTimeout(() => startFireworks(), 300); });
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

function formatTime(s) { if (!s) return "0:00"; const m = Math.floor(s / 60); return m + ":" + String(s % 60).padStart(2, "0"); }

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

async function startFireworks() {
  if (fireworksRunning) return;
  fireworksRunning = true;
  const canvas = fireworksCanvas.value;
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext("2d");
  const particles = [];
  const colors = ["#FF6B6B","#FFD93D","#6BCB77","#4D96FF","#FF6FB7","#A66CFF","#00D2FF"];

  function createBurst(x, y) {
    const count = 40 + Math.random() * 30;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 1, decay: 0.008 + Math.random() * 0.02,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.random() * 3,
      });
    }
  }

  function draw() {
    if (!fireworksRunning) return;
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "lighter";
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.04;
      p.life -= p.decay;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (fireworksRunning) requestAnimationFrame(draw);
  }

  draw();
  // Launch bursts
  let burstCount = 0;
  const maxBursts = 8;
  function launchBurst() {
    if (!fireworksRunning || burstCount >= maxBursts) return;
    createBurst(Math.random() * canvas.width, Math.random() * canvas.height * 0.6);
    burstCount++;
    setTimeout(launchBurst, 400 + Math.random() * 600);
  }
  launchBurst();
  // Stop after a while
  setTimeout(() => { stopFireworks(); }, 5000);
}

function stopFireworks() {
  fireworksRunning = false;
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

function goBack() {
  if (timerInterval) clearInterval(timerInterval);
  saveCurrentState();
  finishSession();
  started.value = false;
  sentences.value = [];
  currentIndex.value = 0;
  userInput.value = {};
  selectedCourseId.value = null;
  hasSavedState.value = false;
  savedStateData.value = null;
  checkSavedState(false);
}

function backToCourses() {
  stopFireworks();
  if (timerInterval) clearInterval(timerInterval);
  started.value = false;
  sentences.value = [];
  currentIndex.value = 0;
  userInput.value = {};
  selectedCourseId.value = null;
  hasSavedState.value = false;
  savedStateData.value = null;
  courseSentences.value = [];
  clearState();
  checkSavedState(false);
}

function restart() {
  stopFireworks();
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
    checkSavedState(false);
    fetchUserStats();
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
    fetchCourses();
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

function onThemeChange() {
  localStorage.setItem("pte_theme", currentTheme.value);
  document.documentElement.setAttribute("data-theme", currentTheme.value);
}

function getSavedCourseName(courseId) {
  if (!courseId) return 'Unknown';
  const c = courses.value.find(x => x.id == courseId);
  return c ? c.name : 'Course #' + courseId;
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
.word-slot.filled { border-color: #2d6a4f; color: var(--tw-text-main); }
.word-slot.correct { color: #2d6a4f; }
.word-slot.incorrect { color: #d32f2f; border-color: #d32f2f; }
.word-slot.active { border-color: var(--tw-primary); color: var(--tw-primary); box-shadow: 0 1px 0 var(--tw-primary); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
