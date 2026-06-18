export interface CampaignStepData {
    name: string;
    objective: string;
    status: 'ACTIVE' | 'PAUSED';
    special_ad_categories: string[];
}

export interface AdSetStepData {
    name: string;
    billing_event: 'IMPRESSIONS' | 'LINK_CLICKS' | 'CTR';
    optimization_goal: 'REACH' | 'IMPRESSIONS' | 'LINK_CLICKS';
    daily_budget?: number;
    lifetime_budget?: number;
    start_time: string;
    end_time?: string;
    targeting: {
        geo_locations: {
            countries: string[];
        };
        age_min: number;
        age_max: number;
        genders: number[]; // 1=Male, 2=Female, 0=All (Meta uses [1], [2] or empty for all)
        interests?: { id: string; name: string }[];
    }
}

export interface AdStepData {
    name: string;
    creative: {
        title: string;
        body: string;
        image_url?: string;
        image_hash?: string;
        link_url: string;
        call_to_action: 'LEARN_MORE' | 'SHOP_NOW' | 'SIGN_UP' | 'CONTACT_US' | 'APPLY_NOW' | 'BOOK_NOW';
        page_id: string;
        instagram_actor_id?: string;
    }
}

export interface CampaignWizardState {
    integration_id: string;
    campaign: CampaignStepData;
    adset: AdSetStepData;
    ad: AdStepData;
}

export const defaultWizardState: CampaignWizardState = {
    integration_id: '',
    campaign: {
        name: 'Nova Campanha - ' + new Date().toLocaleDateString(),
        objective: 'OUTCOME_TRAFFIC',
        status: 'PAUSED',
        special_ad_categories: []
    },
    adset: {
        name: 'Novo Conjunto de Anúncios',
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'LINK_CLICKS',
        daily_budget: 2000, // 20.00 BRL
        start_time: new Date().toISOString(),
        targeting: {
            geo_locations: { countries: ['BR'] },
            age_min: 18,
            age_max: 65,
            genders: [], // All
        }
    },
    ad: {
        name: 'Novo Anúncio',
        creative: {
            title: 'Título do Anúncio',
            body: 'Texto principal do seu anúncio aqui.',
            image_url: 'https://placehold.co/1080x1080/png?text=Anuncio+Exemplo',
            link_url: 'https://seunegocio.com.br',
            call_to_action: 'LEARN_MORE',
            page_id: '',
        }
    }
};
