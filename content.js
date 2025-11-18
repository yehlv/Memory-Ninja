/**
 * Memory Ninja - Content Script
 * 水果忍者风格 - 完整版
 * 真实的物理引擎、高质量视觉效果
 */

console.log('🥷 Memory Ninja Content Script (水果忍者版) 已加载');

// 配置
const CONFIG = {
  fruitSize: 150,                   // 水果大小（像素）- 更大更显眼
  gravity: 0.4,                     // 重力加速度（降低使水果飞得更高）
  initialVelocityY: -28,            // 初始上抛速度（增加到-28使水果飞到屏幕中央以上）
  initialVelocityX: 5,              // 初始水平速度范围
  rotationSpeed: 5,                 // 旋转速度
  sliceDetectionRadius: 80,         // 切割检测半径
  mouseTrailLength: 80,             // 鼠标轨迹长度（增加到80，超长尾巴）
  mouseTrailFadeTime: 800,          // 轨迹淡出时间（增加到800ms，更长的停留时间）
  mouseTrailSampleInterval: 8,      // 轨迹采样间隔（像素）- 控制采样密度
  juiceParticleCount: 30,           // 果汁粒子数量
  slashDuration: 300,               // 切割闪光持续时间
};

// 水果类型定义（使用真实的水果 emoji 和颜色）
const FRUIT_TYPES = [
  {
    emoji: '🍎',
    name: 'apple',
    color: '#FF3B30',
    juiceColor: '#FF6B6B',
    size: 1.0
  },
  {
    emoji: '🍉',
    name: 'watermelon',
    color: '#FF453A',
    juiceColor: '#FF6B6B',
    size: 1.3
  },
  {
    emoji: '🍊',
    name: 'orange',
    color: '#FF9500',
    juiceColor: '#FFB84D',
    size: 0.9
  },
  {
    emoji: '🍋',
    name: 'lemon',
    color: '#FFCC00',
    juiceColor: '#FFD93D',
    size: 0.85
  },
  {
    emoji: '🍇',
    name: 'grape',
    color: '#AF52DE',
    juiceColor: '#D77BF4',
    size: 0.95
  },
  {
    emoji: '🥝',
    name: 'kiwi',
    color: '#34C759',
    juiceColor: '#6EDB8F',
    size: 0.9
  },
  {
    emoji: '🍓',
    name: 'strawberry',
    color: '#FF2D55',
    juiceColor: '#FF6482',
    size: 0.8
  },
  {
    emoji: '🍑',
    name: 'peach',
    color: '#FFB4AB',
    juiceColor: '#FFD4CC',
    size: 0.95
  }
];

// 状态管理
let fruits = [];                    // 当前所有水果
let mouseTrail = [];                // 鼠标轨迹
let sliceTrailCanvas = null;        // 切割轨迹画布
let sliceTrailCtx = null;           // Canvas 上下文（缓存避免重复获取）
let animationFrameId = null;        // 动画帧 ID
let lastMousePos = null;            // 上次鼠标位置（用于检测移动速度）
let isGameLoopRunning = false;      // 游戏循环运行状态

// 初始化
function init() {
  // 创建切割轨迹 Canvas
  sliceTrailCanvas = document.createElement('canvas');
  sliceTrailCanvas.className = 'ninja-slice-canvas';
  sliceTrailCanvas.width = window.innerWidth;
  sliceTrailCanvas.height = window.innerHeight;
  document.body.appendChild(sliceTrailCanvas);

  // 缓存 Canvas 上下文，避免重复获取
  sliceTrailCtx = sliceTrailCanvas.getContext('2d', {
    alpha: true,
    desynchronized: true  // 性能优化
  });

  // 监听事件（只需要 mousemove，不需要 mousedown/mouseup）
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('touchstart', handleTouchStart, { passive: false });
  document.addEventListener('touchmove', handleTouchMove, { passive: false });
  document.addEventListener('touchend', handleTouchEnd);

  // 窗口大小变化
  window.addEventListener('resize', () => {
    sliceTrailCanvas.width = window.innerWidth;
    sliceTrailCanvas.height = window.innerHeight;
  });

  console.log('✅ Memory Ninja 水果忍者系统已初始化');
}

// 游戏主循环（智能启动/停止以节省性能）
function startGameLoop() {
  if (isGameLoopRunning) return;

  isGameLoopRunning = true;

  function gameLoop() {
    // 如果没有水果且没有轨迹，暂停循环以节省性能
    if (fruits.length === 0 && mouseTrail.length === 0) {
      isGameLoopRunning = false;
      animationFrameId = null;
      return;
    }

    updateFruits();
    animationFrameId = requestAnimationFrame(gameLoop);
  }
  gameLoop();
}

