export function getOcrConfig() {
  const apiKey = process.env.OCR_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OCR 未配置大模型 API');
  const baseUrl = process.env.OCR_BASE_URL?.trim() || process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1';
  return { apiKey, baseUrl: baseUrl.replace(/\/+$/, ''), model: process.env.OCR_MODEL?.trim() || 'qwen-vl-plus' };
}
