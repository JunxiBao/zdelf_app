/**
 * 统一弹窗管理器
 * 提供统一的弹窗接口，支持多种弹窗类型
 */

(function() {
    'use strict';

    // 确保样式只注入一次
    let stylesInjected = false;

    /**
     * 注入弹窗样式
     */
    function ensureStyles() {
        if (stylesInjected) return;
        stylesInjected = true;

        const style = document.createElement('style');
        style.id = 'modal-manager-styles';
        style.textContent = `
            /* 弹窗遮罩层 */
            .modal-manager-mask {
                position: fixed;
                inset: 0;
                background: color-mix(in srgb, var(--text, #000) 20%, transparent);
                backdrop-filter: saturate(120%) blur(2px);
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.18s ease;
                z-index: 10000;
                pointer-events: none;
            }
            .modal-manager-mask.show {
                opacity: 1;
                pointer-events: auto;
            }

            /* 弹窗容器 */
            .modal-manager-dialog {
                width: min(92vw, 360px);
                background: var(--card, #fff);
                color: var(--text, #111);
                border-radius: 16px;
                box-shadow: var(--shadow-2, 0 10px 30px rgba(0,0,0,.15));
                transform: translateY(12px) scale(.98);
                opacity: 0;
                transition: transform 0.2s ease, opacity 0.2s ease;
                border: 1px solid var(--divider, rgba(0,0,0,.06));
                max-height: 90vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }
            .modal-manager-dialog.show {
                transform: translateY(0) scale(1);
                opacity: 1;
            }

            /* 全屏弹窗 */
            .modal-manager-dialog.fullscreen {
                width: 100%;
                max-width: 100%;
                height: 100vh;
                max-height: 100vh;
                border-radius: 0;
                transform: translateY(100%);
            }
            .modal-manager-dialog.fullscreen.show {
                transform: translateY(0);
            }

            /* 弹窗头部 */
            .modal-manager-header {
                padding: 18px 18px 12px;
                border-bottom: 1px solid var(--divider, rgba(0,0,0,.06));
                flex-shrink: 0;
            }
            .modal-manager-title {
                font-size: 18px;
                font-weight: 600;
                color: var(--text, #111);
                margin: 0;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .modal-manager-close {
                position: absolute;
                top: 12px;
                right: 12px;
                width: 32px;
                height: 32px;
                border: none;
                background: transparent;
                border-radius: 8px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--text-secondary, #666);
                transition: all 0.2s ease;
                font-size: 20px;
                line-height: 1;
            }
            .modal-manager-close:hover {
                background: var(--surface, rgba(0,0,0,.04));
                color: var(--text, #111);
            }

            /* 弹窗内容 */
            .modal-manager-body {
                padding: 18px 18px 8px;
                font-size: 15px;
                line-height: 1.5;
                color: var(--text, #111);
                flex: 1;
                overflow-y: auto;
            }
            .modal-manager-body.has-footer {
                padding-bottom: 12px;
            }

            /* 弹窗底部 */
            .modal-manager-footer {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
                padding: 0 12px 12px;
                flex-shrink: 0;
            }
            .modal-manager-footer.center {
                justify-content: center;
            }
            .modal-manager-footer.space-between {
                justify-content: space-between;
            }

            /* 按钮样式 */
            .modal-manager-btn {
                appearance: none;
                border: 0;
                padding: 9px 14px;
                border-radius: 12px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s ease;
                min-width: 80px;
            }
            .modal-manager-btn--ghost {
                background: var(--surface, rgba(0,0,0,.04));
                color: var(--text, #111);
            }
            .modal-manager-btn--ghost:hover {
                background: rgba(0,0,0,.08);
            }
            .modal-manager-btn--primary {
                background: var(--brand, #b08fc7);
                color: #fff;
            }
            .modal-manager-btn--primary:hover {
                background: var(--brand-700, #9d7ab8);
                transform: translateY(-1px);
            }
            .modal-manager-btn--danger {
                background: #f44336;
                color: #fff;
            }
            .modal-manager-btn--danger:hover {
                background: #d32f2f;
                transform: translateY(-1px);
            }
            .modal-manager-btn:focus {
                outline: 2px solid var(--brand, #b08fc7);
                outline-offset: 2px;
            }
            .modal-manager-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            /* 删除确认弹窗特殊样式 */
            .modal-manager-delete-icon {
                font-size: 2.5em;
                margin-bottom: 12px;
                text-align: center;
            }
            .modal-manager-warning-text {
                font-size: 1em;
                font-weight: 600;
                color: var(--text, #333);
                margin: 0 0 8px 0;
                text-align: center;
            }
            .modal-manager-warning-detail {
                font-size: 0.85em;
                color: var(--text-secondary, #666);
                margin: 0;
                line-height: 1.4;
                text-align: center;
            }

            /* 深色模式适配 */
            @media (prefers-color-scheme: dark) {
                .modal-manager-mask {
                    background: color-mix(in srgb, #000 50%, transparent);
                }
                .modal-manager-dialog {
                    background: var(--card, #1e1f22);
                    color: var(--text, #e6e6e6);
                    border-color: var(--border, rgba(255,255,255,.08));
                }
                .modal-manager-title {
                    color: var(--text, #e6e6e6);
                }
                .modal-manager-body {
                    color: var(--text, #e6e6e6);
                }
                .modal-manager-close {
                    color: var(--text-secondary, #9aa3af);
                }
                .modal-manager-close:hover {
                    background: var(--surface, rgba(255,255,255,.08));
                    color: var(--text, #e6e6e6);
                }
                .modal-manager-btn--ghost {
                    background: var(--surface, rgba(255,255,255,.08));
                    color: var(--text, #e6e6e6);
                }
                .modal-manager-btn--ghost:hover {
                    background: rgba(255,255,255,.12);
                }
                .modal-manager-warning-text {
                    color: var(--text, #e6e6e6);
                }
                .modal-manager-warning-detail {
                    color: var(--text-secondary, #aaa);
                }
            }

            /* 安全区域适配 */
            @supports(padding:max(0px)) {
                .modal-manager-dialog {
                    margin-bottom: env(safe-area-inset-bottom);
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 震动反馈
     */
    function hapticImpact(type = 'Light') {
        try {
            if (window.__hapticImpact__) {
                window.__hapticImpact__(type);
            }
        } catch(e) {
            // 忽略错误
        }
    }

    /**
     * 创建基础弹窗结构
     */
    function createModal(options = {}) {
        ensureStyles();

        const {
            title = '',
            content = '',
            showClose = true,
            fullscreen = false,
            customClass = ''
        } = options;

        const mask = document.createElement('div');
        mask.className = 'modal-manager-mask';
        mask.setAttribute('role', 'dialog');
        mask.setAttribute('aria-modal', 'true');

        const dialog = document.createElement('div');
        dialog.className = `modal-manager-dialog ${fullscreen ? 'fullscreen' : ''} ${customClass}`.trim();

        // 头部
        if (title || showClose) {
            const header = document.createElement('div');
            header.className = 'modal-manager-header';
            
            if (title) {
                const titleEl = document.createElement('h3');
                titleEl.className = 'modal-manager-title';
                titleEl.textContent = title;
                header.appendChild(titleEl);
            }

            if (showClose) {
                const closeBtn = document.createElement('button');
                closeBtn.className = 'modal-manager-close';
                closeBtn.innerHTML = '×';
                closeBtn.setAttribute('aria-label', '关闭');
                header.appendChild(closeBtn);
            }

            dialog.appendChild(header);
        }

        // 内容
        const body = document.createElement('div');
        body.className = 'modal-manager-body';
        if (typeof content === 'string') {
            body.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            body.appendChild(content);
        }
        dialog.appendChild(body);

        mask.appendChild(dialog);
        document.body.appendChild(mask);

        return { mask, dialog, body };
    }

    /**
     * 显示弹窗
     */
    function showModal(mask, dialog) {
        requestAnimationFrame(() => {
            mask.classList.add('show');
            dialog.classList.add('show');
        });
    }

    /**
     * 隐藏弹窗
     */
    function hideModal(mask, dialog, callback) {
        dialog.classList.remove('show');
        mask.classList.remove('show');
        const onEnd = () => {
            mask.removeEventListener('transitionend', onEnd);
            if (mask.parentNode) {
                mask.remove();
            }
            if (callback) callback();
        };
        mask.addEventListener('transitionend', onEnd);
    }

    /**
     * 确认对话框
     * @param {string} message - 提示信息
     * @param {Object} options - 配置选项
     * @returns {Promise<boolean>}
     */
    function confirm(message, options = {}) {
        return new Promise((resolve) => {
            const {
                title = '确认',
                confirmText = '确定',
                cancelText = '取消',
                confirmType = 'primary',
                onConfirm,
                onCancel
            } = options;

            const { mask, dialog, body } = createModal({
                title,
                content: message,
                showClose: false
            });

            body.classList.add('has-footer');

            const footer = document.createElement('div');
            footer.className = 'modal-manager-footer';

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'modal-manager-btn modal-manager-btn--ghost';
            cancelBtn.textContent = cancelText;

            const confirmBtn = document.createElement('button');
            confirmBtn.className = `modal-manager-btn modal-manager-btn--${confirmType}`;
            confirmBtn.textContent = confirmText;

            footer.append(cancelBtn, confirmBtn);
            dialog.appendChild(footer);

            showModal(mask, dialog);

            const close = (result) => {
                hideModal(mask, dialog, () => {
                    resolve(result);
                });
            };

            cancelBtn.addEventListener('click', () => {
                hapticImpact('Light');
                if (onCancel) onCancel();
                close(false);
            }, { once: true });

            confirmBtn.addEventListener('click', () => {
                hapticImpact('Medium');
                if (onConfirm) onConfirm();
                close(true);
            }, { once: true });

            mask.addEventListener('click', (e) => {
                if (e.target === mask) {
                    hapticImpact('Light');
                    if (onCancel) onCancel();
                    close(false);
                }
            }, { once: true });

            // ESC键关闭
            const handleEsc = (e) => {
                if (e.key === 'Escape') {
                    hapticImpact('Light');
                    if (onCancel) onCancel();
                    close(false);
                    document.removeEventListener('keydown', handleEsc);
                }
            };
            document.addEventListener('keydown', handleEsc);
        });
    }

    /**
     * 删除确认弹窗
     * @param {string} message - 提示信息
     * @param {Object} options - 配置选项
     * @returns {Promise<boolean>}
     */
    function confirmDelete(message, options = {}) {
        return new Promise((resolve) => {
            const {
                title = '确认删除',
                detail = '此操作无法撤销',
                confirmText = '确定删除',
                cancelText = '取消',
                onConfirm,
                onCancel
            } = options;

            const { mask, dialog, body } = createModal({
                title,
                showClose: false,
                customClass: 'delete-confirm'
            });

            body.classList.add('has-footer');

            // 自定义删除确认内容
            body.innerHTML = `
                <div class="modal-manager-delete-icon">🗑️</div>
                <div class="modal-manager-warning-text">${message || '确定要删除吗？'}</div>
                ${detail ? `<div class="modal-manager-warning-detail">${detail}</div>` : ''}
            `;

            const footer = document.createElement('div');
            footer.className = 'modal-manager-footer';

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'modal-manager-btn modal-manager-btn--ghost';
            cancelBtn.textContent = cancelText;

            const confirmBtn = document.createElement('button');
            confirmBtn.className = 'modal-manager-btn modal-manager-btn--danger';
            confirmBtn.textContent = confirmText;

            footer.append(cancelBtn, confirmBtn);
            dialog.appendChild(footer);

            showModal(mask, dialog);

            const close = (result) => {
                hideModal(mask, dialog, () => {
                    resolve(result);
                });
            };

            cancelBtn.addEventListener('click', () => {
                hapticImpact('Light');
                if (onCancel) onCancel();
                close(false);
            }, { once: true });

            confirmBtn.addEventListener('click', () => {
                hapticImpact('Heavy');
                if (onConfirm) onConfirm();
                close(true);
            }, { once: true });

            mask.addEventListener('click', (e) => {
                if (e.target === mask) {
                    hapticImpact('Light');
                    if (onCancel) onCancel();
                    close(false);
                }
            }, { once: true });

            // ESC键关闭
            const handleEsc = (e) => {
                if (e.key === 'Escape') {
                    hapticImpact('Light');
                    if (onCancel) onCancel();
                    close(false);
                    document.removeEventListener('keydown', handleEsc);
                }
            };
            document.addEventListener('keydown', handleEsc);
        });
    }

    /**
     * 提示弹窗（只有确定按钮）
     * @param {string} message - 提示信息
     * @param {Object} options - 配置选项
     * @returns {Promise<void>}
     */
    function alert(message, options = {}) {
        return new Promise((resolve) => {
            const {
                title = '提示',
                confirmText = '我知道了',
                confirmType = 'primary',
                onConfirm
            } = options;

            const { mask, dialog, body } = createModal({
                title,
                content: message,
                showClose: false
            });

            body.classList.add('has-footer');

            const footer = document.createElement('div');
            footer.className = 'modal-manager-footer center';

            const confirmBtn = document.createElement('button');
            confirmBtn.className = `modal-manager-btn modal-manager-btn--${confirmType}`;
            confirmBtn.textContent = confirmText;

            footer.appendChild(confirmBtn);
            dialog.appendChild(footer);

            showModal(mask, dialog);

            const close = () => {
                hideModal(mask, dialog, () => {
                    resolve();
                });
            };

            confirmBtn.addEventListener('click', () => {
                hapticImpact('Medium');
                if (onConfirm) onConfirm();
                close();
            }, { once: true });

            mask.addEventListener('click', (e) => {
                if (e.target === mask) {
                    hapticImpact('Light');
                    close();
                }
            }, { once: true });

            // ESC键关闭
            const handleEsc = (e) => {
                if (e.key === 'Escape') {
                    hapticImpact('Light');
                    close();
                    document.removeEventListener('keydown', handleEsc);
                }
            };
            document.addEventListener('keydown', handleEsc);
        });
    }

    /**
     * 自定义弹窗
     * @param {Object} options - 配置选项
     * @returns {Object} 返回弹窗控制对象
     */
    function custom(options = {}) {
        const {
            title = '',
            content = '',
            showClose = true,
            fullscreen = false,
            customClass = '',
            buttons = [],
            onClose
        } = options;

        const { mask, dialog, body } = createModal({
            title,
            content,
            showClose,
            fullscreen,
            customClass
        });

        // 关闭按钮
        if (showClose) {
            const closeBtn = dialog.querySelector('.modal-manager-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    hapticImpact('Light');
                    if (onClose) onClose();
                    hideModal(mask, dialog);
                });
            }
        }

        // 自定义按钮
        if (buttons.length > 0) {
            body.classList.add('has-footer');
            const footer = document.createElement('div');
            footer.className = 'modal-manager-footer';

            buttons.forEach(btn => {
                const button = document.createElement('button');
                button.className = `modal-manager-btn modal-manager-btn--${btn.type || 'ghost'}`;
                button.textContent = btn.text;
                if (btn.disabled) {
                    button.disabled = true;
                }
                button.addEventListener('click', () => {
                    hapticImpact('Medium');
                    if (btn.onClick) {
                        const result = btn.onClick();
                        if (result !== false) {
                            hideModal(mask, dialog);
                        }
                    } else {
                        hideModal(mask, dialog);
                    }
                });
                footer.appendChild(button);
            });

            dialog.appendChild(footer);
        }

        // 点击遮罩关闭
        mask.addEventListener('click', (e) => {
            if (e.target === mask) {
                hapticImpact('Light');
                if (onClose) onClose();
                hideModal(mask, dialog);
            }
        });

        // ESC键关闭
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                hapticImpact('Light');
                if (onClose) onClose();
                hideModal(mask, dialog);
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);

        showModal(mask, dialog);

        return {
            close: () => {
                hideModal(mask, dialog);
            },
            updateContent: (newContent) => {
                if (typeof newContent === 'string') {
                    body.innerHTML = newContent;
                } else if (newContent instanceof HTMLElement) {
                    body.innerHTML = '';
                    body.appendChild(newContent);
                }
            },
            getBody: () => body,
            getDialog: () => dialog
        };
    }

    // 导出到全局
    window.ModalManager = {
        confirm,
        confirmDelete,
        alert,
        custom
    };

    // 兼容旧接口
    window.confirmDialog = confirm;
})();