// 停止游戏循环
function stopGameLoop() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  isGameLoopRunning = false;
}

// 持续更新鼠标轨迹（清理过期点并重绘）
function updateMouseTrail() {
  if (mouseTrail.length === 0) return;

  const now = Date.now();
  const oldLength = mouseTrail.length;

  // 清理过期的轨迹点
  mouseTrail = mouseTrail.filter(point => now - point.time < CONFIG.mouseTrailFadeTime);

  // 如果轨迹有变化，重新绘制
  if (mouseTrail.length !== oldLength || mouseTrail.length > 0) {
    if (mouseTrail.length > 0) {
      drawSliceTrail();
    } else {
      clearSliceTrail();
    }
  }
}

// 更新所有水果的物理状态
function updateFruits() {
  fruits.forEach(fruit => {
    if (fruit.sliced) return;

    // 应用重力
    fruit.velocityY += CONFIG.gravity;

    // 更新位置
    fruit.x += fruit.velocityX;
    fruit.y += fruit.velocityY;

    // 更新旋转
    fruit.rotation += fruit.rotationSpeed;

    // 更新 DOM
    fruit.element.style.left = fruit.x + 'px';
    fruit.element.style.top = fruit.y + 'px';
    fruit.element.style.transform = `rotate(${fruit.rotation}deg) scale(${fruit.scale})`;

    // 检查是否离开屏幕
    if (fruit.y > window.innerHeight + 200) {
      removeFruit(fruit);
    }
  });

  // 持续清理过期的鼠标轨迹（即使鼠标停止移动）
  updateMouseTrail();
}

// 监听来自 Background 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'generateFruit') {
    createFruit(message.targetTab);
    sendResponse({ success: true });
  }
});

// 创建水果
function createFruit(targetTab) {
  // 随机选择水果类型
  const fruitType = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];

  // 优化起始位置：在屏幕中间 40%-60% 的区域随机生成，避免边缘
  const screenWidth = window.innerWidth;
  const centerStart = screenWidth * 0.3;  // 从30%位置开始
  const centerWidth = screenWidth * 0.4;  // 跨越40%宽度（30%-70%）
  const startX = centerStart + Math.random() * centerWidth;
  const startY = window.innerHeight + CONFIG.fruitSize;

  // 创建水果容器
  const fruitContainer = document.createElement('div');
  fruitContainer.className = 'ninja-fruit-container';

  // 水果主体
  const fruitElement = document.createElement('div');
  fruitElement.className = 'ninja-fruit';
  fruitElement.dataset.tabId = targetTab.id;
  fruitElement.dataset.fruitId = Date.now() + Math.random();
  fruitElement.dataset.fruitType = fruitType.name;

  // 水果外观
  const size = CONFIG.fruitSize * fruitType.size;
  fruitElement.style.width = size + 'px';
  fruitElement.style.height = size + 'px';

  fruitElement.innerHTML = `
    <div class="fruit-shadow"></div>
    <div class="fruit-body">
      <div class="fruit-emoji">${fruitType.emoji}</div>
      <div class="fruit-shine"></div>
    </div>
    <div class="fruit-info-badge">
      <div class="fruit-title">${truncateText(targetTab.title, 20)}</div>
      <div class="fruit-memory">${targetTab.estimatedMemory}MB</div>
    </div>
  `;

  fruitContainer.appendChild(fruitElement);
  document.body.appendChild(fruitContainer);

  // 优化抛物线参数：减小水平速度，让轨迹更垂直，集中在中央
  // 根据起始位置计算水平速度，让水果向屏幕中心移动
  const screenCenter = screenWidth / 2;
  const distanceFromCenter = startX - screenCenter;

  // 如果在左侧，给正速度（向右）；如果在右侧，给负速度（向左）
  // 速度与距离成反比，离中心越远，向中心的速度越大
  const velocityX = -distanceFromCenter * 0.015 + (Math.random() - 0.5) * 2;
  const velocityY = CONFIG.initialVelocityY + (Math.random() - 0.5) * 2;
  const rotationSpeed = (Math.random() - 0.5) * CONFIG.rotationSpeed;

  // 存储水果数据
  const fruitData = {
    element: fruitContainer,
    fruitElement: fruitElement,
    id: fruitElement.dataset.fruitId,
    tabId: targetTab.id,
    tabInfo: targetTab,
    type: fruitType,
    x: startX,
    y: startY,
    velocityX: velocityX,
    velocityY: velocityY,
    rotation: Math.random() * 360,
    rotationSpeed: rotationSpeed,
    scale: 1,
    sliced: false,
    size: size
  };

  fruits.push(fruitData);

  // 启动游戏循环（如果未运行）
  startGameLoop();

  console.log(`🍎 水果生成: ${fruitType.emoji} ${fruitType.name} (目标: ${targetTab.title})`);
}

