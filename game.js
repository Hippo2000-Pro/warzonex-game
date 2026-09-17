import { Player } from './Player.js';
import { Enemy } from './Enemy.js';
import { getWeapon } from './Weapons.js';
import { World } from './World.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const healthValue = document.getElementById('healthValue');
const scoreValue = document.getElementById('scoreValue');
const waveValue = document.getElementById('waveValue');
const weaponValue = document.getElementById('weaponValue');
const missionValue = document.getElementById('missionValue');
const skillValue = document.getElementById('skillValue');
const briefingText = document.getElementById('briefingText');
const messageBox = document.getElementById('messageBox');
const messageTitle = document.getElementById('messageTitle');
const messageText = document.getElementById('messageText');
const restartBtn = document.getElementById('restartBtn');

const WORLD = { width: 1800, height: 1200 };
const MOVEMENT_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);
const WEAPON_KEYS = new Set(['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4']);
const BIOME_PALETTES = {
  forest: { groundA: '#173625', groundB: '#213d2d', accent: '#8de4bb', obstacle: '#2f3f3c', cover: '#5b6a64' },
  desert: { groundA: '#533b22', groundB: '#6a4c2a', accent: '#f8d38d', obstacle: '#51433a', cover: '#8f7862' },
  urban: { groundA: '#1b272d', groundB: '#2b3338', accent: '#b4d5ff', obstacle: '#404b52', cover: '#7a7f83' },
  snow: { groundA: '#b9d7df', groundB: '#dceaf1', accent: '#c7f3ff', obstacle: '#a2bfc6', cover: '#dfe9ee' },
};
const keys = {};
const pointer = { x: canvas.width / 2, y: canvas.height / 2, down: false };

