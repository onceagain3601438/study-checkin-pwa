/**
 * 本地存储管理工具类
 * 用于管理学习打卡相关的数据存储
 */

// 学习记录数据结构
export interface StudyRecord {
  date: string; // 日期 YYYY-MM-DD 格式
  content: string; // 学习内容
  isCompleted: boolean; // 是否完成
  completedTime?: string; // 完成时间
  notes?: string; // 备注
}

// 学习模板数据结构
export interface StudyTemplate {
  id: string; // 模板ID
  name: string; // 模板名称
  content: string; // 模板内容
  createTime: string; // 创建时间
  tasks?: Array<{  // 任务列表（可选，用于新的模板格式）
    name: string;
    timeSlot?: string;
    points?: number;
  }>;
}

const STORAGE_KEYS = {
  STUDY_RECORDS: 'study_records',
  STUDY_TEMPLATES: 'study_templates'
};

/**
 * 获取所有学习记录
 * @returns 学习记录数组
 */
export function getStudyRecords(): StudyRecord[] {
  try {
    const records = wx.getStorageSync(STORAGE_KEYS.STUDY_RECORDS);
    return records ? JSON.parse(records) : [];
  } catch (error) {
    console.error('获取学习记录失败:', error);
    return [];
  }
}

/**
 * 保存学习记录
 * @param records 学习记录数组
 */
export function saveStudyRecords(records: StudyRecord[]): void {
  try {
    wx.setStorageSync(STORAGE_KEYS.STUDY_RECORDS, JSON.stringify(records));
  } catch (error) {
    console.error('保存学习记录失败:', error);
  }
}

/**
 * 获取指定日期的学习记录
 * @param date 日期字符串 YYYY-MM-DD
 * @returns 学习记录或null
 */
export function getStudyRecordByDate(date: string): StudyRecord | null {
  const records = getStudyRecords();
  return records.find(record => record.date === date) || null;
}

/**
 * 更新或创建学习记录
 * @param record 学习记录
 */
export function updateStudyRecord(record: StudyRecord): void {
  const records = getStudyRecords();
  const index = records.findIndex(r => r.date === record.date);
  
  if (index >= 0) {
    records[index] = record;
  } else {
    records.push(record);
  }
  
  saveStudyRecords(records);
}

/**
 * 获取所有学习模板
 * @returns 学习模板数组
 */
export function getStudyTemplates(): StudyTemplate[] {
  try {
    const templates = wx.getStorageSync(STORAGE_KEYS.STUDY_TEMPLATES);
    
    if (!templates) {
      return [];
    }
    
    // 兼容性处理：如果存储的是字符串，则解析JSON；如果是对象，则直接返回
    if (typeof templates === 'string') {
      return JSON.parse(templates);
    } else if (Array.isArray(templates)) {
      // 如果直接存储的是数组对象，则先转换为标准格式再重新保存
      saveStudyTemplates(templates);
      return templates;
    } else {
      console.warn('学习模板数据格式异常，重置为空数组');
      return [];
    }
  } catch (error) {
    console.error('获取学习模板失败:', error);
    // 如果解析失败，清空并返回空数组
    try {
      wx.removeStorageSync(STORAGE_KEYS.STUDY_TEMPLATES);
    } catch (cleanupError) {
      console.error('清理损坏的模板数据失败:', cleanupError);
    }
    return [];
  }
}

/**
 * 保存学习模板
 * @param templates 学习模板数组
 */
export function saveStudyTemplates(templates: StudyTemplate[]): void {
  try {
    wx.setStorageSync(STORAGE_KEYS.STUDY_TEMPLATES, JSON.stringify(templates));
  } catch (error) {
    console.error('保存学习模板失败:', error);
  }
}

/**
 * 添加新的学习模板
 * @param template 学习模板
 */
export function addStudyTemplate(template: Omit<StudyTemplate, 'id' | 'createTime'>): void {
  const templates = getStudyTemplates();
  const newTemplate: StudyTemplate = {
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
export function deleteStudyTemplate(templateId: string): void {
  const templates = getStudyTemplates();
  const filteredTemplates = templates.filter(t => t.id !== templateId);
  saveStudyTemplates(filteredTemplates);
} 