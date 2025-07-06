"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// 学习内容设置页面逻辑
const date_1 = require("../../utils/date");
const storage_1 = require("../../utils/storage");
Page({
    data: {
        selectedDate: '',
        dateText: '',
        isEditMode: false,
        studyContent: '',
        notes: '',
        yesterdayContent: '',
        hasTemplates: false,
        templates: [],
        showTemplateModal: false,
        showCreateModal: false,
        templateName: ''
    },
    /**
     * 页面加载时初始化
     */
    onLoad(options) {
        console.log('学习内容设置页面加载', options);
        const { date = '', edit = false } = options;
        if (!date) {
            wx.showToast({
                title: '参数错误',
                icon: 'error'
            });
            wx.navigateBack();
            return;
        }
        this.initializePage(date, edit);
    },
    /**
     * 初始化页面
     */
    initializePage(date, edit) {
        const dateText = this.formatDateText(date);
        const isEditMode = edit === 'true' || edit === true;
        this.setData({
            selectedDate: date,
            dateText,
            isEditMode
        });
        // 加载现有数据
        this.loadExistingData();
        // 加载快捷操作数据
        this.loadQuickActionData();
    },
    /**
     * 加载现有数据
     */
    loadExistingData() {
        const { selectedDate } = this.data;
        const existingRecord = (0, storage_1.getStudyRecordByDate)(selectedDate);
        if (existingRecord) {
            this.setData({
                studyContent: existingRecord.content || '',
                notes: existingRecord.notes || ''
            });
        }
    },
    /**
     * 加载快捷操作相关数据
     */
    loadQuickActionData() {
        // 获取昨天的内容
        const yesterdayDate = (0, date_1.getYesterdayString)();
        const yesterdayRecord = (0, storage_1.getStudyRecordByDate)(yesterdayDate);
        const yesterdayContent = yesterdayRecord?.content || '';
        // 获取模板数据
        const templates = (0, storage_1.getStudyTemplates)();
        const hasTemplates = templates.length > 0;
        this.setData({
            yesterdayContent,
            hasTemplates,
            templates
        });
    },
    /**
     * 格式化日期文本显示
     */
    formatDateText(dateStr) {
        const date = new Date(dateStr);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
        const weekDay = weekDays[date.getDay()];
        return `${month}月${day}日 星期${weekDay}`;
    },
    /**
     * 学习内容输入处理
     */
    onContentInput(event) {
        const { value } = event.detail;
        this.setData({
            studyContent: value
        });
    },
    /**
     * 备注输入处理
     */
    onNotesInput(event) {
        const { value } = event.detail;
        this.setData({
            notes: value
        });
    },
    /**
     * 复用昨天内容
     */
    onCopyYesterday() {
        const { yesterdayContent } = this.data;
        if (!yesterdayContent) {
            wx.showToast({
                title: '昨天没有学习内容',
                icon: 'none'
            });
            return;
        }
        wx.showModal({
            title: '复用昨天内容',
            content: '确定要复用昨天的学习内容吗？当前内容将被替换。',
            success: (res) => {
                if (res.confirm) {
                    this.setData({
                        studyContent: yesterdayContent
                    });
                    wx.showToast({
                        title: '已复用昨天内容',
                        icon: 'success'
                    });
                }
            }
        });
    },
    /**
     * 选择模板
     */
    onSelectTemplate() {
        const { templates } = this.data;
        if (templates.length === 0) {
            wx.showToast({
                title: '暂无可用模板',
                icon: 'none'
            });
            return;
        }
        this.setData({
            showTemplateModal: true
        });
    },
    /**
     * 关闭模板选择弹窗
     */
    onCloseTemplateModal() {
        this.setData({
            showTemplateModal: false
        });
    },
    /**
     * 选择模板项
     */
    onSelectTemplateItem(event) {
        const { template } = event.currentTarget.dataset;
        if (!template)
            return;
        wx.showModal({
            title: '使用模板',
            content: `确定要使用模板"${template.name}"吗？当前内容将被替换。`,
            success: (res) => {
                if (res.confirm) {
                    this.setData({
                        studyContent: template.content,
                        showTemplateModal: false
                    });
                    wx.showToast({
                        title: '已应用模板',
                        icon: 'success'
                    });
                }
            }
        });
    },
    /**
     * 管理模板
     */
    onManageTemplates() {
        this.setData({
            showTemplateModal: false
        });
        wx.navigateTo({
            url: '/pages/study-template/study-template'
        });
    },
    /**
     * 创建模板
     */
    onCreateTemplate() {
        const { studyContent } = this.data;
        if (!studyContent.trim()) {
            wx.showToast({
                title: '请先输入学习内容',
                icon: 'none'
            });
            return;
        }
        this.setData({
            showCreateModal: true,
            templateName: ''
        });
    },
    /**
     * 关闭创建模板弹窗
     */
    onCloseCreateModal() {
        this.setData({
            showCreateModal: false,
            templateName: ''
        });
    },
    /**
     * 模板名称输入
     */
    onTemplateNameInput(event) {
        const { value } = event.detail;
        this.setData({
            templateName: value
        });
    },
    /**
     * 确认创建模板
     */
    onConfirmCreateTemplate() {
        const { templateName, studyContent } = this.data;
        if (!templateName.trim()) {
            wx.showToast({
                title: '请输入模板名称',
                icon: 'none'
            });
            return;
        }
        if (!studyContent.trim()) {
            wx.showToast({
                title: '学习内容不能为空',
                icon: 'none'
            });
            return;
        }
        // 保存模板
        try {
            (0, storage_1.addStudyTemplate)({
                name: templateName.trim(),
                content: studyContent.trim()
            });
            wx.showToast({
                title: '模板创建成功',
                icon: 'success'
            });
            this.setData({
                showCreateModal: false,
                templateName: ''
            });
            // 重新加载模板数据
            this.loadQuickActionData();
        }
        catch (error) {
            wx.showToast({
                title: '创建失败',
                icon: 'error'
            });
        }
    },
    /**
     * 保存学习内容
     */
    onSaveContent() {
        const { selectedDate, studyContent, notes } = this.data;
        if (!studyContent.trim()) {
            wx.showToast({
                title: '请输入学习内容',
                icon: 'none'
            });
            return;
        }
        // 获取现有记录
        const existingRecord = (0, storage_1.getStudyRecordByDate)(selectedDate);
        // 创建新记录
        const newRecord = {
            date: selectedDate,
            content: studyContent.trim(),
            notes: notes.trim() || undefined,
            isCompleted: existingRecord?.isCompleted || false,
            completedTime: existingRecord?.completedTime
        };
        // 保存记录
        try {
            (0, storage_1.updateStudyRecord)(newRecord);
            wx.showToast({
                title: '保存成功',
                icon: 'success'
            });
            // 延迟返回上一页
            setTimeout(() => {
                wx.navigateBack();
            }, 1500);
        }
        catch (error) {
            wx.showToast({
                title: '保存失败',
                icon: 'error'
            });
        }
    },
    /**
     * 页面分享
     */
    onShareAppMessage() {
        return {
            title: '学习打卡 - 设置学习内容',
            path: '/pages/study-content/study-content',
            imageUrl: ''
        };
    }
});
