import { Modal } from 'antd';
import type { ModalFuncProps } from 'antd';

/**
 * 统一的确认对话框样式
 * 使用 Ant Design Modal.confirm 的自定义封装
 */
export const confirmModal = (props: Omit<ModalFuncProps, 'centered'>) => {
  return Modal.confirm({
    centered: true,
    okText: '确定',
    cancelText: '取消',
    ...props,
    // 统一使用暗色主题样式
    className: `confirm-modal-dark ${props.className || ''}`,
  });
};

/**
 * 删除确认对话框 - 带危险样式
 */
export const confirmDelete = (props: Omit<ModalFuncProps, 'okButtonProps' | 'okText' | 'cancelText' | 'centered'>) => {
  return Modal.confirm({
    centered: true,
    title: '确认删除',
    okText: '删除',
    cancelText: '取消',
    okButtonProps: { danger: true },
    ...props,
    className: `confirm-modal-dark ${props.className || ''}`,
  });
};

/**
 * 输入对话框
 */
export const promptModal = (props: {
  title: string;
  placeholder?: string;
  defaultValue?: string;
  onOk: (value: string) => void | Promise<void>;
  onCancel?: () => void;
}) => {
  let inputValue = props.defaultValue || '';
  
  return Modal.confirm({
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
            Modal.destroyAll();
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
    className: 'confirm-modal-dark',
  });
};