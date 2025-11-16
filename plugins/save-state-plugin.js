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
 * Save State Plugin
 * 
 * Provides save/load functionality for persisting game state.
 * Supports both browser localStorage and Node.js file system.
 * 
 * @example
 * import saveStatePlugin from './save-state-plugin.js';
 * pluginHost.load('save-state', saveStatePlugin.init);
 * 
 * // Save game
 * engine.saveGame('mygame');
 * 
 * // Load game
 * engine.loadGame('mygame');
 * 
 * // Enable auto-save
 * engine.enableAutoSave(30000); // Every 30 seconds
 */

/**
 * Initialize the save state plugin
 * 
 * @param {Engine} engine - Game engine instance
 * @param {Object} config - Plugin configuration
 * @param {string} config.storageType - 'localStorage', 'file', or 'auto' (default: 'auto')
 * @param {string} config.saveDir - Directory for file saves (default: './saves')
 * @param {boolean} config.compress - Compress save data (default: false)
 * @param {number} config.autoSaveInterval - Auto-save interval in ms (default: null)
 */
export function init(engine, config = {}) {
  const {
    storageType = 'auto',
    saveDir = './saves',
    compress = false,
    autoSaveInterval = null
  } = config;
  
  let autoSaveTimer = null;
  let fs = null;
  
  // Detect environment and storage method
  const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  const isNode = typeof process !== 'undefined' && process.versions?.node;
  
  const useStorage = 
    storageType === 'localStorage' ? 'localStorage' :
    storageType === 'file' ? 'file' :
    storageType === 'auto' ? (isBrowser ? 'localStorage' : 'file') :
    'localStorage';
  
  // Load fs module for Node.js
  if (useStorage === 'file' && isNode) {
    import('fs').then(module => {
      fs = module;
      // Ensure save directory exists
      if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir, { recursive: true });
      }
    });
  }
  
  /**
   * Save game state
   */
  engine.saveGame = async (name = 'autosave') => {
    try {
      // Get snapshot
      const snapshot = engine.snapshot();
      
      // Add metadata
      const saveData = {
        version: '1.0',
        timestamp: Date.now(),
        name,
        snapshot
      };
      
      // Serialize
      let data = JSON.stringify(saveData);
      
      // Compress if enabled
      if (compress && typeof TextEncoder !== 'undefined') {
        // Simple compression placeholder
        // In production, use a compression library
        data = btoa(data); // Base64 encode as simple "compression"
      }
      
      // Save based on storage type
      if (useStorage === 'localStorage' && typeof localStorage !== 'undefined') {
        localStorage.setItem(`hypertoken:save:${name}`, data);
        console.log(`✓ Game saved to localStorage: ${name}`);
      } else if (useStorage === 'file' && fs) {
        const filepath = `${saveDir}/${name}.json`;
        fs.writeFileSync(filepath, data, 'utf-8');
        console.log(`✓ Game saved to file: ${filepath}`);
      } else {
        throw new Error('No storage method available');
      }
      
      engine.emit('save:success', { payload: { name } });
      return true;
    } catch (error) {
      console.error('Save failed:', error);
      engine.emit('save:error', { payload: { name, error } });
      return false;
    }
  };
  
  /**
   * Load game state
   */
  engine.loadGame = async (name = 'autosave') => {
    try {
      let data = null;
      
      // Load based on storage type
      if (useStorage === 'localStorage' && typeof localStorage !== 'undefined') {
        data = localStorage.getItem(`hypertoken:save:${name}`);
      } else if (useStorage === 'file' && fs) {
        const filepath = `${saveDir}/${name}.json`;
        if (fs.existsSync(filepath)) {
          data = fs.readFileSync(filepath, 'utf-8');
        }
      } else {
        throw new Error('No storage method available');
      }
      
      if (!data) {
        throw new Error(`Save file not found: ${name}`);
      }
      
      // Decompress if needed
      if (compress && typeof atob !== 'undefined') {
        try {
          data = atob(data);
        } catch (e) {
          // Not compressed, use as-is
        }
      }
      
      // Parse
      const saveData = JSON.parse(data);
      
      // Validate version (in production, handle migration)
      if (saveData.version !== '1.0') {
        console.warn('Save file version mismatch');
      }
      
      // Restore state
      engine.restore(saveData.snapshot);
      
      console.log(`✓ Game loaded: ${name} (saved ${new Date(saveData.timestamp).toLocaleString()})`);
      engine.emit('load:success', { payload: { name, saveData } });
      return true;
    } catch (error) {
      console.error('Load failed:', error);
      engine.emit('load:error', { payload: { name, error } });
      return false;
    }
  };
  
  /**
   * Delete saved game
   */
  engine.deleteSave = async (name) => {
    try {
      if (useStorage === 'localStorage' && typeof localStorage !== 'undefined') {
        localStorage.removeItem(`hypertoken:save:${name}`);
      } else if (useStorage === 'file' && fs) {
        const filepath = `${saveDir}/${name}.json`;
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      }
      
      console.log(`✓ Save deleted: ${name}`);
      engine.emit('save:deleted', { payload: { name } });
      return true;
    } catch (error) {
      console.error('Delete failed:', error);
      return false;
    }
  };
  
  /**
   * List available saves
   */
  engine.listSaves = async () => {
    try {
      const saves = [];
      
      if (useStorage === 'localStorage' && typeof localStorage !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key.startsWith('hypertoken:save:')) {
            const name = key.replace('hypertoken:save:', '');
            const data = localStorage.getItem(key);
            const saveData = JSON.parse(data);
            
            saves.push({
              name,
              timestamp: saveData.timestamp,
              date: new Date(saveData.timestamp).toLocaleString()
            });
          }
        }
      } else if (useStorage === 'file' && fs) {
        const files = fs.readdirSync(saveDir);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            const filepath = `${saveDir}/${file}`;
            const data = fs.readFileSync(filepath, 'utf-8');
            const saveData = JSON.parse(data);
            
            saves.push({
              name: file.replace('.json', ''),
              timestamp: saveData.timestamp,
              date: new Date(saveData.timestamp).toLocaleString(),
              filepath
            });
          }
        }
      }
      
      // Sort by timestamp (newest first)
      saves.sort((a, b) => b.timestamp - a.timestamp);
      
      return saves;
    } catch (error) {
      console.error('List saves failed:', error);
      return [];
    }
  };
  
  /**
   * Enable auto-save
   */
  engine.enableAutoSave = (interval = 30000) => {
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer);
    }
    
    autoSaveTimer = setInterval(() => {
      engine.saveGame('autosave');
    }, interval);
    
    console.log(`✓ Auto-save enabled (every ${interval}ms)`);
  };
  
  /**
   * Disable auto-save
   */
  engine.disableAutoSave = () => {
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer);
      autoSaveTimer = null;
      console.log('✓ Auto-save disabled');
    }
  };
  
  /**
   * Quick save (named by timestamp)
   */
  engine.quickSave = async () => {
    const name = `quicksave-${Date.now()}`;
    return await engine.saveGame(name);
  };
  
  // Enable auto-save if configured
  if (autoSaveInterval) {
    engine.enableAutoSave(autoSaveInterval);
  }
  
  // Clean up on game end
  engine.on('game:end', () => {
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer);
      autoSaveTimer = null;
    }
  });
  
  console.log(`✓ Save state plugin loaded (using ${useStorage})`);
}

// Export for named imports
export default { init };