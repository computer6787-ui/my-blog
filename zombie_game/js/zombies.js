class Zombie {
    constructor(x, y, wave) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = 13;
        this.baseSpeed = 75 + wave * 7;
        this.speed = this.baseSpeed;
        this.health = 45 + wave * 12;
        this.maxHealth = this.health;
        this.damage = 8 + wave * 2;
        this.attackCooldown = 0;
        this.dead = false;
        this.state = 'idle';
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.wanderTimer = 0;
        this.lastKnownX = x;
        this.lastKnownY = y;
        this.smellTimer = 0;
        this.eyeGlow = false;
        this.knockbackTimer = 0;
        this.zombieType = 'normal';
    }

    update(dt, player, world) {
        if (this.dead) return;

        if (world.nightActive) {
            this.eyeGlow = true;
            this.speed = this.baseSpeed * 1.5;
        } else {
            this.eyeGlow = false;
            this.speed = this.baseSpeed;
        }

        const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
        const detectRange = 280;

        if (distToPlayer < detectRange) {
            this.state = 'chase';
            this.lastKnownX = player.x;
            this.lastKnownY = player.y;
            this.smellTimer = 3.5;
        } else if (this.smellTimer > 0) {
            this.state = 'chase';
            this.smellTimer -= dt;
        } else {
            this.state = 'idle';
        }

        if (this.state === 'chase') {
            const tx = this.smellTimer > 0 ? this.lastKnownX : player.x;
            const ty = this.smellTimer > 0 ? this.lastKnownY : player.y;
            const angle = Math.atan2(ty - this.y, tx - this.x);
            this.vx = Math.cos(angle) * this.speed;
            this.vy = Math.sin(angle) * this.speed;
        } else {
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                this.wanderAngle = Math.random() * Math.PI * 2;
                this.wanderTimer = 2 + Math.random() * 3;
            }
            this.vx = Math.cos(this.wanderAngle) * (this.speed * 0.25);
            this.vy = Math.sin(this.wanderAngle) * (this.speed * 0.25);
        }

        if (this.knockbackTimer > 0) {
            this.knockbackTimer -= dt;
            const kbDecay = Math.max(0, this.knockbackTimer / 0.15);
            this.vx *= kbDecay;
            this.vy *= kbDecay;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        this.x = Math.max(this.radius, Math.min(world.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(world.height - this.radius, this.y));

        if (this.attackCooldown > 0) this.attackCooldown -= dt;
    }

    attack(player, world) {
        if (this.attackCooldown <= 0) {
            player.takeDamage(this.damage);
            this.attackCooldown = 1.0;
            world.createParticles(player.x, player.y, 4, '#c0392b');
        }
    }

    takeDamage(amount, world) {
        this.health -= amount;
        if (this.health <= 0 && !this.dead) {
            this.dead = true;
            world.score += 10;
            world.lootBags.push(new LootBag(this.x, this.y));
            world.createParticles(this.x, this.y, 10, '#555');
            if (Math.random() < 0.35) {
                world.debris.push(new Debris(this.x, this.y));
            }
        }
    }
}

class FastZombie extends Zombie {
    constructor(x, y, wave) {
        super(x, y, wave);
        this.radius = 10;
        this.baseSpeed = 180 + wave * 10;
        this.speed = this.baseSpeed;
        this.health = 25 + wave * 6;
        this.maxHealth = this.health;
        this.damage = 6 + wave * 1.5;
        this.zombieType = 'fast';
    }
}

class TankZombie extends Zombie {
    constructor(x, y, wave) {
        super(x, y, wave);
        this.radius = 22;
        this.baseSpeed = 45 + wave * 4;
        this.speed = this.baseSpeed;
        this.health = 180 + wave * 25;
        this.maxHealth = this.health;
        this.damage = 18 + wave * 3;
        this.zombieType = 'tank';
    }
}

class SpitterZombie extends Zombie {
    constructor(x, y, wave) {
        super(x, y, wave);
        this.radius = 14;
        this.baseSpeed = 60 + wave * 5;
        this.speed = this.baseSpeed;
        this.health = 50 + wave * 10;
        this.maxHealth = this.health;
        this.damage = 10 + wave * 2;
        this.zombieType = 'spitter';
        this.spitCooldown = 0;
        this.spitRange = 300;
    }

    update(dt, player, world) {
        super.update(dt, player, world);
        
        if (this.dead) return;
        
        const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
        
        if (distToPlayer < this.spitRange && this.spitCooldown <= 0) {
            this.spit(player, world);
            this.spitCooldown = 2.5;
        }
        
        if (this.spitCooldown > 0) this.spitCooldown -= dt;
    }

    spit(player, world) {
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        const speed = 250;
        const proj = new Projectile(
            this.x, this.y,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            this.damage,
            false,
            '#9b59b6',
            6,
            3
        );
        world.projectiles.push(proj);
    }
}

class ExploderZombie extends Zombie {
    constructor(x, y, wave) {
        super(x, y, wave);
        this.radius = 15;
        this.baseSpeed = 160 + wave * 12;
        this.speed = this.baseSpeed;
        this.health = 35 + wave * 8;
        this.maxHealth = this.health;
        this.damage = 35;
        this.zombieType = 'exploder';
        this.exploded = false;
    }

    attack(player, world) {
        if (this.attackCooldown <= 0 && !this.exploded) {
            this.explode(world);
            this.attackCooldown = 999;
        }
    }

