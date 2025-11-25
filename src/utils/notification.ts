/**
 * Browser Notification Utility
 * Supports both Web and Electron environments
 */

import { MessageItem } from "@openim/wasm-client-sdk/lib/types/entity";
import { MessageType } from "@openim/wasm-client-sdk";

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: any;
  onClick?: () => void;
}

class NotificationManager {
  private static instance: NotificationManager;
  private permission: NotificationPermission = "default";
  private enabled: boolean = true;
  private soundEnabled: boolean = true;
  private permissionChangeCallback?: (permission: NotificationPermission) => void;
  private permissionCheckInterval?: number;
  private isElectron: boolean = false;

  private constructor() {
    this.isElectron = typeof window.electronAPI !== "undefined";
    this.checkPermission();
    this.startPermissionMonitoring();
  }

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  /**
   * Check if notifications are supported
   */
  isSupported(): boolean {
    return "Notification" in window;
  }

  /**
   * Check current permission status
   */
  private checkPermission(): void {
    if (this.isSupported()) {
      this.permission = Notification.permission;
    }
  }

  /**
   * Request notification permission from user
   */
  async requestPermission(): Promise<boolean> {
    console.log("[Notification] Requesting permission...");
    console.log("[Notification] Is supported:", this.isSupported());
    console.log("[Notification] Current permission:", this.permission);

    if (!this.isSupported()) {
      console.warn("[Notification] This browser does not support notifications");
      return false;
    }

    if (this.permission === "granted") {
      console.log("[Notification] Permission already granted");
      return true;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      console.log("[Notification] Permission result:", permission);
      return permission === "granted";
    } catch (error) {
      console.error("[Notification] Failed to request notification permission:", error);
      return false;
    }
  }

  /**
   * Show a notification
   */
  async show(options: NotificationOptions): Promise<Notification | null> {
    if (!this.enabled || !this.isSupported()) {
      return null;
    }

    // Request permission if not granted
    if (this.permission !== "granted") {
      const granted = await this.requestPermission();
      if (!granted) {
        return null;
      }
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon,
        tag: options.tag,
        badge: "/icons/icon.png",
        silent: !this.soundEnabled,
        requireInteraction: false,
        data: options.data,
      });

      // Handle click event
      notification.onclick = () => {
        window.focus();
        notification.close();
        options.onClick?.();
      };

