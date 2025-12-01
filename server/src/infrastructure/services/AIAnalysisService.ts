
import OpenAI from "openai";
import type { Creative, Policy } from "../../shared/schema.js";
import { objectStorageService } from "./ObjectStorageService.js";

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for AI analysis features');
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

function getImageMimeType(url: string): string {
  const ext = url.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
  };
  return mimeTypes[ext] || 'image/jpeg';
}

export interface ComplianceAnalysis {
  score: number;
  issues: string[];
  recommendations: string[];
  analysis: {
    logoCompliance: boolean;
    colorCompliance: boolean;
    textCompliance: boolean;
    brandGuidelines: boolean;
  };
}

export interface PerformanceAnalysis {
  score: number;
  performance: 'high' | 'medium' | 'low';
  recommendations: string[];
  metrics: {
    ctrAnalysis: string;
    conversionAnalysis: string;
    costEfficiency: string;
  };
}

export class AIAnalysisService {
  private async getImageBase64(imageUrl: string): Promise<string | null> {
    if (!imageUrl) {
      console.log("AIAnalysisService: No image URL provided");
      return null;
    }
    
    try {
      console.log(`AIAnalysisService: Attempting to get image from: ${imageUrl}`);
      
      if (imageUrl.startsWith('/objects/')) {
        const buffer = await objectStorageService.downloadAsBuffer(imageUrl);
        if (buffer) {
          const mimeType = getImageMimeType(imageUrl);
          const base64 = buffer.toString('base64');
          console.log(`AIAnalysisService: Successfully converted image to base64 (${buffer.length} bytes, ${mimeType})`);
          return `data:${mimeType};base64,${base64}`;
        } else {
          console.log("AIAnalysisService: Buffer is null - image not found in storage");
        }
      } else {
        console.log(`AIAnalysisService: Image URL does not start with /objects/: ${imageUrl}`);
      }
      return null;
    } catch (error) {
      console.error("AIAnalysisService: Error getting image base64:", error);
      return null;
    }
  }

  async analyzeCreativeCompliance(
    creative: Creative,
    policy?: Policy | null
  ): Promise<ComplianceAnalysis> {
    try {
      const brandRequirements = policy ? `
Brand Requirements:
- Brand Name: ${policy.brandName || 'Not specified'}
- Primary Color: ${policy.primaryColor || 'Not specified'}
- Secondary Color: ${policy.secondaryColor || 'Not specified'}
- Accent Color: ${policy.accentColor || 'Not specified'}
- Brand Guidelines: ${policy.brandGuidelines || 'Not specified'}
- Logo URL: ${policy.logoUrl ? 'Logo provided' : 'No logo provided'}` : '\nNo brand configuration found.';

      const contentRequirements = policy ? `
Content Criteria:
- Policy Name: ${policy.name}
- Required Keywords: ${policy.requiredKeywords ? JSON.stringify(policy.requiredKeywords) : 'None'}
- Prohibited Keywords: ${policy.prohibitedKeywords ? JSON.stringify(policy.prohibitedKeywords) : 'None'}
- Requires Logo: ${policy.requiresLogo ? 'Yes' : 'No'}
- Requires Brand Colors: ${policy.requiresBrandColors ? 'Yes' : 'No'}` : '\nNo content criteria found.';

      console.log(`AIAnalysisService: Starting compliance analysis for creative: ${creative.name}, imageUrl: ${creative.imageUrl}`);
      const imageBase64 = await this.getImageBase64(creative.imageUrl || '');
      const hasImage = !!imageBase64;
      console.log(`AIAnalysisService: hasImage=${hasImage}, imageBase64 length=${imageBase64?.length || 0}`);

      const prompt = `Analise este criativo publicitário para conformidade com a marca baseado na configuração específica da marca e critérios de conteúdo do usuário.

${hasImage ? 'IMPORTANTE: Uma imagem do criativo foi fornecida. Analise VISUALMENTE a imagem para verificar:' : 'Nota: Nenhuma imagem disponível para análise visual.'}
${hasImage ? '- Textos, palavras e frases que aparecem NA IMAGEM' : ''}
${hasImage ? '- Cores predominantes e se correspondem às cores da marca' : ''}
${hasImage ? '- Presença do logo da marca na imagem' : ''}
${hasImage ? '- Qualquer elemento visual relevante para conformidade' : ''}

Detalhes do Criativo:
- Nome: ${creative.name}
- Tipo: ${creative.type}
- Texto do Anúncio: ${creative.text || 'N/A'}
- Título: ${creative.headline || 'N/A'}
- Descrição: ${creative.description || 'N/A'}
- Call to Action: ${creative.callToAction || 'N/A'}
${brandRequirements}
${contentRequirements}

IMPORTANTE: 
- Analise SOMENTE o que você realmente vê na imagem. NÃO invente ou suponha textos que não estão visíveis.
- Verifique palavras proibidas APENAS se elas realmente aparecem na imagem ou nos textos fornecidos.
- Seja preciso e factual na análise.

Por favor, analise:
1. Conformidade das cores da marca (baseado na análise visual da imagem)
2. Presença e conformidade do logo (verificar visualmente na imagem)
3. Presença de palavras-chave/frases obrigatórias (no texto E na imagem)
4. Ausência de palavras-chave/frases proibidas (no texto E na imagem)
5. Conformidade do comprimento do texto
6. Consistência geral da marca
7. Linguagem profissional e adequação

RESPONDA OBRIGATORIAMENTE EM PORTUGUÊS-BR. Responda com JSON neste formato: {
  "score": number (0-100),
  "issues": ["problema1", "problema2"],
  "recommendations": ["recomendação1", "recomendação2"],
  "logoCompliance": boolean,
  "colorCompliance": boolean,
  "textCompliance": boolean,
  "brandGuidelines": boolean
}`;

      type MessageContent = 
        | string 
        | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } }>;

