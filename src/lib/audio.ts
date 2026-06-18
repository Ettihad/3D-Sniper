export const sound = {
  playShoot: () => {},
  playReload: () => {},
  playHit: () => {},
  playMiss: () => {},
  playGameOver: () => {},
  playLevelUp: () => {},
  toggleMute: () => {},
  getMuteState: () => false, // 🛠️ Added this missing function to stop the crash!
  isMuted: false
};

export const playSound = () => {};
export const stopSound = () => {};

export default { sound, playSound, stopSound };
