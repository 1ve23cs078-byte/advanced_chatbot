// Fallback declaration to satisfy TypeScript if the package's own types are not picked up.
declare module '@google/generative-ai' {
  export class GoogleGenerativeAI {
    constructor(apiKey: string);
    getGenerativeModel(opts: { model: string }): GenerativeModel;
  }
  export interface GenerateContentRequest {
    contents: any[];
    generationConfig?: any;
    safetySettings?: any[];
  }
  export interface GenerativeModel {
    generateContentStream(req: GenerateContentRequest): Promise<{ stream: AsyncIterable<any> }>;
  }
  export interface SafetySetting {
    category: string;
    threshold: string;
  }
}