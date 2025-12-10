
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
    logoJustification?: string;
    colorCompliance: boolean;
    colorJustification?: string;
    textCompliance: boolean;
    textJustification?: string;
    keywordAnalysis?: {
      requiredKeywordsFound: string[];
      requiredKeywordsMissing: string[];
      prohibitedKeywordsFound: string[];
    };
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
    if (!imageUrl) return null;
    
    try {
      if (imageUrl.startsWith('/objects/')) {
        const buffer = await objectStorageService.downloadAsBuffer(imageUrl);
        if (buffer) {
          const mimeType = getImageMimeType(imageUrl);
          return `data:${mimeType};base64,${buffer.toString('base64')}`;
        }
      }
      return null;
    } catch (error) {
      console.error("AIAnalysisService: Error getting image:", error);
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
- Logo URL: ${policy.logoUrl ? 'Logo provided' : 'No logo provided'}` : '\nNo brand configuration found.';

      const requiredKeywordsList = policy?.requiredKeywords && policy.requiredKeywords.length > 0
        ? policy.requiredKeywords.map((kw, i) => `  ${i + 1}. "${kw}"`).join('\n')
        : '  Nenhuma palavra obrigatória definida';
      
      const prohibitedKeywordsList = policy?.prohibitedKeywords && policy.prohibitedKeywords.length > 0
        ? policy.prohibitedKeywords.map((kw, i) => `  ${i + 1}. "${kw}"`).join('\n')
        : '  Nenhuma palavra proibida definida';

      const contentRequirements = policy ? `
Critérios de Conteúdo:
- Nome da Política: ${policy.name}

PALAVRAS/FRASES OBRIGATÓRIAS (devem aparecer no texto ou imagem):
${requiredKeywordsList}

PALAVRAS/FRASES PROIBIDAS (NÃO podem aparecer no texto ou imagem):
${prohibitedKeywordsList}

- Requer Logo: ${policy.requiresLogo ? 'Sim' : 'Não'}
- Requer Cores da Marca: ${policy.requiresBrandColors ? 'Sim' : 'Não'}` : '\nNenhum critério de conteúdo encontrado.';

      const imageBase64 = await this.getImageBase64(creative.imageUrl || '');
      const hasImage = !!imageBase64;

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

REGRAS CRÍTICAS PARA ANÁLISE DE PALAVRAS-CHAVE:

1. PALAVRAS OBRIGATÓRIAS:
   - Verifique se CADA palavra/frase obrigatória listada acima aparece nos textos OU na imagem
   - Considere variações (maiúsculas/minúsculas, singular/plural)
   - Se uma palavra obrigatória NÃO foi encontrada, liste isso como um problema
   - NÃO invente que uma palavra está presente se você não a viu claramente

2. PALAVRAS PROIBIDAS:
   - Verifique se ALGUMA palavra/frase proibida listada acima aparece nos textos OU na imagem
   - APENAS reporte como problema se você VIU a palavra proibida claramente
   - NÃO reporte palavras proibidas que você NÃO encontrou - isso não é um problema
   - Se nenhuma palavra proibida foi encontrada, isso é POSITIVO (não é um problema)

3. PRECISÃO:
   - Analise SOMENTE o que você realmente vê
   - NÃO invente ou suponha textos que não estão visíveis
   - Seja preciso e factual

Por favor, analise:
1. Conformidade das cores da marca (baseado na análise visual da imagem)
2. Presença e conformidade do logo (verificar visualmente na imagem)
3. Presença de palavras-chave/frases obrigatórias (verificar CADA uma da lista)
4. Ausência de palavras-chave/frases proibidas (verificar se ALGUMA aparece)
5. Conformidade do comprimento do texto
6. Linguagem profissional e adequação

RESPONDA OBRIGATORIAMENTE EM PORTUGUÊS-BR. Responda com JSON neste formato: {
  "score": number (0-100),
  "issues": ["problema1", "problema2"],
  "recommendations": ["recomendação1", "recomendação2"],
  "logoCompliance": boolean,
  "logoJustification": "Justificativa detalhada sobre a presença/ausência do logo. Ex: 'Logo presente no canto superior direito' ou 'Logo ausente - não foi identificado nenhum logo na imagem'",
  "colorCompliance": boolean,
  "colorJustification": "Justificativa detalhada sobre as cores. Ex: 'Cores da marca identificadas: azul e branco predominantes' ou 'Cores não correspondem - encontradas cores vermelhas que não fazem parte da paleta da marca'",
  "textCompliance": boolean,
  "textJustification": "Justificativa detalhada sobre o texto e palavras-chave",
  "keywordAnalysis": {
    "requiredKeywordsFound": ["lista de palavras obrigatórias que FORAM encontradas"],
    "requiredKeywordsMissing": ["lista de palavras obrigatórias que NÃO foram encontradas"],
    "prohibitedKeywordsFound": ["lista de palavras proibidas que FORAM encontradas - vazio se nenhuma"]
  }
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
          logoJustification: result.logoJustification || '',
          colorCompliance: result.colorCompliance || false,
          colorJustification: result.colorJustification || '',
          textCompliance: result.textCompliance || false,
          textJustification: result.textJustification || '',
          keywordAnalysis: result.keywordAnalysis ? {
            requiredKeywordsFound: Array.isArray(result.keywordAnalysis.requiredKeywordsFound) ? result.keywordAnalysis.requiredKeywordsFound : [],
            requiredKeywordsMissing: Array.isArray(result.keywordAnalysis.requiredKeywordsMissing) ? result.keywordAnalysis.requiredKeywordsMissing : [],
            prohibitedKeywordsFound: Array.isArray(result.keywordAnalysis.prohibitedKeywordsFound) ? result.keywordAnalysis.prohibitedKeywordsFound : [],
          } : undefined,
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
          logoJustification: 'Análise não disponível',
          colorCompliance: false,
          colorJustification: 'Análise não disponível',
          textCompliance: false,
          textJustification: 'Análise não disponível',
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
Benchmarks de Performance (definidos pelo usuário):
- CTR Mínimo: ${policy.ctrMin || 'Não definido'}%
- CTR Alvo: ${policy.ctrTarget || 'Não definido'}%
- CPC Máximo: R$ ${policy.cpcMax || 'Não definido'}
- CPC Alvo: R$ ${policy.cpcTarget || 'Não definido'}
- Conversões Mínimas: ${policy.conversionsMin || 'Não definido'}
- Conversões Alvo: ${policy.conversionsTarget || 'Não definido'}` : '\nNenhum benchmark de performance configurado.';

      const prompt = `Analise a performance deste criativo publicitário contra os benchmarks definidos pelo usuário:

Métricas de Performance Atuais:
- Impressões: ${creative.impressions}
- Cliques: ${creative.clicks}
- Conversões: ${creative.conversions}
- CTR: ${ctr}%
- CPC: R$ ${cpc}
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
