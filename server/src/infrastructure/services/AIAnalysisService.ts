
import OpenAI from "openai";
import sharp from "sharp";
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

function getImageMimeTypeFromExtension(url: string): string {
  const ext = url.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
  };
  return mimeTypes[ext] || '';
}

function getImageMimeTypeFromBuffer(buffer: Buffer): string {
  if (buffer.length < 12) return '';
  
  // Check magic bytes
  const header = buffer.slice(0, 12);
  
  // PNG: 89 50 4E 47
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
    return 'image/png';
  }
  
  // JPEG: FF D8 FF
  if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
    return 'image/jpeg';
  }
  
  // GIF: 47 49 46 38
  if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x38) {
    return 'image/gif';
  }
  
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
      header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50) {
    return 'image/webp';
  }
  
  // AVIF/HEIC: ftyp box (00 00 00 XX 66 74 79 70)
  // Check for "ftyp" at position 4
  if (header[4] === 0x66 && header[5] === 0x74 && header[6] === 0x79 && header[7] === 0x70) {
    // Check brand after ftyp - avif, heic, heif, mif1
    const brand = buffer.slice(8, 12).toString('ascii');
    if (brand === 'avif' || brand === 'avis') {
      return 'image/avif'; // NOT supported by OpenAI
    }
    if (brand === 'heic' || brand === 'heif' || brand === 'mif1') {
      return 'image/heic'; // NOT supported by OpenAI
    }
  }
  
  return '';
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
      requiredKeywordsFound: Array<{ keyword: string; source: 'imagem' | 'texto' | 'ambos' }>;
      requiredKeywordsMissing: string[];
      prohibitedKeywordsFound: Array<{ keyword: string; source: 'imagem' | 'texto' | 'ambos' }>;
    };
    copywritingAnalysis?: {
      score: number;
      clarity: string;
      persuasion: string;
      callToAction: string;
      suggestions: string[];
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
        let buffer = await objectStorageService.downloadAsBuffer(imageUrl);
        if (buffer) {
          // Detect format from buffer
          let mimeType = getImageMimeTypeFromBuffer(buffer);
          console.log("AIAnalysisService: Detected from buffer:", mimeType, "URL:", imageUrl);
          
          if (!mimeType) {
            mimeType = getImageMimeTypeFromExtension(imageUrl);
            console.log("AIAnalysisService: Detected from extension:", mimeType);
          }
          
          // If still can't detect, try to convert anyway with sharp
          if (!mimeType) {
            console.log("AIAnalysisService: Unknown format, attempting conversion with sharp");
            try {
              const convertedBuffer = await sharp(buffer).jpeg({ quality: 85 }).toBuffer();
              console.log("AIAnalysisService: Successfully converted to JPEG");
              return `data:image/jpeg;base64,${convertedBuffer.toString('base64')}`;
            } catch (conversionError) {
              console.warn("AIAnalysisService: Conversion failed, skipping image");
              return null;
            }
          }
          
          // Convert unsupported formats (AVIF, HEIC) to JPEG
          const unsupportedFormats = ['image/avif', 'image/heic', 'image/heif'];
          if (unsupportedFormats.includes(mimeType)) {
            console.log("AIAnalysisService: Converting", mimeType, "to JPEG");
            try {
              const convertedBuffer = await sharp(buffer).jpeg({ quality: 85 }).toBuffer();
              console.log("AIAnalysisService: Successfully converted to JPEG");
              return `data:image/jpeg;base64,${convertedBuffer.toString('base64')}`;
            } catch (conversionError) {
              console.error("AIAnalysisService: Failed to convert image:", conversionError);
              return null;
            }
          }
          
          // Supported format - use directly
          const supportedFormats = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
          if (supportedFormats.includes(mimeType)) {
            console.log("AIAnalysisService: Using mimeType:", mimeType);
            return `data:${mimeType};base64,${buffer.toString('base64')}`;
          }
          
          // Unknown format - try to convert
          console.log("AIAnalysisService: Unknown format", mimeType, "- attempting conversion");
          try {
            const convertedBuffer = await sharp(buffer).jpeg({ quality: 85 }).toBuffer();
            return `data:image/jpeg;base64,${convertedBuffer.toString('base64')}`;
          } catch (conversionError) {
            console.warn("AIAnalysisService: Conversion failed");
            return null;
          }
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

      const prompt = `Você é um auditor de compliance de marca. Analise este criativo publicitário com MÁXIMA PRECISÃO.

${hasImage ? '🔍 ANÁLISE VISUAL OBRIGATÓRIA - Uma imagem foi fornecida. Examine CADA DETALHE:' : '⚠️ Sem imagem - análise apenas textual.'}
${hasImage ? '• Leia TODO texto visível na imagem (títulos, legendas, watermarks, textos pequenos)' : ''}
${hasImage ? '• Identifique TODAS as cores presentes e seus códigos HEX aproximados' : ''}
${hasImage ? '• Localize EXATAMENTE onde está o logo (canto, centro, ausente)' : ''}
${hasImage ? '• Descreva elementos visuais relevantes' : ''}

📋 DADOS DO CRIATIVO:
- Nome: ${creative.name}
- Tipo: ${creative.type}
- Texto Principal: "${creative.text || 'N/A'}"
- Título: "${creative.headline || 'N/A'}"
- Descrição: "${creative.description || 'N/A'}"
- CTA: "${creative.callToAction || 'N/A'}"
${brandRequirements}
${contentRequirements}

⚠️ REGRAS DE ANÁLISE - SIGA RIGOROSAMENTE:

🎨 CORES:
- Compare as cores da imagem com as cores especificadas acima
- Se a cor primária é "#2fac16" (verde), verifique se existe um verde SIMILAR na imagem
- Tolerância: cores com diferença de até 15% são consideradas conformes
- Liste as cores encontradas com seus códigos HEX aproximados
- colorCompliance = TRUE se cores da marca estão presentes (mesmo com pequenas variações)

🏷️ LOGO:
- Verifique se há QUALQUER logo/marca na imagem
- Descreva a posição exata do logo se encontrado
- logoCompliance = TRUE se logo está presente (independente da posição)

📝 PALAVRAS-CHAVE:
- Busque cada palavra obrigatória TANTO no texto do anúncio QUANTO na imagem
- Para cada palavra encontrada, indique se foi na "imagem", "texto" ou "ambos"
- Se uma palavra está no texto E na imagem, marque como "ambos"
- Seja SENSÍVEL a variações: "grátis", "GRÁTIS", "Gratis" são a mesma palavra
- Palavras proibidas: SOMENTE reporte se REALMENTE viu a palavra

✍️ COPYWRITING (analise a qualidade do texto do anúncio):
- Avalie clareza: O texto é fácil de entender?
- Avalie persuasão: O texto convence o leitor a agir?
- Avalie CTA: O call-to-action é efetivo e claro?
- Dê uma nota de 0-100 para o copywriting

📊 PONTUAÇÃO:
- Score 100: Tudo conforme
- Score 80-99: Conformidade alta, pequenos ajustes
- Score 60-79: Conformidade parcial, problemas moderados
- Score 0-59: Não conforme, problemas críticos

Responda em JSON (PORTUGUÊS-BR):
{
  "score": number (0-100),
  "issues": ["problema específico 1", "problema específico 2"],
  "recommendations": ["recomendação acionável 1", "recomendação acionável 2"],
  "logoCompliance": boolean,
  "logoJustification": "Ex: 'Logo da marca presente no canto superior direito da imagem' ou 'Nenhum logo identificado na imagem'",
  "colorCompliance": boolean,
  "colorJustification": "Ex: 'Cores encontradas: verde (#2DB516) e amarelo (#FFD700), compatíveis com a paleta da marca' ou 'Cores predominantes (azul, branco) não correspondem às cores da marca (verde, amarelo)'",
  "textCompliance": boolean,
  "textJustification": "Justificativa sobre textos e palavras-chave",
  "keywordAnalysis": {
    "requiredKeywordsFound": [{"keyword": "palavra", "source": "imagem|texto|ambos"}],
    "requiredKeywordsMissing": ["palavras não encontradas"],
    "prohibitedKeywordsFound": [{"keyword": "palavra proibida", "source": "imagem|texto|ambos"}]
  },
  "copywritingAnalysis": {
    "score": number (0-100),
    "clarity": "Avaliação da clareza do texto (ex: 'Texto claro e objetivo' ou 'Texto confuso e prolixo')",
    "persuasion": "Avaliação do poder de persuasão (ex: 'Usa gatilhos mentais eficazes' ou 'Falta urgência e benefícios claros')",
    "callToAction": "Avaliação do CTA (ex: 'CTA forte e direto' ou 'CTA fraco, não incentiva ação')",
    "suggestions": ["sugestão de melhoria 1", "sugestão de melhoria 2"]
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
            requiredKeywordsFound: Array.isArray(result.keywordAnalysis.requiredKeywordsFound) 
              ? result.keywordAnalysis.requiredKeywordsFound.map((item: any) => 
                  typeof item === 'string' 
                    ? { keyword: item, source: 'texto' as const }
                    : { keyword: item.keyword || item, source: (item.source || 'texto') as 'imagem' | 'texto' | 'ambos' }
                )
              : [],
            requiredKeywordsMissing: Array.isArray(result.keywordAnalysis.requiredKeywordsMissing) ? result.keywordAnalysis.requiredKeywordsMissing : [],
            prohibitedKeywordsFound: Array.isArray(result.keywordAnalysis.prohibitedKeywordsFound) 
              ? result.keywordAnalysis.prohibitedKeywordsFound.map((item: any) => 
                  typeof item === 'string' 
                    ? { keyword: item, source: 'texto' as const }
                    : { keyword: item.keyword || item, source: (item.source || 'texto') as 'imagem' | 'texto' | 'ambos' }
                )
              : [],
          } : undefined,
          copywritingAnalysis: result.copywritingAnalysis ? {
            score: Math.max(0, Math.min(100, Math.round(parseFloat(result.copywritingAnalysis.score) || 0))),
            clarity: result.copywritingAnalysis.clarity || '',
            persuasion: result.copywritingAnalysis.persuasion || '',
            callToAction: result.copywritingAnalysis.callToAction || '',
            suggestions: Array.isArray(result.copywritingAnalysis.suggestions) ? result.copywritingAnalysis.suggestions : [],
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
