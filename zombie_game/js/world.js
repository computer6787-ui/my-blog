class SpatialGrid {
    constructor(cellSize = 100) {
        this.cellSize = cellSize;
        this.grid = new Map();
    }

    clear() {
        this.grid.clear();
    }

    getKey(x, y) {
        return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
    }

    insert(entity) {
        const key = this.getKey(entity.x, entity.y);
        if (!this.grid.has(key)) this.grid.set(key, []);
        this.grid.get(key).push(entity);
    }

    getNearby(x, y, radius) {
        const results = [];
        const cellRadius = Math.ceil(radius / this.cellSize);
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        for (let dx = -cellRadius; dx <= cellRadius; dx++) {
            for (let dy = -cellRadius; dy <= cellRadius; dy++) {
                const key = `${cx + dx},${cy + dy}`;
                const cell = this.grid.get(key);
                if (cell) {
                    for (let i = 0; i < cell.length; i++) {
                        results.push(cell[i]);
                    }
                }
            }
        }
        return results;
    }
}

class World {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.grid = new SpatialGrid(100);
        this.zombies = [];
        this.bullets = [];
        this.particles = [];
        this.lootBags = [];
        this.barricades = [];
        this.debris = [];
        this.powerOrbs = [];
        this.projectiles = [];
        this.burnEffects = [];
        this.boss = null;

        this.player = null;
        this.camera = { x: 0, y: 0 };
        this.viewportWidth = 800;
        this.viewportHeight = 600;

        this.wave = 1;
        this.zombiesRemaining = 0;
        this.zombiesSpawned = 0;
        this.waveActive = false;
        this.waveDelay = 2;
        this.bossSpawned = false;

        this.score = 0;
        this.wood = 5;

        this.time = 0;
        this.nightIntensity = 0;
        this.nightActive = false;
        this.lastNightTime = 0;
        this.nightDuration = 0;

