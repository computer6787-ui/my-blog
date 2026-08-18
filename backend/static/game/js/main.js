const UPGRADES = [
    { name: 'Incendiary Rounds', desc: 'Bullets burn zombies for 3s, dealing 5 damage/sec.', effect: 'burn' },
    { name: 'Bayonet', desc: 'Automatic melee strike when zombies close range.', effect: 'bayonet' },
    { name: 'Extended Mags', desc: 'Fire rate increased by 25% across all weapons.', effect: 'mags' },
    { name: 'Quickdraw', desc: 'Reload speed improved, fire rate +20%.', effect: 'fireRate' },
    { name: 'High Caliber', desc: 'All bullet damage increased by 30%.', effect: 'damage' },
    { name: 'Kinetic Shield', desc: 'Regenerate 1 HP every second.', effect: 'shield' },
    { name: 'Scavenger', desc: 'Loot and debris pickup radius doubled.', effect: 'looter' },
    { name: 'Nitro Charge', desc: 'Shotgun knockback force increased by 60%.', effect: 'knockback' }
];

class UpgradeSystem {
    static generateOptions(count = 3) {
        const shuffled = [...UPGRADES].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    }

    static applyUpgrade(upgrade, player, world) {
        player.synergies.push(upgrade);
        switch (upgrade.effect) {
            case 'burn':
                player.weapons.forEach(w => w.burn = true);
                break;
            case 'bayonet':
                player.bayonet = true;
                break;
            case 'mags':
                player.weapons.forEach(w => w.fireRate *= 0.75);
                break;
            case 'fireRate':
                player.weapons.forEach(w => w.fireRate *= 0.8);
                break;
            case 'damage':
                player.weapons.forEach(w => w.damage = Math.floor(w.damage * 1.3));
                break;
            case 'shield':
                player.regen = 1;
                break;
            case 'looter':
                player.looterRadius = 80;
                break;
            case 'knockback':
                player.weapons.forEach(w => w.knockback *= 1.6);
                break;
        }
        world.showNotification(`UPGRADE: ${upgrade.name.toUpperCase()}`);
    }
}

class Bullet {
    constructor(x, y, vx, vy, damage, fromPlayer, color, size, knockback, burn) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.damage = damage;
        this.fromPlayer = fromPlayer;
        this.color = color;
        this.radius = size;
        this.life = 1.2;
        this.knockback = knockback;
        this.burn = burn || false;
        this.hit = false;
    }

    update(dt, world) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        if (this.x < 0 || this.x > world.width || this.y < 0 || this.y > world.height) {
            this.life = 0;
        }
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = 50 + Math.random() * 150;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 0.3 + Math.random() * 0.4;
        this.maxLife = this.life;
        this.color = color;
        this.radius = 1.5 + Math.random() * 2.5;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        this.vx *= 0.92;
        this.vy *= 0.92;
    }
}

class LootBag {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 11;
        this.life = 45;
        this.bobOffset = Math.random() * Math.PI * 2;
    }

    update(dt) {
        this.life -= dt;
        this.bobOffset += dt * 3.5;
    }
}

class Debris {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 12;
        this.life = 120;
    }

    update(dt) {
        this.life -= dt;
    }
}

class Barricade {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 22;
        this.health = 120;
        this.maxHealth = 120;
    }

    update(dt) {}
}