let player;
let world;
let currentBiome = 'forest';
let enemies = [];
let bullets = [];
let particles = [];
let obstacles = [];
let allies = [];
let pickups = [];
let vehicles = [];
let turrets = [];
let supplyDrops = [];
let cover = [];
let grenades = [];
let missionLog = [];
let feedMessages = [];
let score = 0;
let wave = 1;
let kills = 0;
let missionCounter = 1;
let eventTimer = 12;
let lastTime = 0;
let gameOver = false;
let gameStarted = false;
let weatherTime = 0;
let mission = {
  phase: 0,
  type: 'clear',
  clearGoal: 7,
  extractionX: 1600,
  extractionY: 200,
  cacheX: 980,
  cacheY: 720,
  holdTimer: 0,
  radarPulse: 0,
  done: false,
};

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function hexToRgba(hex, alpha) {
  const value = hex.replace('#', '');
  const bigint = Number.parseInt(value, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getCamera() {
  return {
    x: clamp(player.x - canvas.width / 2, 0, WORLD.width - canvas.width),
    y: clamp(player.y - canvas.height / 2, 0, WORLD.height - canvas.height),
  };
}

function createPlayer() {
  const playerObject = new Player(WORLD.width / 2, WORLD.height / 2);
  playerObject.weaponAmmo = playerObject.ammoState.rifle;
  playerObject.skills = {
    overdrive: { cooldown: 0, maxCooldown: 12, label: 'Overdrive' },
    scan: { cooldown: 0, maxCooldown: 9, label: 'Scan' },
    airstrike: { cooldown: 0, maxCooldown: 18, label: 'Airstrike' },
  };
  return playerObject;
}

function updateSkillHUD() {
  if (!player) return;

  const overdrive = player.skills.overdrive.cooldown > 0 ? `${player.skills.overdrive.cooldown.toFixed(1)}s` : 'OK';
  const scan = player.skills.scan.cooldown > 0 ? `${player.skills.scan.cooldown.toFixed(1)}s` : 'OK';
  const airstrike = player.skills.airstrike.cooldown > 0 ? `${player.skills.airstrike.cooldown.toFixed(1)}s` : 'OK';
  skillValue.textContent = `Q:${overdrive} • H:${scan} • F:${airstrike}`;
}

function startReload() {
  if (!player || player.reloading) return;

  const weapon = getWeapon(player.weaponIndex);
  if (player.weaponAmmo >= weapon.magazine) return;

  player.reloading = true;
  player.reloadTimer = weapon.reloadTime;
  messageText.textContent = `Recharge ${weapon.label}...`;
  messageBox.classList.remove('hidden');
}

function finishReload() {
  if (!player) return;

  const weapon = getWeapon(player.weaponIndex);
  player.weaponAmmo = weapon.magazine;
  player.ammoState[weapon.key] = weapon.magazine;
  player.reloading = false;
  player.reloadTimer = 0;
  messageBox.classList.add('hidden');
}

function createEnemy(x, y) {
  return new Enemy(x, y, wave);
}

function buildWorld() {
  const biomeNames = Object.keys(BIOME_PALETTES);
  currentBiome = biomeNames[Math.floor(Math.random() * biomeNames.length)];
  world = new World(WORLD.width, WORLD.height);
  obstacles = world.obstacles;
  mission.extractionX = 1450 + Math.random() * 220;
  mission.extractionY = 160 + Math.random() * 260;
  mission.cacheX = 720 + Math.random() * 420;
  mission.cacheY = 580 + Math.random() * 300;
}

function spawnVehicles() {
  vehicles = [
    { x: 420, y: 300, w: 54, h: 30, type: 'jeep', color: '#7ce6c7', speed: 220, label: 'Jeep' },
    { x: 1060, y: 700, w: 62, h: 32, type: 'truck', color: '#f7d97c', speed: 180, label: 'Truck' },
    { x: 1350, y: 420, w: 52, h: 26, type: 'humvee', color: '#8fbaff', speed: 250, label: 'Humvee' },
  ];
}

function createAlly(x, y, label, role) {
  return {
    x,
    y,
    label,
    role,
    radius: 15,
    speed: 170,
    maxHealth: 75,
    health: 75,
    fireCooldown: 0.7,
    color: role === 'medic' ? '#7cc9ff' : '#b9f0c9',
  };
}

function spawnAllies() {
  allies = [
    createAlly(player.x - 30, player.y + 20, 'Kilo', 'rifle'),
    createAlly(player.x + 35, player.y - 15, 'Mira', 'medic'),
  ];
}

function spawnPickups() {
  pickups = [
    { x: 320, y: 260, type: 'medkit', radius: 10 },
    { x: 980, y: 710, type: 'ammo', radius: 10 },
    { x: 1340, y: 520, type: 'medkit', radius: 10 },
  ];

  for (let i = 0; i < 2; i += 1) {
    pickups.push({
      x: randomRange(200, WORLD.width - 200),
      y: randomRange(200, WORLD.height - 200),
      type: i === 0 ? 'medkit' : 'ammo',
      radius: 10,
    });
  }
}

function spawnCover() {
  cover = [];
  const palette = BIOME_PALETTES[currentBiome] || BIOME_PALETTES.forest;
  const coverCount = currentBiome === 'urban' ? 12 : 8;

  for (let i = 0; i < coverCount; i += 1) {
    const x = 180 + Math.random() * (WORLD.width - 360);
    const y = 180 + Math.random() * (WORLD.height - 360);
    cover.push({
      x,
      y,
      w: 46 + Math.random() * 36,
      h: 46 + Math.random() * 36,
      health: currentBiome === 'urban' ? 110 : 90,
      maxHealth: currentBiome === 'urban' ? 110 : 90,
      color: palette.cover,
    });
  }
}

function triggerSquadStrike() {
  if (!player || player.skills.overdrive.cooldown > 0) return;

  const targetX = player.x + player.aimX * 180;
  const targetY = player.y + player.aimY * 180;

  for (const enemy of enemies) {
    if (distance(enemy, { x: targetX, y: targetY }) < 170) {
      enemy.health -= 34;
      createParticles(enemy.x, enemy.y, '#d8b5ff', 20);
    }
  }

  for (const ally of allies) {
    if (distance(ally, player) < 220) {
      ally.health = Math.min(ally.maxHealth, ally.health + 18);
    }
  }

  player.skills.overdrive.cooldown = player.skills.overdrive.maxCooldown;
  player.supportCooldown = 12;
  createParticles(targetX, targetY, '#c4a2ff', 16);
  pushFeed('Overdrive de l’équipe activé.');
}

function pushFeed(message, lifetime = 2.4) {
  feedMessages.push({ text: message, life: lifetime, maxLife: lifetime });
  feedMessages = feedMessages.slice(-4);
}

function setMissionBriefing() {
  const entries = {
    clear: `Objectif principal : nettoyer le secteur et sécuriser la zone.`,
    defend: `Objectif principal : tenir la position et repousser les assaillants.`,
    cache: `Objectif principal : récupérer la cargaison cachée avant l’exfiltration.`,
    exfil: `Objectif principal : atteindre le point d’extraction sans être repéré.`,
  };

  const text = entries[mission.type] || 'Mission active. Restez sur le front.';
  missionLog = missionLog.slice(-2);
  missionLog.push(text);
  briefingText.textContent = missionLog.join(' • ');
}

function setMissionType() {
  const options = ['clear', 'defend', 'cache', 'exfil', 'assault'];
  mission.type = options[Math.floor(Math.random() * options.length)];
  mission.phase = 0;
  missionLog = [];
  mission.done = false;

  if (mission.type === 'cache') {
    mission.cacheX = 760 + Math.random() * 420;
    mission.cacheY = 620 + Math.random() * 260;
  }

  if (mission.type === 'assault') {
    mission.clearGoal = 8 + wave + Math.floor(Math.random() * 5);
  }

  if (mission.type === 'defend') {
    mission.holdTimer = 10;
  }

  if (mission.type === 'clear') {
    mission.clearGoal = 7 + wave + Math.floor(Math.random() * 3);
  }

  setMissionBriefing();
}

function triggerScanPulse() {
  if (!player || player.skills.scan.cooldown > 0) return;

  mission.radarPulse = 1;
  for (const enemy of enemies) {
    if (distance(enemy, player) < 260) {
      enemy.health -= 10 + wave * 2;
    }
  }
  player.skills.scan.cooldown = player.skills.scan.maxCooldown;
  createParticles(player.x, player.y, '#9fe7ff', 16);
  pushFeed('Scan tactique : ennemis révélés.');
}

function triggerAirstrike() {
  if (!player || player.skills.airstrike.cooldown > 0) return;

  const blastCenter = {
    x: player.x + player.aimX * 260,
    y: player.y + player.aimY * 260,
  };

  for (const enemy of enemies) {
    if (distance(enemy, blastCenter) < 170) {
      enemy.health -= 50 + wave * 6;
      createParticles(enemy.x, enemy.y, '#d9c3ff', 18);
    }
  }

  player.skills.airstrike.cooldown = player.skills.airstrike.maxCooldown;
  createParticles(blastCenter.x, blastCenter.y, '#d9c3ff', 28);
  pushFeed('Appui aérien déclenché.');
}

function startNextMission() {
  if (missionCounter >= 5) {
    gameOver = true;
    messageTitle.textContent = 'Victoire';
    messageText.textContent = `Campagne terminée. Score final : ${score}. Mission accomplie avec ${kills} éliminations.`;
    restartBtn.textContent = 'Nouvelle campagne';
    messageBox.classList.remove('hidden');
    gameStarted = false;
    return;
  }

  missionCounter += 1;
  wave += 1;
  kills = 0;
  eventTimer = 10 + Math.random() * 8;
  player.x = WORLD.width / 2;
  player.y = WORLD.height / 2;
  player.health = Math.min(player.maxHealth, player.health + 20);
  player.armor = player.maxArmor;
  setMissionType();
  spawnWave();
  spawnAllies();
  spawnCover();
  spawnSupplyDrops();
  spawnPickups();
  missionValue.textContent = mission.type === 'clear'
    ? `Éliminer ${mission.clearGoal}`
    : mission.type === 'cache'
      ? 'Récupérez le cache sécurisé'
      : mission.type === 'defend'
        ? 'Défendez la zone'
        : mission.type === 'assault'
          ? `Éliminez ${mission.clearGoal}`
          : 'Trouvez le point d’extraction';
  messageBox.classList.add('hidden');
  gameOver = false;
  pushFeed(`Mission ${missionCounter} active.`);
}

function triggerRandomEvent() {
  const events = ['airstrike', 'reinforcements', 'supply'];
  const selected = events[Math.floor(Math.random() * events.length)];

  if (selected === 'airstrike') {
    for (const enemy of enemies) {
      if (distance(enemy, player) < 260) {
        enemy.health -= 18 + wave * 2;
      }
    }
    createParticles(player.x, player.y, '#d8b5ff', 24);
    messageText.textContent = 'Raid aérien : les ennemis sont sous le feu.';
    missionLog.push('Raid aérien sur les lignes ennemies.');
    briefingText.textContent = missionLog.slice(-3).join(' • ');
    messageBox.classList.remove('hidden');
  } else if (selected === 'reinforcements') {
    for (let i = 0; i < 2; i += 1) {
      const x = randomRange(40, WORLD.width - 40);
      const y = randomRange(40, WORLD.height - 40);
      const enemy = createEnemy(x, y);
      enemy.type = 'scout';
      enemy.maxHealth = 30 + wave * 6;
      enemy.health = enemy.maxHealth;
      enemy.weaponIndex = 0;
      enemy.speed += 20;
      enemies.push(enemy);
    }
    messageText.textContent = 'Renforts ennemis : préparez-vous au contact.';
    missionLog.push('Renforts ennemis détectés sur la zone.');
    briefingText.textContent = missionLog.slice(-3).join(' • ');
    messageBox.classList.remove('hidden');
  } else {
    player.health = Math.min(player.maxHealth, player.health + 18);
    player.armor = Math.min(player.maxArmor, player.armor + 10);
    player.weaponIndex = Math.min(player.weaponIndex + 1, 3);
    player.grenades += 1;
    createParticles(player.x, player.y, '#8de4bb', 20);
    messageText.textContent = 'Cache de ravitaillement trouvé : bonus de survie.';
    missionLog.push('Bonus de ravitaillement récupéré.');
    briefingText.textContent = missionLog.slice(-3).join(' • ');
    messageBox.classList.remove('hidden');
  }

  window.setTimeout(() => {
    messageBox.classList.add('hidden');
  }, 1200);
}

function throwGrenade() {
  if (player.grenades <= 0) return;

  player.grenades -= 1;
  grenades.push({
    x: player.x,
    y: player.y,
    vx: player.aimX * 350,
    vy: player.aimY * 350,
    radius: 7,
    life: 1.3,
    blastRadius: 90,
    blastDamage: 42,
    color: '#d7b4ff',
  });
}

function triggerGrenadeExplosion(grenade) {
  for (const enemy of enemies) {
    const d = distance(grenade, enemy);
    if (d < grenade.blastRadius + enemy.radius) {
      const falloff = 1 - d / (grenade.blastRadius + enemy.radius);
      enemy.health -= grenade.blastDamage * Math.max(0.2, falloff);
      createParticles(enemy.x, enemy.y, '#d7b4ff', 16);
    }
  }

  for (const barricade of cover) {
    const nearestX = Math.max(barricade.x, Math.min(grenade.x, barricade.x + barricade.w));
    const nearestY = Math.max(barricade.y, Math.min(grenade.y, barricade.y + barricade.h));
    const dist = Math.hypot(grenade.x - nearestX, grenade.y - nearestY);
    if (dist < grenade.blastRadius) {
      barricade.health -= grenade.blastDamage * 0.8;
    }
  }

  const playerDist = distance(grenade, player);
  if (playerDist < grenade.blastRadius + player.radius) {
    const falloff = 1 - playerDist / (grenade.blastRadius + player.radius);
    const incoming = grenade.blastDamage * Math.max(0.15, falloff);
    if (player.armor > 0) {
      const absorbed = Math.min(player.armor, incoming);
      player.armor -= absorbed;
      player.health -= incoming - absorbed;
    } else {
      player.health -= incoming;
    }
  }

  createParticles(grenade.x, grenade.y, grenade.color, 22);
}

function spawnTurrets() {
  turrets = [
    { x: 390, y: 170, radius: 18, health: 90, cooldown: 0, color: '#ffb36b' },
    { x: 920, y: 840, radius: 18, health: 110, cooldown: 0, color: '#ffb36b' },
    { x: 1450, y: 520, radius: 18, health: 100, cooldown: 0, color: '#ffb36b' },
  ];
}

function spawnSupplyDrops() {
  supplyDrops = [
    { x: 520, y: 350, type: 'medkit', radius: 12, active: true },
    { x: 1100, y: 520, type: 'ammo', radius: 12, active: true },
    { x: 1500, y: 820, type: 'weapon', radius: 12, active: true },
  ];
}

function spawnWave() {
  const count = 4 + wave * 2;
  enemies = [];

  const groupCount = Math.min(4 + wave, 7);
  const spawnCenters = [];

  for (let i = 0; i < groupCount; i += 1) {
    spawnCenters.push({
      x: randomRange(90, WORLD.width - 90),
      y: randomRange(90, WORLD.height - 90),
    });
  }

  const eliteChance = Math.min(0.34, 0.12 + wave * 0.02);

  for (let i = 0; i < count; i += 1) {
    const anchor = spawnCenters[i % spawnCenters.length];
    let x = anchor.x + randomRange(-80, 80);
    let y = anchor.y + randomRange(-80, 80);

    x = clamp(x, 50, WORLD.width - 50);
    y = clamp(y, 50, WORLD.height - 50);

    while (distance({ x, y }, player) < 250) {
      x = randomRange(60, WORLD.width - 60);
      y = randomRange(60, WORLD.height - 60);
    }

    const roll = Math.random();
    const enemy = createEnemy(x, y);
    enemy.type = roll < 0.48 ? 'scout' : roll < 0.78 ? 'gunner' : roll < 0.94 ? 'sniper' : 'brute';

    if (roll < eliteChance) {
      enemy.type = 'brute';
    }

    if (enemy.type === 'scout') {
      enemy.speed += 25;
      enemy.maxHealth = 28 + wave * 6;
      enemy.health = enemy.maxHealth;
      enemy.weaponIndex = 0;
    } else if (enemy.type === 'gunner') {
      enemy.maxHealth = 42 + wave * 8;
      enemy.health = enemy.maxHealth;
      enemy.weaponIndex = 1;
    } else if (enemy.type === 'sniper') {
      enemy.speed -= 10;
      enemy.maxHealth = 34 + wave * 7;
      enemy.health = enemy.maxHealth;
      enemy.weaponIndex = 3;
    } else {
      enemy.speed -= 20;
      enemy.maxHealth = 68 + wave * 10;
      enemy.health = enemy.maxHealth;
      enemy.weaponIndex = 2;
    }

    enemy.engageDistance = randomRange(130, 260);
    enemy.behaviorBias = Math.random() > 0.5 ? 1 : -1;

    if (currentBiome === 'urban') {
      enemy.speed += 10;
      enemy.maxHealth += 8;
      enemy.health = enemy.maxHealth;
    }

    enemies.push(enemy);
  }

  if (wave % 3 === 0) {
    const boss = createEnemy(80 + Math.random() * (WORLD.width - 160), 80 + Math.random() * (WORLD.height - 160));
    boss.type = 'boss';
    boss.radius = 26;
    boss.speed = 90;
    boss.maxHealth = 220 + wave * 30;
    boss.health = boss.maxHealth;
    boss.weaponIndex = 2;
    boss.isBoss = true;
    boss.engageDistance = 240;
    enemies.push(boss);
  }

  waveValue.textContent = String(wave);
}

function createParticles(x, y, color, amount = 15) {
  for (let i = 0; i < amount; i += 1) {
    particles.push({
      x,
      y,
      vx: randomRange(-110, 110),
      vy: randomRange(-110, 110),
      radius: randomRange(2, 5),
      life: randomRange(0.25, 0.8),
      maxLife: randomRange(0.25, 0.8),
      color,
    });
  }
}

function collidesWithObstacle(entity, offsetX, offsetY) {
  const margin = entity.radius + 4;
  const collisionTargets = [...obstacles, ...cover];

  for (const obstacle of collisionTargets) {
    const nearestX = clamp(entity.x + offsetX, obstacle.x - margin, obstacle.x + obstacle.w + margin);
    const nearestY = clamp(entity.y + offsetY, obstacle.y - margin, obstacle.y + obstacle.h + margin);

    const dx = nearestX - (entity.x + offsetX);
    const dy = nearestY - (entity.y + offsetY);

    if (Math.abs(dx) < margin && Math.abs(dy) < margin) {
      return true;
    }
  }

  return false;
}

function fireWeapon(from, targetX, targetY, shooterType = 'player', weaponIndex = 0) {
  const weapon = getWeapon(weaponIndex);
  const dx = targetX - from.x;
  const dy = targetY - from.y;
  const angle = Math.hypot(dx, dy) || 1;

  for (let i = 0; i < (weapon.pellets || 1); i += 1) {
    let dirX = dx / angle;
    let dirY = dy / angle;

    if ((weapon.pellets || 1) > 1) {
      const spread = randomRange(-weapon.spread, weapon.spread);
      const perpX = -dirY;
      const perpY = dirX;
      dirX = dirX * Math.cos(spread) + perpX * Math.sin(spread);
      dirY = dirY * Math.cos(spread) + perpY * Math.sin(spread);
    }

    bullets.push({
      x: from.x,
      y: from.y,
      vx: dirX * weapon.speed,
      vy: dirY * weapon.speed,
      radius: shooterType === 'player' ? 4 : 5,
      damage: weapon.damage,
      life: 1.4,
      team: shooterType,
      color: weapon.color,
    });
  }

  createParticles(from.x, from.y, weapon.color, shooterType === 'player' ? 5 : 7);
}

function updatePlayer(dt) {
  player.supportCooldown = Math.max(0, player.supportCooldown - dt);

  const weapon = getWeapon(player.weaponIndex);
  if (player.reloading) {
    player.reloadTimer -= dt;
    if (player.reloadTimer <= 0) {
      finishReload();
    }
  }

  if ((keys['KeyR'] || keys['KeyZ']) && !player.reloading && player.weaponAmmo < weapon.magazine) {
    startReload();
  }

  const moveX = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);
  const moveY = (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0) - (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0);

  const activeVehicle = vehicles.find((vehicle) => vehicle.occupiedByPlayer);

  const sprintBoost = (keys['ShiftLeft'] || keys['ShiftRight']) && !activeVehicle ? 1.35 : 1;

  if (activeVehicle) {
    const vehicleMoveX = moveX;
    const vehicleMoveY = moveY;
    const vNorm = Math.hypot(vehicleMoveX, vehicleMoveY) || 1;
    const nx = vehicleMoveX / vNorm;
    const ny = vehicleMoveY / vNorm;
    const step = activeVehicle.speed * dt;

    activeVehicle.x += nx * step;
    activeVehicle.y += ny * step;
    activeVehicle.x = clamp(activeVehicle.x, 60, WORLD.width - 60);
    activeVehicle.y = clamp(activeVehicle.y, 60, WORLD.height - 60);
    player.x = activeVehicle.x;
    player.y = activeVehicle.y;
  } else if (moveX !== 0 || moveY !== 0) {
    const norm = Math.hypot(moveX, moveY) || 1;
    const nx = moveX / norm;
    const ny = moveY / norm;
    const step = player.speed * dt * sprintBoost;

    if (!collidesWithObstacle(player, nx * step, 0)) {
      player.x += nx * step;
    }
    if (!collidesWithObstacle(player, 0, ny * step)) {
      player.y += ny * step;
    }
  }

  player.x = clamp(player.x, player.radius, WORLD.width - player.radius);
  player.y = clamp(player.y, player.radius, WORLD.height - player.radius);

  const camera = getCamera();
  const aimX = pointer.x + camera.x - player.x;
  const aimY = pointer.y + camera.y - player.y;
  const aimLength = Math.hypot(aimX, aimY) || 1;
  player.aimX = aimX / aimLength;
  player.aimY = aimY / aimLength;

  player.reload -= dt;
  if (pointer.down && player.reload <= 0 && !activeVehicle && !player.reloading) {
    const currentWeapon = getWeapon(player.weaponIndex);
    if (player.weaponAmmo <= 0) {
      startReload();
    } else {
      const targetX = player.x + player.aimX * currentWeapon.range;
      const targetY = player.y + player.aimY * currentWeapon.range;
      fireWeapon(player, targetX, targetY, 'player', player.weaponIndex);
      player.weaponAmmo -= 1;
      player.ammoState[currentWeapon.key] = player.weaponAmmo;
      player.reload = currentWeapon.fireRate;

      if (player.weaponAmmo <= 0) {
        startReload();
      }
    }
  }

  for (let i = pickups.length - 1; i >= 0; i -= 1) {
    const pickup = pickups[i];
    if (distance(player, pickup) < player.radius + pickup.radius + 8) {
      if (pickup.type === 'medkit') {
        player.health = Math.min(player.maxHealth, player.health + 28);
      } else {
        player.weaponIndex = Math.min(player.weaponIndex + 1, 3);
      }
      pickups.splice(i, 1);
    }
  }

  if (player.armor < player.maxArmor) {
    player.armor = Math.min(player.maxArmor, player.armor + dt * 0.8);
  }
}

function updateAllies(dt) {
  for (const ally of allies) {
    const dx = player.x - ally.x;
    const dy = player.y - ally.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (dist > 56) {
      ally.x += (dx / dist) * ally.speed * dt;
      ally.y += (dy / dist) * ally.speed * dt;
    }

    ally.fireCooldown -= dt;
    const allyTarget = enemies.reduce((closest, enemy) => {
      const d = distance(enemy, ally);
      if (!closest || d < closest.distance) {
        return { enemy, distance: d };
      }
      return closest;
    }, null);

    if (allyTarget && allyTarget.distance < 420 && ally.fireCooldown <= 0) {
      fireWeapon({ x: ally.x, y: ally.y }, allyTarget.enemy.x, allyTarget.enemy.y, 'ally', 0);
      ally.fireCooldown = 0.7;
    }

    if (allyTarget && allyTarget.distance < 170 && ally.role === 'medic') {
      const injuredAlly = allies.find((mate) => mate !== ally && mate.health < mate.maxHealth * 0.7);
      if (injuredAlly) {
        injuredAlly.health = Math.min(injuredAlly.maxHealth, injuredAlly.health + 8 * dt);
      }
    }
  }
}

function updateWeather(dt) {
  weatherTime += dt * 0.25;
}

function updateEnemies(dt) {
  for (const enemy of enemies) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const angle = Math.atan2(dy, dx);
    const weapon = getWeapon(enemy.weaponIndex);
    const desiredRange = enemy.engageDistance || 170;

    enemy.fireCooldown -= dt;
    enemy.strafeTimer -= dt;

    if (enemy.strafeTimer <= 0) {
      enemy.strafeDir *= -1;
      enemy.strafeTimer = randomRange(0.7, 1.8);
    }

    if (dist > desiredRange + 30) {
      enemy.x += Math.cos(angle) * enemy.speed * dt;
      enemy.y += Math.sin(angle) * enemy.speed * dt;
    } else if (dist < desiredRange - 30) {
      enemy.x -= Math.cos(angle) * enemy.speed * 0.85 * dt;
      enemy.y -= Math.sin(angle) * enemy.speed * 0.85 * dt;
    } else {
      enemy.x += Math.cos(angle + Math.PI / 2) * enemy.speed * enemy.strafeDir * 0.9 * dt;
      enemy.y += Math.sin(angle + Math.PI / 2) * enemy.speed * enemy.strafeDir * 0.9 * dt;
    }

    if (enemy.type === 'sniper' && dist < 360) {
      enemy.x += Math.cos(angle + Math.PI / 2) * enemy.speed * enemy.behaviorBias * 0.5 * dt;
      enemy.y += Math.sin(angle + Math.PI / 2) * enemy.speed * enemy.behaviorBias * 0.5 * dt;
    }

    enemy.x = clamp(enemy.x, enemy.radius, WORLD.width - enemy.radius);
    enemy.y = clamp(enemy.y, enemy.radius, WORLD.height - enemy.radius);

    if (dist < weapon.range + 35 && enemy.fireCooldown <= 0) {
      const targetX = player.x + randomRange(-14, 14);
      const targetY = player.y + randomRange(-14, 14);
      fireWeapon(enemy, targetX, targetY, 'enemy', enemy.weaponIndex);
      enemy.fireCooldown = weapon.fireRate + randomRange(0.15, 0.6);
    }
  }
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    if (
      bullet.x < 0 || bullet.x > WORLD.width ||
      bullet.y < 0 || bullet.y > WORLD.height ||
      bullet.life <= 0
    ) {
      bullets.splice(i, 1);
      continue;
    }

    let hitCover = false;
    for (const barricade of cover) {
      if (
        bullet.x >= barricade.x &&
        bullet.x <= barricade.x + barricade.w &&
        bullet.y >= barricade.y &&
        bullet.y <= barricade.y + barricade.h
      ) {
        barricade.health -= bullet.damage;
        createParticles(bullet.x, bullet.y, '#c4cbd0', 8);
        bullets.splice(i, 1);
        hitCover = true;
        break;
      }
    }
    if (hitCover) {
      for (let j = cover.length - 1; j >= 0; j -= 1) {
        if (cover[j].health <= 0) {
          cover.splice(j, 1);
        }
      }
      continue;
    }

    const targets = bullet.team === 'player' ? enemies : [player];
    let hit = false;

    for (const target of targets) {
      if (distance(bullet, target) < bullet.radius + target.radius) {
        if (bullet.team === 'player') {
          target.health -= bullet.damage;
          createParticles(target.x, target.y, '#ffd4a6', 10);
        } else {
          const incoming = bullet.damage;
          if (player.armor > 0) {
            const absorbed = Math.min(player.armor, incoming);
            player.armor -= absorbed;
            player.health -= incoming - absorbed;
          } else {
            player.health -= incoming;
          }
          createParticles(player.x, player.y, '#ff8a7a', 12);
        }
        bullets.splice(i, 1);
        hit = true;
        break;
      }
    }

    if (hit) continue;
  }
}

