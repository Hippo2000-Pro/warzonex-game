import { getWeapon } from '../systems/Weapons.js';

export class Enemy {
  constructor(x, y, wave) {
    const enemyKind = Math.random();
    let weaponIndex = 0;

    if (enemyKind > 0.8) weaponIndex = 1;
    else if (enemyKind > 0.52) weaponIndex = 2;
    else if (enemyKind > 0.18) weaponIndex = 3;

    this.x = x;
    this.y = y;
    this.radius = 16;
    this.speed = 65 + Math.random() * 45 + wave * 6;
    this.maxHealth = 36 + wave * 7;
    this.health = this.maxHealth;
    this.weaponIndex = weaponIndex;
    this.fireCooldown = Math.random() * 0.8 + 0.4;
    this.strafeDir = Math.random() > 0.5 ? 1 : -1;
    this.strafeTimer = Math.random() * 1.1 + 0.7;
  }

  update(dt, player, world, bullets) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const angle = Math.atan2(dy, dx);
    const weapon = getWeapon(this.weaponIndex);

    this.fireCooldown -= dt;
    this.strafeTimer -= dt;

    if (this.strafeTimer <= 0) {
      this.strafeDir *= -1;
      this.strafeTimer = Math.random() * 1.1 + 0.7;
    }

    if (dist > weapon.range * 0.8) {
      this.x += Math.cos(angle) * this.speed * dt;
      this.y += Math.sin(angle) * this.speed * dt;
    } else if (dist < weapon.range * 0.4) {
      this.x -= Math.cos(angle) * this.speed * 0.8 * dt;
      this.y -= Math.sin(angle) * this.speed * 0.8 * dt;
    } else {
      this.x += Math.cos(angle + Math.PI / 2) * this.speed * this.strafeDir * 0.7 * dt;
      this.y += Math.sin(angle + Math.PI / 2) * this.speed * this.strafeDir * 0.7 * dt;
    }

    this.x = Math.min(Math.max(this.x, this.radius), world.width - this.radius);
    this.y = Math.min(Math.max(this.y, this.radius), world.height - this.radius);

    if (dist < weapon.range + 35 && this.fireCooldown <= 0) {
      const targetX = player.x + (Math.random() - 0.5) * 20;
      const targetY = player.y + (Math.random() - 0.5) * 20;
      this.fire(targetX, targetY, bullets, 'enemy');
      this.fireCooldown = weapon.fireRate + Math.random() * 0.45 + 0.15;
    }
  }

  fire(targetX, targetY, bullets, shooterType = 'enemy') {
    const weapon = getWeapon(this.weaponIndex);
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const length = Math.hypot(dx, dy) || 1;

    for (let i = 0; i < (weapon.pellets || 1); i += 1) {
      let dirX = dx / length;
      let dirY = dy / length;

      if ((weapon.pellets || 1) > 1) {
        const spread = (Math.random() * 2 - 1) * weapon.spread;
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
  }

  draw(ctx, camera, player) {
    const angle = Math.atan2(player.y - this.y, player.x - this.x);
    const hpRatio = Math.min(Math.max(this.health / this.maxHealth, 0), 1);

    ctx.save();
    ctx.translate(this.x - camera.x, this.y - camera.y);

    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 18, 18, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle = '#e3e8e4';
    ctx.fillRect(9, -2, 14, 4);
    ctx.restore();

    ctx.fillStyle = '#382c2b';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff8b6d';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.72, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-22, -28, 44, 5);
    ctx.fillStyle = '#ffc16d';
    ctx.fillRect(-22, -28, 44 * hpRatio, 5);

    ctx.restore();
  }
}