// 鼠标/触摸事件处理
function handleMouseMove(e) {
  const currentPos = { x: e.clientX, y: e.clientY, time: Date.now() };

  // 自动清理过期的轨迹点
  const now = Date.now();
  mouseTrail = mouseTrail.filter(point => now - point.time < CONFIG.mouseTrailFadeTime);

  // 计算移动速度和距离
  if (lastMousePos) {
    const dx = currentPos.x - lastMousePos.x;
    const dy = currentPos.y - lastMousePos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const timeDiff = currentPos.time - lastMousePos.time;
    const speed = timeDiff > 0 ? distance / timeDiff : 0;

    // 只有当鼠标移动速度足够快时才记录轨迹
    if (speed > 0.3) {
      // 检查距离采样：如果距离太远，插入中间点以避免折线
      if (distance > CONFIG.mouseTrailSampleInterval && mouseTrail.length > 0) {
        const lastPoint = mouseTrail[mouseTrail.length - 1];
        const steps = Math.ceil(distance / CONFIG.mouseTrailSampleInterval);

        // 在两点之间插入中间点
        for (let i = 1; i < steps; i++) {
          const ratio = i / steps;
          const interpolatedPoint = {
            x: lastPoint.x + dx * ratio,
            y: lastPoint.y + dy * ratio,
            time: lastPoint.time + timeDiff * ratio
          };
          mouseTrail.push(interpolatedPoint);
        }
      }

      // 添加当前点
      mouseTrail.push(currentPos);

      // 限制轨迹长度
      while (mouseTrail.length > CONFIG.mouseTrailLength) {
        mouseTrail.shift();
      }

      // 启动游戏循环（如果未运行）
      startGameLoop();

      // 绘制轨迹和检测碰撞
      drawSliceTrail();
      checkCollisions();
    } else {
      // 速度太慢，清空轨迹
      if (mouseTrail.length > 0) {
        mouseTrail = [];
        clearSliceTrail();
      }
    }
  }

  // 如果轨迹为空，清除画布
  if (mouseTrail.length === 0) {
    clearSliceTrail();
  }

  lastMousePos = currentPos;
}

// 触摸事件
function handleTouchStart(e) {
  e.preventDefault();
  mouseTrail = [];
}

function handleTouchMove(e) {
  e.preventDefault();
  if (e.touches.length === 0) return;

  const touch = e.touches[0];
  const point = { x: touch.clientX, y: touch.clientY, time: Date.now() };

  mouseTrail.push(point);

  if (mouseTrail.length > CONFIG.mouseTrailLength) {
    mouseTrail.shift();
  }

  drawSliceTrail();
  checkCollisions();
}

function handleTouchEnd(e) {
  e.preventDefault();
  mouseTrail = [];
  clearSliceTrail();
}

