// 语音提醒模块 - 学习打卡PWA专用（增强版）
class VoiceReminder {
    constructor() {
        // 主开关
        this.isEnabled = this.loadSetting('voiceReminderEnabled', true);
        
        // 语音参数设置
        this.volume = this.loadSetting('voiceReminderVolume', 0.8);
        this.rate = this.loadSetting('voiceReminderRate', 1.0);
        this.pitch = this.loadSetting('voiceReminderPitch', 1.0);
        
        // 各种提醒类型的独立开关
        this.reminderTypes = {
            studyStart: this.loadSetting('voiceStudyStart', true),           // 学习开始提醒
            studyEnd: this.loadSetting('voiceStudyEnd', true),               // 学习结束提醒
            taskComplete: this.loadSetting('voiceTaskComplete', true),       // 任务完成提醒
            taskMaster: this.loadSetting('voiceTaskMaster', true),           // 任务掌握提醒
            settingConfirm: this.loadSetting('voiceSettingConfirm', true),   // 设置确认提醒
            planAdded: this.loadSetting('voicePlanAdded', true),             // 计划添加提醒
            encouragement: this.loadSetting('voiceEncouragement', true)      // 鼓励性提醒
        };
        
        // 🆕 各种提醒类型的自定义重复次数
        this.repeatCounts = {
            studyStart: this.loadSetting('repeatStudyStart', 3),             // 学习开始提醒次数
            studyEnd: this.loadSetting('repeatStudyEnd', 3),                 // 学习结束提醒次数
            taskComplete: this.loadSetting('repeatTaskComplete', 1),         // 任务完成提醒次数
            taskMaster: this.loadSetting('repeatTaskMaster', 5),             // 任务掌握提醒次数
            settingConfirm: this.loadSetting('repeatSettingConfirm', 1),     // 设置确认提醒次数
            planAdded: this.loadSetting('repeatPlanAdded', 1),               // 计划添加提醒次数
            encouragement: this.loadSetting('repeatEncouragement', 2)        // 鼓励性提醒次数
        };
        
        this.timers = new Map(); // 存储定时器
        this.currentReminders = new Map(); // 存储当前提醒
        this.wakeLock = null; // Wake Lock 对象
        this.isPageVisible = true; // 页面可见性状态
        this.serviceWorkerReady = false; // Service Worker 状态
        this.isPlaying = false; // 播放状态
        this.engineActivated = false; // 语音引擎激活状态
        
        this.init();
    }

    /**
     * 初始化语音提醒系统
     */
    init() {
        console.log('🚀 开始初始化语音提醒系统...');
        
        // 🆕 延迟检查语音合成API，确保在强制刷新后也能正常工作
        this.initializeSpeechSynthesis();
        
        // 初始化Service Worker通信
        this.initServiceWorker();
        
        // 监听页面可见性变化
        this.setupVisibilityListener();
        
        // 设置Wake Lock
        this.setupWakeLock();
        
        // 启动时间监控
        this.startTimeMonitoring();
        
        // 延迟添加语音提醒设置界面，确保DOM加载完成
        setTimeout(() => {
            this.addVoiceReminderUI();
        }, 100);
        
        // 请求通知权限
        this.requestNotificationPermission();
        
        console.log('✅ 语音提醒系统初始化完成');
    }

    /**
     * 🆕 智能初始化语音合成API
     */
    initializeSpeechSynthesis() {
        console.log('🔊 开始初始化语音合成API...');
        
        let retryCount = 0;
        const maxRetries = 5;
        
        const checkSpeechSynthesis = () => {
            retryCount++;
            console.log(`🔄 语音API检查第 ${retryCount} 次...`);
            
            // 检查基本支持
            if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
                console.error('❌ 浏览器不支持语音合成API');
                
                if (retryCount < maxRetries) {
                    console.log(`⏳ 等待 ${retryCount * 500}ms 后重试...`);
                    setTimeout(checkSpeechSynthesis, retryCount * 500);
                    return;
                }
                
                // 达到最大重试次数，显示错误
                this.showSpeechSynthesisError('浏览器不支持语音合成功能');
                return;
            }
            
            // 检查语音合成对象是否可用
            if (!window.speechSynthesis) {
                console.error('❌ speechSynthesis 对象不可用');
                
                if (retryCount < maxRetries) {
                    setTimeout(checkSpeechSynthesis, retryCount * 500);
                    return;
                }
                
                this.showSpeechSynthesisError('语音合成对象不可用');
                return;
            }
            
            // 设置speechSynthesis引用
            this.speechSynthesis = window.speechSynthesis;
            
            // 检查语音列表是否可用
            this.checkVoicesList();
            
            console.log('✅ 语音合成API初始化成功');
        };
        
