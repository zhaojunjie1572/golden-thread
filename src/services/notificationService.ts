import { ProtocolModel, hasExecutedToday } from '../types/protocol';

interface ScheduledReminder {
  protocolId: string;
  timeoutId: number;
}

class NotificationService {
  private scheduledReminders: Map<string, ScheduledReminder> = new Map();
  private notificationPermission: NotificationPermission = 'default';

  constructor() {
    this.init();
  }

  private init() {
    if ('Notification' in window) {
      this.notificationPermission = Notification.permission;
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('浏览器不支持通知');
      return false;
    }

    if (this.notificationPermission === 'granted') {
      return true;
    }

    try {
      const permission = await Notification.requestPermission();
      this.notificationPermission = permission;
      return permission === 'granted';
    } catch (error) {
      console.error('请求通知权限失败:', error);
      return false;
    }
  }

  hasPermission(): boolean {
    return this.notificationPermission === 'granted';
  }

  scheduleReminder(protocol: ProtocolModel) {
    if (!protocol.reminderTime) return;

    this.cancelReminder(protocol.id);

    const [hours, minutes] = protocol.reminderTime.split(':').map(Number);
    const now = new Date();
    const reminderTime = new Date();
    reminderTime.setHours(hours, minutes, 0, 0);

    if (reminderTime <= now) {
      reminderTime.setDate(reminderTime.getDate() + 1);
    }

    const delay = reminderTime.getTime() - now.getTime();

    console.log(`⏰ 为 "${protocol.principle}" 安排提醒于 ${reminderTime.toLocaleString('zh-CN')}`);

    const timeoutId = window.setTimeout(() => {
      this.checkAndSendNotification(protocol);
      this.scheduleReminder(protocol);
    }, delay);

    this.scheduledReminders.set(protocol.id, {
      protocolId: protocol.id,
      timeoutId
    });
  }

  private checkAndSendNotification(protocol: ProtocolModel) {
    if (hasExecutedToday(protocol)) {
      console.log(`📝 "${protocol.principle}" 今天已执行，跳过提醒`);
      return;
    }

    this.sendNotification(protocol);
  }

  sendNotification(protocol: ProtocolModel) {
    if (!this.hasPermission()) {
      console.warn('没有通知权限');
      return;
    }

    try {
      const notification = new Notification('金线 - 行动提醒', {
        body: `该执行了：${protocol.minimumAction}`,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">✨</text></svg>',
        tag: protocol.id,
        requireInteraction: true
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      console.log(`🔔 发送提醒: ${protocol.principle}`);
    } catch (error) {
      console.error('发送通知失败:', error);
    }
  }

  cancelReminder(protocolId: string) {
    const reminder = this.scheduledReminders.get(protocolId);
    if (reminder) {
      clearTimeout(reminder.timeoutId);
      this.scheduledReminders.delete(protocolId);
      console.log(`❌ 取消提醒: ${protocolId}`);
    }
  }

  cancelAllReminders() {
    for (const [, reminder] of this.scheduledReminders) {
      clearTimeout(reminder.timeoutId);
    }
    this.scheduledReminders.clear();
    console.log('❌ 取消所有提醒');
  }

  scheduleAllReminders(protocols: ProtocolModel[]) {
    this.cancelAllReminders();
    
    for (const protocol of protocols) {
      if (protocol.reminderTime) {
        this.scheduleReminder(protocol);
      }
    }
  }

  getScheduledReminders(): string[] {
    return Array.from(this.scheduledReminders.keys());
  }
}

export const notificationService = new NotificationService();