// 绘制切割轨迹（前粗后细、前深后淡的渐变效果）
function drawSliceTrail() {
  if (!sliceTrailCtx) return;

  sliceTrailCtx.clearRect(0, 0, sliceTrailCanvas.width, sliceTrailCanvas.height);

  if (mouseTrail.length < 2) return;

  const now = Date.now();
  const totalPoints = mouseTrail.length;

  // 分段绘制每一段，应用渐变效果
  for (let i = 1; i < totalPoints; i++) {
    const p1 = mouseTrail[i - 1];
    const p2 = mouseTrail[i];

    // 计算这段轨迹的位置进度（0 = 最旧，1 = 最新）
    const progress = i / totalPoints;

    // 计算基于时间的透明度
    const avgAge = ((now - p1.time) + (now - p2.time)) / 2;
    const timeOpacity = Math.max(0, 1 - avgAge / CONFIG.mouseTrailFadeTime);

    // 基于位置的粗细渐变（尾部 2px → 前端 8px）
    const lineWidth = 2 + progress * 6;

    // 基于位置的透明度渐变（尾部 0.3 → 前端 1.0）
    const positionOpacity = 0.3 + progress * 0.7;

    // 综合透明度
    const opacity = timeOpacity * positionOpacity;

    if (opacity <= 0) continue;

    // 绘制主轨迹线（白色发光）
    sliceTrailCtx.beginPath();
    sliceTrailCtx.moveTo(p1.x, p1.y);
    sliceTrailCtx.lineTo(p2.x, p2.y);

    sliceTrailCtx.strokeStyle = `rgba(255, 255, 255, ${0.9 * opacity})`;
    sliceTrailCtx.lineWidth = lineWidth;
    sliceTrailCtx.lineCap = 'round';
    sliceTrailCtx.lineJoin = 'round';
    sliceTrailCtx.shadowBlur = 15 * opacity * progress;
    sliceTrailCtx.shadowColor = `rgba(255, 255, 255, ${0.8 * opacity})`;
    sliceTrailCtx.stroke();

    // 绘制外层光晕（只在较粗的部分绘制）
    if (progress > 0.3) {
      sliceTrailCtx.strokeStyle = `rgba(100, 200, 255, ${0.3 * opacity * progress})`;
      sliceTrailCtx.lineWidth = lineWidth * 2.5;
      sliceTrailCtx.shadowBlur = 25 * opacity * progress;
      sliceTrailCtx.shadowColor = `rgba(100, 200, 255, ${0.5 * opacity * progress})`;
      sliceTrailCtx.stroke();
    }
  }
}

// 清除切割轨迹
function clearSliceTrail() {
  if (!sliceTrailCtx) return;
  sliceTrailCtx.clearRect(0, 0, sliceTrailCanvas.width, sliceTrailCanvas.height);
}

// 碰撞检测
function checkCollisions() {
  fruits.forEach(fruit => {
    if (fruit.sliced) return;

    const fruitCenter = {
      x: fruit.x + fruit.size / 2,
      y: fruit.y + fruit.size / 2
    };

    // 检查鼠标轨迹是否穿过水果
    for (let i = 1; i < mouseTrail.length; i++) {
      const p1 = mouseTrail[i - 1];
      const p2 = mouseTrail[i];

      if (lineIntersectsCircle(p1, p2, fruitCenter, CONFIG.sliceDetectionRadius)) {
        sliceFruit(fruit, p1, p2);
        return;
      }
    }
  });
}

// 线段与圆的碰撞检测
function lineIntersectsCircle(p1, p2, center, radius) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const fx = p1.x - center.x;
  const fy = p1.y - center.y;

  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = (fx * fx + fy * fy) - radius * radius;

  const discriminant = b * b - 4 * a * c;

  if (discriminant >= 0) {
    const t1 = (-b - Math.sqrt(discriminant)) / (2 * a);
    const t2 = (-b + Math.sqrt(discriminant)) / (2 * a);
    return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
  }

  return false;
}

// 切割水果（水果忍者风格）
async function sliceFruit(fruit, sliceStart, sliceEnd) {
  if (fruit.sliced) return;
  fruit.sliced = true;

  console.log(`✂️ 水果被切割！${fruit.type.emoji} (标签 ${fruit.tabId})`);

  // 计算切割角度
  const angle = Math.atan2(sliceEnd.y - sliceStart.y, sliceEnd.x - sliceStart.x);

  // 创建切割闪光
  createSlashEffect(fruit, angle);

  // 创建水果两半
  createFruitHalves(fruit, angle);

  // 创建大量果汁粒子
  createJuiceExplosion(fruit, angle);

  // 显示得分
  showScoreEffect(fruit);

  // 通知 Background 释放内存
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'sliceFruit',
      tabId: fruit.tabId
    });

    if (response.success) {
      console.log(`✅ 内存已释放: ${response.memoryFreed}`);
    }
  } catch (error) {
    console.error('❌ 释放内存失败:', error);
  }

  // 移除原水果
  setTimeout(() => removeFruit(fruit), 100);
}

// 创建切割闪光特效
function createSlashEffect(fruit, angle) {
  const slash = document.createElement('div');
  slash.className = 'ninja-slash-effect';

  const centerX = fruit.x + fruit.size / 2;
  const centerY = fruit.y + fruit.size / 2;

  slash.style.left = centerX + 'px';
  slash.style.top = centerY + 'px';
  slash.style.transform = `rotate(${angle}rad)`;

  document.body.appendChild(slash);

  setTimeout(() => slash.remove(), CONFIG.slashDuration);
}

