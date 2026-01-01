/**
 * Notification Service for browser notifications
 */

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
}

class NotificationService {
  private permission: NotificationPermission = 'default';
  private unreadCount: number = 0;
  private soundEnabled: boolean = true;
  private vibrationEnabled: boolean = true;
  private notificationSound: HTMLAudioElement | null = null;

  constructor() {
    this.checkPermission();
    this.loadSettings();
    this.initializeSound();
  }

  private checkPermission(): void {
    if ('Notification' in window) {
      this.permission = Notification.permission;
    }
  }

  private loadSettings(): void {
    try {
      const stored = localStorage.getItem('notification-settings');
      if (stored) {
        const settings = JSON.parse(stored);
        this.soundEnabled = settings.sound !== false;
        this.vibrationEnabled = settings.vibration !== false;
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem('notification-settings', JSON.stringify({
        sound: this.soundEnabled,
        vibration: this.vibrationEnabled,
      }));
    } catch (error) {
      console.error('Error saving notification settings:', error);
    }
  }

  private initializeSound(): void {
    // Create a simple beep sound using Web Audio API
    try {
      // We'll create a simple tone instead of loading a file
      // This avoids needing an audio file
    } catch (error) {
      console.error('Error initializing sound:', error);
    }
  }

  private playSound(): void {
    if (!this.soundEnabled) return;

    try {
      // Create a simple beep using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  }

  private vibrate(): void {
    if (!this.vibrationEnabled || !('vibrate' in navigator)) return;

    try {
      navigator.vibrate(200);
    } catch (error) {
      console.error('Error vibrating:', error);
    }
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied';
    }

    if (this.permission === 'granted') {
      return 'granted';
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }

  /**
   * Show notification (only when tab is not focused)
   */
  async notify(options: NotificationOptions): Promise<void> {
    // Only show notification if tab is not focused
    if (document.hasFocus()) {
      return;
    }

    if (this.permission !== 'granted') {
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        return;
      }
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        badge: options.badge || '/favicon.ico',
        tag: options.tag,
        requireInteraction: options.requireInteraction || false,
        silent: options.silent || !this.soundEnabled,
      });

      // Update unread count
      this.unreadCount++;
      this.updateBadge();

      // Play sound and vibrate
      this.playSound();
      this.vibrate();

      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      // Handle click
      notification.onclick = () => {
        window.focus();
        notification.close();
        this.markAsRead();
      };
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  /**
   * Update browser tab badge
   */
  private updateBadge(): void {
    if ('setAppBadge' in navigator) {
      (navigator as any).setAppBadge(this.unreadCount).catch(() => {
        // Fallback: update document title
        document.title = this.unreadCount > 0
          ? `(${this.unreadCount}) KnowledgeBot`
          : 'KnowledgeBot';
      });
    } else {
      // Fallback: update document title
      document.title = this.unreadCount > 0
        ? `(${this.unreadCount}) KnowledgeBot`
        : 'KnowledgeBot';
    }
  }

  /**
   * Mark notifications as read
   */
  markAsRead(): void {
    this.unreadCount = 0;
    this.updateBadge();
  }

  /**
   * Get unread count
   */
  getUnreadCount(): number {
    return this.unreadCount;
  }

  /**
   * Enable/disable sound
   */
  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    this.saveSettings();
  }

  /**
   * Enable/disable vibration
   */
  setVibrationEnabled(enabled: boolean): void {
    this.vibrationEnabled = enabled;
    this.saveSettings();
  }

  /**
   * Get current settings
   */
  getSettings() {
    return {
      sound: this.soundEnabled,
      vibration: this.vibrationEnabled,
      permission: this.permission,
    };
  }
}

// Singleton instance
export const notificationService = new NotificationService();

