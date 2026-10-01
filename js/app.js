/**
 * YA ROSUL - Islamic Mobile Web App Core Logic
 * High performance, zero external framework dependencies, mobile-first gestures
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // App State & Persistence
  // ==========================================
  const state = {
    activeMode: localStorage.getItem('yarosul_mode') || 'book', // 'book' | 'digital'
    currentPage: parseInt(localStorage.getItem('yarosul_last_page')) || 1,
    digitalTab: localStorage.getItem('yarosul_digital_tab') || 'ratib', // 'ratib' | 'yasin' | 'waqiah' | 'fadhilah' | 'pengantar'
    zoomLevel: 1.0,
    isFullscreen: false,
    theme: localStorage.getItem('yarosul_theme') || 'emerald',
    soundEnabled: localStorage.getItem('yarosul_sound') !== 'false',
    vibrateEnabled: localStorage.getItem('yarosul_vibrate') !== 'false',
    showLatin: localStorage.getItem('yarosul_show_latin') !== 'false',
    showTrans: localStorage.getItem('yarosul_show_trans') !== 'false',
    fontSize: parseInt(localStorage.getItem('yarosul_font_size')) || 26,
    ratibCounts: JSON.parse(localStorage.getItem('yarosul_ratib_counts') || '{}'),
    freeTasbih: {
      count: parseInt(localStorage.getItem('yarosul_free_count')) || 0,
      target: parseInt(localStorage.getItem('yarosul_free_target')) || 33
    },
    paperTone: localStorage.getItem('yarosul_paper_tone') || 'normal', // 'normal' | 'sepia' | 'dark'
    bookmarks: JSON.parse(localStorage.getItem('yarosul_bookmarks') || '[]')
  };

  const TOTAL_PAGES = YAROSUL_DATA.meta.totalPages || 48;

  // ==========================================
  // Sound Synthesis (Web Audio API - Offline & Instant)
  // ==========================================
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playClickSound() {
    if (!state.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
      // Audio not supported or blocked
    }
  }

  function playTargetReachedSound() {
    if (!state.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16); // G5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.36);
    } catch (e) {}
  }

  function triggerHaptic(type = 'tap') {
    if (!state.vibrateEnabled || !navigator.vibrate) return;
    try {
      if (type === 'tap') {
        navigator.vibrate(15);
      } else if (type === 'complete') {
        navigator.vibrate([30, 60, 40]);
      }
    } catch (e) {}
  }

  // ==========================================
  // DOM Elements
  // ==========================================
  const bookView = document.getElementById('bookView');
  const digitalView = document.getElementById('digitalView');
  const bookPageImg = document.getElementById('bookPageImg');
  const bookPageWrapper = document.getElementById('bookPageWrapper');
  const bookRange = document.getElementById('bookRange');
  const currentChapterTag = document.getElementById('currentChapterTag');
  const pageIndicator = document.getElementById('pageIndicator');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const zoomBtn = document.getElementById('zoomBtn');
  const chapterChips = document.getElementById('chapterChips');

  // Reading Comfort & Navigation elements
  const bookOverlayTools = document.getElementById('bookOverlayTools');
  const toolToggleBtn = document.getElementById('toolToggleBtn');
  const toolCloseBtn = document.getElementById('toolCloseBtn');
  const quickToneBtn = document.getElementById('quickToneBtn');
  const quickBookmarkBtn = document.getElementById('quickBookmarkBtn');
  const paperToneBtn = document.getElementById('paperToneBtn');
  const bookmarkBtn = document.getElementById('bookmarkBtn');
  const bookmarkRibbon = document.getElementById('bookmarkRibbon');
  const bookmarkCountBadge = document.getElementById('bookmarkCountBadge');
  const jumpModal = document.getElementById('jumpModal');
  const jumpPageInput = document.getElementById('jumpPageInput');
  const btnConfirmJump = document.getElementById('btnConfirmJump');
  const jumpStepMinus5 = document.getElementById('jumpStepMinus5');
  const jumpStepMinus1 = document.getElementById('jumpStepMinus1');
  const jumpStepPlus1 = document.getElementById('jumpStepPlus1');
  const jumpStepPlus5 = document.getElementById('jumpStepPlus5');
  const jumpShortcuts = document.getElementById('jumpShortcuts');
  const tocTabsNav = document.getElementById('tocTabsNav');

  // Digital View elements
  const digitalTabs = document.getElementById('digitalTabs');
  const digitalContentArea = document.getElementById('digitalContentArea');

  // Bottom Nav items
  const navBook = document.getElementById('navBook');
  const navDigital = document.getElementById('navDigital');
  const navToc = document.getElementById('navToc');
  const navSettings = document.getElementById('navSettings');
  const fabTasbih = document.getElementById('fabTasbih');

  // Modals
  const tocModal = document.getElementById('tocModal');
  const settingsModal = document.getElementById('settingsModal');
  const tasbihModal = document.getElementById('tasbihModal');
  const toastMsg = document.getElementById('toastMsg');

  // ==========================================
  // Reading Comfort: Paper Tones (Scan Filter)
  // ==========================================
  function applyPaperTone(tone) {
    state.paperTone = tone;
    localStorage.setItem('yarosul_paper_tone', tone);
    if (bookPageImg) {
      bookPageImg.classList.remove('paper-tone-normal', 'paper-tone-sepia', 'paper-tone-dark');
      bookPageImg.classList.add(`paper-tone-${tone}`);
    }
    if (paperToneBtn) {
      if (tone === 'normal') {
        paperToneBtn.innerHTML = '☀️ Asli';
        paperToneBtn.title = 'Nuansa Kertas: Asli (Ketuk untuk ganti)';
      } else if (tone === 'sepia') {
        paperToneBtn.innerHTML = '📜 Sepia';
        paperToneBtn.title = 'Nuansa Kertas: Krem Hangat (Ketuk untuk ganti)';
      } else if (tone === 'dark') {
        paperToneBtn.innerHTML = '🌙 Malam';
        paperToneBtn.title = 'Nuansa Kertas: Mode Malam Invert (Ketuk untuk ganti)';
      }
    }
    if (quickToneBtn) {
      if (tone === 'normal') quickToneBtn.innerHTML = '<span>☀️</span>';
      else if (tone === 'sepia') quickToneBtn.innerHTML = '<span>📜</span>';
      else if (tone === 'dark') quickToneBtn.innerHTML = '<span>🌙</span>';
    }
    document.querySelectorAll('.tone-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tone === tone);
    });
  }

  function cyclePaperTone() {
    const tones = ['normal', 'sepia', 'dark'];
    const nextIdx = (tones.indexOf(state.paperTone) + 1) % tones.length;
    const nextTone = tones[nextIdx];
    applyPaperTone(nextTone);
    const names = { normal: 'Scan Asli ☀️', sepia: 'Krem Hangat (Sepia) 📜', dark: 'Mode Malam (Invert) 🌙' };
    showToast(`Nuansa kertas: ${names[nextTone]}`);
    triggerHaptic('tap');
  }

  // ==========================================
  // Bookmarks & Ribbon Indicator
  // ==========================================
  function isBookmarked(pageNum) {
    return state.bookmarks.includes(pageNum);
  }

  function updateBookmarkUI() {
    const bookmarked = isBookmarked(state.currentPage);
    if (bookmarkRibbon) {
      bookmarkRibbon.style.display = bookmarked ? 'flex' : 'none';
    }
    if (bookmarkBtn) {
      bookmarkBtn.classList.toggle('active-bookmark', bookmarked);
      bookmarkBtn.innerHTML = bookmarked ? '🔖 Tersimpan' : '🔖 Tandai';
      bookmarkBtn.title = bookmarked ? 'Halaman ini ditandai (Ketuk untuk hapus)' : 'Tandai Halaman Ini (Bookmark)';
    }
    if (quickBookmarkBtn) {
      quickBookmarkBtn.classList.toggle('active', bookmarked);
      quickBookmarkBtn.title = bookmarked ? 'Halaman ini ditandai (Ketuk untuk lepas)' : 'Tandai Halaman Ini';
    }
    if (bookmarkCountBadge) {
      bookmarkCountBadge.textContent = state.bookmarks.length;
    }
  }

  function toggleBookmark(pageNum = state.currentPage) {
    const idx = state.bookmarks.indexOf(pageNum);
    if (idx !== -1) {
      state.bookmarks.splice(idx, 1);
      showToast(`Penanda halaman ${pageNum} dihapus`);
    } else {
      state.bookmarks.push(pageNum);
      state.bookmarks.sort((a, b) => a - b);
      showToast(`🔖 Halaman ${pageNum} disimpan di Penanda!`);
    }
    localStorage.setItem('yarosul_bookmarks', JSON.stringify(state.bookmarks));
    updateBookmarkUI();
    if (tocModal && tocModal.classList.contains('open') && currentTocTab === 'bookmarks') {
      renderTocBookmarks();
    }
    triggerHaptic('tap');
  }

  // ==========================================
  // Theme & Settings Handlers
  // ==========================================
  function applyTheme(themeName) {
    state.theme = themeName;
    document.documentElement.setAttribute('data-theme', themeName === 'emerald' ? '' : themeName);
    localStorage.setItem('yarosul_theme', themeName);

    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === themeName);
    });
  }

  function applyFontSettings() {
    document.documentElement.style.setProperty('--arabic-size', `${state.fontSize}px`);
    document.documentElement.style.setProperty('--latin-size', `${Math.round(state.fontSize * 0.58)}px`);
    document.documentElement.style.setProperty('--trans-size', `${Math.round(state.fontSize * 0.54)}px`);
    localStorage.setItem('yarosul_font_size', state.fontSize);

    const latinBoxes = document.querySelectorAll('.latin-box');
    latinBoxes.forEach(el => el.style.display = state.showLatin ? 'block' : 'none');

    const transBoxes = document.querySelectorAll('.trans-box');
    transBoxes.forEach(el => el.style.display = state.showTrans ? 'block' : 'none');
  }

  function showToast(text, duration = 2000) {
    toastMsg.textContent = text;
    toastMsg.classList.add('show');
    clearTimeout(toastMsg._timer);
    toastMsg._timer = setTimeout(() => {
      toastMsg.classList.remove('show');
    }, duration);
  }

  // ==========================================
  // Chapter & Section Helpers
  // ==========================================
  function getChapterForPage(pageNum) {
    for (const ch of YAROSUL_DATA.chapters) {
      if (pageNum >= ch.pageStart && pageNum <= ch.pageEnd) {
        return ch;
      }
    }
    return YAROSUL_DATA.chapters[0];
  }

  // Preload neighboring page images for snappy mobile reading
  const imagePreloadCache = {};
  function preloadPage(num) {
    if (num < 1 || num > TOTAL_PAGES || imagePreloadCache[num]) return;
    const img = new Image();
    img.src = `assets/pages/page_${num}.webp`;
    imagePreloadCache[num] = img;
  }

  // ==========================================
  // Mode 1: Book Reader (Scan Asli HD)
  // ==========================================
  function loadBookPage(pageNum, notify = false) {
    if (pageNum < 1) pageNum = 1;
    if (pageNum > TOTAL_PAGES) pageNum = TOTAL_PAGES;

    state.currentPage = pageNum;
    localStorage.setItem('yarosul_last_page', pageNum);

    // Update UI elements
    const ch = getChapterForPage(pageNum);
    currentChapterTag.innerHTML = `<span>${ch.icon}</span> ${ch.title}`;
    pageIndicator.innerHTML = `${pageNum} / ${TOTAL_PAGES} <span style="font-size:10px; opacity:0.75;">▾</span>`;
    bookRange.value = pageNum;

    // Update bookmark ribbon & button
    updateBookmarkUI();
    if (jumpPageInput) {
      jumpPageInput.value = pageNum;
    }

    // Update image with soft fade & safe load check
    bookPageImg.style.opacity = '0.35';
    bookPageImg.src = `assets/pages/page_${pageNum}.webp`;
    bookPageImg.onload = () => {
      bookPageImg.style.opacity = '1';
    };
    bookPageImg.onerror = () => {
      bookPageImg.style.opacity = '1';
    };
    if (bookPageImg.complete && bookPageImg.naturalWidth > 0) {
      bookPageImg.style.opacity = '1';
    }

    // Auto-collapse tool overlay when turning page so content is clear
    if (bookOverlayTools) {
      bookOverlayTools.classList.add('collapsed');
    }

    // Update chapter chips
    document.querySelectorAll('.chapter-chip').forEach(chip => {
      const chipCh = YAROSUL_DATA.chapters.find(c => c.id === chip.dataset.id);
      if (chipCh && pageNum >= chipCh.pageStart && pageNum <= chipCh.pageEnd) {
        chip.classList.add('active');
        chip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      } else {
        chip.classList.remove('active');
      }
    });

    // Reset zoom when navigating to new page
    setZoom(1.0);

    // Preload next and previous pages
    preloadPage(pageNum + 1);
    preloadPage(pageNum + 2);
    preloadPage(pageNum - 1);

    if (notify) {
      showToast(`Halaman ${pageNum} - ${ch.title}`);
    }
  }

  function prevPage() {
    if (state.currentPage > 1) {
      loadBookPage(state.currentPage - 1);
      triggerHaptic('tap');
    } else {
      showToast('Sudah di halaman awal');
    }
  }

  function nextPage() {
    if (state.currentPage < TOTAL_PAGES) {
      loadBookPage(state.currentPage + 1);
      triggerHaptic('tap');
    } else {
      showToast('Sudah di halaman akhir');
    }
  }

  // ==========================================
  // Fluid Pan, Zoom & Pinch Gestures
  // ==========================================
  let panX = 0;
  let panY = 0;
  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;
  let initialPinchDist = 0;
  let initialPinchZoom = 1.0;

  function clampPan() {
    if (state.zoomLevel <= 1.0) {
      panX = 0;
      panY = 0;
      return;
    }
    const rect = canvasArea.getBoundingClientRect();
    const maxPanX = (rect.width * (state.zoomLevel - 1)) / 1.7;
    const maxPanY = (rect.height * (state.zoomLevel - 1)) / 1.7;
    panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
    panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
  }

  function updateTransform(withTransition = false) {
    if (withTransition) {
      bookPageWrapper.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
    } else {
      bookPageWrapper.style.transition = 'none';
    }
    if (state.zoomLevel <= 1.0) {
      panX = 0;
      panY = 0;
      bookPageWrapper.style.transform = 'none';
      bookPageWrapper.classList.remove('is-zoomed', 'is-panning');
      zoomBtn.innerHTML = '🔍 1x';
    } else {
      bookPageWrapper.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${state.zoomLevel})`;
      bookPageWrapper.classList.add('is-zoomed');
      zoomBtn.innerHTML = `🔍 ${state.zoomLevel.toFixed(1)}x`;
    }
  }

  function setZoom(level) {
    level = Math.max(1.0, Math.min(3.5, level));
    state.zoomLevel = level;
    if (level === 1.0) {
      panX = 0;
      panY = 0;
    }
    clampPan();
    updateTransform(true);
  }

  function toggleZoom() {
    if (state.zoomLevel < 1.4) {
      setZoom(1.75);
      showToast('Perbesar 1.8x (Bisa digeser)');
    } else if (state.zoomLevel < 2.3) {
      setZoom(2.5);
      showToast('Perbesar 2.5x (Bisa digeser)');
    } else {
      setZoom(1.0);
      showToast('Zoom normal 1x');
    }
    triggerHaptic('tap');
  }

  // Setup Chapter Chips in Book Reader
  function renderChapterChips() {
    chapterChips.innerHTML = '';
    YAROSUL_DATA.chapters.forEach(ch => {
      const chip = document.createElement('button');
      chip.className = 'chapter-chip';
      chip.dataset.id = ch.id;
      chip.innerHTML = `<span>${ch.icon}</span> ${ch.title}`;
      chip.addEventListener('click', () => {
        loadBookPage(ch.pageStart, true);
        triggerHaptic('tap');
      });
      chapterChips.appendChild(chip);
    });
  }

  // Mobile Touch Gestures (Swipe, Pinch & Pan)
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;
  let lastTapTime = 0;

  function getPinchDistance(t1, t2) {
    return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
  }

  const canvasArea = document.getElementById('bookCanvasArea');

  canvasArea.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      // Two fingers: Pinch to zoom
      initialPinchDist = getPinchDistance(e.touches[0], e.touches[1]);
      initialPinchZoom = state.zoomLevel;
      isPanning = false;
    } else if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchEndX = touchStartX;
      touchEndY = touchStartY;

      if (state.zoomLevel > 1.0) {
        // One finger when zoomed: Drag to pan
        isPanning = true;
        panStartX = touchStartX - panX;
        panStartY = touchStartY - panY;
        bookPageWrapper.classList.add('is-panning');
      }
    }
  }, { passive: true });

  canvasArea.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && initialPinchDist > 0) {
      // Pinching
      const currentDist = getPinchDistance(e.touches[0], e.touches[1]);
      const scale = (currentDist / initialPinchDist) * initialPinchZoom;
      state.zoomLevel = Math.max(1.0, Math.min(3.5, scale));
      clampPan();
      updateTransform(false);
      if (e.cancelable) e.preventDefault();
    } else if (e.touches.length === 1) {
      touchEndX = e.touches[0].clientX;
      touchEndY = e.touches[0].clientY;

      if (isPanning && state.zoomLevel > 1.0) {
        panX = touchEndX - panStartX;
        panY = touchEndY - panStartY;
        clampPan();
        updateTransform(false);
        if (e.cancelable) e.preventDefault();
      }
    }
  }, { passive: false });

  canvasArea.addEventListener('touchend', (e) => {
    if (initialPinchDist > 0 && e.touches.length < 2) {
      initialPinchDist = 0;
      if (state.zoomLevel < 1.1) {
        setZoom(1.0);
      } else {
        setZoom(state.zoomLevel);
      }
      return;
    }

    if (isPanning) {
      isPanning = false;
      bookPageWrapper.classList.remove('is-panning');
      updateTransform(true);
      return;
    }

    // Double tap handling
    const now = Date.now();
    const tapLength = now - lastTapTime;
    if (tapLength > 0 && tapLength < 280) {
      toggleZoom();
      lastTapTime = 0;
      return;
    }
    lastTapTime = now;

    // Normal single-finger swipe when not zoomed
    if (state.zoomLevel <= 1.0) {
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;
      if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
        if (deltaX < 0) {
          nextPage();
        } else {
          prevPage();
        }
      }
    }
  }, { passive: true });

  // Center Tap on Book Canvas toggles Zen Mode (Clean screen)
  canvasArea.addEventListener('click', (e) => {
    if (
      e.target.closest('.tool-pill-btn') ||
      e.target.closest('.tool-toggle-btn') ||
      e.target.closest('.tap-zone') ||
      e.target.closest('.quick-action-pill') ||
      state.zoomLevel > 1.0
    ) {
      return;
    }
    const rect = canvasArea.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    if (clickX >= rect.width * 0.22 && clickX <= rect.width * 0.78) {
      document.body.classList.toggle('zen-reading-mode');
      const isZen = document.body.classList.contains('zen-reading-mode');
      showToast(isZen ? 'Mode Bersih (Ketuk layar untuk kembalikan menu)' : 'Menu baca ditampilkan', 1800);
      triggerHaptic('tap');
    }
  });

  // Desktop Mouse Drag to Pan when Zoomed
  let isMouseDown = false;
  let mouseStartX = 0;
  let mouseStartY = 0;

  canvasArea.addEventListener('mousedown', (e) => {
    if (state.zoomLevel > 1.0 && e.button === 0) {
      isMouseDown = true;
      mouseStartX = e.clientX - panX;
      mouseStartY = e.clientY - panY;
      bookPageWrapper.classList.add('is-panning');
      e.preventDefault();
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (isMouseDown && state.zoomLevel > 1.0) {
      panX = e.clientX - mouseStartX;
      panY = e.clientY - mouseStartY;
      clampPan();
      updateTransform(false);
    }
  });

  window.addEventListener('mouseup', () => {
    if (isMouseDown) {
      isMouseDown = false;
      bookPageWrapper.classList.remove('is-panning');
      updateTransform(true);
    }
  });

  // Tap zones left/right
  document.getElementById('tapZoneLeft').addEventListener('click', () => prevPage());
  document.getElementById('tapZoneRight').addEventListener('click', () => nextPage());
  prevPageBtn.addEventListener('click', () => prevPage());
  nextPageBtn.addEventListener('click', () => nextPage());
  zoomBtn.addEventListener('click', () => toggleZoom());

  // Collapsible Floating Reader Tools
  if (toolToggleBtn) {
    toolToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      bookOverlayTools.classList.toggle('collapsed');
      triggerHaptic('tap');
    });
  }

  if (toolCloseBtn) {
    toolCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      bookOverlayTools.classList.add('collapsed');
      triggerHaptic('tap');
    });
  }

  // Quick Action Buttons in Bottom Bar
  if (quickToneBtn) {
    quickToneBtn.addEventListener('click', () => cyclePaperTone());
  }

  if (quickBookmarkBtn) {
    quickBookmarkBtn.addEventListener('click', () => toggleBookmark());
  }

  // Reading Comfort tools
  if (paperToneBtn) {
    paperToneBtn.addEventListener('click', () => cyclePaperTone());
  }
  if (bookmarkBtn) {
    bookmarkBtn.addEventListener('click', () => toggleBookmark());
  }

  // Keyboard navigation for desktop users
  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (e.key === 'ArrowLeft') {
      prevPage();
    } else if (e.key === 'ArrowRight') {
      nextPage();
    } else if (e.key === 'Escape') {
      closeModals();
      document.body.classList.remove('zen-reading-mode');
    }
  });

  // Interactive page indicator badge opens jump to page dialog
  if (pageIndicator) {
    pageIndicator.addEventListener('click', () => openJumpModal());
  }

  // ==========================================
  // Jump to Page Dialog Handlers
  // ==========================================
  function openJumpModal() {
    if (jumpPageInput) {
      jumpPageInput.value = state.currentPage;
    }
    renderJumpShortcuts();
    openModal(jumpModal);
    setTimeout(() => {
      if (jumpPageInput) jumpPageInput.select();
    }, 200);
    triggerHaptic('tap');
  }

  function renderJumpShortcuts() {
    if (!jumpShortcuts) return;
    jumpShortcuts.innerHTML = '';
    const shortcuts = [
      { title: 'Cover', page: 1, icon: '📖' },
      { title: 'Muqaddimah', page: 3, icon: '📜' },
      { title: 'Surat Yasin', page: 6, icon: '✨' },
      { title: 'Al-Waqi\'ah', page: 19, icon: '🌟' },
      { title: 'Ratibul Haddad', page: 26, icon: '📿' },
      { title: 'Doa Ratib', page: 42, icon: '🤲' },
      { title: 'Fadhilah', page: 46, icon: '💎' },
      { title: 'Halaman Akhir', page: 48, icon: '🏁' }
    ];

    shortcuts.forEach(item => {
      const btn = document.createElement('button');
      btn.className = 'jump-chip-btn';
      btn.innerHTML = `
        <span class="jump-chip-title"><span>${item.icon}</span> ${item.title}</span>
        <span class="jump-chip-badge">Hal ${item.page}</span>
      `;
      btn.addEventListener('click', () => {
        closeModals();
        loadBookPage(item.page, true);
        if (state.activeMode !== 'book') switchMode('book');
        triggerHaptic('tap');
      });
      jumpShortcuts.appendChild(btn);
    });
  }

  function handleJumpSubmit() {
    if (!jumpPageInput) return;
    const val = parseInt(jumpPageInput.value, 10);
    if (!isNaN(val)) {
      const clamped = Math.max(1, Math.min(TOTAL_PAGES, val));
      closeModals();
      loadBookPage(clamped, true);
      if (state.activeMode !== 'book') switchMode('book');
      triggerHaptic('tap');
    }
  }

  if (btnConfirmJump) {
    btnConfirmJump.addEventListener('click', handleJumpSubmit);
  }
  if (jumpPageInput) {
    jumpPageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleJumpSubmit();
      }
    });
  }

  if (jumpStepMinus5) {
    jumpStepMinus5.addEventListener('click', () => {
      const cur = parseInt(jumpPageInput.value, 10) || 1;
      jumpPageInput.value = Math.max(1, cur - 5);
      triggerHaptic('tap');
    });
  }
  if (jumpStepMinus1) {
    jumpStepMinus1.addEventListener('click', () => {
      const cur = parseInt(jumpPageInput.value, 10) || 1;
      jumpPageInput.value = Math.max(1, cur - 1);
      triggerHaptic('tap');
    });
  }
  if (jumpStepPlus1) {
    jumpStepPlus1.addEventListener('click', () => {
      const cur = parseInt(jumpPageInput.value, 10) || 1;
      jumpPageInput.value = Math.min(TOTAL_PAGES, cur + 1);
      triggerHaptic('tap');
    });
  }
  if (jumpStepPlus5) {
    jumpStepPlus5.addEventListener('click', () => {
      const cur = parseInt(jumpPageInput.value, 10) || 1;
      jumpPageInput.value = Math.min(TOTAL_PAGES, cur + 5);
      triggerHaptic('tap');
    });
  }

  // (Zen mode / hide-book-controls handled by the primary click listener above)

  bookRange.addEventListener('input', (e) => {
    loadBookPage(parseInt(e.target.value));
  });

  // (switchDigitalTab is defined below with audio stop logic)

  // ==========================================
  // Audio Controller (Online Murottal & Ayat Streaming)
  // ==========================================
  let currentAudio = null;
  let currentPlayingVerse = null;
  let isFullSurahPlaying = false;

  function stopAllAudio() {
    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      } catch (e) {}
      currentAudio = null;
    }
    isFullSurahPlaying = false;
    currentPlayingVerse = null;

    const mainPlayBtn = document.getElementById('surahMainPlayBtn');
    if (mainPlayBtn) {
      mainPlayBtn.classList.remove('playing');
      mainPlayBtn.innerHTML = '▶';
    }
    document.querySelectorAll('.verse-audio-btn').forEach(btn => {
      btn.classList.remove('playing');
      btn.innerHTML = '▶ 🔊';
    });
    document.querySelectorAll('.item-card').forEach(card => {
      card.classList.remove('is-playing');
    });
    const statusEl = document.getElementById('surahAudioStatus');
    if (statusEl) statusEl.textContent = 'Murottal: Ketuk ▶ untuk dengarkan lengkap';
  }

  function playVerseAudio(verseNum, audioUrl, cardEl, btnEl) {
    if (currentPlayingVerse === verseNum && currentAudio && !currentAudio.paused) {
      stopAllAudio();
      return;
    }
    stopAllAudio();

    btnEl.innerHTML = '⏳';
    const audio = new Audio(audioUrl);
    currentAudio = audio;
    currentPlayingVerse = verseNum;

    audio.play().then(() => {
      btnEl.classList.add('playing');
      btnEl.innerHTML = '⏸ 🔊';
      cardEl.classList.add('is-playing');
    }).catch(err => {
      showToast('Gagal memutar audio ayat (periksa internet)');
      stopAllAudio();
    });

    audio.onended = () => {
      stopAllAudio();
    };

    audio.onerror = () => {
      showToast('Audio ayat belum tersedia offline');
      stopAllAudio();
    };
  }

  function toggleFullSurahAudio(surahData, titleLatin) {
    const mainPlayBtn = document.getElementById('surahMainPlayBtn');
    const statusEl = document.getElementById('surahAudioStatus');

    if (isFullSurahPlaying && currentAudio && !currentAudio.paused) {
      stopAllAudio();
      return;
    }

    const audioUrl = (surahData.audioFull && (surahData.audioFull['05'] || surahData.audioFull['01'])) || '';
    if (!audioUrl) {
      showToast('Audio surat lengkap belum tersedia');
      return;
    }

    stopAllAudio();
    if (statusEl) statusEl.textContent = 'Memuat audio murottal...';
    if (mainPlayBtn) mainPlayBtn.innerHTML = '⏳';

    const audio = new Audio(audioUrl);
    currentAudio = audio;
    isFullSurahPlaying = true;

    audio.play().then(() => {
      if (mainPlayBtn) {
        mainPlayBtn.classList.add('playing');
        mainPlayBtn.innerHTML = '⏸';
      }
      if (statusEl) statusEl.textContent = 'Sedang memutar: ' + titleLatin;
      showToast(`▶ Memutar murottal ${titleLatin}`);
    }).catch(err => {
      showToast('Gagal memutar murottal (periksa koneksi)');
      stopAllAudio();
    });

    audio.onended = () => {
      showToast(`Murottal ${titleLatin} selesai`);
      stopAllAudio();
    };

    audio.onerror = () => {
      showToast('Murottal memerlukan koneksi internet');
      stopAllAudio();
    };
  }

  // ==========================================
  // Mode 2: Digital Text & Interactive Tasbih
  // ==========================================
  function switchDigitalTab(tabId) {
    stopAllAudio();
    state.digitalTab = tabId;
    localStorage.setItem('yarosul_digital_tab', tabId);

    document.querySelectorAll('.tab-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    renderDigitalContent(tabId);
    digitalContentArea.scrollTop = 0;
  }

  function renderDigitalContent(tabId) {
    digitalContentArea.innerHTML = '';

    if (tabId === 'ratib') {
      renderRatibSection();
    } else if (tabId === 'doa_ratib') {
      renderDoaRatibSection();
    } else if (tabId === 'yasin') {
      renderQuranSection(YAROSUL_DATA.yasin, 'Surat Yasin', 'سُوْرَةُ يٰسٓ', '83 Ayat - Makkiyyah', 6);
    } else if (tabId === 'waqiah') {
      renderQuranSection(YAROSUL_DATA.waqiah, 'Surat Al-Waqi\'ah', 'سُوْرَةُ الْوَاقِعَةِ', '96 Ayat - Makkiyyah', 19);
    } else if (tabId === 'fadhilah') {
      renderFadhilahSection();
    } else if (tabId === 'pengantar') {
      renderPengantarSection();
    }
    applyFontSettings();
  }

  // 1. Ratibul Haddad with interactive digital counters
  function renderRatibSection() {
    const hero = document.createElement('div');
    hero.className = 'section-hero-card';
    hero.innerHTML = `
      <div class="hero-arabic-title">رَاتِبُ الْحَدَّادِ</div>
      <div class="hero-title">Ratibul Haddad Lengkap</div>
      <div class="hero-desc">Disusun oleh Al-Imam Quthbil Irsyad Al-Habib Abdullah bin Alawi Al-Haddad RA (Hal 26 - 41)</div>
    `;
    digitalContentArea.appendChild(hero);

    const bismillah = document.createElement('div');
    bismillah.className = 'bismillah-card';
    bismillah.innerHTML = `<div class="bismillah-text">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>`;
    digitalContentArea.appendChild(bismillah);

    // Filter main ratib items r1 to r26
    const ratibItems = YAROSUL_DATA.ratib.filter(item => item.id !== 'r27' && item.id !== 'r28');
    ratibItems.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.id = `ratib_card_${item.id}`;

      const currentCount = state.ratibCounts[item.id] || 0;
      const isTargetMet = currentCount >= item.count;
      if (isTargetMet && item.count > 1) {
        card.classList.add('completed');
      }

      card.innerHTML = `
        <div class="card-header-row">
          <div class="card-num-badge">${index + 1}</div>
          <div class="card-title-text">${item.title}</div>
          <div class="card-page-link" data-page="${item.page}">
            📄 Hal ${item.page}
          </div>
        </div>
        <div class="arabic-box">${item.arabic.replace(/\n/g, '<br>')}</div>
        <div class="latin-box">${item.latin}</div>
        <div class="trans-box">${item.translation}</div>
        ${item.count > 1 ? `
          <div class="counter-box">
            <div class="counter-info">
              <span class="counter-target-label">Target Pengulangan</span>
              <span class="counter-progress-text" id="ratib_progress_${item.id}">${currentCount} / ${item.count}x</span>
            </div>
            <div class="counter-action-row">
              <button class="counter-tap-btn ${isTargetMet ? 'done' : ''}" id="ratib_btn_${item.id}">
                ${isTargetMet ? '✓ Selesai' : '📿 Tekan Hitung'}
              </button>
              <button class="counter-reset-btn" id="ratib_reset_${item.id}" title="Reset Hitungan">↺</button>
            </div>
          </div>
        ` : ''}
      `;

      // Event listener for Hal link to jump to exact book scan page
      card.querySelector('.card-page-link').addEventListener('click', (e) => {
        const page = parseInt(e.currentTarget.dataset.page);
        switchMode('book');
        loadBookPage(page, true);
      });

      // Event listeners for counter
      if (item.count > 1) {
        const tapBtn = card.querySelector(`#ratib_btn_${item.id}`);
        const resetBtn = card.querySelector(`#ratib_reset_${item.id}`);
        const progressText = card.querySelector(`#ratib_progress_${item.id}`);

        tapBtn.addEventListener('click', () => {
          let count = (state.ratibCounts[item.id] || 0) + 1;
          if (count > item.count) {
            count = 1; // loop back or restart
          }
          state.ratibCounts[item.id] = count;
          localStorage.setItem('yarosul_ratib_counts', JSON.stringify(state.ratibCounts));

          progressText.textContent = `${count} / ${item.count}x`;

          if (count >= item.count) {
            tapBtn.classList.add('done');
            tapBtn.innerHTML = '✓ Selesai';
            card.classList.add('completed');
            playTargetReachedSound();
            triggerHaptic('complete');
            showToast(`Selesai membaca: ${item.title}`);
          } else {
            tapBtn.classList.remove('done');
            tapBtn.innerHTML = '📿 Tekan Hitung';
            card.classList.remove('completed');
            playClickSound();
            triggerHaptic('tap');
          }
        });

        resetBtn.addEventListener('click', () => {
          state.ratibCounts[item.id] = 0;
          localStorage.setItem('yarosul_ratib_counts', JSON.stringify(state.ratibCounts));
          progressText.textContent = `0 / ${item.count}x`;
          tapBtn.classList.remove('done');
          tapBtn.innerHTML = '📿 Tekan Hitung';
          card.classList.remove('completed');
          triggerHaptic('tap');
          showToast(`Hitungan direset`);
        });
      }

      digitalContentArea.appendChild(card);
    });
  }

  // 2. Doa Ratibul Haddad Lengkap Section (Hal 42 - 45)
  function renderDoaRatibSection() {
    const hero = document.createElement('div');
    hero.className = 'section-hero-card';
    hero.innerHTML = `
      <div class="hero-arabic-title">دُعَاءُ رَاتِبِ الْحَدَّادِ</div>
      <div class="hero-title">Doa Ratibul Haddad & Penutup</div>
      <div class="hero-desc">Doa Munajat, Permohonan Ridha & Shalawat Penutup (Buku Hal 42 - 45)</div>
    `;
    digitalContentArea.appendChild(hero);

    const bismillah = document.createElement('div');
    bismillah.className = 'bismillah-card';
    bismillah.innerHTML = `<div class="bismillah-text">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>`;
    digitalContentArea.appendChild(bismillah);

    const doaItems = YAROSUL_DATA.ratib.filter(item => item.id === 'r27' || item.id === 'r28');
    doaItems.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.id = `doa_card_${item.id}`;
      card.innerHTML = `
        <div class="card-header-row">
          <div class="card-num-badge">${index === 0 ? '🤲' : '✨'}</div>
          <div class="card-title-text" style="font-size:15px; font-weight:800; color:var(--color-primary);">${item.title}</div>
          <div class="card-page-link" data-page="${item.page}">
            📄 Hal ${item.page}
          </div>
        </div>
        <div class="arabic-box" style="font-size:calc(var(--arabic-size) * 1.05);">${item.arabic.replace(/\n/g, '<br><br>')}</div>
        <div class="latin-box">${item.latin.replace(/\n/g, '<br><br>')}</div>
        <div class="trans-box">${item.translation.replace(/\n/g, '<br><br>')}</div>
      `;
      card.querySelector('.card-page-link').addEventListener('click', (e) => {
        const page = parseInt(e.currentTarget.dataset.page);
        switchMode('book');
        loadBookPage(page, true);
      });
      digitalContentArea.appendChild(card);
    });
  }

  // 3. Quran Surah Section (Yasin & Al-Waqi'ah with Murottal Audio)
  function renderQuranSection(surahData, titleLatin, titleArabic, desc, startPage) {
    const hero = document.createElement('div');
    hero.className = 'section-hero-card';
    hero.innerHTML = `
      <div class="hero-arabic-title">${titleArabic}</div>
      <div class="hero-title">${titleLatin}</div>
      <div class="hero-desc">${desc} • Mulai Halaman ${startPage} di Buku</div>
    `;
    digitalContentArea.appendChild(hero);

    // Audio Player Card
    const audioCard = document.createElement('div');
    audioCard.className = 'audio-player-card';
    audioCard.innerHTML = `
      <div class="audio-header-row">
        <div class="audio-reciter-tag">
          <span>🎙️</span> Syaikh Misyari Rasyid
        </div>
        <div style="font-size:11px; opacity:0.8;">Audio Online Murottal</div>
      </div>
      <div class="audio-controls-row">
        <button class="audio-main-play-btn" id="surahMainPlayBtn" title="Putar Murottal Lengkap">
          ▶
        </button>
        <div class="audio-info-col">
          <div class="audio-track-title">${titleLatin} (${titleArabic})</div>
          <div class="audio-track-status" id="surahAudioStatus">Murottal: Ketuk ▶ untuk dengarkan lengkap</div>
        </div>
      </div>
    `;
    digitalContentArea.appendChild(audioCard);
    audioCard.querySelector('#surahMainPlayBtn').addEventListener('click', () => {
      toggleFullSurahAudio(surahData, titleLatin);
    });

    const bismillah = document.createElement('div');
    bismillah.className = 'bismillah-card';
    bismillah.innerHTML = `<div class="bismillah-text">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>`;
    digitalContentArea.appendChild(bismillah);

    if (surahData && surahData.ayat) {
      surahData.ayat.forEach((verse) => {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.id = `verse_card_${verse.nomorAyat}`;

        const verseAudioUrl = verse.audio ? (verse.audio['05'] || verse.audio['01']) : null;

        card.innerHTML = `
          <div class="card-header-row">
            <div class="card-num-badge">${verse.nomorAyat}</div>
            <div class="card-title-text">Ayat ${verse.nomorAyat}</div>
            <div style="display:flex; align-items:center; gap:6px;">
              ${verseAudioUrl ? `<button class="verse-audio-btn" data-audio="${verseAudioUrl}" title="Putar audio ayat ini">▶ 🔊</button>` : ''}
              <div class="card-page-link" data-page="${startPage}">
                📖 Buku
              </div>
            </div>
          </div>
          <div class="arabic-box">${verse.teksArab}</div>
          <div class="latin-box">${verse.teksLatin}</div>
          <div class="trans-box">${verse.teksIndonesia}</div>
        `;

        if (verseAudioUrl) {
          const verseBtn = card.querySelector('.verse-audio-btn');
          verseBtn.addEventListener('click', () => {
            playVerseAudio(verse.nomorAyat, verseAudioUrl, card, verseBtn);
          });
        }

        card.querySelector('.card-page-link').addEventListener('click', () => {
          stopAllAudio();
          switchMode('book');
          loadBookPage(startPage, true);
        });

        digitalContentArea.appendChild(card);
      });
    }
  }

  // 3. Fadhilah Section
  function renderFadhilahSection() {
    const hero = document.createElement('div');
    hero.className = 'section-hero-card';
    hero.innerHTML = `
      <div class="hero-arabic-title">فَضَائِلُ وَمَنَافِعُ</div>
      <div class="hero-title">Fadhilah & Manfaat Ratib</div>
      <div class="hero-desc">Keutamaan, Barakah, dan Biografi Al-Imam Abdullah bin Alawi Al-Haddad</div>
    `;
    digitalContentArea.appendChild(hero);

    YAROSUL_DATA.fadhilah.forEach(item => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `
        <div class="card-header-row">
          <div class="card-title-text" style="font-size:16px;">${item.title}</div>
        </div>
        <div style="font-size: 14px; line-height: 1.8; color: var(--color-text); white-space: pre-line;">
          ${item.content}
        </div>
      `;
      digitalContentArea.appendChild(card);
    });
  }

  // 4. Pengantar & Sambutan
  function renderPengantarSection() {
    const hero = document.createElement('div');
    hero.className = 'section-hero-card';
    hero.innerHTML = `
      <div class="hero-arabic-title">مُقَدِّمَةُ الْكِتَابِ</div>
      <div class="hero-title">Kata Pengantar & Sambutan</div>
      <div class="hero-desc">Oleh Pengasuh Majlis Ya Rosul, KH. Masykur Hafidh - Poncokusumo</div>
    `;
    digitalContentArea.appendChild(hero);

    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div style="font-size: 14px; line-height: 1.8; color: var(--color-text); white-space: pre-line;">
        ${YAROSUL_DATA.pengantar}
      </div>
      <div style="margin-top: 20px; padding-top: 14px; border-top: 1px dashed var(--color-border); text-align: center;">
        <p style="font-weight: 700; color: var(--color-primary); font-size: 15px;">KH. MASYKUR HAFIDH</p>
        <p style="font-size: 12px; color: var(--color-text-muted);">Pondok Pesantren Salafiyah Nurul Huda</p>
        <p style="font-size: 11px; color: var(--color-text-muted);">Pajaran - Poncokusumo, Malang Jawa Timur</p>
      </div>
    `;
    digitalContentArea.appendChild(card);
  }

  // ==========================================
  // Mode Switcher (Book <-> Digital)
  // ==========================================
  function switchMode(mode) {
    state.activeMode = mode;
    localStorage.setItem('yarosul_mode', mode);
    document.body.classList.toggle('book-active', mode === 'book');

    if (mode === 'book') {
      bookView.classList.add('active');
      digitalView.classList.remove('active');
      navBook.classList.add('active');
      navDigital.classList.remove('active');
      loadBookPage(state.currentPage);
    } else {
      bookView.classList.remove('active');
      digitalView.classList.add('active');
      navBook.classList.remove('active');
      navDigital.classList.add('active');
      renderDigitalContent(state.digitalTab);
    }
  }

  navBook.addEventListener('click', () => {
    switchMode('book');
    triggerHaptic('tap');
  });

  navDigital.addEventListener('click', () => {
    switchMode('digital');
    triggerHaptic('tap');
  });

  // Digital Tabs Switcher
  digitalTabs.querySelectorAll('.tab-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      switchDigitalTab(e.currentTarget.dataset.tab);
      triggerHaptic('tap');
    });
  });

  // ==========================================
  // ==========================================
  // Table of Contents & Navigation Modal (Multi-Tabs)
  // ==========================================
  let currentTocTab = 'chapters';

  function switchTocTab(tab) {
    currentTocTab = tab;
    document.querySelectorAll('.toc-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    if (tab === 'chapters') {
      renderTocChapters();
    } else if (tab === 'thumbnails') {
      renderTocThumbnails();
    } else if (tab === 'bookmarks') {
      renderTocBookmarks();
    }
    triggerHaptic('tap');
  }

  function renderTocChapters() {
    const tocList = document.getElementById('tocList');
    if (!tocList) return;
    tocList.innerHTML = '';

    YAROSUL_DATA.chapters.forEach(ch => {
      const item = document.createElement('div');
      item.className = 'toc-item';
      item.innerHTML = `
        <div class="toc-item-left">
          <span class="toc-icon">${ch.icon}</span>
          <div>
            <div class="toc-title">${ch.title}</div>
            <div class="toc-category">${ch.category}</div>
          </div>
        </div>
        <div class="toc-pages">Hal ${ch.pageStart}${ch.pageEnd > ch.pageStart ? ` - ${ch.pageEnd}` : ''}</div>
      `;

      item.addEventListener('click', () => {
        closeModals();
        loadBookPage(ch.pageStart, true);
        if (state.activeMode !== 'book') {
          switchMode('book');
        }
        triggerHaptic('tap');
      });

      tocList.appendChild(item);
    });
  }

  function renderTocThumbnails() {
    const tocList = document.getElementById('tocList');
    if (!tocList) return;
    tocList.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'thumbnails-grid';

    for (let i = 1; i <= TOTAL_PAGES; i++) {
      const ch = getChapterForPage(i);
      const isCur = (i === state.currentPage);
      const isBm = isBookmarked(i);

      const card = document.createElement('div');
      card.className = `thumb-card ${isCur ? 'current-page' : ''}`;
      card.innerHTML = `
        <div class="thumb-img-wrap">
          <img src="assets/pages/page_${i}.webp" loading="lazy" alt="Halaman ${i}" class="thumb-img">
          <span class="thumb-badge">Hal ${i}</span>
          ${isBm ? '<span class="thumb-bookmark-icon">🔖</span>' : ''}
        </div>
        <div class="thumb-meta">
          <div class="thumb-title">${ch.title}</div>
        </div>
      `;

      card.addEventListener('click', () => {
        closeModals();
        loadBookPage(i, true);
        if (state.activeMode !== 'book') switchMode('book');
        triggerHaptic('tap');
      });

      grid.appendChild(card);
    }

    tocList.appendChild(grid);
  }

  function renderTocBookmarks() {
    const tocList = document.getElementById('tocList');
    if (!tocList) return;
    tocList.innerHTML = '';

    if (state.bookmarks.length === 0) {
      tocList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔖</div>
          <div class="empty-state-text">Belum Ada Penanda</div>
          <div class="empty-state-sub">Ketuk tombol <b>"🔖 Tandai"</b> saat membaca untuk menyimpan halaman penting Anda di sini.</div>
        </div>
      `;
      return;
    }

    const list = document.createElement('div');
    list.className = 'bookmarks-list';

    state.bookmarks.forEach(page => {
      const ch = getChapterForPage(page);
      const item = document.createElement('div');
      item.className = 'bookmark-item';
      item.innerHTML = `
        <div class="bookmark-item-left">
          <span class="bookmark-item-ribbon">🔖</span>
          <div>
            <div class="bookmark-item-title">Halaman ${page}</div>
            <div class="bookmark-item-meta">${ch.icon} ${ch.title}</div>
          </div>
        </div>
        <div class="bookmark-item-actions">
          <button class="bookmark-delete-btn" title="Hapus penanda" aria-label="Hapus penanda">🗑️</button>
        </div>
      `;

      item.querySelector('.bookmark-item-left').addEventListener('click', () => {
        closeModals();
        loadBookPage(page, true);
        if (state.activeMode !== 'book') switchMode('book');
        triggerHaptic('tap');
      });

      item.querySelector('.bookmark-delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleBookmark(page);
      });

      list.appendChild(item);
    });

    tocList.appendChild(list);
  }

  function renderTocList() {
    switchTocTab(currentTocTab);
  }

  if (tocTabsNav) {
    tocTabsNav.querySelectorAll('.toc-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        switchTocTab(e.currentTarget.dataset.tab);
      });
    });
  }

  // ==========================================
  // Floating Tasbih Mandiri (Bebas)
  // ==========================================
  const tasbihProgressRing = document.getElementById('tasbihProgressRing');
  const tasbihBigNumber = document.getElementById('tasbihBigNumber');
  const tasbihRingLabel = document.getElementById('tasbihRingLabel');
  const tasbihTapTarget = document.getElementById('tasbihTapTarget');
  const resetTasbihBtn = document.getElementById('resetTasbihBtn');
  const ringRadius = 80;
  const ringCircumference = 2 * Math.PI * ringRadius;

  if (tasbihProgressRing) {
    tasbihProgressRing.style.strokeDasharray = `${ringCircumference} ${ringCircumference}`;
  }

  function updateFreeTasbihDisplay() {
    tasbihBigNumber.textContent = state.freeTasbih.count;
    const target = state.freeTasbih.target;

    if (target > 0) {
      tasbihRingLabel.textContent = `Target: ${target}`;
      const progress = Math.min(state.freeTasbih.count / target, 1.0);
      const offset = ringCircumference - (progress * ringCircumference);
      tasbihProgressRing.style.strokeDashoffset = offset;
    } else {
      tasbihRingLabel.textContent = 'Mode Hitung Bebas';
      tasbihProgressRing.style.strokeDashoffset = ringCircumference;
    }

    localStorage.setItem('yarosul_free_count', state.freeTasbih.count);
    localStorage.setItem('yarosul_free_target', state.freeTasbih.target);
  }

  tasbihTapTarget.addEventListener('click', () => {
    state.freeTasbih.count++;
    const target = state.freeTasbih.target;

    if (target > 0 && state.freeTasbih.count >= target) {
      updateFreeTasbihDisplay();
      playTargetReachedSound();
      triggerHaptic('complete');
      showToast(`Target ${target} tercapai! Alhamdulillah.`);
      state.freeTasbih.count = 0; // reset for next cycle
    } else {
      updateFreeTasbihDisplay();
      playClickSound();
      triggerHaptic('tap');
    }
  });

  resetTasbihBtn.addEventListener('click', () => {
    state.freeTasbih.count = 0;
    updateFreeTasbihDisplay();
    triggerHaptic('tap');
    showToast('Tasbih direset ke 0');
  });

  document.querySelectorAll('.target-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      document.querySelectorAll('.target-pill').forEach(p => p.classList.remove('active'));
      e.currentTarget.classList.add('active');
      state.freeTasbih.target = parseInt(e.currentTarget.dataset.target);
      updateFreeTasbihDisplay();
      triggerHaptic('tap');
    });
  });

  // ==========================================
  // Modal Handlers
  // ==========================================
  function openModal(modal) {
    modal.classList.add('open');
  }

  function closeModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
  }

  document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.addEventListener('click', closeModals);
  });

  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModals();
      }
    });
  });

  navToc.addEventListener('click', () => {
    renderTocList();
    openModal(tocModal);
    triggerHaptic('tap');
  });

  navSettings.addEventListener('click', () => {
    openModal(settingsModal);
    triggerHaptic('tap');
  });

  fabTasbih.addEventListener('click', () => {
    updateFreeTasbihDisplay();
    openModal(tasbihModal);
    triggerHaptic('tap');
  });

  // Top header button shortcuts
  document.getElementById('headerTocBtn').addEventListener('click', () => {
    renderTocList();
    openModal(tocModal);
    triggerHaptic('tap');
  });

  document.getElementById('headerSettingsBtn').addEventListener('click', () => {
    openModal(settingsModal);
    triggerHaptic('tap');
  });

  // Settings Toggles
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const theme = e.currentTarget.dataset.theme;
      applyTheme(theme);
      triggerHaptic('tap');
    });
  });

  // Paper Tone Option Buttons in Settings
  document.querySelectorAll('.tone-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tone = e.currentTarget.dataset.tone;
      applyPaperTone(tone);
      const names = { normal: 'Scan Asli ☀️', sepia: 'Krem Hangat (Sepia) 📜', dark: 'Mode Malam (Invert) 🌙' };
      showToast(`Nuansa kertas: ${names[tone]}`);
      triggerHaptic('tap');
    });
  });

  const soundToggle = document.getElementById('soundToggle');
  soundToggle.checked = state.soundEnabled;
  soundToggle.addEventListener('change', (e) => {
    state.soundEnabled = e.target.checked;
    localStorage.setItem('yarosul_sound', state.soundEnabled);
    if (state.soundEnabled) playClickSound();
  });

  const vibrateToggle = document.getElementById('vibrateToggle');
  vibrateToggle.checked = state.vibrateEnabled;
  vibrateToggle.addEventListener('change', (e) => {
    state.vibrateEnabled = e.target.checked;
    localStorage.setItem('yarosul_vibrate', state.vibrateEnabled);
    if (state.vibrateEnabled) triggerHaptic('tap');
  });

  const latinToggle = document.getElementById('latinToggle');
  latinToggle.checked = state.showLatin;
  latinToggle.addEventListener('change', (e) => {
    state.showLatin = e.target.checked;
    localStorage.setItem('yarosul_show_latin', state.showLatin);
    applyFontSettings();
  });

  const transToggle = document.getElementById('transToggle');
  transToggle.checked = state.showTrans;
  transToggle.addEventListener('change', (e) => {
    state.showTrans = e.target.checked;
    localStorage.setItem('yarosul_show_trans', state.showTrans);
    applyFontSettings();
  });

  // Font Size Slider
  const fontSizeSlider = document.getElementById('fontSizeSlider');
  fontSizeSlider.value = state.fontSize;
  fontSizeSlider.addEventListener('input', (e) => {
    state.fontSize = parseInt(e.target.value);
    applyFontSettings();
  });

  // Reset All Ratib Counters button
  const resetAllCountersBtn = document.getElementById('resetAllCountersBtn');
  if (resetAllCountersBtn) {
    resetAllCountersBtn.addEventListener('click', () => {
      state.ratibCounts = {};
      localStorage.removeItem('yarosul_ratib_counts');
      if (state.activeMode === 'digital' && state.digitalTab === 'ratib') {
        renderRatibSection();
      }
      showToast('Semua hitungan dzikir telah direset');
      triggerHaptic('tap');
    });
  }

  // ==========================================
  // PWA Install Prompt & Service Worker Registration
  // ==========================================
  let deferredPrompt = null;
  const headerInstallBtn = document.getElementById('headerInstallBtn');
  const btnInstallPwa = document.getElementById('btnInstallPwa');
  const installPwaCard = document.getElementById('installPwaCard');
  const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  if (isInStandaloneMode) {
    if (headerInstallBtn) headerInstallBtn.style.display = 'none';
    if (installPwaCard) {
      installPwaCard.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:22px;">✅</span>
          <div>
            <div style="font-weight:700; font-size:13px; color:var(--color-primary);">Aplikasi Sudah Terpasang!</div>
            <div style="font-size:11px; color:var(--color-text-muted);">Anda sedang menggunakan versi PWA standalone.</div>
          </div>
        </div>
      `;
    }
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (headerInstallBtn) headerInstallBtn.style.display = 'inline-flex';
    if (btnInstallPwa) {
      btnInstallPwa.style.display = 'block';
    }
  });

  async function triggerPwaInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        showToast('Terima kasih telah memasang Ya Rosul!');
        if (headerInstallBtn) headerInstallBtn.style.display = 'none';
      }
      deferredPrompt = null;
    } else if (isIos) {
      showToast('Ketuk tombol Share (⎋) di Safari lalu pilih "Tambah ke Layar Utama"');
    } else {
      showToast('Ketuk menu browser (titik 3) lalu pilih "Tambahkan ke Layar Utama"');
    }
  }

  if (headerInstallBtn) {
    headerInstallBtn.addEventListener('click', triggerPwaInstall);
  }
  if (btnInstallPwa) {
    btnInstallPwa.addEventListener('click', triggerPwaInstall);
  }

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (headerInstallBtn) headerInstallBtn.style.display = 'none';
    showToast('Aplikasi Ya Rosul berhasil terpasang di HP Anda!');
  });

  // ==========================================
  // Wake Lock: Layar Tetap Menyala
  // ==========================================
  let wakeLock = null;
  const wakeLockToggle = document.getElementById('wakeLockToggle');

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
          wakeLock = null;
          if (wakeLockToggle) wakeLockToggle.checked = false;
        });
        showToast('🌙 Layar tetap menyala aktif');
      } else {
        showToast('Browser ini belum mendukung fitur Wake Lock');
        if (wakeLockToggle) wakeLockToggle.checked = false;
      }
    } catch (err) {
      showToast('Tidak dapat mengaktifkan mode layar menyala');
      if (wakeLockToggle) wakeLockToggle.checked = false;
    }
  }

  async function releaseWakeLock() {
    if (wakeLock) {
      try { await wakeLock.release(); } catch(e) {}
      wakeLock = null;
      showToast('🌙 Layar tetap menyala dimatikan');
    }
  }

  if (wakeLockToggle) {
    wakeLockToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        requestWakeLock();
      } else {
        releaseWakeLock();
      }
    });
  }

  // Re-acquire wake lock if page becomes visible again (e.g. after screen off)
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && wakeLockToggle && wakeLockToggle.checked && !wakeLock) {
      await requestWakeLock();
    }
  });

  // ==========================================
  // Mode Layar Penuh (Fullscreen & Immersive Reading)
  // ==========================================
  const headerFullscreenBtn = document.getElementById('headerFullscreenBtn');
  const bookFullscreenBtn = document.getElementById('bookFullscreenBtn');
  const floatingExitFullscreenBtn = document.getElementById('floatingExitFullscreenBtn');
  const fullscreenToggle = document.getElementById('fullscreenToggle');

  function isNativeFullscreen() {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
  }

  function updateFullscreenUI(active) {
    state.isFullscreen = active;
    document.body.classList.toggle('fullscreen-mode', active);

    if (!active) {
      document.body.classList.remove('hide-book-controls');
    }

    if (headerFullscreenBtn) {
      headerFullscreenBtn.innerHTML = active ? '🗗' : '⛶';
      headerFullscreenBtn.title = active ? 'Keluar Layar Penuh' : 'Mode Layar Penuh';
      headerFullscreenBtn.setAttribute('aria-label', active ? 'Keluar Layar Penuh' : 'Mode Layar Penuh');
    }

    if (bookFullscreenBtn) {
      bookFullscreenBtn.innerHTML = active ? '🗗 Keluar' : '⛶ Penuh';
      bookFullscreenBtn.title = active ? 'Keluar Layar Penuh' : 'Mode Layar Penuh (Fokus Baca)';
      bookFullscreenBtn.classList.toggle('active-fullscreen', active);
    }

    if (fullscreenToggle && fullscreenToggle.checked !== active) {
      fullscreenToggle.checked = active;
    }
  }

  async function enterFullscreen() {
    updateFullscreenUI(true);
    const docEl = document.documentElement;
    try {
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      } else if (docEl.mozRequestFullScreen) {
        await docEl.mozRequestFullScreen();
      } else if (docEl.msRequestFullscreen) {
        await docEl.msRequestFullscreen();
      }
    } catch (e) {
      // Browsers with strict gestures or iOS fallback gracefully
    }
    showToast('⛶ Mode Layar Penuh aktif');
    triggerHaptic('tap');
  }

  async function exitFullscreen() {
    updateFullscreenUI(false);
    try {
      if (isNativeFullscreen()) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          await document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
      }
    } catch (e) {}
    showToast('Keluar dari Layar Penuh');
    triggerHaptic('tap');
  }

  function toggleFullscreen() {
    if (state.isFullscreen || isNativeFullscreen()) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }

  if (headerFullscreenBtn) {
    headerFullscreenBtn.addEventListener('click', toggleFullscreen);
  }
  if (bookFullscreenBtn) {
    bookFullscreenBtn.addEventListener('click', toggleFullscreen);
  }
  if (floatingExitFullscreenBtn) {
    floatingExitFullscreenBtn.addEventListener('click', exitFullscreen);
  }
  if (fullscreenToggle) {
    fullscreenToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        enterFullscreen();
      } else {
        exitFullscreen();
      }
    });
  }

  // Handle native ESC or hardware gesture exits
  ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evt => {
    document.addEventListener(evt, () => {
      const nativeActive = isNativeFullscreen();
      if (!nativeActive && state.isFullscreen) {
        updateFullscreenUI(false);
      } else if (nativeActive && !state.isFullscreen) {
        updateFullscreenUI(true);
      }
    });
  });

  // Keyboard shortcut: 'f' or 'F' toggles fullscreen
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'f' || e.key === 'F') && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      toggleFullscreen();
    }
  });

  // ==========================================
  // Share Modal & QR Code
  // ==========================================
  const APP_URL = 'https://prihantowahyu.github.io/Yarosul/';
  const WA_MSG = encodeURIComponent(
    'Assalamu\'alaikum 🤲\n\n' +
    'Yuk baca Dzikir & Ta\'lim Ya Rosul bersama! ' +
    'Tersedia Ratibul Haddad, Surat Yasin, Al-Waqi\'ah, dan Tasbih Digital.\n\n' +
    '📱 Bisa dipasang di HP (offline):\n' + APP_URL + '\n\n' +
    'Dari: Ponpes Salafiyah Nurul Huda Pajaran - Poncokusumo Malang'
  );

  const shareModal = document.getElementById('shareModal');
  const qrCodeCanvas = document.getElementById('qrCodeCanvas');
  const shareUrlDisplay = document.getElementById('shareUrlDisplay');
  let qrGenerated = false;

  function openShareModal() {
    if (shareModal) {
      openModal(shareModal);
      if (shareUrlDisplay) shareUrlDisplay.textContent = APP_URL;
      // Generate QR code only once
      if (!qrGenerated && qrCodeCanvas && typeof QRCode !== 'undefined') {
        qrCodeCanvas.innerHTML = '';
        new QRCode(qrCodeCanvas, {
          text: APP_URL,
          width: 200,
          height: 200,
          colorDark: '#0d3b2e',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
        qrGenerated = true;
      }
      // Show native share button if supported
      const nativeShareBtn = document.getElementById('nativeShareBtn');
      if (nativeShareBtn && navigator.share) {
        nativeShareBtn.style.display = 'block';
      }
    }
  }

  const headerShareBtn = document.getElementById('headerShareBtn');
  const shareWaBtn = document.getElementById('shareWaBtn');
  const shareQrBtn = document.getElementById('shareQrBtn');
  const shareToWaBtn = document.getElementById('shareToWaBtn');
  const copyLinkBtn = document.getElementById('copyLinkBtn');
  const nativeShareBtn = document.getElementById('nativeShareBtn');

  if (headerShareBtn) {
    headerShareBtn.addEventListener('click', () => {
      closeModals();
      openShareModal();
      triggerHaptic('tap');
    });
  }

  if (shareWaBtn) {
    shareWaBtn.addEventListener('click', () => {
      window.open(`https://wa.me/?text=${WA_MSG}`, '_blank');
      triggerHaptic('tap');
    });
  }

  if (shareQrBtn) {
    shareQrBtn.addEventListener('click', () => {
      closeModals();
      openShareModal();
      triggerHaptic('tap');
    });
  }

  if (shareToWaBtn) {
    shareToWaBtn.addEventListener('click', () => {
      window.open(`https://wa.me/?text=${WA_MSG}`, '_blank');
      triggerHaptic('tap');
    });
  }

  if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', () => {
      try {
        navigator.clipboard.writeText(APP_URL).then(() => {
          showToast('✅ Tautan berhasil disalin!');
        });
      } catch(e) {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = APP_URL;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('✅ Tautan berhasil disalin!');
      }
      triggerHaptic('tap');
    });
  }

  if (nativeShareBtn) {
    nativeShareBtn.addEventListener('click', async () => {
      try {
        await navigator.share({
          title: 'Ya Rosul – Majlis Dzikir & Ta\'lim',
          text: 'Ayo baca Dzikir Ya Rosul bersama! Ratibul Haddad, Surat Yasin, Al-Waqi\'ah & Tasbih Digital.',
          url: APP_URL
        });
      } catch(e) {}
      triggerHaptic('tap');
    });
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => {
          console.log('ServiceWorker registered:', reg.scope);
        })
        .catch(err => {
          console.log('ServiceWorker registration skipped:', err);
        });
    });
  }

  // ==========================================
  // Initialize App
  // ==========================================
  applyTheme(state.theme);
  applyPaperTone(state.paperTone);
  renderChapterChips();
  updateFreeTasbihDisplay();
  applyFontSettings();
  switchMode(state.activeMode);

  // Preload initial pages
  preloadPage(1);
  preloadPage(2);
  preloadPage(3);
  preloadPage(state.currentPage);
  preloadPage(state.currentPage + 1);

  // Auto-Resume notification if not on page 1
  if (state.currentPage > 1) {
    const ch = getChapterForPage(state.currentPage);
    setTimeout(() => {
      showToast(`📖 Terakhir dibaca: Hal ${state.currentPage} (${ch.title})`, 2800);
    }, 600);
  }

  console.log('Ya Rosul Mobile Web App Ready!');
});