function updateGrenades(dt) {
  for (let i = grenades.length - 1; i >= 0; i -= 1) {
    const grenade = grenades[i];
    grenade.x += grenade.vx * dt;
    grenade.y += grenade.vy * dt;
    grenade.life -= dt;

    if (grenade.life <= 0 || grenade.x < 0 || grenade.x > WORLD.width || grenade.y < 0 || grenade.y > WORLD.height) {
      triggerGrenadeExplosion(grenade);
      grenades.splice(i, 1);
      continue;
    }

    for (const barricade of cover) {
      if (
        grenade.x >= barricade.x &&
        grenade.x <= barricade.x + barricade.w &&
        grenade.y >= barricade.y &&
        grenade.y <= barricade.y + barricade.h
      ) {
        triggerGrenadeExplosion(grenade);
        grenades.splice(i, 1);
        break;
      }
    }
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;

    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

function updateTurrets(dt) {
  for (const turret of turrets) {
    turret.cooldown -= dt;

    const nearestEnemy = enemies.reduce((closest, enemy) => {
      const d = distance(enemy, turret);
      if (!closest || d < closest.distance) {
        return { enemy, distance: d };
      }
      return closest;
    }, null);

    if (nearestEnemy && nearestEnemy.distance < 360 && turret.cooldown <= 0) {
      fireWeapon(turret, nearestEnemy.enemy.x, nearestEnemy.enemy.y, 'turret', 2);
      turret.cooldown = 1.3;
    }
  }
}

function updateSupplyDrops() {
  for (let i = supplyDrops.length - 1; i >= 0; i -= 1) {
    const drop = supplyDrops[i];
    if (!drop.active) continue;

    if (distance(player, drop) < 32) {
      if (drop.type === 'medkit') {
        player.health = Math.min(player.maxHealth, player.health + 30);
      } else if (drop.type === 'ammo') {
        player.weaponIndex = Math.min(player.weaponIndex + 1, 3);
      } else {
        player.weaponIndex = 3;
        player.health = Math.min(player.maxHealth, player.health + 20);
      }

      createParticles(drop.x, drop.y, '#ffe6a3', 18);
      supplyDrops.splice(i, 1);
    }
  }
}

function updateMissionState(dt) {
  mission.radarPulse = Math.max(0, mission.radarPulse - dt * 0.5);

  if (mission.type === 'clear' || mission.type === 'defend' || mission.type === 'assault') {
    if (mission.phase === 0) {
      const remaining = Math.max(0, mission.clearGoal - kills);
      missionValue.textContent = `Éliminer ${remaining}`;

      if (kills >= mission.clearGoal) {
        mission.phase = 1;
        missionValue.textContent = 'Récupérez le cache de ravitaillement';
        createParticles(mission.cacheX, mission.cacheY, '#8de4bb', 20);
      }
    } else if (mission.phase === 1 && !mission.done) {
      missionValue.textContent = 'Récupérez le cache de ravitaillement';

      if (distance(player, { x: mission.cacheX, y: mission.cacheY }) < 60) {
        mission.phase = 2;
        mission.holdTimer = 10;
        missionValue.textContent = 'Défendez la zone 10.0s';
        messageText.textContent = 'Cache sécurisé. Tenez la zone jusqu’à l’extraction.';
        messageBox.classList.remove('hidden');
      }
    } else if (mission.phase === 2 && !mission.done) {
      const enemiesNearCache = enemies.filter((enemy) => distance(enemy, { x: mission.cacheX, y: mission.cacheY }) < 220).length;
      mission.holdTimer = Math.max(0, mission.holdTimer - dt * (enemiesNearCache > 0 ? 1 : 0.5));
      missionValue.textContent = `Défendez la zone ${mission.holdTimer.toFixed(1)}s`;

      if (mission.holdTimer <= 0) {
        mission.phase = 3;
        missionValue.textContent = 'Montez dans un véhicule';
        createParticles(mission.extractionX, mission.extractionY, '#8de4bb', 24);
      }
    } else if (!mission.done) {
      const vehicle = vehicles.find((item) => item.occupiedByPlayer);
      missionValue.textContent = vehicle ? 'Évacuez vers le point de sortie' : 'Montez dans un véhicule';

      if (distance(player, { x: mission.extractionX, y: mission.extractionY }) < 90 && vehicle) {
        mission.done = true;
        score += 180 + wave * 20;
        messageText.textContent = `Mission réussie ! Nouvelle mission en cours...`;
        messageBox.classList.remove('hidden');
        window.setTimeout(() => {
          startNextMission();
        }, 1200);
      }
    }
  } else if (mission.type === 'cache') {
    missionValue.textContent = 'Récupérez le cache sécurisé';
    if (distance(player, { x: mission.cacheX, y: mission.cacheY }) < 60) {
      mission.phase = 1;
      score += 75;
      missionValue.textContent = 'Exfiltrez par le point d’évacuation';
    }

    if (mission.phase === 1 && !mission.done) {
      const vehicle = vehicles.find((item) => item.occupiedByPlayer);
      if (distance(player, { x: mission.extractionX, y: mission.extractionY }) < 90 && vehicle) {
        mission.done = true;
        score += 180 + wave * 20;
        messageText.textContent = `Mission réussie ! Nouvelle mission en cours...`;
        messageBox.classList.remove('hidden');
        window.setTimeout(() => {
          startNextMission();
        }, 1200);
      }
    }
  } else if (mission.type === 'exfil') {
    missionValue.textContent = 'Trouvez le point d’extraction';
    if (distance(player, { x: mission.extractionX, y: mission.extractionY }) < 90) {
      mission.done = true;
      score += 180 + wave * 20;
        startNextMission();
      }, 1200);
    }
  }
}

