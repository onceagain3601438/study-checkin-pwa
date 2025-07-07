// 语音提醒模块 - 学习打卡PWA专用
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
        this.init();
    }

    /**
     * 初始化语音提醒系统
     */
    init() {
        // 检查浏览器是否支持语音合成
        if (!('speechSynthesis' in window)) {
            console.warn('该浏览器不支持语音合成功能');
            return;
        }

        // 启动时间监控
        this.startTimeMonitoring();
        
        // 添加语音提醒设置界面
        this.addVoiceReminderUI();
        
        console.log('语音提醒系统已启动');
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
        
        // 如果今天的时间已过，设置为明天
        if (reminderTime <= now) {
            reminderTime.setDate(reminderTime.getDate() + 1);
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
        // 如果指定了类型，检查该类型是否启用
        if (type && !this.canPlayReminder(type)) {
            return;
        }
        
        // 如果没有指定类型，检查主开关
        if (!type && (!this.isEnabled || !('speechSynthesis' in window))) {
            return;
        }

        // 停止当前播放
        speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.volume = this.volume;
        utterance.rate = this.rate;
        utterance.pitch = this.pitch;
        utterance.lang = 'zh-CN';

        // 添加事件监听
        utterance.onstart = () => {
            console.log(`语音提醒开始播放 (${currentRepeat}/${repeatCount}):`, text, type ? `(${type})` : '');
        };

        utterance.onend = () => {
            console.log(`语音提醒播放完成 (${currentRepeat}/${repeatCount})`);
            
            // 如果还需要重复播放，递归调用
            if (currentRepeat < repeatCount) {
                // 添加短暂延迟，让声音更清晰
                setTimeout(() => {
                    this.speak(text, type, repeatCount, currentRepeat + 1);
                }, 800); // 延迟800毫秒
            } else {
                console.log('所有语音提醒播放完成');
            }
        };

        utterance.onerror = (e) => {
            console.error('语音提醒播放错误:', e);
            // 如果出错但还需要重复播放，尝试继续播放
            if (currentRepeat < repeatCount) {
                setTimeout(() => {
                    this.speak(text, type, repeatCount, currentRepeat + 1);
                }, 1000);
            }
        };

        speechSynthesis.speak(utterance);
    }

    /**
     * 设置任务提醒
     * @param {Object} task - 任务对象
     * @param {string} planName - 计划名称
     */
    setTaskReminder(task, planName) {
        if (!this.isEnabled || !task.timeSlot) {
            return;
        }

        const timeInfo = this.parseTimeSlot(task.timeSlot);
        if (!timeInfo) {
            console.warn('无效的时间段格式:', task.timeSlot);
            return;
        }

        const reminderId = `${task.id}_${planName}`;
        
        // 清除现有提醒
        this.clearTaskReminder(reminderId);

        // 设置学习开始提醒（仅当启用时）
        if (this.reminderTypes.studyStart) {
            const startTime = this.getNextReminderTime(timeInfo);
            const startTimerId = setTimeout(() => {
                this.playStartReminder(task, planName, timeInfo);
            }, startTime.getTime() - Date.now());

            // 设置学习结束提醒（仅当启用时）
            let endTimerId = null;
            if (this.reminderTypes.studyEnd) {
                const endTime = new Date(startTime);
                endTime.setHours(timeInfo.end.hour, timeInfo.end.minute, 0, 0);
                endTimerId = setTimeout(() => {
                    this.playEndReminder(task, planName);
                }, endTime.getTime() - Date.now());
            }

            // 存储定时器ID
            this.timers.set(reminderId, {
                startTimer: startTimerId,
                endTimer: endTimerId,
                task: task,
                planName: planName
            });

            console.log(`已设置任务提醒: ${task.name} (${task.timeSlot})`);
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
            if (timerInfo.startTimer) clearTimeout(timerInfo.startTimer);
            if (timerInfo.endTimer) clearTimeout(timerInfo.endTimer);
            this.timers.delete(reminderId);
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
                <div class="modal-content" style="max-height: 85vh; overflow-y: auto;">
                    <div class="modal-header">
                        <span class="modal-title">语音提醒设置</span>
                        <button class="close-btn" onclick="closeVoiceSettings()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <!-- 主开关 -->
                        <div class="form-group">
                            <label class="form-label" style="font-size: 14px; color: #333; margin-bottom: 10px;">
                                <input type="checkbox" id="voiceEnabled" ${this.isEnabled ? 'checked' : ''} style="margin-right: 8px;">
                                <strong>启用语音提醒</strong>
                            </label>
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
                    </div>
                </div>
            </div>
        `;

        // 添加到页面
        document.body.insertAdjacentHTML('beforeend', settingsHTML);
        
        // 绑定事件
        this.bindVoiceSettingsEvents();
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

        // 保存到本地存储
        this.saveSetting('voiceReminderEnabled', this.isEnabled);
        this.saveSetting('voiceReminderVolume', this.volume);
        this.saveSetting('voiceReminderRate', this.rate);
        this.saveSetting('voiceReminderPitch', this.pitch);
        
        // 保存各种提醒类型
        Object.keys(this.reminderTypes).forEach(type => {
            this.saveSetting(`voice${type.charAt(0).toUpperCase() + type.slice(1)}`, this.reminderTypes[type]);
        });

        // 播放确认提醒
        this.playSettingConfirmReminder('voiceSettings', null);
        
        // 更新状态指示器
        if (window.updateVoiceIndicator) {
            window.updateVoiceIndicator();
        }
        
        // 关闭设置窗口
        document.getElementById('voiceSettingsModal').style.display = 'none';
        
        console.log('语音设置已保存:', {
            isEnabled: this.isEnabled,
            reminderTypes: this.reminderTypes,
            volume: this.volume,
            rate: this.rate,
            pitch: this.pitch
        });
    }

    /**
     * 测试语音
     */
    testVoice() {
        // 临时更新设置用于测试
        const tempVolume = this.volume;
        const tempRate = this.rate;
        const tempPitch = this.pitch;
        
        this.volume = parseFloat(document.getElementById('voiceVolume').value);
        this.rate = parseFloat(document.getElementById('voiceRate').value);
        this.pitch = parseFloat(document.getElementById('voicePitch').value);
        
        // 测试语音只播放一次
        this.speak('这是语音提醒测试，您的设置效果很好！', null, 1);
        
        // 恢复原设置
        this.volume = tempVolume;
        this.rate = tempRate;
        this.pitch = tempPitch;
    }

    /**
     * 获取当前启用的提醒类型统计
     */
    getEnabledReminderStats() {
        const enabledCount = Object.values(this.reminderTypes).filter(Boolean).length;
        const totalCount = Object.keys(this.reminderTypes).length;
        return { enabled: enabledCount, total: totalCount };
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
