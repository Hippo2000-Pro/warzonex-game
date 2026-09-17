export class World {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.obstacles = [];
    this.extraction = { x: 1600, y: 200 };
    this.generate();
  }

  generate() {
    this.obstacles = [];

    const buildingConfigs = [
      { w: 110, h: 80, color: '#2f3d38' },
      { w: 120, h: 100, color: '#364c45' },
      { w: 90, h: 70, color: '#2a3a35' },
      { w: 140, h: 70, color: '#32443f' },
    ];

    const roadSegments = [
      { x: 260, y: 0, w: 120, h: this.height },
      { x: 760, y: 0, w: 120, h: this.height },
      { x: 1250, y: 0, w: 120, h: this.height },
      { x: 0, y: 260, w: this.width, h: 110 },
      { x: 0, y: 720, w: this.width, h: 110 },
    ];

    for (const segment of roadSegments) {
      this.obstacles.push({
        x: segment.x,
        y: segment.y,
        w: segment.w,
        h: segment.h,
        color: '#2d2d2d',
        type: 'road',
      });
    }

    const count = 16;
    for (let i = 0; i < count; i += 1) {
      const config = buildingConfigs[i % buildingConfigs.length];
      const w = config.w + Math.random() * 40;
      const h = config.h + Math.random() * 40;
      const x = 140 + Math.random() * (this.width - 260 - w);
      const y = 140 + Math.random() * (this.height - 260 - h);

      if (Math.hypot(x + w / 2 - this.width / 2, y + h / 2 - this.height / 2) < 180) {
        continue;
      }

      this.obstacles.push({
        x,
        y,
        w,
        h,
        color: config.color,
        type: 'building',
      });
    }

    const wallCount = 15;
    for (let i = 0; i < wallCount; i += 1) {
      const orientation = Math.random() > 0.5 ? 'horizontal' : 'vertical';
      const wall = orientation === 'horizontal'
        ? { x: 130 + Math.random() * (this.width - 260), y: 120 + Math.random() * (this.height - 240), w: 90 + Math.random() * 100, h: 18 }
        : { x: 130 + Math.random() * (this.width - 240), y: 120 + Math.random() * (this.height - 240), w: 18, h: 90 + Math.random() * 110 };

      this.obstacles.push({
        ...wall,
        color: '#4b5753',
        type: 'wall',
      });
    }
  }

  collidesCircle(x, y, radius) {
    for (const obstacle of this.obstacles) {
      const nearestX = Math.min(Math.max(x, obstacle.x - radius), obstacle.x + obstacle.w + radius);
      const nearestY = Math.min(Math.max(y, obstacle.y - radius), obstacle.y + obstacle.h + radius);
      const dx = nearestX - x;
      const dy = nearestY - y;
      if (Math.abs(dx) < radius && Math.abs(dy) < radius) {
        return true;
      }
    }
    return false;
  }

  drawGround(ctx, camera) {
    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    for (let y = 0; y < this.height; y += 80) {
      for (let x = 0; x < this.width; x += 80) {
        const variant = (Math.sin(x * 0.05) + Math.cos(y * 0.04) + 2) / 4;
        ctx.fillStyle = variant < 0.5 ? '#173625' : '#213d2d';
        ctx.fillRect(x, y, 80, 80);
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(x + 10, y + 10, 10, 10);
      }
    }

    ctx.fillStyle = '#4a4d4a';
    ctx.fillRect(230, 0, 140, this.height);
    ctx.fillRect(730, 0, 140, this.height);
    ctx.fillRect(1220, 0, 140, this.height);
    ctx.fillRect(0, 230, this.width, 120);
    ctx.fillRect(0, 700, this.width, 120);

    for (let i = 0; i < 90; i += 1) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      ctx.fillStyle = 'rgba(130, 197, 124, 0.08)';
      ctx.fillRect(x, y, 6, 6);
    }

    ctx.restore();
  }

  drawObstacles(ctx, camera) {
    for (const obstacle of this.obstacles) {
      const x = obstacle.x - camera.x;
      const y = obstacle.y - camera.y;

      ctx.fillStyle = obstacle.color;
      ctx.fillRect(x, y, obstacle.w, obstacle.h);

      if (obstacle.type === 'building') {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x + 12, y + 12, obstacle.w - 24, 12);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(x + 22, y + 38, obstacle.w - 44, obstacle.h - 50);
      } else if (obstacle.type === 'wall') {
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, obstacle.w, obstacle.h);
      } else if (obstacle.type === 'road') {
        ctx.fillStyle = '#333333';
        ctx.fillRect(x, y, obstacle.w, obstacle.h);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(x + 20, y + obstacle.h / 2);
        ctx.lineTo(x + obstacle.w - 20, y + obstacle.h / 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }
}
