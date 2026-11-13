/* «Իմ տեղակայումը» բաժինը հեռացված է. հին պահված տեղակայման տվյալները զրոյացվում են */
try{ localStorage.removeItem('kspasemLocation'); localStorage.removeItem('kspasemMyLocation'); }catch(e){}

  document.addEventListener('touchmove', function(e){
    if(e.target.closest('.scrollable')) return;
    e.preventDefault();
  }, { passive:false });

  function proceedAfterOnboarding(){
    var setup = document.getElementById('setup');
    var savedSetup = null;
    try{ savedSetup = JSON.parse(localStorage.getItem('kspasemSetupData') || 'null'); }catch(err){}

    if(savedSetup && savedSetup.name && savedSetup.startDate && savedSetup.returnDate){
      nameInput.value = savedSetup.name;
      startInput.value = savedSetup.startDate;
      returnInput.value = savedSetup.returnDate;
      document.getElementById('cdNameText').textContent = savedSetup.name;
      setup.style.display = 'none';
      document.getElementById('countdown').classList.add('active');
      document.getElementById('mainDock').classList.add('visible');
      refreshCountdownCard();
    } else {
      setup.classList.add('active');
    }
  }

  /* ===== Գովազդի պատուհան (splash-ից հետո, ապպ մտնելիս) ===== */
  var AD_FETCH_TIMEOUT_MS = 2500;
  var AD_CLOSE_DELAY_SEC = 5;

  function adParseTimeToMinutes(t){
    var parts = (t || '').split(':');
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    if(isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  }

  function isWithinAdWindow(timeStart, timeEnd){
    var startM = adParseTimeToMinutes(timeStart);
    var endM = adParseTimeToMinutes(timeEnd);
    // Եթե ժամային միջակայք սահմանված չէ, գովազդը ցուցադրվում է ցանկացած ժամի
    if(startM === null || endM === null) return true;
    var now = new Date();
    var nowM = now.getHours() * 60 + now.getMinutes();
    if(startM <= endM){
      return nowM >= startM && nowM <= endM;
    }
    // Միջակայքն անցնում է կեսգիշերով (օր. 22:00–06:00)
    return nowM >= startM || nowM <= endM;
  }

  function nextAdIndex(total){
    var idx = 0;
    try{ idx = parseInt(localStorage.getItem('kspasemAdIndex') || '0', 10) || 0; }catch(err){}
    idx = ((idx % total) + total) % total;
    try{ localStorage.setItem('kspasemAdIndex', String((idx + 1) % total)); }catch(err){}
    return idx;
  }

  function normalizeAdLinkUrl(link){
    var url = (link || '').trim();
    if(!url) return '';
    if(!/^https?:\/\//i.test(url)){ url = 'https://' + url; }
    return url;
  }

  function openAdLink(link){
    var url = normalizeAdLinkUrl(link);
    if(!url) return;
    var win = window.open(url, '_blank');
    if(!win){ window.location.href = url; }
  }

  function showAdModal(ad, onClose){
    var overlay = document.getElementById('adModal');
    var img = document.getElementById('adModalImage');
    var closeBtn = document.getElementById('adModalCloseBtn');
    var timerEl = document.getElementById('adModalTimer');
    var closed = false;

    img.src = ad.image;
    img.style.cursor = ad.link ? 'pointer' : 'default';
    var onImgClick = function(){
      openAdLink(ad.link);
    };
    img.addEventListener('click', onImgClick);

    closeBtn.style.display = 'none';
    closeBtn.disabled = true;
    timerEl.style.display = 'flex';
    var secondsLeft = AD_CLOSE_DELAY_SEC;
    timerEl.textContent = secondsLeft;

    overlay.classList.add('active');

    var intervalId = setInterval(function(){
      secondsLeft -= 1;
      if(secondsLeft <= 0){
        clearInterval(intervalId);
        timerEl.style.display = 'none';
        closeBtn.style.display = 'flex';
        closeBtn.disabled = false;
      } else {
        timerEl.textContent = secondsLeft;
      }
    }, 1000);

    function closeAd(){
      if(closed || closeBtn.disabled) return;
      closed = true;
      clearInterval(intervalId);
      overlay.classList.remove('active');
      img.removeEventListener('click', onImgClick);
      closeBtn.removeEventListener('click', closeAd);
      onClose();
    }

    closeBtn.addEventListener('click', closeAd);
  }

  function maybeShowAd(next){
    // Պրեմիում օգտատերերին գովազդ ընդհանրապես չենք ցույց տալիս
    if(isPremium()){ next(); return; }
    if(!db){ next(); return; }
    var settled = false;
    var finish = function(fn){
      if(settled) return;
      settled = true;
      fn();
    };
    var timeoutId = setTimeout(function(){ finish(next); }, AD_FETCH_TIMEOUT_MS);

    db.collection('appConfig').doc('ads').get().then(function(doc){
      clearTimeout(timeoutId);
      if(settled) return;
      if(!doc.exists){ finish(next); return; }
      var data = doc.data() || {};
      var ads = Array.isArray(data.ads) ? data.ads.filter(function(a){ return a && a.image; }) : [];
      if(!data.active || ads.length === 0 || !isWithinAdWindow(data.timeStart, data.timeEnd)){
        finish(next);
        return;
      }
      var idx = nextAdIndex(ads.length);
      finish(function(){ showAdModal(ads[idx], next); });
    }).catch(function(){
      clearTimeout(timeoutId);
      finish(next);
    });
  }

  window.addEventListener('load', function(){
    setTimeout(function(){
      var splash = document.getElementById('splash');
      var onboardingSeen = false;
      try{ onboardingSeen = localStorage.getItem('kspasemOnboardingSeen') === '1'; }catch(err){}

      function hideSplashAndShowOnboarding(){
        splash.style.transition = 'opacity 0.5s ease';
        splash.style.opacity = '0';
        setTimeout(function(){ splash.style.display = 'none'; }, 500);
        document.getElementById('onboardingScreen').classList.add('active');
      }

      function hideSplashAndProceed(){
        splash.style.transition = 'opacity 0.5s ease';
        splash.style.opacity = '0';
        setTimeout(function(){ splash.style.display = 'none'; }, 500);
        // Onboarding is being skipped entirely for a returning user. The very
        // first slide still ships with a hardcoded 'active' class in the raw
        // HTML (so it displays correctly the first time onboarding is shown).
        // That class sets pointer-events:auto, which silently overrides the
        // parent's pointer-events:none and blocks every tap on the whole app
        // forever if it's never cleared. Clear it and hide the container now.
        var onboardingScreenEl = document.getElementById('onboardingScreen');
        document.querySelectorAll('.onb-slide').forEach(function(slide){
          slide.classList.remove('active');
        });
        onboardingScreenEl.classList.remove('active');
        onboardingScreenEl.style.display = 'none';
        proceedAfterOnboarding();
      }

      if(!onboardingSeen){
        // Ամենասկզբից մուտք գործող (առաջին անգամ) օգտատերերին գովազդ ՉԵՆՔ
        // ցույց տալիս. նրանք նախ պիտի տեսնեն "Բարի գալուստ" onboarding-ը,
        // գովազդը կցուցադրվի միայն դրանից հետո (տես onbNextBtn handler-ը)
        hideSplashAndShowOnboarding();
      } else {
        // Վերադարձող օգտատերերի համար, բեռնման պատուհանից (splash) հետո
        // ցուցադրվում է գովազդի պատուհանը (եթե ադմինի կողմից միացված է և
        // ընթացիկ ժամը թույլատրված միջակայքում է). splash-ը մնում է էկրանին
        // մինչև գովազդը փակվի, որ տակի բովանդակությունը կայծկլտալով
        // չերևա գովազդի բեռնվելուց առաջ։
        maybeShowAd(hideSplashAndProceed);
      }
    }, 2600);
  });

  var onbSlides = document.querySelectorAll('.onb-slide');
  var onbDots = document.getElementById('onbDots');
  var onbNextBtn = document.getElementById('onbNextBtn');
  var onbIndex = 0;

  onbSlides.forEach(function(slide, i){
    var dot = document.createElement('div');
    dot.className = 'onb-dot' + (i === 0 ? ' active' : '');
    onbDots.appendChild(dot);
  });

  function updateOnbSlide(){
    onbSlides.forEach(function(slide, i){
      slide.classList.toggle('active', i === onbIndex);
    });
    var dots = onbDots.querySelectorAll('.onb-dot');
    dots.forEach(function(dot, i){
      dot.classList.toggle('active', i === onbIndex);
    });
    onbNextBtn.textContent = (onbIndex === onbSlides.length - 1) ? 'Սկսել' : 'Շարունակել';
  }

  onbNextBtn.addEventListener('click', function(){
    if(onbIndex < onbSlides.length - 1){
      onbIndex++;
      updateOnbSlide();
    } else {
      try{ localStorage.setItem('kspasemOnboardingSeen', '1'); }catch(err){}
      var onboardingScreenEl = document.getElementById('onboardingScreen');
      onboardingScreenEl.classList.remove('active');
      // Also clear 'active' from every slide immediately: a slide left with
      // .active (pointer-events:auto) would override the parent's
      // pointer-events:none and silently block all taps on the app forever.
      onbSlides.forEach(function(slide){ slide.classList.remove('active'); });
      setTimeout(function(){ onboardingScreenEl.style.display = 'none'; }, 450);
      // Գովազդը (եթե ադմինի կողմից միացված է) ցույց ենք տալիս միայն հիմա,
      // "Բարի գալուստ" onboarding-ն ավարտելուց հետո, ոչ թե դրանից առաջ
      maybeShowAd(proceedAfterOnboarding);
    }
  });

  var nameInput = document.getElementById('soldierName');
  var startInput = document.getElementById('startDate');
  var returnInput = document.getElementById('returnDate');
  var continueBtn = document.getElementById('continueBtn');
  var startPlaceholder = document.getElementById('startPlaceholder');
  var returnPlaceholder = document.getElementById('returnPlaceholder');
  var startValue = document.getElementById('startValue');
  var returnValue = document.getElementById('returnValue');
  var startDisplay = document.getElementById('startDisplay');
  var returnDisplay = document.getElementById('returnDisplay');

  var monthsHy = ['հունվարի','փետրվարի','մարտի','ապրիլի','մայիսի','հունիսի','հուլիսի','օգոստոսի','սեպտեմբերի','հոկտեմբերի','նոյեմբերի','դեկտեմբերի'];

  function formatDateHy(dateStr){
    var d = new Date(dateStr);
    return d.getDate() + ' ' + monthsHy[d.getMonth()] + ' ' + d.getFullYear();
  }

  function updateDisplay(input, placeholder, valueEl){
    if(input.value){
      placeholder.classList.add('hidden');
      valueEl.textContent = formatDateHy(input.value);
    } else {
      placeholder.classList.remove('hidden');
      valueEl.textContent = '';
    }
  }

  function openPicker(input){
    if(input.showPicker){
      try{ input.showPicker(); } catch(e){ input.focus(); }
    } else {
      input.focus();
      input.click();
    }
  }

  startDisplay.addEventListener('click', function(){ openPicker(startInput); });
  returnDisplay.addEventListener('click', function(){ openPicker(returnInput); });

  updateDisplay(startInput, startPlaceholder, startValue);
  updateDisplay(returnInput, returnPlaceholder, returnValue);

  function checkValid(){
    continueBtn.disabled = !(nameInput.value.trim() && startInput.value && returnInput.value);
  }

  startInput.addEventListener('change', function(){
    if(startInput.value){
      var d = new Date(startInput.value);
      d.setMonth(d.getMonth() + 18);
      var yyyy = d.getFullYear();
      var mm = String(d.getMonth()+1).padStart(2,'0');
      var dd = String(d.getDate()).padStart(2,'0');
      returnInput.value = yyyy + '-' + mm + '-' + dd;
    }
    updateDisplay(startInput, startPlaceholder, startValue);
    updateDisplay(returnInput, returnPlaceholder, returnValue);
    checkValid();
  });

  nameInput.addEventListener('input', checkValid);
  returnInput.addEventListener('change', function(){
    updateDisplay(returnInput, returnPlaceholder, returnValue);
    checkValid();
  });

  continueBtn.addEventListener('click', function(){
    if(continueBtn.disabled) return;

    document.getElementById('cdNameText').textContent = nameInput.value.trim();
    // If the entered start date is already in the past, every medal that
    // would already be unlocked (100/200/300 days, etc.) must NOT all pop up
    // as separate celebration screens back-to-back on the very first run —
    // just silently mark them as seen this one time.
    suppressCelebrationsOnce = true;
    refreshCountdownCard();

    try{
      localStorage.setItem('kspasemSetupData', JSON.stringify({
        name: nameInput.value.trim(),
        startDate: startInput.value,
        returnDate: returnInput.value
      }));
    }catch(err){}

    var setup = document.getElementById('setup');
    var countdown = document.getElementById('countdown');
    setup.style.opacity = '0';
    setup.style.pointerEvents = 'none';
    countdown.classList.add('active');
    document.getElementById('mainDock').classList.add('visible');
  });
  var settingsScreen = document.getElementById('settingsScreen');
  var dockSettings = document.getElementById('dockSettings');
  var dockHome = document.getElementById('dockHome');
  var changePhotoBtn = document.getElementById('changePhotoBtn');
  var photoInput = document.getElementById('photoInput');
  var countdownEl = document.getElementById('countdown');

  var celebratedMilestones = [];
  try{ celebratedMilestones = JSON.parse(localStorage.getItem('kspasemCelebratedMilestones') || '[]'); }catch(err){}
  function saveCelebratedMilestones(){
    try{ localStorage.setItem('kspasemCelebratedMilestones', JSON.stringify(celebratedMilestones)); }catch(err){}
  }
  var suppressCelebrationsOnce = false;

  var dayCelebrateOverlay = document.getElementById('dayCelebrateOverlay');
  var dcLine1 = document.getElementById('dcLine1');
  var dcLine2 = document.getElementById('dcLine2');
  var dcLine3 = document.getElementById('dcLine3');
  var dcSub = document.getElementById('dcSub');
  var dcBtnLabel = document.getElementById('dcBtnLabel');
  var dcCloseBtn = document.getElementById('dcCloseBtn');
  var dcIconWrap = document.getElementById('dcIconWrap');
  var DC_CALENDAR_ICON = dcIconWrap.innerHTML;
  var celebrationQueue = [];
  var celebrationShowing = false;

  function medalIconSvg(color){
    return '<svg viewBox="0 0 64 64" fill="none">' +
      '<circle cx="32" cy="26" r="20" fill="' + color + '" stroke="rgba(0,0,0,0.15)" stroke-width="1.5"/>' +
      '<circle cx="32" cy="26" r="14" fill="rgba(255,255,255,0.22)"/>' +
      '<path d="M32 17l3.4 7 7.6 1.1-5.5 5.3 1.3 7.6L32 34.5l-6.8 3.5 1.3-7.6-5.5-5.3 7.6-1.1L32 17z" fill="#fff" opacity="0.92"/>' +
      '<path d="M22 40 15 58l9-3.5L28 60l7-16" fill="' + color + '"/>' +
      '<path d="M42 40 49 58l-9-3.5L36 60l-7-16" fill="' + color + '"/>' +
      '</svg>';
  }

  function showCelebrationOverlay(opts){
    celebrationQueue.push({
      line1: opts.line1 || 'Դու ապրեցիր',
      line2: opts.line2 || 'ՄԵԿ ՕՐ',
      line3: opts.line3 || 'քո զինվորին սպասելով ♥',
      sub: opts.sub || 'Շարունակիր նույն սիրով.<br>Ամեն օր մեզ ավելի մոտեցնում է հանդիպմանը ♥',
      btnLabel: opts.btnLabel || 'Փակել',
      iconHtml: opts.iconHtml || null
    });
    runCelebrationQueue();
  }

  function runCelebrationQueue(){
    if(celebrationShowing || !celebrationQueue.length) return;
    var next = celebrationQueue.shift();
    celebrationShowing = true;
    dcLine1.textContent = next.line1;
    dcLine2.textContent = next.line2;
    dcLine3.innerHTML = next.line3;
    dcSub.innerHTML = next.sub;
    dcBtnLabel.textContent = next.btnLabel;
    dcIconWrap.innerHTML = next.iconHtml || DC_CALENDAR_ICON;
    dcIconWrap.style.animation = 'none';
    void dcIconWrap.offsetWidth;
    dcIconWrap.style.animation = '';
    // dc-bg/dc-bg-shade այլևս չեն օգտագործվում. overlay-ի ֆոնը թափանցիկ է,
    // ուստի հենց իրական գլխավոր էջն է երևում հետևից (dock, medal-ներ,
    // և ընթացիկ ֆոնի նկարը՝ լինի default, լինի օգտատիրոջ փոխած)
    dayCelebrateOverlay.classList.add('active');
  }

  function closeCelebrationOverlay(){
    dayCelebrateOverlay.classList.remove('active');
    celebrationShowing = false;
    setTimeout(runCelebrationQueue, 450);
  }

  dcCloseBtn.addEventListener('click', closeCelebrationOverlay);

  function getMilestones(totalDays){
    return [
      { key:'m1', days: Math.min(30, totalDays), icon:'🌱', label:'Առաջին ամիս' },
      { key:'m2', days: Math.min(100, totalDays), icon:'💯', label:'100-րդ օր' },
      { key:'m3', days: Math.min(180, totalDays), icon:'☀️', label:'6 ամիս' },
      { key:'m4', days: Math.min(365, totalDays), icon:'🎉', label:'1 տարի' },
      { key:'m5', days: Math.max(totalDays - 100, 0), icon:'⭐', label:'Վերջին 100 օրը' },
      { key:'m6', days: Math.max(totalDays - 30, 0), icon:'🔥', label:'Վերջին 30 օրը' },
      { key:'m7', days: Math.max(totalDays - 10, 0), icon:'❤️', label:'Վերջին 10 օրը' },
      { key:'m8', days: totalDays, icon:'🏡', label:'Վերադարձ' }
    ];
  }

  function showMilestoneToast(text){
    var toast = document.getElementById('milestoneToast');
    toast.textContent = text;
    toast.classList.add('show');
    setTimeout(function(){ toast.classList.remove('show'); }, 3200);
  }

  var QUOTES = [
    'Ամեն անցնող օրը քեզ մոտեցնում է տուն։ 🚗♥️',
    'Հեռավորությունը չափում է ոչ թե սերը, այլ համբերությունը։ 🫀💫',
    'Յուրաքանչյուր մայրամուտ մեկ քայլ մոտ է հանդիպմանը։ ✨💖',
    'Սերը չի հոգնում սպասելուց, այն սովորում է հուսալ։ 🥹♥️',
    'Քո սիրտը նրա տան ամենահուսալի կողմնացույցն է։ 💘✨',
    'Ամեն առավոտ նոր հնարավորություն է՝ մոտենալու երազանքիդ։ 😇💚',
    'Սպասումը ցավ չէ, այն սիրո լուռ արտահայտություն է։ 🥺🫶🏼',
    'Ճանապարհը երկար է, բայց ուղղությունը՝ հստակ։ 🪖💫',
    'Հեռվում սիրտը ավելի բարձր է բաբախում։ 🫀💋',
    'Յուրաքանչյուր օր, որ անցնում է, մի քայլ է դեպի տուն։ 🚗🎉',
    'Համբերությունը սիրո ամենագեղեցիկ լեզուն է։ 🫶🏼💖',
    'Երբ դժվար է, հիշիր՝ ինչու ես սպասում։ 🥹💚',
    'Նրա քայլերը ամեն օր մի քիչ ավելի մոտ են քեզ։ 🪖🩵',
    'Սերը հեռավորության մեջ չի փոքրանում, այն խորանում է։ ♥️✨',
    'Դու ամեն օր ինչ-որ մեկի ուժն ես, նույնիսկ երբ դա չես զգում։ 🪖💖',
    'Զինվորի սիրտը միշտ գիտի՝ ուր է իր տունը։ 🪖🚗',
    'Յուրաքանչյուր նամակ, ամեն մտածում՝ կամուրջ է ձեր միջև։ 💘💋',
    'Սպասելը սեր անելու ամենադժվար, բայց ամենաազնիվ ձևն է։ 🥺♥️',
    'Քո հավատարմությունը նրա ամենամեծ պատվանդանն է դաշտում։ 🪖💚',
    'Ամեն գիշեր, որ անցնում է, մի քիչ ավելի մոտեցնում է վերադարձին։ ✨🩵',
    'Նա գիտի, որ ինչ-որ մեկը սպասում է իրեն՝ և դա ուժ է տալիս։ ✝️🫶🏼',
    'Սերը հեռվում չի մարում, այն դառնում է լուռ, հաստատուն կրակ։ 💘✨',
    'Ամեն օր, որ դիմանում ես, ապացույց է, թե որքան ուժեղ ես։ 🪖💫',
    'Հայրենիքի պահապանը՝ քո սրտի ամենամեծ հպարտությունն է։ 🪖♥️',
    'Ձեր պատմությունը հենց հիմա գրվում է, օր առ օր, սպասումով ու հավատով։ 💖✨'
  ];

  function setDailyQuote(){
    var now = new Date();
    var start = new Date(now.getFullYear(), 0, 0);
    var dayOfYear = Math.floor((now - start) / 86400000);
    var _q = QUOTES[dayOfYear % QUOTES.length];
    try{
      var _sd = JSON.parse(localStorage.getItem('kspasemSetupData') || '{}');
      var _t = new Date(); var _r = _sd.returnDate ? new Date(_sd.returnDate) : null;
      if(_r && _t.getFullYear() === _r.getFullYear() && _t.getMonth() === _r.getMonth() && _t.getDate() === _r.getDate()){
        var RET = ['Ահա և եկավ այն օրը՝ վերջապես տուն ես վերադառնում։ Բարի վերադարձ, հերոս 🪖♥️','Սպասումն ավարտվեց։ Այսօր գրկախառնվում ենք ամենաամուր 🫶🏼💖','Հպարտ ենք քեզնով, զինվոր։ Բարի վերադարձ տուն 🚗🎉','Այս օրվան սպասեցինք օր ու գիշեր։ Բարի գալուստ տուն 🥹💚'];
        _q = RET[_t.getFullYear() % RET.length];
      }
    }catch(err){}
    document.getElementById('dailyQuote').textContent = _q;
  }
  setDailyQuote();

  // dhmsMode: 'remaining' (մնացել է, մինչև վերադարձը) կամ 'elapsed' (անցել է, սկզբից ի վեր)
  var dhmsMode = 'remaining';

  function computeDhmsParts(fromDate, toDate){
    if(toDate < fromDate) toDate = fromDate;

    // Ամսվա/տարվա ճշգրիտ (օրացուցային) տարբերություն, ոչ թե մոտավոր
    // 30-օրյա ամիս / 365-օրյա տարի բաժանում, որը կարող էր սխալ արդյունք
    // տալ (օր. 1 տարի 6 ամսվա փոխարեն ցույց տալ 1 տարի 5 ամիս)
    var years = toDate.getFullYear() - fromDate.getFullYear();
    var months = toDate.getMonth() - fromDate.getMonth();
    var days = toDate.getDate() - fromDate.getDate();

    if(days < 0){
      months -= 1;
      var prevMonthLastDay = new Date(toDate.getFullYear(), toDate.getMonth(), 0).getDate();
      days += prevMonthLastDay;
    }
    if(months < 0){
      years -= 1;
      months += 12;
    }

    var totalSeconds = Math.floor((toDate.getTime() - fromDate.getTime()) / 1000);
    var hours = Math.floor((totalSeconds % 86400) / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;
    return {years:years, months:months, days:days, hours:hours, minutes:minutes, seconds:seconds};
  }

  function fillDhmsPage(suffix, parts, monthLabel){
    var yEl = document.getElementById('dhmsYears' + suffix);
    var moEl = document.getElementById('dhmsMonths' + suffix);
    var dEl = document.getElementById('dhmsDays' + suffix);
    var hEl = document.getElementById('dhmsHours' + suffix);
    var mEl = document.getElementById('dhmsMinutes' + suffix);
    var sEl = document.getElementById('dhmsSeconds' + suffix);
    if(!yEl || !moEl || !dEl || !hEl || !mEl || !sEl) return;
    yEl.textContent = parts.years;
    var _ml = moEl.parentNode.querySelector('.dhms-lbl'); if(_ml) _ml.textContent = monthLabel || 'ամիս';
    moEl.textContent = parts.months;
    dEl.textContent = parts.days;
    hEl.textContent = (parts.hours < 10 ? '0' : '') + parts.hours;
    mEl.textContent = (parts.minutes < 10 ? '0' : '') + parts.minutes;
    sEl.textContent = (parts.seconds < 10 ? '0' : '') + parts.seconds;
  }

  function updateDHMS(){
    if(!returnInput.value) return;
    var rd = new Date(returnInput.value);
    rd.setHours(0,0,0,0);
    var now = new Date();

    var _r = adaptDhmsParts(computeDhmsParts(now, rd), now, rd); fillDhmsPage('Remaining', _r.parts, _r.label);

    if(startInput.value){
      var sd = new Date(startInput.value);
      sd.setHours(0,0,0,0);
      var _e = adaptDhmsParts(computeDhmsParts(sd, now), sd, now); fillDhmsPage('Elapsed', _e.parts, _e.label);
    }
  }
  setInterval(updateDHMS, 1000);

  // Unit view: tap the counter to cycle full -> months -> weeks -> days -> full
  var dhmsUnit = 'full';
  var dhmsUnits = ['full','months','weeks','days'];

  // Re-express the parts for the chosen view: the biggest units drop out of the row
  function adaptDhmsParts(parts, fromDate, toDate){
    if(dhmsUnit === 'full') return {parts:parts, label:'ամիս'};
    var to = toDate < fromDate ? fromDate : toDate;
    var totalDays = Math.floor((to.getTime() - fromDate.getTime()) / 86400000);
    var p = {years:0, months:parts.months, days:parts.days, hours:parts.hours, minutes:parts.minutes, seconds:parts.seconds};
    var label = 'ամիս';
    if(dhmsUnit === 'months'){
      p.months = parts.years * 12 + parts.months;
    } else if(dhmsUnit === 'weeks'){
      p.months = Math.floor(totalDays / 7);
      p.days = totalDays % 7;
      label = 'շաբաթ';
    } else {
      p.days = totalDays;
    }
    return {parts:p, label:label};
  }

  function cycleDhmsUnit(){
    var i = dhmsUnits.indexOf(dhmsUnit);
    dhmsUnit = dhmsUnits[(i + 1) % dhmsUnits.length];
    if(dhmsViewportEl) dhmsViewportEl.setAttribute('data-unit', dhmsUnit);
    updateDHMS();
  }

  // Ամեն 5 վայրկյանը մեկ ինքնաբերաբար սահում ենք մնացած/անցած ժամանակի
  // էջերի միջև (կարուսել). օգտատերը կարող է նաև ձեռքով հպել կամ սահեցնել
  // (swipe)՝ անմիջապես անցնելու մյուս էջին.
  var dhmsTrackEl = document.getElementById('dhmsTrack');
  var dhmsDotEls = document.querySelectorAll('.dhms-dot');

  function setDhmsMode(mode){
    dhmsMode = mode;
    if(dhmsTrackEl) dhmsTrackEl.classList.toggle('show-elapsed', mode === 'elapsed');
    dhmsDotEls.forEach(function(dot){
      dot.classList.toggle('active', dot.getAttribute('data-mode') === mode);
    });
  }

  function toggleDhmsMode(){
    setDhmsMode(dhmsMode === 'remaining' ? 'elapsed' : 'remaining');
  }
  var dhmsAutoTimer = setInterval(toggleDhmsMode, 5000);

  var dhmsViewportEl = document.getElementById('dhmsViewport');
  if(dhmsViewportEl){
    dhmsViewportEl.addEventListener('click', function(e){
      e.stopPropagation();
      clearInterval(dhmsAutoTimer);
      cycleDhmsUnit();
    });

    // Աջ/ձախ սահեցնելով (swipe) նույնպես կարելի է փոխել ցուցադրվող ռեժիմը
    var dhmsTouchStartX = 0;
    var dhmsTouchStartY = 0;
    var dhmsSwiped = false;
    dhmsViewportEl.addEventListener('touchstart', function(e){
      if(!e.touches || !e.touches.length) return;
      dhmsTouchStartX = e.touches[0].clientX;
      dhmsTouchStartY = e.touches[0].clientY;
      dhmsSwiped = false;
    }, {passive:true});
    dhmsViewportEl.addEventListener('touchmove', function(e){
      if(dhmsSwiped || !e.touches || !e.touches.length) return;
      var dx = e.touches[0].clientX - dhmsTouchStartX;
      var dy = e.touches[0].clientY - dhmsTouchStartY;
      if(Math.abs(dx) > 24 && Math.abs(dx) > Math.abs(dy)){
        dhmsSwiped = true;
        if(dx < 0){
          setDhmsMode('elapsed');
        } else {
          setDhmsMode('remaining');
        }
      }
    }, {passive:true});
  }

  dhmsDotEls.forEach(function(dot){
    dot.addEventListener('click', function(e){
      e.stopPropagation();
      setDhmsMode(dot.getAttribute('data-mode'));
    });
  });

  // Աչքի (privacy) կոճակը հեռացված է. հին պահված վիճակը մաքրվում է
  try{ localStorage.removeItem('kspasemPrivacyMode'); }catch(err){}

  function refreshCountdownCard(){
    var rd = new Date(returnInput.value);
    var today = new Date();
    today.setHours(0,0,0,0);
    rd.setHours(0,0,0,0);

    if(!startInput.value || !returnInput.value) return;

    var sd = new Date(startInput.value);
    sd.setHours(0,0,0,0);

    var totalDays = Math.max(1, Math.round((rd - sd) / 86400000));
    var passedDays = Math.max(0, Math.min(totalDays, Math.round((today - sd) / 86400000)));
    var remainingDays = totalDays - passedDays;
    var percent = Math.min(100, Math.max(0, (passedDays / totalDays) * 100));
    var percentDetailed = percent.toFixed(6).replace('.', ',');

    document.getElementById('percentLeft').textContent = percentDetailed + '%';
    document.getElementById('progressBarFill').style.width = percent + '%';
    document.getElementById('statPassedLabel').textContent = passedDays + ' օր անցել է';
    document.getElementById('statRemainingLabel').textContent = remainingDays + ' օր մնացել է';

    updateDHMS();

    var milestones = getMilestones(totalDays);
    milestones.forEach(function(m){
      if(passedDays === m.days && m.days > 0 && celebratedMilestones.indexOf(m.key) === -1){
        celebratedMilestones.push(m.key);
        saveCelebratedMilestones();
        if(!suppressCelebrationsOnce){
          showCelebrationOverlay({
            line1: 'Հասար',
            line2: m.label.toUpperCase(),
            line3: m.icon + ' ևս մեկ քայլ առաջ ես ♥',
            sub: 'Շարունակիր նույն սիրով.<br>Ամեն օր մեզ ավելի մոտեցնում է հանդիպմանը ♥',
            btnLabel: 'Փակել',
            iconHtml: medalIconSvg('#e0b23e')
          });
          launchConfettiBurst();
        }
      }
    });

    renderAchievements(passedDays, remainingDays);
    checkDailyCelebration(passedDays);
    checkDischargeDayCelebration(passedDays, totalDays);
    suppressCelebrationsOnce = false;
  }

  // Զորացրման օրվա հատուկ էֆեկտ — միայն Պրեմիում օգտատերերի համար, մեկ անգամ
  // յուրաքանչյուր զորացրման ամսաթվի համար (եթե ամսաթիվը փոխվի, նորից կաշխատի)
  function checkDischargeDayCelebration(passedDays, totalDays){
    if(!isPremium()) return;
    if(passedDays < totalDays) return;
    var key = returnInput.value;
    var seen = null;
    try{ seen = localStorage.getItem('kspasemDischargeCelebrated'); }catch(err){}
    if(seen === key) return;
    try{ localStorage.setItem('kspasemDischargeCelebrated', key); }catch(err){}
    if(suppressCelebrationsOnce) return;

    showCelebrationOverlay({
      line1: 'Այսօր',
      line2: 'ԶՈՐԱՑՐՄԱՆ ՕՐՆ Է',
      line3: 'Նա վերադառնում է տուն <span class="dc-heart">🎉</span>',
      sub: 'Բոլոր սպասած օրերն այս պահի համար էին ♥',
      btnLabel: 'Փառք Աստծո',
      iconHtml: '🎊'
    });
    launchConfettiBurst();
  }

  function launchConfettiBurst(){
    var colors = ['#e8b84b','#8bb96e','#ffffff','#c9932c','#6fb7d1'];
    var container = document.createElement('div');
    container.style.cssText = 'position:fixed;inset:0;z-index:95;pointer-events:none;overflow:hidden;';
    document.body.appendChild(container);
    for(var i=0; i<50; i++){
      var piece = document.createElement('div');
      var size = 6 + Math.random() * 6;
      var left = Math.random() * 100;
      var duration = 2.4 + Math.random() * 1.8;
      var delay = Math.random() * 0.6;
      var color = colors[Math.floor(Math.random() * colors.length)];
      piece.style.cssText =
        'position:absolute; top:-20px; left:' + left + 'vw; width:' + size + 'px; height:' + (size * 1.4) + 'px;' +
        'background:' + color + '; opacity:0.9; border-radius:2px;' +
        'animation:confettiFall ' + duration + 's ease-in ' + delay + 's forwards;';
      container.appendChild(piece);
    }
    setTimeout(function(){ container.remove(); }, 4600);
  }

  function getAllGoals(totalDays){
    return [
      { key:'g7', days: Math.min(7, totalDays), label:'Առաջին շաբաթ', sub:'7 օր ծառայություն' },
      { key:'g14', days: Math.min(14, totalDays), label:'2 շաբաթ', sub:'14 օր ծառայություն' },
      { key:'g30', days: Math.min(30, totalDays), label:'Առաջին ամիս', sub:'30 օր ծառայություն' },
      { key:'g50', days: Math.min(50, totalDays), label:'50-րդ օր', sub:'50 օր ծառայություն' },
      { key:'g100', days: Math.min(100, totalDays), label:'100-րդ օր', sub:'100 օր ծառայություն' },
      { key:'g150', days: Math.min(150, totalDays), label:'150-րդ օր', sub:'150 օր ծառայություն' },
      { key:'g180', days: Math.min(180, totalDays), label:'6 ամիս', sub:'180 օր ծառայություն' },
      { key:'g200', days: Math.min(200, totalDays), label:'200-րդ օր', sub:'200 օր ծառայություն' },
      { key:'g250', days: Math.min(250, totalDays), label:'250-րդ օր', sub:'250 օր ծառայություն' },
      { key:'g300', days: Math.min(300, totalDays), label:'300-րդ օր', sub:'300 օր ծառայություն' },
      { key:'g365', days: Math.min(365, totalDays), label:'1 տարի', sub:'365 օր ծառայություն' },
      { key:'gHalf', days: Math.floor(totalDays/2), label:'Կես ճանապարհ', sub:'Ծառայության 50%-ը' },
      { key:'gL150', special:'last150', days: Math.max(totalDays - 150, 0), label:'Վերջին 150 օրը', sub:'150 օր մնաց վերադարձին' },
      { key:'gL100', special:'last100', days: Math.max(totalDays - 100, 0), label:'Վերջին 100 օրը', sub:'100 օր մնաց վերադարձին' },
      { key:'gL60', special:'last60', days: Math.max(totalDays - 60, 0), label:'Վերջին 60 օրը', sub:'60 օր մնաց վերադարձին' },
      { key:'gL30', special:'last30', days: Math.max(totalDays - 30, 0), label:'Վերջին 30 օրը', sub:'30 օր մնաց վերադարձին' },
      { key:'gL14', special:'last14', days: Math.max(totalDays - 14, 0), label:'Վերջին 2 շաբաթը', sub:'14 օր մնաց վերադարձին' },
      { key:'gL7', special:'last7', days: Math.max(totalDays - 7, 0), label:'Վերջին շաբաթը', sub:'7 օր մնաց վերադարձին' },
      { key:'gL1', special:'last1', days: Math.max(totalDays - 1, 0), label:'Վերջին օրը', sub:'1 օր մնաց վերադարձին' },
      { key:'gReturn', days: totalDays, label:'Վերադարձ', sub:'Ծառայության ավարտ' }
    ];
  }

  function renderGoalsList(passedDays, totalDays){
    var list = document.getElementById('goalsList');
    list.innerHTML = '';
    getAllGoals(totalDays).forEach(function(g, idx){
      var unlocked = passedDays >= g.days && g.days > 0 || (g.days === 0 && passedDays >= 0 && g.key === 'g30' && totalDays < 30);
      unlocked = passedDays >= g.days;
      var row = document.createElement('div');
      row.className = 'goal-row anim-in' + (unlocked ? '' : ' locked');
      row.style.animationDelay = (idx * 0.04) + 's';
      var shieldColor = unlocked ? '#8bb96e' : 'rgba(0,0,0,0.3)';
      row.innerHTML =
        '<div class="goal-shield" style="color:' + shieldColor + '">' + SHIELD_SVG + '</div>' +
        '<div class="goal-text"><div class="goal-label">' + g.label + '</div><div class="goal-sub">' + g.sub + '</div></div>' +
        '<div class="goal-check ' + (unlocked ? 'unlocked' : 'locked') + '">' +
        (unlocked
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l6 6L20 6"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>'
        ) +
        '</div>';
      list.appendChild(row);
    });
  }

  function checkDailyCelebration(passedDays){
    var todayKey = new Date().toISOString().slice(0,10);
    var lastSeen = null;
    try{ lastSeen = localStorage.getItem('kspasemLastSeen'); }catch(err){}
    if(lastSeen && lastSeen !== todayKey){
      var quoteText = document.getElementById('dailyQuote') ? document.getElementById('dailyQuote').textContent : '';
      showCelebrationOverlay({
        line1: 'Դու ապրեցիր',
        line2: 'ՄԵԿ ՕՐ',
        line3: 'քո զինվորին սպասելով <span class="dc-heart">♥</span>',
        sub: 'Շարունակիր նույն սիրով.<br>' + quoteText + ' <span class="dc-heart">♥</span>',
        btnLabel: 'Փակել'
      });
      var homeHeader = document.querySelector('.home-header');
      if(homeHeader){
        homeHeader.style.animation = 'none';
        void homeHeader.offsetWidth;
        homeHeader.style.animation = 'dayPulse 0.9s ease';
      }
    }
    try{ localStorage.setItem('kspasemLastSeen', todayKey); }catch(err){}
  }

  var SHIELD_SVG = '<img src="images/achievement.png" alt="" draggable="false">';

  function renderAchievements(passedDays, remainingDays){
    var defs = [
      { key:'d100', days: 100, label: '100 օր' },
      { key:'d200', days: 200, label: '200 օր' },
      { key:'d300', days: 300, label: '300 օր' },
      { key:'dLast30', special: 'last30', label: 'Վերջին 30 օր' }
    ];
    var rawSeenBadges = null;
    try{ rawSeenBadges = localStorage.getItem('kspasemSeenBadges'); }catch(err){}
    var isFirstEverBaseline = (rawSeenBadges === null);
    var seenBadges = [];
    try{ seenBadges = JSON.parse(rawSeenBadges || '[]'); }catch(err){}

    var grid = document.getElementById('achGrid');
    if(grid) grid.innerHTML = '';
    defs.forEach(function(d, idx){
      var unlocked = d.special === 'last30'
        ? (remainingDays <= 30 && remainingDays >= 0)
        : passedDays >= d.days;

      var isNew = unlocked && seenBadges.indexOf(d.key) === -1;
      var shieldColor = unlocked ? (d.days === 100 ? '#c4703b' : d.days === 200 ? '#c7c7c7' : d.days === 300 ? '#e0b23e' : '#8bb96e') : 'rgba(0,0,0,0.3)';
      if(isNew){
        seenBadges.push(d.key);
        if(!suppressCelebrationsOnce && !isFirstEverBaseline){
          if(typeof addNotification === 'function') addNotification('badge', 'Ստացար «' + d.label + '» մեդալը 🏅');
          showCelebrationOverlay({
            line1: 'Դու ձեռք բերեցիր',
            line2: d.label,
            line3: 'մեդալը',
            sub: 'Շնորհավո՜ր, ևս մեկ քայլ առաջ ես <span class="dc-heart">♥</span>',
            btnLabel: 'Փակել',
            iconHtml: medalIconSvg(shieldColor)
          });
        }
      }

      var badge = document.createElement('div');
      badge.className = 'ach-badge anim-in' + (unlocked ? '' : ' locked');
      badge.style.animationDelay = (idx * 0.06) + 's';
      if(isNew){ badge.style.animation = 'badgePop 0.6s ease'; }

      badge.innerHTML =
        '<div class="ach-shield" style="color:' + shieldColor + '">' + SHIELD_SVG + '</div>' +
        '<div class="ach-days">' + d.label + '</div>' +
        '<div class="ach-status ' + (unlocked ? 'unlocked' : 'locked') + '">' +
        (unlocked
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l6 6L20 6"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>'
        ) +
        '</div>';
      if(grid) grid.appendChild(badge);
    });

    try{ localStorage.setItem('kspasemSeenBadges', JSON.stringify(seenBadges)); }catch(err){}
  }

  function setActiveDock(activeBtn){
    var allDockBtns = document.querySelectorAll('.dock-btn');
    for(var i=0; i<allDockBtns.length; i++){
      allDockBtns[i].classList.remove('active');
    }
    activeBtn.classList.add('active');
  }

  dockSettings.addEventListener('click', function(){
    calendarScreen.classList.remove('active');
    timeSettingsScreen.classList.remove('active');
    document.getElementById('goalsScreen').classList.remove('active');
    document.getElementById('aboutScreen').classList.remove('active');
    document.getElementById('memoriesScreen').classList.remove('active');
    document.getElementById('myProgressScreen').classList.remove('active');
    settingsScreen.classList.add('active');
    countdownEl.classList.add('behind-settings');
    setActiveDock(dockSettings);
  });

  function closeSettings(){
    settingsScreen.classList.remove('active');
    timeSettingsScreen.classList.remove('active');
    calendarScreen.classList.remove('active');
    document.getElementById('goalsScreen').classList.remove('active');
    document.getElementById('aboutScreen').classList.remove('active');
    document.getElementById('memoriesScreen').classList.remove('active');
    document.getElementById('myProgressScreen').classList.remove('active');
    countdownEl.classList.remove('behind-settings');
    setActiveDock(dockHome);
  }
  dockHome.addEventListener('click', closeSettings);

  var calendarScreen = document.getElementById('calendarScreen');
  var dockCalendar = document.getElementById('dockCalendar');
  var calDays = document.getElementById('calDays');

  function renderCalendar(){
    calDays.innerHTML = '';
    if(!startInput.value || !returnInput.value) return;

    var sd = new Date(startInput.value);
    sd.setHours(0,0,0,0);
    var rd = new Date(returnInput.value);
    rd.setHours(0,0,0,0);
    var today = new Date();
    today.setHours(0,0,0,0);

    var totalDays = Math.max(1, Math.round((rd - sd) / 86400000));
    var passedDays = Math.max(0, Math.min(totalDays, Math.round((today - sd) / 86400000)));

    var medalDays = [100, 200, 300, totalDays - 30].filter(function(md){
      return md >= 1 && md <= totalDays;
    });

    var todayCell = null;
    for(var d=1; d<=totalDays; d++){
      var cell = document.createElement('div');
      cell.className = 'cal-day';
      cell.textContent = d;
      if(d < passedDays + 1) cell.classList.add('passed');
      if(d === 1) cell.classList.add('start-day');
      if(d === totalDays) cell.classList.add('return-day');
      if(medalDays.indexOf(d) !== -1) cell.classList.add('medal-day');
      if(d === passedDays + 1){
        cell.classList.add('today');
        todayCell = cell;
      }
      calDays.appendChild(cell);
    }

    if(todayCell){
      setTimeout(function(){
        todayCell.scrollIntoView({ block:'center' });
      }, 50);
    }

    var sinceStart = Math.round((today - sd) / 86400000);
    document.getElementById('calServiceDay').textContent = (sinceStart >= 0 ? (sinceStart + 1) : 0) + '-րդ օր';
    document.getElementById('calStartInfo').textContent = sinceStart >= 0 ? (sinceStart + ' օր առաջ') : ((-sinceStart) + ' օր հետո');

    var untilReturn = Math.max(0, Math.round((rd - today) / 86400000));
    document.getElementById('calReturnInfo').textContent = untilReturn + ' օր հետո';
  }

  dockCalendar.addEventListener('click', function(){
    settingsScreen.classList.remove('active');
    timeSettingsScreen.classList.remove('active');
    document.getElementById('goalsScreen').classList.remove('active');
    document.getElementById('aboutScreen').classList.remove('active');
    document.getElementById('memoriesScreen').classList.remove('active');
    document.getElementById('myProgressScreen').classList.remove('active');
    renderCalendar();
    calendarScreen.classList.add('active');
    countdownEl.classList.add('behind-settings');
    setActiveDock(dockCalendar);
  });

  var timeSettingsScreen = document.getElementById('timeSettingsScreen');
  var openTimeSettingsBtn = document.getElementById('openTimeSettingsBtn');
  var tsBackBtn = document.getElementById('tsBackBtn');
  var tsStartRow = document.getElementById('tsStartRow');
  var tsReturnRow = document.getElementById('tsReturnRow');
  var tsStartDate = document.getElementById('tsStartDate');
  var tsReturnDate = document.getElementById('tsReturnDate');
  var tsStartValue = document.getElementById('tsStartValue');
  var tsReturnValue = document.getElementById('tsReturnValue');
  var tsConfirm = document.getElementById('tsConfirm');
  var tsSaveBtn = document.getElementById('tsSaveBtn');
  var tsNameRow = document.getElementById('tsNameRow');
  var tsNameValue = document.getElementById('tsNameValue');
  var tsNameEditBox = document.getElementById('tsNameEditBox');
  var tsNameInput = document.getElementById('tsNameInput');
  var tsNameSaveBtn = document.getElementById('tsNameSaveBtn');

  function getNameChangeCount(){
    var n = 0;
    try{ n = parseInt(localStorage.getItem('kspasemNameChangeCount') || '0', 10) || 0; }catch(err){}
    return n;
  }
  function bumpNameChangeCount(){
    try{ localStorage.setItem('kspasemNameChangeCount', String(getNameChangeCount() + 1)); }catch(err){}
  }

  openTimeSettingsBtn.addEventListener('click', function(){
    tsStartDate.value = startInput.value;
    tsReturnDate.value = returnInput.value;
    tsStartValue.textContent = startInput.value ? formatDateHy(startInput.value) : '—';
    tsReturnValue.textContent = returnInput.value ? formatDateHy(returnInput.value) : '—';
    tsNameValue.textContent = nameInput.value.trim() || '—';
    tsNameEditBox.style.display = 'none';
    tsConfirm.classList.remove('show');
    settingsScreen.classList.remove('active');
    timeSettingsScreen.classList.add('active');
    document.getElementById('mainDock').classList.remove('visible');
  });

  tsNameRow.addEventListener('click', function(){
    if(!isPremium() && getNameChangeCount() >= 1){
      showMilestoneToast('🔒 Անվան փոփոխությունն արդեն օգտագործել ես, Պրեմիումով՝ անսահմանափակ');
      return;
    }
    tsNameInput.value = nameInput.value.trim();
    tsNameEditBox.style.display = 'flex';
  });

  tsNameSaveBtn.addEventListener('click', function(){
    var v = (tsNameInput.value || '').trim();
    if(!v) return;
    nameInput.value = v;
    document.getElementById('cdNameText').textContent = v;
    tsNameValue.textContent = v;
    try{
      var saved = JSON.parse(localStorage.getItem('kspasemSetupData') || '{}');
      saved.name = v;
      localStorage.setItem('kspasemSetupData', JSON.stringify(saved));
    }catch(err){}
    bumpNameChangeCount();
    tsNameEditBox.style.display = 'none';
  });

  tsBackBtn.addEventListener('click', function(){
    timeSettingsScreen.classList.remove('active');
    settingsScreen.classList.add('active');
    document.getElementById('mainDock').classList.add('visible');
  });

  tsStartRow.addEventListener('click', function(){ openPicker(tsStartDate); });
  tsReturnRow.addEventListener('click', function(){ openPicker(tsReturnDate); });

  tsStartDate.addEventListener('change', function(){
    if(tsStartDate.value){
      var d = new Date(tsStartDate.value);
      d.setMonth(d.getMonth() + 18);
      var yyyy = d.getFullYear();
      var mm = String(d.getMonth()+1).padStart(2,'0');
      var dd = String(d.getDate()).padStart(2,'0');
      tsReturnDate.value = yyyy + '-' + mm + '-' + dd;
    }
    tsStartValue.textContent = tsStartDate.value ? formatDateHy(tsStartDate.value) : '—';
    tsReturnValue.textContent = tsReturnDate.value ? formatDateHy(tsReturnDate.value) : '—';
    tsConfirm.classList.remove('show');
  });

  tsReturnDate.addEventListener('change', function(){
    tsReturnValue.textContent = tsReturnDate.value ? formatDateHy(tsReturnDate.value) : '—';
    tsConfirm.classList.remove('show');
  });

  tsSaveBtn.addEventListener('click', function(){
    if(!tsStartDate.value || !tsReturnDate.value) return;
    startInput.value = tsStartDate.value;
    returnInput.value = tsReturnDate.value;
    updateDisplay(startInput, startPlaceholder, startValue);
    updateDisplay(returnInput, returnPlaceholder, returnValue);
    // Editing dates is a manual correction, not organic day-by-day progress —
    // don't flood the screen with every medal that's suddenly unlocked.
    suppressCelebrationsOnce = true;
    refreshCountdownCard();
    tsConfirm.classList.add('show');

    try{
      var saved = JSON.parse(localStorage.getItem('kspasemSetupData') || '{}');
      saved.startDate = startInput.value;
      saved.returnDate = returnInput.value;
      localStorage.setItem('kspasemSetupData', JSON.stringify(saved));
    }catch(err){}

    // Premium ժամկետը միշտ հաշվարկվում է ընթացիկ վերադարձի ամսաթվից,
    // ուստի ամսաթիվը փոխելուց հետո պետք է թարմացնել UI-ն ու couple-ի հետ սինքրոնացնել
    updatePremiumUI();
    pushCoupleDates();
  });

  changePhotoBtn.addEventListener('click', function(){
    photoInput.click();
  });

  var photoDB = null;
  try{
    var photoDBRequest = indexedDB.open('kspasemPhotoDB', 1);
    photoDBRequest.onupgradeneeded = function(e){
      e.target.result.createObjectStore('photo');
    };
    photoDBRequest.onsuccess = function(e){
      photoDB = e.target.result;
      loadSavedPhoto();
    };
    photoDBRequest.onerror = function(){ photoReady(); };
  }catch(err){ photoReady(); }

  function photoReady(){ try{ document.documentElement.classList.remove('photo-pending'); }catch(e){} }
  setTimeout(photoReady, 2500);

  function applyBackgroundPhoto(url){
    photoReady();
    try{ document.documentElement.style.setProperty('--bg-photo', 'url("' + url + '")'); }catch(e){}
    countdownEl.style.backgroundImage =
      'linear-gradient(180deg, rgba(3,16,10,0.55) 0%, rgba(3,16,10,0.35) 45%, rgba(3,16,10,0.75) 100%), url(' + url + ')';
    settingsScreen.style.backgroundImage =
      'linear-gradient(180deg, rgba(3,16,10,0.6) 0%, rgba(3,16,10,0.45) 45%, rgba(3,16,10,0.8) 100%), url(' + url + ')';
    document.getElementById('timeSettingsScreen').style.backgroundImage =
      'linear-gradient(180deg, rgba(3,16,10,0.65) 0%, rgba(3,16,10,0.5) 45%, rgba(3,16,10,0.85) 100%), url(' + url + ')';
    document.getElementById('calendarScreen').style.backgroundImage =
      'linear-gradient(180deg, rgba(3,16,10,0.6) 0%, rgba(3,16,10,0.45) 45%, rgba(3,16,10,0.8) 100%), url(' + url + ')';
    document.getElementById('goalsScreen').style.backgroundImage =
      'linear-gradient(180deg, rgba(3,16,10,0.6) 0%, rgba(3,16,10,0.45) 45%, rgba(3,16,10,0.8) 100%), url(' + url + ')';
    document.getElementById('aboutScreen').style.backgroundImage =
      'linear-gradient(180deg, rgba(3,16,10,0.6) 0%, rgba(3,16,10,0.45) 45%, rgba(3,16,10,0.8) 100%), url(' + url + ')';
    document.getElementById('memoriesScreen').style.backgroundImage =
      'linear-gradient(180deg, rgba(3,16,10,0.65) 0%, rgba(3,16,10,0.5) 45%, rgba(3,16,10,0.85) 100%), url(' + url + ')';
    document.getElementById('myProgressScreen').style.backgroundImage =
      'linear-gradient(180deg, rgba(3,16,10,0.6) 0%, rgba(3,16,10,0.45) 45%, rgba(3,16,10,0.8) 100%), url(' + url + ')';
    document.getElementById('photoSquircle').style.backgroundImage = 'url(' + url + ')';
    var haEl = document.getElementById('homeAvatar'); if(haEl) haEl.style.backgroundImage = 'url(' + url + ')';
    var dcBgEl = document.getElementById('dcBg');
    if(dcBgEl) dcBgEl.style.backgroundImage = 'url(' + url + ')';
  }

  function loadSavedPhoto(){
    if(!photoDB){ photoReady(); return; }
    var tx = photoDB.transaction('photo', 'readonly');
    var req = tx.objectStore('photo').get('bgPhoto');
    req.onerror = function(){ photoReady(); };
    req.onsuccess = function(){
      if(!req.result){ photoReady(); return; }
      // Հին տարբերակներում պահվում էր Blob, նոր տարբերակում՝ dataURL string
      if(typeof req.result === 'string'){
        applyBackgroundPhoto(req.result);
      } else {
        try{ applyBackgroundPhoto(URL.createObjectURL(req.result)); }catch(err){}
      }
    };
  }

  photoInput.addEventListener('change', function(){
    var file = photoInput.files && photoInput.files[0];
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(){
      var dataUrl = reader.result;
      applyBackgroundPhoto(dataUrl);
      if(photoDB){
        try{
          var tx = photoDB.transaction('photo', 'readwrite');
          tx.objectStore('photo').put(dataUrl, 'bgPhoto');
        }catch(err){}
      }
      // Couple Sync. — եթե կապակցված ենք, ֆոնի փոփոխությունը որպես
      // առաջարկ ենք ուղարկում զույգին, որ ինքն էլ որոշի՝ ընդունել թե ոչ
      if(typeof getPartnerCode === 'function' && getPartnerCode() && isPremium()){
        compressImageFile(file, function(compressedDataUrl){
          if(compressedDataUrl && typeof pushBgProposal === 'function') pushBgProposal(compressedDataUrl);
        });
      }
    };
    reader.readAsDataURL(file);
  });

  var favSongBtn = document.getElementById('favSongBtn');
  var favSongInput = document.getElementById('favSongInput');
  var favSongStatus = document.getElementById('favSongStatus');
  var bgMusic = document.getElementById('bgMusic');

  bgMusic.addEventListener('error', function(){
    favSongStatus.textContent = 'Ձևաչափը չի աջակցվում';
  });

  var songDB = null;
  try{
    var songDBRequest = indexedDB.open('kspasemSongDB', 1);
    songDBRequest.onupgradeneeded = function(e){
      e.target.result.createObjectStore('songs');
    };
    songDBRequest.onsuccess = function(e){
      songDB = e.target.result;
      loadSavedSong();
    };
    songDBRequest.onerror = function(){
      favSongStatus.textContent = 'Ընտրել';
    };
  }catch(err){}

  favSongBtn.addEventListener('click', function(){
    favSongInput.click();
  });

  favSongInput.addEventListener('change', function(){
    var file = favSongInput.files && favSongInput.files[0];
    if(!file) return;

    var reader = new FileReader();
    reader.onload = function(){
      var dataUrl = reader.result;
      bgMusic.src = dataUrl;
      bgMusic.play().catch(function(){});
      favSongStatus.textContent = file.name;
      muteSongToggle.classList.remove('on');
      try{ localStorage.removeItem('kspasemSongMuted'); }catch(err){}

      if(songDB){
        try{
          var tx = songDB.transaction('songs', 'readwrite');
          tx.objectStore('songs').put({ dataUrl:dataUrl, name:file.name }, 'favSong');
        }catch(err){}
      }

      // Couple Sync. — ինքը երգի ֆայլը (audio) currently հնարավոր չէ
      // սինքրոնացնել առանց Firebase Storage-ի, ուստի զույգին միայն
      // ծանուցում ենք ուղարկում, թե ինչ երգ դրվեց
      if(typeof getPartnerCode === 'function' && getPartnerCode() && isPremium() && typeof pushSongProposal === 'function'){
        pushSongProposal(file.name);
      }
    };
    reader.readAsDataURL(file);
  });

  function loadSavedSong(){
    if(!songDB) return;
    var tx = songDB.transaction('songs', 'readonly');
    var req = tx.objectStore('songs').get('favSong');
    req.onsuccess = function(){
      var record = req.result;
      if(!record) return;
      // Հին տարբերակներում պահվում էր Blob, նոր տարբերակում՝ dataURL string
      var url = record.dataUrl || (function(){
        try{ return URL.createObjectURL(record.blob); }catch(err){ return null; }
      })();
      if(!url) return;
      bgMusic.src = url;
      favSongStatus.textContent = record.name || 'Ընտրված է';

      var muted = false;
      try{ muted = localStorage.getItem('kspasemSongMuted') === '1'; }catch(err){}
      if(muted){
        muteSongToggle.classList.add('on');
        return;
      }

      var tryPlay = function(){ bgMusic.play().catch(function(){}); };
      tryPlay();
      document.addEventListener('touchstart', tryPlay, { once:true });
      document.addEventListener('click', tryPlay, { once:true });
    };
  }

  var muteSongToggle = document.getElementById('muteSongToggle');
  muteSongToggle.addEventListener('click', function(){
    var nowMuted = !muteSongToggle.classList.contains('on');
    muteSongToggle.classList.toggle('on');
    try{ localStorage.setItem('kspasemSongMuted', nowMuted ? '1' : '0'); }catch(err){}
    if(nowMuted){
      bgMusic.pause();
    } else if(bgMusic.src){
      bgMusic.play().catch(function(){});
    }
  });

  var deleteSongBtn = document.getElementById('deleteSongBtn');
  deleteSongBtn.addEventListener('click', function(){
    bgMusic.pause();
    bgMusic.removeAttribute('src');
    bgMusic.load();
    favSongStatus.textContent = 'Ընտրել';
    muteSongToggle.classList.remove('on');
    try{ localStorage.removeItem('kspasemSongMuted'); }catch(err){}
    if(songDB){
      var tx = songDB.transaction('songs', 'readwrite');
      tx.objectStore('songs').delete('favSong');
    }
  });

  var goalsScreen = document.getElementById('goalsScreen');
  var goalsPreview = document.getElementById('goalsPreview');
  var goalsBackBtn = document.getElementById('goalsBackBtn');

  function openGoalsScreen(){
    if(!startInput.value || !returnInput.value) return;
    var sd = new Date(startInput.value); sd.setHours(0,0,0,0);
    var rd = new Date(returnInput.value); rd.setHours(0,0,0,0);
    var today = new Date(); today.setHours(0,0,0,0);
    var totalDays = Math.max(1, Math.round((rd - sd) / 86400000));
    var passedDays = Math.max(0, Math.min(totalDays, Math.round((today - sd) / 86400000)));
    renderGoalsList(passedDays, totalDays);
    goalsScreen.classList.add('active');
  }

  goalsPreview.addEventListener('click', openGoalsScreen);

  goalsBackBtn.addEventListener('click', function(){
    goalsScreen.classList.remove('active'); // վերադառնում է «Իմ առաջընթացը»
  });

  var aboutScreen = document.getElementById('aboutScreen');
  var aboutBtn = document.getElementById('aboutBtn');
  var aboutBackBtn = document.getElementById('aboutBackBtn');

  aboutBtn.addEventListener('click', function(){
    settingsScreen.classList.remove('active');
    aboutScreen.classList.add('active');
    document.getElementById('mainDock').classList.remove('visible');
  });

  aboutBackBtn.addEventListener('click', function(){
    aboutScreen.classList.remove('active');
    settingsScreen.classList.add('active');
    document.getElementById('mainDock').classList.add('visible');
  });

  document.getElementById('telegramBtn').addEventListener('click', function(){
    window.location.href = 'https://t.me/+RqyU1AOzK-ViNjli';
  });

  /* ===== Premium ===== */
  var FREE_MEM_LIMIT = 15;
  var PREMIUM_CONTACT_URL = 'https://t.me/+RqyU1AOzK-ViNjli';
  var PREMIUM_GRACE_DAYS = 2;

  function getDeviceCode(){
    var code = null;
    try{ code = localStorage.getItem('kspasemDeviceCode'); }catch(err){}
    if(!code){
      code = (Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2,4)).toUpperCase();
      try{ localStorage.setItem('kspasemDeviceCode', code); }catch(err){}
    }
    return code;
  }

  // "Granted" = ինչ-որ պահի ակտիվացվել է սերվերում (Firestore-ից եկած դրոշ)
  function isPremiumGranted(){
    try{ return localStorage.getItem('kspasemPremium') === '1'; }catch(err){ return false; }
  }

  function setPremiumCache(val){
    try{ localStorage.setItem('kspasemPremium', val ? '1' : '0'); }catch(err){}
  }

  // Ժամկետը միշտ հաշվարկվում է ընթացիկ վերադարձի ամսաթվից (+2 օր) —
  // ոչ թե ֆիքսված ամսաթվից, ուստի եթե զորացրման օրը փոխվի, պրեմիումը
  // ինքնաբերաբար հարմարվում է նոր ամսաթվին։
  function getPremiumExpiry(){
    if(!returnInput.value) return null;
    var d = new Date(returnInput.value);
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() + PREMIUM_GRACE_DAYS);
    return d;
  }

  // Effective ստատուսը՝ իրական օգտագործման համար ամբողջ app-ում
  function isPremium(){
    if(!isPremiumGranted()) return false;
    var expiry = getPremiumExpiry();
    if(!expiry) return true; // ամսաթիվը դեռ նշված չէ, ժամկետը հաշվարկել հնարավոր չէ
    var today = new Date(); today.setHours(0,0,0,0);
    return today <= expiry;
  }

  function totalMemCount(){
    var counts = {};
    try{ counts = JSON.parse(localStorage.getItem('kspasemMemCounts') || '{}'); }catch(err){}
    return Object.keys(counts).reduce(function(sum, k){ return sum + (counts[k] || 0); }, 0);
  }

  var CHECK_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#8bb96e" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;vertical-align:-2px;"><path d="M4 12l6 6L20 6"/></svg>';

  function updatePremiumUI(){
    var granted = isPremiumGranted();
    var active = isPremium();
    var statusLabel = document.getElementById('premiumStatusLabel');
    var headerStatus = document.getElementById('premiumHeaderStatus');
    if(statusLabel) statusLabel.innerHTML = active ? ('Ակտիվ ' + CHECK_ICON_SVG) : (granted ? 'Ժամկետանց' : 'Ակտիվացնել');
    if(headerStatus) headerStatus.innerHTML = active ? ('Պրեմիում ակտիվ է ' + CHECK_ICON_SVG) : (granted ? 'Ժամկետը լրացել է' : 'Պրեմիում ակտիվ չէ');
    var codeEl = document.getElementById('premiumDeviceCode');
    if(codeEl) codeEl.textContent = getDeviceCode();

    var expiryRow = document.getElementById('premiumExpiryRow');
    var expiryDateEl = document.getElementById('premiumExpiryDate');
    var expiry = getPremiumExpiry();
    if(expiryRow && expiryDateEl){
      if(granted && expiry){
        expiryDateEl.textContent = formatDateHy(expiry.toISOString().slice(0,10));
        expiryRow.style.display = 'flex';
      } else {
        expiryRow.style.display = 'none';
      }
    }

    var badge = document.getElementById('premiumBadgeIcon');
    if(badge) badge.style.display = active ? 'inline' : 'none';

    if(typeof updateCoupleSyncUI === 'function') updateCoupleSyncUI();
  }

  function celebratePremiumUnlock(){
    var alreadyNotified = false;
    try{ alreadyNotified = localStorage.getItem('kspasemPremiumNotified') === '1'; }catch(err){}
    if(alreadyNotified) return;
    try{ localStorage.setItem('kspasemPremiumNotified', '1'); }catch(err){}
    launchConfettiBurst();
    showMilestoneToast('👑 Պրեմիումը բացվեց, բարի գալուստ');
    if(typeof addNotification === 'function') addNotification('premium', 'Պրեմիումը ակտիվացավ 👑');
    var badge = document.getElementById('premiumBadgeIcon');
    if(badge){
      badge.style.animation = 'none';
      void badge.offsetWidth;
      badge.style.animation = 'badgePop 0.6s ease';
    }
  }

  function checkPremiumStatus(showToast, onDone){
    if(!db){
      if(showToast) showMilestoneToast('Կապ չկա սերվերի հետ');
      if(onDone) onDone();
      return;
    }
    var wasNotified = false;
    try{ wasNotified = localStorage.getItem('kspasemPremiumNotified') === '1'; }catch(err){}
    db.collection('users').doc(getDeviceCode()).get().then(function(doc){
      var active = !!(doc.exists && doc.data() && doc.data().premium === true);
      setPremiumCache(active);
      updatePremiumUI();
      if(active){
        celebratePremiumUnlock();
      }
      if(showToast && !(active && !wasNotified)){
        showMilestoneToast(active ? '✨ Պրեմիումը ակտիվ է' : 'Պրեմիում դեռ չի հաստատվել');
      }
      if(onDone) onDone();
    }).catch(function(err){
      console.error('checkPremiumStatus error', err);
      if(showToast) showMilestoneToast('Չհաջողվեց ստուգել, փորձիր նորից');
      if(onDone) onDone();
    });
  }

  function watchPremiumStatus(){
    if(!db) return;
    db.collection('users').doc(getDeviceCode()).onSnapshot(function(doc){
      var active = !!(doc.exists && doc.data() && doc.data().premium === true);
      setPremiumCache(active);
      updatePremiumUI();
      if(active){
        // celebratePremiumUnlock ինքն է ստուգում՝ արդեն ցուցադրվա՞ծ է, այնպես որ
        // անվտանգ է կանչել ամեն snapshot-ի ժամանակ. կրկնություն երբեք չի լինի
        celebratePremiumUnlock();
      }
    }, function(err){
      console.error('premium listener error', err);
    });
  }

  updatePremiumUI();
  // Կենդանի (real-time) լսում. եթե admin-ը միացնի պրեմիումը մինչ ապպը
  // բաց է, օգտատերը միանգամից ծանուցում կստանա, առանց ձեռքով ստուգելու
  watchPremiumStatus();

  // Հետք ամեն սարքի բացման համար, որ admin-ը կարողանա տեսնել քանի հոգի
  // օգտագործում է ապպը (միայն կոդ + վերջին այցի ամսաթիվ, ոչ մի անձնական տվյալ)
  if(db){
    db.collection('users').doc(getDeviceCode()).set({
      lastSeen: new Date().toISOString()
    }, { merge: true }).catch(function(){});
  }

  document.getElementById('premiumBtn').addEventListener('click', function(){
    settingsScreen.classList.remove('active');
    document.getElementById('premiumScreen').classList.add('active');
    document.getElementById('mainDock').classList.remove('visible');
    updatePremiumUI();
  });

  document.getElementById('premiumBackBtn').addEventListener('click', function(){
    document.getElementById('premiumScreen').classList.remove('active');
    settingsScreen.classList.add('active');
    document.getElementById('mainDock').classList.add('visible');
  });

  document.getElementById('premiumRecheckBtn').addEventListener('click', function(){
    var btn = this;
    var originalText = btn.textContent;
    btn.textContent = 'Ստուգում է...';
    btn.disabled = true;
    checkPremiumStatus(true, function(){
      btn.textContent = originalText;
      btn.disabled = false;
    });
  });

  document.getElementById('premiumTelegramBtn').addEventListener('click', function(){
    window.location.href = PREMIUM_CONTACT_URL;
  });

  /* ===== Couple Sync (Premium) ===== */
  var coupleLinkedBox = document.getElementById('coupleLinkedBox');
  var coupleLinkForm = document.getElementById('coupleLinkForm');
  var coupleIncomingBox = document.getElementById('coupleIncomingBox');
  var coupleIncomingFrom = document.getElementById('coupleIncomingFrom');
  var couplePendingBox = document.getElementById('couplePendingBox');
  var couplePartnerCodeInput = document.getElementById('couplePartnerCodeInput');
  var coupleLinkBtn = document.getElementById('coupleLinkBtn');
  var coupleUnlinkBtn = document.getElementById('coupleUnlinkBtn');
  var coupleAcceptBtn = document.getElementById('coupleAcceptBtn');
  var coupleDeclineBtn = document.getElementById('coupleDeclineBtn');
  var couplePendingCancelBtn = document.getElementById('couplePendingCancelBtn');
  var coupleUnsub = null;
  var coupleIncomingUnsub = null;
  var couplePendingUnsub = null;

  function getPartnerCode(){
    try{ return localStorage.getItem('kspasemPartnerCode') || ''; }catch(err){ return ''; }
  }
  function setPartnerCode(code){
    try{
      if(code) localStorage.setItem('kspasemPartnerCode', code);
      else localStorage.removeItem('kspasemPartnerCode');
    }catch(err){}
  }
  function getPendingTarget(){
    try{ return localStorage.getItem('kspasemPendingLinkTarget') || ''; }catch(err){ return ''; }
  }
  function setPendingTarget(code){
    try{
      if(code) localStorage.setItem('kspasemPendingLinkTarget', code);
      else localStorage.removeItem('kspasemPendingLinkTarget');
    }catch(err){}
  }
  function getCoupleId(){
    var mine = getDeviceCode(), partner = getPartnerCode();
    if(!partner) return null;
    return [mine, partner].sort().join('_');
  }

  function updateCoupleSyncUI(){
    var linked = isPremium() && !!getPartnerCode();
    var pending = isPremium() && !!getPendingTarget() && !linked;
    var coupleLinkedIndicator = document.getElementById('coupleLinkedIndicator');
    if(coupleLinkedBox) coupleLinkedBox.style.display = linked ? 'flex' : 'none';
    if(couplePendingBox) couplePendingBox.style.display = pending ? 'flex' : 'none';
    if(coupleLinkForm) coupleLinkForm.style.display = (linked || pending) ? 'none' : 'block';
    if(coupleLinkedIndicator) coupleLinkedIndicator.style.display = linked ? 'flex' : 'none';
  }

  function startCoupleListener(){
    if(coupleUnsub){ coupleUnsub(); coupleUnsub = null; }
    var coupleId = getCoupleId();
    if(!db || !coupleId || !isPremium()) return;
    coupleUnsub = db.collection('couples').doc(coupleId).onSnapshot(function(doc){
      if(!doc.exists) return;
      var data = doc.data();

      // Զույգը մյուս կողմից անջատել է Couple Sync-ը՝ մենք էլ ենք
      // ինքնաբերաբար անջատվում ու ջնջում կապակցված ժամանակահատվածի
      // հիշողությունները, որ երկու կողմում էլ նույն արդյունքը լինի
      if(data.disconnectedAt && data.disconnectedBy && data.disconnectedBy !== getDeviceCode()){
        if(coupleUnsub){ coupleUnsub(); coupleUnsub = null; }
        var cutoff = data.connectedAt || (function(){ try{ return localStorage.getItem('kspasemCoupleConnectedAt'); }catch(e){ return null; } })();
        if(cutoff) wipeMemoriesSince(cutoff);
        setPartnerCode('');
        try{ localStorage.removeItem('kspasemCoupleConnectedAt'); }catch(err){}
        updatePremiumUI();
        updateCoupleSyncUI();
        watchIncomingRequests();
        showMilestoneToast('Զույգդ անջատեց Couple Sync-ը');
        return;
      }

      var changed = false;
      if(data.startDate && data.startDate !== startInput.value){ startInput.value = data.startDate; changed = true; }
      if(data.returnDate && data.returnDate !== returnInput.value){ returnInput.value = data.returnDate; changed = true; }
      if(changed){
        updateDisplay(startInput, startPlaceholder, startValue);
        updateDisplay(returnInput, returnPlaceholder, returnValue);
        suppressCelebrationsOnce = true;
        refreshCountdownCard();
        updatePremiumUI();
      }
      // Զույգը առաջարկել է ընդհանուր ֆոնի նկար՝ ցույց ենք տալիս
      // հաստատման հարցում, միայն մեկ անգամ՝ նույն առաջարկի համար
      if(data.bgProposal && data.bgProposal.fromCode !== getDeviceCode()){
        var lastSeen = null;
        try{ lastSeen = localStorage.getItem('kspasemLastBgProposalSeen'); }catch(err){}
        if(data.bgProposal.createdAt !== lastSeen){
          try{ localStorage.setItem('kspasemLastBgProposalSeen', data.bgProposal.createdAt); }catch(err){}
          showBgProposalModal(data.bgProposal.dataUrl);
        }
      }

      // Զույգը դրել է նոր նախընտրած երգ՝ լուռ ծանուցում ենք, քանի որ
      // ձայնային ֆայլերի իրական փոխանցումն այս տարբերակում հնարավոր չէ
      // (անհրաժեշտ կլինի Firebase Storage), ուստի միայն անունն ենք հայտնում
      if(data.songProposal && data.songProposal.fromCode !== getDeviceCode()){
        var lastSongSeen = null;
        try{ lastSongSeen = localStorage.getItem('kspasemLastSongProposalSeen'); }catch(err){}
        if(data.songProposal.createdAt !== lastSongSeen){
          try{ localStorage.setItem('kspasemLastSongProposalSeen', data.songProposal.createdAt); }catch(err){}
          showMilestoneToast('🎵 Զույգդ նոր երգ դրեց («' + (data.songProposal.name || 'նոր երգ') + '»)');
        }
      }
    }, function(){ /* լուռ սխալ, ցանցի խնդիր */ });

    db.collection('couples').doc(coupleId).collection('notes').orderBy('date','desc').limit(30)
      .onSnapshot(function(snap){
        snap.docChanges().forEach(function(change){
          if(change.type !== 'added') return;
          var n = change.doc.data();
          if(n.fromCode === getDeviceCode()) return; // սեփական գրառումը արդեն IndexedDB-ում է
          if(!memDB) return;
          var blob = n.photoData ? dataUrlToBlob(n.photoData) : null;
          var tx = memDB.transaction('entries', 'readwrite');
          tx.objectStore('entries').add({
            type: n.memType || 'letter',
            caption: n.caption || '',
            text: n.text || '',
            blob: blob,
            date: n.date || new Date().toISOString()
          });
          var counts = {};
          try{ counts = JSON.parse(localStorage.getItem('kspasemMemCounts') || '{}'); }catch(err){}
          var t = n.memType || 'letter';
          counts[t] = (counts[t] || 0) + 1;
          try{ localStorage.setItem('kspasemMemCounts', JSON.stringify(counts)); }catch(err){}
          var countEl = document.getElementById(memCountIds[t]);
          if(countEl) countEl.textContent = counts[t];
          showMilestoneToast(t === 'photo' ? '📷 Նոր նկար զույգիցդ' : '💌 Նոր գրառում զույգիցդ');
        });
      });
  }

  // Ջնջում ենք memDB-ից cutoff ամսաթվից հետո ավելացված բոլոր հիշողությունները
  // (անկախ նրանից՝ ով է ավելացրել)՝ Couple Sync-ը անջատելիս
  function wipeMemoriesSince(cutoffISO){
    if(!memDB || !cutoffISO) return;
    var cutoffTime = new Date(cutoffISO).getTime();
    if(isNaN(cutoffTime)) return;
    var tx = memDB.transaction('entries', 'readwrite');
    var store = tx.objectStore('entries');
    var req = store.getAll();
    req.onsuccess = function(){
      var counts = {};
      try{ counts = JSON.parse(localStorage.getItem('kspasemMemCounts') || '{}'); }catch(err){}
      (req.result || []).forEach(function(rec){
        var t = rec.date ? new Date(rec.date).getTime() : 0;
        if(t >= cutoffTime){
          store.delete(rec.id);
          if(counts[rec.type]) counts[rec.type] = Math.max(0, counts[rec.type] - 1);
        }
      });
      try{ localStorage.setItem('kspasemMemCounts', JSON.stringify(counts)); }catch(err){}
      Object.keys(memCountIds).forEach(function(t){
        var el = document.getElementById(memCountIds[t]);
        if(el) el.textContent = counts[t] || 0;
      });
    };
  }

  var bgProposalModal = null;
  var pendingBgProposalUrl = null;
  function showBgProposalModal(dataUrl){
    pendingBgProposalUrl = dataUrl;
    bgProposalModal = document.getElementById('bgProposalModal');
    if(bgProposalModal) bgProposalModal.classList.add('active');
  }

  var bgProposalYesBtn = document.getElementById('bgProposalYesBtn');
  var bgProposalNoBtn = document.getElementById('bgProposalNoBtn');
  if(bgProposalYesBtn){
    bgProposalYesBtn.addEventListener('click', function(){
      if(pendingBgProposalUrl){
        applyBackgroundPhoto(pendingBgProposalUrl);
        var blob = dataUrlToBlob(pendingBgProposalUrl);
        if(photoDB && blob){
          var tx = photoDB.transaction('photo', 'readwrite');
          tx.objectStore('photo').put(blob, 'bgPhoto');
        }
      }
      pendingBgProposalUrl = null;
      if(bgProposalModal) bgProposalModal.classList.remove('active');
    });
  }
  if(bgProposalNoBtn){
    bgProposalNoBtn.addEventListener('click', function(){
      pendingBgProposalUrl = null;
      if(bgProposalModal) bgProposalModal.classList.remove('active');
    });
  }

  function pushBgProposal(dataUrl){
    var coupleId = getCoupleId();
    if(!db || !coupleId || !isPremium()) return;
    db.collection('couples').doc(coupleId).set({
      bgProposal: { dataUrl: dataUrl, fromCode: getDeviceCode(), createdAt: new Date().toISOString() }
    }, { merge:true }).catch(function(){});
  }

  function pushSongProposal(name){
    var coupleId = getCoupleId();
    if(!db || !coupleId || !isPremium()) return;
    db.collection('couples').doc(coupleId).set({
      songProposal: { name: name, fromCode: getDeviceCode(), createdAt: new Date().toISOString() }
    }, { merge:true }).catch(function(){});
  }

  function pushCoupleDates(){
    var coupleId = getCoupleId();
    if(!db || !coupleId || !isPremium()) return;
    var payload = { startDate: startInput.value, returnDate: returnInput.value, updatedAt: new Date().toISOString() };
    db.collection('couples').doc(coupleId).set(payload, { merge: true }).catch(function(){});
  }

  // Տեքստային հիշողություն (նամակ/գրառում) կամ նկար ավելացնելիս՝ push անել
  // couple-ի subcollection-ը։ photoData-ն (եթե կա) սեղմված base64 նկար է։
  function pushCoupleNote(type, caption, text, photoData){
    var coupleId = getCoupleId();
    if(!db || !coupleId || !isPremium()) return;
    var payload = {
      memType: type,
      caption: caption || '',
      text: text || '',
      fromCode: getDeviceCode(),
      date: new Date().toISOString()
    };
    if(photoData) payload.photoData = photoData;
    db.collection('couples').doc(coupleId).collection('notes').add(payload).catch(function(){});
  }

  // Նկարը սեղմում ենք canvas-ով, որ base64-ը տեղավորվի Firestore-ի փաստաթղթի
  // սահմանաչափի (1ՄԲ) մեջ։ callback(dataUrl) կանչվում է, dataUrl=null եթե
  // չհաջողվեց բավարար չափով սեղմել։
  function compressImageFile(file, callback){
    try{
      var reader = new FileReader();
      reader.onload = function(e){
        var img = new Image();
        img.onload = function(){
          var maxDim = 1280;
          var w = img.width, h = img.height;
          if(w > h && w > maxDim){ h = Math.round(h * maxDim / w); w = maxDim; }
          else if(h >= w && h > maxDim){ w = Math.round(w * maxDim / h); h = maxDim; }
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          var quality = 0.72;
          var dataUrl = canvas.toDataURL('image/jpeg', quality);
          var tries = 0;
          while(dataUrl.length > 700000 && tries < 4){
            quality = Math.max(quality - 0.15, 0.25);
            dataUrl = canvas.toDataURL('image/jpeg', quality);
            tries++;
          }
          callback(dataUrl.length <= 700000 ? dataUrl : null);
        };
        img.onerror = function(){ callback(null); };
        img.src = e.target.result;
      };
      reader.onerror = function(){ callback(null); };
      reader.readAsDataURL(file);
    }catch(err){ callback(null); }
  }

  function dataUrlToBlob(dataUrl){
    try{
      var parts = dataUrl.split(',');
      var mimeMatch = parts[0].match(/:(.*?);/);
      var mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      var bin = atob(parts[1]);
      var arr = new Uint8Array(bin.length);
      for(var i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: mime });
    }catch(err){ return null; }
  }

  /* --- Հայտի ուղարկում/հաստատում/մերժում --- */

  function finalizeLink(partnerCode, isSender){
    setPartnerCode(partnerCode);
    setPendingTarget('');
    if(coupleIncomingUnsub){ coupleIncomingUnsub(); coupleIncomingUnsub = null; }
    if(couplePendingUnsub){ couplePendingUnsub(); couplePendingUnsub = null; }
    var coupleId = getCoupleId();
    if(db && coupleId){
      db.collection('couples').doc(coupleId).get().then(function(doc){
        var existingConnectedAt = doc.exists ? doc.data().connectedAt : null;
        if(doc.exists && doc.data().returnDate){
          startInput.value = doc.data().startDate || startInput.value;
          returnInput.value = doc.data().returnDate || returnInput.value;
          updateDisplay(startInput, startPlaceholder, startValue);
          updateDisplay(returnInput, returnPlaceholder, returnValue);
          suppressCelebrationsOnce = true;
          refreshCountdownCard();
        } else if(isSender){
          // Կապակցման առաջին պահին couple-ի փաստաթուղթ դեռ չկա. որպեսզի
          // երկու օգտատերերի մոտ էլ միշտ նույն տվյալները երևան (և ոչ թե պատահական,
          // ում սարքն ավելի արագ գրի), միայն հայտն ուղարկողի (A) տվյալներն ենք
          // հրապարակում որպես ընդհանուր՝ ընդունողի (B) կողմը ոչինչ չի գրում,
          // այլ միայն սպասում ու քաշում է startCoupleListener-ով
          pushCoupleDates();
        }
        // Կապակցման պահը գրանցում ենք թե՛ ընդհանուր (Firestore), թե՛ տեղում.
        // սա այն սահմանագիծն է, որից հետո ավելացրած հիշողությունները
        // անջատվելու դեպքում ջնջվելու են երկուսի մոտից էլ
        var connectedAt = existingConnectedAt || new Date().toISOString();
        try{ localStorage.setItem('kspasemCoupleConnectedAt', connectedAt); }catch(err){}
        if(!existingConnectedAt){
          db.collection('couples').doc(coupleId).set({ connectedAt: connectedAt }, { merge:true }).catch(function(){});
        }
        startCoupleListener();
        updatePremiumUI();
        showMilestoneToast('💞 Կապակցված ես');
        if(typeof registerPushNotifications === 'function') registerPushNotifications();
      });
    }
  }

  // Սպասում ենք, որ B-ն հաստատի/մերժի մեր հայտը (A-ի կողմից)
  function watchPendingRequest(targetCode){
    if(couplePendingUnsub){ couplePendingUnsub(); couplePendingUnsub = null; }
    if(!db) return;
    couplePendingUnsub = db.collection('linkRequests').doc(targetCode).onSnapshot(function(doc){
      if(!doc.exists) return;
      var data = doc.data();
      if(data.fromCode !== getDeviceCode()) return;
      if(data.status === 'accepted'){
        finalizeLink(targetCode, true);
      } else if(data.status === 'declined'){
        setPendingTarget('');
        if(couplePendingUnsub){ couplePendingUnsub(); couplePendingUnsub = null; }
        updateCoupleSyncUI();
        showMilestoneToast('Հայտը մերժվեց');
      }
    });
  }

  // Սպասում ենք մեզ եկող հայտերին (B-ի կողմից)
  function watchIncomingRequests(){
    if(coupleIncomingUnsub){ coupleIncomingUnsub(); coupleIncomingUnsub = null; }
    if(!db || !isPremium() || getPartnerCode()) return;
    coupleIncomingUnsub = db.collection('linkRequests').doc(getDeviceCode()).onSnapshot(function(doc){
      if(!doc.exists || doc.data().status !== 'pending'){
        if(coupleIncomingBox) coupleIncomingBox.style.display = 'none';
        return;
      }
      var data = doc.data();
      if(coupleIncomingFrom) coupleIncomingFrom.textContent = data.fromCode;
      if(coupleIncomingBox) coupleIncomingBox.style.display = 'flex';
      if(coupleLinkForm) coupleLinkForm.style.display = 'none';
    });
  }

  if(coupleLinkBtn){
    coupleLinkBtn.addEventListener('click', function(){
      if(!isPremium()){
        showMilestoneToast('🔒 Couple Sync-ը հասանելի է միայն Պրեմիում օգտատերերին');
        return;
      }
      var code = (couplePartnerCodeInput.value || '').trim().toUpperCase();
      if(!code){ return; }
      if(code === getDeviceCode()){
        showMilestoneToast('Չես կարող կապակցվել քո սեփական կոդով');
        return;
      }
      if(!db){ showMilestoneToast('Կապ չկա սերվերի հետ'); return; }
      db.collection('linkRequests').doc(code).set({
        fromCode: getDeviceCode(),
        status: 'pending',
        date: new Date().toISOString()
      }).then(function(){
        setPendingTarget(code);
        updateCoupleSyncUI();
        watchPendingRequest(code);
        showMilestoneToast('Հայտն ուղարկվեց');
      }).catch(function(){
        showMilestoneToast('Չհաջողվեց ուղարկել, փորձիր նորից');
      });
    });
  }

  if(couplePendingCancelBtn){
    couplePendingCancelBtn.addEventListener('click', function(){
      var target = getPendingTarget();
      if(db && target){
        db.collection('linkRequests').doc(target).delete().catch(function(){});
      }
      setPendingTarget('');
      if(couplePendingUnsub){ couplePendingUnsub(); couplePendingUnsub = null; }
      updateCoupleSyncUI();
    });
  }

  if(coupleAcceptBtn){
    coupleAcceptBtn.addEventListener('click', function(){
      var fromCode = coupleIncomingFrom ? coupleIncomingFrom.textContent : '';
      if(!fromCode || !db) return;
      db.collection('linkRequests').doc(getDeviceCode()).set({ status: 'accepted' }, { merge: true }).then(function(){
        if(coupleIncomingBox) coupleIncomingBox.style.display = 'none';
        finalizeLink(fromCode, false);
      });
    });
  }

  if(coupleDeclineBtn){
    coupleDeclineBtn.addEventListener('click', function(){
      if(!db) return;
      db.collection('linkRequests').doc(getDeviceCode()).set({ status: 'declined' }, { merge: true }).then(function(){
        if(coupleIncomingBox) coupleIncomingBox.style.display = 'none';
        if(coupleLinkForm) coupleLinkForm.style.display = 'block';
      });
    });
  }

  if(coupleUnlinkBtn){
    coupleUnlinkBtn.addEventListener('click', function(){
      var modal = document.getElementById('coupleUnlinkModal');
      if(modal) modal.classList.add('active');
    });
  }

  var coupleUnlinkNoBtn = document.getElementById('coupleUnlinkNoBtn');
  var coupleUnlinkYesBtn = document.getElementById('coupleUnlinkYesBtn');
  if(coupleUnlinkNoBtn){
    coupleUnlinkNoBtn.addEventListener('click', function(){
      var modal = document.getElementById('coupleUnlinkModal');
      if(modal) modal.classList.remove('active');
    });
  }
  if(coupleUnlinkYesBtn){
    coupleUnlinkYesBtn.addEventListener('click', function(){
      var modal = document.getElementById('coupleUnlinkModal');
      if(modal) modal.classList.remove('active');
      var coupleId = getCoupleId();
      var cutoff = null;
      try{ cutoff = localStorage.getItem('kspasemCoupleConnectedAt'); }catch(err){}
      if(db && coupleId){
        db.collection('couples').doc(coupleId).set({
          disconnectedAt: new Date().toISOString(),
          disconnectedBy: getDeviceCode()
        }, { merge:true }).catch(function(){});
      }
      if(cutoff) wipeMemoriesSince(cutoff);
      setPartnerCode('');
      try{ localStorage.removeItem('kspasemCoupleConnectedAt'); }catch(err){}
      if(coupleUnsub){ coupleUnsub(); coupleUnsub = null; }
      updatePremiumUI();
      updateCoupleSyncUI();
      watchIncomingRequests();
      showMilestoneToast('Couple Sync-ը անջատված է');
    });
  }

  // Հետաձգում ենք մինչև isPremium()-ը հասանելի դառնա (checkPremiumStatus-ից հետո)
  setTimeout(function(){
    if(!isPremium()) return;
    if(getPartnerCode()){
      startCoupleListener();
      if(typeof registerPushNotifications === 'function') registerPushNotifications();
    } else if(getPendingTarget()){
      watchPendingRequest(getPendingTarget());
      updateCoupleSyncUI();
    } else {
      watchIncomingRequests();
    }
  }, 800);

  var memoriesScreen = document.getElementById('memoriesScreen');
  var dockMemories = document.getElementById('dockMemories');
  var memAddBtn = document.getElementById('memAddBtn');
  var memModal = document.getElementById('memModal');
  var memTypeGrid = document.getElementById('memTypeGrid');
  var memConfirmBtn = document.getElementById('memConfirmBtn');
  var memCancelBtn = document.getElementById('memCancelBtn');
  var memFileField = document.getElementById('memFileField');
  var memFileInput = document.getElementById('memFileInput');
  var memFilePickBtn = document.getElementById('memFilePickBtn');
  var memFileName = document.getElementById('memFileName');
  var memTextField = document.getElementById('memTextField');
  var memCaptionField = document.getElementById('memCaptionField');
  var MEM_MAX_FILES = 5;
  var memSelectedType = null;
  var memSelectedFiles = [];

  var memCountIds = { photo:'memCountPhoto', voice:'memCountVoice', letter:'memCountLetter', video:'memCountVideo', note:'memCountNote' };
  var memFileTypes = { photo:'image/*', voice:'audio/*', video:'video/*' };
  var memIsTextType = { letter:true, note:true };

  var memDB = null;
  try{
    var memDBRequest = indexedDB.open('kspasemMemoriesDB', 1);
    memDBRequest.onupgradeneeded = function(e){
      e.target.result.createObjectStore('entries', { keyPath:'id', autoIncrement:true });
    };
    memDBRequest.onsuccess = function(e){ memDB = e.target.result; };
    memDBRequest.onerror = function(){};
  }catch(err){}

  function loadMemCounts(){
    var counts = {};
    try{ counts = JSON.parse(localStorage.getItem('kspasemMemCounts') || '{}'); }catch(err){}
    Object.keys(memCountIds).forEach(function(type){
      document.getElementById(memCountIds[type]).textContent = counts[type] || 0;
    });
  }
  loadMemCounts();

  function isCapsuleUnlocked(){
    if(!returnInput.value) return false;
    var rd = new Date(returnInput.value); rd.setHours(0,0,0,0);
    var today = new Date(); today.setHours(0,0,0,0);
    return today >= rd;
  }

  function updateCapsuleLockUI(){
    var caption = document.querySelector('.mem-caption');
    if(!caption) return;
    var mdv = document.getElementById('memDateValue');
    if(mdv) mdv.textContent = returnInput.value ? formatDateHy(returnInput.value) : '—';
    var lockIconOpen = '<svg viewBox="0 0 24 24" fill="none" stroke="#8bb96e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;vertical-align:-2px;"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 7-2.6"/></svg>';
    var lockIconClosed = '<svg viewBox="0 0 24 24" fill="none" stroke="#e8b84b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;vertical-align:-2px;"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>';
    if(isCapsuleUnlocked()){
      caption.innerHTML = lockIconOpen + ' Կապսուլան բաց է<br>կարող ես տեսնել քո հիշողությունները';
    } else if(returnInput.value){
      var rd = new Date(returnInput.value); rd.setHours(0,0,0,0);
      var today = new Date(); today.setHours(0,0,0,0);
      var daysLeft = Math.round((rd - today) / 86400000);
      caption.innerHTML = lockIconClosed + ' Կապսուլան փակ է<br>կբացվի ' + formatDateHy(returnInput.value) + ' (' + daysLeft + ' օր հետո)';
    } else {
      caption.innerHTML = 'Քո հիշողությունները<br>պահվում են ապահով';
    }
  }

  var memEntryFromSettings = false;

  function openMemoriesScreen(fromSettings){
    memEntryFromSettings = !!fromSettings;
    settingsScreen.classList.remove('active');
    timeSettingsScreen.classList.remove('active');
    calendarScreen.classList.remove('active');
    document.getElementById('goalsScreen').classList.remove('active');
    document.getElementById('aboutScreen').classList.remove('active');
    document.getElementById('myProgressScreen').classList.remove('active');
    memoriesScreen.classList.add('active');
    countdownEl.classList.add('behind-settings');
    if(!fromSettings) setActiveDock(dockMemories);
    updateCapsuleLockUI();
    document.getElementById('mainDock').classList.add('visible');
    document.querySelectorAll('.mem-row').forEach(function(row, idx){
      row.classList.remove('anim-in');
      void row.offsetWidth;
      row.style.animationDelay = (idx * 0.05) + 's';
      row.classList.add('anim-in');
    });
  }

  dockMemories.addEventListener('click', function(){
    openMemoriesScreen(false);
  });

  memAddBtn.addEventListener('click', function(){
    memTypeGrid.style.display = '';
    var _t = memModal.querySelector('.mem-modal-title'); if(_t) _t.textContent = 'Ի՞նչ ես ուզում ավելացնել';
    memSelectedType = null;
    memSelectedFiles = [];
    var btns = memTypeGrid.querySelectorAll('.mem-type-btn');
    for(var i=0; i<btns.length; i++){ btns[i].classList.remove('selected'); }
    memFileField.style.display = 'none';
    memTextField.style.display = 'none';
    memCaptionField.style.display = 'none';
    memTextField.value = '';
    memCaptionField.value = '';
    memFileName.textContent = '';
    memModal.classList.add('active');
  });

  memTypeGrid.addEventListener('click', function(e){
    var btn = e.target.closest('.mem-type-btn');
    if(!btn) return;
    var all = memTypeGrid.querySelectorAll('.mem-type-btn');
    for(var i=0; i<all.length; i++){ all[i].classList.remove('selected'); }
    btn.classList.add('selected');
    memSelectedType = btn.getAttribute('data-type');
    memSelectedFiles = [];
    memFileName.textContent = '';

    if(memIsTextType[memSelectedType]){
      memFileField.style.display = 'none';
      memTextField.style.display = 'block';
    } else {
      memTextField.style.display = 'none';
      memFileField.style.display = 'block';
      memFileInput.accept = memFileTypes[memSelectedType] || '*/*';
    }
    memCaptionField.style.display = 'block';
  });

  memFilePickBtn.addEventListener('click', function(){
    memFileInput.click();
  });

  memFileInput.addEventListener('change', function(){
    var files = memFileInput.files ? Array.prototype.slice.call(memFileInput.files) : [];
    if(!files.length) return;
    if(files.length > MEM_MAX_FILES){
      showMilestoneToast('Մեկ անգամից կարելի է ընտրել առավելագույնը ' + MEM_MAX_FILES + ' ֆայլ');
      files = files.slice(0, MEM_MAX_FILES);
    }
    memSelectedFiles = files;
    memFileName.textContent = files.length === 1 ? files[0].name : (files.length + ' ֆայլ ընտրված');
  });

  memConfirmBtn.addEventListener('click', function(){
    if(!memSelectedType) return;
    var isText = memIsTextType[memSelectedType];
    if(isText && !memTextField.value.trim()) return;
    if(!isText && memSelectedFiles.length === 0) return;

    var filesToAdd = isText ? [null] : memSelectedFiles;
    var addCount = filesToAdd.length;

    if(!isPremium() && (totalMemCount() + addCount) > FREE_MEM_LIMIT){
      memModal.classList.remove('active');
      showMilestoneToast('🔒 Հասել ես անվճար սահմանին (' + FREE_MEM_LIMIT + ') — բացիր Պրեմիում');
      settingsScreen.classList.remove('active');
      memoriesScreen.classList.remove('active');
      document.getElementById('premiumScreen').classList.add('active');
      updatePremiumUI();
      return;
    }

    var caption = memCaptionField.value.trim();
    var counts = {};
    try{ counts = JSON.parse(localStorage.getItem('kspasemMemCounts') || '{}'); }catch(err){}

    // photo/voice ֆայլերը վերածում ենք base64 dataURL-ի (հուսալի է Android
    // APK/WebView-ում), video-ն մնում է Blob (կարող է շատ մեծ լինել)
    function storeMemFile(file, done){
      var needsDataUrl = memSelectedType === 'photo' || memSelectedType === 'voice';
      if(!needsDataUrl || !file){ done(file); return; }
      var reader = new FileReader();
      reader.onload = function(){ done(reader.result); };
      reader.onerror = function(){ done(file); };
      reader.readAsDataURL(file);
    }

    filesToAdd.forEach(function(file){
      storeMemFile(file, function(storedBlobOrDataUrl){
        var record = {
          type: memSelectedType,
          caption: caption,
          text: isText ? memTextField.value.trim() : null,
          blob: isText ? null : storedBlobOrDataUrl,
          date: new Date().toISOString()
        };

        if(memDB){
          var tx = memDB.transaction('entries', 'readwrite');
          tx.objectStore('entries').add(record);
        }

        // Couple Sync. — տեքստային գրառումները ուղարկվում են անմիջապես։ Նկարները
        // սեղմվում են (base64) և ուղարկվում են Firestore-ի փաստաթղթի սահմանաչափի
        // տակ։ Ձայն/վիդեո ֆայլերը դեռ չեն սինքրոնացվում, քանի որ շատ մեծ են
        // Firestore-ի համար (անհրաժեշտ կլինի Firebase Storage)։
        if(getPartnerCode() && isPremium()){
          if(isText){
            pushCoupleNote(memSelectedType, record.caption, record.text);
          } else if(memSelectedType === 'photo' && file){
            compressImageFile(file, function(dataUrl){
              if(dataUrl){
                pushCoupleNote('photo', record.caption, null, dataUrl);
              } else {
                showMilestoneToast('Նկարը շատ մեծ է, զույգիդ չուղարկվեց');
              }
            });
          }
        }

        counts[memSelectedType] = (counts[memSelectedType] || 0) + 1;
        try{ localStorage.setItem('kspasemMemCounts', JSON.stringify(counts)); }catch(err){}
        document.getElementById(memCountIds[memSelectedType]).textContent = counts[memSelectedType];
      });
    });

    memModal.classList.remove('active');
  });

  memCancelBtn.addEventListener('click', function(){
    memModal.classList.remove('active');
  });

  var memTypeTitles = { photo:'Ավելացնել լուսանկար', voice:'Ավելացնել ձայնագրություն', letter:'Ավելացնել նամակ', video:'Ավելացնել տեսանյութ', note:'Ավելացնել գրառում' };
  document.querySelectorAll('.mem-row').forEach(function(row){
    row.style.cursor = 'pointer';
    row.addEventListener('click', function(){
      var countEl = row.querySelector('.mem-row-count');
      var type = Object.keys(memCountIds).find(function(t){ return memCountIds[t] === countEl.id; });
      if(!type) return;
      // Open the add dialog locked to this category only
      memAddBtn.click();
      var typeBtn = memTypeGrid.querySelector('.mem-type-btn[data-type="' + type + '"]');
      if(typeBtn) typeBtn.click();
      memTypeGrid.style.display = 'none';
      var ttl = memModal.querySelector('.mem-modal-title');
      if(ttl) ttl.textContent = memTypeTitles[type] || 'Ավելացնել';
    });
  });

  function openMemoryViewer(type){
    if(!memDB) return;
    var tx = memDB.transaction('entries', 'readonly');
    var req = tx.objectStore('entries').getAll();
    req.onsuccess = function(){
      var items = req.result.filter(function(r){ return r.type === type; });
      if(!items.length){
        showMilestoneToast('Այս կատեգորիայում դեռ ոչինչ չկա');
        return;
      }
      var html = items.map(function(it){
        var cap = it.caption ? '<div style="color:#fff;font-weight:600;font-size:13px;margin-bottom:4px;">' + it.caption + '</div>' : '';
        var dateStr = it.date ? formatDateHy(it.date.slice(0,10)) : '';
        var dateLine = dateStr ? '<div style="color:rgba(255,255,255,0.4);font-size:11px;margin-top:6px;">' + dateStr + '</div>' : '';
        if(it.text){
          return '<div class="loc-result-item" style="cursor:default;">' + cap + '<div style="color:rgba(255,255,255,0.8);font-size:13px;">' + it.text + '</div>' + dateLine + '</div>';
        }
        // Նոր գրառումներում blob դաշտը արդեն dataURL string է (photo/voice),
        // հին գրառումներում կարող է Blob լինել (video, կամ շատ հին տվյալներ)
        var url;
        if(typeof it.blob === 'string'){
          url = it.blob;
        } else {
          try{ url = URL.createObjectURL(it.blob); }catch(err){ url = null; }
        }
        if(!url){
          return '<div class="loc-result-item" style="cursor:default;">' + cap + '<div style="color:rgba(255,255,255,0.5);font-size:12.5px;">Ֆայլը հասանելի չէ</div>' + dateLine + '</div>';
        }
        var media = it.type === 'photo'
          ? '<img src="' + url + '" style="width:100%;border-radius:10px;margin-top:6px;">'
          : it.type === 'video'
          ? '<video src="' + url + '" controls style="width:100%;border-radius:10px;margin-top:6px;"></video>'
          : '<audio src="' + url + '" controls style="width:100%;margin-top:6px;"></audio>';
        return '<div class="loc-result-item" style="cursor:default;">' + cap + media + dateLine + '</div>';
      }).join('');
      memModal.querySelector('.mem-modal-card').innerHTML =
        '<div class="mem-modal-title">Հիշողություններ</div>' +
        '<div style="display:flex;flex-direction:column;gap:10px;max-height:60vh;overflow-y:auto;" class="scrollable">' + html + '</div>' +
        '<div class="mem-modal-cancel" id="memViewerCloseBtn" style="margin-top:14px;">Փակել</div>';
      memModal.classList.add('active');
      document.getElementById('memViewerCloseBtn').addEventListener('click', function(){
        memModal.classList.remove('active');
      });
    };
  }

  var myProgressScreen = document.getElementById('myProgressScreen');
  var progressCardBtn = document.getElementById('progressCardBtn');
  var mpBackBtn = document.getElementById('mpBackBtn');
  var MP_RING_C = 2 * Math.PI * 71;
  var weekdayLabels = ['Երկ','Երք','Չրք','Հնգ','Ուր','Շբթ','Կիր'];

  progressCardBtn.addEventListener('click', function(){
    if(!startInput.value || !returnInput.value) return;
    var sd = new Date(startInput.value); sd.setHours(0,0,0,0);
    var rd = new Date(returnInput.value); rd.setHours(0,0,0,0);
    var today = new Date(); today.setHours(0,0,0,0);
    var totalDays = Math.max(1, Math.round((rd - sd) / 86400000));
    var passedDays = Math.max(0, Math.min(totalDays, Math.round((today - sd) / 86400000)));
    var remainingDays = totalDays - passedDays;
    var percent = Math.min(100, Math.max(0, (passedDays / totalDays) * 100));

    document.getElementById('mpRingPercent').textContent = percent.toFixed(4).replace('.', ',') + '%';
    document.getElementById('mpSumPassed').textContent = passedDays + ' օր անցել է';
    document.getElementById('mpSumRemaining').textContent = remainingDays + ' օր մնացել է';
    document.getElementById('mpBarFill').style.width = percent + '%';
    document.getElementById('mpRingFill').style.strokeDashoffset = MP_RING_C - (MP_RING_C * percent / 100);
    document.getElementById('mpPassed').textContent = passedDays + ' օր';
    document.getElementById('mpRemaining').textContent = remainingDays + ' օր';
    document.getElementById('mpTotal').textContent = totalDays + ' օր';
    function _mo(f, t){ return (t.getFullYear()-f.getFullYear())*12 + (t.getMonth()-f.getMonth()) - (t.getDate() < f.getDate() ? 1 : 0); }
    function _fill(pre, mo, d){ document.getElementById('mp'+pre+'Y').textContent = Math.floor(mo/12); document.getElementById('mp'+pre+'M').textContent = mo % 12; document.getElementById('mp'+pre+'W').textContent = Math.floor(d/7); document.getElementById('mp'+pre+'D').textContent = d; }
    var _pe = new Date(sd.getTime() + passedDays*86400000); _pe.setHours(0,0,0,0);
    _fill('P', Math.max(0,_mo(sd, today)), passedDays);
    _fill('R', Math.max(0,_mo(today, rd)), remainingDays);

    var todayWeekday = (today.getDay() + 6) % 7; // Monday = 0
    var monday = new Date(today);
    monday.setDate(today.getDate() - todayWeekday);

    var thisWeekCount = 0;
    var chart = document.getElementById('mpChart');
    chart.innerHTML = '';
    var mIdx = 0, curMonth = -1, nextEnd = null;
    var ms = new Date(sd);
    while(ms < rd && mIdx < 60){
      var me = new Date(sd.getFullYear(), sd.getMonth() + mIdx + 1, sd.getDate()); me.setHours(0,0,0,0);
      if(me > rd) me = new Date(rd);
      var f = Math.min(100, Math.max(0, (today - ms) / (me - ms) * 100));
      var isCur = today >= ms && today < me;
      if(isCur){ curMonth = mIdx + 1; nextEnd = me; }
      var tile = document.createElement('div');
      tile.className = 'mp-month' + (isCur ? ' is-current' : '') + (f >= 100 ? ' is-done' : '');
      tile.innerHTML = '<div class="mp-month-fill" style="height:' + f + '%"></div><span>' + (mIdx + 1) + '</span>';
      chart.appendChild(tile);
      ms = me; mIdx++;
    }
    var smart = document.getElementById('mpSmart');
    var lines = [];
    if(curMonth > 0){
      var left = Math.round((nextEnd - today) / 86400000);
      lines.push('Հիմա ' + curMonth + '-րդ ամիսն է՝ ավարտին ' + left + ' օր');
    }
    var nextGoal = [100,200,300,400,500,600,700,800].filter(function(d){ return d > passedDays && d < totalDays; })[0];
    if(nextGoal) lines.push('Հաջորդ նպատակը՝ ' + nextGoal + ' օր (' + (nextGoal - passedDays) + ' օրից)');
    var avgPerMonth = 30.4375;
    lines.push('Ընդհանուր՝ ' + totalDays + ' օր ≈ ' + (totalDays / avgPerMonth).toFixed(1).replace('.', ',') + ' ամիս');
    smart.innerHTML = lines.map(function(l){ return '<div>' + l + '</div>'; }).join('');
    document.getElementById('mpThisWeek').textContent = '';


    myProgressScreen.classList.add('active');
    countdownEl.classList.add('behind-settings');
    document.getElementById('mainDock').classList.remove('visible');
  });

  mpBackBtn.addEventListener('click', function(){
    goalsScreen.classList.remove('active');
    myProgressScreen.classList.remove('active');
    countdownEl.classList.remove('behind-settings');
    setActiveDock(dockHome);
    document.getElementById('mainDock').classList.add('visible');
  });

  var lockToggle = document.getElementById('lockToggle');

  /* ===== App Lock (PIN + Face ID/Touch ID) ===== */
  var appLockScreen = document.getElementById('appLockScreen');
  var lockDotsWrap = document.getElementById('lockDots');
  var lockDots = lockDotsWrap.children;
  var lockTitleEl = document.getElementById('lockTitle');
  var lockErrorEl = document.getElementById('lockError');
  var lockFaceIdBtn = document.getElementById('lockFaceIdBtn');
  var lockKeypad = document.getElementById('lockKeypad');
  var lockBackBtn = document.getElementById('lockBackBtn');
  var lockInput = '';
  var lockMode = 'unlock'; // 'unlock' | 'setup-new' | 'setup-confirm'
  var lockNewPinTemp = '';
  var lockSetupDoneCb = null;
  var lockWebAuthnSupported = false;

  function sha256Hex(str){
    var enc = new TextEncoder().encode(str);
    return crypto.subtle.digest('SHA-256', enc).then(function(buf){
      return Array.prototype.map.call(new Uint8Array(buf), function(b){ return ('0' + b.toString(16)).slice(-2); }).join('');
    });
  }
  function getStoredPinHash(){
    try{ return localStorage.getItem('kspasemPinHash'); }catch(err){ return null; }
  }
  function setStoredPinHash(hash){
    try{ localStorage.setItem('kspasemPinHash', hash); }catch(err){}
  }
  function clearStoredPinHash(){
    try{ localStorage.removeItem('kspasemPinHash'); localStorage.removeItem('kspasemWebAuthnId'); }catch(err){}
  }
  function isLockEnabled(){
    try{ return localStorage.getItem('kspasemLockEnabled') === '1'; }catch(err){ return false; }
  }

  function updateLockDots(){
    for(var i = 0; i < lockDots.length; i++){
      lockDots[i].className = i < lockInput.length ? 'filled' : '';
    }
  }
  function resetLockInput(){
    lockInput = '';
    updateLockDots();
  }
  function shakeDots(msg){
    lockDotsWrap.classList.remove('shake');
    void lockDotsWrap.offsetWidth;
    lockDotsWrap.classList.add('shake');
    lockErrorEl.textContent = msg || 'Սխալ կոդ';
    resetLockInput();
  }
  function unlockApp(){
    lockErrorEl.textContent = '';
    appLockScreen.classList.remove('active');
  }

  function handleLockKey(k){
    if(k === 'back'){
      lockInput = lockInput.slice(0, -1);
      updateLockDots();
      return;
    }
    if(k === 'face'){
      tryFaceUnlock();
      return;
    }
    if(lockInput.length >= 4) return;
    lockInput += k;
    updateLockDots();
    if(lockInput.length === 4){
      setTimeout(processLockInput, 120);
    }
  }

  function processLockInput(){
    if(lockMode === 'unlock'){
      sha256Hex(lockInput).then(function(hash){
        if(hash === getStoredPinHash()){
          unlockApp();
        } else {
          shakeDots('Սխալ PIN, փորձիր նորից');
        }
      });
    } else if(lockMode === 'setup-new'){
      lockNewPinTemp = lockInput;
      lockMode = 'setup-confirm';
      lockTitleEl.textContent = 'Կրկնիր PIN կոդը';
      resetLockInput();
    } else if(lockMode === 'setup-confirm'){
      if(lockInput === lockNewPinTemp){
        sha256Hex(lockInput).then(function(hash){
          setStoredPinHash(hash);
          finishLockSetup();
        });
      } else {
        lockMode = 'setup-new';
        lockTitleEl.textContent = 'Ստեղծիր PIN կոդ';
        shakeDots('Կոդերը չեն համընկնում, փորձիր նորից');
      }
    }
  }

  lockKeypad.addEventListener('click', function(e){
    var btn = e.target.closest('button');
    if(!btn) return;
    handleLockKey(btn.getAttribute('data-k'));
  });

  function beginPinSetup(onDone){
    lockMode = 'setup-new';
    lockNewPinTemp = '';
    lockTitleEl.textContent = 'Ստեղծիր PIN կոդ';
    lockErrorEl.textContent = '';
    resetLockInput();
    lockFaceIdBtn.style.visibility = 'hidden';
    lockBackBtn.style.display = 'flex';
    appLockScreen.classList.add('active');
    lockSetupDoneCb = onDone;
  }

  function cancelPinSetup(){
    appLockScreen.classList.remove('active');
    lockMode = 'unlock';
    resetLockInput();
    lockErrorEl.textContent = '';
    lockSetupDoneCb = null;
  }

  if(lockBackBtn){
    lockBackBtn.addEventListener('click', cancelPinSetup);
  }

  function finishLockSetup(){
    appLockScreen.classList.remove('active');
    lockMode = 'unlock';
    lockBackBtn.style.display = 'none';
    registerFaceId();
    if(lockSetupDoneCb){ lockSetupDoneCb(); lockSetupDoneCb = null; }
  }

  function showUnlockScreen(){
    lockMode = 'unlock';
    lockTitleEl.textContent = 'Մուտքագրիր PIN կոդը';
    lockErrorEl.textContent = '';
    resetLockInput();
    lockFaceIdBtn.style.visibility = lockWebAuthnSupported && getWebAuthnId() ? 'visible' : 'hidden';
    lockBackBtn.style.display = 'none';
    appLockScreen.classList.add('active');
    if(lockWebAuthnSupported && getWebAuthnId()){
      setTimeout(tryFaceUnlock, 350);
    }
  }

  /* Face ID / Touch ID (WebAuthn platform authenticator) — կամընտիր, հենվում ենք
     PIN-ի վրա որպես հիմնական մեթոդ, քանի որ ոչ բոլոր սարքերն ու բրաուզերներն
     են աջակցում platform authenticator-ը */
  function getWebAuthnId(){
    try{ return localStorage.getItem('kspasemWebAuthnId'); }catch(err){ return null; }
  }
  function b64urlToBuf(s){
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while(s.length % 4) s += '=';
    var bin = atob(s);
    var buf = new Uint8Array(bin.length);
    for(var i=0;i<bin.length;i++) buf[i] = bin.charCodeAt(i);
    return buf;
  }
  function bufToB64url(buf){
    var bin = '';
    var arr = new Uint8Array(buf);
    for(var i=0;i<arr.length;i++) bin += String.fromCharCode(arr[i]);
    return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }

  if(window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable){
    PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(function(available){
      lockWebAuthnSupported = !!available;
    }).catch(function(){ lockWebAuthnSupported = false; });
  }

  function registerFaceId(){
    if(!lockWebAuthnSupported || !window.PublicKeyCredential) return;
    var challenge = crypto.getRandomValues(new Uint8Array(32));
    var userId = crypto.getRandomValues(new Uint8Array(16));
    navigator.credentials.create({
      publicKey: {
        challenge: challenge,
        rp: { name: 'Kspasem' },
        user: { id: userId, name: 'kspasem-user', displayName: 'Kspasem' },
        pubKeyCredParams: [{ type:'public-key', alg:-7 }, { type:'public-key', alg:-257 }],
        authenticatorSelection: { authenticatorAttachment:'platform', userVerification:'required' },
        timeout: 60000
      }
    }).then(function(cred){
      try{ localStorage.setItem('kspasemWebAuthnId', bufToB64url(cred.rawId)); }catch(err){}
    }).catch(function(){ /* Օգտատերը մերժեց կամ սարքը չի աջակցում — PIN-ը մնում է հիմնական մեթոդ */ });
  }

  function tryFaceUnlock(){
    var credId = getWebAuthnId();
    if(!credId || !window.PublicKeyCredential) return;
    var challenge = crypto.getRandomValues(new Uint8Array(32));
    navigator.credentials.get({
      publicKey: {
        challenge: challenge,
        allowCredentials: [{ id: b64urlToBuf(credId), type:'public-key' }],
        userVerification:'required',
        timeout: 60000
      }
    }).then(function(){
      unlockApp();
    }).catch(function(){ /* չեղարկվեց, մնում է PIN-ը */ });
  }

  lockFaceIdBtn.addEventListener('click', tryFaceUnlock);

  lockToggle.addEventListener('click', function(){
    var turningOn = !lockToggle.classList.contains('on');
    if(turningOn){
      beginPinSetup(function(){
        lockToggle.classList.add('on');
        try{ localStorage.setItem('kspasemLockEnabled', '1'); }catch(err){}
      });
    } else {
      lockToggle.classList.remove('on');
      clearStoredPinHash();
      try{ localStorage.setItem('kspasemLockEnabled', '0'); }catch(err){}
    }
  });

  try{
    if(isLockEnabled() && getStoredPinHash()){
      lockToggle.classList.add('on');
      showUnlockScreen();
    }
  }catch(err){}

  /* ===== Reset all data ===== */
  var resetDataBtn = document.getElementById('resetDataBtn');
  var resetModal = document.getElementById('resetModal');
  var resetYesBtn = document.getElementById('resetYesBtn');
  var resetNoBtn = document.getElementById('resetNoBtn');

  /* ===== Ծանուցումների զանգակ ===== */
  var notifBell = document.getElementById('notifBell');
  var notifDot = document.getElementById('notifDot');
  var notifModal = document.getElementById('notifModal');
  var notifCloseBtn = document.getElementById('notifCloseBtn');
  var notifList = document.getElementById('notifList');
  var NOTIF_ICONS = { premium: '👑', badge: '🏅', admin: '📢' };

  function getNotifications(){
    var arr = [];
    try{ arr = JSON.parse(localStorage.getItem('kspasemNotifications') || '[]'); }catch(err){}
    // Ամեն 7 օրը մեկ նախորդ ծանուցումները ջնջվում են
    var limit = Date.now() - 7*24*60*60*1000;
    var fresh = arr.filter(function(n){ var t = new Date(n.date).getTime(); return !isNaN(t) && t >= limit; });
    if(fresh.length !== arr.length){
      try{ localStorage.setItem('kspasemNotifications', JSON.stringify(fresh)); }catch(err){}
    }
    return fresh;
  }
  function saveNotifications(arr){
    try{ localStorage.setItem('kspasemNotifications', JSON.stringify(arr.slice(0, 30))); }catch(err){}
  }
  function addNotification(type, text, title){
    var arr = getNotifications();
    arr.unshift({ type: type, text: text, title: title || '', date: new Date().toISOString(), read: false });
    saveNotifications(arr);
    updateNotifDot();
  }
  window.__kspAddNotification = addNotification;
  function escapeNotifHtml(s){
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }
  function updateNotifDot(){
    var hasUnread = getNotifications().some(function(n){ return !n.read; });
    notifDot.style.display = hasUnread ? 'block' : 'none';
  }
  function renderNotifList(){
    var arr = getNotifications();
    notifList.innerHTML = '';
    if(arr.length === 0){
      notifList.innerHTML = '<div style="color:rgba(255,255,255,0.4); font-size:13px; text-align:center; padding:20px 0;">Դեռ ծանուցումներ չկան</div>';
      return;
    }
    arr.forEach(function(n){
      var row = document.createElement('div');
      row.style.cssText = 'display:flex; gap:10px; align-items:flex-start; background:rgba(255,255,255,0.06); border-radius:14px; padding:10px 12px;';
      var d = new Date(n.date);
      var titleHtml = n.title ? '<div style="color:#fff; font-size:13px; font-weight:800; line-height:1.35; margin-bottom:2px;">' + escapeNotifHtml(n.title) + '</div>' : '';
      row.innerHTML =
        '<img src="images/day-celebrate-icon.png" style="width:22px; height:22px; flex-shrink:0; border-radius:6px; object-fit:cover;">' +
        '<div style="flex:1; min-width:0;">' +
          titleHtml +
          '<div style="color:rgba(255,255,255,0.85); font-size:12.5px; font-weight:400; line-height:1.4;">' + escapeNotifHtml(n.text) + '</div>' +
          '<div style="color:rgba(255,255,255,0.4); font-size:10.5px; margin-top:3px;">' + d.toLocaleString('hy-AM') + '</div>' +
        '</div>';
      notifList.appendChild(row);
    });
  }

  notifBell.addEventListener('click', function(){
    renderNotifList();
    notifModal.classList.add('active');
    var arr = getNotifications();
    arr.forEach(function(n){ n.read = true; });
    saveNotifications(arr);
    updateNotifDot();
  });
  var memInfoModal = document.getElementById('memInfoModal');
  document.getElementById('memInfoBtn').addEventListener('click', function(){ memInfoModal.classList.add('active'); });
  document.getElementById('memInfoCloseBtn').addEventListener('click', function(){ memInfoModal.classList.remove('active'); });
  memInfoModal.addEventListener('click', function(e){ if(e.target === memInfoModal) memInfoModal.classList.remove('active'); });

  notifCloseBtn.addEventListener('click', function(){
    notifModal.classList.remove('active');
  });
  updateNotifDot();

  /* ===== Broadcast (admin-ից ուղարկվող ընդհանուր հաղորդագրություն) ===== */
  // Ապպն առաջին անգամ բացվելիս գրանցում ենք ներբեռնման/առաջին բացման
  // ամսաթիվը. սա է թույլ տալիս ադմինի ծանուցումը ցույց տալ միայն նրանց, ովքեր
  // արդեն ունեին ապպը ուղարկման պահին, ոչ թե նոր ներբեռնողներին
  function getInstallDate(){
    var d = null;
    try{ d = localStorage.getItem('kspasemInstallDate'); }catch(err){}
    if(!d){
      d = new Date().toISOString();
      try{ localStorage.setItem('kspasemInstallDate', d); }catch(err){}
    }
    return d;
  }

  function checkBroadcast(){
    if(!db) return;
    db.collection('appConfig').doc('broadcast').get().then(function(doc){
      if(!doc.exists) return;
      var data = doc.data();
      if(!data.active || !data.text) return;
      // Եթե օգտատերն ապպը ներբեռնել է այս ծանուցումն արդեն ուղարկվելուց հետո,
      // նրան չենք ցույց տալիս. հաջորդ ծանուցումը (updatedAt ավելի ուշ) արդեն
      // կանցնի, քանի որ նրա install ամսաթիվն այդ պահին արդեն ավելի հին կլինի
      var installDate = getInstallDate();
      if(data.updatedAt && (Date.now() - new Date(data.updatedAt).getTime()) > 7*24*60*60*1000) return;
      if(data.updatedAt && installDate && installDate > data.updatedAt) return;
      var seenKey = null;
      try{ seenKey = localStorage.getItem('kspasemBroadcastSeen'); }catch(err){}
      var currentKey = (data.updatedAt || '') + '|' + (data.title || '') + '|' + data.text;
      if(seenKey === currentKey) return;
      try{ localStorage.setItem('kspasemBroadcastSeen', currentKey); }catch(err){}
      addNotification('admin', data.text, data.title);
    }).catch(function(){});
  }

  getInstallDate();
  checkBroadcast();
  setInterval(function(){ updateNotifDot(); }, 3600000);

  resetDataBtn.addEventListener('click', function(){
    resetModal.classList.add('active');
  });

  resetNoBtn.addEventListener('click', function(){
    resetModal.classList.remove('active');
  });

  function deleteIndexedDB(name){
    return new Promise(function(resolve){
      try{
        var req = indexedDB.deleteDatabase(name);
        req.onsuccess = function(){ resolve(); };
        req.onerror = function(){ resolve(); };
        req.onblocked = function(){ resolve(); };
      }catch(err){ resolve(); }
    });
  }

  resetYesBtn.addEventListener('click', function(){
    resetYesBtn.disabled = true;
    resetYesBtn.textContent = '...';

    // Clear all localStorage keys used by the app
    try{
      localStorage.removeItem('kspasemSetupData');
      localStorage.removeItem('kspasemLastSeen');
      localStorage.removeItem('kspasemSeenBadges');
      localStorage.removeItem('kspasemCelebratedMilestones');
      localStorage.removeItem('kspasemLocation');
      localStorage.removeItem('kspasemMyLocation');
      localStorage.removeItem('kspasemLockEnabled');
      localStorage.removeItem('kspasemPinHash');
      localStorage.removeItem('kspasemWebAuthnId');
      localStorage.removeItem('kspasemSongMuted');
      localStorage.removeItem('kspasemMemCounts');
      localStorage.removeItem('kspasemDischargeCelebrated');
      // Նշում. Premium/device/couple կոդերը (kspasemPremium, kspasemDeviceCode,
      // kspasemPartnerCode) դիտավորյալ չեն մաքրվում reset-ի ժամանակ, քանի որ
      // դրանք կապված են վճարած լիցենզիային, ոչ թե հաշվարկի տվյալներին
    }catch(err){}

    // Stop and clear music
    try{
      bgMusic.pause();
      bgMusic.removeAttribute('src');
      bgMusic.load();
    }catch(err){}

    // Close any open IndexedDB connections first, otherwise deleteDatabase
    // gets blocked and never actually removes the stored photo/song/memories
    try{ if(photoDB){ photoDB.close(); photoDB = null; } }catch(err){}
    try{ if(songDB){ songDB.close(); songDB = null; } }catch(err){}
    try{ if(memDB){ memDB.close(); memDB = null; } }catch(err){}

    // Delete IndexedDB stores (photo, song, memories) and only reload once
    // all three deletions have actually completed
    // Wipe every remaining app key (except license/couple codes) and session data
    try{
      var keep = {kspasemOnboardingSeen:1, kspasemPermAsked:1, kspasemInstallDate:1, kspasemBroadcastSeen:1};
      Object.keys(localStorage).forEach(function(k){
        if(k.indexOf('kspasem') === 0 && !keep[k]) localStorage.removeItem(k);
      });
      sessionStorage.clear();
    }catch(err){}
    try{ document.documentElement.style.removeProperty('--bg-photo'); }catch(err){}

    // Empty every object store first (works even if deleteDatabase is blocked), then delete
    function wipeIndexedDB(name){
      return new Promise(function(resolve){
        var done = false;
        function finish(){ if(!done){ done = true; resolve(); } }
        setTimeout(finish, 2500);
        try{
          var req = indexedDB.open(name);
          req.onerror = finish;
          req.onsuccess = function(){
            var db = req.result;
            try{
              var names = Array.prototype.slice.call(db.objectStoreNames);
              if(!names.length){ db.close(); return finish(); }
              var tx = db.transaction(names, 'readwrite');
              names.forEach(function(n){ tx.objectStore(n).clear(); });
              tx.oncomplete = function(){ db.close(); finish(); };
              tx.onerror = tx.onabort = function(){ db.close(); finish(); };
            }catch(e){ try{ db.close(); }catch(_){} finish(); }
          };
        }catch(err){ finish(); }
      });
    }

    Promise.all(['kspasemPhotoDB','kspasemSongDB','kspasemMemoriesDB'].map(function(n){
      return wipeIndexedDB(n).then(function(){ return deleteIndexedDB(n); });
    })).then(function(){
      resetModal.classList.remove('active');
      window.location.reload();
    });
  });