      // Auto close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      return notification;
    } catch (error) {
      console.error("Failed to show notification:", error);
      return null;
    }
  }

  /**
   * Show notification for new message
   */
  async showMessageNotification(message: MessageItem, conversationName: string, onClick?: () => void): Promise<void> {
    console.log("[Notification] showMessageNotification called", {
      conversationName,
      sendID: message.sendID,
      contentType: message.contentType,
    });

    // Don't show notification for own messages
    const selfUserID = localStorage.getItem("IMUserID");
    if (message.sendID === selfUserID) {
      console.log("[Notification] Skipping own message");
      return;
    }

    let title = conversationName;
    let body = this.getMessagePreview(message);
    let icon = message.senderFaceUrl || "/icons/icon.png";

    console.log("[Notification] Showing notification:", { title, body });

    // Show notification
    const notification = await this.show({
      title,
      body,
      icon,
      tag: `conversation_${message.sessionType}_${message.sendID}`,
      data: {
        conversationID: message.sessionType === 1 ? message.sendID : message.groupID,
        sessionType: message.sessionType,
        messageID: message.clientMsgID,
      },
      onClick,
    });

    console.log("[Notification] Notification result:", notification ? "success" : "failed");
  }

  /**
   * Get message preview text
   */
  private getMessagePreview(message: MessageItem): string {
    switch (message.contentType) {
      case MessageType.TextMessage:
        return message.textElem?.content || "";
      case MessageType.PictureMessage:
        return "[图片]";
      case MessageType.VoiceMessage:
        return "[语音]";
      case MessageType.VideoMessage:
        return "[视频]";
      case MessageType.FileMessage:
        return `[文件] ${message.fileElem?.fileName || ""}`;
      case MessageType.AtTextMessage:
        return message.atTextElem?.text || "[有人@你]";
      case MessageType.CardMessage:
        return "[名片]";
      case MessageType.LocationMessage:
        return "[位置]";
      case MessageType.QuoteMessage:
        return `[引用] ${message.quoteElem?.text || ""}`;
      default:
        return "[新消息]";
    }
  }

  /**
   * Enable/disable notifications
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    localStorage.setItem("notificationEnabled", enabled.toString());
  }

  /**
   * Enable/disable notification sound
   */
  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    localStorage.setItem("notificationSoundEnabled", enabled.toString());
  }

  /**
   * Get current settings
   */
  getSettings(): { enabled: boolean; soundEnabled: boolean; permission: NotificationPermission } {
    return {
      enabled: this.enabled,
      soundEnabled: this.soundEnabled,
      permission: this.permission,
    };
  }

  /**
   * Load settings from localStorage
   */
  loadSettings(): void {
    const enabled = localStorage.getItem("notificationEnabled");
    const soundEnabled = localStorage.getItem("notificationSoundEnabled");

    if (enabled !== null) {
      this.enabled = enabled === "true";
    }
    if (soundEnabled !== null) {
      this.soundEnabled = soundEnabled === "true";
    }
  }

  /**
   * Start monitoring permission changes
   */
  private startPermissionMonitoring(): void {
    if (!this.isSupported()) {
      console.log("[Notification] Notifications not supported, skipping monitoring");
      return;
    }

    console.log("[Notification] Starting permission monitoring, current permission:", this.permission);

    // Chrome doesn't support Permissions API onchange for notifications
    // Always use polling for reliable detection
    this.startPollingPermission();
  }

  /**
   * Start polling permission status (fallback method)
   */
  private startPollingPermission(): void {
    console.log("[Notification] Starting permission polling (every 2 seconds)");
    this.permissionCheckInterval = window.setInterval(() => {
      const oldPermission = this.permission;
      this.checkPermission();

      if (oldPermission !== this.permission) {
        console.log("[Notification] Permission changed (polled):", oldPermission, "→", this.permission);
        if (this.permissionChangeCallback) {
          this.permissionChangeCallback(this.permission);
        }
      }
    }, 2000); // Reduced to 2 seconds for faster detection
  }

  /**
   * Stop permission monitoring
   */
  stopPermissionMonitoring(): void {
    if (this.permissionCheckInterval) {
      clearInterval(this.permissionCheckInterval);
      this.permissionCheckInterval = undefined;
    }
  }

  /**
   * Register callback for permission changes
   */
  onPermissionChange(callback: (permission: NotificationPermission) => void): void {
    this.permissionChangeCallback = callback;
  }

  /**
   * Open system notification settings (Electron only)
   */
  async openSystemSettings(): Promise<void> {
    if (this.isElectron && window.electronAPI) {
      console.log("[Notification] Opening system notification settings");
      await window.electronAPI.openNotificationSettings();
    } else {
      console.warn("[Notification] Cannot open system settings in web browser");
    }
  }

  /**
   * Test if notifications can actually be shown (Electron only)
   * Returns true if notification was successfully shown at system level
   */
  async testSystemNotification(): Promise<boolean> {
    if (this.isElectron && window.electronAPI) {
      console.log("[Notification] Testing system notification");
      const result = await window.electronAPI.testNotification();
      console.log("[Notification] Test result:", result);
      return result.success && result.shown;
    }
    console.warn("[Notification] System notification test not available in web browser");
    return false;
  }

  /**
   * Check if running in Electron environment
   */
  isElectronEnvironment(): boolean {
    return this.isElectron;
  }
}

// Export singleton instance
export const notificationManager = NotificationManager.getInstance();

// Auto-load settings on initialization
notificationManager.loadSettings();

// Expose to window for debugging
if (typeof window !== "undefined") {
  (window as any).notificationManager = notificationManager;
  console.log("[Notification] Manager exposed to window.notificationManager for debugging");
}
