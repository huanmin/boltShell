import { App } from 'antd';
import type { ModalFuncProps } from 'antd';

/**
 * 使用 App.useApp() 获取 modal 实例的 hook
 * 这样 Modal.confirm 可以继承 ConfigProvider 的主题配置
 */
export const useConfirmModal = () => {
  const { modal } = App.useApp();

  /**
   * 统一的确认对话框样式
   */
  const confirmModal = (props: Omit<ModalFuncProps, 'centered'>) => {
    return modal.confirm({
      centered: true,
      okText: '确定',
      cancelText: '取消',
      ...props,
    });
  };

  /**
   * 删除确认对话框 - 带危险样式
   */
  const confirmDelete = (props: Omit<ModalFuncProps, 'okButtonProps' | 'okText' | 'cancelText' | 'centered'>) => {
    return modal.confirm({
      centered: true,
      title: '确认删除',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      ...props,
    });
  };

  /**
   * 输入对话框
   */
  const promptModal = (props: {
    title: string;
    placeholder?: string;
    defaultValue?: string;
    onOk: (value: string) => void | Promise<void>;
    onCancel?: () => void;
  }) => {
    let inputValue = props.defaultValue || '';
    let instance: ReturnType<typeof modal.confirm>;

    instance = modal.confirm({
      centered: true,
      title: props.title,
      content: (
        <input
          type="text"
          placeholder={props.placeholder || '请输入...'}
          defaultValue={props.defaultValue}
          onChange={(e) => { inputValue = e.target.value; }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              instance?.destroy();
              props.onOk(inputValue);
            }
          }}
          autoFocus
          className="prompt-input"
          style={{
            width: '100%',
            padding: '8px 12px',
            marginTop: '12px',
            background: '#0d1117',
            border: '1px solid #30363d',
            borderRadius: '6px',
            color: '#c9d1d9',
            fontSize: '14px',
            outline: 'none',
          }}
        />
      ),
      okText: '确定',
      cancelText: '取消',
      onOk: () => props.onOk(inputValue),
      onCancel: props.onCancel,
    });

    return instance;
  };

  return {
    confirmModal,
    confirmDelete,
    promptModal,
  };
};