function updateGameplay(dt) {
  if (!gameStarted) return;

  if (player.health <= 0) {
    gameOver = true;
    gameStarted = false;
    messageTitle.textContent = 'Défaite';
    messageText.textContent = `Mission perdue. Score final : ${score}. La ligne de front a cédé.`;
    restartBtn.textContent = 'Recommencer';
    messageBox.classList.remove('hidden');
    return;
  }

  for (let i = feedMessages.length - 1; i >= 0; i -= 1) {
    feedMessages[i].life -= dt;
    if (feedMessages[i].life <= 0) {
      feedMessages.splice(i, 1);
    }
  }

  for (const skill of Object.values(player.skills)) {
    skill.cooldown = Math.max(0, skill.cooldown - dt);
  }
  player.supportCooldown = Math.max(0, player.supportCooldown - dt);

  eventTimer -= dt;
  if (eventTimer <= 0) {
    triggerRandomEvent();
    eventTimer = 12 + Math.random() * 10;
  }

  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const enemy = enemies[i];
    if (enemy.health <= 0) {
      score += 25;
      kills += 1;
      createParticles(enemy.x, enemy.y, '#ffe7a3', 18);
      enemies.splice(i, 1);
    }
  }

  if (enemies.length === 0 && !mission.done && mission.phase < 3) {
    wave += 1;
    spawnWave();
  }

  updateMissionState(dt);
  updateAllies(dt);

  healthValue.textContent = String(Math.max(0, Math.ceil(player.health)));
  scoreValue.textContent = String(score);
  waveValue.textContent = String(wave);
  weaponValue.textContent = getWeapon(player.weaponIndex).label;
  updateSkillHUD();
}

