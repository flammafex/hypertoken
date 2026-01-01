/*
 * Copyright 2025 The Carpocratian Church of Commonality and Equality, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Event Logging Plugin
 * 
 * Logs all engine events to console with timestamps and formatting.
 * Useful for debugging and understanding game flow.
 * 
 * @example
 * import loggingPlugin from './logging-plugin.js';
 * pluginHost.load('logging', loggingPlugin.init);
 */

/**
 * Initialize the logging plugin
 * 
 * @param {Engine} engine - Game engine instance
 * @param {Object} config - Plugin configuration
 * @param {Array<string>} config.events - Events to log (default: all major events)
 * @param {boolean} config.logPayloads - Include payloads in logs (default: true)
 * @param {Function} config.formatter - Custom log formatter
 */
export function init(engine, config = {}) {
  const {
    events = [
      'engine:action',
      'engine:error',
      'engine:policy',
      'rule:triggered',
      'rule:error',
      'turn:changed',
      'round:complete',
      'agent:eliminated',
      'game:end'
    ],
    logPayloads = true,
    formatter = defaultFormatter
  } = config;
  
  // Track log counts
  const logCounts = {};
  
  // Subscribe to events
  events.forEach(eventName => {
    engine.on(eventName, (e) => {
      logCounts[eventName] = (logCounts[eventName] || 0) + 1;
      
      const logMessage = formatter(eventName, e, logCounts[eventName]);
      console.log(logMessage);
      
      if (logPayloads && e.payload) {
        console.log('  Payload:', e.payload);
      }
    });
  });
  
  // Add convenience methods
  engine.loggingPlugin = {
    getCounts: () => ({ ...logCounts }),
    reset: () => {
      Object.keys(logCounts).forEach(key => {
        logCounts[key] = 0;
      });
    }
  };
  
  console.log('✓ Logging plugin loaded - monitoring', events.length, 'events');
}

/**
 * Default log formatter
 */
function defaultFormatter(eventName, event, count) {
  const timestamp = new Date().toISOString();
  const icon = getEventIcon(eventName);
  return `${icon} [${timestamp}] #${count} ${eventName}`;
}

/**
 * Get icon for event type
 */
function getEventIcon(eventName) {
  if (eventName.startsWith('engine:')) return '⚙️';
  if (eventName.startsWith('rule:')) return '📜';
  if (eventName.startsWith('turn:')) return '🔄';
  if (eventName.startsWith('round:')) return '🔁';
  if (eventName.startsWith('agent:')) return '👤';
  if (eventName.startsWith('game:')) return '🎮';
  return '📡';
}

// Export for named imports
export default { init };