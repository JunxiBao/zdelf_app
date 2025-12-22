/**
 * 相机工具模块 - 提供统一的相机和相册访问功能
 * 支持Capacitor原生相机插件和HTML5文件输入的回退方案
 */

// 相机工具类
class CameraUtils {
    constructor() {
        this.Camera = null;
        this.Capacitor = null;
        this.isNative = false;
        this.init();
    }

    init() {
        try {
            this.Capacitor = window.Capacitor;
            if (this.Capacitor && this.Capacitor.Plugins && this.Capacitor.Plugins.Camera) {
                this.Camera = this.Capacitor.Plugins.Camera;
                this.isNative = this.Capacitor.isNativePlatform();
                console.log('✅ Capacitor Camera 插件已加载');
            } else {
                console.warn('⚠️ Capacitor Camera 插件未找到，将使用HTML5文件输入');
            }
        } catch (error) {
            console.warn('⚠️ 无法加载Capacitor Camera插件:', error);
        }
    }

    /**
     * 显示图片选择选项（拍照、从相册选择、取消）
     * @param {Function} onSuccess - 成功回调，参数为图片数据URL
     * @param {Function} onError - 错误回调，参数为错误信息
     */
    async showImageOptions(onSuccess, onError) {
        // 直接使用HTML5文件输入，让系统处理选择界面
        this.showHtml5ImageOptions(onSuccess, onError);
    }