class PowerOrb {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.radius = 10;
        this.life = 20;
        this.bobOffset = Math.random() * Math.PI * 2;
    }

    update(dt) {
        this.life -= dt;
        this.bobOffset += dt * 3.5;
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();

        this.world = new World(3000, 3000);
        this.world.player = new Player(1500, 1500);
        this.input = new InputHandler(this.canvas);

        for (let i = 0; i < 30; i++) {
            const x = 150 + Math.random() * 2700;
            const y = 150 + Math.random() * 2700;
            this.world.debris.push(new Debris(x, y));
        }

        this.world.startNextWave();
        this.lastTime = performance.now();
        this.paused = false;

        window.addEventListener('resize', () => this.resize());
        this.loop();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (this.world) {
            this.world.viewportWidth = this.canvas.width;
            this.world.viewportHeight = this.canvas.height;
        }
    }

    tryLoot() {
        const player = this.world.player;
        if (player.isLooting) {
            player.isLooting = false;
            player.lootTarget = null;
            player.lootTimer = 0;
            document.getElementById('lootPrompt').style.display = 'none';
            document.getElementById('lootBar').style.display = 'none';
            return;
        }

        let closestLoot = null;
        let closestDist = 45;

        for (const lb of this.world.lootBags) {
            const dist = Math.hypot(lb.x - player.x, lb.y - player.y);
            if (dist < closestDist) {
                closestDist = dist;
                closestLoot = lb;
            }
        }

        if (closestLoot) {
            player.isLooting = true;
            player.lootTarget = closestLoot;
            player.lootTimer = 0;
            document.getElementById('lootPrompt').style.display = 'block';
            document.getElementById('lootBar').style.display = 'block';
            return;
        }

        for (let i = 0; i < this.world.debris.length; i++) {
            const d = this.world.debris[i];
            const dist = Math.hypot(d.x - player.x, d.y - player.y);
            if (dist < 35) {
                this.world.wood++;
                this.world.debris.splice(i, 1);
                this.world.createParticles(d.x, d.y, 5, '#8B4513');
                if (audio.initialized) audio.playPickup();
                this.world.showNotification('+1 WOOD');
                break;
            }
        }
    }

    showUpgradeScreen() {
        this.paused = true;
        const screen = document.getElementById('upgradeScreen');
        const options = document.getElementById('upgradeOptions');
        options.innerHTML = '';

        const upgrades = UpgradeSystem.generateOptions(3);
        upgrades.forEach(upgrade => {
            const card = document.createElement('div');
            card.className = 'upgrade-card ui-element';
            card.innerHTML = `<h3>${upgrade.name}</h3><p>${upgrade.desc}</p>`;
            card.addEventListener('click', () => {
                UpgradeSystem.applyUpgrade(upgrade, this.world.player, this.world);
                screen.style.display = 'none';
                this.canvas.focus();
                this.paused = false;
            });
            options.appendChild(card);
        });

        screen.style.display = 'flex';
    }

    loop() {
        const now = performance.now();
        let dt = Math.min((now - this.lastTime) / 1000, 0.05);
        this.lastTime = now;

        if (!this.paused && this.world.player && this.world.player.health > 0) {
            const player = this.world.player;
            
            if (this.input.aimJoystick.active) {
                const angle = this.input.aimJoystick.angle;
                player.angle = angle;
                if (this.input.aimJoystick.firing) {
                    const worldX = player.x + Math.cos(angle) * 1000;
                    const worldY = player.y + Math.sin(angle) * 1000;
                    player.shoot(this.world, worldX, worldY);
                }
            }
            
            if (player.isLooting && player.lootTarget) {
                const progress = Math.min((player.lootTimer / 1.0) * 100, 100);
                document.getElementById('lootBarFill').style.width = `${progress}%`;
            } else {
                document.getElementById('lootPrompt').style.display = 'none';
                document.getElementById('lootBar').style.display = 'none';
            }

            this.world.update(dt, this.input);
            audio.updateIntensity(this.world.zombies.filter(z => !z.dead).length + (this.world.boss && !this.world.boss.dead ? 5 : 0));
            this.updateHUD();
            updatePowerUI(player);
        }

        this.render();
        requestAnimationFrame(() => this.loop());
    }

    updateHUD() {
        const p = this.world.player;
        document.getElementById('healthFill').style.width = `${(p.health / p.maxHealth) * 100}%`;
        document.getElementById('xpFill').style.width = `${(p.xp / p.xpToNext) * 100}%`;
        document.getElementById('score').textContent = this.world.score;
        document.getElementById('woodCount').textContent = this.world.wood;
        document.getElementById('zombieCount').textContent = this.world.zombies.filter(z => !z.dead).length;
        document.getElementById('waveNum').textContent = this.world.wave;
        
        if (this.world.boss && !this.world.boss.dead) {
            document.getElementById('bossHealthContainer').style.display = 'block';
            const hpPct = Math.max(0, (this.world.boss.health / this.world.boss.maxHealth) * 100);
            document.getElementById('bossHealthFill').style.width = `${hpPct}%`;
        } else {
            document.getElementById('bossHealthContainer').style.display = 'none';
        }
    }

    render() {
        const ctx = this.ctx;
        const cam = this.world.camera;

        ctx.fillStyle = '#080808';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        ctx.translate(-cam.x, -cam.y);

        const gridSize = 100;
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= this.world.width; x += gridSize) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.world.height);
        }
        for (let y = 0; y <= this.world.height; y += gridSize) {
            ctx.moveTo(0, y);
            ctx.lineTo(this.world.width, y);
        }
        ctx.stroke();

        ctx.fillStyle = '#0c0c0c';
        ctx.fillRect(0, 0, this.world.width, this.world.height);

        ctx.fillStyle = '#0f0f0f';
        for (let i = 0; i < 200; i++) {
            const gx = (i * 137.508) % this.world.width;
            const gy = (i * 89.753) % this.world.height;
            const gr = 2 + (i % 6);
            ctx.globalAlpha = 0.15 + (i % 3) * 0.05;
            ctx.fillRect(gx, gy, gr, gr);
        }
        ctx.globalAlpha = 1;

        ctx.strokeStyle = '#151515';
        ctx.lineWidth = 1;
        for (let i = 0; i < 80; i++) {
            const cx = (i * 173.23) % this.world.width;
            const cy = (i * 127.89) % this.world.height;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + (i % 20) - 10, cy + (i % 15) - 7);
            ctx.stroke();
        }

        this.world.debris.forEach(d => {
            ctx.fillStyle = '#1e1e1e';
            ctx.fillRect(d.x - 9, d.y - 9, 18, 18);
            ctx.strokeStyle = '#2a2a2a';
            ctx.lineWidth = 1;
            ctx.strokeRect(d.x - 9, d.y - 9, 18, 18);
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(d.x - 2, d.y - 2, 4, 4);
        });

        this.world.barricades.forEach(b => {
            const hpPct = b.health / b.maxHealth;
            ctx.fillStyle = '#2a1a0f';
            ctx.fillRect(b.x - b.radius, b.y - b.radius, b.radius * 2, b.radius * 2);
            ctx.strokeStyle = '#5a3d1a';
            ctx.lineWidth = 3;
            ctx.strokeRect(b.x - b.radius, b.y - b.radius, b.radius * 2, b.radius * 2);
            ctx.fillStyle = '#c0392b';
            ctx.fillRect(b.x - b.radius, b.y - b.radius - 6, b.radius * 2 * hpPct, 3);
        });

        this.world.lootBags.forEach(lb => {
            const bob = Math.sin(lb.bobOffset) * 2.5;
            ctx.shadowColor = '#f39c12';
            ctx.shadowBlur = 12;
            ctx.fillStyle = '#f39c12';
            ctx.fillRect(lb.x - 7, lb.y - 7 + bob, 14, 14);
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#e67e22';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(lb.x - 7, lb.y - 7 + bob, 14, 14);
        });

        this.world.zombies.forEach(z => {
            if (z.dead) return;
            ctx.save();
            ctx.translate(z.x, z.y);

            ctx.fillStyle = z.zombieType === 'fast' ? '#27ae60' :
                           z.zombieType === 'tank' ? '#7f8c8d' :
                           z.zombieType === 'spitter' ? '#9b59b6' :
                           z.zombieType === 'exploder' ? '#e67e22' : '#1c2833';
            ctx.beginPath();
            ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = z.zombieType === 'tank' ? '#2c3e50' : '#141e24';
            ctx.beginPath();
            ctx.arc(0, -1.5, z.radius * 0.65, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#922b21';
            ctx.beginPath();
            ctx.arc(-4, -2, 2.2, 0, Math.PI * 2);
            ctx.arc(4, -2, 2.2, 0, Math.PI * 2);
            ctx.fill();

            if (z.eyeGlow) {
                ctx.shadowColor = '#ff0000';
                ctx.shadowBlur = 18;
                ctx.fillStyle = '#ff0000';
                ctx.beginPath();
                ctx.arc(-4, -2, 2.8, 0, Math.PI * 2);
                ctx.arc(4, -2, 2.8, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }

            ctx.fillStyle = '#3d2817';
            ctx.fillRect(-5, 3, 3, 2);
            ctx.fillRect(2, 3, 3, 2);

            if (z.zombieType !== 'fast' && Math.random() > 0.5) {
                ctx.fillStyle = '#5d4037';
                ctx.fillRect(-3, 5, 6, 1.5);
            }

            if (z.zombieType === 'tank') {
                ctx.strokeStyle = '#7f8c8d';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-6, -4);
                ctx.lineTo(-8, -8);
                ctx.moveTo(6, -4);
                ctx.lineTo(8, -8);
                ctx.stroke();
            } else if (z.zombieType === 'spitter') {
                ctx.fillStyle = '#4a235a';
                ctx.fillRect(-2, 4, 4, 3);
            } else if (z.zombieType === 'exploder') {
                ctx.fillStyle = '#922b21';
                ctx.beginPath();
                ctx.moveTo(0, 2);
                ctx.lineTo(-3, 6);
                ctx.lineTo(3, 6);
                ctx.closePath();
                ctx.fill();
            } else if (z.zombieType === 'normal') {
                if (Math.random() > 0.6) {
                    ctx.strokeStyle = '#c0392b';
                    ctx.lineWidth = 0.8;
                    ctx.beginPath();
                    ctx.moveTo(-3, 0);
                    ctx.lineTo(1, 2);
                    ctx.stroke();
                }
            }

            if (z.zombieType === 'tank') {
                ctx.fillStyle = '#555';
                ctx.fillRect(-z.radius + 2, -z.radius + 2, z.radius * 2 - 4, 4);
            } else if (z.zombieType === 'spitter') {
                ctx.fillStyle = '#9b59b6';
                ctx.beginPath();
                ctx.arc(0, z.radius + 2, 4, 0, Math.PI * 2);
                ctx.fill();
            } else if (z.zombieType === 'exploder') {
                ctx.fillStyle = '#e74c3c';
                ctx.beginPath();
                ctx.arc(0, 0, z.radius * 0.5, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();

            const hpPct = z.health / z.maxHealth;
            if (hpPct < 1) {
                ctx.fillStyle = '#222';
                ctx.fillRect(z.x - 10, z.y - z.radius - 5, 20, 2.5);
                ctx.fillStyle = '#c0392b';
                ctx.fillRect(z.x - 10, z.y - z.radius - 5, 20 * hpPct, 2.5);
            }
        });

        const boss = this.world.boss;
        if (boss && !boss.dead) {
            ctx.save();
            ctx.translate(boss.x, boss.y);

            ctx.fillStyle = '#4a0e0e';
            ctx.beginPath();
            ctx.arc(0, 0, boss.radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#2c0a0a';
            ctx.beginPath();
            ctx.arc(0, -2, boss.radius * 0.6, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 25;
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(-8, -3, 4, 0, Math.PI * 2);
            ctx.arc(8, -3, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#f39c12';
            ctx.fillRect(-15, -boss.radius - 5, 8, 8);
            ctx.fillRect(-4, -boss.radius - 10, 8, 12);
            ctx.fillRect(7, -boss.radius - 5, 8, 8);

            ctx.restore();

            const hpPct = boss.health / boss.maxHealth;
            ctx.fillStyle = '#222';
            ctx.fillRect(boss.x - 35, boss.y - boss.radius - 15, 70, 5);
            ctx.fillStyle = '#c0392b';
            ctx.fillRect(boss.x - 35, boss.y - boss.radius - 15, 70 * hpPct, 5);
        }

        this.world.particles.forEach(p => {
            const alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        this.world.bullets.forEach(b => {
            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.rotate(Math.atan2(b.vy, b.vx));
            ctx.shadowColor = b.color;
            ctx.shadowBlur = 10;
            ctx.fillStyle = b.color;
            ctx.fillRect(-b.radius * 3, -b.radius, b.radius * 6, b.radius * 2);
            ctx.shadowBlur = 0;
            ctx.restore();
        });

        this.world.projectiles.forEach(p => {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(Math.atan2(p.vy, p.vx));
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();
        });

        const player = this.world.player;
        if (player && player.health > 0) {
            ctx.save();
            ctx.translate(player.x, player.y);
            ctx.rotate(player.angle);

            if (player.shieldActive) {
                ctx.strokeStyle = '#2ecc71';
                ctx.lineWidth = 3;
                ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.3;
                ctx.beginPath();
                ctx.arc(0, 0, player.radius + 8, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1;
            }

            if (player.rageMode) {
                ctx.strokeStyle = '#e74c3c';
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.6 + Math.sin(Date.now() / 50) * 0.4;
                ctx.beginPath();
                ctx.arc(0, 0, player.radius + 5, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1;
            }

            ctx.fillStyle = '#1a252f';
            ctx.beginPath();
            ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#0f1922';
            ctx.beginPath();
            ctx.arc(0, -1.5, player.radius * 0.6, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(-5, -4, 10, 3);

            ctx.fillStyle = '#f39c12';
            ctx.fillRect(player.radius - 1, -2, 7, 4);

            ctx.fillStyle = '#5d4037';
            ctx.fillRect(-4, 3, 8, 2);

            ctx.restore();

            const weapon = player.weapons[player.currentWeapon];
            ctx.fillStyle = '#555';
            ctx.font = 'bold 10px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText(weapon.name.toUpperCase(), player.x, player.y - player.radius - 8);
        }

        ctx.restore();

        if (this.world.nightIntensity > 0) {
            const intensity = this.world.nightIntensity;
            const grad = ctx.createRadialGradient(
                this.canvas.width / 2, this.canvas.height / 2, this.canvas.width * 0.2,
                this.canvas.width / 2, this.canvas.height / 2, this.canvas.width * 0.75
            );
            grad.addColorStop(0, 'transparent');
            grad.addColorStop(0.4, `rgba(0, 0, 8, ${intensity * 0.35})`);
            grad.addColorStop(1, `rgba(0, 0, 4, ${intensity * 0.85})`);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
}

class InputHandler {
    constructor(canvas) {
        this.keys = {};
        this.buildMode = false;

        this.joystick = {
            active: false,
            originX: 0,
            originY: 0,
            dx: 0,
            dy: 0
        };

        this.aimJoystick = {
            active: false,
            originX: 0,
            originY: 0,
            dx: 0,
            dy: 0,
            angle: 0,
            firing: false,
            touchId: null,
            isMouse: false
        };

        this.joystickTouchId = null;

        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            
            if (e.key.toLowerCase() === 'b') {
                game.world.player.tryBuild(game.world);
            }
            if (e.key >= '1' && e.key <= '3') {
                const idx = parseInt(e.key) - 1;
                game.world.player.currentWeapon = idx;
                document.querySelectorAll('.inv-slot, .mobile-weapon-btn').forEach((s, i) => {
                    s.classList.toggle('active', i === idx);
                });
            }
            if (e.key.toLowerCase() === 'e') {
                game.tryLoot();
            }
            if (e.key.toLowerCase() === 'z') {
                game.world.player.activatePower('speed', game.world);
            }
            if (e.key.toLowerCase() === 'x') {
                game.world.player.activatePower('shield', game.world);
            }
            if (e.key.toLowerCase() === 'c') {
                game.world.player.activatePower('rage', game.world);
            }
            if (e.key.toLowerCase() === 'v') {
                game.world.player.activatePower('time_slow', game.world);
            }
            if (e.key.toLowerCase() === 'f') {
                game.world.player.activatePower('airstrike', game.world);
            }
            if (e.key.toLowerCase() === 'r') {
                game.world.player.activatePower('heal', game.world);
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });

        const joystickZone = document.getElementById('joystickZone');
        const aimJoystickZone = document.getElementById('aimJoystickZone');
        const lootZone = document.getElementById('lootZone');
        const knob = document.getElementById('joystickKnob');
        const aimKnob = document.getElementById('aimJoystickKnob');

        if (joystickZone) {
            const getTouch = (touches, id) => {
                for (let i = 0; i < touches.length; i++) {
                    if (touches[i].identifier === id) return touches[i];
                }
                return null;
            };

            joystickZone.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.changedTouches.length > 0) {
                    const touch = e.changedTouches[0];
                    this.joystickTouchId = touch.identifier;
                    const rect = joystickZone.getBoundingClientRect();
                    this.joystick.active = true;
                    this.joystick.originX = rect.left + rect.width / 2;
                    this.joystick.originY = rect.top + rect.height / 2;
                    this.updateJoystick(touch.clientX, touch.clientY);
                }
            }, { passive: false });

            joystickZone.addEventListener('touchmove', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.joystickTouchId !== null) {
                    const touch = getTouch(e.touches, this.joystickTouchId);
                    if (touch) {
                        this.updateJoystick(touch.clientX, touch.clientY);
                    }
                }
            }, { passive: false });

            const endMoveJoystick = () => {
                this.joystick.active = false;
                this.joystick.dx = 0;
                this.joystick.dy = 0;
                this.joystickTouchId = null;
                if (knob) {
                    knob.style.transform = 'translate(-50%, -50%)';
                    knob.style.left = '50%';
                    knob.style.top = '50%';
                }
            };

            joystickZone.addEventListener('touchend', (e) => {
                e.preventDefault();
                if (this.joystickTouchId !== null) {
                    const touch = getTouch(e.changedTouches, this.joystickTouchId);
                    if (touch) endMoveJoystick();
                }
            }, { passive: false });

            joystickZone.addEventListener('touchcancel', (e) => {
                e.preventDefault();
                endMoveJoystick();
            });
        }

        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });

        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
        }, { passive: false });

        if (aimJoystickZone) {
            const getAimTouch = (touches, id) => {
                for (let i = 0; i < touches.length; i++) {
                    if (touches[i].identifier === id) return touches[i];
                }
                return null;
            };

            const startAimJoystick = (clientX, clientY) => {
                const rect = aimJoystickZone.getBoundingClientRect();
                this.aimJoystick.active = true;
                this.aimJoystick.isMouse = true;
                this.aimJoystick.originX = rect.left + rect.width / 2;
                this.aimJoystick.originY = rect.top + rect.height / 2;
                this.aimJoystick.touchId = 'mouse';
                this.updateAimJoystick(clientX, clientY);
            };

            const moveAimJoystick = (clientX, clientY) => {
                if (this.aimJoystick.active && this.aimJoystick.isMouse) {
                    this.updateAimJoystick(clientX, clientY);
                }
            };

            const endAimJoystick = () => {
                this.aimJoystick.active = false;
                this.aimJoystick.dx = 0;
                this.aimJoystick.dy = 0;
                this.aimJoystick.angle = 0;
                this.aimJoystick.firing = false;
                this.aimJoystick.touchId = null;
                this.aimJoystick.isMouse = false;
                if (aimKnob) {
                    aimKnob.style.transform = 'translate(-50%, -50%)';
                    aimKnob.style.left = '50%';
                    aimKnob.style.top = '50%';
                }
            };

            aimJoystickZone.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.changedTouches.length > 0) {
                    const touch = e.changedTouches[0];
                    this.aimJoystick.isMouse = false;
                    this.aimJoystick.touchId = touch.identifier;
                    const rect = aimJoystickZone.getBoundingClientRect();
                    this.aimJoystick.active = true;
                    this.aimJoystick.originX = rect.left + rect.width / 2;
                    this.aimJoystick.originY = rect.top + rect.height / 2;
                    this.updateAimJoystick(touch.clientX, touch.clientY);
                }
            }, { passive: false });

            aimJoystickZone.addEventListener('touchmove', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.aimJoystick.touchId !== null && !this.aimJoystick.isMouse) {
                    const touch = getAimTouch(e.touches, this.aimJoystick.touchId);
                    if (touch) {
                        this.updateAimJoystick(touch.clientX, touch.clientY);
                    }
                }
            }, { passive: false });

            aimJoystickZone.addEventListener('touchend', (e) => {
                e.preventDefault();
                if (this.aimJoystick.touchId !== null && !this.aimJoystick.isMouse) {
                    const touch = getAimTouch(e.changedTouches, this.aimJoystick.touchId);
                    if (touch) endAimJoystick();
                }
            }, { passive: false });

            aimJoystickZone.addEventListener('touchcancel', (e) => {
                e.preventDefault();
                if (!this.aimJoystick.isMouse) endAimJoystick();
            });

            aimJoystickZone.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                startAimJoystick(e.clientX, e.clientY);
            });

            window.addEventListener('mousemove', (e) => {
                if (this.aimJoystick.active && this.aimJoystick.isMouse) {
                    e.preventDefault();
                    moveAimJoystick(e.clientX, e.clientY);
                }
            });

            window.addEventListener('mouseup', (e) => {
                if (this.aimJoystick.active && this.aimJoystick.isMouse) {
                    e.preventDefault();
                    endAimJoystick();
                }
            });
        }

        if (lootZone) {
            lootZone.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                game.tryLoot();
            }, { passive: false });
        }

        document.querySelectorAll('.mobile-weapon-btn').forEach(btn => {
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const idx = parseInt(btn.dataset.slot);
                game.world.player.currentWeapon = idx;
                document.querySelectorAll('.inv-slot, .mobile-weapon-btn').forEach((s, i) => {
                    s.classList.toggle('active', i === idx);
                });
            }, { passive: false });
        });

        document.querySelectorAll('.power-button').forEach(btn => {
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const power = btn.dataset.power;
                if (power) {
                    game.world.player.activatePower(power, game.world);
                }
            }, { passive: false });
        });
    }

    updateJoystick(touchX, touchY) {
        const knob = document.getElementById('joystickKnob');
        const maxDist = 45;
        let dx = touchX - this.joystick.originX;
        let dy = touchY - this.joystick.originY;
        const dist = Math.hypot(dx, dy);
        
        if (dist > maxDist) {
            dx = (dx / dist) * maxDist;
            dy = (dy / dist) * maxDist;
        }
        
        this.joystick.dx = dx / maxDist;
        this.joystick.dy = dy / maxDist;
        
        if (knob) {
            knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        }
    }

    updateAimJoystick(touchX, touchY) {
        const aimKnob = document.getElementById('aimJoystickKnob');
        const maxDist = 45;
        const fireThreshold = 25;
        let dx = touchX - this.aimJoystick.originX;
        let dy = touchY - this.aimJoystick.originY;
        const dist = Math.hypot(dx, dy);
        
        if (dist > maxDist) {
            dx = (dx / dist) * maxDist;
            dy = (dy / dist) * maxDist;
        }
        
        this.aimJoystick.dx = dx;
        this.aimJoystick.dy = dy;
        this.aimJoystick.angle = Math.atan2(dy, dx);
        this.aimJoystick.firing = dist > fireThreshold;
        
        if (aimKnob) {
            aimKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        }
    }
}

const audio = new AudioSystem();
const game = new Game();

function initAudio() {
    audio.init();
    document.removeEventListener('touchstart', initAudio);
    document.removeEventListener('click', initAudio);
    document.removeEventListener('keydown', initAudio);
}

document.addEventListener('touchstart', initAudio, { once: true });
document.addEventListener('click', initAudio, { once: true });
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.key === ' ') initAudio();
}, { once: true });

function requestFullscreen() {
    const el = document.documentElement;
    if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
    } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
    } else if (el.msRequestFullscreen) {
        el.msRequestFullscreen();
    }
}

function tryFullscreen() {
    requestFullscreen();
}

if (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen) {
    const canvas = document.getElementById('gameCanvas');
    if (canvas) {
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            tryFullscreen();
        }, { once: true });

        document.addEventListener('touchend', () => {
            tryFullscreen();
        }, { once: true });

        document.addEventListener('click', () => {
            tryFullscreen();
        }, { once: true });

        document.addEventListener('keydown', () => {
            tryFullscreen();
        }, { once: true });
    }
}
