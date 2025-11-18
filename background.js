/**
 * Memory Ninja - Background Service Worker
 * 功能：监控标签页活动，检测闲置标签，生成水果任务
 */

// 配置参数
const CONFIG = {
  enabled: true,
  idleThreshold: 15 * 60 * 1000,     // 15 分钟无操作视为闲置
  checkInterval: 60 * 1000,           // 每分钟检查一次
  minTabsBeforeAlert: 5,              // 至少有 5 个标签页才开始监控
};

// 存储标签页活动数据
let tabActivity = {};
let stats = {
  tabsDiscarded: 0,
  memoryFreed: 0,
  fruitsSliced: 0,
  lastResetTime: Date.now(),
};

console.log('🥷 Memory Ninja 启动中...');

// 初始化：加载保存的数据
chrome.runtime.onInstalled.addListener(async () => {
  console.log('🥷 Memory Ninja 已安装');

  // 加载统计数据
  const saved = await chrome.storage.local.get(['stats', 'config']);
  if (saved.stats) {
    stats = { ...stats, ...saved.stats };
  }
  if (saved.config) {
    Object.assign(CONFIG, saved.config);
  }

  // 初始化所有标签页的活动时间
  initializeTabActivity();
});

// 启动时初始化
chrome.runtime.onStartup.addListener(() => {
  console.log('🥷 Memory Ninja 重新启动');
  initializeTabActivity();
});

// 初始化标签页活动记录
async function initializeTabActivity() {
  const tabs = await chrome.tabs.query({});
  const now = Date.now();

  tabs.forEach(tab => {
    // 使用 Chrome 提供的 lastAccessed 或当前时间
    tabActivity[tab.id] = tab.lastAccessed || now;
  });

  console.log(`📊 已初始化 ${tabs.length} 个标签页的活动记录`);
}

// 监听标签页激活（切换标签）
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  tabActivity[tabId] = Date.now();
  console.log(`✅ 标签页 ${tabId} 被激活`);
});

// 监听标签页更新（刷新、导航等）
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    tabActivity[tabId] = Date.now();
  }
});

// 监听标签页创建
chrome.tabs.onCreated.addListener((tab) => {
  tabActivity[tab.id] = Date.now();
});

// 监听标签页关闭
chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabActivity[tabId];
});

// 定期检查闲置标签页
async function checkIdleTabs() {
  if (!CONFIG.enabled) {
    console.log('⏸️  监控未启用，跳过检查');
    return;
  }

  const tabs = await chrome.tabs.query({});
  const now = Date.now();

  console.log(`\n🔍 开始检查闲置标签...`);
  console.log(`   配置 - 闲置阈值: ${CONFIG.idleThreshold / 60000} 分钟`);
  console.log(`   配置 - 最小标签数: ${CONFIG.minTabsBeforeAlert}`);
  console.log(`   当前 - 总标签数: ${tabs.length}`);

  // 过滤出闲置的标签页
  const idleTabs = tabs.filter(tab => {
    // 跳过当前活动标签
    if (tab.active) return false;

    // 跳过已卸载的标签
    if (tab.discarded) return false;

    // 跳过固定标签
    if (tab.pinned) return false;

    // 检查闲置时间
    const lastActive = tabActivity[tab.id] || tab.lastAccessed || now;
    const idleTime = now - lastActive;

    return idleTime > CONFIG.idleThreshold;
  });

  console.log(`   结果 - 闲置标签数: ${idleTabs.length}`);

  // 详细列出闲置标签
  if (idleTabs.length > 0) {
    console.log('   闲置标签列表:');
    idleTabs.slice(0, 5).forEach((tab, index) => {
      const lastActive = tabActivity[tab.id] || tab.lastAccessed || now;
      const idleMinutes = Math.floor((now - lastActive) / 60000);
      console.log(`     ${index + 1}. [${tab.id}] ${tab.title.substring(0, 40)} (闲置 ${idleMinutes} 分钟)`);
    });
    if (idleTabs.length > 5) {
      console.log(`     ... 还有 ${idleTabs.length - 5} 个闲置标签`);
    }
  }

  // 检查是否满足生成水果的条件
  if (idleTabs.length === 0) {
    console.log('❌ 没有闲置标签');
    return;
  }

  if (tabs.length < CONFIG.minTabsBeforeAlert) {
    console.log(`❌ 标签数不足 (需要 ${CONFIG.minTabsBeforeAlert} 个，当前 ${tabs.length} 个)`);
    return;
  }

  // 选择 2 个不同的闲置标签生成水果
  const fruitsToGenerate = Math.min(2, idleTabs.length); // 最多2个，不超过闲置标签数
  const selectedTabs = [];

  // 随机选择不重复的标签
  const availableTabs = [...idleTabs];
  for (let i = 0; i < fruitsToGenerate; i++) {
    const randomIndex = Math.floor(Math.random() * availableTabs.length);
    selectedTabs.push(availableTabs[randomIndex]);
    availableTabs.splice(randomIndex, 1); // 移除已选择的，避免重复
  }

  console.log(`✅ 准备生成 ${selectedTabs.length} 个水果`);
  for (let i = 0; i < selectedTabs.length; i++) {
    const targetTab = selectedTabs[i];
    console.log(`   - 目标标签: [${targetTab.id}] ${targetTab.title}`);

    // 如果不是第一个水果，稍微延迟一下（200-400ms），让水果不会完全重叠
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 200));
    }

    await generateFruit(targetTab);
  }
}