    /**
     * 原生相机选项
     */
    async showNativeImageOptions(onSuccess, onError) {
        try {
            // 使用原生ActionSheet（如果可用）或自定义弹窗
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ActionSheet) {
                const result = await window.Capacitor.Plugins.ActionSheet.showActions({
                    title: '选择图片',
                    message: '请选择图片来源',
                    options: [
                        { text: '📷 拍照', value: 'camera' },
                        { text: '🖼️ 从相册选择', value: 'gallery' },
                        { text: '❌ 取消', value: 'cancel' }
                    ]
                });
                
                if (result.index === 2) return; // 取消
                
                const source = result.index === 0 ? 'camera' : 'gallery';
                await this.takePicture(source, onSuccess, onError);
            } else {
                // 使用自定义弹窗
                this.showCustomImageOptions(onSuccess, onError);
            }
        } catch (error) {
            console.error('显示原生图片选项失败:', error);
            // 回退到自定义弹窗
            this.showCustomImageOptions(onSuccess, onError);
        }
    }

    /**
     * 自定义图片选择弹窗
     */
    showCustomImageOptions(onSuccess, onError) {
        // 创建弹窗容器
        const modal = document.createElement('div');
        modal.id = 'imageOptionsModal';
        modal.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0, 0, 0, 0.6) !important;
            z-index: 99999 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        `;

        // 创建弹窗内容
        const content = document.createElement('div');
        content.style.cssText = `
            background: white !important;
            border-radius: 20px !important;
            padding: 30px !important;
            margin: 20px !important;
            max-width: 300px !important;
            width: calc(100% - 40px) !important;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25) !important;
            text-align: center !important;
        `;

        // 标题
        const title = document.createElement('h2');
        title.textContent = '选择图片来源';
        title.style.cssText = `
            margin: 0 0 10px 0 !important;
            font-size: 20px !important;
            font-weight: bold !important;
            color: #333 !important;
        `;

        const subtitle = document.createElement('p');
        subtitle.textContent = '请选择您想要的上传方式';
        subtitle.style.cssText = `
            margin: 0 0 25px 0 !important;
            font-size: 14px !important;
            color: #666 !important;
        `;

        // 拍照按钮
        const cameraBtn = document.createElement('button');
        cameraBtn.textContent = '📷 拍照';
        cameraBtn.style.cssText = `
            width: 100% !important;
            padding: 18px !important;
            margin-bottom: 10px !important;
            border: 2px solid #007AFF !important;
            border-radius: 15px !important;
            background: #007AFF !important;
            color: white !important;
            font-size: 18px !important;
            font-weight: bold !important;
            cursor: pointer !important;
            display: block !important;
        `;

        // 相册按钮
        const galleryBtn = document.createElement('button');
        galleryBtn.textContent = '🖼️ 从相册选择';
        galleryBtn.style.cssText = `
            width: 100% !important;
            padding: 18px !important;
            margin-bottom: 15px !important;
            border: 2px solid #34C759 !important;
            border-radius: 15px !important;
            background: #34C759 !important;
            color: white !important;
            font-size: 18px !important;
            font-weight: bold !important;
            cursor: pointer !important;
            display: block !important;
        `;

        // 取消按钮
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = `
            width: 100% !important;
            padding: 12px !important;
            border: none !important;
            border-radius: 10px !important;
            background: #f0f0f0 !important;
            color: #666 !important;
            font-size: 16px !important;
            cursor: pointer !important;
            font-weight: bold !important;
        `;

        // 组装弹窗
        content.appendChild(title);
        content.appendChild(subtitle);
        content.appendChild(cameraBtn);
        content.appendChild(galleryBtn);
        content.appendChild(cancelBtn);
        modal.appendChild(content);

        // 添加到页面
        document.body.appendChild(modal);

        // 关闭弹窗函数
        const closeModal = () => {
            if (modal && modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        };

        // 绑定事件 - 直接使用HTML5文件输入
        cameraBtn.addEventListener('click', () => {
            closeModal();
            this.showHtml5ImageOptions(onSuccess, onError);
        });

        galleryBtn.addEventListener('click', () => {
            closeModal();
            this.showHtml5ImageOptions(onSuccess, onError);
        });

        cancelBtn.addEventListener('click', closeModal);

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    /**
     * HTML5文件输入选项
     */
    showHtml5ImageOptions(onSuccess, onError) {
        // 创建文件输入元素
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = false;
        input.style.display = 'none';
        
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.processFile(file, onSuccess, onError);
            }
            // 清理
            document.body.removeChild(input);
        });

        // 添加到页面并触发点击
        document.body.appendChild(input);
        input.click();
    }

    /**
     * 使用原生相机拍照
     */
    async takePicture(source, onSuccess, onError) {
        try {
            const options = {
                quality: 90,
                allowEditing: false,
                resultType: 'DataUrl', // 返回base64数据URL
                source: source === 'camera' ? 'camera' : 'photos'
            };

            const result = await this.Camera.getPhoto(options);
            
            if (result.dataUrl) {
                if (onSuccess) onSuccess(result.dataUrl);
            } else {
                if (onError) onError('拍照失败：未获取到图片数据');
            }
        } catch (error) {
            console.error('拍照失败:', error);
            if (onError) onError('拍照失败: ' + error.message);
        }
    }

    /**
     * 处理文件（用于HTML5输入）
     */
    processFile(file, onSuccess, onError) {
        // 检查文件类型
        if (!file.type.startsWith('image/')) {
            if (onError) onError('请选择图片文件');
            return;
        }

        // 检查文件大小（10MB限制）
        const maxSizeMB = 10;
        if (file.size > maxSizeMB * 1024 * 1024) {
            if (onError) onError(`图片文件过大，请选择小于${maxSizeMB}MB的图片`);
            return;
        }

        // 读取文件为DataURL
        const reader = new FileReader();
        reader.onload = (e) => {
            if (onSuccess) onSuccess(e.target.result);
        };
        reader.onerror = () => {
            if (onError) onError('文件读取失败');
        };
        reader.readAsDataURL(file);
    }

    /**
     * 检查相机权限
     */
    async checkPermissions() {
        if (!this.isNative || !this.Camera) {
            return { camera: 'granted', photos: 'granted' };
        }

        try {
            const permissions = await this.Camera.checkPermissions();
            return permissions;
        } catch (error) {
            console.error('检查权限失败:', error);
            return { camera: 'denied', photos: 'denied' };
        }
    }

    /**
     * 请求相机权限
     */
    async requestPermissions() {
        if (!this.isNative || !this.Camera) {
            return { camera: 'granted', photos: 'granted' };
        }

        try {
            const permissions = await this.Camera.requestPermissions();
            return permissions;
        } catch (error) {
            console.error('请求权限失败:', error);
            return { camera: 'denied', photos: 'denied' };
        }
    }
}

// 创建全局实例
window.cameraUtils = new CameraUtils();

// 导出给其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CameraUtils;
}
