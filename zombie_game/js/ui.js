function updatePowerUI(player) {
    const container = document.getElementById('powerBar');
    if (!container) return;
    container.innerHTML = '';
    
    const powerNames = {
        speed: 'SPEED',
        shield: 'SHIELD',
        rage: 'RAGE',
        time_slow: 'WARP',
        shockwave: 'SHOCK',
        heal: 'HEAL'
    };
    
    const powerColors = {
        speed: '#3498db',
        shield: '#2ecc71',
        rage: '#e74c3c',
        time_slow: '#9b59b6',
        shockwave: '#e74c3c',
        heal: '#27ae60'
    };
    
    const durations = {
        speed: 5,
        shield: 5,
        rage: 4,
        time_slow: 6,
        shockwave: 0.5,
        heal: 0.5
    };
    
    for (const power of player.activePowers) {
        if (player.powerTimers[power] > 0) {
            const el = document.createElement('div');
            el.className = 'power-indicator';
            el.textContent = powerNames[power] || power.toUpperCase();
            
            const maxDuration = durations[power] || 1;
            const pct = Math.max(0, (player.powerTimers[power] / maxDuration) * 100);
            const color = powerColors[power] || '#fff';
            el.style.background = `linear-gradient(90deg, ${color} ${pct}%, #333 ${pct}%)`;
            
            container.appendChild(el);
        }
    }
}
