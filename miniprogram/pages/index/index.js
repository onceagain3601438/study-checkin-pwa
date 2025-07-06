"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// 学习打卡日历首页
const date_1 = require("../../utils/date");
Page({
    /**
     * 页面初始数据
     */
    data: {
        currentYear: 2025,
        currentMonth: 1,
        currentDate: new Date(),
        calendarDays: [],
        totalPoints: 0,
        monthStats: {
            studyDays: 0,
            completedTasks: 0,
            totalPoints: 0,
            avgCompletion: 0
        }
    },
    /**
     * 页面加载时执行
     */
    onLoad() {
        this.initCalendar();
    },
    /**
     * 页面显示时执行
     */
    onShow() {
        this.loadTotalPoints();
        this.generateCalendar();
        this.calculateMonthStats();
    },
    /**
     * 初始化日历
     */
    initCalendar() {
        const now = new Date();
        this.setData({
            currentYear: now.getFullYear(),
            currentMonth: now.getMonth() + 1,
            currentDate: now
        });
        this.generateCalendar();
    },
    /**
     * 加载用户总积分
     */
    loadTotalPoints() {
        try {
            const totalPoints = wx.getStorageSync('user_total_points') || 0;
            this.setData({ totalPoints });
        }
        catch (error) {
            console.error('加载总积分失败:', error);
        }
    },
    /**
     * 生成日历数据
     */
    generateCalendar() {
        const year = this.data.currentYear;
        const month = this.data.currentMonth;
        const today = new Date();
        // 获取当月第一天和最后一天
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);
        // 获取日历开始日期（包含上个月的日期）
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());
        // 获取日历结束日期（包含下个月的日期）
        const endDate = new Date(lastDay);
        endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));
        const calendarDays = [];
        const currentDate = new Date(startDate);
        // 生成日历数据
        while (currentDate <= endDate) {
            const dateString = (0, date_1.getDateString)(currentDate);
            const isCurrentMonth = currentDate.getMonth() === month - 1;
            const isToday = this.isSameDay(currentDate, today);
            // 检查是否有学习记录
            const recordInfo = this.checkStudyRecord(dateString);
            calendarDays.push({
                dateString,
                date: new Date(currentDate),
                day: currentDate.getDate(),
                isCurrentMonth,
                isToday,
                hasRecord: recordInfo.totalTasks > 0,
                recordInfo
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }
        this.setData({ calendarDays });
    },
    /**
     * 检查学习记录
     */
    checkStudyRecord(dateString) {
        try {
            const storageKey = `study_plans_${dateString}`;
            const studyPlans = wx.getStorageSync(storageKey) || [];
            let totalTasks = 0;
            let completedTasks = 0;
            let earnedPoints = 0;
            if (Array.isArray(studyPlans)) {
                studyPlans.forEach((plan) => {
                    if (plan.tasks && Array.isArray(plan.tasks)) {
                        plan.tasks.forEach((task) => {
                            totalTasks++;
                            if (task.masteredCompleted) {
                                completedTasks++;
                            }
                            if (task.earnedPoints) {
                                earnedPoints += task.earnedPoints;
                            }
                        });
                    }
                });
            }
            return {
                hasCompleted: completedTasks > 0 && completedTasks === totalTasks,
                hasPartial: completedTasks > 0 && completedTasks < totalTasks,
                earnedPoints,
                totalTasks,
                completedTasks
            };
        }
        catch (error) {
            console.error('检查学习记录失败:', error);
            return {
                hasCompleted: false,
                hasPartial: false,
                earnedPoints: 0,
                totalTasks: 0,
                completedTasks: 0
            };
        }
    },
    /**
     * 计算月度统计
     */
    calculateMonthStats() {
        const calendarDays = this.data.calendarDays;
        let studyDays = 0;
        let completedTasks = 0;
        let totalPoints = 0;
        let totalDaysWithTasks = 0;
        let totalCompletionRate = 0;
        calendarDays.forEach(day => {
            if (day.isCurrentMonth && day.hasRecord) {
                studyDays++;
                completedTasks += day.recordInfo.completedTasks;
                totalPoints += day.recordInfo.earnedPoints;
                if (day.recordInfo.totalTasks > 0) {
                    totalDaysWithTasks++;
                    const dayCompletion = (day.recordInfo.completedTasks / day.recordInfo.totalTasks) * 100;
                    totalCompletionRate += dayCompletion;
                }
            }
        });
        const avgCompletion = totalDaysWithTasks > 0 ? Math.round(totalCompletionRate / totalDaysWithTasks) : 0;
        this.setData({
            monthStats: {
                studyDays,
                completedTasks,
                totalPoints,
                avgCompletion
            }
        });
    },
    /**
     * 判断是否是同一天
     */
    isSameDay(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
            date1.getMonth() === date2.getMonth() &&
            date1.getDate() === date2.getDate();
    },
    /**
     * 上一个月
     */
    onPrevMonth() {
        let year = this.data.currentYear;
        let month = this.data.currentMonth - 1;
        if (month < 1) {
            year--;
            month = 12;
        }
        this.setData({
            currentYear: year,
            currentMonth: month
        });
        this.generateCalendar();
        this.calculateMonthStats();
    },
    /**
     * 下一个月
     */
    onNextMonth() {
        let year = this.data.currentYear;
        let month = this.data.currentMonth + 1;
        if (month > 12) {
            year++;
            month = 1;
        }
        this.setData({
            currentYear: year,
            currentMonth: month
        });
        this.generateCalendar();
        this.calculateMonthStats();
    },
    /**
     * 跳转到今天
     */
    onGoToToday() {
        const today = new Date();
        this.setData({
            currentYear: today.getFullYear(),
            currentMonth: today.getMonth() + 1,
            currentDate: today
        });
        this.generateCalendar();
        this.calculateMonthStats();
    },
    /**
     * 点击日期
     */
    onDateClick(event) {
        const dateString = event.currentTarget.dataset.date;
        if (!dateString)
            return;
        try {
            // 将选中的日期保存到本地存储
            wx.setStorageSync('selected_date', dateString);
            // 跳转到学习打卡页面（tabBar页面需要使用switchTab）
            wx.switchTab({
                url: '/pages/study-checkin/study-checkin',
                success: () => {
                    console.log('成功跳转到学习打卡页面，日期:', dateString);
                },
                fail: (error) => {
                    console.error('跳转失败:', error);
                    wx.showToast({
                        title: '跳转失败',
                        icon: 'error'
                    });
                }
            });
        }
        catch (error) {
            console.error('保存日期或跳转失败:', error);
            wx.showToast({
                title: '操作失败',
                icon: 'error'
            });
        }
    },
    /**
     * 跳转到今日学习
     */
    onGoToTodayStudy() {
        try {
            const today = (0, date_1.getDateString)(new Date());
            // 将今日日期保存到本地存储
            wx.setStorageSync('selected_date', today);
            // 跳转到学习打卡页面（tabBar页面需要使用switchTab）
            wx.switchTab({
                url: '/pages/study-checkin/study-checkin',
                success: () => {
                    console.log('成功跳转到今日学习，日期:', today);
                },
                fail: (error) => {
                    console.error('跳转失败:', error);
                    wx.showToast({
                        title: '跳转失败',
                        icon: 'error'
                    });
                }
            });
        }
        catch (error) {
            console.error('跳转到今日学习失败:', error);
            wx.showToast({
                title: '操作失败',
                icon: 'error'
            });
        }
    },
    /**
     * 跳转到学习模板
     */
    onGoToTemplate() {
        // 跳转到学习模板页面（tabBar页面需要使用switchTab）
        wx.switchTab({
            url: '/pages/study-template/study-template',
            success: () => {
                console.log('成功跳转到学习模板页面');
            },
            fail: (error) => {
                console.error('跳转失败:', error);
                wx.showToast({
                    title: '跳转失败',
                    icon: 'error'
                });
            }
        });
    },
    /**
     * 显示详细统计
     */
    onShowDetailStats() {
        const stats = this.data.monthStats;
        wx.showModal({
            title: `${this.data.currentMonth}月学习统计`,
            content: `学习天数: ${stats.studyDays}天\n完成任务: ${stats.completedTasks}个\n获得积分: ${stats.totalPoints}分\n平均完成率: ${stats.avgCompletion}%`,
            confirmText: '好的',
            showCancel: false
        });
    }
});