function drawTileGround() {
  const camera = getCamera();
  const palette = BIOME_PALETTES[currentBiome] || BIOME_PALETTES.forest;
  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  for (let y = 0; y < WORLD.height; y += 80) {
    for (let x = 0; x < WORLD.width; x += 80) {
      const variant = (Math.sin(x * 0.05) + Math.cos(y * 0.04) + 2) / 4;
      ctx.fillStyle = variant < 0.5 ? palette.groundA : palette.groundB;
      ctx.fillRect(x, y, 80, 80);
      ctx.fillStyle = 'rgba(255,255,255,0.02)';
      ctx.fillRect(x + 10, y + 10, 10, 10);
    }
  }

  for (let i = 0; i < 90; i += 1) {
    const x = randomRange(0, WORLD.width);
    const y = randomRange(0, WORLD.height);
    ctx.fillStyle = currentBiome === 'snow' ? 'rgba(255,255,255,0.12)' : 'rgba(130, 197, 124, 0.08)';
    ctx.fillRect(x, y, 6, 6);
  }

  ctx.restore();
}

function drawObstacles() {
  const camera = getCamera();
  const palette = BIOME_PALETTES[currentBiome] || BIOME_PALETTES.forest;

  for (const obstacle of obstacles) {
    const x = obstacle.x - camera.x;
    const y = obstacle.y - camera.y;

    ctx.fillStyle = obstacle.color || palette.obstacle;
    ctx.fillRect(x, y, obstacle.w, obstacle.h);

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.strokeRect(x, y, obstacle.w, obstacle.h);

    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(x + 12, y + 12, obstacle.w - 24, 10);
  }
}

