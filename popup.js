/**
 * Memory Ninja - Popup 控制面板脚本
 */

// DOM 元素
const elements = {
  tabsDiscarded: document.getElementById('tabsDiscarded'),
  fruitsSliced: document.getElementById('fruitsSliced'),
  memoryFreed: document.getElementById('memoryFreed'),
  manualCheck: document.getElementById('manualCheck'),
  resetStats: document.getElementById('resetStats'),
  toggleEnabled: document.getElementById('toggleEnabled'),
  idleThresholdInput: document.getElementById('idleThresholdInput'),
  applyThreshold: document.getElementById('applyThreshold'),
  status: document.getElementById('status'),
};

// 加载统计数据
async function loadStats() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getStats' });

    if (response && response.stats) {
      const { stats, config } = response;

      // 更新统计数据
      elements.tabsDiscarded.textContent = stats.tabsDiscarded || 0;
      elements.fruitsSliced.textContent = stats.fruitsSliced || 0;
      elements.memoryFreed.textContent = `${stats.memoryFreed || 0} MB`;

      // 更新设置状态
      if (config.enabled) {
        elements.toggleEnabled.classList.add('active');
      } else {
        elements.toggleEnabled.classList.remove('active');
      }

      // 更新闲置阈值输入框
      const thresholdMinutes = Math.floor(config.idleThreshold / 60000);
      elements.idleThresholdInput.value = thresholdMinutes;
    }
  } catch (error) {
    console.error('加载统计数据失败:', error);
    showStatus('无法加载数据', 'error');
  }
}

// 显示状态消息
function showStatus(message, type = 'success') {
  elements.status.textContent = message;
  elements.status.className = 'status show';
  elements.status.style.background = type === 'success'
    ? 'rgba(0, 255, 136, 0.2)'
    : 'rgba(255, 107, 107, 0.2)';

  setTimeout(() => {
    elements.status.classList.remove('show');
  }, 3000);
}

// 手动检查闲置标签
elements.manualCheck.addEventListener('click', async () => {
  try {
    elements.manualCheck.textContent = '检查中...';
    elements.manualCheck.disabled = true;

    await chrome.runtime.sendMessage({ action: 'manualCheck' });

    showStatus('✅ 检查完成！如有闲置标签，水果将在当前页面出现');

    setTimeout(() => {
      elements.manualCheck.textContent = '立即检查闲置标签';
      elements.manualCheck.disabled = false;
    }, 2000);

  } catch (error) {
    console.error('手动检查失败:', error);
    showStatus('❌ 检查失败', 'error');
    elements.manualCheck.textContent = '立即检查闲置标签';
    elements.manualCheck.disabled = false;
  }
});

// 重置统计数据
elements.resetStats.addEventListener('click', async () => {
  if (!confirm('确定要重置所有统计数据吗？')) {
    return;
  }

  try {
    // 清除本地存储
    await chrome.storage.local.set({
      stats: {
        tabsDiscarded: 0,
        memoryFreed: 0,
        fruitsSliced: 0,
        lastResetTime: Date.now(),
      }
    });

    // 刷新显示
    await loadStats();

    showStatus('✅ 统计数据已重置');
  } catch (error) {
    console.error('重置失败:', error);
    showStatus('❌ 重置失败', 'error');
  }
});

// 切换启用状态
elements.toggleEnabled.addEventListener('click', async () => {
  try {
    const isEnabled = elements.toggleEnabled.classList.contains('active');
    const newState = !isEnabled;

    // 发送配置更新
    await chrome.runtime.sendMessage({
      action: 'updateConfig',
      config: { enabled: newState }
    });

    // 更新 UI
    if (newState) {
      elements.toggleEnabled.classList.add('active');
      showStatus('✅ 监控已启用');
    } else {
      elements.toggleEnabled.classList.remove('active');
      showStatus('⏸️ 监控已暂停');
    }
  } catch (error) {
    console.error('更新配置失败:', error);
    showStatus('❌ 操作失败', 'error');
  }
});

// 应用闲置阈值设置
elements.applyThreshold.addEventListener('click', async () => {
  try {
    const minutes = parseInt(elements.idleThresholdInput.value);

    // 验证输入
    if (isNaN(minutes) || minutes < 1 || minutes > 1440) {
      showStatus('❌ 请输入 1-1440 之间的数值', 'error');
      return;
    }

    // 转换为毫秒
    const milliseconds = minutes * 60 * 1000;

    // 发送配置更新
    const response = await chrome.runtime.sendMessage({
      action: 'updateConfig',
      config: { idleThreshold: milliseconds }
    });

    if (response && response.success) {
      showStatus(`✅ 闲置阈值已更新为 ${minutes} 分钟`);
      console.log(`闲置阈值已更新: ${minutes} 分钟 (${milliseconds} 毫秒)`);
    } else {
      showStatus('❌ 更新失败', 'error');
    }
  } catch (error) {
    console.error('更新闲置阈值失败:', error);
    showStatus('❌ 更新失败', 'error');
  }
});

// 回车键快捷应用
elements.idleThresholdInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    elements.applyThreshold.click();
  }
});

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
  loadStats();

  // 每 3 秒自动刷新统计数据
  setInterval(loadStats, 3000);
});

// 添加数字动画效果
function animateValue(element, start, end, duration) {
  const range = end - start;
  const increment = range / (duration / 16); // 60fps
  let current = start;

  const timer = setInterval(() => {
    current += increment;
    if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
      element.textContent = Math.round(end);
      clearInterval(timer);
    } else {
      element.textContent = Math.round(current);
    }
  }, 16);
}

console.log('🥷 Memory Ninja Popup 已加载');