// ==========================================================================
// Տեքստի copy/cut/context-menu արգելափակում (input/textarea դաշտերից բացի)
// ==========================================================================
(function(){
  function isEditable(el){
    if(!el) return false;
    var tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
  }

  ['copy','cut','contextmenu'].forEach(function(evtName){
    document.addEventListener(evtName, function(e){
      if(isEditable(e.target)) return;
      e.preventDefault();
    }, {capture:true});
  });

  document.addEventListener('selectstart', function(e){
    if(isEditable(e.target)) return;
    e.preventDefault();
  }, {capture:true});

  document.addEventListener('dragstart', function(e){
    if(isEditable(e.target)) return;
    e.preventDefault();
  }, {capture:true});
})();

/* ===== Full Screen ===== */
(function(){
  var de = document.documentElement;
  var req = de.requestFullscreen || de.webkitRequestFullscreen;
  if(!req) return; // iOS Safari-ում կաշխատի «Add to Home Screen» (PWA) եղանակով
  function goFull(){
    document.removeEventListener('click', goFull, true);
    document.removeEventListener('touchend', goFull, true);
    if(!document.fullscreenElement && !document.webkitFullscreenElement){
      try{ var p = req.call(de, { navigationUI:'hide' }); if(p && p.catch) p.catch(function(){}); }catch(e){}
    }
  }
  document.addEventListener('click', goFull, true);
  document.addEventListener('touchend', goFull, true);
})();


