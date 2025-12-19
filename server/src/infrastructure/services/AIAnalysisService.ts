
import OpenAI from "openai";
import sharp from "sharp";
import type { Creative, Policy, AiSettings } from "../../shared/schema.js";
import { objectStorageService } from "./ObjectStorageService.js";
import { storage } from "../../shared/services/storage.service.js";

let openai: OpenAI | null = null;
let cachedApiKey: string | null = null;

interface AIConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  complianceSystemPrompt: string | null;
  performanceSystemPrompt: string | null;
}

const DEFAULT_AI_CONFIG: AIConfig = {
  model: 'gpt-4o',
  maxTokens: 1500,
  temperature: 0, // Zero temperature for maximum precision and consistency
  complianceSystemPrompt: null,
  performanceSystemPrompt: null,
};

async function getAIConfig(): Promise<AIConfig> {
  try {
    const settings = await storage.getAiSettings();
    if (settings) {
      return {
        model: settings.model || DEFAULT_AI_CONFIG.model,
        maxTokens: settings.maxTokens || DEFAULT_AI_CONFIG.maxTokens,
        temperature: 0, // Always use 0 for maximum precision - ignore database setting
        complianceSystemPrompt: settings.complianceSystemPrompt || null,
        performanceSystemPrompt: settings.performanceSystemPrompt || null,
      };
    }
  } catch (error) {
    console.warn('Failed to load AI settings from database, using defaults:', error);
  }
  return DEFAULT_AI_CONFIG;
}

// Pre-validate keywords in text content to prevent AI hallucinations
function findKeywordsInText(text: string, keywords: string[]): { found: string[], notFound: string[] } {
  const normalizedText = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const found: string[] = [];
  const notFound: string[] = [];
  
  for (const keyword of keywords) {
    const normalizedKeyword = keyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalizedText.includes(normalizedKeyword)) {
      found.push(keyword);
    } else {
      notFound.push(keyword);
    }
  }
  
  return { found, notFound };
}