function drawPlayer() {
  const camera = getCamera();
  const angle = Math.atan2(player.aimY, player.aimX);
  const hpRatio = clamp(player.health / player.maxHealth, 0, 1);
  drawCharacterModel(player.x - camera.x, player.y - camera.y, '#223a31', '#8de4bb', hpRatio, 'YOU', angle);
}

function drawCharacterModel(x, y, bodyColor, accentColor, hpRatio, label, facingAngle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(facingAngle);

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 18, 16, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1d2321';
  ctx.fillRect(-8, 10, 16, 18);
  ctx.fillRect(-3, -6, 6, 8);

  ctx.fillStyle = bodyColor;
  ctx.fillRect(-11, -2, 22, 20);
  ctx.beginPath();
  ctx.arc(0, -12, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f4d3b1';
  ctx.beginPath();
  ctx.arc(0, -12, 6.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1b1d1f';
  ctx.fillRect(-3, -14, 2, 2);
  ctx.fillRect(1, -14, 2, 2);
  ctx.beginPath();
  ctx.moveTo(-3, -9);
  ctx.lineTo(3, -9);
  ctx.strokeStyle = '#2f2f2f';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = accentColor;
  ctx.fillRect(11, 1, 15, 5);
  ctx.fillRect(-26, 2, 15, 5);

  ctx.fillStyle = '#1a1b1f';
  ctx.fillRect(-14, 6, 5, 18);
  ctx.fillRect(9, 6, 5, 18);

  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(-22, -28, 44, 5);
  ctx.fillStyle = '#7fe3a0';
  ctx.fillRect(-22, -28, 44 * hpRatio, 5);

  if (label) {
    ctx.fillStyle = '#edf7ef';
    ctx.font = '10px Segoe UI';
    ctx.fillText(label, -12, -36);
  }

  ctx.restore();
}

function drawEnemies() {
  const camera = getCamera();

  for (const enemy of enemies) {
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    const hpRatio = clamp(enemy.health / enemy.maxHealth, 0, 1);
    const x = enemy.x - camera.x;
    const y = enemy.y - camera.y;
    drawCharacterModel(x, y, '#3b2d2e', '#ff8b6d', hpRatio, '', angle);

    if (enemy.isBoss) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x - 28, y - 42, 56, 6);
      ctx.fillStyle = '#ff8b6d';
      ctx.fillRect(x - 28, y - 42, 56 * hpRatio, 6);
    }
  }
}