/* ===== Zoom արգելափակում (pinch / double-tap) ===== */
(function(){
  ['gesturestart','gesturechange','gestureend'].forEach(function(n){
    document.addEventListener(n, function(e){ e.preventDefault(); }, {passive:false});
  });
  document.addEventListener('touchmove', function(e){
    if(e.touches && e.touches.length > 1) e.preventDefault();
  }, {passive:false});
  var lastTap = 0;
  document.addEventListener('touchend', function(e){
    var now = Date.now();
    if(now - lastTap < 320){
      var t = e.target;
      if(!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'))) e.preventDefault();
    }
    lastTap = now;
  }, {passive:false});
})();


// ==========================================================================
// Good morning (10:00) / good night (23:00) greetings
// ==========================================================================
(function(){
  var MORNING = ['Բարի լույս, սիրելիս ☀️ Թող այսօրվա օրը լինի թեթև ու լույսով լի ♥️','Բարի լույս 🥹 Ամեն առավոտ քեզ մի քայլ ավելի մոտ է տանը 🪖','Բարի լույս 😇 Այսօր էլ հպարտ եմ քեզնով 💖','Բարի լույս ✨ Մտքովս քեզ հետ եմ, ամեն պահ 🫶🏼','Բարի լույս 💚 Թող օրդ անցնի խաղաղ ու ժպիտով 🪖'];
  var NIGHT = ['Բարի գիշեր 😇 Թող քնդ խաղաղ լինի ♥️','Բարի գիշեր 💫 Եվս մեկ օր մոտ ենք հանդիպմանը 🫶🏼','Բարի գիշեր 🥺 Երազներում հանդիպենք 💋','Բարի գիշեր ✨ Հանգիստ քնիր, ես քեզ սպասում եմ 💖','Բարի գիշեր 🪖 Թող Աստված պահի քեզ ✝️'];
  function dayKey(d){ return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate(); }
  function pick(a, d){ return a[Math.floor(d.getTime()/86400000) % a.length]; }

  function deliver(kind, d){
    var m = kind === 'morning';
    var text = pick(m ? MORNING : NIGHT, d);
    var title = m ? 'Բարի լույս' : 'Բարի գիշեր';
    try{ window.__kspAddNotification && window.__kspAddNotification('greeting', text, title); }catch(e){}
    try{
      if(window.Notification && Notification.permission === 'granted'){
        if(navigator.serviceWorker && navigator.serviceWorker.controller){
          navigator.serviceWorker.controller.postMessage({show: kind});
        } else {
          new Notification(title, {body: text, icon: 'icons/icon-192.png'});
        }
      }
    }catch(e){}
    // Native APK (Capacitor) – system notification
    try{
      var LN = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications;
      if(LN) LN.schedule({notifications:[{id: m ? 1001 : 1002, title: title, body: text, schedule:{at:new Date(Date.now()+500)}}]});
    }catch(e){}
  }

  function check(){
    var now = new Date(), h = now.getHours(), key = dayKey(now);
    try{
      if(h >= 10 && h < 23 && localStorage.getItem('kspasemGreetMorning') !== key){
        localStorage.setItem('kspasemGreetMorning', key); deliver('morning', now);
      }
      if(h >= 23 && localStorage.getItem('kspasemGreetNight') !== key){
        localStorage.setItem('kspasemGreetNight', key); deliver('night', now);
      }
    }catch(e){}
  }
  check();
  setInterval(check, 30000);
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) check(); });

  // Ask permission once (on first tap) and register the service worker for background delivery
  function setupBackground(){
    try{
      if(window.Notification && Notification.permission === 'default') Notification.requestPermission();
      var LN = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications;
      if(LN){
        LN.requestPermissions();
        // repeating native schedule: every day 10:00 and 23:00
        LN.schedule({notifications:[
          {id:2001, title:'Բարի լույս', body:MORNING[0], schedule:{on:{hour:10, minute:0}, allowWhileIdle:true}},
          {id:2002, title:'Բարի գիշեր', body:NIGHT[0], schedule:{on:{hour:23, minute:0}, allowWhileIdle:true}}
        ]});
      }
      if('serviceWorker' in navigator){
        navigator.serviceWorker.register('sw.js').then(function(reg){
          if(reg.periodicSync && reg.periodicSync.register){
            reg.periodicSync.register('kspasem-greetings', {minInterval: 60*60*1000}).catch(function(){});
          }
        }).catch(function(){});
      }
    }catch(e){}
  }
  document.addEventListener('click', function once(){ document.removeEventListener('click', once); setupBackground(); }, {once:true});
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function(){});
})();


