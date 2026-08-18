function updatePowerUI(player) {
    const container = document.getElementById('powerBar');
    if (!container) return;
    container.innerHTML = '';
    
    const powerNames = {
        speed: 'SPEED',
        shield: 'SHIELD',
        rage: 'RAGE',
        time_slow: 'WARP',
        airstrike: 'STRIKE',
        heal: 'HEAL'
    };
    
    const powerColors = {
        speed: '#3498db',
        shield: '#2ecc71',
        rage: '#e74c3c',
        time_slow: '#9b59b6',
        airstrike: '#f39c12',
        heal: '#27ae60'
    };
    
    const durations = {
        speed: 5,
        shield: 5,
        rage: 4,
        time_slow: 6,
        airstrike: 0.5,
        heal: 0.5
    };
    
    for (const power of player.activePowers) {
        if (player.powerTimers[power] > 0) {
            const el = document.createElement('div');
            el.className = 'power-indicator';
            el.textContent = powerNames[power] || power.toUpperCase();
            
            const existingOverlay = el.querySelector('.power-cooldown-overlay');
            if (existingOverlay) existingOverlay.remove();

            const remaining = player.powerCooldowns[power] || 0;
            if (remaining > 0) {
                const overlay = document.createElement('div');
                overlay.className = 'power-cooldown-overlay';
                overlay.textContent = Math.ceil(remaining);
                el.appendChild(overlay);
            }
            
            container.appendChild(el);
        }
    }
}
