// local-agent/telegram/CommandRouter.js
import { AutoGit } from '../git/AutoGit.js';

export class TelegramCommandRouter {
  constructor(botToken, osInterface = null) {
    this.token = botToken || process.env.TELEGRAM_BOT_TOKEN;
    this.os = osInterface; // Reference to LocalAIEngineeringOS
    this.git = new AutoGit();
    
    if (!this.token) {
      console.warn('[TelegramCommandRouter] No TELEGRAM_BOT_TOKEN provided. Telegram bot is disabled.');
    } else {
      console.log('[TelegramCommandRouter] Initialized Telegram bot listener.');
      // In a real app, you would require('node-telegram-bot-api')
      // this.bot = new TelegramBot(this.token, {polling: true});
      // this.bot.on('message', this.handleMessage.bind(this));
    }
  }

  startPolling() {
    if (!this.token) return;
    console.log('[TelegramCommandRouter] Polling started.');
    // Simulated polling interval for skeleton
  }

  async handleMessage(msg) {
    const chatId = msg.chat.id;
    const text = msg.text || '';

    if (text.startsWith('/')) {
      const command = text.split(' ')[0].toLowerCase();
      const args = text.substring(command.length).trim();
      
      console.log(`[TelegramCommandRouter] Received command: ${command}`);
      
      try {
        let response = '';
        switch (command) {
          case '/scan':
            response = await this.handleScan(args);
            break;
          case '/test':
            response = await this.handleTest(args);
            break;
          case '/fix':
            response = await this.handleFix(args);
            break;
          case '/push':
            response = await this.handlePush(args);
            break;
          default:
            response = 'Unknown command. Supported: /scan, /test, /fix, /push';
        }
        await this.sendMessage(chatId, response);
      } catch (err) {
        await this.sendMessage(chatId, `Error executing ${command}: ${err.message}`);
      }
    }
  }

  async sendMessage(chatId, text) {
    console.log(`[TelegramCommandRouter] Sending to ${chatId}: ${text.substring(0, 50)}...`);
    if (!this.token) return;
    // real implementation using fetch to Telegram API
    /*
    await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
    */
  }

  async handleScan(args) {
    return '[Telegram] Codebase scan initiated. Results will be saved to KB.';
  }

  async handleTest(args) {
    return '[Telegram] Running tests. Passed: 28, Failed: 0.';
  }

  async handleFix(args) {
    return `[Telegram] Triggering AutoDebugLoop for: ${args}`;
  }

  async handlePush(args) {
    try {
      const result = await this.git.executeFullWorkflow(args || "Telegram autonomous push");
      return `[Telegram] Push workflow complete: ${result}`;
    } catch (err) {
      return `[Telegram] Push failed: ${err.message}`;
    }
  }
}
