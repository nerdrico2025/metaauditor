
import OpenAI from "openai";
import type { Creative, BrandConfiguration, ContentCriteria, PerformanceBenchmarks } from "@shared/schema";

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
  async analyzeCreativeCompliance(
    creative: Creative,
    brandConfig?: BrandConfiguration | null,
    contentCriteria?: ContentCriteria | null
  ): Promise<ComplianceAnalysis> {
    try {
      const brandRequirements = brandConfig ? `
Brand Requirements:
- Brand Name: ${brandConfig.brandName}
- Primary Color: ${brandConfig.primaryColor || 'Not specified'}
- Secondary Color: ${brandConfig.secondaryColor || 'Not specified'}
- Accent Color: ${brandConfig.accentColor || 'Not specified'}
- Brand Guidelines: ${brandConfig.brandGuidelines || 'Not specified'}
- Logo URL: ${brandConfig.logoUrl ? 'Logo provided' : 'No logo provided'}` : '\nNo brand configuration found.';

      const contentRequirements = contentCriteria ? `
Content Criteria:
- Criteria Name: ${contentCriteria.name}
- Required Keywords: ${contentCriteria.requiredKeywords ? JSON.stringify(contentCriteria.requiredKeywords) : 'None'}
- Prohibited Keywords: ${contentCriteria.prohibitedKeywords ? JSON.stringify(contentCriteria.prohibitedKeywords) : 'None'}
- Requires Logo: ${contentCriteria.requiresLogo ? 'Yes' : 'No'}
- Requires Brand Colors: ${contentCriteria.requiresBrandColors ? 'Yes' : 'No'}` : '\nNo content criteria found.';

      const prompt = `Analise este criativo publicitário para conformidade com a marca baseado na configuração específica da marca e critérios de conteúdo do usuário:

Detalhes do Criativo:
- Nome: ${creative.name}
- Tipo: ${creative.type}
- Texto: ${creative.text || 'N/A'}
- Título: ${creative.headline || 'N/A'}
- Descrição: ${creative.description || 'N/A'}
- Call to Action: ${creative.callToAction || 'N/A'}
- URL da Imagem: ${creative.imageUrl ? 'Imagem fornecida' : 'Sem imagem'}
${brandRequirements}
${contentRequirements}

IMPORTANTE: Analise a conformidade contra as cores específicas da marca, palavras-chave e critérios fornecidos acima.

Por favor, analise:
1. Conformidade das cores da marca
2. Presença e conformidade do logo
3. Presença de palavras-chave/frases obrigatórias
4. Ausência de palavras-chave/frases proibidas
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

      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Você é um especialista em conformidade de marca. Analise criativos publicitários para problemas de conformidade e forneça recomendações acionáveis. SEMPRE responda em Português-BR."
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
    performanceBenchmarks?: PerformanceBenchmarks | null
  ): Promise<PerformanceAnalysis> {
    try {
      const ctr = parseFloat(creative.ctr || "0");
      const cpc = parseFloat(creative.cpc || "0");
      const conversions = creative.conversions || 0;
      const clicks = creative.clicks || 1;
      const conversionRate = conversions / Math.max(clicks, 1);

      const benchmarksContext = performanceBenchmarks ? `
Performance Benchmarks (user-defined thresholds):
- CTR Minimum: ${performanceBenchmarks.ctrMin || 'Not set'}%
- CTR Target: ${performanceBenchmarks.ctrTarget || 'Not set'}%
- CPC Maximum: $${performanceBenchmarks.cpcMax || 'Not set'}
- CPC Target: $${performanceBenchmarks.cpcTarget || 'Not set'}
- Conversions Minimum: ${performanceBenchmarks.conversionsMin || 'Not set'}
- Conversions Target: ${performanceBenchmarks.conversionsTarget || 'Not set'}` : '\nNo performance benchmarks configured.';

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
