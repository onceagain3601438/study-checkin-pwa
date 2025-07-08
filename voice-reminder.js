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
     * 播放语音
     * @param {string} text - 要播放的文本
     * @param {string} type - 提醒类型
     * @param {number} repeatCount - 重复次数
     * @param {number} currentRepeat - 当前重复次数
     */
    speak(text, type = null, repeatCount = 3, currentRepeat = 1) {
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
