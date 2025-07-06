"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// 积分分配比例常量
const STUDY_POINTS_RATIO = 0.3; // 学习状态获得30%积分
const MASTER_POINTS_RATIO = 0.7; // 掌握状态获得70%积分
// 学习打卡页面 - 以学习计划为主体
const date_1 = require("../../utils/date");
const storage_1 = require("../../utils/storage");
Page({
    /**
     * 页面初始数据
     */
    data: {
        currentDate: new Date(),
        currentDateText: '',
        studyPlans: [],
        totalPoints: 0, // 用户总积分
        dailyStats: {
            totalPlans: 0,
            completedTasks: 0,
            totalTime: 0,
            completionRate: 0,
            totalPoints: 0,
            earnedPoints: 0
        }
    },
    /**
     * 页面加载时执行
     */
    onLoad() {
        // 初始化页面
        this.initPage();
        // 加载数据
        this.loadTotalPoints();
        this.loadStudyPlans();
    },
    /**
     * 页面显示时执行
     */
    onShow() {
        // 检查是否有从首页传递过来的日期参数
        try {
            const selectedDate = wx.getStorageSync('selected_date');
            if (selectedDate) {
                // 有选中的日期，使用该日期
                const targetDate = new Date(selectedDate);
                if (!isNaN(targetDate.getTime())) {
                    this.setData({
                        currentDate: targetDate,
                        currentDateText: (0, date_1.formatDate)(targetDate, 'YYYY年MM月DD日')
                    });
                    console.log('从首页跳转，使用日期:', selectedDate);
                }
                // 清除存储的日期参数，避免影响下次进入
                wx.removeStorageSync('selected_date');
            }
        }
        catch (error) {
            console.error('读取选中日期失败:', error);
        }
        // 加载数据
        this.loadTotalPoints();
        this.loadStudyPlans();
    },
    /**
     * 初始化页面
     */
    initPage() {
        const currentDate = new Date();
        this.setData({
            currentDate,
            currentDateText: (0, date_1.formatDate)(currentDate, 'YYYY年MM月DD日')
        });
    },
    /**
     * 加载用户总积分
     */
    loadTotalPoints() {
        try {
            const totalPoints = wx.getStorageSync('user_total_points') || 0;
            this.setData({ totalPoints });
            console.log('加载用户总积分:', totalPoints);
        }
        catch (error) {
            console.error('加载总积分失败:', error);
        }
    },
    /**
     * 保存用户总积分
     */
    saveTotalPoints() {
        try {
            wx.setStorageSync('user_total_points', this.data.totalPoints);
            console.log('保存用户总积分:', this.data.totalPoints);
        }
        catch (error) {
            console.error('保存总积分失败:', error);
        }
    },
    /**
     * 加载学习计划数据
     */
    loadStudyPlans() {
        try {
            const dateKey = (0, date_1.getDateString)(this.data.currentDate);
            const storageKey = `study_plans_${dateKey}`;
            let savedPlans = wx.getStorageSync(storageKey);
            // 确保savedPlans是数组
            if (!Array.isArray(savedPlans)) {
                console.log('当前计划数据格式不正确:', savedPlans);
                savedPlans = [];
            }
            // 为每个计划计算统计数据，并确保数据结构完整
            const studyPlans = savedPlans.map((plan) => {
                // 确保每个任务都有完整的字段
                const completeTasks = plan.tasks.map((task) => ({
                    id: task.id,
                    name: task.name,
                    timeSlot: task.timeSlot || '',
                    studyCompleted: task.studyCompleted || false,
                    masteredCompleted: task.masteredCompleted || false,
                    points: task.points || 0,
                    earnedPoints: task.earnedPoints || 0
                }));
                return this.calculatePlanStats({
                    ...plan,
                    tasks: completeTasks
                });
            });
            // 计算每日统计
            const dailyStats = this.calculateDailyStats(studyPlans);
            this.setData({
                studyPlans,
                dailyStats
            });
            // 保存修复后的数据
            this.saveStudyPlans();
            console.log('加载的学习计划数据:', studyPlans);
        }
        catch (error) {
            console.error('加载学习计划失败:', error);
            wx.showToast({
                title: '加载失败',
                icon: 'error'
            });
        }
    },
    /**
     * 保存学习计划数据
     */
    saveStudyPlans() {
        try {
            const dateKey = (0, date_1.getDateString)(this.data.currentDate);
            const storageKey = `study_plans_${dateKey}`;
            wx.setStorageSync(storageKey, this.data.studyPlans);
        }
        catch (error) {
            console.error('保存学习计划失败:', error);
            wx.showToast({
                title: '保存失败',
                icon: 'error'
            });
        }
    },
    /**
     * 计算计划统计数据
     */
    calculatePlanStats(plan) {
        const totalTasks = plan.tasks.length;
        const completedTasks = plan.tasks.filter(task => task.masteredCompleted).length;
        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        // 计算积分统计 - 使用新的分段积分计算
        const totalPoints = plan.tasks.reduce((sum, task) => sum + (task.points || 0), 0);
        const earnedPoints = plan.tasks.reduce((sum, task) => sum + this.calculateTaskEarnedPoints(task), 0);
        return {
            ...plan,
            totalTasks,
            completedTasks,
            completionRate,
            totalPoints,
            earnedPoints
        };
    },
    /**
     * 计算每日统计数据
     */
    calculateDailyStats(studyPlans) {
        const totalPlans = studyPlans.length;
        const completedTasks = studyPlans.reduce((sum, plan) => sum + plan.completedTasks, 0);
        const totalTasksCount = studyPlans.reduce((sum, plan) => sum + plan.totalTasks, 0);
        const completionRate = totalTasksCount > 0 ? Math.round((completedTasks / totalTasksCount) * 100) : 0;
        // 计算积分统计
        const totalPoints = studyPlans.reduce((sum, plan) => sum + (plan.totalPoints || 0), 0);
        const earnedPoints = studyPlans.reduce((sum, plan) => sum + (plan.earnedPoints || 0), 0);
        return {
            totalPlans,
            completedTasks,
            totalTime: 0, // 暂时设为0，因为不再计算总时间
            completionRate,
            totalPoints,
            earnedPoints
        };
    },
    /**
     * 上一天
     */
    onPrevDay() {
        const currentDate = new Date(this.data.currentDate);
        currentDate.setDate(currentDate.getDate() - 1);
        this.setData({
            currentDate,
            currentDateText: (0, date_1.formatDate)(currentDate, 'YYYY年MM月DD日')
        });
        this.loadTotalPoints();
        this.loadStudyPlans();
    },
    /**
     * 下一天
     */
    onNextDay() {
        const currentDate = new Date(this.data.currentDate);
        currentDate.setDate(currentDate.getDate() + 1);
        this.setData({
            currentDate,
            currentDateText: (0, date_1.formatDate)(currentDate, 'YYYY年MM月DD日')
        });
        this.loadTotalPoints();
        this.loadStudyPlans();
    },
    /**
     * 添加学习计划
     */
    onAddPlan() {
        wx.showModal({
            title: '添加学习计划',
            content: '请输入计划名称',
            placeholderText: '计划名称',
            editable: true,
            success: (res) => {
                if (res.confirm && res.content) {
                    const newPlan = {
                        id: Date.now().toString(),
                        name: res.content,
                        tasks: [],
                        completionRate: 0,
                        completedTasks: 0,
                        totalTasks: 0,
                        totalPoints: 0,
                        earnedPoints: 0
                    };
                    const studyPlans = [...this.data.studyPlans, newPlan];
                    this.setData({ studyPlans });
                    this.saveStudyPlans();
                    wx.showToast({
                        title: '添加成功',
                        icon: 'success'
                    });
                }
            }
        });
    },
    /**
     * 编辑学习计划
     */
    onEditPlan(event) {
        const plan = event.currentTarget.dataset.plan;
        wx.showModal({
            title: '编辑学习计划',
            content: '请输入计划名称',
            placeholderText: plan.name,
            editable: true,
            success: (res) => {
                if (res.confirm && res.content) {
                    const studyPlans = this.data.studyPlans.map(p => p.id === plan.id ? { ...p, name: res.content } : p);
                    this.setData({ studyPlans });
                    this.saveStudyPlans();
                    wx.showToast({
                        title: '修改成功',
                        icon: 'success'
                    });
                }
            }
        });
    },
    /**
     * 保存学习计划为模板
     */
    onSavePlanAsTemplate(event) {
        const plan = event.currentTarget.dataset.plan;
        wx.showModal({
            title: '保存为模板',
            content: '请输入模板名称',
            placeholderText: plan.name,
            editable: true,
            success: (res) => {
                if (res.confirm && res.content) {
                    try {
                        // 获取现有模板，确保是数组格式
                        let templates = (0, storage_1.getStudyTemplates)();
                        // 确保templates是数组
                        if (!Array.isArray(templates)) {
                            console.log('修复模板存储格式:', templates);
                            templates = [];
                        }
                        // 创建新模板
                        const newTemplate = {
                            id: Date.now().toString(),
                            name: res.content,
                            content: plan.tasks.map((task) => `${task.name}${task.timeSlot ? ` (${task.timeSlot})` : ''}`).join('\n'),
                            createTime: new Date().toISOString(),
                            tasks: plan.tasks.map((task) => ({
                                name: task.name,
                                timeSlot: task.timeSlot
                            }))
                        };
                        // 保存模板
                        (0, storage_1.saveStudyTemplates)(templates.concat(newTemplate));
                        wx.showToast({
                            title: '模板保存成功',
                            icon: 'success'
                        });
                    }
                    catch (error) {
                        console.error('保存模板失败:', error);
                        wx.showToast({
                            title: '保存失败',
                            icon: 'error'
                        });
                    }
                }
            }
        });
    },
    /**
     * 删除学习计划
     */
    onDeletePlan(event) {
        const plan = event.currentTarget.dataset.plan;
        wx.showModal({
            title: '删除计划',
            content: `确定要删除"${plan.name}"吗？`,
            success: (res) => {
                if (res.confirm) {
                    const studyPlans = this.data.studyPlans.filter(p => p.id !== plan.id);
                    this.setData({ studyPlans });
                    this.saveStudyPlans();
                    wx.showToast({
                        title: '删除成功',
                        icon: 'success'
                    });
                }
            }
        });
    },
    /**
     * 添加任务
     */
    onAddTask(event) {
        const planId = event.currentTarget.dataset.planId;
        wx.showModal({
            title: '添加任务',
            content: '请输入任务名称',
            placeholderText: '任务名称',
            editable: true,
            success: (res) => {
                if (res.confirm && res.content) {
                    const newTask = {
                        id: Date.now().toString(),
                        name: res.content,
                        timeSlot: '', // 默认空时间段
                        studyCompleted: false,
                        masteredCompleted: false,
                        points: 0,
                        earnedPoints: 0
                    };
                    const studyPlans = this.data.studyPlans.map(plan => {
                        if (plan.id === planId) {
                            return this.calculatePlanStats({
                                ...plan,
                                tasks: [...plan.tasks, newTask]
                            });
                        }
                        return plan;
                    });
                    this.setData({
                        studyPlans,
                        dailyStats: this.calculateDailyStats(studyPlans)
                    });
                    this.saveStudyPlans();
                    wx.showToast({
                        title: '添加成功',
                        icon: 'success'
                    });
                }
            }
        });
    },
    /**
     * 删除任务
     */
    onDeleteTask(event) {
        const { planId, taskId } = event.currentTarget.dataset;
        // 找到要删除的任务信息
        const plan = this.data.studyPlans.find(p => p.id === planId);
        const task = plan?.tasks.find(t => t.id === taskId);
        if (!task) {
            wx.showToast({
                title: '任务不存在',
                icon: 'error'
            });
            return;
        }
        wx.showModal({
            title: '删除任务',
            content: `确定要删除任务"${task.name}"吗？`,
            success: (res) => {
                if (res.confirm) {
                    const studyPlans = this.data.studyPlans.map(plan => {
                        if (plan.id === planId) {
                            const updatedTasks = plan.tasks.filter(task => task.id !== taskId);
                            return this.calculatePlanStats({
                                ...plan,
                                tasks: updatedTasks
                            });
                        }
                        return plan;
                    });
                    this.setData({
                        studyPlans,
                        dailyStats: this.calculateDailyStats(studyPlans)
                    });
                    this.saveStudyPlans();
                    wx.showToast({
                        title: '删除成功',
                        icon: 'success'
                    });
                }
            }
        });
    },
    /**
     * 编辑任务名称
     */
    onEditTask(event) {
        const { planId, taskId } = event.currentTarget.dataset;
        // 找到要编辑的任务信息
        const plan = this.data.studyPlans.find(p => p.id === planId);
        const task = plan?.tasks.find(t => t.id === taskId);
        if (!task) {
            wx.showToast({
                title: '任务不存在',
                icon: 'error'
            });
            return;
        }
        wx.showModal({
            title: '编辑任务',
            content: '请输入新的任务名称',
            placeholderText: task.name,
            editable: true,
            success: (res) => {
                if (res.confirm && res.content && res.content.trim()) {
                    // 更新任务名称
                    const studyPlans = this.data.studyPlans.map(plan => {
                        if (plan.id === planId) {
                            const updatedTasks = plan.tasks.map(task => task.id === taskId ? { ...task, name: res.content.trim() } : task);
                            return this.calculatePlanStats({
                                ...plan,
                                tasks: updatedTasks
                            });
                        }
                        return plan;
                    });
                    this.setData({
                        studyPlans,
                        dailyStats: this.calculateDailyStats(studyPlans)
                    });
                    this.saveStudyPlans();
                    wx.showToast({
                        title: '修改成功',
                        icon: 'success'
                    });
                }
                else if (res.confirm && !res.content?.trim()) {
                    wx.showToast({
                        title: '任务名称不能为空',
                        icon: 'error'
                    });
                }
            }
        });
    },
    /**
     * 设置时间段
     */
    onSetTimeSlot(event) {
        console.log('点击设置时间段按钮', event.currentTarget.dataset);
        const { planId, taskId } = event.currentTarget.dataset;
        if (!planId || !taskId) {
            console.error('缺少planId或taskId参数');
            wx.showToast({
                title: '参数错误',
                icon: 'error'
            });
            return;
        }
        // 显示时间段选择
        this.showTimeSlotSelector(planId, taskId);
    },
    /**
     * 显示时间段选择器
     */
    showTimeSlotSelector(planId, taskId) {
        // 第一级选择：时间段分类
        wx.showActionSheet({
            itemList: [
                '自定义时间段',
                '上午时段(1小时)',
                '下午时段(1小时)',
                '晚上时段(1小时)',
                '30分钟时段',
                '长时间段(1.5-2小时)'
            ],
            success: (res) => {
                console.log('选择了时间段分类', res.tapIndex);
                switch (res.tapIndex) {
                    case 0:
                        this.showCustomTimeSlotInput(planId, taskId);
                        break;
                    case 1:
                        this.showMorningTimeSlots(planId, taskId);
                        break;
                    case 2:
                        this.showAfternoonTimeSlots(planId, taskId);
                        break;
                    case 3:
                        this.showEveningTimeSlots(planId, taskId);
                        break;
                    case 4:
                        this.showShortTimeSlots(planId, taskId);
                        break;
                    case 5:
                        this.showLongTimeSlots(planId, taskId);
                        break;
                }
            },
            fail: (error) => {
                console.error('showActionSheet失败', error);
                this.showCustomTimeSlotInput(planId, taskId);
            }
        });
    },
    /**
     * 显示上午时段选择
     */
    showMorningTimeSlots(planId, taskId) {
        const timeSlots = ['08:00-09:00', '09:00-10:00', '10:00-11:00', '11:00-12:00'];
        wx.showActionSheet({
            itemList: timeSlots,
            success: (res) => {
                const selectedTimeSlot = timeSlots[res.tapIndex];
                this.updateTaskTimeSlot(planId, taskId, selectedTimeSlot);
            }
        });
    },
    /**
     * 显示下午时段选择
     */
    showAfternoonTimeSlots(planId, taskId) {
        const timeSlots = ['14:00-15:00', '15:00-16:00', '16:00-17:00', '17:00-18:00'];
        wx.showActionSheet({
            itemList: timeSlots,
            success: (res) => {
                const selectedTimeSlot = timeSlots[res.tapIndex];
                this.updateTaskTimeSlot(planId, taskId, selectedTimeSlot);
            }
        });
    },
    /**
     * 显示晚上时段选择
     */
    showEveningTimeSlots(planId, taskId) {
        const timeSlots = ['19:00-20:00', '20:00-21:00', '21:00-22:00', '22:00-23:00'];
        wx.showActionSheet({
            itemList: timeSlots,
            success: (res) => {
                const selectedTimeSlot = timeSlots[res.tapIndex];
                this.updateTaskTimeSlot(planId, taskId, selectedTimeSlot);
            }
        });
    },
    /**
     * 显示短时间段选择(30分钟)
     */
    showShortTimeSlots(planId, taskId) {
        const timeSlots = ['08:00-08:30', '08:30-09:00', '14:30-15:00', '19:30-20:00', '20:30-21:00'];
        wx.showActionSheet({
            itemList: timeSlots,
            success: (res) => {
                const selectedTimeSlot = timeSlots[res.tapIndex];
                this.updateTaskTimeSlot(planId, taskId, selectedTimeSlot);
            }
        });
    },
    /**
     * 显示长时间段选择(1.5-2小时)
     */
    showLongTimeSlots(planId, taskId) {
        const timeSlots = ['08:00-09:30', '08:00-10:00', '14:00-15:30', '14:00-16:00', '19:00-20:30', '19:00-21:00'];
        wx.showActionSheet({
            itemList: timeSlots,
            success: (res) => {
                const selectedTimeSlot = timeSlots[res.tapIndex];
                this.updateTaskTimeSlot(planId, taskId, selectedTimeSlot);
            }
        });
    },
    /**
     * 显示自定义时间段输入框
     */
    showCustomTimeSlotInput(planId, taskId) {
        wx.showModal({
            title: '设置时间段',
            content: '请输入时间段（如：08:00-09:00）',
            placeholderText: '08:00-09:00',
            editable: true,
            success: (modalRes) => {
                if (modalRes.confirm && modalRes.content) {
                    this.updateTaskTimeSlot(planId, taskId, modalRes.content);
                }
            },
            fail: (error) => {
                console.error('showModal失败', error);
                wx.showToast({
                    title: '设置失败',
                    icon: 'error'
                });
            }
        });
    },
    /**
     * 更新任务时间段
     */
    updateTaskTimeSlot(planId, taskId, timeSlot) {
        console.log('更新任务时间段', { planId, taskId, timeSlot });
        try {
            const studyPlans = this.data.studyPlans.map(plan => {
                if (plan.id === planId) {
                    const updatedTasks = plan.tasks.map(task => task.id === taskId ? { ...task, timeSlot } : task);
                    return this.calculatePlanStats({ ...plan, tasks: updatedTasks });
                }
                return plan;
            });
            console.log('更新后的计划数据:', studyPlans);
            this.setData({
                studyPlans,
                dailyStats: this.calculateDailyStats(studyPlans)
            });
            this.saveStudyPlans();
            wx.showToast({
                title: '时间段设置成功',
                icon: 'success'
            });
        }
        catch (error) {
            console.error('更新时间段失败', error);
            wx.showToast({
                title: '设置失败',
                icon: 'error'
            });
        }
    },
    /**
     * 切换学习状态
     */
    onToggleStudy(event) {
        const { planId, taskId } = event.currentTarget.dataset;
        this.updateTaskStatus(planId, taskId, 'studyCompleted');
    },
    /**
     * 切换掌握状态
     */
    onToggleMaster(event) {
        const { planId, taskId } = event.currentTarget.dataset;
        this.updateTaskStatus(planId, taskId, 'masteredCompleted');
    },
    /**
     * 设置积分
     */
    onSetPoints(event) {
        const { planId, taskId } = event.currentTarget.dataset;
        // 找到要设置积分的任务
        const plan = this.data.studyPlans.find(p => p.id === planId);
        const task = plan?.tasks.find(t => t.id === taskId);
        if (!task) {
            wx.showToast({
                title: '任务不存在',
                icon: 'error'
            });
            return;
        }
        wx.showModal({
            title: '设置积分',
            content: '请输入任务总积分\n学习可得30%，掌握可得70%',
            placeholderText: task.points > 0 ? task.points.toString() : '10',
            editable: true,
            success: (res) => {
                if (res.confirm && res.content) {
                    const points = parseInt(res.content);
                    if (isNaN(points) || points < 0) {
                        wx.showToast({
                            title: '请输入有效的积分值',
                            icon: 'error'
                        });
                        return;
                    }
                    // 更新任务积分
                    const studyPlans = this.data.studyPlans.map(plan => {
                        if (plan.id === planId) {
                            const updatedTasks = plan.tasks.map(task => {
                                if (task.id === taskId) {
                                    const oldEarnedPoints = this.calculateTaskEarnedPoints(task);
                                    const newTask = {
                                        ...task,
                                        points: points
                                    };
                                    // 计算新的已获得积分
                                    const newEarnedPoints = this.calculateTaskEarnedPoints(newTask);
                                    newTask.earnedPoints = newEarnedPoints;
                                    // 计算积分变化并更新总积分
                                    const pointsChange = newEarnedPoints - oldEarnedPoints;
                                    if (pointsChange !== 0) {
                                        const newTotalPoints = Math.max(0, this.data.totalPoints + pointsChange);
                                        this.setData({ totalPoints: newTotalPoints });
                                        this.saveTotalPoints();
                                        console.log(`任务积分设置: ${task.points} → ${points}，积分变化: ${pointsChange}，新总积分: ${newTotalPoints}`);
                                    }
                                    return newTask;
                                }
                                return task;
                            });
                            return this.calculatePlanStats({
                                ...plan,
                                tasks: updatedTasks
                            });
                        }
                        return plan;
                    });
                    this.setData({
                        studyPlans,
                        dailyStats: this.calculateDailyStats(studyPlans)
                    });
                    this.saveStudyPlans();
                    wx.showToast({
                        title: '积分设置成功',
                        icon: 'success'
                    });
                }
            }
        });
    },
    /**
     * 更新任务状态
     */
    updateTaskStatus(planId, taskId, statusField) {
        const studyPlans = this.data.studyPlans.map(plan => {
            if (plan.id === planId) {
                const updatedTasks = plan.tasks.map(task => {
                    if (task.id === taskId) {
                        // 记录原来的已获得积分
                        const oldEarnedPoints = this.calculateTaskEarnedPoints(task);
                        // 更新任务状态
                        const updatedTask = { ...task, [statusField]: !task[statusField] };
                        // 计算新的已获得积分
                        const newEarnedPoints = this.calculateTaskEarnedPoints(updatedTask);
                        updatedTask.earnedPoints = newEarnedPoints;
                        // 计算积分变化并更新总积分
                        const pointsChange = newEarnedPoints - oldEarnedPoints;
                        if (pointsChange !== 0) {
                            const newTotalPoints = Math.max(0, this.data.totalPoints + pointsChange);
                            this.setData({ totalPoints: newTotalPoints });
                            this.saveTotalPoints();
                            const statusName = statusField === 'studyCompleted' ? '学习' : '掌握';
                            const actionName = updatedTask[statusField] ? '完成' : '取消';
                            console.log(`${statusName}状态${actionName}，积分变化: ${pointsChange}，总积分: ${newTotalPoints}`);
                        }
                        return updatedTask;
                    }
                    return task;
                });
                return this.calculatePlanStats({ ...plan, tasks: updatedTasks });
            }
            return plan;
        });
        this.setData({
            studyPlans,
            dailyStats: this.calculateDailyStats(studyPlans)
        });
        this.saveStudyPlans();
    },
    /**
     * 复制昨天的学习计划
     */
    onCopyYesterday() {
        try {
            // 获取昨天的日期
            const yesterday = new Date(this.data.currentDate);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayKey = (0, date_1.getDateString)(yesterday);
            const yesterdayStorageKey = `study_plans_${yesterdayKey}`;
            // 获取昨天的学习计划
            let yesterdayPlans = wx.getStorageSync(yesterdayStorageKey);
            // 确保yesterdayPlans是数组
            if (!Array.isArray(yesterdayPlans)) {
                console.log('昨天的计划数据格式不正确:', yesterdayPlans);
                yesterdayPlans = [];
            }
            if (yesterdayPlans.length === 0) {
                wx.showToast({
                    title: '昨天没有学习计划',
                    icon: 'none'
                });
                return;
            }
            wx.showModal({
                title: '复制昨天计划',
                content: `发现昨天有${yesterdayPlans.length}个学习计划，是否复制到今天？`,
                success: (res) => {
                    if (res.confirm) {
                        // 复制计划结构，重置掌握状态
                        const copiedPlans = yesterdayPlans.map((plan) => ({
                            ...plan,
                            id: Date.now().toString() + Math.random(), // 生成新ID
                            tasks: plan.tasks.map((task) => ({
                                ...task,
                                id: Date.now().toString() + Math.random(), // 生成新ID
                                studyCompleted: false, // 重置状态
                                masteredCompleted: false,
                                earnedPoints: 0 // 重置已获得积分
                            }))
                        }));
                        // 计算统计数据
                        const studyPlans = copiedPlans.map((plan) => this.calculatePlanStats(plan));
                        this.setData({
                            studyPlans,
                            dailyStats: this.calculateDailyStats(studyPlans)
                        });
                        this.saveStudyPlans();
                        wx.showToast({
                            title: '复制成功',
                            icon: 'success'
                        });
                    }
                }
            });
        }
        catch (error) {
            console.error('复制昨天计划失败:', error);
            wx.showToast({
                title: '复制失败',
                icon: 'error'
            });
        }
    },
    /**
     * 加载学习模板
     */
    onLoadTemplate() {
        try {
            let templates = (0, storage_1.getStudyTemplates)();
            // 确保templates是数组
            if (!Array.isArray(templates)) {
                console.log('修复模板存储格式:', templates);
                templates = [];
            }
            if (templates.length === 0) {
                wx.showModal({
                    title: '没有模板',
                    content: '还没有保存的学习模板，是否跳转到模板管理页面创建？',
                    success: (res) => {
                        if (res.confirm) {
                            wx.switchTab({
                                url: '/pages/study-template/study-template'
                            });
                        }
                    }
                });
                return;
            }
            // 显示模板选择
            const templateNames = templates.map((t) => t.name);
            wx.showActionSheet({
                itemList: templateNames,
                success: (res) => {
                    const selectedTemplate = templates[res.tapIndex];
                    this.loadTemplateToToday(selectedTemplate);
                }
            });
        }
        catch (error) {
            console.error('加载模板失败:', error);
            wx.showToast({
                title: '加载失败',
                icon: 'error'
            });
        }
    },
    /**
     * 将模板应用到今天
     */
    loadTemplateToToday(template) {
        try {
            let tasks = [];
            // 优先使用模板的tasks结构（新格式）
            if (template.tasks && Array.isArray(template.tasks)) {
                tasks = template.tasks.map((taskTemplate, index) => ({
                    id: (Date.now() + index).toString(),
                    name: taskTemplate.name,
                    timeSlot: taskTemplate.timeSlot || '',
                    studyCompleted: false,
                    masteredCompleted: false,
                    points: taskTemplate.points || 0,
                    earnedPoints: 0
                }));
            }
            else {
                // 兼容旧格式（从content解析）
                tasks = this.parseTemplateContent(template.content);
            }
            const newPlan = {
                id: Date.now().toString(),
                name: template.name,
                tasks: tasks,
                completionRate: 0,
                completedTasks: 0,
                totalTasks: tasks.length,
                totalPoints: 0,
                earnedPoints: 0
            };
            const studyPlans = [...this.data.studyPlans, this.calculatePlanStats(newPlan)];
            this.setData({
                studyPlans,
                dailyStats: this.calculateDailyStats(studyPlans)
            });
            this.saveStudyPlans();
            wx.showToast({
                title: '模板加载成功',
                icon: 'success'
            });
        }
        catch (error) {
            console.error('应用模板失败:', error);
            wx.showToast({
                title: '应用失败',
                icon: 'error'
            });
        }
    },
    /**
     * 解析模板内容为任务列表
     */
    parseTemplateContent(content) {
        const lines = content.split('\n').filter(line => line.trim());
        return lines.map((line, index) => ({
            id: (Date.now() + index).toString(),
            name: line.trim(),
            timeSlot: '',
            studyCompleted: false,
            masteredCompleted: false,
            points: 0,
            earnedPoints: 0
        }));
    },
    /**
     * 加载默认计划
     */
    onLoadDefault() {
        try {
            const defaultPlan = wx.getStorageSync('default_study_plan');
            if (!defaultPlan) {
                wx.showModal({
                    title: '没有默认计划',
                    content: '还没有设置默认学习计划，是否创建一个基础的默认计划？',
                    success: (res) => {
                        if (res.confirm) {
                            this.createBasicDefaultPlan();
                        }
                    }
                });
                return;
            }
            // 应用默认计划
            const studyPlans = [...this.data.studyPlans, this.calculatePlanStats(defaultPlan)];
            this.setData({
                studyPlans,
                dailyStats: this.calculateDailyStats(studyPlans)
            });
            this.saveStudyPlans();
            wx.showToast({
                title: '默认计划加载成功',
                icon: 'success'
            });
        }
        catch (error) {
            console.error('加载默认计划失败:', error);
            wx.showToast({
                title: '加载失败',
                icon: 'error'
            });
        }
    },
    /**
     * 创建基础默认计划
     */
    createBasicDefaultPlan() {
        const defaultTasks = [
            {
                id: '1',
                name: '英语学习',
                timeSlot: '08:00-09:00',
                studyCompleted: false,
                masteredCompleted: false,
                points: 0,
                earnedPoints: 0
            },
            {
                id: '2',
                name: '专业课程',
                timeSlot: '09:00-10:00',
                studyCompleted: false,
                masteredCompleted: false,
                points: 0,
                earnedPoints: 0
            },
            {
                id: '3',
                name: '阅读时间',
                timeSlot: '20:00-21:00',
                studyCompleted: false,
                masteredCompleted: false,
                points: 0,
                earnedPoints: 0
            }
        ];
        const defaultPlan = {
            id: Date.now().toString(),
            name: '我的日常学习',
            tasks: defaultTasks,
            completionRate: 0,
            completedTasks: 0,
            totalTasks: defaultTasks.length,
            totalPoints: 0,
            earnedPoints: 0
        };
        // 保存为默认计划
        wx.setStorageSync('default_study_plan', defaultPlan);
        // 应用到今天
        const studyPlans = [...this.data.studyPlans, this.calculatePlanStats(defaultPlan)];
        this.setData({
            studyPlans,
            dailyStats: this.calculateDailyStats(studyPlans)
        });
        this.saveStudyPlans();
        wx.showToast({
            title: '默认计划创建成功',
            icon: 'success'
        });
    },
    /**
     * 计算任务实际获得的积分
     */
    calculateTaskEarnedPoints(task) {
        let earnedPoints = 0;
        // 学习状态：获得30%积分
        if (task.studyCompleted) {
            earnedPoints += Math.round(task.points * STUDY_POINTS_RATIO);
        }
        // 掌握状态：获得70%积分
        if (task.masteredCompleted) {
            earnedPoints += Math.round(task.points * MASTER_POINTS_RATIO);
        }
        return earnedPoints;
    }
});
