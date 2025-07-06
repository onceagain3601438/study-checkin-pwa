// 学习模板管理页面逻辑
import { 
  StudyTemplate,
  getStudyTemplates,
  addStudyTemplate,
  saveStudyTemplates,
  deleteStudyTemplate
} from '../../utils/storage';

// 表单数据接口
interface FormData {
  name: string;
  content: string;
}

// 页面数据接口
interface PageData {
  // 模板数据
  templates: StudyTemplate[];
  
  // 弹窗状态
  showModal: boolean;
  isEditMode: boolean;
  editingTemplate: StudyTemplate | null;
  
  // 表单数据
  formData: FormData;
}

Page<PageData, Record<string, any>>({
  data: {
    templates: [],
    showModal: false,
    isEditMode: false,
    editingTemplate: null,
    formData: {
      name: '',
      content: ''
    }
  },

  /**
   * 页面加载时初始化
   */
  onLoad() {
    console.log('学习模板管理页面加载');
    this.loadTemplates();
  },

  /**
   * 页面显示时刷新数据
   */
  onShow() {
    console.log('学习模板管理页面显示');
    this.loadTemplates();
  },

  /**
   * 加载模板数据
   */
  loadTemplates() {
    const templates = getStudyTemplates();
    // 按创建时间倒序排列
    templates.sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime());
    
    // 格式化创建时间显示
    const formattedTemplates = templates.map(template => ({
      ...template,
      createTime: this.formatCreateTime(template.createTime)
    }));
    
    this.setData({
      templates: formattedTemplates
    });
  },

  /**
   * 格式化创建时间
   */
  formatCreateTime(createTime: string): string {
    const date = new Date(createTime);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    
    return `${month}/${day} ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  },

  /**
   * 添加模板按钮点击
   */
  onAddTemplate() {
    this.setData({
      showModal: true,
      isEditMode: false,
      editingTemplate: null,
      formData: {
        name: '',
        content: ''
      }
    });
  },

  /**
   * 编辑模板按钮点击
   */
  onEditTemplate(event: any) {
    const { template } = event.currentTarget.dataset;
    
    if (!template) return;
    
    this.setData({
      showModal: true,
      isEditMode: true,
      editingTemplate: template,
      formData: {
        name: template.name,
        content: template.content
      }
    });
  },

  /**
   * 删除模板按钮点击
   */
  onDeleteTemplate(event: any) {
    const { template } = event.currentTarget.dataset;
    
    if (!template) return;
    
    wx.showModal({
      title: '删除模板',
      content: `确定要删除模板"${template.name}"吗？此操作不可恢复。`,
      success: (res) => {
        if (res.confirm) {
          this.deleteTemplate(template);
        }
      }
    });
  },

  /**
   * 执行删除模板
   */
  deleteTemplate(template: StudyTemplate) {
    try {
      deleteStudyTemplate(template.id);
      
      wx.showToast({
        title: '删除成功',
        icon: 'success'
      });
      
      // 重新加载数据
      this.loadTemplates();
    } catch (error) {
      wx.showToast({
        title: '删除失败',
        icon: 'error'
      });
    }
  },

  /**
   * 关闭弹窗
   */
  onCloseModal() {
    this.setData({
      showModal: false,
      isEditMode: false,
      editingTemplate: null,
      formData: {
        name: '',
        content: ''
      }
    });
  },

  /**
   * 模板名称输入处理
   */
  onNameInput(event: any) {
    const { value } = event.detail;
    this.setData({
      'formData.name': value
    });
  },

  /**
   * 模板内容输入处理
   */
  onContentInput(event: any) {
    const { value } = event.detail;
    this.setData({
      'formData.content': value
    });
  },

  /**
   * 确认保存
   */
  onConfirmSave() {
    const { isEditMode, formData } = this.data;
    
    // 验证表单数据
    if (!formData.name.trim()) {
      wx.showToast({
        title: '请输入模板名称',
        icon: 'none'
      });
      return;
    }
    
    if (!formData.content.trim()) {
      wx.showToast({
        title: '请输入模板内容',
        icon: 'none'
      });
      return;
    }
    
    if (isEditMode) {
      this.updateTemplate();
    } else {
      this.createTemplate();
    }
  },

  /**
   * 创建新模板
   */
  createTemplate() {
    const { formData } = this.data;
    
    try {
      addStudyTemplate({
        name: formData.name.trim(),
        content: formData.content.trim()
      });
      
      wx.showToast({
        title: '添加成功',
        icon: 'success'
      });
      
      this.onCloseModal();
      this.loadTemplates();
    } catch (error) {
      wx.showToast({
        title: '添加失败',
        icon: 'error'
      });
    }
  },

  /**
   * 更新模板
   */
  updateTemplate() {
    const { editingTemplate, formData } = this.data;
    
    if (!editingTemplate) return;
    
    try {
      // 获取所有模板
      const templates = getStudyTemplates();
      
      // 找到要更新的模板
      const templateIndex = templates.findIndex(t => t.id === editingTemplate.id);
      
      if (templateIndex === -1) {
        wx.showToast({
          title: '模板不存在',
          icon: 'error'
        });
        return;
      }
      
      // 更新模板数据
      templates[templateIndex] = {
        ...templates[templateIndex],
        name: formData.name.trim(),
        content: formData.content.trim()
      };
      
      // 保存更新后的模板数据
      saveStudyTemplates(templates);
      
      wx.showToast({
        title: '更新成功',
        icon: 'success'
      });
      
      this.onCloseModal();
      this.loadTemplates();
    } catch (error) {
      wx.showToast({
        title: '更新失败',
        icon: 'error'
      });
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadTemplates();
    wx.stopPullDownRefresh();
  },

  /**
   * 页面分享
   */
  onShareAppMessage() {
    return {
      title: '学习打卡 - 模板管理',
      path: '/pages/study-template/study-template',
      imageUrl: ''
    };
  }
}); 