      const userContent: MessageContent = hasImage
        ? [
            { type: "text" as const, text: prompt },
            { type: "image_url" as const, image_url: { url: imageBase64!, detail: "high" as const } }
          ]
        : prompt;

      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Você é um especialista em conformidade de marca. Analise criativos publicitários para problemas de conformidade e forneça recomendações acionáveis. SEMPRE responda em Português-BR. Quando uma imagem for fornecida, analise-a visualmente e seja PRECISO sobre o que você vê - nunca invente informações que não estão na imagem."
          },
          {
            role: "user",
            content: userContent
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500,
      }, {
        timeout: 60000,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      return {
        score: Math.max(0, Math.min(100, Math.round(parseFloat(result.score) || 0))),
        issues: Array.isArray(result.issues) ? result.issues : [],
        recommendations: Array.isArray(result.recommendations) ? result.recommendations : [],
        analysis: {
          logoCompliance: result.logoCompliance || false,
          colorCompliance: result.colorCompliance || false,
          textCompliance: result.textCompliance || false,
          brandGuidelines: result.brandGuidelines || false,
        }
      };
    } catch (error) {
      console.error("AI compliance analysis failed:", error);
      return {
        score: 0,
        issues: ["Análise falhou - configuração da OpenAI necessária"],
        recommendations: ["Configure uma chave válida da OpenAI"],
        analysis: {
          logoCompliance: false,
          colorCompliance: false,
          textCompliance: false,
          brandGuidelines: false,
        }
      };
    }
  }

  async analyzeCreativePerformance(
    creative: Creative,
    policy?: Policy | null
  ): Promise<PerformanceAnalysis> {
    try {
      const ctr = parseFloat(creative.ctr || "0");
      const cpc = parseFloat(creative.cpc || "0");
      const conversions = creative.conversions || 0;
      const clicks = creative.clicks || 1;
      const conversionRate = conversions / Math.max(clicks, 1);

      const benchmarksContext = policy ? `
Performance Benchmarks (user-defined thresholds):
- CTR Minimum: ${policy.ctrMin || 'Not set'}%
- CTR Target: ${policy.ctrTarget || 'Not set'}%
- CPC Maximum: $${policy.cpcMax || 'Not set'}
- CPC Target: $${policy.cpcTarget || 'Not set'}
- Conversions Minimum: ${policy.conversionsMin || 'Not set'}
- Conversions Target: ${policy.conversionsTarget || 'Not set'}` : '\nNo performance benchmarks configured.';

      const prompt = `Analise a performance deste criativo publicitário contra os benchmarks definidos pelo usuário:

Métricas de Performance Atuais:
- Impressões: ${creative.impressions}
- Cliques: ${creative.clicks}
- Conversões: ${creative.conversions}
- CTR: ${ctr}%
- CPC: $${cpc}
- Taxa de Conversão: ${(conversionRate * 100).toFixed(2)}%
${benchmarksContext}

Detalhes do Criativo:
- Tipo: ${creative.type}
- Texto: ${creative.text || 'N/A'}
- Título: ${creative.headline || 'N/A'}

RESPONDA OBRIGATORIAMENTE EM PORTUGUÊS-BR. Responda com JSON neste formato: {
  "score": number (0-100),
  "performance": "high|medium|low",
  "recommendations": ["recomendação1", "recomendação2"],
  "ctrAnalysis": "texto da análise",
  "conversionAnalysis": "texto da análise", 
  "costEfficiency": "texto da análise"
}`;

      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Você é um analista de performance de marketing digital. Analise métricas de performance de anúncios e forneça recomendações de otimização acionáveis. SEMPRE responda em Português-BR."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
      }, {
        timeout: 30000,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      return {
        score: Math.max(0, Math.min(100, Math.round(parseFloat(result.score) || 0))),
        performance: ['high', 'medium', 'low'].includes(result.performance) ? result.performance : 'low',
        recommendations: Array.isArray(result.recommendations) ? result.recommendations : [],
        metrics: {
          ctrAnalysis: result.ctrAnalysis || "No analysis available",
          conversionAnalysis: result.conversionAnalysis || "No analysis available",
          costEfficiency: result.costEfficiency || "No analysis available",
        }
      };
    } catch (error) {
      console.error("AI performance analysis failed:", error);
      return {
        score: 0,
        performance: 'low',
        recommendations: ["Análise falhou - revise a performance manualmente"],
        metrics: {
          ctrAnalysis: "Análise indisponível",
          conversionAnalysis: "Análise indisponível",
          costEfficiency: "Análise indisponível",
        }
      };
    }
  }
}