        this.timeScale = 1;
    }

    update(dt, input) {
        const scaledDt = dt * this.timeScale;
        this.time += scaledDt;

        if (!this.nightActive && this.time - this.lastNightTime > 180) {
            this.triggerNight();
            this.lastNightTime = this.time;
            this.nightDuration = 60;
        }

        if (this.nightActive) {
            this.nightIntensity = Math.min(1, this.nightIntensity + scaledDt * 0.5);
            this.nightDuration -= scaledDt;
            if (this.nightDuration <= 0) this.endNight();
        } else if (this.nightIntensity > 0) {
            this.nightIntensity = Math.max(0, this.nightIntensity - scaledDt * 0.4);
        }

        if (this.player) {
            this.player.update(scaledDt, input, this);
            const targetX = this.player.x - this.viewportWidth / 2;
            const targetY = this.player.y - this.viewportHeight / 2;
            this.camera.x += (targetX - this.camera.x) * 0.12;
            this.camera.y += (targetY - this.camera.y) * 0.12;
        }

        this.grid.clear();
        this.zombies.forEach(z => { this.grid.insert(z); z.update(scaledDt, this.player, this); });
        this.bullets.forEach(b => { this.grid.insert(b); b.update(scaledDt, this); });
        this.projectiles.forEach(p => { this.grid.insert(p); p.update(scaledDt, this); });
        this.powerOrbs.forEach(p => this.grid.insert(p));
        this.barricades.forEach(b => this.grid.insert(b));
        this.debris.forEach(d => this.grid.insert(d));

        for (let i = this.bullets.length - 1; i >= 0; i--) {
            if (this.bullets[i].life <= 0) this.bullets.splice(i, 1);
        }
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            if (this.projectiles[i].life <= 0) this.projectiles.splice(i, 1);
        }
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(scaledDt);
            if (this.particles[i].life <= 0) this.particles.splice(i, 1);
        }
        for (let i = this.lootBags.length - 1; i >= 0; i--) {
            this.lootBags[i].update(scaledDt);
            if (this.lootBags[i].life <= 0) this.lootBags.splice(i, 1);
        }
        for (let i = this.debris.length - 1; i >= 0; i--) {
            this.debris[i].update(scaledDt);
            if (this.debris[i].life <= 0) this.debris.splice(i, 1);
        }
        for (let i = this.barricades.length - 1; i >= 0; i--) {
            if (this.barricades[i].health <= 0) this.barricades.splice(i, 1);
        }
        for (let i = this.powerOrbs.length - 1; i >= 0; i--) {
            if (this.powerOrbs[i].life <= 0) this.powerOrbs.splice(i, 1);
        }

        this.checkCollisions();
        this.updateWave(scaledDt);
        this.updateBurnEffects(scaledDt);
        this.updateBoss(scaledDt);
    }

    triggerNight() {
        this.nightActive = true;
        this.nightIntensity = 0;
        document.getElementById('nightOverlay').style.opacity = '0.75';
        this.showNotification('NIGHT FALLS');
    }

    endNight() {
        this.nightActive = false;
        document.getElementById('nightOverlay').style.opacity = '0';
    }

    updateBurnEffects(dt) {
        for (let i = this.burnEffects.length - 1; i >= 0; i--) {
            const burn = this.burnEffects[i];
            burn.timer -= dt;
            if (burn.timer <= 0) {
                this.burnEffects.splice(i, 1);
            } else if (burn.zombie && !burn.zombie.dead) {
                burn.zombie.health -= burn.damage * dt;
                if (burn.zombie.health <= 0) {
                    burn.zombie.dead = true;
                    this.score += 10;
                    this.lootBags.push(new LootBag(burn.zombie.x, burn.zombie.y));
                    this.createParticles(burn.zombie.x, burn.zombie.y, 10, '#555');
                }
            }
        }
    }

    checkCollisions() {
        const playerBullets = this.bullets.filter(b => b.fromPlayer);
        
        for (const b of playerBullets) {
            if (b.hit) continue;
            const nearby = this.grid.getNearby(b.x, b.y, b.radius + 20);
            for (const ent of nearby) {
                const dist = Math.hypot(b.x - ent.x, b.y - ent.y);
                const minDist = b.radius + (ent.radius || 0);
                if (dist < minDist) {
                    if ((ent instanceof Zombie || ent instanceof BossZombie) && !ent.dead) {
                        ent.takeDamage(b.damage, this);
                        b.hit = true;
                        
                        if (b.knockback > 0) {
                            const angle = Math.atan2(ent.y - b.y, ent.x - b.x);
                            const force = b.knockback;
                            ent.vx = Math.cos(angle) * force;
                            ent.vy = Math.sin(angle) * force;
                            ent.knockbackTimer = 0.15;
                        }
                        
                        if (b.burn) {
                            this.burnEffects.push({
                                zombie: ent,
                                timer: 3,
                                damage: 5
                            });
                        }
                        
                        this.createParticles(ent.x, ent.y, 6, '#c0392b');
                        if (audio.initialized) audio.playHit();
                        break;
                    } else if (ent instanceof Barricade) {
                        ent.health -= b.damage;
                        b.hit = true;
                        this.createParticles(ent.x, ent.y, 4, '#8B4513');
                        if (audio.initialized) audio.playHit();
                        break;
                    }
                }
            }
        }

        for (const p of this.projectiles) {
            if (p.hit) continue;
            const dist = Math.hypot(p.x - this.player.x, p.y - this.player.y);
            if (dist < p.radius + this.player.radius) {
                this.player.takeDamage(p.damage);
                p.hit = true;
                this.createParticles(this.player.x, this.player.y, 5, '#9b59b6');
            }
        }

        for (const z of this.zombies) {
            if (z.dead) continue;
            const dist = Math.hypot(z.x - this.player.x, z.y - this.player.y);
            if (dist < z.radius + this.player.radius) {
                z.attack(this.player, this);
            }
        }

        if (this.boss && !this.boss.dead) {
            const b = this.boss;
            const dist = Math.hypot(b.x - this.player.x, b.y - this.player.y);
            if (dist < b.radius + this.player.radius) {
                b.attack(this.player, this);
            }
        }

        for (const b of this.barricades) {
            for (const z of this.zombies) {
                if (z.dead) continue;
                const dist = Math.hypot(z.x - b.x, z.y - b.y);
                const minDist = z.radius + b.radius;
                if (dist < minDist && dist > 0) {
                    const overlap = minDist - dist;
                    const nx = (z.x - b.x) / dist;
                    const ny = (z.y - b.y) / dist;
                    z.x += nx * overlap;
                    z.y += ny * overlap;
                    if (Math.random() < 0.03) {
                        b.health -= 8;
                        this.createParticles(b.x, b.y, 2, '#8B4513');
                    }
                }
            }
            
            if (this.boss && !this.boss.dead) {
                const dist = Math.hypot(this.boss.x - b.x, this.boss.y - b.y);
                const minDist = this.boss.radius + b.radius;
                if (dist < minDist && dist > 0) {
                    const overlap = minDist - dist;
                    const nx = (this.boss.x - b.x) / dist;
                    const ny = (this.boss.y - b.y) / dist;
                    this.boss.x += nx * overlap;
                    this.boss.y += ny * overlap;
                    if (Math.random() < 0.05) {
                        b.health -= 15;
                        this.createParticles(b.x, b.y, 3, '#8B4513');
                    }
                }
            }
        }
    }

    updateWave(dt) {
        if (this.waveActive) {
            const maxZombies = 15 + this.wave * 8;
            const aliveZombies = this.zombies.filter(z => !z.dead).length;
            
            if (aliveZombies < maxZombies && this.zombiesSpawned < maxZombies) {
                if (Math.random() < 0.03 + this.wave * 0.005) {
                    this.spawnZombie();
                    this.zombiesSpawned++;
                }
            }
            
            if (aliveZombies === 0 && this.zombiesSpawned >= maxZombies && (!this.boss || this.boss.dead)) {
                this.waveActive = false;
                this.waveDelay = 5;
                this.showNotification(`WAVE ${this.wave} CLEARED`);
            }
        } else if (this.waveDelay > 0) {
            this.waveDelay -= dt;
            if (this.waveDelay <= 0) {
                this.startNextWave();
            }
        }
    }

    updateBoss(dt) {
        if (this.boss && !this.boss.dead) {
            this.boss.update(dt, this.player, this);
            
            const aliveZombies = this.zombies.filter(z => !z.dead).length;
            if (aliveZombies === 0 && this.waveActive && this.zombiesSpawned >= this.getMaxZombies()) {
                this.waveActive = false;
                this.waveDelay = 5;
                this.showNotification(`WAVE ${this.wave} CLEARED`);
            }
        }
    }

    getMaxZombies() {
        return 15 + this.wave * 8;
    }

    startNextWave() {
        this.wave++;
        this.zombiesSpawned = 0;
        this.bossSpawned = false;
        this.boss = null;
        this.waveActive = true;
        this.showNotification(`WAVE ${this.wave} INCOMING`);
        document.getElementById('waveNum').textContent = this.wave;
        
        if (this.wave % 5 === 0) {
            setTimeout(() => this.spawnBoss(), 3000);
        }
    }

    spawnZombie() {
        const angle = Math.random() * Math.PI * 2;
        const dist = 500 + Math.random() * 300;
        const x = this.player.x + Math.cos(angle) * dist;
        const y = this.player.y + Math.sin(angle) * dist;
        
        const rand = Math.random();
        let zombie;
        if (rand < 0.15) {
            zombie = new FastZombie(x, y, this.wave);
        } else if (rand < 0.30) {
            zombie = new TankZombie(x, y, this.wave);
        } else if (rand < 0.40) {
            zombie = new SpitterZombie(x, y, this.wave);
        } else if (rand < 0.50) {
            zombie = new ExploderZombie(x, y, this.wave);
        } else {
            zombie = new Zombie(x, y, this.wave);
        }
        this.zombies.push(zombie);
    }

    spawnBoss() {
        if (this.bossSpawned) return;
        this.bossSpawned = true;
        
        const angle = Math.random() * Math.PI * 2;
        const dist = 600;
        const x = this.player.x + Math.cos(angle) * dist;
        const y = this.player.y + Math.sin(angle) * dist;
        
        this.boss = new BossZombie(x, y, this.wave);
        this.showNotification('BOSS INCOMING!');
        
        for (let i = 0; i < 3; i++) {
            const a = Math.random() * Math.PI * 2;
            const d = 200 + Math.random() * 100;
            this.zombies.push(new Zombie(x + Math.cos(a) * d, y + Math.sin(a) * d, this.wave));
        }
    }

    createParticles(x, y, count, color) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    showNotification(text) {
        const notif = document.createElement('div');
        notif.className = 'notification';
        notif.textContent = text;
        document.getElementById('ui').appendChild(notif);
        setTimeout(() => notif.remove(), 3000);
    }
}
