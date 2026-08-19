const POWER_TYPES = {
    speed: { name: 'SPD', color: '#3498db', cooldown: 30, duration: 5 },
    shield: { name: 'SHD', color: '#2ecc71', cooldown: 30, duration: 5 },
    rage: { name: 'RGE', color: '#e74c3c', cooldown: 30, duration: 5 },
    time_slow: { name: 'SLW', color: '#9b59b6', cooldown: 35, duration: 6 },
    shockwave: { name: 'SHK', color: '#e74c3c', cooldown: 45, duration: 0.5 },
    heal: { name: 'HLT', color: '#27ae60', cooldown: 40, duration: 0.5 }
};

function updatePowerUI(player) {
    const container = document.getElementById('powerBar');
    if (!container) return;
    container.innerHTML = '';

    const buttons = container.querySelectorAll('.power-button');
    buttons.forEach(btn => {
        const power = btn.dataset.power;
        const config = POWER_TYPES[power];
        if (!config) return;

        const remaining = player.powerCooldowns[power] || 0;
        const isOnCooldown = remaining > 0;
        const isActive = player.activePowers.includes(power);

        btn.classList.toggle('on-cooldown', isOnCooldown);
        btn.classList.toggle('active', isActive && !isOnCooldown);

        const existingOverlay = btn.querySelector('.power-cooldown-overlay');
        if (existingOverlay) existingOverlay.remove();

        if (isOnCooldown) {
            const overlay = document.createElement('div');
            overlay.className = 'power-cooldown-overlay';
            overlay.textContent = Math.ceil(remaining);
            btn.appendChild(overlay);
        }
    });
}
