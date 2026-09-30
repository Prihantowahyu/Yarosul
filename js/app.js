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
    }
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
    pageIndicator.textContent = `${pageNum} / ${TOTAL_PAGES}`;
    bookRange.value = pageNum;

    // Update image with soft fade
    bookPageImg.style.opacity = '0.4';
    bookPageImg.src = `assets/pages/page_${pageNum}.webp`;
    bookPageImg.onload = () => {
      bookPageImg.style.opacity = '1';
    };

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

    // Reset zoom when navigating
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

  function setZoom(level) {
    state.zoomLevel = level;
    if (level === 1.0) {
      bookPageWrapper.style.transform = 'none';
      zoomBtn.innerHTML = '🔍 1x';
    } else {
      bookPageWrapper.style.transform = `scale(${level})`;
      zoomBtn.innerHTML = `🔍 ${level}x`;
    }
  }

  function toggleZoom() {
    if (state.zoomLevel === 1.0) {
      setZoom(1.5);
    } else if (state.zoomLevel === 1.5) {
      setZoom(2.0);
    } else {
      setZoom(1.0);
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

  // Mobile Touch Gestures for Book Page
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;

  const canvasArea = document.getElementById('bookCanvasArea');
  canvasArea.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchEndX = touchStartX;
      touchEndY = touchStartY;
    }
  }, { passive: true });

  canvasArea.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) {
      touchEndX = e.touches[0].clientX;
      touchEndY = e.touches[0].clientY;
    }
  }, { passive: true });

  canvasArea.addEventListener('touchend', (e) => {
    if (state.zoomLevel > 1.0) return; // Don't swipe while zoomed in
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;

    // Check if horizontal swipe exceeds 45px and is primarily horizontal
    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX < 0) {
        // Swiped left -> next page
        nextPage();
      } else {
        // Swiped right -> prev page
        prevPage();
      }
    }
  }, { passive: true });

  // Double tap to zoom
  let lastTap = 0;
  canvasArea.addEventListener('touchend', (e) => {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    if (tapLength < 300 && tapLength > 0) {
      toggleZoom();
      e.preventDefault();
    }
    lastTap = currentTime;
  });

  // Tap zones left/right
  document.getElementById('tapZoneLeft').addEventListener('click', () => prevPage());
  document.getElementById('tapZoneRight').addEventListener('click', () => nextPage());
  prevPageBtn.addEventListener('click', () => prevPage());
  nextPageBtn.addEventListener('click', () => nextPage());
  zoomBtn.addEventListener('click', () => toggleZoom());

  bookRange.addEventListener('input', (e) => {
    loadBookPage(parseInt(e.target.value));
  });

  // ==========================================
  // Mode 2: Digital Text & Interactive Tasbih
  // ==========================================
  function switchDigitalTab(tabId) {
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
      <div class="hero-desc">Disusun oleh Al-Imam Quthbil Irsyad Al-Habib Abdullah bin Alawi Al-Haddad RA</div>
    `;
    digitalContentArea.appendChild(hero);

    const bismillah = document.createElement('div');
    bismillah.className = 'bismillah-card';
    bismillah.innerHTML = `<div class="bismillah-text">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>`;
    digitalContentArea.appendChild(bismillah);

    YAROSUL_DATA.ratib.forEach((item, index) => {
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

  // 2. Quran Surah Section (Yasin & Al-Waqi'ah)
  function renderQuranSection(surahData, titleLatin, titleArabic, desc, startPage) {
    const hero = document.createElement('div');
    hero.className = 'section-hero-card';
    hero.innerHTML = `
      <div class="hero-arabic-title">${titleArabic}</div>
      <div class="hero-title">${titleLatin}</div>
      <div class="hero-desc">${desc} • Mulai Halaman ${startPage} di Buku</div>
    `;
    digitalContentArea.appendChild(hero);

    const bismillah = document.createElement('div');
    bismillah.className = 'bismillah-card';
    bismillah.innerHTML = `<div class="bismillah-text">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>`;
    digitalContentArea.appendChild(bismillah);

    if (surahData && surahData.ayat) {
      surahData.ayat.forEach((verse) => {
        const card = document.createElement('div');
        card.className = 'item-card';

        card.innerHTML = `
          <div class="card-header-row">
            <div class="card-num-badge">${verse.nomorAyat}</div>
            <div class="card-title-text">Ayat ${verse.nomorAyat}</div>
            <div class="card-page-link" data-page="${startPage}">
              📖 Buka di Buku
            </div>
          </div>
          <div class="arabic-box">${verse.teksArab}</div>
          <div class="latin-box">${verse.teksLatin}</div>
          <div class="trans-box">${verse.teksIndonesia}</div>
        `;

        card.querySelector('.card-page-link').addEventListener('click', () => {
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
  // Table of Contents Modal
  // ==========================================
  function renderTocList() {
    const tocList = document.getElementById('tocList');
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

  console.log('Ya Rosul Mobile Web App Ready!');
});
