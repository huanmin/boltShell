import { Modal, Form, Input, Select, InputNumber, message, Checkbox, Button, Space } from 'antd';
import { useEffect, useState } from 'react';
import { connectionApi } from '../../api';
import { useAppStore } from '../../stores/appStore';
import '../common/ModalStyles.css';

interface AddConnectionModalProps {
  open: boolean;
  onClose: () => void;
}

const AddConnectionModal: React.FC<AddConnectionModalProps> = ({ open, onClose }) => {
  const [form] = Form.useForm();
  const { addConnection } = useAppStore();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (open) {
      form.resetFields();
      setTestResult(null);
    }
  }, [open, form]);

  const handleTest = async () => {
    try {
      const values = await form.validateFields();
      setTesting(true);
      setTestResult(null);

      // 直接测试连接，不需要先创建
      const testRes = await connectionApi.testDirect({
        host: values.host,
        port: values.port || 22,
        username: values.username,
        authType: values.authType,
        password: values.authType === 'PASSWORD' ? values.password : undefined,
        privateKey: values.authType === 'KEY' ? values.privateKey : undefined,
      });
      
      setTestResult({
        success: testRes.data.code === 0 && testRes.data.data?.success,
        message: testRes.data.data?.message || (testRes.data.code === 0 ? '连接成功' : '连接失败'),
      });
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error?.response?.data?.message || '连接测试失败',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const res = await connectionApi.create({
        name: values.name,
        host: values.host,
        port: values.port || 22,
        username: values.username,
        authType: values.authType,
        password: values.authType === 'PASSWORD' && values.rememberCredential ? values.password : undefined,
        privateKey: values.authType === 'KEY' && values.rememberCredential ? values.privateKey : undefined,
        rememberCredential: values.rememberCredential || false,
      });

      if (res.data.code === 0) {
        message.success('连接创建成功');
        addConnection({
          ...res.data.data,
          status: 'disconnected',
        });
        onClose();
      } else {
        message.error(res.data.message || '创建失败');
      }
    } catch (error) {
      message.error('创建连接失败');
    }
  };

  const authType = Form.useWatch('authType', form);

  return (
    <Modal
      title="新增 SSH 连接"
      open={open}
      onCancel={onClose}
      footer={null}
      width={500}
      centered
      className="connection-modal"
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ port: 22, authType: 'PASSWORD', rememberCredential: false }}
      >
        <Form.Item
          name="name"
          label="连接名称"
          rules={[{ required: true, message: '请输入连接名称' }]}
        >
          <Input placeholder="如：生产服务器、测试环境" />
        </Form.Item>

        <Form.Item
          name="host"
          label="主机地址"
          rules={[{ required: true, message: '请输入主机地址' }]}
        >
          <Input placeholder="IP 地址或域名" />
        </Form.Item>

        <Form.Item
          name="port"
          label="端口"
        >
          <InputNumber min={1} max={65535} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="username"
          label="用户名"
          rules={[{ required: true, message: '请输入用户名' }]}
        >
          <Input placeholder="SSH 登录用户名" />
        </Form.Item>

        <Form.Item
          name="authType"
          label="认证方式"
        >
          <Select>
            <Select.Option value="PASSWORD">密码认证</Select.Option>
            <Select.Option value="KEY">密钥认证</Select.Option>
          </Select>
        </Form.Item>

        {authType === 'PASSWORD' ? (
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="SSH 登录密码" />
          </Form.Item>
        ) : (
          <Form.Item
            name="privateKey"
            label="私钥"
            rules={[{ required: true, message: '请输入私钥' }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="粘贴 SSH 私钥内容"
            />
          </Form.Item>
        )}

        <Form.Item
          name="rememberCredential"
          valuePropName="checked"
        >
          <Checkbox>保存密码（加密存储在本地）</Checkbox>
        </Form.Item>

        {/* 测试结果 */}
        {testResult && (
          <div style={{ 
            padding: '8px 12px', 
            marginBottom: 16, 
            borderRadius: 6,
            background: testResult.success ? '#f6ffed' : '#fff2f0',
            border: `1px solid ${testResult.success ? '#b7eb8f' : '#ffccc7'}`,
          }}>
            <span style={{ color: testResult.success ? '#52c41a' : '#ff4d4f' }}>
              {testResult.success ? '✓ ' : '✗ '}
              {testResult.message}
            </span>
          </div>
        )}

        {/* 按钮区域 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
          <Button 
            onClick={handleTest} 
            loading={testing}
            disabled={testing}
          >
            {testing ? '测试中...' : '测试连接'}
          </Button>
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" onClick={() => form.submit()}>
              创建
            </Button>
          </Space>
        </div>
      </Form>
    </Modal>
  );
};

export default AddConnectionModal;