        // 立即检查一次
        checkSpeechSynthesis();
    }

    /**
     * 🆕 检查语音列表
     */
    checkVoicesList() {
        console.log('🎤 检查语音列表...');
        
        const voices = this.speechSynthesis.getVoices();
        console.log(`📋 当前可用语音数量: ${voices.length}`);
        
        if (voices.length === 0) {
            console.log('⏳ 语音列表为空，等待加载...');
            
            // 监听语音列表加载完成
            this.speechSynthesis.addEventListener('voiceschanged', () => {
                const newVoices = this.speechSynthesis.getVoices();
                console.log(`🎤 语音列表已更新，可用语音数量: ${newVoices.length}`);
                
                if (newVoices.length > 0) {
                    console.log('✅ 语音列表加载完成');
                    this.logAvailableVoices(newVoices);
                } else {
                    console.warn('⚠️ 语音列表仍为空');
                }
            }, { once: true });
            
            // 设置超时检查
            setTimeout(() => {
                const finalVoices = this.speechSynthesis.getVoices();
                if (finalVoices.length === 0) {
                    console.warn('⚠️ 语音列表加载超时，但基本功能可用');
                }
            }, 3000);
        } else {
            console.log('✅ 语音列表已可用');
            this.logAvailableVoices(voices);
        }
    }

    /**
     * 🆕 记录可用语音
     */
    logAvailableVoices(voices) {
        console.log('📝 可用语音列表:');
        voices.forEach((voice, index) => {
            if (voice.lang.startsWith('zh')) {
                console.log(`  ${index + 1}. ${voice.name} (${voice.lang}) - 中文语音`);
            }
        });
    }

    /**
     * 🆕 显示语音合成错误
     */
    showSpeechSynthesisError(message) {
        console.error('💥 语音合成初始化失败:', message);
        
        // 显示用户友好的错误提示
        setTimeout(() => {
            if (document.querySelector('.voice-error-notification')) return;
            
            const errorNotification = document.createElement('div');
            errorNotification.className = 'voice-error-notification';
            errorNotification.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg, #ff6b6b, #ee5a52);
                color: white;
                padding: 15px 20px;
                border-radius: 25px;
                font-size: 14px;
                font-weight: bold;
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
                z-index: 10000;
                max-width: 90%;
                text-align: center;
                animation: fadeInOut 8s ease-in-out;
            `;
            
            errorNotification.innerHTML = `
                🔇 语音功能暂时不可用<br>
                <span style="font-size: 11px; opacity: 0.9;">
                    ${message}<br>
                    请刷新页面重试
                </span>
            `;
            
            document.body.appendChild(errorNotification);
            
            // 8秒后自动移除
            setTimeout(() => {
                if (errorNotification && errorNotification.parentNode) {
                    errorNotification.remove();
                }
            }, 8000);
        }, 1000);
        
        // 禁用语音功能
        this.isEnabled = false;
        this.speechSynthesis = null;
    }

    /**
     * 初始化Service Worker通信（支持本地文件环境）
     */
    initServiceWorker() {
        // 检查当前环境
        const isLocalFile = window.location.protocol === 'file:';
        
        if (isLocalFile) {
            console.log('📁 本地文件环境，跳过Service Worker初始化');
            this.serviceWorkerReady = false;
            return;
        }
        
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((registration) => {
                this.serviceWorkerReady = true;
                console.log('✅ Service Worker ready for background reminders');
                
                // 监听Service Worker消息
                navigator.serviceWorker.addEventListener('message', (event) => {
                    this.handleServiceWorkerMessage(event.data);
                });
            }).catch((error) => {
                console.error('❌ Service Worker not ready:', error);
                this.serviceWorkerReady = false;
            });
        } else {
            console.warn('⚠️ Service Worker not supported');
            this.serviceWorkerReady = false;
        }
    }

    /**
     * 处理Service Worker消息
     */
    handleServiceWorkerMessage(data) {
        switch (data.type) {
            case 'REMINDER_TRIGGERED':
                console.log('收到Service Worker提醒:', data.reminder);
                // 如果页面可见，播放语音
                if (this.isPageVisible) {
                    this.playReminderFromServiceWorker(data.reminder);
                }
                break;
            case 'SERVICE_WORKER_HEARTBEAT':
                console.log('Service Worker心跳:', data.timestamp, '活动提醒:', data.activeReminders);
                break;
            case 'BACKGROUND_SYNC_REMINDER':
                console.log('后台同步提醒:', data.timestamp);
                this.checkAndUpdateReminders();
                break;
        }
    }

    /**
     * 播放来自Service Worker的提醒
     */
    playReminderFromServiceWorker(reminder) {
        if (reminder.type === 'studyStart') {
            this.speak(`学习时间到了！${reminder.body}`, 'studyStart');
        } else if (reminder.type === 'studyEnd') {
            this.speak(`学习时间结束！${reminder.body}`, 'studyEnd');
        }
    }

    /**
     * 设置页面可见性监听
     */
    setupVisibilityListener() {
        document.addEventListener('visibilitychange', () => {
            this.isPageVisible = !document.hidden;
            console.log('页面可见性变化:', this.isPageVisible ? '可见' : '隐藏');
            
            if (this.isPageVisible) {
                // 页面变为可见时，检查是否有错过的提醒
                this.checkMissedReminders();
            }
        });
    }

    /**
     * 设置Wake Lock（保持屏幕唤醒）
     */
    setupWakeLock() {
        if ('wakeLock' in navigator) {
            console.log('设备支持Wake Lock API');
        } else {
            console.warn('设备不支持Wake Lock API');
        }
    }

    /**
     * 请求Wake Lock
     */
    async requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('Wake Lock已激活，屏幕将保持唤醒');
                
                this.wakeLock.addEventListener('release', () => {
                    console.log('Wake Lock已释放');
                });
            } catch (err) {
                console.error('无法获取Wake Lock:', err);
            }
        }
    }

    /**
     * 释放Wake Lock
     */
    releaseWakeLock() {
        if (this.wakeLock) {
            this.wakeLock.release();
            this.wakeLock = null;
            console.log('Wake Lock已手动释放');
        }
    }

    /**
     * 请求通知权限
     */
    requestNotificationPermission() {
        if ('Notification' in window) {
            if (Notification.permission === 'default') {
                Notification.requestPermission().then((permission) => {
                    console.log('通知权限状态:', permission);
                    if (permission === 'granted') {
                        console.log('通知权限已获得');
                    }
                });
            }
        }
    }

    /**
     * 检查错过的提醒
     */
    checkMissedReminders() {
        const now = Date.now();
        // 这里可以添加逻辑来检查在后台时是否有错过的提醒
        console.log('检查错过的提醒:', new Date(now).toLocaleTimeString());
    }

    /**
     * 检查并更新提醒
     */
    checkAndUpdateReminders() {
        // 重新同步所有提醒
        if (window.studyData && window.currentStudyDate) {
            this.updateAllTaskReminders(window.studyData, window.currentStudyDate);
        }
    }

    /**
     * 保存设置到本地存储
     */
    saveSetting(key, value) {
        localStorage.setItem(`voiceReminder_${key}`, JSON.stringify(value));
    }

    /**
     * 从本地存储加载设置
     */
    loadSetting(key, defaultValue) {
        const saved = localStorage.getItem(`voiceReminder_${key}`);
        return saved ? JSON.parse(saved) : defaultValue;
    }

    /**
     * 检查是否可以播放指定类型的提醒
     * @param {string} type - 提醒类型
     * @returns {boolean} 是否可以播放
     */
    canPlayReminder(type) {
        return this.isEnabled && this.reminderTypes[type] && ('speechSynthesis' in window);
    }

    /**
     * 解析时间段字符串
     * @param {string} timeSlot - 时间段字符串，如 "21:00-21:15"
     * @returns {Object} 包含开始和结束时间的对象
     */
    parseTimeSlot(timeSlot) {
        if (!timeSlot || typeof timeSlot !== 'string') return null;

        const timeRegex = /(\d{1,2}):(\d{2})\s*[-到至]\s*(\d{1,2}):(\d{2})/;
        const match = timeSlot.match(timeRegex);
        
        if (!match) return null;

        const [, startHour, startMin, endHour, endMin] = match;
        
        return {
            start: { hour: parseInt(startHour), minute: parseInt(startMin) },
            end: { hour: parseInt(endHour), minute: parseInt(endMin) }
        };
    }

    /**
     * 获取下一个提醒时间
     * @param {Object} timeInfo - 时间信息对象
     * @returns {Date} 下一个提醒时间
     */
    getNextReminderTime(timeInfo) {
        const now = new Date();
        const reminderTime = new Date();
        
        // 设置提醒时间为学习开始时间
        reminderTime.setHours(timeInfo.start.hour, timeInfo.start.minute, 0, 0);
        
        console.log('计算提醒时间:', {
            now: now.toLocaleString(),
            reminderTime: reminderTime.toLocaleString(),
            isPast: reminderTime <= now
        });
        
        // 如果今天的时间已过，设置为明天
        if (reminderTime <= now) {
            reminderTime.setDate(reminderTime.getDate() + 1);
            console.log('时间已过，设置为明天:', reminderTime.toLocaleString());
        }
        
        return reminderTime;
    }

    /**
     * 播放语音
     * @param {string} text - 要播放的文本
     * @param {string} type - 提醒类型
     * @param {number} repeatCount - 重复次数（可选，会根据type自动确定）
     * @param {number} currentRepeat - 当前重复次数
     */
    speak(text, type = null, repeatCount = null, currentRepeat = 1) {
        // 🆕 根据提醒类型自动确定重复次数
        if (repeatCount === null && type && this.repeatCounts && this.repeatCounts[type] !== undefined) {
            repeatCount = this.repeatCounts[type];
            console.log(`🔢 根据类型 "${type}" 自动设置重复次数: ${repeatCount}`);
        } else if (repeatCount === null) {
            repeatCount = 3; // 默认次数
        }
        
        // 🆕 如果重复次数为0，视为禁用该提醒
        if (repeatCount === 0) {
            console.log(`🚫 提醒类型 "${type}" 重复次数为0，跳过播放`);
            return;
        }
        
        console.log(`🔊 语音播放请求 (${currentRepeat}/${repeatCount}):`, text, type);
        
        // 基础检查
        if (!this.isEnabled) {
            console.log('⚠️ 语音提醒已禁用，跳过播放');
            return;
        }
        
        if (!this.speechSynthesis) {
            console.log('❌ 语音合成不可用，跳过播放');
            return;
        }
        
        // 🆕 检查用户交互状态
        if (!this.engineActivated) {
            console.log('⚠️ 语音引擎未激活，尝试激活...');
            
            // 对于时间节点提醒，尝试温和激活
            if (type === 'studyStart' || type === 'studyEnd') {
                console.log('⏰ 时间节点提醒，尝试温和激活语音引擎...');
                this.activateSpeechSynthesis();
                
                // 延迟重试
                setTimeout(() => {
                    if (this.engineActivated) {
                        console.log('✅ 语音引擎激活成功，重试播放');
                        this.speak(text, type, repeatCount, currentRepeat);
                    } else {
                        console.log('❌ 语音引擎激活失败，显示通知代替');
                        this.showNotification('语音提醒', text);
                    }
                }, 1000);
                return;
            }
            
            // 对于用户直接操作的提醒，直接尝试播放
            console.log('🎯 用户操作提醒，尝试直接播放');
        }
        
        // 🆕 增强的语音播放逻辑
        try {
            // 检查语音合成状态
            if (this.speechSynthesis.speaking) {
                console.log('🔊 语音合成忙碌，等待后重试...');
                setTimeout(() => {
                    this.speak(text, type, repeatCount, currentRepeat);
                }, 500);
                return;
            }
            
            const utterance = new SpeechSynthesisUtterance(text);
            
            // 设置语音参数
            utterance.volume = this.volume;
            utterance.rate = this.rate;
            utterance.pitch = this.pitch;
            
            // 选择语音
            const voices = this.speechSynthesis.getVoices();
            if (voices.length > 0) {
                const chineseVoice = voices.find(voice => 
                    voice.lang.includes('zh') || 
                    voice.lang.includes('CN') ||
                    voice.name.includes('Chinese')
                );
                if (chineseVoice) {
                    utterance.voice = chineseVoice;
                    console.log('🎤 使用中文语音:', chineseVoice.name);
                } else {
                    console.log('🎤 使用默认语音');
                }
            }
            
            // 播放事件监听
            utterance.onstart = () => {
                console.log(`🎵 语音播放开始 (${currentRepeat}/${repeatCount}):`, text);
                this.isPlaying = true;
                this.engineActivated = true; // 播放成功表示引擎已激活
            };
            
            utterance.onend = () => {
                console.log(`✅ 语音播放结束 (${currentRepeat}/${repeatCount}):`, text);
                this.isPlaying = false;
                
                // 如果需要重复播放
                if (currentRepeat < repeatCount) {
                    console.log(`🔄 准备重复播放 (${currentRepeat + 1}/${repeatCount})`);
                    setTimeout(() => {
                        this.speak(text, type, repeatCount, currentRepeat + 1);
                    }, 800);
                } else {
                    console.log('🎯 语音播放完成');
                }
            };
            
            utterance.onerror = (error) => {
                console.error('💥 语音播放错误:', error);
                this.isPlaying = false;
                
                // 🆕 错误处理和重试逻辑
                if (error.error === 'not-allowed' || error.error === 'interrupted') {
                    console.log('🚫 语音播放被阻止，显示通知代替');
                    this.showNotification('语音提醒', text);
                    
                    // 如果是时间节点提醒，尝试重新激活
                    if (type === 'studyStart' || type === 'studyEnd') {
                        console.log('⏰ 时间节点提醒被阻止，尝试重新激活语音引擎');
                        this.engineActivated = false;
                        this.activateSpeechSynthesis();
                    }
                } else {
                    // 其他错误，尝试重试
                    if (currentRepeat < repeatCount) {
                        console.log(`🔄 语音播放错误，尝试重试 (${currentRepeat + 1}/${repeatCount})`);
                        setTimeout(() => {
                            this.speak(text, type, repeatCount, currentRepeat + 1);
                        }, 1000);
                    }
                }
            };
            
            // 播放语音
            console.log('🎵 开始播放语音:', text);
            this.speechSynthesis.speak(utterance);
            
        } catch (error) {
            console.error('💥 语音播放异常:', error);
            this.isPlaying = false;
            
            // 显示通知作为备用
            this.showNotification('语音提醒', text);
        }
    }

    /**
     * 显示通知
     */
    showNotification(title, message) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body: message,
                icon: 'icons/icon-192x192.png'
            });
        }
    }

    /**
     * 清除任务提醒
     */
    clearTaskReminder(reminderId) {
        console.log('🗑️ 清除任务提醒:', reminderId);
        
        if (this.timers.has(reminderId)) {
            const timerInfo = this.timers.get(reminderId);
            
            // 清除本地定时器
            if (timerInfo.startTimer) {
                clearTimeout(timerInfo.startTimer);
            }
            if (timerInfo.endTimer) {
                clearTimeout(timerInfo.endTimer);
            }
            
            // 清除Service Worker定时器
            if (this.serviceWorkerReady && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'CANCEL_REMINDER',
                    reminderId: `${reminderId}_start`
                });
                navigator.serviceWorker.controller.postMessage({
                    type: 'CANCEL_REMINDER',
                    reminderId: `${reminderId}_end`
                });
            } else {
                console.log('⚠️ Service Worker未准备就绪或为本地文件环境，跳过后台提醒清除');
            }
            
            this.timers.delete(reminderId);
            console.log('✅ 任务提醒已清除');
        }
    }

    /**
     * 启动时间监控
     */
    startTimeMonitoring() {
        console.log('⏰ 启动时间监控...');
        
        // 每分钟检查一次当前时间
        setInterval(() => {
            this.checkCurrentTime();
        }, 60000); // 60秒
        
        // 立即检查一次
        this.checkCurrentTime();
    }

    /**
     * 检查当前时间
     */
    checkCurrentTime() {
        if (!this.isEnabled) return;
        
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        // 每10分钟记录一次（避免日志过多）
        if (now.getMinutes() % 10 === 0) {
            console.log('🕐 时间检查:', currentTime);
        }
    }

    /**
     * 更新所有任务提醒
     */
    updateAllTaskReminders(studyData, currentDate) {
        console.log('🔄 更新所有任务提醒...');
        
        // 清除所有现有提醒
        this.clearAllReminders();
        
        if (!this.isEnabled) {
            console.log('⚠️ 语音提醒已禁用，跳过更新');
            return;
        }

        const dateKey = this.getDateKey(currentDate);
        const plans = studyData[dateKey] || [];
        
        console.log(`📅 处理 ${dateKey} 的学习计划，共 ${plans.length} 个计划`);
        
        let reminderCount = 0;
        plans.forEach(plan => {
            plan.tasks.forEach(task => {
                if (task.timeSlot) {
                    console.log(`⏰ 为任务 "${task.name}" 设置提醒，时间段: ${task.timeSlot}`);
                    this.setTaskReminder(task, plan.name);
                    reminderCount++;
                }
            });
        });
        
        console.log(`✅ 已设置 ${reminderCount} 个时间节点提醒`);
    }

    /**
     * 获取日期键
     */
    getDateKey(date) {
        return date.toISOString().split('T')[0];
    }

    /**
     * 清除所有提醒
     */
    clearAllReminders() {
        console.log('🗑️ 清除所有提醒...');
        
        // 清除所有本地定时器
        for (const [reminderId, timerInfo] of this.timers) {
            if (timerInfo.startTimer) {
                clearTimeout(timerInfo.startTimer);
            }
            if (timerInfo.endTimer) {
                clearTimeout(timerInfo.endTimer);
            }
        }
        
        // 清空定时器Map
        this.timers.clear();
        
        // 通知Service Worker清除所有提醒
        if (this.serviceWorkerReady && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'CLEAR_ALL_REMINDERS'
            });
        }
        
        console.log('✅ 所有提醒已清除');
    }

    /**
     * 设置任务提醒
     * @param {Object} task - 任务对象
     * @param {string} planName - 计划名称
     */
    setTaskReminder(task, planName) {
        console.log('开始设置任务提醒:', {
            taskName: task.name,
            timeSlot: task.timeSlot,
            planName: planName,
            isEnabled: this.isEnabled,
            studyStartEnabled: this.reminderTypes.studyStart,
            studyEndEnabled: this.reminderTypes.studyEnd
        });

        if (!this.isEnabled || !task.timeSlot) {
            console.log('跳过设置提醒：语音未启用或无时间段');
            return;
        }

        const timeInfo = this.parseTimeSlot(task.timeSlot);
        if (!timeInfo) {
            console.warn('无效的时间段格式:', task.timeSlot);
            return;
        }

        console.log('解析时间段成功:', timeInfo);

        const reminderId = `${task.id}_${planName}`;
        
        // 清除现有提醒
        this.clearTaskReminder(reminderId);

        // 预定义变量，避免作用域问题
        let startTimerId = null;
        let endTimerId = null;
        let startTime = null;
        let endTime = null;

        // 设置学习开始提醒（仅当启用时）
        if (this.reminderTypes.studyStart) {
            startTime = this.getNextReminderTime(timeInfo);
            const delay = startTime.getTime() - Date.now();
            
            console.log('设置学习开始提醒:', {
                startTime: startTime.toLocaleString(),
                delay: delay,
                delayMinutes: Math.round(delay / 60000)
            });

            // 如果延迟时间太长（超过24小时），添加警告
            if (delay > 24 * 60 * 60 * 1000) {
                console.warn('提醒时间超过24小时，可能不会正确触发');
            }
            
            // 本地定时器（页面活跃时使用）
            startTimerId = setTimeout(() => {
                console.log('触发学习开始提醒:', task.name);
                this.playStartReminder(task, planName, timeInfo);
                // 在学习开始时请求Wake Lock
                this.requestWakeLock();
            }, delay);

            // Service Worker定时器（后台使用）
            if (this.serviceWorkerReady && navigator.serviceWorker.controller) {
                console.log('向Service Worker发送提醒安排');
                navigator.serviceWorker.controller.postMessage({
                    type: 'SCHEDULE_REMINDER',
                    reminder: {
                        id: `${reminderId}_start`,
                        title: '学习开始提醒',
                        body: `开始学习了！现在是${task.name}时间`,
                        triggerTime: startTime.toISOString(),
                        type: 'studyStart'
                    }
                });
            } else {
                console.log('⚠️ Service Worker未准备就绪或为本地文件环境，跳过后台提醒设置');
            }
        }

        // 设置学习结束提醒（仅当启用时）
        if (this.reminderTypes.studyEnd && startTime) {
            endTime = new Date(startTime);
            endTime.setHours(timeInfo.end.hour, timeInfo.end.minute, 0, 0);
            const endDelay = endTime.getTime() - Date.now();
            
            console.log('设置学习结束提醒:', {
                endTime: endTime.toLocaleString(),
                endDelay: endDelay,
                endDelayMinutes: Math.round(endDelay / 60000)
            });
            
            // 本地定时器
            endTimerId = setTimeout(() => {
                console.log('触发学习结束提醒:', task.name);
                this.playEndReminder(task, planName);
                // 在学习结束时释放Wake Lock
                this.releaseWakeLock();
            }, endDelay);

            // Service Worker定时器
            if (this.serviceWorkerReady && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'SCHEDULE_REMINDER',
                    reminder: {
                        id: `${reminderId}_end`,
                        title: '学习结束提醒',
                        body: `${task.name}学习时间结束了，休息一下吧！`,
                        triggerTime: endTime.toISOString(),
                        type: 'studyEnd'
                    }
                });
            } else {
                console.log('⚠️ Service Worker未准备就绪或为本地文件环境，跳过学习结束后台提醒设置');
            }
        }

        // 存储定时器信息（只有在至少设置了一个提醒时才存储）
        if (startTimerId || endTimerId) {
            this.timers.set(reminderId, {
                startTimer: startTimerId,
                endTimer: endTimerId,
                task: task,
                planName: planName
            });
            
            console.log('✅ 任务提醒已设置:', reminderId);
        } else {
            console.log('⚠️ 没有设置任何提醒（可能被禁用）');
        }
    }

    /**
     * 播放学习开始提醒
     */
    playStartReminder(task, planName, timeInfo) {
        console.log('🔊 准备播放学习开始提醒:', task.name);
        
        // 🆕 确保语音引擎已激活
        if (!this.engineActivated) {
            console.log('⚠️ 语音引擎未激活，尝试激活...');
            this.activateSpeechSynthesis();
            
            // 延迟播放，给语音引擎时间激活
            setTimeout(() => {
                this.playStartReminder(task, planName, timeInfo);
            }, 1000);
            return;
        }
        
        if (!this.canPlayReminder('studyStart')) {
            console.log('⚠️ 学习开始提醒被禁用，跳过播放');
            return;
        }

        const duration = this.calculateDuration(timeInfo);
        const messages = [
            `开始学习了！现在是${task.name}时间`,
            `学习计划${planName}，${task.name}，预计学习${duration}分钟`,
            `加油！开始${task.name}吧，坚持就是胜利！`,
            `学习时间到了，准备开始${task.name}`,
            `专注学习，${task.name}时间开始了`
        ];
        
        const message = messages[Math.floor(Math.random() * messages.length)];
        
        console.log('🎯 播放学习开始提醒:', message);
        this.speak(message, 'studyStart');
        
        // 显示通知
        this.showNotification('学习开始', message);
    }

    /**
     * 播放学习结束提醒
     */
    playEndReminder(task, planName) {
        console.log('🔊 准备播放学习结束提醒:', task.name);
        
        // 🆕 确保语音引擎已激活
        if (!this.engineActivated) {
            console.log('⚠️ 语音引擎未激活，尝试激活...');
            this.activateSpeechSynthesis();
            
            // 延迟播放，给语音引擎时间激活
            setTimeout(() => {
                this.playEndReminder(task, planName);
            }, 1000);
            return;
        }
        
        if (!this.canPlayReminder('studyEnd')) {
            console.log('⚠️ 学习结束提醒被禁用，跳过播放');
            return;
        }

        const messages = [
            `${task.name}学习时间结束了，休息一下吧！`,
            `恭喜完成${task.name}的学习，给自己鼓掌！`,
            `学习任务完成，记得标记完成状态哦`,
            `${task.name}时间到了，可以休息了`,
            `很棒！${task.name}学习完成，继续保持！`
        ];
        
        const message = messages[Math.floor(Math.random() * messages.length)];
        
        console.log('🎯 播放学习结束提醒:', message);
        this.speak(message, 'studyEnd');
        
        // 显示通知
        this.showNotification('学习结束', message);
    }

    /**
     * 播放任务完成提醒
     * @param {string} taskName - 任务名称
     */
    playTaskCompleteReminder(taskName) {
        if (!this.canPlayReminder('taskComplete')) return;

        const messages = [
            `${taskName}学习状态已标记完成！`,
            `恭喜完成${taskName}学习！`,
            `${taskName}已完成，棒极了！`,
            `很好！${taskName}学习完成`
        ];
        
        const message = messages[Math.floor(Math.random() * messages.length)];
        this.speak(message, 'taskComplete');
    }

    /**
     * 播放任务掌握提醒
     * @param {string} taskName - 任务名称
     * @param {number} points - 获得的积分
     */
    playTaskMasterReminder(taskName, points) {
        if (!this.canPlayReminder('taskMaster')) return;

        const messages = [
            `${taskName}已掌握！获得${points}积分`,
            `恭喜掌握${taskName}！积分+${points}`,
            `很好！${taskName}掌握完成，获得${points}积分`,
            `${taskName}掌握成功！积分奖励${points}分`
        ];
        
        const message = messages[Math.floor(Math.random() * messages.length)];
        this.speak(message, 'taskMaster');
    }

    /**
     * 播放设置确认提醒
     * @param {string} settingType - 设置类型
     * @param {string} value - 设置值
     */
    playSettingConfirmReminder(settingType, value) {
        if (!this.canPlayReminder('settingConfirm')) return;

        let message = '';
        switch (settingType) {
            case 'timeSlot':
                message = `已为${value.taskName}设置时间提醒：${value.timeSlot}`;
                break;
            case 'points':
                message = `已设置积分：${value}分`;
                break;
            case 'voiceSettings':
                message = '语音设置已保存';
                break;
            default:
                message = '设置已保存';
        }
        
        this.speak(message, 'settingConfirm');
    }

    /**
     * 播放计划添加提醒
     * @param {string} planName - 计划名称
     * @param {number} taskCount - 任务数量
     */
    playPlanAddedReminder(planName, taskCount) {
        if (!this.canPlayReminder('planAdded')) return;

        const messages = [
            `学习计划"${planName}"已添加，包含${taskCount}个任务`,
            `新计划"${planName}"创建成功，共${taskCount}个学习任务`,
            `"${planName}"计划已准备就绪，${taskCount}个任务等待完成`,
            `计划"${planName}"添加完成，开始${taskCount}个学习任务吧`
        ];
        
        const message = messages[Math.floor(Math.random() * messages.length)];
        this.speak(message, 'planAdded');
    }

    /**
     * 播放鼓励性提醒
     * @param {string} context - 上下文
     */
    playEncouragementReminder(context = 'general') {
        if (!this.canPlayReminder('encouragement')) return;

        const encouragementMessages = {
            general: [
                '加油！坚持就是胜利！',
                '你很棒！继续保持！',
                '努力学习，未来可期！',
                '每一次努力都是成长！'
            ],
            completion: [
                '太棒了！今天的学习任务完成了！',
                '恭喜你！又度过了充实的一天！',
                '坚持不懈，你已经很优秀了！',
                '学习完成，给自己一个大大的赞！'
            ],
            milestone: [
                '里程碑达成！你的努力得到了回报！',
                '阶段目标完成，继续向前冲！',
                '你的坚持很了不起！',
                '进步显著，保持这个节奏！'
            ]
        };
        
        const messages = encouragementMessages[context] || encouragementMessages.general;
        const message = messages[Math.floor(Math.random() * messages.length)];
        this.speak(message, 'encouragement');
    }

    /**
     * 计算学习时长
     */
    calculateDuration(timeInfo) {
        const startMinutes = timeInfo.start.hour * 60 + timeInfo.start.minute;
        const endMinutes = timeInfo.end.hour * 60 + timeInfo.end.minute;
        return endMinutes - startMinutes;
    }

    /**
     * 添加语音提醒UI
     */
    addVoiceReminderUI() {
        // 这个方法的实现会在index.html中处理
        console.log('📱 语音提醒UI将由主页面处理');
    }

    /**
     * 绑定语音设置事件
     */
    bindVoiceSettingsEvents() {
        // 这个方法的实现会在index.html中处理
        console.log('🔗 语音设置事件将由主页面处理');
    }

    /**
     * 保存语音设置
     */
    saveVoiceSettings() {
        console.log('💾 保存语音设置...');
        
        // 获取设置值
        const isEnabled = document.getElementById('voiceEnabled')?.checked || false;
        const volume = parseFloat(document.getElementById('voiceVolume')?.value || 0.8);
        const rate = parseFloat(document.getElementById('voiceRate')?.value || 1.0);
        
        // 获取提醒类型设置
        const reminderTypes = {
            studyStart: document.getElementById('voiceStudyStart')?.checked || false,
            studyEnd: document.getElementById('voiceStudyEnd')?.checked || false,
            taskComplete: document.getElementById('voiceTaskComplete')?.checked || false,
            taskMaster: document.getElementById('voiceTaskMaster')?.checked || false,
            settingConfirm: document.getElementById('voiceSettingConfirm')?.checked || false,
            planAdded: document.getElementById('voicePlanAdded')?.checked || false,
            encouragement: document.getElementById('voiceEncouragement')?.checked || false
        };
        
        // 更新设置
        this.isEnabled = isEnabled;
        this.volume = volume;
        this.rate = rate;
        Object.assign(this.reminderTypes, reminderTypes);
        
        // 保存到本地存储
        this.saveSetting('voiceReminderEnabled', isEnabled);
        this.saveSetting('voiceReminderVolume', volume);
        this.saveSetting('voiceReminderRate', rate);
        
        Object.entries(reminderTypes).forEach(([type, enabled]) => {
            const key = `voice${type.charAt(0).toUpperCase() + type.slice(1)}`;
            this.saveSetting(key, enabled);
        });
        
        console.log('✅ 语音设置已保存');
        
        // 播放确认提醒
        if (isEnabled) {
            this.playSettingConfirmReminder('voiceSettings', '');
        }
    }

    /**
     * 测试语音
     */
    async testVoice() {
        console.log('🧪 开始语音测试...');
        
        if (!this.speechSynthesis) {
            alert('❌ 语音引擎不可用！请刷新页面重试。');
            return;
        }
        
        try {
            // 强制激活语音引擎
            this.activateSpeechSynthesis();
            
            // 播放测试语音
            const testMessage = '语音测试成功！系统工作正常！';
            this.speak(testMessage, null, 1);
            
            console.log('✅ 语音测试完成');
            
        } catch (error) {
            console.error('💥 语音测试失败:', error);
            alert('❌ 语音测试失败: ' + error.message);
        }
    }

    /**
     * 更新状态
     */
    updateStatus(type, status) {
        console.log(`📊 状态更新: ${type} = ${status}`);
    }

    /**
     * 强制激活严格浏览器
     */
    async forceActivateForStrictBrowsers() {
        console.log('💪 强制激活严格浏览器语音功能...');
        
        const attemptActivation = () => {
            return new Promise((resolve) => {
                try {
                    // 创建一个简单的utterance来激活引擎
                    const utterance = new SpeechSynthesisUtterance('激活');
                    utterance.volume = 0.01; // 几乎静音
                    utterance.rate = 2.0; // 快速播放
                    
                    utterance.onstart = () => {
                        console.log('✅ 语音引擎激活成功');
                        this.engineActivated = true;
                        resolve(true);
                    };
                    
                    utterance.onerror = (error) => {
                        console.log('❌ 激活失败:', error);
                        resolve(false);
                    };
                    
                    utterance.onend = () => {
                        if (!this.engineActivated) {
                            resolve(false);
                        }
                    };
                    
                    this.speechSynthesis.speak(utterance);
                    
                    // 超时处理
                    setTimeout(() => {
                        if (!this.engineActivated) {
                            console.log('⏱️ 激活超时');
                            resolve(false);
                        }
                    }, 3000);
                    
                } catch (error) {
                    console.error('💥 激活异常:', error);
                    resolve(false);
                }
            });
        };
        
        // 多次尝试激活
        for (let i = 0; i < 3; i++) {
            console.log(`🔄 第 ${i + 1} 次尝试激活...`);
            const success = await attemptActivation();
            if (success) {
                console.log('🎉 严格浏览器语音激活成功！');
                return true;
            }
            
            // 等待一段时间再重试
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log('❌ 严格浏览器语音激活失败');
        return false;
    }

    /**
     * 获取已启用提醒统计
     */
    getEnabledReminderStats() {
        const total = Object.keys(this.reminderTypes).length;
        const enabled = Object.values(this.reminderTypes).filter(Boolean).length;
        return { enabled, total };
    }

    /**
     * 更新状态显示
     */
    updateStatusDisplay() {
        // 由主页面处理
        console.log('📊 状态显示更新');
    }

    /**
     * 设置测试提醒
     */
    setTestReminder(task, planName, delaySeconds = 5) {
        console.log(`设置测试提醒：${delaySeconds}秒后触发`);
        
        const reminderId = `test_${task.id}_${planName}`;
        
        // 清除现有提醒
        this.clearTaskReminder(reminderId);
        
        // 设置测试提醒
        const testTimerId = setTimeout(() => {
            console.log('触发测试提醒:', task.name);
            this.playStartReminder(task, planName, { start: { hour: 0, minute: 0 }, end: { hour: 1, minute: 0 } });
        }, delaySeconds * 1000);
        
        // 存储定时器ID
        this.timers.set(reminderId, {
            startTimer: testTimerId,
            endTimer: null,
            task: task,
            planName: planName,
            isTest: true
        });
        
        console.log(`测试提醒已设置，${delaySeconds}秒后播放`);
    }

    /**
     * iPhone 6 专用激活
     */
    activateForIPhone6() {
        console.log('📱 iPhone 6 专用语音激活...');
        
        // iPhone 6 专用的激活逻辑
        this.activateSpeechSynthesis();
        
        // 标记为已激活
        this.engineActivated = true;
        
        console.log('✅ iPhone 6 语音激活完成');
    }

    /**
     * iPhone 6 专用测试
     */
    async testForIPhone6() {
        console.log('🧪 iPhone 6 专用测试...');
        
        try {
            this.activateForIPhone6();
            
            const testMessage = 'iPhone 6 语音测试成功！';
            this.speak(testMessage, null, 1);
            
            return true;
        } catch (error) {
            console.error('💥 iPhone 6 测试失败:', error);
            return false;
        }
    }

    /**
     * iPhone 6 专用语音播放
     */
    speakForIPhone6(text, type = null, repeatCount = 3) {
        console.log('📱 iPhone 6 专用语音播放:', text);
        
        // 确保激活
        this.activateForIPhone6();
        
        // 播放语音
        this.speak(text, type, repeatCount);
    }
}

// 全局函数，供HTML调用
function toggleVoiceSettings() {
    document.getElementById('voiceSettingsModal').style.display = 'block';
}

function closeVoiceSettings() {
    document.getElementById('voiceSettingsModal').style.display = 'none';
}

function saveVoiceSettings() {
    if (window.voiceReminder) {
        window.voiceReminder.saveVoiceSettings();
    }
}

function testVoice() {
    if (window.voiceReminder) {
        window.voiceReminder.testVoice();
    }
}

// 快速设置功能
function selectAllReminders() {
    const checkboxes = ['voiceStudyStart', 'voiceStudyEnd', 'voiceTaskComplete', 'voiceTaskMaster', 'voiceSettingConfirm', 'voicePlanAdded', 'voiceEncouragement'];
    checkboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) checkbox.checked = true;
    });
}

function selectNoneReminders() {
    const checkboxes = ['voiceStudyStart', 'voiceStudyEnd', 'voiceTaskComplete', 'voiceTaskMaster', 'voiceSettingConfirm', 'voicePlanAdded', 'voiceEncouragement'];
    checkboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) checkbox.checked = false;
    });
}

function selectEssentialReminders() {
    // 首先全部取消
    selectNoneReminders();
    
    // 只选择重要的提醒
    const essentialReminders = ['voiceStudyStart', 'voiceStudyEnd', 'voiceTaskMaster'];
    essentialReminders.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) checkbox.checked = true;
    });
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoiceReminder;
} 
