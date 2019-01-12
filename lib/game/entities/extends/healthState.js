const HealthState = (health) => ({
  health,
  maxHealth: health,
  isDead: false,
});

module.exports = HealthState;
