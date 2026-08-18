class AudioSystem {
    constructor() {
        this.ctx = null;
        this.initialized = false;
        this.droneOsc = null;
        this.droneGain = null;
        this.filter = null;
        this.lfo = null;
        this.lfoGain = null;
        this.isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent);
        this.volumeBoost = this.isMobile ? 2.5 : 1;
    }

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
            this.createDrone();
        } catch (e) {
            console.warn('Web Audio API not available');
        }
    }

    createDrone() {
        if (!this.ctx) return;
        this.droneOsc = this.ctx.createOscillator();
        this.droneGain = this.ctx.createGain();
        this.filter = this.ctx.createBiquadFilter();
        this.lfo = this.ctx.createOscillator();
        this.lfoGain = this.ctx.createGain();

        this.droneOsc.type = 'sawtooth';
        this.droneOsc.frequency.value = 38;
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 180;
        this.filter.Q.value = 5;
        this.droneGain.gain.value = 0.08 * this.volumeBoost;
        this.lfo.type = 'sine';
        this.lfo.frequency.value = 0.08;
        this.lfoGain.gain.value = 12;

        this.lfo.connect(this.lfoGain);
        this.lfoGain.connect(this.droneOsc.frequency);
        this.droneOsc.connect(this.filter);
        this.filter.connect(this.droneGain);
        this.droneGain.connect(this.ctx.destination);

        this.droneOsc.start();
        this.lfo.start();
    }

    updateIntensity(zombieCount) {
        if (!this.ctx || !this.initialized) return;
        const intensity = Math.min(zombieCount / 40, 1);
        const now = this.ctx.currentTime;
        const baseFreq = 38 + intensity * 35;
        const filterFreq = 180 + intensity * 500;
        const gain = (0.08 + intensity * 0.14) * this.volumeBoost;

        this.droneOsc.frequency.setTargetAtTime(baseFreq, now, 1.5);
        this.filter.frequency.setTargetAtTime(filterFreq, now, 1.5);
        this.droneGain.gain.setTargetAtTime(gain, now, 1.5);
        this.lfo.frequency.setTargetAtTime(0.08 + intensity * 0.25, now, 1.5);
    }

    playShoot() {
        if (!this.ctx || !this.initialized) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(180, t);
        osc.frequency.exponentialRampToValueAtTime(35, t + 0.08);
        gain.gain.setValueAtTime(0.12 * this.volumeBoost, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.08);
    }

    playHit() {
        if (!this.ctx || !this.initialized) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(90, t);
        osc.frequency.exponentialRampToValueAtTime(25, t + 0.12);
        gain.gain.setValueAtTime(0.08 * this.volumeBoost, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.12);
    }

    playPickup() {
        if (!this.ctx || !this.initialized) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(350, t);
        osc.frequency.exponentialRampToValueAtTime(900, t + 0.08);
        gain.gain.setValueAtTime(0.09 * this.volumeBoost, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.08);
    }

    playLevelUp() {
        if (!this.ctx || !this.initialized) return;
        const t = this.ctx.currentTime;
        [523, 659, 784, 1047].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.12 * this.volumeBoost, t + i * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.2);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t + i * 0.08);
            osc.stop(t + i * 0.08 + 0.2);
        });
    }

    playBossHit() {
        if (!this.ctx || !this.initialized) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.3);
        gain.gain.setValueAtTime(0.18 * this.volumeBoost, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.3);
    }

    playPowerUp() {
        if (!this.ctx || !this.initialized) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.2);
        gain.gain.setValueAtTime(0.15 * this.volumeBoost, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.25);
    }

    playExplosion() {
        if (!this.ctx || !this.initialized) return;
        const t = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * 0.3;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.3 * this.volumeBoost, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, t);
        filter.frequency.exponentialRampToValueAtTime(100, t + 0.3);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start(t);
    }
}
