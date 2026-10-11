import catalog from './models.json';

export interface ModelFile {
  name: string;
  bytes: number;
  sha256: string;
}
export interface ModelDefinition {
  id: string;
  label: string;
  repo: string;
  revision: string;
  engine: string;
  normalization: string;
  files: ModelFile[];
  vocabSize: number;
}
export const models: ModelDefinition[] = catalog;
export function getModel(id: string): ModelDefinition {
  const model = models.find((candidate) => candidate.id === id);
  if (!model) throw new Error(`未知模型：${id}`);
  return model;
}
export const fileUrl = (model: ModelDefinition, file: ModelFile) =>
  `https://huggingface.co/${model.repo}/resolve/${model.revision}/${file.name}`;
export const modelSize = (model: ModelDefinition) =>
  (model.files.reduce((sum, file) => sum + file.bytes, 0) / 1_000_000).toFixed(1);
