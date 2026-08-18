class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = 14;
        this.speed = 210;
        this.health = 100;
        this.maxHealth = 100;
        this.angle = 0;
        this.weapons = [
            { name: 'Pistol', damage: 28, fireRate: 0.28, spread: 0.06, bullets: 1, knockback: 4, color: '#f39c12', lastFired: 0, size: 4 },
            { name: 'Shotgun', damage: 16, fireRate: 0.75, spread: 0.28, bullets: 6, knockback: 10, color: '#e74c3c', lastFired: 0, size: 3, burn: false },
            { name: 'SMG', damage: 11, fireRate: 0.07, spread: 0.14, bullets: 1, knockback: 2, color: '#3498db', lastFired: 0, size: 3 }
        ];
        this.currentWeapon = 0;
        this.level = 1;
        this.xp = 0;
        this.xpToNext = 100;
        this.isLooting = false;
        this.lootTarget = null;
        this.lootTimer = 0;
        this.synergies = [];
        this.buildCooldown = 0;
        this.regen = 0;
        this.regenTimer = 0;
        this.looterRadius = 40;
        this.bayonet = false;
        this.bayonetCooldown = 0;

        this.activePowers = [];
        this.powerTimers = {};
        this.powerCooldowns = {};
        this.rageMode = false;
        this.shieldActive = false;
    }

    update(dt, input, world) {
        if (this.isLooting) {
            this.vx = 0;
            this.vy = 0;
            this.lootTimer += dt;
            if (this.lootTimer >= 1.0) {
                this.collectLoot(world, this.lootTarget);
                this.isLooting = false;
                this.lootTarget = null;
                this.lootTimer = 0;
            }
            return;
        }

        let dx = 0, dy = 0;
        if (input.keys['w'] || input.keys['arrowup']) dy -= 1;
        if (input.keys['s'] || input.keys['arrowdown']) dy += 1;
        if (input.keys['a'] || input.keys['arrowleft']) dx -= 1;
        if (input.keys['d'] || input.keys['arrowright']) dx += 1;

        if (input.joystick.active) {
            dx = input.joystick.dx;
            dy = input.joystick.dy;
        }

        const len = Math.hypot(dx, dy);
        if (len > 0) { dx /= len; dy /= len; }

        let currentSpeed = this.speed;
        if (this.powerTimers.speed && this.powerTimers.speed > 0) {
            currentSpeed *= 2;
        }

        this.vx = dx * currentSpeed;
        this.vy = dy * currentSpeed;

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        this.x = Math.max(this.radius, Math.min(world.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(world.height - this.radius, this.y));

        if (this.buildCooldown > 0) this.buildCooldown -= dt;
        if (this.bayonetCooldown > 0) this.bayonetCooldown -= dt;

        if (this.bayonet) {
            const nearby = world.grid.getNearby(this.x, this.y, this.radius + 20);
            for (const ent of nearby) {
                if (ent instanceof Zombie && !ent.dead) {
                    const dist = Math.hypot(ent.x - this.x, ent.y - this.y);
                    if (dist < this.radius + ent.radius && this.bayonetCooldown <= 0) {
                        ent.takeDamage(15, world);
                        const angle = Math.atan2(ent.y - this.y, ent.x - this.x);
                        ent.vx = Math.cos(angle) * 6;
                        ent.vy = Math.sin(angle) * 6;
                        ent.knockbackTimer = 0.1;
                        world.createParticles(ent.x, ent.y, 4, '#aaa');
                        this.bayonetCooldown = 0.5;
                        break;
                    }
                }
            }
        }

        if (this.regen > 0) {
            this.regenTimer += dt;
            if (this.regenTimer >= 1) {
                this.health = Math.min(this.maxHealth, this.health + this.regen);
                this.regenTimer = 0;
            }
        }

        for (const power in this.powerTimers) {
            if (this.powerTimers[power] > 0) {
                this.powerTimers[power] -= dt;
                if (this.powerTimers[power] <= 0) {
                    this.powerTimers[power] = 0;
                    this.onPowerEnd(power, world);
                }
            }
        }

        for (const power in this.powerCooldowns) {
            if (this.powerCooldowns[power] > 0) {
                this.powerCooldowns[power] -= dt;
                if (this.powerCooldowns[power] <= 0) {
                    this.powerCooldowns[power] = 0;
                }
            }
        }
    }

    onPowerEnd(power, world) {
        if (power === 'rage') {
            this.rageMode = false;
            if (this.synergies.find(s => s.effect === 'damage')) {
                this.weapons.forEach(w => {
                    w.damage = Math.floor(w.damage / 1.3);
                });
            }
        } else if (power === 'shield') {
            this.shieldActive = false;
        } else if (power === 'time_slow') {
            world.timeScale = 1;
        }
        this.activePowers = this.activePowers.filter(p => p !== power);
    }

    activatePower(powerType, world) {
        if (this.powerCooldowns[powerType] && this.powerCooldowns[powerType] > 0) {
            world.showNotification('ON COOLDOWN');
            return;
        }

        const config = POWER_TYPES[powerType];
        if (!config) return;

        this.powerTimers[powerType] = config.duration;
        this.powerCooldowns[powerType] = config.cooldown;
        if (!this.activePowers.includes(powerType)) {
            this.activePowers.push(powerType);
        }

        switch (powerType) {
            case 'speed':
                world.showNotification('SPEED BOOST ACTIVATED!');
                break;
            case 'shield':
                this.shieldActive = true;
                world.showNotification('SHIELD ACTIVATED!');
                break;
            case 'rage':
                this.rageMode = true;
                world.showNotification('RAGE MODE ACTIVATED!');
                break;
            case 'time_slow':
                world.timeScale = 0.5;
                world.showNotification('TIME WARP ACTIVATED!');
                break;
            case 'airstrike':
                this.airstrike(world);
                world.showNotification('AIRSTRIKE CALLED!');
                break;
            case 'heal':
                this.health = Math.min(this.maxHealth, this.health + 50);
                world.showNotification('+50 HEALTH');
                this.activePowers = this.activePowers.filter(p => p !== powerType);
                this.powerTimers[powerType] = 0;
                break;
        }

        if (audio.initialized) audio.playPowerUp();
    }

    airstrike(world) {
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const x = world.player.x + (Math.random() - 0.5) * 400;
                const y = world.player.y + (Math.random() - 0.5) * 400;

                world.createParticles(x, y, 15, '#e74c3c');

                for (const z of world.zombies) {
                    if (z.dead) continue;
                    const dist = Math.hypot(z.x - x, z.y - y);
                    if (dist < 60) {
                        z.takeDamage(100, world);
                    }
                }

                if (world.boss && !world.boss.dead) {
                    const dist = Math.hypot(world.boss.x - x, world.boss.y - y);
                    if (dist < 60) {
                        world.boss.takeDamage(100, world);
                    }
                }

                if (audio.initialized) audio.playExplosion();
            }, i * 200);
        }
    }

    shoot(world, targetX, targetY) {
        const weapon = this.weapons[this.currentWeapon];
        const now = world.time;
        if (now - weapon.lastFired < weapon.fireRate) return;
        weapon.lastFired = now;

        let damage = weapon.damage;
        if (this.rageMode) damage *= 3;

        for (let i = 0; i < weapon.bullets; i++) {
            const spread = (Math.random() - 0.5) * weapon.spread;
            const angle = this.angle + spread;
            const speed = 650;
            const bullet = new Bullet(
                this.x, this.y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                damage,
                true,
                weapon.color,
                weapon.size,
                weapon.knockback,
                weapon.burn || false
            );
            world.bullets.push(bullet);
        }
        if (audio.initialized) audio.playShoot();
    }

    tryBuild(world) {
        if (this.buildCooldown > 0) return;
        if (world.wood < 1) {
            world.showNotification('NEED WOOD');
            return;
        }

        const buildDist = 60;
        const bx = this.x + Math.cos(this.angle) * buildDist;
        const by = this.y + Math.sin(this.angle) * buildDist;

        const nearby = world.grid.getNearby(bx, by, 40);
        for (const ent of nearby) {
            if (ent instanceof Barricade || ent instanceof Zombie || ent instanceof BossZombie) {
                world.showNotification('CANNOT BUILD HERE');
                return;
            }
        }

        world.wood--;
        world.barricades.push(new Barricade(bx, by));
        world.createParticles(bx, by, 8, '#8B4513');
        this.buildCooldown = 0.4;
        if (audio.initialized) audio.playPickup();
        world.showNotification('BARRICADE PLACED');
    }

    takeDamage(amount) {
        if (this.shieldActive) return;
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            document.getElementById('gameOver').style.display = 'flex';
            document.getElementById('finalStats').innerHTML = `
                WAVE REACHED: ${game.world.wave}<br>
                FINAL SCORE: ${game.world.score}<br>
                ZOMBIES SLAIN: ${game.world.score / 10}<br>
                LEVEL: ${this.level}
            `;
        }
    }

    gainXP(amount) {
        this.xp += amount;
        while (this.xp >= this.xpToNext) {
            this.xp -= this.xpToNext;
            this.levelUp();
        }
    }

    levelUp() {
        this.level++;
        this.xpToNext = Math.floor(this.xpToNext * 1.4);
        this.maxHealth += 12;
        this.health = this.maxHealth;
        document.getElementById('levelNum').textContent = this.level;
        if (audio.initialized) audio.playLevelUp();
        game.showUpgradeScreen();
    }

    collectLoot(world, lootBag) {
        const roll = Math.random();
        if (roll < 0.35) {
            world.wood++;
            world.showNotification('+1 WOOD');
        } else if (roll < 0.65) {
            this.gainXP(25);
            world.showNotification('+25 XP');
        } else if (roll < 0.85) {
            this.health = Math.min(this.maxHealth, this.health + 20);
            world.showNotification('+20 HEALTH');
        } else {
            world.wood += 2;
            world.showNotification('+2 WOOD');
        }
        lootBag.life = 0;
        if (audio.initialized) audio.playPickup();
    }
}
