import { initializeEngines, handleMessage } from './message-router';
import type { ChromeMessage, ChromeResponse } from '../messaging';
import { createResponse } from '../messaging';
import { logger } from '../../app/utils/logger';

let initialized = false;

chrome.runtime.onInstalled.addListener(() => {
  logger.info('Extension installed');
  initialize();
});

chrome.runtime.onStartup.addListener(() => {
  logger.info('Extension startup');
  initialize();
});

chrome.runtime.onMessage.addListener(
  (message: ChromeMessage, sender, sendResponse) => {
    handleMessage(message, sender)
      .then(sendResponse)
      .catch((error) => {
        logger.error('Message handling failed', error);
        sendResponse(createResponse(false, undefined, String(error)));
      });
    return true;
  },
);

chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
  logger.debug('Side panel not available, using popup instead');
});

async function initialize(): Promise<void> {
  if (initialized) return;
  try {
    await initializeEngines();
    initialized = true;
    logger.info('Background service worker initialized');
  } catch (error) {
    logger.error('Failed to initialize', error);
  }
}

initialize();
