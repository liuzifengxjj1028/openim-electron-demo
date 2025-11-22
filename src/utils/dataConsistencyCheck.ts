/**
 * 数据一致性检查工具
 * 用于检测和修复本地存储版本号与实际数据不一致的问题
 */

/**
 * 检查IndexedDB中是否有实际的数据
 * 通过检查conversation和friend表是否有记录
 */
async function hasIndexedDBData(): Promise<boolean> {
  try {
    const databases = await indexedDB.databases();

    // 查找OpenIM相关的数据库
    const openIMDB = databases.find(db =>
      db.name?.includes('openim') ||
      db.name?.includes('OpenIM') ||
      db.name?.includes('OpenCorp')
    );

    if (!openIMDB || !openIMDB.name) {
      console.log('[数据一致性检查] 未找到OpenIM数据库');
      return false;
    }

    return new Promise((resolve) => {
      const request = indexedDB.open(openIMDB.name!);

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        try {
          // 检查常用的数据表
          const storeNames = Array.from(db.objectStoreNames);
          console.log('[数据一致性检查] 数据库表:', storeNames);

          // 尝试检查conversation或friend表是否有数据
          const tablesToCheck = ['conversation', 'friend', 'conversationList', 'friendList'];
          const existingTable = tablesToCheck.find(table => storeNames.includes(table));

          if (!existingTable) {
            console.log('[数据一致性检查] 未找到常用数据表');
            db.close();
            resolve(false);
            return;
          }

          const transaction = db.transaction([existingTable], 'readonly');
          const store = transaction.objectStore(existingTable);
          const countRequest = store.count();

          countRequest.onsuccess = () => {
            const count = countRequest.result;
            console.log(`[数据一致性检查] ${existingTable}表记录数:`, count);
            db.close();
            resolve(count > 0);
          };

          countRequest.onerror = () => {
            console.error('[数据一致性检查] 查询记录数失败');
            db.close();
            resolve(false);
          };
        } catch (error) {
          console.error('[数据一致性检查] 检查数据时出错:', error);
          db.close();
          resolve(false);
        }
      };

      request.onerror = () => {
        console.error('[数据一致性检查] 打开数据库失败');
        resolve(false);
      };
    });
  } catch (error) {
    console.error('[数据一致性检查] IndexedDB检查失败:', error);
    return false;
  }
}

/**
 * 检查localStorage中是否有版本号
 */
function hasVersionInLocalStorage(): boolean {
  try {
    // 检查常见的版本号键
    const versionKeys = ['version', 'conversationVersion', 'friendVersion'];

    for (const key of versionKeys) {
      const value = localStorage.getItem(key);
      if (value && value !== '0' && value !== 'null') {
        console.log(`[数据一致性检查] 找到版本号 ${key}:`, value);
        return true;
      }
    }

    // 遍历localStorage查找包含version的键
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.toLowerCase().includes('version')) {
        const value = localStorage.getItem(key);
        if (value && value !== '0' && value !== 'null') {
          console.log(`[数据一致性检查] 找到版本号 ${key}:`, value);
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error('[数据一致性检查] localStorage检查失败:', error);
    return false;
  }
}

/**
 * 清除所有版本号
 */
function clearVersionNumbers(): void {
  try {
    console.warn('[数据一致性检查] 检测到版本号/数据不一致，清除版本号以触发完全同步');

    // 清除所有包含version的localStorage键
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.toLowerCase().includes('version')) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => {
      console.log(`[数据一致性检查] 清除版本号: ${key}`);
      localStorage.removeItem(key);
    });

    console.log('[数据一致性检查] 版本号已清除，下次同步将获取完整数据');
  } catch (error) {
    console.error('[数据一致性检查] 清除版本号失败:', error);
  }
}

/**
 * 执行数据一致性检查
 * 如果发现版本号存在但数据缺失，自动清除版本号
 *
 * @returns Promise<boolean> 返回true表示数据一致，false表示已修复不一致
 */
export async function checkDataConsistency(): Promise<boolean> {
  console.log('[数据一致性检查] 开始检查数据一致性');

  const hasVersion = hasVersionInLocalStorage();
  const hasData = await hasIndexedDBData();

  console.log('[数据一致性检查] 检查结果:', {
    hasVersion,
    hasData,
  });

  // 如果有版本号但没有数据，说明数据不一致
  if (hasVersion && !hasData) {
    console.warn('[数据一致性检查] 发现版本号与数据不一致！');
    clearVersionNumbers();
    return false; // 数据不一致，已修复
  }

  console.log('[数据一致性检查] 数据一致性检查通过');
  return true; // 数据一致
}

/**
 * 清除所有本地数据（包括版本号和IndexedDB）
 * 用于强制重新同步
 */
export async function clearAllLocalData(): Promise<void> {
  try {
    console.warn('[数据一致性检查] 清除所有本地数据');

    // 清除localStorage中的版本号
    clearVersionNumbers();

    // 清除IndexedDB
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name && (
        db.name.includes('openim') ||
        db.name.includes('OpenIM') ||
        db.name.includes('OpenCorp')
      )) {
        console.log(`[数据一致性检查] 删除数据库: ${db.name}`);
        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(db.name!);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }
    }

    console.log('[数据一致性检查] 所有本地数据已清除');
  } catch (error) {
    console.error('[数据一致性检查] 清除本地数据失败:', error);
    throw error;
  }
}