    explode(world) {
        this.exploded = true;
        this.dead = true;
        
        const explosionRadius = 80;
        const explosionDamage = this.damage;
        
        world.createParticles(this.x, this.y, 20, '#e67e22');
        
        const distToPlayer = Math.hypot(world.player.x - this.x, world.player.y - this.y);
        if (distToPlayer < explosionRadius) {
            world.player.takeDamage(explosionDamage);
        }
        
        for (const z of world.zombies) {
            if (z === this || z.dead) continue;
            const dist = Math.hypot(z.x - this.x, z.y - this.y);
            if (dist < explosionRadius) {
                z.takeDamage(explosionDamage * 0.5, world);
            }
        }
        
        if (audio.initialized) audio.playExplosion();
    }
}

class BossZombie extends Zombie {
    constructor(x, y, wave) {
        super(x, y, wave);
        this.radius = 35;
        this.baseSpeed = 55 + wave * 3;
        this.speed = this.baseSpeed;
        this.health = 500 + wave * 100;
        this.maxHealth = this.health;
        this.damage = 20 + wave * 4;
        this.zombieType = 'boss';
        this.attackCooldown = 0;
        this.specialCooldown = 0;
        this.summonCooldown = 0;
    }

    update(dt, player, world) {
        if (this.dead) return;
        
        if (world.nightActive) {
            this.eyeGlow = true;
            this.speed = this.baseSpeed * 1.3;
        } else {
            this.eyeGlow = true;
            this.speed = this.baseSpeed;
        }

        const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
        const detectRange = 400;

        if (distToPlayer < detectRange) {
            this.state = 'chase';
            this.lastKnownX = player.x;
            this.lastKnownY = player.y;
            this.smellTimer = 5;
        } else if (this.smellTimer > 0) {
            this.state = 'chase';
            this.smellTimer -= dt;
        } else {
            this.state = 'idle';
        }

        if (this.state === 'chase') {
            const tx = this.smellTimer > 0 ? this.lastKnownX : player.x;
            const ty = this.smellTimer > 0 ? this.lastKnownY : player.y;
            const angle = Math.atan2(ty - this.y, tx - this.x);
            this.vx = Math.cos(angle) * this.speed;
            this.vy = Math.sin(angle) * this.speed;
        } else {
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                this.wanderAngle = Math.random() * Math.PI * 2;
                this.wanderTimer = 2 + Math.random() * 3;
            }
            this.vx = Math.cos(this.wanderAngle) * (this.speed * 0.2);
            this.vy = Math.sin(this.wanderAngle) * (this.speed * 0.2);
        }

        if (this.knockbackTimer > 0) {
            this.knockbackTimer -= dt;
            const kbDecay = Math.max(0, this.knockbackTimer / 0.15);
            this.vx *= kbDecay;
            this.vy *= kbDecay;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        this.x = Math.max(this.radius, Math.min(world.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(world.height - this.radius, this.y));

        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.specialCooldown > 0) this.specialCooldown -= dt;
        
        if (this.specialCooldown <= 0 && distToPlayer < 200) {
            this.specialAttack(world);
            this.specialCooldown = 5;
        }
    }

    attack(player, world) {
        if (this.attackCooldown <= 0) {
            player.takeDamage(this.damage);
            this.attackCooldown = 0.8;
            world.createParticles(player.x, player.y, 6, '#c0392b');
        }
    }

    specialAttack(world) {
        const type = Math.random();
        
        if (type < 0.33) {
            this.groundPound(world);
        } else if (type < 0.66) {
            this.charge(world);
        } else {
            this.summonMinions(world);
        }
    }

    groundPound(world) {
        const dist = Math.hypot(world.player.x - this.x, world.player.y - this.y);
        if (dist < 150) {
            world.player.takeDamage(30);
        }
        world.createParticles(this.x, this.y, 30, '#8B4513');
        if (audio.initialized) audio.playExplosion();
    }

    charge(world) {
        const angle = Math.atan2(world.player.y - this.y, world.player.x - this.x);
        this.vx = Math.cos(angle) * 400;
        this.vy = Math.sin(angle) * 400;
        world.createParticles(this.x, this.y, 15, '#e74c3c');
    }

    summonMinions(world) {
        for (let i = 0; i < 5; i++) {
            const a = Math.random() * Math.PI * 2;
            const d = 100 + Math.random() * 50;
            const x = this.x + Math.cos(a) * d;
            const y = this.y + Math.sin(a) * d;
            world.zombies.push(new Zombie(x, y, world.wave));
        }
        world.showNotification('BOSS SUMMONS MINIONS!');
    }

    takeDamage(amount, world) {
        this.health -= amount;
        
        if (this.health <= 0 && !this.dead) {
            this.dead = true;
            world.score += 100;
            world.createParticles(this.x, this.y, 30, '#f39c12');
            
            for (let i = 0; i < 3; i++) {
                const powerType = ['speed', 'shield', 'rage', 'time_slow', 'shockwave', 'heal'][Math.floor(Math.random() * 6)];
                world.powerOrbs.push(new PowerOrb(this.x + (Math.random() - 0.5) * 50, this.y + (Math.random() - 0.5) * 50, powerType));
            }
            
            world.showNotification('BOSS DEFEATED!');
            if (audio.initialized) audio.playLevelUp();
        }
    }
}

class Projectile {
    constructor(x, y, vx, vy, damage, fromPlayer, color, size, knockback) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.damage = damage;
        this.fromPlayer = fromPlayer;
        this.color = color;
        this.radius = size;
        this.life = 3;
        this.knockback = knockback || 0;
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