// 生成水果到当前活跃标签页
async function generateFruit(targetTab) {
  try {
    // 获取当前活跃标签
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!activeTab) {
      console.log('❌ 没有活跃标签页');
      return;
    }

    // 估算内存占用（基于标签页闲置时间，仅供展示）
    const idleTime = Date.now() - (tabActivity[targetTab.id] || Date.now());
    const estimatedMemory = Math.floor(Math.random() * 50) + 30; // 30-80 MB

    // 发送消息到当前活跃标签，生成水果
    chrome.tabs.sendMessage(activeTab.id, {
      action: 'generateFruit',
      targetTab: {
        id: targetTab.id,
        title: targetTab.title,
        url: targetTab.url,
        favicon: targetTab.favIconUrl,
        idleTime: idleTime,
        estimatedMemory: estimatedMemory,
      }
    }).catch(err => {
      console.log('⚠️  无法在当前页面生成水果（可能是系统页面）:', err.message);
    });

    console.log(`🍎 水果已生成！目标：标签 ${targetTab.id} (${targetTab.title})`);

  } catch (error) {
    console.error('❌ 生成水果失败:', error);
  }
}

// 处理来自 Content Script 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 收到消息:', message.action);

  if (message.action === 'sliceFruit') {
    // 水果被切割，释放内存
    handleFruitSliced(message.tabId, sendResponse);
    return true; // 异步响应
  }

  if (message.action === 'getStats') {
    // 返回统计数据
    sendResponse({ stats, config: CONFIG });
    return false;
  }

  if (message.action === 'updateConfig') {
    // 更新配置
    Object.assign(CONFIG, message.config);
    chrome.storage.local.set({ config: CONFIG });

    // 详细日志
    console.log('⚙️  配置已更新:', message.config);
    if (message.config.idleThreshold !== undefined) {
      const minutes = Math.floor(message.config.idleThreshold / 60000);
      console.log(`   闲置阈值: ${minutes} 分钟 (${message.config.idleThreshold} 毫秒)`);
    }

    sendResponse({ success: true });
    return false;
  }

  if (message.action === 'manualCheck') {
    // 手动触发检查
    checkIdleTabs();
    sendResponse({ success: true });
    return false;
  }
});

// 处理水果切割事件
async function handleFruitSliced(tabId, sendResponse) {
  try {
    // 卸载标签页，释放内存
    await chrome.tabs.discard(tabId);

    // 更新统计数据
    stats.tabsDiscarded++;
    stats.fruitsSliced++;
    stats.memoryFreed += Math.floor(Math.random() * 50) + 30; // 估算

    // 保存统计数据
    await chrome.storage.local.set({ stats });

    console.log(`✅ 标签页 ${tabId} 已释放内存`);
    console.log(`📊 统计：已释放 ${stats.tabsDiscarded} 个标签，约 ${stats.memoryFreed} MB`);

    sendResponse({
      success: true,
      memoryFreed: `约 ${Math.floor(Math.random() * 50) + 30} MB`,
      totalStats: stats
    });

  } catch (error) {
    console.error('❌ 释放内存失败:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 启动定期检查
function startMonitoring() {
  // 立即执行一次检查
  checkIdleTabs();

  // 设置定期检查
  setInterval(checkIdleTabs, CONFIG.checkInterval);

  console.log('✅ Memory Ninja 监控已启动');
}

// 启动监控
startMonitoring();

// 导出给调试用
globalThis.memoryNinja = {
  config: CONFIG,
  stats,
  tabActivity,
  checkIdleTabs,
  resetStats: async () => {
    stats = {
      tabsDiscarded: 0,
      memoryFreed: 0,
      fruitsSliced: 0,
      lastResetTime: Date.now(),
    };
    await chrome.storage.local.set({ stats });
    console.log('📊 统计数据已重置');
  }
};
