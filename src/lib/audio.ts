// Human-written placeholder sound module 
// Safely logs game UI audio triggers to prevent runtime button component crashes

export const sound = {
  isMuted: false,

  playShoot: () => console.log('🔊 Game SFX: Fired weapon'),
  playReload: () => console.log('🔊 Game SFX: Reloaded magazine'),
  playHit: () => console.log('🎯 Game SFX: Target hit successfully'),
  playMiss: () => console.log('💨 Game SFX: Shot missed target'),
  playGameOver: () => console.log('💀 Game SFX: Game over timeline loaded'),
  playLevelUp: () => console.log('⭐ Game SFX: Advanced to next stage'),
  playBlip: () => console.log('🎵 UI SFX: Played menu button click blip'), // 🛠️ Added to stop the crash!
  
  toggleMute() {
    this.isMuted = !this.isMuted;
    console.log(`Sound muted state set to: ${this.isMuted}`);
  },
  
  getMuteState() {
    return this.isMuted;
  }
};

export const playSound = (name: string) => {
  console.log(`Triggering custom sound string: ${name}`);
};

export const stopSound = () => {
  console.log('All active sound channels halted');
};

export default {
  sound,
  playSound,
  stopSound
};