// First launch: ask for notifications (and native photo/file access in the APK)
(function(){
  function ask(){
    try{
      if(localStorage.getItem('kspasemPermAsked')) return;
      localStorage.setItem('kspasemPermAsked','1');
    }catch(e){}
    try{ if(window.Notification && Notification.permission === 'default') Notification.requestPermission(); }catch(e){}
    try{
      var P = window.Capacitor && Capacitor.Plugins;
      if(P){
        if(P.LocalNotifications) P.LocalNotifications.requestPermissions();
        if(P.PushNotifications) P.PushNotifications.requestPermissions();
      }
    }catch(e){}
  }
  document.addEventListener('click', function(){ ask(); }, {once:true});
  document.addEventListener('touchend', function(){ ask(); }, {once:true});
})();


// Ask for photo / file access exactly when the user starts using it (APK); the browser picker handles web
(function(){
  var asked = {};
  function need(kind){
    if(asked[kind]) return; asked[kind] = true;
    try{
      var P = window.Capacitor && Capacitor.Plugins; if(!P) return;
      if(kind === 'photos' && P.Camera) P.Camera.requestPermissions({permissions:['photos']});
      if(kind === 'files' && P.Filesystem) P.Filesystem.requestPermissions();
    }catch(e){}
  }
  document.addEventListener('click', function(e){
    var t = e.target; if(!t || !t.closest) return;
    if(t.closest('#changePhotoBtn')) need('photos');
    else if(t.closest('#favSongBtn')) need('files');
    else if(t.closest('#memFilePickBtn')){
      var sel = document.querySelector('.mem-type-btn.selected');
      var ty = sel && sel.getAttribute('data-type');
      need(ty === 'photo' || ty === 'video' ? 'photos' : 'files');
    }
  }, true);
})();