function drawBullets() {
  const camera = getCamera();

  for (const bullet of bullets) {
    ctx.save();
    ctx.fillStyle = bullet.color;
    ctx.shadowColor = bullet.color;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(bullet.x - camera.x, bullet.y - camera.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawGrenades() {
  const camera = getCamera();

  for (const grenade of grenades) {
    const x = grenade.x - camera.x;
    const y = grenade.y - camera.y;
    ctx.save();
    ctx.fillStyle = '#d7b4ff';
    ctx.beginPath();
    ctx.arc(x, y, grenade.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawVehicles() {
  const camera = getCamera();

  for (const vehicle of vehicles) {
    const x = vehicle.x - camera.x;
    const y = vehicle.y - camera.y;
    const occupied = vehicle.occupiedByPlayer ? '#9bf0c2' : '#d9d9d9';

    ctx.save();
    ctx.fillStyle = '#232724';
    ctx.fillRect(x - vehicle.w / 2, y - vehicle.h / 2, vehicle.w, vehicle.h);
    ctx.fillStyle = vehicle.color;
    ctx.fillRect(x - vehicle.w / 2 + 8, y - vehicle.h / 2 + 5, vehicle.w - 16, vehicle.h - 10);
    ctx.fillStyle = occupied;
    ctx.fillRect(x - vehicle.w / 2 + 16, y - vehicle.h / 2 + 8, vehicle.w - 32, 10);
    ctx.fillStyle = '#111';
    ctx.fillRect(x - vehicle.w / 2 + 8, y - vehicle.h / 2 + 2, 6, 6);
    ctx.fillRect(x + vehicle.w / 2 - 14, y - vehicle.h / 2 + 2, 6, 6);
    ctx.fillRect(x - vehicle.w / 2 + 8, y + vehicle.h / 2 - 8, 6, 6);
    ctx.fillRect(x + vehicle.w / 2 - 14, y + vehicle.h / 2 - 8, 6, 6);
    ctx.restore();
  }
}

function drawWeather() {
  const daylight = (Math.sin(weatherTime) + 1) / 2;
  const overlayAlpha = 0.08 + (1 - daylight) * 0.2;

  ctx.fillStyle = `rgba(33, 54, 70, ${overlayAlpha})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (Math.sin(weatherTime * 2) > 0.2) {
    ctx.fillStyle = 'rgba(190, 210, 255, 0.05)';
    for (let i = 0; i < 18; i += 1) {
      const x = ((i * 83 + weatherTime * 60) % (canvas.width + 80)) - 40;
      const y = (i * 53) % canvas.height;
      ctx.fillRect(x, y, 2, 12);
    }
  }
}

function drawCover() {
  const camera = getCamera();
  const palette = BIOME_PALETTES[currentBiome] || BIOME_PALETTES.forest;

  for (const barricade of cover) {
    const x = barricade.x - camera.x;
    const y = barricade.y - camera.y;
    const ratio = clamp(barricade.health / barricade.maxHealth, 0, 1);

    ctx.fillStyle = barricade.color || palette.cover;
    ctx.fillRect(x, y, barricade.w, barricade.h);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x, y, barricade.w, barricade.h);
    ctx.fillStyle = currentBiome === 'snow' ? '#f3fbff' : '#9bb0a5';
    ctx.fillRect(x + 4, y + 4, (barricade.w - 8) * ratio, 8);
  }
}

function drawTurrets() {
  const camera = getCamera();

  for (const turret of turrets) {
    const x = turret.x - camera.x;
    const y = turret.y - camera.y;

    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#2a2d2c';
    ctx.fillRect(-12, -12, 24, 24);
    ctx.fillStyle = '#ffb36b';
    ctx.fillRect(-8, -8, 16, 16);
    ctx.restore();
  }
}

function drawSupplyDrops() {
  const camera = getCamera();

  for (const drop of supplyDrops) {
    const x = drop.x - camera.x;
    const y = drop.y - camera.y;
    const pulse = 1 + Math.sin(performance.now() * 0.01 + drop.x) * 0.2;

    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = drop.type === 'medkit' ? '#73e6ad' : drop.type === 'ammo' ? '#ffd76e' : '#d7a1ff';
    ctx.beginPath();
    ctx.arc(0, 0, drop.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.fillRect(-2, -8, 4, 16);
    ctx.fillRect(-8, -2, 16, 4);
    ctx.restore();
  }
}

function drawPickups() {
  const camera = getCamera();

  for (const pickup of pickups) {
    const x = pickup.x - camera.x;
    const y = pickup.y - camera.y;
    const pulse = 1 + Math.sin(performance.now() * 0.01 + pickup.x) * 0.12;

    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = pickup.type === 'medkit' ? '#78e5a2' : '#ffd877';
    ctx.beginPath();
    ctx.arc(0, 0, pickup.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0d1712';
    ctx.fillRect(-2, -7, 4, 14);
    ctx.fillRect(-7, -2, 14, 4);
    ctx.restore();
  }
}

function drawAllies() {
  const camera = getCamera();

  for (const ally of allies) {
    const x = ally.x - camera.x;
    const y = ally.y - camera.y;
    const angle = Math.atan2(player.y - ally.y, player.x - ally.x);
    drawCharacterModel(x, y, '#243f34', ally.color, clamp(ally.health / ally.maxHealth, 0, 1), ally.label, angle);
  }
}

function drawParticles() {
  const camera = getCamera();

  for (const p of particles) {
    const alpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = hexToRgba(p.color, alpha);
    ctx.fillRect(p.x - camera.x, p.y - camera.y, p.radius * 2, p.radius * 2);
  }
}

function drawReticle() {
  const x = pointer.x;
  const y = pointer.y;

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(x, y, 11, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 16, y);
  ctx.lineTo(x + 16, y);
  ctx.moveTo(x, y - 16);
  ctx.lineTo(x, y + 16);
  ctx.stroke();
  ctx.restore();
}

function drawMinimap() {
  const mapW = 180;
  const mapH = 120;
  const x = canvas.width - mapW - 18;
  const y = 18;

  ctx.fillStyle = 'rgba(10, 16, 14, 0.7)';
  ctx.fillRect(x, y, mapW, mapH);
  ctx.strokeStyle = 'rgba(180, 220, 200, 0.8)';
  ctx.strokeRect(x, y, mapW, mapH);

  const px = x + (player.x / WORLD.width) * mapW;
  const py = y + (player.y / WORLD.height) * mapH;
  ctx.fillStyle = '#88f5b7';
  ctx.beginPath();
  ctx.arc(px, py, 4, 0, Math.PI * 2);
  ctx.fill();

  for (const enemy of enemies) {
    const ex = x + (enemy.x / WORLD.width) * mapW;
    const ey = y + (enemy.y / WORLD.height) * mapH;
    ctx.fillStyle = '#ff8f70';
    ctx.fillRect(ex - 2, ey - 2, 4, 4);
  }

  const mx = x + (mission.extractionX / WORLD.width) * mapW;
  const my = y + (mission.extractionY / WORLD.height) * mapH;
  ctx.fillStyle = '#f5d066';
  ctx.fillRect(mx - 3, my - 3, 6, 6);
}

function drawMissionMarker() {
  const camera = getCamera();

  if (mission.phase > 0 && mission.phase < 3) {
    const cacheX = mission.cacheX - camera.x;
    const cacheY = mission.cacheY - camera.y;
    const pulse = 1 + Math.sin(performance.now() * 0.008) * 0.2;

    ctx.save();
    ctx.translate(cacheX, cacheY);
    ctx.strokeStyle = 'rgba(140, 255, 175, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 22 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#66e4a5';
    ctx.fillRect(-8, -8, 16, 16);
    ctx.restore();
  }

  if (mission.phase >= 3 || mission.phase === 1) {
    const x = mission.extractionX - camera.x;
    const y = mission.extractionY - camera.y;
    const pulse = 1 + Math.sin(performance.now() * 0.008) * 0.2;

    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = 'rgba(255, 221, 120, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 24 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f5d066';
    ctx.fillRect(-10, -10, 20, 20);
    ctx.restore();
  }
}

function drawWeaponPanel() {
  const weapon = getWeapon(player.weaponIndex);
  const ammoText = player.reloading ? 'Reloading...' : `${player.weaponAmmo}/${weapon.magazine}`;
  ctx.fillStyle = 'rgba(6, 13, 11, 0.7)';
  ctx.fillRect(18, canvas.height - 54, 300, 36);
  ctx.strokeStyle = 'rgba(170, 220, 185, 0.5)';
  ctx.strokeRect(18, canvas.height - 54, 300, 36);
  ctx.fillStyle = '#ebf9ef';
  ctx.font = '16px Segoe UI';
  ctx.fillText(`${weapon.label} • ${weapon.damage} dmg • ${ammoText}`, 28, canvas.height - 29);

  if (feedMessages.length > 0) {
    ctx.font = '12px Segoe UI';
    ctx.fillStyle = 'rgba(228, 245, 236, 0.9)';
    for (let i = 0; i < feedMessages.length; i += 1) {
      const y = canvas.height - 88 - i * 18;
      const alpha = clamp(feedMessages[i].life / feedMessages[i].maxLife, 0, 1);
      ctx.fillStyle = `rgba(228, 245, 236, ${alpha})`;
      ctx.fillText(feedMessages[i].text, 28, y);
    }
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawTileGround();
  drawObstacles();
  drawVehicles();
  drawPickups();
  drawBullets();
  drawGrenades();
  drawParticles();
  drawAllies();
  drawCover();
  drawTurrets();
  drawSupplyDrops();
  drawEnemies();
  drawPlayer();
  drawMissionMarker();
  drawWeather();
  drawMinimap();
  drawReticle();
  drawWeaponPanel();
}

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000 || 0.016, 0.03);
  lastTime = timestamp;

  if (!gameOver) {
    updateWeather(dt);
    updatePlayer(dt);
    updateEnemies(dt);
    updateTurrets(dt);
    updateBullets(dt);
    updateGrenades(dt);
    updateParticles(dt);
    updateSupplyDrops();
    updateGameplay(dt);
  }

  render();
  requestAnimationFrame(gameLoop);
}

function resetGame() {
  player = createPlayer();
  bullets = [];
  particles = [];
  pickups = [];
  vehicles = [];
  turrets = [];
  supplyDrops = [];
  cover = [];
  grenades = [];
  score = 0;
  wave = 1;
  kills = 0;
  missionCounter = 1;
  eventTimer = 12;
  weatherTime = 0;
  mission = {
    phase: 0,
    type: 'clear',
    clearGoal: 7,
    extractionX: 1600,
    extractionY: 200,
    cacheX: 980,
    cacheY: 720,
    holdTimer: 0,
    radarPulse: 0,
    done: false,
  };
  gameOver = false;
  gameStarted = true;
  messageBox.classList.add('hidden');

  buildWorld();
  setMissionType();
  spawnWave();
  spawnAllies();
  spawnVehicles();
  spawnTurrets();
  spawnSupplyDrops();
  spawnPickups();
  spawnCover();

  healthValue.textContent = '100';
  scoreValue.textContent = '0';
  waveValue.textContent = '1';
  weaponValue.textContent = getWeapon(player.weaponIndex).label;
  missionValue.textContent = mission.type === 'clear'
    ? `Éliminer ${mission.clearGoal}`
    : mission.type === 'cache'
      ? 'Récupérez le cache sécurisé'
      : mission.type === 'defend'
        ? 'Défendez la zone'
        : mission.type === 'assault'
          ? `Éliminez ${mission.clearGoal}`
          : 'Trouvez le point d’extraction';
  briefingText.textContent = 'Mission de reconnaissance. Avant-garde en route.';
  updateSkillHUD();
  pushFeed('Nouvelle mission active.');
}

function switchWeaponByKey(code) {
  const mapping = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 };
  if (mapping[code] !== undefined && player) {
    const nextIndex = mapping[code];
    player.weaponIndex = nextIndex;
    const weapon = getWeapon(nextIndex);
    player.weaponAmmo = player.ammoState[weapon.key] ?? weapon.magazine;
    player.reloading = false;
    player.reloadTimer = 0;
    messageBox.classList.add('hidden');
  }
}

window.addEventListener('keydown', (event) => {
  const code = event.code || event.key;
  if (!code) return;

  if (MOVEMENT_KEYS.has(code) || WEAPON_KEYS.has(code) || ['KeyQ', 'KeyG', 'KeyH', 'KeyF', 'KeyE'].includes(code)) {
    event.preventDefault();
  }

  keys[code] = true;
  switchWeaponByKey(code);

  if (code === 'KeyQ') {
    triggerSquadStrike();
  }

  if (code === 'KeyG') {
    throwGrenade();
  }

  if (code === 'KeyH') {
    triggerScanPulse();
  }

  if (code === 'KeyF') {
    triggerAirstrike();
  }

  if (code === 'KeyE') {
    const nearestVehicle = vehicles.find((vehicle) => distance(player, vehicle) < 55);
    if (nearestVehicle) {
      const isInside = nearestVehicle.occupiedByPlayer;
      for (const vehicle of vehicles) {
        vehicle.occupiedByPlayer = false;
      }
      nearestVehicle.occupiedByPlayer = !isInside;
      if (!nearestVehicle.occupiedByPlayer) {
        player.x = nearestVehicle.x + 24;
        player.y = nearestVehicle.y + 12;
      }
    }
  }
});

window.addEventListener('keyup', (event) => {
  const code = event.code || event.key;
  if (code) {
    keys[code] = false;
  }
});

window.addEventListener('blur', () => {
  Object.keys(keys).forEach((key) => {
    keys[key] = false;
  });
});

canvas.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  pointer.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
});

canvas.addEventListener('mousedown', () => {
  pointer.down = true;
});

window.addEventListener('mouseup', () => {
  pointer.down = false;
});

restartBtn.addEventListener('click', () => {
  if (!gameStarted || gameOver) {
    resetGame();
    return;
  }
  resetGame();
});

window.__GAME__ = {
  getState: () => ({
    x: player?.x ?? 0,
    y: player?.y ?? 0,
    weaponIndex: player?.weaponIndex ?? 0,
    health: player?.health ?? 0,
    armor: player?.armor ?? 0,
    keys: { ...keys },
    mission: mission.type,
  }),
  setWeapon: (index) => {
    if (player) {
      player.weaponIndex = clamp(Number(index) || 0, 0, 3);
    }
  },
  reset: resetGame,
};

function showTitleScreen() {
  gameStarted = false;
  gameOver = false;
  messageTitle.textContent = 'Frontline Assault';
  messageText.innerHTML = 'Déclenchez l’assaut.<br><span class="small-note">Q = Overdrive • H = Scan • F = Appui aérien</span>';
  restartBtn.textContent = 'Démarrer';
  messageBox.classList.remove('hidden');
}

showTitleScreen();
requestAnimationFrame(gameLoop);
