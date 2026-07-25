(() => {
  'use strict';

  const SAVE_KEY = 'goldbound-frontier-v1';
  const now = () => Date.now();
  const today = () => new Date().toISOString().slice(0, 10);
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const defaults = () => ({
    version: 1,
    coins: 350,
    gold: 0,
    silver: 0,
    diamonds: 18,
    energy: 100,
    xp: 0,
    level: 1,
    streak: 0,
    finds: 0,
    totalFinds: 0,
    lastFind: null,
    lastTick: now(),
    lastDaily: '',
    boostUntil: 0,
    starterClaimed: false,
    permanentMultiplier: 1,
    upgrades: { detector: 1, shovel: 1, battery: 1, analyzer: 0 },
    buildings: { camp: 1, sluice: 0, workshop: 0, assay: 0 },
    missionIndex: 0,
    missionClaimed: 0,
    sound: true,
    reducedMotion: false
  });

  const buildingDefs = [
    { id: 'camp', icon: '⛺', name: 'Camp de base', desc: 'Un foyer pour attirer les premiers prospecteurs.', base: 120, income: 1, unlock: 0 },
    { id: 'sluice', icon: '🌊', name: 'Station de lavage', desc: 'Trie en continu les sédiments de la rivière.', base: 650, income: 5, unlock: 2 },
    { id: 'workshop', icon: '🏗️', name: 'Atelier solaire', desc: 'Modernise les outils et automatise l’extraction.', base: 3200, income: 22, unlock: 5 },
    { id: 'assay', icon: '🏦', name: 'Bureau d’essai', desc: 'Certifie et revend les métaux au meilleur prix.', base: 15000, income: 95, unlock: 9 }
  ];

  const upgradeDefs = [
    { id: 'detector', icon: '📡', name: 'Bobine haute fréquence', desc: '+12% de précision et zone parfaite élargie', base: 180, currency: 'coins' },
    { id: 'shovel', icon: '⛏️', name: 'Pelle en titane', desc: '+18% de minerais à chaque découverte', base: 240, currency: 'coins' },
    { id: 'battery', icon: '🔋', name: 'Batterie industrielle', desc: '+10 énergie maximale', base: 18, currency: 'silver' },
    { id: 'analyzer', icon: '🔬', name: 'Analyseur minéral', desc: 'Augmente la chance de trouver de l’or', base: 12, currency: 'gold' }
  ];

  const missions = [
    { title: 'Premières traces', text: 'Trouvez 5 gisements', goal: 5, type: 'finds', reward: { diamonds: 2, coins: 300 } },
    { title: 'Bâtisseur de l’Ouest', text: 'Possédez 5 bâtiments', goal: 5, type: 'buildings', reward: { diamonds: 3, coins: 600 } },
    { title: 'Fièvre jaune', text: 'Accumulez 25 unités d’or', goal: 25, type: 'gold', reward: { diamonds: 5, coins: 1200 } },
    { title: 'Ville nouvelle', text: 'Atteignez 12 niveaux de bâtiments', goal: 12, type: 'buildings', reward: { diamonds: 8, coins: 2500 } }
  ];

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!parsed || typeof parsed !== 'object') return defaults();
      const base = defaults();
      return {
        ...base,
        ...parsed,
        upgrades: { ...base.upgrades, ...(parsed.upgrades || {}) },
        buildings: { ...base.buildings, ...(parsed.buildings || {}) }
      };
    } catch (_) {
      return defaults();
    }
  }

  let state = load();
  let scanning = false;
  let scanStart = 0;
  let scanTarget = 0.5;
  let scanPos = 0;
  let scanFrame = null;
  let adType = null;
  let adInterval = null;
  let lastPassiveSave = now();

  const format = value => {
    const n = Math.max(0, Number(value) || 0);
    if (n >= 1e9) return `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)}Md`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k`;
    return Math.floor(n).toLocaleString('fr-FR');
  };

  function save() {
    state.lastTick = now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function maxEnergy() { return 100 + Math.max(0, state.upgrades.battery - 1) * 10; }
  function totalBuildings() { return Object.values(state.buildings).reduce((a, b) => a + b, 0); }
  function prosperity() { return totalBuildings() + state.level; }
  function activeMultiplier() {
    return state.permanentMultiplier * (state.boostUntil > now() ? 2 : 1);
  }
  function buildingMultiplier() {
    const adBoost = state.boostUntil > now() ? 2 : 1;
    return state.permanentMultiplier * adBoost * (1 + Math.floor(totalBuildings() / 5) * .1);
  }
  function incomePerSecond() {
    return buildingDefs.reduce((sum, def) => sum + state.buildings[def.id] * def.income, 0) * buildingMultiplier();
  }
  function buildingCost(def) { return Math.floor(def.base * Math.pow(1.42, state.buildings[def.id])); }
  function upgradeCost(def) {
    const level = state.upgrades[def.id];
    return Math.floor(def.base * Math.pow(1.58, level - (def.id === 'analyzer' ? 0 : 1)));
  }
  function missionValue(mission) {
    if (mission.type === 'finds') return state.totalFinds;
    if (mission.type === 'buildings') return totalBuildings();
    if (mission.type === 'gold') return state.gold;
    return 0;
  }

  function grantXp(amount) {
    state.xp += amount;
    let needed = state.level * 100;
    while (state.xp >= needed) {
      state.xp -= needed;
      state.level++;
      state.diamonds += 1;
      toast(`Niveau ${state.level} atteint`, '+1 diamant de progression', 'reward');
      needed = state.level * 100;
    }
  }

  function render() {
    $('#coins').textContent = format(state.coins);
    $('#gold').textContent = format(state.gold);
    $('#diamonds').textContent = format(state.diamonds);
    $('#energy').textContent = Math.floor(state.energy);
    $('#maxEnergy').textContent = maxEnergy();
    $('#level').textContent = state.level;
    $('#streak').textContent = state.streak;
    $('#income').textContent = format(incomePerSecond());
    $('#detectorLevel').textContent = `MK-${toRoman(state.upgrades.detector)}`;
    $('#dailyStatus').textContent = state.lastDaily === today() ? 'Revenez demain' : 'Disponible';
    $('#dailyBtn').disabled = state.lastDaily === today();
    $('#prosperity').textContent = prosperity();
    $('#townProgress').style.width = `${Math.min(100, (prosperity() % 10) * 10)}%`;
    $('#buildingBonus').textContent = `Bonus global +${Math.floor(totalBuildings() / 5) * 10}%`;
    $('#villageNotif').hidden = state.coins < Math.min(...buildingDefs.filter(d => prosperity() >= d.unlock).map(buildingCost));
    document.documentElement.classList.toggle('reduced-motion', state.reducedMotion);
    $('#soundToggle').classList.toggle('on', state.sound);
    $('#motionToggle').classList.toggle('on', state.reducedMotion);

    if (state.lastFind) {
      const icon = state.lastFind.type === 'diamond' ? '◆' : state.lastFind.type === 'gold' ? '◆' : '●';
      $('#lastFind').innerHTML = `<span class="find-icon">${icon}</span><div><small>DERNIÈRE TROUVAILLE</small><strong>${state.lastFind.label}</strong></div>`;
    }

    renderMission();
    renderBuildings();
    renderUpgrades();
  }

  function toRoman(n) {
    return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][Math.min(7, Math.max(0, n - 1))];
  }

  function renderMission() {
    const mission = missions[state.missionIndex % missions.length];
    const value = Math.min(mission.goal, missionValue(mission));
    $('#missionTitle').textContent = mission.title;
    $('#missionText').textContent = mission.text;
    $('#missionCount').textContent = `${format(value)} / ${format(mission.goal)}`;
    $('#missionProgress').style.width = `${value / mission.goal * 100}%`;
    $('#claimMission').disabled = value < mission.goal;
  }

  function renderBuildings() {
    const grid = $('#buildingGrid');
    grid.innerHTML = buildingDefs.map(def => {
      const level = state.buildings[def.id];
      const locked = prosperity() < def.unlock;
      const cost = buildingCost(def);
      return `<article class="building-card ${locked ? 'locked' : ''}">
        <span class="level-tag">NIV. ${level}</span><div class="building-icon">${def.icon}</div>
        <h3>${def.name}</h3><p>${def.desc}</p>
        <div class="building-stats"><span>REVENU</span><b>+${format(def.income)} /s</b></div>
        <button data-building="${def.id}" ${locked || state.coins < cost ? 'disabled' : ''}>${locked ? `🔒 PROSPÉRITÉ ${def.unlock}` : `● ${format(cost)} · CONSTRUIRE`}</button>
      </article>`;
    }).join('');
  }

  function renderUpgrades() {
    $('#upgradeList').innerHTML = upgradeDefs.map(def => {
      const level = state.upgrades[def.id];
      const cost = upgradeCost(def);
      const balance = state[def.currency];
      const symbol = def.currency === 'coins' ? '●' : def.currency === 'gold' ? '◆' : '◈';
      return `<article class="upgrade-card"><div class="upgrade-icon">${def.icon}</div><div><h3>${def.name} · Niv. ${level}</h3><p>${def.desc}</p></div><button data-upgrade="${def.id}" ${balance < cost ? 'disabled' : ''}>${symbol} ${format(cost)} · AMÉLIORER</button></article>`;
    }).join('');
  }

  function showView(target) {
    $$('.view').forEach(v => v.classList.toggle('active', v.dataset.view === target));
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.target === target));
    window.scrollTo({ top: 0, behavior: state.reducedMotion ? 'auto' : 'smooth' });
  }

  function startScan() {
    if (scanning) return finishScan();
    if (state.energy < 5) {
      toast('Batterie vide', 'Regardez une pub ou améliorez votre batterie.');
      return;
    }
    state.energy -= 5;
    scanning = true;
    scanStart = performance.now();
    const margin = .13;
    scanTarget = margin + Math.random() * (1 - margin * 2);
    $('#signalZone').style.left = `${scanTarget * 100 - 7}%`;
    $('#scanner').classList.add('scanning');
    $('#detector-panel')?.classList.add('scanning');
    $('.detector-panel').classList.add('scanning');
    $('#scanTitle').textContent = 'SIGNAL EN COURS…';
    $('#scanBtnText').textContent = 'CREUSER MAINTENANT';
    $('#scanCost').textContent = 'VISEZ LA ZONE DORÉE';
    $('#scanTip').textContent = 'Appuyez au moment où l’aiguille touche le signal.';
    save();

    const animate = time => {
      const elapsed = time - scanStart;
      const cycle = (elapsed % 2200) / 2200;
      scanPos = cycle < .5 ? cycle * 2 : 2 - cycle * 2;
      const scannerWidth = $('#scanner').clientWidth;
      $('#needle').style.transform = `translateX(${scanPos * Math.max(0, scannerWidth - 3)}px)`;
      if (elapsed > 6500) return finishScan(true);
      scanFrame = requestAnimationFrame(animate);
    };
    scanFrame = requestAnimationFrame(animate);
  }

  function finishScan(timeout = false) {
    if (!scanning) return;
    scanning = false;
    if (scanFrame) cancelAnimationFrame(scanFrame);
    $('#scanner').classList.remove('scanning');
    $('.detector-panel').classList.remove('scanning');
    $('#scanBtnText').textContent = 'LANCER LE SCAN';
    $('#scanCost').textContent = '⚡ 5 ÉNERGIE';
    $('#scanTip').textContent = 'Lancez le scan, puis creusez quand l’aiguille traverse la zone lumineuse.';

    const distance = timeout ? 1 : Math.abs(scanPos - scanTarget);
    const precisionBonus = (state.upgrades.detector - 1) * .012;
    let quality = 'FAIBLE';
    let qualityMult = .65;
    if (distance < .055 + precisionBonus) { quality = 'PARFAIT'; qualityMult = 1.65; state.streak++; }
    else if (distance < .15 + precisionBonus) { quality = 'BON'; qualityMult = 1.1; state.streak++; }
    else { state.streak = 0; }
    if (state.streak >= 10) {
      state.boostUntil = now() + 60000;
      state.streak = 0;
      toast('FIÈVRE DE L’OR !', 'Tous les gains sont doublés pendant 60 secondes.', 'reward');
    }

    const roll = Math.random();
    const goldChance = .18 + state.upgrades.analyzer * .025;
    const diamondChance = state.starterClaimed ? .0075 : .0025;
    const shovel = 1 + (state.upgrades.shovel - 1) * .18;
    const mult = qualityMult * shovel * activeMultiplier();
    let label, type, coinGain;

    if (roll < diamondChance) {
      const amount = 1;
      state.diamonds += amount;
      state.gold += Math.max(1, Math.round(2 * mult));
      coinGain = Math.round(140 * mult);
      state.coins += coinGain;
      label = `Diamant brut +${amount} · ${format(coinGain)} pièces`;
      type = 'diamond';
      celebrate('◆ DIAMANT ULTRA RARE !', label);
    } else if (roll < diamondChance + goldChance) {
      const amount = Math.max(1, Math.round((1 + Math.random() * 4) * mult));
      state.gold += amount;
      coinGain = Math.round(amount * 42 * activeMultiplier());
      state.coins += coinGain;
      label = `Or natif +${amount} · ${format(coinGain)} pièces`;
      type = 'gold';
    } else {
      const amount = Math.max(2, Math.round((4 + Math.random() * 10) * mult));
      state.silver += amount;
      coinGain = Math.round(amount * 9 * activeMultiplier());
      state.coins += coinGain;
      label = `Argent +${amount} · ${format(coinGain)} pièces`;
      type = 'silver';
    }

    state.finds++;
    state.totalFinds++;
    state.lastFind = { type, label, at: now() };
    grantXp(Math.round(20 * qualityMult));
    $('#scanTitle').textContent = `${quality} · GISEMENT TROUVÉ`;
    floatReward(`+${format(coinGain)} ●`);
    if (quality === 'PARFAIT') toast('Signal parfait', label, 'reward');
    save();
    render();
  }

  function buyBuilding(id) {
    const def = buildingDefs.find(d => d.id === id);
    if (!def || prosperity() < def.unlock) return;
    const cost = buildingCost(def);
    if (state.coins < cost) return toast('Fonds insuffisants', `Il manque ${format(cost - state.coins)} pièces.`);
    state.coins -= cost;
    state.buildings[id]++;
    grantXp(35 + state.buildings[id] * 5);
    toast(`${def.name} amélioré`, `Revenu +${format(def.income)} pièce/s`, 'reward');
    save(); render();
  }

  function buyUpgrade(id) {
    const def = upgradeDefs.find(d => d.id === id);
    if (!def) return;
    const cost = upgradeCost(def);
    if (state[def.currency] < cost) return toast('Ressource insuffisante', 'Continuez à prospecter.');
    state[def.currency] -= cost;
    state.upgrades[id]++;
    if (id === 'battery') state.energy = Math.min(maxEnergy(), state.energy + 10);
    toast(`${def.name} amélioré`, `Niveau ${state.upgrades[id]} installé`, 'reward');
    save(); render();
  }

  function claimMission() {
    const mission = missions[state.missionIndex % missions.length];
    if (missionValue(mission) < mission.goal) return;
    Object.entries(mission.reward).forEach(([key, amount]) => state[key] += amount);
    state.missionIndex++;
    state.missionClaimed++;
    toast('Mission accomplie', `+${mission.reward.diamonds} diamants · +${format(mission.reward.coins)} pièces`, 'reward');
    save(); render();
  }

  function openAd(type) {
    adType = type;
    $('#adModal').hidden = false;
    $('#claimAd').disabled = true;
    $('#claimAd').textContent = 'VEUILLEZ PATIENTER';
    $('#closeAd').disabled = false;
    let seconds = 5;
    $('#adTimer').textContent = seconds;
    clearInterval(adInterval);
    adInterval = setInterval(() => {
      seconds--;
      $('#adTimer').textContent = Math.max(0, seconds);
      if (seconds <= 0) {
        clearInterval(adInterval);
        $('#claimAd').disabled = false;
        $('#claimAd').textContent = 'RÉCUPÉRER LA RÉCOMPENSE';
      }
    }, 1000);
  }

  function claimAd() {
    if ($('#claimAd').disabled) return;
    if (adType === 'boost') {
      state.boostUntil = now() + 180000;
      toast('Fièvre de l’or active', 'Gains ×2 pendant 3 minutes.', 'reward');
    } else if (adType === 'energy') {
      state.energy = Math.min(maxEnergy(), state.energy + 50);
      toast('Batterie rechargée', '+50 énergie', 'reward');
    } else {
      state.diamonds += 3;
      toast('Coffre sponsorisé', '+3 diamants', 'reward');
    }
    $('#adModal').hidden = true;
    save(); render();
  }

  function claimDaily() {
    if (state.lastDaily === today()) return;
    state.lastDaily = today();
    state.coins += 250;
    state.diamonds += 3;
    $('#rewardModal').hidden = true;
    toast('Convoi récupéré', '+250 pièces · +3 diamants', 'reward');
    save(); render();
  }

  function simulatePack(pack) {
    const rewards = {
      starter: { diamonds: 500, multiplier: 2, label: 'Pack du Pionnier' },
      small: { diamonds: 100, label: 'Poignée de diamants' },
      medium: { diamonds: 650, label: 'Sac de diamants' },
      large: { diamonds: 3500, label: 'Coffre du magnat' }
    };
    const item = rewards[pack];
    if (!item) return;
    if (!confirm(`MODE DÉMO\n\nSimuler l’achat « ${item.label} » ?\nAucun paiement réel ne sera effectué.`)) return;
    if (pack === 'starter' && state.starterClaimed) return toast('Déjà activé', 'Le pack de lancement est unique.');
    state.diamonds += item.diamonds;
    if (item.multiplier) state.permanentMultiplier *= item.multiplier;
    if (pack === 'starter') state.starterClaimed = true;
    toast('Achat démo validé', `+${format(item.diamonds)} diamants${item.multiplier ? ' · Production ×2' : ''}`, 'reward');
    save(); render();
  }

  function toast(title, message, type = '') {
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.innerHTML = `<strong>${title}</strong><small>${message}</small>`;
    $('#toastStack').appendChild(node);
    setTimeout(() => node.remove(), 3600);
  }

  function floatReward(text) {
    const node = document.createElement('span');
    const button = $('#scanBtn').getBoundingClientRect();
    node.className = 'floating-reward';
    node.textContent = text;
    node.style.left = `${button.left + button.width / 2 - 45}px`;
    node.style.top = `${button.top - 5}px`;
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 1500);
  }

  function celebrate(title, message) {
    toast(title, message, 'reward');
    document.body.animate([
      { filter: 'brightness(1)' },
      { filter: 'brightness(1.45)' },
      { filter: 'brightness(1)' }
    ], { duration: 450 });
  }

  function applyOfflineProgress() {
    const elapsed = Math.max(0, Math.min(4 * 3600, (now() - (state.lastTick || now())) / 1000));
    if (elapsed > 30) {
      const gain = Math.floor(incomePerSecond() * elapsed * .5);
      if (gain > 0) {
        state.coins += gain;
        setTimeout(() => toast('Bon retour, prospecteur', `Le village a produit ${format(gain)} pièces hors ligne.`, 'reward'), 600);
      }
    }
  }

  function tick() {
    const current = now();
    const dt = Math.min(2, (current - state.lastTick) / 1000);
    state.lastTick = current;
    state.coins += incomePerSecond() * dt;
    state.energy = Math.min(maxEnergy(), state.energy + dt / 20);
    if (current - lastPassiveSave > 5000) { save(); lastPassiveSave = current; }
    $('#coins').textContent = format(state.coins);
    $('#energy').textContent = Math.floor(state.energy);
    if (state.boostUntil > current) $('#income').textContent = format(incomePerSecond());
  }

  function bind() {
    $$('.nav-item').forEach(button => button.addEventListener('click', () => showView(button.dataset.target)));
    $$('[data-jump]').forEach(button => button.addEventListener('click', () => showView(button.dataset.jump)));
    $('#scanBtn').addEventListener('click', startScan);
    $('#claimMission').addEventListener('click', claimMission);
    $('#buildingGrid').addEventListener('click', event => {
      const button = event.target.closest('[data-building]');
      if (button) buyBuilding(button.dataset.building);
    });
    $('#upgradeList').addEventListener('click', event => {
      const button = event.target.closest('[data-upgrade]');
      if (button) buyUpgrade(button.dataset.upgrade);
    });
    $$('[data-ad]').forEach(button => button.addEventListener('click', () => openAd(button.dataset.ad)));
    $('#claimAd').addEventListener('click', claimAd);
    $('#closeAd').addEventListener('click', () => { clearInterval(adInterval); $('#adModal').hidden = true; });
    $('#dailyBtn').addEventListener('click', () => { if (state.lastDaily !== today()) $('#rewardModal').hidden = false; });
    $('#claimDaily').addEventListener('click', claimDaily);
    $$('[data-pack]').forEach(button => button.addEventListener('click', () => simulatePack(button.dataset.pack)));
    $('#settingsBtn').addEventListener('click', () => { $('#settingsModal').hidden = false; });
    $('[data-close-modal]').addEventListener('click', () => { $('#settingsModal').hidden = true; });
    $('#soundToggle').addEventListener('click', () => { state.sound = !state.sound; save(); render(); });
    $('#motionToggle').addEventListener('click', () => { state.reducedMotion = !state.reducedMotion; save(); render(); });
    $('#resetSave').addEventListener('click', () => {
      if (!confirm('Réinitialiser définitivement toute la progression locale ?')) return;
      localStorage.removeItem(SAVE_KEY);
      location.reload();
    });
    window.addEventListener('beforeunload', save);
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  }

  applyOfflineProgress();
  bind();
  render();
  setInterval(tick, 1000);
  save();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();