// 创建水果两半
function createFruitHalves(fruit, angle) {
  const centerX = fruit.x + fruit.size / 2;
  const centerY = fruit.y + fruit.size / 2;

  // 创建左半和右半
  for (let i = 0; i < 2; i++) {
    const half = document.createElement('div');
    half.className = 'ninja-fruit-half';
    half.innerHTML = `<div class="fruit-emoji">${fruit.type.emoji}</div>`;

    half.style.width = fruit.size + 'px';
    half.style.height = fruit.size + 'px';
    half.style.left = centerX - fruit.size / 2 + 'px';
    half.style.top = centerY - fruit.size / 2 + 'px';

    // 裁剪为半个
    half.style.clipPath = i === 0
      ? `polygon(0 0, 50% 0, 50% 100%, 0 100%)`
      : `polygon(50% 0, 100% 0, 100% 100%, 50% 100%)`;

    document.body.appendChild(half);

    // 应用物理效果
    const speed = 8;
    const perpAngle = angle + (i === 0 ? -Math.PI / 2 : Math.PI / 2);
    const vx = Math.cos(perpAngle) * speed + fruit.velocityX;
    const vy = Math.sin(perpAngle) * speed + fruit.velocityY;

    animateFruitHalf(half, centerX, centerY, vx, vy, fruit.rotationSpeed * 2);
  }
}

// 动画水果半块
function animateFruitHalf(element, startX, startY, vx, vy, rotationSpeed) {
  let x = startX;
  let y = startY;
  let velocityX = vx;
  let velocityY = vy;
  let rotation = 0;

  function animate() {
    velocityY += CONFIG.gravity;
    x += velocityX;
    y += velocityY;
    rotation += rotationSpeed;

    element.style.left = x + 'px';
    element.style.top = y + 'px';
    element.style.transform = `rotate(${rotation}deg)`;
    element.style.opacity = Math.max(0, 1 - (y - startY) / 500);

    if (y < window.innerHeight + 200) {
      requestAnimationFrame(animate);
    } else {
      element.remove();
    }
  }

  animate();
}

// 创建果汁爆炸效果
function createJuiceExplosion(fruit, angle) {
  const centerX = fruit.x + fruit.size / 2;
  const centerY = fruit.y + fruit.size / 2;

  for (let i = 0; i < CONFIG.juiceParticleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'ninja-juice-particle';
    particle.style.background = fruit.type.juiceColor;
    particle.style.left = centerX + 'px';
    particle.style.top = centerY + 'px';

    document.body.appendChild(particle);

    // 随机飞溅方向
    const spreadAngle = angle + (Math.random() - 0.5) * Math.PI * 0.8;
    const speed = 5 + Math.random() * 10;
    const vx = Math.cos(spreadAngle) * speed;
    const vy = Math.sin(spreadAngle) * speed - Math.random() * 5;

    animateJuiceParticle(particle, centerX, centerY, vx, vy);
  }
}

// 动画果汁粒子
function animateJuiceParticle(element, startX, startY, vx, vy) {
  let x = startX;
  let y = startY;
  let velocityX = vx;
  let velocityY = vy;
  let life = 1;

  function animate() {
    velocityY += CONFIG.gravity * 0.3;
    x += velocityX;
    y += velocityY;
    life -= 0.02;

    element.style.left = x + 'px';
    element.style.top = y + 'px';
    element.style.opacity = life;
    element.style.transform = `scale(${life})`;

    if (life > 0 && y < window.innerHeight + 100) {
      requestAnimationFrame(animate);
    } else {
      element.remove();
    }
  }

  animate();
}

// 显示得分效果
function showScoreEffect(fruit) {
  const score = document.createElement('div');
  score.className = 'ninja-score-text';
  score.textContent = `+${fruit.tabInfo.estimatedMemory} MB`;

  const centerX = fruit.x + fruit.size / 2;
  const centerY = fruit.y + fruit.size / 2;

  score.style.left = centerX + 'px';
  score.style.top = centerY + 'px';

  document.body.appendChild(score);

  setTimeout(() => {
    score.style.transform = 'translateY(-100px) scale(1.5)';
    score.style.opacity = '0';
  }, 50);

  setTimeout(() => score.remove(), 1500);
}

// 移除水果（完全清理 DOM 和引用）
function removeFruit(fruit) {
  // 移除 DOM 元素
  if (fruit.element && fruit.element.parentNode) {
    fruit.element.remove();
  }

  // 清除数据引用
  fruit.element = null;
  fruit.fruitElement = null;
  fruit.tabInfo = null;
  fruit.type = null;

  // 从数组中移除
  fruits = fruits.filter(f => f.id !== fruit.id);
}

// 截断文本
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// 初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
