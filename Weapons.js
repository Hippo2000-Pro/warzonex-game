export const WEAPONS = [
  { key: 'rifle', label: 'Rifle', fireRate: 0.15, damage: 18, speed: 560, spread: 0.08, pellets: 1, color: '#8de4bb', range: 620, magazine: 30, reloadTime: 1.2 },
  { key: 'shotgun', label: 'Shotgun', fireRate: 0.7, damage: 10, speed: 500, spread: 0.42, pellets: 7, color: '#ffd877', range: 340, magazine: 8, reloadTime: 1.6 },
  { key: 'smg', label: 'SMG', fireRate: 0.08, damage: 8, speed: 540, spread: 0.16, pellets: 1, color: '#7fd3ff', range: 540, magazine: 45, reloadTime: 1.1 },
  { key: 'sniper', label: 'Sniper', fireRate: 1.1, damage: 55, speed: 820, spread: 0.02, pellets: 1, color: '#f6c9ff', range: 980, magazine: 6, reloadTime: 1.9 },
];

export function getWeapon(index) {
  return WEAPONS[index] || WEAPONS[0];
}
