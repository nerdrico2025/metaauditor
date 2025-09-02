import OpenAI from "openai";
import type { Creative, BrandConfiguration, ContentCriteria } from "@shared/schema";

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

export async function analyzeCreativeCompliance(
  creative: Creative,
  brandConfig?: BrandConfiguration | null,
  contentCriteria?: ContentCriteria | null
): Promise<ComplianceAnalysis> {
  try {
    // Build detailed brand and content requirements
    const brandRequirements = brandConfig ? `
Brand Requirements:
- Brand Name: ${brandConfig.brandName}
- Primary Color: ${brandConfig.primaryColor || 'Not specified'}
- Secondary Color: ${brandConfig.secondaryColor || 'Not specified'}
- Accent Color: ${brandConfig.accentColor || 'Not specified'}
- Font Family: ${brandConfig.fontFamily || 'Not specified'}
- Brand Guidelines: ${brandConfig.brandGuidelines || 'Not specified'}
- Logo URL: ${brandConfig.logoUrl ? 'Logo provided' : 'No logo provided'}` : '\nNo brand configuration found.';
    
    const contentRequirements = contentCriteria ? `
Content Criteria:
- Criteria Name: ${contentCriteria.name}
- Required Keywords: ${contentCriteria.requiredKeywords ? JSON.stringify(contentCriteria.requiredKeywords) : 'None'}
- Prohibited Keywords: ${contentCriteria.prohibitedKeywords ? JSON.stringify(contentCriteria.prohibitedKeywords) : 'None'}
- Required Phrases: ${contentCriteria.requiredPhrases ? JSON.stringify(contentCriteria.requiredPhrases) : 'None'}
- Prohibited Phrases: ${contentCriteria.prohibitedPhrases ? JSON.stringify(contentCriteria.prohibitedPhrases) : 'None'}
- Min Text Length: ${contentCriteria.minTextLength || 'Not specified'}
- Max Text Length: ${contentCriteria.maxTextLength || 'Not specified'}
- Requires Logo: ${contentCriteria.requiresLogo ? 'Yes' : 'No'}
- Requires Brand Colors: ${contentCriteria.requiresBrandColors ? 'Yes' : 'No'}` : '\nNo content criteria found.';

    const prompt = `Analyze this ad creative for brand compliance based on the user's specific brand configuration and content criteria:
    
Creative Details:
- Name: ${creative.name}
- Type: ${creative.type}
- Text: ${creative.text || 'N/A'}
- Headline: ${creative.headline || 'N/A'}
- Description: ${creative.description || 'N/A'}
- Call to Action: ${creative.callToAction || 'N/A'}
- Image URL: ${creative.imageUrl ? 'Image provided' : 'No image'}
${brandRequirements}
${contentRequirements}

IMPORTANT: Analyze compliance against the SPECIFIC brand colors, keywords, and criteria provided above. If brand colors are specified, check if the creative uses those exact colors. If required keywords are specified, verify they are present. If prohibited keywords/phrases are specified, check that they are NOT present.

Please analyze for:
1. Brand color compliance (against specific colors if provided)
2. Logo presence and compliance (if required)
3. Required keywords/phrases presence
4. Prohibited keywords/phrases absence
5. Text length compliance (if specified)
6. Overall brand consistency
7. Professional language and appropriateness

Respond with JSON in this format: {
  "score": number (0-100),
  "issues": ["issue1", "issue2"],
  "recommendations": ["rec1", "rec2"],
  "logoCompliance": boolean,
  "colorCompliance": boolean,
  "textCompliance": boolean,
  "brandGuidelines": boolean
}`;

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a brand compliance expert. Analyze ad creatives for compliance issues and provide actionable recommendations."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    return {
      score: Math.max(0, Math.min(100, result.score || 0)),
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
      issues: ["Analysis failed - unable to process creative"],
      recommendations: ["Please review creative manually"],
      analysis: {
        logoCompliance: false,
        colorCompliance: false,
        textCompliance: false,
        brandGuidelines: false,
      }
    };
  }
}

export async function analyzeCreativePerformance(
  creative: Creative
): Promise<PerformanceAnalysis> {
  try {
    const ctr = parseFloat(creative.ctr || "0");
    const cpc = parseFloat(creative.cpc || "0");
    const conversions = creative.conversions || 0;
    const clicks = creative.clicks || 1;
    const conversionRate = conversions / Math.max(clicks, 1);

    const prompt = `Analyze this ad creative's performance:

Performance Metrics:
- Impressions: ${creative.impressions}
- Clicks: ${creative.clicks}
- Conversions: ${creative.conversions}
- CTR: ${ctr}%
- CPC: $${cpc}
- Conversion Rate: ${(conversionRate * 100).toFixed(2)}%

Creative Details:
- Type: ${creative.type}
- Text: ${creative.text || 'N/A'}
- Headline: ${creative.headline || 'N/A'}

Analyze performance and provide recommendations for improvement.

Respond with JSON in this format: {
  "score": number (0-100),
  "performance": "high|medium|low",
  "recommendations": ["rec1", "rec2"],
  "ctrAnalysis": "analysis text",
  "conversionAnalysis": "analysis text", 
  "costEfficiency": "analysis text"
}`;

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a digital marketing performance analyst. Analyze ad performance metrics and provide actionable optimization recommendations."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    return {
      score: Math.max(0, Math.min(100, result.score || 0)),
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
      recommendations: ["Analysis failed - please review performance manually"],
      metrics: {
        ctrAnalysis: "Analysis unavailable",
        conversionAnalysis: "Analysis unavailable",
        costEfficiency: "Analysis unavailable",
      }
    };
  }
}