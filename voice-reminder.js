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
     * 播放语音提醒
     * @param {string} text - 要播放的文本
     * @param {string} type - 提醒类型（可选）
     * @param {number} repeatCount - 重复播放次数（默认3次）
     * @param {number} currentRepeat - 当前播放次数（内部使用）
     */
    speak(text, type = null, repeatCount = 3, currentRepeat = 1) {
        console.log(`🔊 尝试播放语音: "${text}", 类型: ${type}, 重复: ${currentRepeat}/${repeatCount}`);
        
        // 如果指定了类型，检查该类型是否启用
        if (type && !this.canPlayReminder(type)) {
            console.log(`❌ 语音类型 ${type} 被禁用，跳过播放`);
            return;
        }
        
        // 检查语音引擎是否可用
        if (!this.speechSynthesis) {
            console.error('❌ 语音引擎未初始化或不可用');
            
            // 尝试重新初始化
            this.initializeSpeechSynthesis();
            
            // 延迟重试
            setTimeout(() => {
                if (this.speechSynthesis) {
                    this.speak(text, type, repeatCount, currentRepeat);
                } else {
                    console.error('❌ 语音引擎重新初始化失败');
                }
            }, 1000);
            return;
        }

        // 检查并激活语音引擎
        if (!this.activateSpeechSynthesis()) {
            console.error('❌ 无法激活语音引擎');
            return;
        }

        // 停止当前播放
        try {
            this.speechSynthesis.cancel();
            console.log('🛑 已停止当前语音播放');
        } catch (error) {
            console.warn('⚠️ 停止语音播放时出错:', error);
        }

        // 创建语音合成实例
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.volume = this.volume;
        utterance.rate = this.rate;
        utterance.pitch = this.pitch;
        utterance.lang = 'zh-CN';

        // 添加详细的事件监听
        utterance.onstart = () => {
            console.log(`✅ 语音开始播放 (${currentRepeat}/${repeatCount}): "${text}"`);
            this.isPlaying = true;
        };

        utterance.onend = () => {
            console.log(`✅ 语音播放完成 (${currentRepeat}/${repeatCount})`);
            this.isPlaying = false;
            
            // 如果还需要重复播放，递归调用
            if (currentRepeat < repeatCount) {
                console.log(`🔄 准备播放下一次 (${currentRepeat + 1}/${repeatCount})`);
                setTimeout(() => {
                    this.speak(text, type, repeatCount, currentRepeat + 1);
                }, 800); // 延迟800毫秒
            } else {
                console.log('🎉 所有语音提醒播放完成');
            }
        };

        utterance.onerror = (e) => {
            console.error(`💥 语音播放错误 (${currentRepeat}/${repeatCount}):`, e);
            this.isPlaying = false;
            
            // 尝试重新激活语音引擎
            this.activateSpeechSynthesis();
            
            // 如果出错但还需要重复播放，尝试继续播放
            if (currentRepeat < repeatCount) {
                console.log(`🔄 语音播放出错，尝试重新播放 (${currentRepeat + 1}/${repeatCount})`);
                setTimeout(() => {
                    this.speak(text, type, repeatCount, currentRepeat + 1);
                }, 1000);
            }
        };

        utterance.onpause = () => {
            console.log('⏸️ 语音播放暂停');
        };

        utterance.onresume = () => {
            console.log('▶️ 语音播放恢复');
        };

        // 尝试播放语音
        try {
            console.log(`🎯 开始播放语音: "${text}"`);
            this.speechSynthesis.speak(utterance);
            
            // 检查播放状态
            setTimeout(() => {
                if (!this.speechSynthesis.speaking && !this.isPlaying) {
                    console.warn('⚠️ 语音可能被浏览器阻止，尝试重新播放');
                    this.handleBlockedSpeech(text, type, repeatCount, currentRepeat);
                }
            }, 100);
            
        } catch (error) {
            console.error('💥 语音播放异常:', error);
            this.handleBlockedSpeech(text, type, repeatCount, currentRepeat);
        }
    }

    /**
     * 激活语音合成引擎
     * 解决浏览器自动播放策略问题
     */
    activateSpeechSynthesis() {
        // 检查语音引擎是否可用
        if (!this.speechSynthesis) {
            console.error('❌ 语音引擎未初始化');
            return false;
        }

        try {
            // 检测浏览器类型
            const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
            const isFirefox = /Firefox/.test(navigator.userAgent);
            const isSafari = /Safari/.test(navigator.userAgent) && /Apple Computer/.test(navigator.vendor);
            
            console.log('🔍 浏览器检测:', {
                isChrome,
                isFirefox, 
                isSafari,
                userAgent: navigator.userAgent
            });

            // 检查语音合成是否可用
            const voices = this.speechSynthesis.getVoices();
            console.log(`🎤 可用语音数量: ${voices.length}`);
            
            // 如果没有语音，尝试触发语音列表加载
            if (voices.length === 0) {
                console.log('📋 正在加载语音列表...');
                this.speechSynthesis.addEventListener('voiceschanged', () => {
                    const newVoices = this.speechSynthesis.getVoices();
                    console.log(`🎤 语音列表已更新，可用语音数量: ${newVoices.length}`);
                }, { once: true });
            }

            // 针对不同浏览器使用不同的激活策略
            if (!this.engineActivated) {
                console.log('🔧 激活语音引擎...');
                
                if (isChrome || isFirefox) {
                    // Chrome和Firefox需要更强的激活机制
                    this.activateForStrictBrowsers();
                } else if (isSafari) {
                    // Safari使用标准激活
                    this.activateForSafari();
                } else {
                    // 其他浏览器使用通用激活
                    this.activateGeneric();
                }
                
                this.engineActivated = true;
                console.log('✅ 语音引擎已激活');
            }

            return true;
        } catch (error) {
            console.error('💥 激活语音引擎失败:', error);
            return false;
        }
    }

    /**
     * 为Chrome和Firefox等严格浏览器激活语音
     */
    activateForStrictBrowsers() {
        console.log('🔒 使用严格模式激活语音引擎');
        
        try {
            // 方法1：创建静音的短语音
            const utterance1 = new SpeechSynthesisUtterance('');
            utterance1.volume = 0.01;
            utterance1.rate = 10;
            utterance1.pitch = 0.1;
            this.speechSynthesis.speak(utterance1);
            
            // 方法2：创建极短的文本语音
            setTimeout(() => {
                const utterance2 = new SpeechSynthesisUtterance('.');
                utterance2.volume = 0.01;
                utterance2.rate = 10;
                this.speechSynthesis.speak(utterance2);
            }, 50);
            
            // 方法3：尝试取消和重新激活
            setTimeout(() => {
                this.speechSynthesis.cancel();
                const utterance3 = new SpeechSynthesisUtterance(' ');
                utterance3.volume = 0.01;
                this.speechSynthesis.speak(utterance3);
            }, 100);
            
            console.log('✅ 严格模式激活完成');
        } catch (error) {
            console.error('💥 严格模式激活失败:', error);
        }
    }

    /**
     * 为Safari激活语音
     */
    activateForSafari() {
        console.log('🍎 使用Safari模式激活语音引擎');
        
        try {
            const testUtterance = new SpeechSynthesisUtterance('');
            testUtterance.volume = 0;
            this.speechSynthesis.speak(testUtterance);
            console.log('✅ Safari模式激活完成');
        } catch (error) {
            console.error('💥 Safari模式激活失败:', error);
        }
    }

    /**
     * 通用激活方法
     */
    activateGeneric() {
        console.log('🌐 使用通用模式激活语音引擎');
        
        try {
            const testUtterance = new SpeechSynthesisUtterance('test');
            testUtterance.volume = 0.01;
            testUtterance.rate = 5;
            this.speechSynthesis.speak(testUtterance);
            console.log('✅ 通用模式激活完成');
        } catch (error) {
            console.error('💥 通用模式激活失败:', error);
        }
    }

    /**
     * 检查语音引擎是否真正可用
     */
    async checkVoiceEngineReady() {
        return new Promise((resolve) => {
            // 创建测试语音
            const testUtterance = new SpeechSynthesisUtterance('test');
            testUtterance.volume = 0.01;
            testUtterance.rate = 10;
            
            let resolved = false;
            
            testUtterance.onstart = () => {
                if (!resolved) {
                    resolved = true;
                    console.log('✅ 语音引擎确认可用');
                    resolve(true);
                }
            };
            
            testUtterance.onend = () => {
                if (!resolved) {
                    resolved = true;
                    console.log('✅ 语音引擎测试完成');
                    resolve(true);
                }
            };
            
            testUtterance.onerror = () => {
                if (!resolved) {
                    resolved = true;
                    console.log('❌ 语音引擎测试失败');
                    resolve(false);
                }
            };
            
            // 播放测试语音
            this.speechSynthesis.speak(testUtterance);
            
            // 超时机制
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    console.log('⏰ 语音引擎测试超时');
                    resolve(false);
                }
            }, 1000);
        });
    }

    /**
     * 处理被阻止的语音播放
     */
    handleBlockedSpeech(text, type, repeatCount, currentRepeat) {
        console.warn('⚠️ 语音可能被浏览器阻止，显示提示');
        
        // 显示用户友好的提示
        const alertMsg = `🔊 语音提醒被浏览器阻止\n\n请点击"确定"激活语音功能\n\n内容: ${text}`;
        
        if (confirm(alertMsg)) {
            console.log('🎯 用户确认激活语音，重新尝试播放');
            
            // 用户交互后重新尝试播放
            this.engineActivated = false; // 重置引擎状态
            setTimeout(() => {
                this.speak(text, type, repeatCount, currentRepeat);
            }, 100);
        }
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

        // 只有当至少有一个提醒被设置时才存储定时器信息
        if (startTimerId || endTimerId) {
            // 存储定时器ID
            this.timers.set(reminderId, {
                startTimer: startTimerId,
                endTimer: endTimerId,
                task: task,
                planName: planName,
                startTime: startTime,
                endTime: endTime
            });

            console.log(`✅ 任务提醒设置完成: ${task.name} (${task.timeSlot})`);
            console.log('当前活动提醒数量:', this.timers.size);
        } else {
            console.log('所有提醒类型都被禁用，跳过设置');
        }
    }

    /**
     * 播放学习开始提醒
     */
    playStartReminder(task, planName, timeInfo) {
        if (!this.canPlayReminder('studyStart')) return;

        const duration = this.calculateDuration(timeInfo);
        const messages = [
            `开始学习了！现在是${task.name}时间`,
            `学习计划${planName}，${task.name}，预计学习${duration}分钟`,
            `加油！开始${task.name}吧，坚持就是胜利！`,
            `学习时间到了，准备开始${task.name}`,
            `专注学习，${task.name}时间开始了`
        ];
        
        const message = messages[Math.floor(Math.random() * messages.length)];
        this.speak(message, 'studyStart');
        
        // 显示通知
        this.showNotification('学习开始', message);
    }

    /**
     * 播放学习结束提醒
     */
    playEndReminder(task, planName) {
        if (!this.canPlayReminder('studyEnd')) return;

        const messages = [
            `${task.name}学习时间结束了，休息一下吧！`,
            `恭喜完成${task.name}的学习，给自己鼓掌！`,
            `学习任务完成，记得标记完成状态哦`,
            `${task.name}时间到了，可以休息了`,
            `很棒！${task.name}学习完成，继续保持！`
        ];
        
        const message = messages[Math.floor(Math.random() * messages.length)];
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
     * @param {number} points - 获得积分
     */
    playTaskMasterReminder(taskName, points) {
        if (!this.canPlayReminder('taskMaster')) return;

        const messages = [
            `恭喜掌握${taskName}！获得积分${points}分`,
            `太棒了！${taskName}已掌握，获得${points}分`,
            `${taskName}掌握完成！积分+${points}`,
            `厉害！掌握${taskName}，获得${points}积分`
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
     * @param {string} context - 上下文信息
     */
    playEncouragementReminder(context = 'general') {
        if (!this.canPlayReminder('encouragement')) return;

        let messages = [];
        
        switch (context) {
            case 'dailyGoal':
                messages = [
                    '今日学习目标达成！继续保持这种学习状态！',
                    '太棒了！今天的学习计划完成得很出色！',
                    '恭喜完成今日所有学习任务，你真棒！'
                ];
                break;
            case 'weeklyGoal':
                messages = [
                    '本周学习目标达成！这一周的努力很值得！',
                    '一周的坚持终有收获，继续加油！',
                    '本周学习完成度很高，为自己点赞！'
                ];
                break;
            default:
                messages = [
                    '学习路上每一步都很珍贵，继续前进！',
                    '坚持就是胜利，每天进步一点点！',
                    '你的努力一定会有回报，加油！',
                    '学习使人进步，今天又成长了！'
                ];
        }
        
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
     * 显示浏览器通知
     */
    showNotification(title, message) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body: message,
                icon: '/icon-192.png'
            });
        }
    }

    /**
     * 清除任务提醒
     */
    clearTaskReminder(reminderId) {
        const timerInfo = this.timers.get(reminderId);
        if (timerInfo) {
            // 清除本地定时器
            if (timerInfo.startTimer) clearTimeout(timerInfo.startTimer);
            if (timerInfo.endTimer) clearTimeout(timerInfo.endTimer);
            
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
            console.log('已清除增强版任务提醒:', reminderId);
        }
    }

    /**
     * 启动时间监控
     */
    startTimeMonitoring() {
        // 每分钟检查一次时间
        setInterval(() => {
            this.checkCurrentTime();
        }, 60000);
    }

    /**
     * 检查当前时间是否需要提醒
     */
    checkCurrentTime() {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        // 这里可以添加更多的时间检查逻辑
        console.log('时间检查:', currentTime);
    }

    /**
     * 更新所有任务提醒
     */
    updateAllTaskReminders(studyData, currentDate) {
        // 清除所有现有提醒
        this.clearAllReminders();
        
        if (!this.isEnabled) return;

        const dateKey = this.getDateKey(currentDate);
        const plans = studyData[dateKey] || [];
        
        plans.forEach(plan => {
            plan.tasks.forEach(task => {
                if (task.timeSlot) {
                    this.setTaskReminder(task, plan.name);
                }
            });
        });
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
        this.timers.forEach((timerInfo, reminderId) => {
            this.clearTaskReminder(reminderId);
        });
    }

    /**
     * 添加语音提醒设置界面
     */
    addVoiceReminderUI() {
        // 创建语音提醒设置按钮
        const settingsHTML = `
            <div id="voiceReminderSettings" style="position: fixed; bottom: 70px; left: 220px; z-index: 1001;">
                <div style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 10px; border-radius: 50%; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.3); font-size: 16px;" onclick="toggleVoiceSettings()">
                    🔊
                </div>
            </div>
            
            <div id="voiceSettingsModal" class="modal" style="display: none;">
                <div class="modal-content" style="max-height: 90vh; overflow-y: auto;">
                    <div class="modal-header">
                        <span class="modal-title">语音提醒设置 (增强版)</span>
                        <button class="close-btn" onclick="closeVoiceSettings()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <!-- 功能状态显示 -->
                        <div class="form-group" style="background: #f8f9ff; padding: 10px; border-radius: 5px; margin-bottom: 15px;">
                            <div style="font-size: 12px; color: #666;">
                                <strong>🚀 增强功能状态：</strong><br>
                                <span id="serviceWorkerStatus">🔄 Service Worker: 检查中...</span><br>
                                <span id="notificationStatus">🔔 通知权限: ${Notification.permission}</span><br>
                                <span id="wakeLockStatus">📱 Wake Lock: ${('wakeLock' in navigator) ? '支持' : '不支持'}</span>
                            </div>
                        </div>
                        
                        <!-- 主开关 -->
                        <div class="form-group">
                            <label class="form-label" style="font-size: 14px; color: #333; margin-bottom: 10px;">
                                <input type="checkbox" id="voiceEnabled" ${this.isEnabled ? 'checked' : ''} style="margin-right: 8px;">
                                <strong>启用语音提醒</strong>
                            </label>
                        </div>
                        
                        <!-- 后台功能设置 -->
                        <div class="form-group">
                            <label class="form-label" style="font-size: 13px; color: #555; margin-bottom: 10px;">
                                <strong>📱 后台功能设置：</strong>
                            </label>
                            <div style="display: grid; grid-template-columns: 1fr; gap: 8px; font-size: 12px;">
                                <label style="display: flex; align-items: center;">
                                    <input type="checkbox" id="backgroundNotifications" ${this.loadSetting('backgroundNotifications', true) ? 'checked' : ''} style="margin-right: 6px;">
                                    🔔 后台通知提醒（锁屏时显示通知）
                                </label>
                                <label style="display: flex; align-items: center;">
                                    <input type="checkbox" id="wakeLockEnabled" ${this.loadSetting('wakeLockEnabled', true) ? 'checked' : ''} style="margin-right: 6px;">
                                    📱 学习时保持屏幕唤醒
                                </label>
                                <label style="display: flex; align-items: center;">
                                    <input type="checkbox" id="vibrationEnabled" ${this.loadSetting('vibrationEnabled', true) ? 'checked' : ''} style="margin-right: 6px;">
                                    📳 振动提醒
                                </label>
                            </div>
                        </div>
                        
                        <!-- 分隔线 -->
                        <hr style="margin: 15px 0; border: none; border-top: 1px solid #eee;">
                        
                        <!-- 提醒类型选择 -->
                        <div class="form-group">
                            <label class="form-label" style="font-size: 13px; color: #555; margin-bottom: 10px;">
                                <strong>选择提醒类型：</strong>
                            </label>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
                                <label style="display: flex; align-items: center;">
                                    <input type="checkbox" id="voiceStudyStart" ${this.reminderTypes.studyStart ? 'checked' : ''} style="margin-right: 6px;">
                                    🕐 学习开始提醒
                                </label>
                                <label style="display: flex; align-items: center;">
                                    <input type="checkbox" id="voiceStudyEnd" ${this.reminderTypes.studyEnd ? 'checked' : ''} style="margin-right: 6px;">
                                    ⏰ 学习结束提醒
                                </label>
                                <label style="display: flex; align-items: center;">
                                    <input type="checkbox" id="voiceTaskComplete" ${this.reminderTypes.taskComplete ? 'checked' : ''} style="margin-right: 6px;">
                                    ✅ 任务完成提醒
                                </label>
                                <label style="display: flex; align-items: center;">
                                    <input type="checkbox" id="voiceTaskMaster" ${this.reminderTypes.taskMaster ? 'checked' : ''} style="margin-right: 6px;">
                                    🎯 任务掌握提醒
                                </label>
                                <label style="display: flex; align-items: center;">
                                    <input type="checkbox" id="voiceSettingConfirm" ${this.reminderTypes.settingConfirm ? 'checked' : ''} style="margin-right: 6px;">
                                    ⚙️ 设置确认提醒
                                </label>
                                <label style="display: flex; align-items: center;">
                                    <input type="checkbox" id="voicePlanAdded" ${this.reminderTypes.planAdded ? 'checked' : ''} style="margin-right: 6px;">
                                    📋 计划添加提醒
                                </label>
                                <label style="display: flex; align-items: center; grid-column: 1 / -1;">
                                    <input type="checkbox" id="voiceEncouragement" ${this.reminderTypes.encouragement ? 'checked' : ''} style="margin-right: 6px;">
                                    💪 鼓励性提醒
                                </label>
                            </div>
                        </div>
                        
                        <!-- 分隔线 -->
                        <hr style="margin: 15px 0; border: none; border-top: 1px solid #eee;">
                        
                        <!-- 语音参数设置 -->
                        <div class="form-group">
                            <label class="form-label" style="font-size: 13px; color: #555;">
                                <strong>语音参数设置：</strong>
                            </label>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">音量</label>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <input type="range" id="voiceVolume" min="0" max="1" step="0.1" value="${this.volume}" style="flex: 1;">
                                <span id="volumeValue" style="min-width: 40px; font-weight: bold;">${Math.round(this.volume * 100)}%</span>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">语速</label>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <input type="range" id="voiceRate" min="0.5" max="2" step="0.1" value="${this.rate}" style="flex: 1;">
                                <span id="rateValue" style="min-width: 40px; font-weight: bold;">${this.rate}x</span>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">音调</label>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <input type="range" id="voicePitch" min="0.5" max="2" step="0.1" value="${this.pitch}" style="flex: 1;">
                                <span id="pitchValue" style="min-width: 40px; font-weight: bold;">${this.pitch}x</span>
                            </div>
                        </div>
                        
                        <!-- 按钮组 -->
                        <div class="form-group" style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
                            <button class="btn btn-primary" onclick="testVoice()" style="flex: 1;">测试语音</button>
                            <button class="btn btn-success" onclick="saveVoiceSettings()" style="flex: 1;">保存设置</button>
                        </div>
                        
                        <!-- 快速设置 -->
                        <div class="form-group" style="margin-top: 15px;">
                            <label class="form-label" style="font-size: 13px; color: #555;">
                                <strong>快速设置：</strong>
                            </label>
                            <div style="display: flex; gap: 8px; justify-content: center;">
                                <button class="btn" style="font-size: 11px; padding: 4px 8px;" onclick="selectAllReminders()">全选</button>
                                <button class="btn" style="font-size: 11px; padding: 4px 8px;" onclick="selectNoneReminders()">全不选</button>
                                <button class="btn" style="font-size: 11px; padding: 4px 8px;" onclick="selectEssentialReminders()">仅重要</button>
                            </div>
                        </div>
                        
                        <!-- 使用说明 -->
                        <div class="form-group" style="margin-top: 20px; background: #f0f8ff; padding: 10px; border-radius: 5px;">
                            <div style="font-size: 11px; color: #666;">
                                <strong>💡 使用说明：</strong><br>
                                • 后台通知：手机锁屏时会显示通知提醒<br>
                                • 屏幕唤醒：学习时间段内保持屏幕不息屏<br>
                                • 振动提醒：配合语音和通知的振动反馈<br>
                                • 连续播放：每次语音提醒播放3次，确保不会错过
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 添加到页面
        document.body.insertAdjacentHTML('beforeend', settingsHTML);
        
        // 绑定事件
        this.bindVoiceSettingsEvents();
        
        // 更新状态显示
        this.updateStatusDisplay();
    }

    /**
     * 绑定语音设置事件
     */
    bindVoiceSettingsEvents() {
        // 监听设置变化
        document.getElementById('voiceVolume').addEventListener('input', (e) => {
            this.volume = parseFloat(e.target.value);
            document.getElementById('volumeValue').textContent = Math.round(this.volume * 100) + '%';
        });

        document.getElementById('voiceRate').addEventListener('input', (e) => {
            this.rate = parseFloat(e.target.value);
            document.getElementById('rateValue').textContent = this.rate + 'x';
        });

        document.getElementById('voicePitch').addEventListener('input', (e) => {
            this.pitch = parseFloat(e.target.value);
            document.getElementById('pitchValue').textContent = this.pitch + 'x';
        });
    }

    /**
     * 保存语音设置
     */
    saveVoiceSettings() {
        // 保存主开关
        this.isEnabled = document.getElementById('voiceEnabled').checked;
        
        // 保存语音参数
        this.volume = parseFloat(document.getElementById('voiceVolume').value);
        this.rate = parseFloat(document.getElementById('voiceRate').value);
        this.pitch = parseFloat(document.getElementById('voicePitch').value);

        // 保存各种提醒类型设置
        this.reminderTypes.studyStart = document.getElementById('voiceStudyStart').checked;
        this.reminderTypes.studyEnd = document.getElementById('voiceStudyEnd').checked;
        this.reminderTypes.taskComplete = document.getElementById('voiceTaskComplete').checked;
        this.reminderTypes.taskMaster = document.getElementById('voiceTaskMaster').checked;
        this.reminderTypes.settingConfirm = document.getElementById('voiceSettingConfirm').checked;
        this.reminderTypes.planAdded = document.getElementById('voicePlanAdded').checked;
        this.reminderTypes.encouragement = document.getElementById('voiceEncouragement').checked;

        // 保存后台功能设置
        const backgroundNotifications = document.getElementById('backgroundNotifications')?.checked ?? true;
        const wakeLockEnabled = document.getElementById('wakeLockEnabled')?.checked ?? true;
        const vibrationEnabled = document.getElementById('vibrationEnabled')?.checked ?? true;

        // 保存到本地存储
        this.saveSetting('voiceReminderEnabled', this.isEnabled);
        this.saveSetting('voiceReminderVolume', this.volume);
        this.saveSetting('voiceReminderRate', this.rate);
        this.saveSetting('voiceReminderPitch', this.pitch);
        
        // 保存各种提醒类型
        Object.keys(this.reminderTypes).forEach(type => {
            this.saveSetting(`voice${type.charAt(0).toUpperCase() + type.slice(1)}`, this.reminderTypes[type]);
        });
        
        // 保存后台功能设置
        this.saveSetting('backgroundNotifications', backgroundNotifications);
        this.saveSetting('wakeLockEnabled', wakeLockEnabled);
        this.saveSetting('vibrationEnabled', vibrationEnabled);

        // 播放确认提醒
        this.playSettingConfirmReminder('voiceSettings', null);
        
        // 更新状态指示器
        if (window.updateVoiceIndicator) {
            window.updateVoiceIndicator();
        }
        
        // 关闭设置窗口
        document.getElementById('voiceSettingsModal').style.display = 'none';
        
        console.log('增强版语音设置已保存:', {
            isEnabled: this.isEnabled,
            reminderTypes: this.reminderTypes,
            volume: this.volume,
            rate: this.rate,
            pitch: this.pitch,
            backgroundSettings: {
                backgroundNotifications,
                wakeLockEnabled,
                vibrationEnabled
            }
        });
        
        // 如果用户关闭了后台通知，提醒用户
        if (!backgroundNotifications) {
            alert('提示：您已关闭后台通知，锁屏时将无法收到提醒。');
        }
    }

    /**
     * 测试语音功能
     * 增强版本，支持严格浏览器策略
     */
    async testVoice() {
        console.log('🧪 开始测试语音功能...');
        
        if (!this.speechSynthesis) {
            console.error('❌ 语音合成不可用');
            alert('❌ 语音引擎未初始化，请刷新页面重试');
            return false;
        }

        try {
            // 检测浏览器类型
            const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
            const isFirefox = /Firefox/.test(navigator.userAgent);
            const isStrictBrowser = isChrome || isFirefox;
            
            console.log('🔍 浏览器检测（测试）:', { isChrome, isFirefox, isStrictBrowser });
            
            if (isStrictBrowser) {
                // 对于严格浏览器，需要更强的激活
                console.log('🔒 检测到严格浏览器，执行强化激活...');
                await this.forceActivateForStrictBrowsers();
            }
            
            // 强制激活语音引擎
            if (!this.activateSpeechSynthesis()) {
                throw new Error('语音引擎激活失败');
            }
            
            // 等待语音引擎准备就绪
            const isReady = await this.checkVoiceEngineReady();
            if (!isReady && isStrictBrowser) {
                console.log('🔄 语音引擎未准备就绪，尝试重新激活...');
                await this.forceActivateForStrictBrowsers();
            }
            
            // 创建测试语音
            const testText = '语音测试成功！系统工作正常！';
            console.log('🎯 准备播放测试语音:', testText);
            
            return new Promise((resolve) => {
                // 停止当前所有语音
                this.speechSynthesis.cancel();
                
                const utterance = new SpeechSynthesisUtterance(testText);
                utterance.volume = 0.8;
                utterance.rate = 1.0;
                utterance.pitch = 1.0;
                utterance.lang = 'zh-CN';
                
                let testCompleted = false;
                
                utterance.onstart = () => {
                    console.log('✅ 语音测试开始播放');
                    this.updateStatus('testing', true);
                };
                
                utterance.onend = () => {
                    console.log('✅ 语音测试播放完成');
                    if (!testCompleted) {
                        testCompleted = true;
                        this.updateStatus('testing', false);
                        resolve(true);
                    }
                };
                
                utterance.onerror = (event) => {
                    console.error('💥 语音测试失败:', event);
                    if (!testCompleted) {
                        testCompleted = true;
                        this.updateStatus('testing', false);
                        
                        if (isStrictBrowser) {
                            // 对于严格浏览器，给出特定的解决方案
                            alert(`❌ 语音测试失败！\n\n${isChrome ? 'Chrome' : 'Firefox'}浏览器解决方案：\n\n1. 确保页面已经有用户交互（点击、滚动等）\n2. 检查浏览器设置是否允许音频播放\n3. 尝试刷新页面后重新测试\n4. 检查系统音量是否静音\n\n如果问题持续，建议使用Safari浏览器。`);
                        } else {
                            alert('❌ 语音测试失败，请检查浏览器设置和系统音量');
                        }
                        resolve(false);
                    }
                };
                
                // 播放测试语音
                try {
                    this.speechSynthesis.speak(utterance);
                    console.log('🔊 语音测试指令已发送');
                } catch (error) {
                    console.error('💥 语音播放异常:', error);
                    if (!testCompleted) {
                        testCompleted = true;
                        alert('语音播放异常: ' + error.message);
                        resolve(false);
                    }
                }
                
                // 超时检查
                setTimeout(() => {
                    if (!testCompleted) {
                        console.warn('⏰ 语音测试超时');
                        testCompleted = true;
                        this.updateStatus('testing', false);
                        
                        if (isStrictBrowser) {
                            alert(`⏰ 语音测试超时！\n\n这通常是因为${isChrome ? 'Chrome' : 'Firefox'}浏览器的安全策略阻止了自动播放。\n\n解决方案：\n1. 多点击几次页面上的按钮\n2. 播放一段音频或视频\n3. 刷新页面后重新尝试\n4. 检查浏览器自动播放设置`);
                        }
                        resolve(false);
                    }
                }, 5000);
            });
            
        } catch (error) {
            console.error('💥 语音测试异常:', error);
            alert('语音测试异常: ' + error.message);
            return false;
        }
    }

    /**
     * 🆕 更新状态显示
     */
    updateStatus(type, status) {
        // 这里可以添加状态更新逻辑
        console.log(`📊 状态更新: ${type} = ${status}`);
    }

    /**
     * 针对严格浏览器的强制激活
     */
    async forceActivateForStrictBrowsers() {
        console.log('💪 开始强制激活语音引擎（严格模式）...');
        
        return new Promise((resolve) => {
            let activationAttempts = 0;
            const maxAttempts = 5;
            
            const attemptActivation = () => {
                activationAttempts++;
                console.log(`🔄 激活尝试 ${activationAttempts}/${maxAttempts}`);
                
                try {
                    // 多重激活策略
                    const strategies = [
                        () => {
                            // 策略1：创建极短的文本
                            const u = new SpeechSynthesisUtterance('.');
                            u.volume = 0.01;
                            u.rate = 10;
                            this.speechSynthesis.speak(u);
                        },
                        () => {
                            // 策略2：空文本 + 低音量
                            const u = new SpeechSynthesisUtterance('');
                            u.volume = 0.001;
                            this.speechSynthesis.speak(u);
                        },
                        () => {
                            // 策略3：单个空格
                            const u = new SpeechSynthesisUtterance(' ');
                            u.volume = 0.05;
                            u.rate = 5;
                            this.speechSynthesis.speak(u);
                        },
                        () => {
                            // 策略4：取消后重新尝试
                            this.speechSynthesis.cancel();
                            setTimeout(() => {
                                const u = new SpeechSynthesisUtterance('test');
                                u.volume = 0.01;
                                u.rate = 10;
                                this.speechSynthesis.speak(u);
                            }, 10);
                        }
                    ];
                    
                    // 执行所有策略
                    strategies.forEach((strategy, index) => {
                        setTimeout(() => {
                            try {
                                strategy();
                            } catch (error) {
                                console.warn(`策略 ${index + 1} 执行失败:`, error);
                            }
                        }, index * 50);
                    });
                    
                    // 检查激活是否成功
                    setTimeout(() => {
                        if (activationAttempts < maxAttempts) {
                            attemptActivation();
                        } else {
                            console.log('✅ 强制激活完成（最大尝试次数）');
                            resolve(true);
                        }
                    }, 200);
                    
                } catch (error) {
                    console.error(`💥 激活尝试 ${activationAttempts} 失败:`, error);
                    if (activationAttempts < maxAttempts) {
                        setTimeout(attemptActivation, 100);
                    } else {
                        console.error('❌ 强制激活失败');
                        resolve(false);
                    }
                }
            };
            
            attemptActivation();
        });
    }

    /**
     * 获取当前启用的提醒类型统计
     */
    getEnabledReminderStats() {
        const enabledCount = Object.values(this.reminderTypes).filter(Boolean).length;
        const totalCount = Object.keys(this.reminderTypes).length;
        return { enabled: enabledCount, total: totalCount };
    }

    /**
     * 更新状态显示
     */
    updateStatusDisplay() {
        setTimeout(() => {
            const serviceWorkerElement = document.getElementById('serviceWorkerStatus');
            const notificationElement = document.getElementById('notificationStatus');
            const wakeLockElement = document.getElementById('wakeLockStatus');
            
            if (serviceWorkerElement) {
                serviceWorkerElement.textContent = `🔄 Service Worker: ${this.serviceWorkerReady ? '已准备' : '未准备'}`;
            }
            if (notificationElement) {
                notificationElement.textContent = `🔔 通知权限: ${Notification.permission}`;
            }
            if (wakeLockElement) {
                wakeLockElement.textContent = `📱 Wake Lock: ${('wakeLock' in navigator) ? '支持' : '不支持'}`;
            }
        }, 100);
    }

    /**
     * 设置测试提醒（用于调试）
     * @param {Object} task - 任务对象  
     * @param {string} planName - 计划名称
     * @param {number} delaySeconds - 延迟秒数
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
     * 🆕 iPhone 6专用语音引擎激活
     */
    activateForIPhone6() {
        console.log('📱 启用iPhone 6专用语音引擎激活...');
        
        const isIPhone6 = /iPhone OS 9_|iPhone OS 10_|iPhone OS 11_|iPhone OS 12_/.test(navigator.userAgent);
        
        if (!isIPhone6) {
            console.log('⚠️ 非iPhone 6设备，跳过专用激活');
            return;
        }
        
        try {
            // iPhone 6 多重激活策略
            const strategies = [
                // 策略1：极短文本激活
                () => {
                    console.log('🔧 策略1：极短文本激活');
                    const u = new SpeechSynthesisUtterance('a');
                    u.volume = 0.01;
                    u.rate = 10;
                    u.pitch = 0.1;
                    this.speechSynthesis.speak(u);
                },
                
                // 策略2：空白激活
                () => {
                    console.log('🔧 策略2：空白激活');
                    const u = new SpeechSynthesisUtterance(' ');
                    u.volume = 0.001;
                    u.rate = 20;
                    this.speechSynthesis.speak(u);
                },
                
                // 策略3：取消重新激活
                () => {
                    console.log('🔧 策略3：取消重新激活');
                    this.speechSynthesis.cancel();
                    setTimeout(() => {
                        const u = new SpeechSynthesisUtterance('.');
                        u.volume = 0.01;
                        u.rate = 5;
                        this.speechSynthesis.speak(u);
                    }, 50);
                },
                
                // 策略4：强制暂停恢复
                () => {
                    console.log('🔧 策略4：强制暂停恢复');
                    const u = new SpeechSynthesisUtterance('test');
                    u.volume = 0.01;
                    u.rate = 10;
                    this.speechSynthesis.speak(u);
                    setTimeout(() => {
                        this.speechSynthesis.pause();
                        setTimeout(() => {
                            this.speechSynthesis.resume();
                        }, 10);
                    }, 10);
                },
                
                // 策略5：强制语音列表加载
                () => {
                    console.log('🔧 策略5：强制语音列表加载');
                    const voices = this.speechSynthesis.getVoices();
                    console.log(`iPhone 6 可用语音数量: ${voices.length}`);
                    
                    if (voices.length > 0) {
                        const u = new SpeechSynthesisUtterance('');
                        u.voice = voices[0];
                        u.volume = 0.01;
                        this.speechSynthesis.speak(u);
                    }
                }
            ];
            
            // 依次执行所有策略
            strategies.forEach((strategy, index) => {
                setTimeout(() => {
                    try {
                        strategy();
                    } catch (error) {
                        console.warn(`iPhone 6 策略 ${index + 1} 失败:`, error);
                    }
                }, index * 100);
            });
            
            console.log('✅ iPhone 6专用激活策略执行完成');
            
        } catch (error) {
            console.error('💥 iPhone 6专用激活失败:', error);
        }
    }

    /**
     * 🆕 iPhone 6专用语音测试
     */
    async testForIPhone6() {
        console.log('🧪 开始iPhone 6专用语音测试...');
        
        const isIPhone6 = /iPhone OS 9_|iPhone OS 10_|iPhone OS 11_|iPhone OS 12_/.test(navigator.userAgent);
        
        if (!isIPhone6) {
            console.log('⚠️ 非iPhone 6设备，使用标准测试');
            return this.testVoice();
        }
        
        try {
            // iPhone 6 特殊测试流程
            console.log('📱 执行iPhone 6特殊测试流程...');
            
            // 1. 强制激活
            this.activateForIPhone6();
            
            // 2. 等待激活完成
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 3. 检查语音合成状态
            const voices = this.speechSynthesis.getVoices();
            console.log(`iPhone 6 语音检查: ${voices.length} 个可用语音`);
            
            // 4. 创建测试语音
            const testText = 'iPhone 6 专用语音测试，系统正常运行';
            const utterance = new SpeechSynthesisUtterance(testText);
            
            // iPhone 6 优化参数
            utterance.volume = 0.9;
            utterance.rate = 0.8;
            utterance.pitch = 1.0;
            utterance.lang = 'zh-CN';
            
            // 如果有可用语音，使用第一个
            if (voices.length > 0) {
                utterance.voice = voices[0];
                console.log(`iPhone 6 使用语音: ${voices[0].name}`);
            }
            
            // 5. 播放测试语音
            return new Promise((resolve) => {
                let testCompleted = false;
                
                utterance.onstart = () => {
                    console.log('✅ iPhone 6 语音测试开始');
                };
                
                utterance.onend = () => {
                    console.log('✅ iPhone 6 语音测试完成');
                    if (!testCompleted) {
                        testCompleted = true;
                        resolve(true);
                    }
                };
                
                utterance.onerror = (event) => {
                    console.error('💥 iPhone 6 语音测试失败:', event);
                    if (!testCompleted) {
                        testCompleted = true;
                        resolve(false);
                    }
                };
                
                // 强制取消当前语音
                this.speechSynthesis.cancel();
                
                // 播放测试语音
                setTimeout(() => {
                    this.speechSynthesis.speak(utterance);
                }, 100);
                
                // 超时处理
                setTimeout(() => {
                    if (!testCompleted) {
                        console.warn('⏰ iPhone 6 语音测试超时');
                        testCompleted = true;
                        resolve(false);
                    }
                }, 8000);
            });
            
        } catch (error) {
            console.error('💥 iPhone 6专用测试异常:', error);
            return false;
        }
    }

    /**
     * 🆕 iPhone 6专用语音播放
     */
    speakForIPhone6(text, type = null, repeatCount = 3) {
        console.log(`🔊 iPhone 6专用语音播放: "${text}"`);
        
        const isIPhone6 = /iPhone OS 9_|iPhone OS 10_|iPhone OS 11_|iPhone OS 12_/.test(navigator.userAgent);
        
        if (!isIPhone6) {
            console.log('⚠️ 非iPhone 6设备，使用标准播放');
            return this.speak(text, type, repeatCount);
        }
        
        try {
            // iPhone 6 特殊播放流程
            console.log('📱 执行iPhone 6特殊播放流程...');
            
            // 1. 预激活
            this.activateForIPhone6();
            
            // 2. 延迟播放
            setTimeout(() => {
                // 创建iPhone 6优化的语音
                const utterance = new SpeechSynthesisUtterance(text);
                
                // iPhone 6 优化参数
                utterance.volume = Math.min(this.volume * 1.2, 1.0); // 稍微增加音量
                utterance.rate = Math.max(this.rate * 0.9, 0.5); // 稍微降低语速
                utterance.pitch = this.pitch;
                utterance.lang = 'zh-CN';
                
                // 获取可用语音
                const voices = this.speechSynthesis.getVoices();
                if (voices.length > 0) {
                    // 优先使用中文语音
                    const chineseVoice = voices.find(voice => voice.lang.startsWith('zh'));
                    if (chineseVoice) {
                        utterance.voice = chineseVoice;
                        console.log(`iPhone 6 使用中文语音: ${chineseVoice.name}`);
                    } else {
                        utterance.voice = voices[0];
                        console.log(`iPhone 6 使用默认语音: ${voices[0].name}`);
                    }
                }
                
                // 事件监听
                utterance.onstart = () => {
                    console.log(`✅ iPhone 6 开始播放: "${text}"`);
                };
                
                utterance.onend = () => {
                    console.log(`✅ iPhone 6 播放完成: "${text}"`);
                };
                
                utterance.onerror = (event) => {
                    console.error(`💥 iPhone 6 播放失败: "${text}"`, event);
                };
                
                // 强制取消当前语音
                this.speechSynthesis.cancel();
                
                // 播放语音
                setTimeout(() => {
                    this.speechSynthesis.speak(utterance);
                }, 50);
                
            }, 200);
            
        } catch (error) {
            console.error('💥 iPhone 6专用播放异常:', error);
            // 降级到标准播放
            this.speak(text, type, 1);
        }
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
