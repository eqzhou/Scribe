/**
 * AIModelManager 共享常量与表单默认值
 */
import type { AIModel, ModelProvider, ModelCapability } from '../../types';
import { PROVIDER_META } from '../../stores/aiModelStore';

export const ALL_CAPABILITIES: ModelCapability[] = [
  'continue', 'rewrite', 'polish', 'expand',
  'outline', 'fulltext', 'dialogue', 'worldview',
];

/** 表单状态类型：模型字段去掉服务端生成的字段 */
export type FormState = Omit<AIModel, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder'>;

/** 模型表单默认值 */
export function defaultFormState(provider: ModelProvider = 'openai'): FormState {
  const meta = PROVIDER_META[provider];
  return {
    name: '',
    provider,
    modelId: meta.officialModels[0] ?? '',
    type: 'chat',
    capabilities: [...ALL_CAPABILITIES],
    apiKey: '',
    baseUrl: meta.defaultBaseUrl,
    temperature: 0.7,
    maxTokens: 0,
    enabled: true,
    isDefault: false,
  };
}
