import { getWeapon } from '../systems/Weapons.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 17;
    this.speed = 260;
    this.maxHealth = 100;
    this.health = 100;
    this.maxArmor = 30;
    this.armor = 30;
    this.aimX = 1;
    this.aimY = 0;
    this.reload = 0;
    this.weaponIndex = 0;
    this.supportCooldown = 0;
    this.grenades = 3;
    this.ammoState = { rifle: 30, shotgun: 8, smg: 45, sniper: 6 };
    this.weaponAmmo = 30;
    this.reloading = false;
    this.reloadTimer = 0;
  }

  updateAim(pointer, camera) {
    const aimX = pointer.x + camera.x - this.x;
    const aimY = pointer.y + camera.y - this.y;
    const length = Math.hypot(aimX, aimY) || 1;
    this.aimX = aimX / length;
    this.aimY = aimY / length;
  }

  move(dx, dy, world, dt) {
    const step = this.speed * dt;

    if (dx !== 0 || dy !== 0) {
      const norm = Math.hypot(dx, dy) || 1;
      const nx = dx / norm;
      const ny = dy / norm;

      if (!world.collidesCircle(this.x + nx * step, this.y, this.radius)) {
        this.x += nx * step;
      }
      if (!world.collidesCircle(this.x, this.y + ny * step, this.radius)) {
        this.y += ny * step;
      }
    }

    this.x = Math.min(Math.max(this.x, this.radius), world.width - this.radius);
    this.y = Math.min(Math.max(this.y, this.radius), world.height - this.radius);
  }

  fire(targetX, targetY, bullets, shooterType = 'player') {
    const weapon = getWeapon(this.weaponIndex);
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const length = Math.hypot(dx, dy) || 1;

    for (let i = 0; i < (weapon.pellets || 1); i += 1) {
      let dirX = dx / length;
      let dirY = dy / length;

      if ((weapon.pellets || 1) > 1) {
        const spread = Math.random() * (weapon.spread * 2) - weapon.spread;
        const perpX = -dirY;
        const perpY = dirX;
        dirX = dirX * Math.cos(spread) + perpX * Math.sin(spread);
        dirY = dirY * Math.cos(spread) + perpY * Math.sin(spread);
      }

      bullets.push({
        x: this.x,
        y: this.y,
        vx: dirX * weapon.speed,
        vy: dirY * weapon.speed,
        radius: shooterType === 'player' ? 4 : 5,
        damage: weapon.damage,
        life: 1.4,
        team: shooterType,
        color: weapon.color,
      });
    }

    return weapon;
  }

  draw(ctx, camera) {
    const angle = Math.atan2(this.aimY, this.aimX);

    ctx.save();
    ctx.translate(this.x - camera.x, this.y - camera.y);

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 18, 18, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(angle);
    ctx.fillStyle = '#dfe9e5';
    ctx.fillRect(12, -2.5, 17, 5);
    ctx.fillStyle = getWeapon(this.weaponIndex).color;
    ctx.fillRect(8, -5, 18, 10);
    ctx.restore();

    ctx.fillStyle = '#1d2c28';
    ctx.beginPath();
    ctx.arc(this.x - camera.x, this.y - camera.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#8de4bb';
    ctx.beginPath();
    ctx.arc(this.x - camera.x, this.y - camera.y, this.radius * 0.78, 0, Math.PI * 2);
    ctx.fill();

    const hpRatio = Math.min(Math.max(this.health / this.maxHealth, 0), 1);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(this.x - camera.x - 24, this.y - camera.y - 30, 48, 6);
    ctx.fillStyle = '#78e5a2';
    ctx.fillRect(this.x - camera.x - 24, this.y - camera.y - 30, 48 * hpRatio, 6);
  }
}