async function getOpenAI(): Promise<OpenAI> {
  const settings = await storage.getAiSettings();
  const apiKey = settings?.apiKey || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for AI analysis features');
  }
  
  if (!openai || cachedApiKey !== apiKey) {
    openai = new OpenAI({ apiKey });
    cachedApiKey = apiKey;
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

export interface ComplianceIssue {
  category: 'logo' | 'cores' | 'texto' | 'palavras_proibidas' | 'palavras_obrigatorias' | 'copywriting' | 'outro';
  description: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface ComplianceAnalysis {
  score: number;
  issues: ComplianceIssue[];
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
  private categorizeIssue(issueText: string): ComplianceIssue['category'] {
    const lowerText = issueText.toLowerCase();
    
    if (lowerText.includes('logo') || lowerText.includes('marca') || lowerText.includes('logotipo')) {
      return 'logo';
    }
    if (lowerText.includes('cor') || lowerText.includes('paleta') || lowerText.includes('hex') || lowerText.includes('color')) {
      return 'cores';
    }
    if (lowerText.includes('proibid') || lowerText.includes('não permitid') || lowerText.includes('banned') || lowerText.includes('forbidden')) {
      return 'palavras_proibidas';
    }
    if (lowerText.includes('obrigatór') || lowerText.includes('faltando') || lowerText.includes('ausente') || lowerText.includes('required') || lowerText.includes('missing')) {
      return 'palavras_obrigatorias';
    }
    if (lowerText.includes('copy') || lowerText.includes('texto') || lowerText.includes('headline') || lowerText.includes('título') || lowerText.includes('descrição') || lowerText.includes('cta')) {
      return 'copywriting';
    }
    if (lowerText.includes('fonte') || lowerText.includes('tipografia') || lowerText.includes('font')) {
      return 'texto';
    }
    
    return 'outro';
  }

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

      const requiredKeywords = Array.isArray(policy?.requiredKeywords) ? policy.requiredKeywords : [];
      const requiredKeywordsList = requiredKeywords.length > 0
        ? requiredKeywords.map((kw: string, i: number) => `  ${i + 1}. "${kw}"`).join('\n')
        : '  Nenhuma palavra obrigatória definida';
      
      const prohibitedKeywords = Array.isArray(policy?.prohibitedKeywords) ? policy.prohibitedKeywords : [];
      const prohibitedKeywordsList = prohibitedKeywords.length > 0
        ? prohibitedKeywords.map((kw: string, i: number) => `  ${i + 1}. "${kw}"`).join('\n')
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

      // Detect creative format and get appropriate images
      const creativeFormat = (creative as any).creativeFormat as 'image' | 'video' | 'carousel' | null;
      const carouselImages = (creative as any).carouselImages as string[] | null;
      const isVideo = creativeFormat === 'video';
      const isCarousel = creativeFormat === 'carousel' && carouselImages && carouselImages.length > 1;
      
      // For VIDEO: Skip image analysis - analyze text only
      // For CAROUSEL: Get all carousel images
      // For IMAGE: Get single image
      let imageDataList: string[] = [];
      
      if (!isVideo) {
        if (isCarousel && carouselImages) {
          console.log(`[AIAnalysisService] Carousel detected with ${carouselImages.length} images`);
          for (const imgUrl of carouselImages) {
            const imgData = await this.getImageBase64(imgUrl);
            if (imgData) {
              imageDataList.push(imgData);
            }
          }
          console.log(`[AIAnalysisService] Successfully loaded ${imageDataList.length} carousel images`);
        } else {
          const singleImage = await this.getImageBase64(creative.imageUrl || '');
          if (singleImage) {
            imageDataList.push(singleImage);
          }
        }
      } else {
        console.log(`[AIAnalysisService] VIDEO creative - skipping image analysis, text-only mode`);
      }
      
      const hasImage = imageDataList.length > 0;

      // Build visual instruction based on creative type
      let visualInstruction = '';
      if (isVideo) {
        visualInstruction = `🎬 CRIATIVO DE VÍDEO - Análise apenas textual (sem imagem disponível)`;
      } else if (isCarousel) {
        visualInstruction = `🎠 CARROSSEL COM ${imageDataList.length} IMAGENS - Analise CADA imagem individualmente:
• Para cada imagem: identifique textos, cores, logos, elementos visuais
• Compare consistência entre as imagens
• Verifique se TODAS as imagens seguem os padrões da marca`;
      } else if (hasImage) {
        visualInstruction = `🔍 ANÁLISE VISUAL OBRIGATÓRIA - Uma imagem foi fornecida. Examine CADA DETALHE:
• Leia TODO texto visível na imagem (títulos, legendas, watermarks, textos pequenos)
• Identifique TODAS as cores presentes e seus códigos HEX aproximados
• Localize EXATAMENTE onde está o logo (canto, centro, ausente)
• Descreva elementos visuais relevantes`;
      } else {
        visualInstruction = `⚠️ Sem imagem - análise apenas textual.`;
      }

      const prompt = `Você é um auditor de compliance de marca. Analise este criativo publicitário com MÁXIMA PRECISÃO.

${visualInstruction}

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
  "issues": [
    {"category": "logo|cores|texto|palavras_proibidas|palavras_obrigatorias|copywriting|outro", "description": "descrição do problema", "severity": "critical|warning|info"},
    ...
  ],
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

      // Build userContent with all images for carousel, or single image for regular creative
      let userContent: MessageContent;
      
      if (imageDataList.length > 0) {
        const contentParts: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail: "low" | "high" | "auto" } }> = [
          { type: "text" as const, text: prompt }
        ];
        
        // Add all images (1 for single image, multiple for carousel)
        for (let i = 0; i < imageDataList.length; i++) {
          if (isCarousel) {
            contentParts.push({ type: "text" as const, text: `\n📷 Imagem ${i + 1} do carrossel:` });
          }
          contentParts.push({ 
            type: "image_url" as const, 
            image_url: { url: imageDataList[i], detail: "high" as const } 
          });
        }
        
        userContent = contentParts;
      } else {
        userContent = prompt;
      }

      const aiConfig = await getAIConfig();
      const openaiClient = await getOpenAI();
      
      const defaultSystemPrompt = "Você é um especialista em conformidade de marca. Analise criativos publicitários para problemas de conformidade e forneça recomendações acionáveis. SEMPRE responda em Português-BR. Quando uma imagem for fornecida, analise-a visualmente e seja PRECISO sobre o que você vê - nunca invente informações que não estão na imagem.";
      
      const response = await openaiClient.chat.completions.create({
        model: aiConfig.model,
        messages: [
          {
            role: "system",
            content: aiConfig.complianceSystemPrompt || defaultSystemPrompt
          },
          {
            role: "user",
            content: userContent
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: aiConfig.maxTokens,
      }, {
        timeout: 60000,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      // ============================================
      // PROGRAMMATIC VALIDATION TO PREVENT HALLUCINATIONS
      // ============================================
      // Combine all text content from creative for validation
      const allTextContent = [
        creative.text || '',
        creative.headline || '',
        creative.description || '',
        creative.callToAction || '',
        creative.name || ''
      ].join(' ');

      // Validate prohibited keywords - only keep those actually found in TEXT
      // (AI may still report image-based keywords, but we validate text ones)
      const textProhibitedCheck = findKeywordsInText(allTextContent, prohibitedKeywords);
      const textRequiredCheck = findKeywordsInText(allTextContent, requiredKeywords);
      
      console.log('[AIAnalysisService] Text validation results:');
      console.log('  - Prohibited in text:', textProhibitedCheck.found);
      console.log('  - Required in text:', textRequiredCheck.found);
      console.log('  - Required missing from text:', textRequiredCheck.notFound);

      // Process issues - handle both string and object formats
      const processedIssues: ComplianceIssue[] = [];
      if (Array.isArray(result.issues)) {
        for (const issue of result.issues) {
          if (typeof issue === 'string') {
            // Legacy string format - try to categorize
            processedIssues.push({
              category: this.categorizeIssue(issue),
              description: issue,
              severity: 'warning'
            });
          } else if (issue && typeof issue === 'object') {
            // New object format
            const validCategories = ['logo', 'cores', 'texto', 'palavras_proibidas', 'palavras_obrigatorias', 'copywriting', 'outro'];
            const category = validCategories.includes(issue.category) ? issue.category : 'outro';
            
            // VALIDATION: Filter out hallucinated prohibited keyword issues
            if (category === 'palavras_proibidas') {
              // Check if any prohibited keyword is mentioned in the issue description
              const mentionedProhibited = prohibitedKeywords.some(kw => 
                issue.description?.toLowerCase().includes(kw.toLowerCase())
              );
              // If AI claims a prohibited word but it's not in our validated list, skip it
              if (mentionedProhibited) {
                const actuallyProhibited = prohibitedKeywords.filter(kw => 
                  issue.description?.toLowerCase().includes(kw.toLowerCase()) &&
                  (textProhibitedCheck.found.includes(kw) || 
                   // Allow if source is "imagem" - we can't validate image content
                   issue.description?.toLowerCase().includes('imagem'))
                );
                if (actuallyProhibited.length === 0 && !issue.description?.toLowerCase().includes('imagem')) {
                  console.log('[AIAnalysisService] FILTERED HALLUCINATION - prohibited word issue:', issue.description);
                  continue; // Skip this hallucinated issue
                }
              }
            }
            
            processedIssues.push({
              category: category as ComplianceIssue['category'],
              description: issue.description || issue.message || String(issue),
              severity: issue.severity || 'warning'
            });
          }
        }
      }

      // Validate and correct keyword analysis from AI
      let validatedKeywordAnalysis = undefined;
      if (result.keywordAnalysis) {
        // Get AI's claims
        const aiProhibitedFound = Array.isArray(result.keywordAnalysis.prohibitedKeywordsFound) 
          ? result.keywordAnalysis.prohibitedKeywordsFound : [];
        const aiRequiredFound = Array.isArray(result.keywordAnalysis.requiredKeywordsFound)
          ? result.keywordAnalysis.requiredKeywordsFound : [];
        const aiRequiredMissing = Array.isArray(result.keywordAnalysis.requiredKeywordsMissing)
          ? result.keywordAnalysis.requiredKeywordsMissing : [];

        // Validate prohibited keywords found
        const validatedProhibitedFound: Array<{ keyword: string; source: 'imagem' | 'texto' | 'ambos' }> = [];
        for (const item of aiProhibitedFound) {
          const keyword = typeof item === 'string' ? item : (item.keyword || item);
          const source = typeof item === 'object' ? item.source : 'texto';
          
          // If source is "texto" or "ambos", verify it's actually in the text
          if (source === 'imagem') {
            // Trust AI for image analysis (we can't validate)
            validatedProhibitedFound.push({ keyword, source: 'imagem' });
          } else if (textProhibitedCheck.found.some(f => f.toLowerCase() === keyword.toLowerCase())) {
            // Verified in text
            validatedProhibitedFound.push({ keyword, source: source === 'ambos' ? 'ambos' : 'texto' });
          } else {
            console.log('[AIAnalysisService] FILTERED HALLUCINATION - prohibited keyword not in text:', keyword);
          }
        }

        // Validate required keywords found
        const validatedRequiredFound: Array<{ keyword: string; source: 'imagem' | 'texto' | 'ambos' }> = [];
        for (const item of aiRequiredFound) {
          const keyword = typeof item === 'string' ? item : (item.keyword || item);
          const source = typeof item === 'object' ? item.source : 'texto';
          
          if (source === 'imagem') {
            // Trust AI for image analysis
            validatedRequiredFound.push({ keyword, source: 'imagem' });
          } else if (textRequiredCheck.found.some(f => f.toLowerCase() === keyword.toLowerCase())) {
            // Verified in text
            validatedRequiredFound.push({ keyword, source: source === 'ambos' ? 'ambos' : 'texto' });
          } else {
            console.log('[AIAnalysisService] FILTERED HALLUCINATION - required keyword not in text:', keyword);
          }
        }

        // Calculate missing required keywords (use programmatic check as ground truth for text)
        const validatedRequiredMissing = requiredKeywords.filter(kw => {
          // Missing if: not in text AND not found in image by AI
          const inText = textRequiredCheck.found.some(f => f.toLowerCase() === kw.toLowerCase());
          const inImage = validatedRequiredFound.some(f => f.keyword.toLowerCase() === kw.toLowerCase() && f.source === 'imagem');
          return !inText && !inImage;
        });

        validatedKeywordAnalysis = {
          requiredKeywordsFound: validatedRequiredFound,
          requiredKeywordsMissing: validatedRequiredMissing,
          prohibitedKeywordsFound: validatedProhibitedFound,
        };
        
        console.log('[AIAnalysisService] Validated keyword analysis:', JSON.stringify(validatedKeywordAnalysis));
      }

      return {
        score: Math.max(0, Math.min(100, Math.round(parseFloat(result.score) || 0))),
        issues: processedIssues,
        recommendations: Array.isArray(result.recommendations) ? result.recommendations : [],
        analysis: {
          logoCompliance: result.logoCompliance || false,
          logoJustification: result.logoJustification || '',
          colorCompliance: result.colorCompliance || false,
          colorJustification: result.colorJustification || '',
          textCompliance: result.textCompliance || false,
          textJustification: result.textJustification || '',
          keywordAnalysis: validatedKeywordAnalysis,
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
        issues: [{
          category: 'outro',
          description: 'Análise falhou - configuração da OpenAI necessária',
          severity: 'critical'
        }],
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

      const aiConfig = await getAIConfig();
      const openaiClient = await getOpenAI();
      
      const defaultPerformancePrompt = "Você é um analista de performance de marketing digital. Analise métricas de performance de anúncios e forneça recomendações de otimização acionáveis. SEMPRE responda em Português-BR.";
      
      const response = await openaiClient.chat.completions.create({
        model: aiConfig.model,
        messages: [
          {
            role: "system",
            content: aiConfig.performanceSystemPrompt || defaultPerformancePrompt
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: aiConfig.maxTokens,
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
