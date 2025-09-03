import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import {
  users,
  integrations,
  campaigns,
  creatives,
  policies,
  audits,
  auditActions,
  campaignMetrics,
  brandConfigurations,
  contentCriteria
} from '@shared/schema';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

export async function checkIfDatabaseEmpty(): Promise<boolean> {
  try {
    const existingUsers = await db.select().from(users).limit(1);
    return existingUsers.length === 0;
  } catch (error) {
    console.log('Database might need initialization:', error);
    return true;
  }
}

export async function seedDatabase() {
  console.log('🌱 Starting database seeding for production environment...');
  
  try {
    // Create test user
    const hashedPassword = await bcrypt.hash('TesteFacebook2025!', 10);
    const [testUser] = await db.insert(users).values({
      id: 'test-user-id',
      email: 'usuario.teste@clickauditor-demo.com',
      password: hashedPassword,
      firstName: 'Usuário',
      lastName: 'Teste',
      profileImageUrl: null
    }).returning();
    
    console.log('✅ Test user created');

    // Create integrations
    const [metaIntegration] = await db.insert(integrations).values({
      userId: testUser.id,
      platform: 'meta',
      accessToken: 'demo_meta_token',
      accountId: '123456789',
      status: 'active',
      lastSync: new Date()
    }).returning();

    const [googleIntegration] = await db.insert(integrations).values({
      userId: testUser.id,
      platform: 'google',
      accessToken: 'demo_google_token',
      accountId: '987654321',
      status: 'active',
      lastSync: new Date()
    }).returning();

    console.log('✅ Platform integrations created');

    // Create campaigns
    const campaignList = [
      { name: 'Black Friday Promoções', platform: 'meta', budget: '5000.00', integrationId: metaIntegration.id },
      { name: 'Produtos Verão 2025', platform: 'meta', budget: '3500.00', integrationId: metaIntegration.id },
      { name: 'Liquidação Janeiro', platform: 'google', budget: '2500.00', integrationId: googleIntegration.id },
      { name: 'Lançamento Nova Linha', platform: 'meta', budget: '4000.00', integrationId: metaIntegration.id },
      { name: 'Campanhas Especiais', platform: 'google', budget: '3000.00', integrationId: googleIntegration.id }
    ];

    const campaignIds = [];
    for (const camp of campaignList) {
      const [campaign] = await db.insert(campaigns).values({
        userId: testUser.id,
        integrationId: camp.integrationId,
        externalId: `ext_${Math.random().toString(36).substr(2, 9)}`,
        name: camp.name,
        platform: camp.platform,
        status: 'active',
        budget: camp.budget
      }).returning();
      campaignIds.push(campaign.id);
    }

    console.log('✅ Campaigns created');

    // Create creatives for each campaign
    const creativeTypes = ['image', 'video', 'carousel', 'text'];
    const creativeNames = [
      'Criativo Desconto 50%',
      'Banner Produto Principal',
      'Vídeo Demonstração',
      'Carrossel Produtos',
      'Anúncio Texto CTA',
      'Imagem Promocional',
      'Story Instagram',
      'Feed Facebook'
    ];

    const creativeIds = [];
    for (const campaignId of campaignIds) {
      for (let i = 0; i < 4; i++) {
        const [creative] = await db.insert(creatives).values({
          userId: testUser.id,
          campaignId,
          externalId: `creative_${Math.random().toString(36).substr(2, 9)}`,
          name: creativeNames[Math.floor(Math.random() * creativeNames.length)],
          type: creativeTypes[Math.floor(Math.random() * creativeTypes.length)],
          imageUrl: 'https://via.placeholder.com/800x600/cf6f03/ffffff?text=Demo+Creative',
          text: 'Descubra nossa incrível promoção! Aproveite descontos exclusivos.',
          headline: 'Oferta Imperdível!',
          description: 'Não perca esta oportunidade única.',
          callToAction: 'Comprar Agora',
          status: 'active',
          impressions: Math.floor(Math.random() * 10000) + 1000,
          clicks: Math.floor(Math.random() * 500) + 50,
          conversions: Math.floor(Math.random() * 50) + 5,
          ctr: (Math.random() * 4.999).toFixed(3),
          cpc: (Math.random() * 9 + 1).toFixed(2)
        }).returning();
        creativeIds.push(creative.id);
      }
    }

    console.log('✅ Creatives created');

    // Create brand configuration
    await db.insert(brandConfigurations).values({
      userId: testUser.id,
      brandName: 'Click Auditor Demo',
      primaryColor: '#cf6f03',
      secondaryColor: '#0c0d0a',
      accentColor: '#10b981',
      fontFamily: 'Inter',
      brandGuidelines: 'Mantenha a identidade visual consistente com cores laranja e preto. Use sempre o logo oficial.',
      isActive: true
    });

    console.log('✅ Brand configuration created');

    // Create content criteria
    await db.insert(contentCriteria).values({
      userId: testUser.id,
      name: 'Critérios Padrão de Marca',
      description: 'Validação automática de compliance da marca',
      requiredKeywords: JSON.stringify(['promoção', 'desconto', 'oferta']),
      prohibitedKeywords: JSON.stringify(['grátis', 'free', 'sem custo']),
      requiredPhrases: JSON.stringify(['aproveite', 'não perca']),
      prohibitedPhrases: JSON.stringify(['totalmente grátis', '100% gratuito']),
      minTextLength: 10,
      maxTextLength: 500,
      requiresLogo: true,
      requiresBrandColors: true,
      isActive: true
    });

    console.log('✅ Content criteria created');

    // Create policies
    const [policy] = await db.insert(policies).values({
      userId: testUser.id,
      name: 'Política de Compliance Padrão',
      description: 'Política principal para validação de criativos',
      rules: JSON.stringify({
        brandCompliance: true,
        contentValidation: true,
        performanceMonitoring: true
      }),
      performanceThresholds: JSON.stringify({
        minCTR: 1.0,
        maxCPC: 5.0,
        minConversions: 5
      }),
      status: 'active',
      isDefault: true
    }).returning();

    console.log('✅ Policies created');

    // Create sample audits
    const auditStatuses = ['compliant', 'non_compliant', 'low_performance', 'needs_review'];
    const auditIds = [];
    
    for (const creativeId of creativeIds.slice(0, 15)) {
      const status = auditStatuses[Math.floor(Math.random() * auditStatuses.length)];
      const [audit] = await db.insert(audits).values({
        userId: testUser.id,
        creativeId,
        policyId: policy.id,
        status,
        complianceScore: (Math.random() * 9.99).toFixed(2),
        performanceScore: (Math.random() * 9.99).toFixed(2),
        issues: JSON.stringify(status === 'compliant' ? [] : ['Logo não identificado', 'Cores fora do padrão']),
        recommendations: JSON.stringify(['Ajustar cores da marca', 'Incluir logo oficial']),
        aiAnalysis: JSON.stringify({
          hasLogo: Math.random() > 0.5,
          brandColors: Math.random() > 0.3,
          textCompliant: Math.random() > 0.4,
          overallScore: Math.floor(Math.random() * 100)
        })
      }).returning();
      auditIds.push(audit.id);
    }

    console.log('✅ Audits created');

    // Create sample audit actions
    for (const auditId of auditIds.slice(0, 8)) {
      await db.insert(auditActions).values({
        userId: testUser.id,
        auditId,
        action: Math.random() > 0.5 ? 'pause' : 'flag_review',
        status: Math.random() > 0.3 ? 'executed' : 'pending',
        executedAt: Math.random() > 0.5 ? new Date() : null
      });
    }

    console.log('✅ Audit actions created');

    // Create campaign metrics (Google Sheets data)
    const accountNames = ['Click Auditor Demo', 'Conta Principal', 'Campanhas Meta'];
    const campaignNames = campaignList.map(c => c.name);
    
    for (let i = 0; i < 50; i++) {
      const randomDate = new Date();
      randomDate.setDate(randomDate.getDate() - Math.floor(Math.random() * 30));
      
      await db.insert(campaignMetrics).values({
        userId: testUser.id,
        data: randomDate,
        nomeAconta: accountNames[Math.floor(Math.random() * accountNames.length)],
        adUrl: Math.random() > 0.3 ? `https://demo-ad-url-${i}.com` : null,
        campanha: campaignNames[Math.floor(Math.random() * campaignNames.length)],
        grupoAnuncios: `Grupo de Anúncios ${i + 1}`,
        anuncios: `Anúncio Demo ${i + 1}`,
        impressoes: Math.floor(Math.random() * 10000) + 1000,
        cliques: Math.floor(Math.random() * 500) + 50,
        cpm: (Math.random() * 15 + 5).toFixed(2),
        cpc: (Math.random() * 4 + 1).toFixed(2),
        conversasIniciadas: Math.floor(Math.random() * 100) + 10,
        custoConversa: (Math.random() * 12 + 3).toFixed(2),
        investimento: (Math.random() * 800 + 200).toFixed(2),
        source: 'google_sheets',
        status: 'imported',
        syncBatch: 'seed_batch_001'
      });
    }

    console.log('✅ Campaign metrics created');
    console.log('🎉 Database seeding completed successfully!');
    console.log(`📊 Production demo data created for: ${testUser.email}`);
    
    return true;
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}