"use strict";
/**
 * 本地存储管理工具类
 * 用于管理学习打卡相关的数据存储
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStudyRecords = getStudyRecords;
exports.saveStudyRecords = saveStudyRecords;
exports.getStudyRecordByDate = getStudyRecordByDate;
exports.updateStudyRecord = updateStudyRecord;
exports.getStudyTemplates = getStudyTemplates;
exports.saveStudyTemplates = saveStudyTemplates;
exports.addStudyTemplate = addStudyTemplate;
exports.deleteStudyTemplate = deleteStudyTemplate;
const STORAGE_KEYS = {
    STUDY_RECORDS: 'study_records',
    STUDY_TEMPLATES: 'study_templates'
};
/**
 * 获取所有学习记录
 * @returns 学习记录数组
 */
function getStudyRecords() {
    try {
        const records = wx.getStorageSync(STORAGE_KEYS.STUDY_RECORDS);
        return records ? JSON.parse(records) : [];
    }
    catch (error) {
        console.error('获取学习记录失败:', error);
        return [];
    }
}
/**
 * 保存学习记录
 * @param records 学习记录数组
 */
function saveStudyRecords(records) {
    try {
        wx.setStorageSync(STORAGE_KEYS.STUDY_RECORDS, JSON.stringify(records));
    }
    catch (error) {
        console.error('保存学习记录失败:', error);
    }
}
/**
 * 获取指定日期的学习记录
 * @param date 日期字符串 YYYY-MM-DD
 * @returns 学习记录或null
 */
function getStudyRecordByDate(date) {
    const records = getStudyRecords();
    return records.find(record => record.date === date) || null;
}
/**
 * 更新或创建学习记录
 * @param record 学习记录
 */
function updateStudyRecord(record) {
    const records = getStudyRecords();
    const index = records.findIndex(r => r.date === record.date);
    if (index >= 0) {
        records[index] = record;
    }
    else {
        records.push(record);
    }
    saveStudyRecords(records);
}
/**
 * 获取所有学习模板
 * @returns 学习模板数组
 */
function getStudyTemplates() {
    try {
        const templates = wx.getStorageSync(STORAGE_KEYS.STUDY_TEMPLATES);
        if (!templates) {
            return [];
        }
        // 兼容性处理：如果存储的是字符串，则解析JSON；如果是对象，则直接返回
        if (typeof templates === 'string') {
            return JSON.parse(templates);
        }
        else if (Array.isArray(templates)) {
            // 如果直接存储的是数组对象，则先转换为标准格式再重新保存
            saveStudyTemplates(templates);
            return templates;
        }
        else {
            console.warn('学习模板数据格式异常，重置为空数组');
            return [];
        }
    }
    catch (error) {
        console.error('获取学习模板失败:', error);
        // 如果解析失败，清空并返回空数组
        try {
            wx.removeStorageSync(STORAGE_KEYS.STUDY_TEMPLATES);
        }
        catch (cleanupError) {
            console.error('清理损坏的模板数据失败:', cleanupError);
        }
        return [];
    }
}
/**
 * 保存学习模板
 * @param templates 学习模板数组
 */
function saveStudyTemplates(templates) {
    try {
        wx.setStorageSync(STORAGE_KEYS.STUDY_TEMPLATES, JSON.stringify(templates));
    }
    catch (error) {
        console.error('保存学习模板失败:', error);
    }
}
/**
 * 添加新的学习模板
 * @param template 学习模板
 */
function addStudyTemplate(template) {
    const templates = getStudyTemplates();
    const newTemplate = {
        ...template,
        id: Date.now().toString(),
        createTime: new Date().toISOString()
    };
    templates.push(newTemplate);
    saveStudyTemplates(templates);
}
/**
 * 删除学习模板
 * @param templateId 模板ID
 */
function deleteStudyTemplate(templateId) {
    const templates = getStudyTemplates();
    const filteredTemplates = templates.filter(t => t.id !== templateId);
    saveStudyTemplates(filteredTemplates);
}
