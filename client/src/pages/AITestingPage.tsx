import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertTriangle, Loader2, Zap, Database, Play } from "lucide-react";

export default function AITestingPage() {
  const { toast } = useToast();
  const [testResults, setTestResults] = useState<any>(null);
  const [analysisResults, setAnalysisResults] = useState<any[]>([]);

  const createSampleDataMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/test/populate-sample-data");
    },
    onSuccess: (data) => {
      toast({
        title: "Dados de Teste Criados",
        description: "Dados de exemplo foram criados com sucesso",
      });
      setTestResults(data);
    },
    onError: (error) => {
      console.error("Erro ao criar dados de teste:", error);
      toast({
        title: "Erro",
        description: "Falha ao criar dados de teste",
        variant: "destructive",
      });
    },
  });

  const analyzeCreativeMutation = useMutation({
    mutationFn: async (creativeId: string) => {
      return await apiRequest("POST", `/api/creatives/${creativeId}/analyze`);
    },
    onSuccess: (data, creativeId) => {
      toast({
        title: "Análise Concluída",
        description: "A análise de IA foi concluída com sucesso",
      });
      setAnalysisResults(prev => [...prev, { creativeId, result: data }]);
    },
    onError: (error) => {
      console.error("Erro na análise:", error);
      toast({
        title: "Erro na Análise",
        description: "Falha ao analisar criativo com IA",
        variant: "destructive",
      });
    },
  });

  const handleAnalyzeAll = async () => {
    if (!testResults?.creatives) return;
    
    setAnalysisResults([]);
    for (const creative of testResults.creatives) {
      await analyzeCreativeMutation.mutateAsync(creative.id);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'compliant':
        return <Badge className="bg-green-100 text-green-800">Conforme</Badge>;
      case 'non_compliant':
        return <Badge className="bg-red-100 text-red-800">Não Conforme</Badge>;
      case 'low_performance':
        return <Badge className="bg-amber-100 text-amber-800">Baixa Performance</Badge>;
      default:
        return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Teste de Análise IA" />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Introduction */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-600" />
                  Teste da Análise de IA
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 mb-4">
                  Esta página permite testar a funcionalidade de análise de IA do Click Auditor. 
                  Siga os passos abaixo para ver como a IA analisa criativos para conformidade e performance.
                </p>
                
                {/* Steps */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">1</div>
                    <div>
                      <h4 className="font-medium text-slate-900">Criar Dados de Teste</h4>
                      <p className="text-sm text-slate-600">Gera campanhas e criativos de exemplo</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-4 bg-green-50 rounded-lg">
                    <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-medium">2</div>
                    <div>
                      <h4 className="font-medium text-slate-900">Executar Análise IA</h4>
                      <p className="text-sm text-slate-600">Analisa criativos com OpenAI GPT-4o</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-4 bg-purple-50 rounded-lg">
                    <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-medium">3</div>
                    <div>
                      <h4 className="font-medium text-slate-900">Ver Resultados</h4>
                      <p className="text-sm text-slate-600">Visualiza scores e recomendações</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 1: Create Sample Data */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Passo 1: Criar Dados de Teste
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 mb-4">
                  Clique no botão abaixo para criar campanhas e criativos de exemplo. Isso incluirá:
                </p>
                <ul className="list-disc list-inside text-sm text-slate-600 mb-4 space-y-1">
                  <li>1 política de conformidade padrão</li>
                  <li>2 campanhas (Meta e Google Ads)</li>
                  <li>3 criativos com diferentes características (bom, problemático, baixa performance)</li>
                </ul>
                
                <Button 
                  onClick={() => createSampleDataMutation.mutate()}
                  disabled={createSampleDataMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {createSampleDataMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Criando Dados...
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4 mr-2" />
                      Criar Dados de Teste
                    </>
                  )}
                </Button>

                {testResults && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-800">Dados criados com sucesso!</span>
                    </div>
                    <div className="text-sm text-green-700">
                      Criados: {testResults.campaigns?.length || 0} campanhas, {testResults.creatives?.length || 0} criativos
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 2: Run AI Analysis */}
            {testResults && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Play className="h-5 w-5" />
                    Passo 2: Executar Análise de IA
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 mb-4">
                    Agora execute a análise de IA nos criativos criados. A IA analisará:
                  </p>
                  <ul className="list-disc list-inside text-sm text-slate-600 mb-4 space-y-1">
                    <li>Conformidade com políticas de marca</li>
                    <li>Qualidade do texto e linguagem profissional</li>
                    <li>Performance baseada em métricas (CTR, CPC, conversões)</li>
                    <li>Recomendações de melhoria</li>
                  </ul>
                  
                  <Button 
                    onClick={handleAnalyzeAll}
                    disabled={analyzeCreativeMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {analyzeCreativeMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Analisando...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        Analisar Todos os Criativos
                      </>
                    )}
                  </Button>

                  {analyzeCreativeMutation.isPending && (
                    <div className="mt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-slate-600">Executando análise de IA...</span>
                      </div>
                      <Progress value={33} className="h-2" />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 3: Results */}
            {analysisResults.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Passo 3: Resultados da Análise IA
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analysisResults.map((analysis, index) => {
                      const creative = testResults.creatives.find((c: any) => c.id === analysis.creativeId);
                      const result = analysis.result;
                      
                      return (
                        <div key={index} className="border border-slate-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-medium text-slate-900">{creative?.name}</h4>
                              <p className="text-sm text-slate-600 capitalize">{creative?.type} • {creative?.platform}</p>
                            </div>
                            {getStatusBadge(result.status)}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <span className="text-sm font-medium text-slate-700">Score de Conformidade:</span>
                              <div className="flex items-center gap-2 mt-1">
                                <Progress value={parseFloat(result.complianceScore)} className="flex-1 h-2" />
                                <span className="text-sm text-slate-600">{result.complianceScore}/100</span>
                              </div>
                            </div>
                            <div>
                              <span className="text-sm font-medium text-slate-700">Score de Performance:</span>
                              <div className="flex items-center gap-2 mt-1">
                                <Progress value={parseFloat(result.performanceScore)} className="flex-1 h-2" />
                                <span className="text-sm text-slate-600">{result.performanceScore}/100</span>
                              </div>
                            </div>
                          </div>
                          
                          {result.issues && result.issues.length > 0 && (
                            <div className="mb-3">
                              <span className="text-sm font-medium text-red-700">Problemas Identificados:</span>
                              <ul className="list-disc list-inside text-sm text-red-600 mt-1">
                                {result.issues.slice(0, 3).map((issue: string, i: number) => (
                                  <li key={i}>{issue}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {result.recommendations && result.recommendations.length > 0 && (
                            <div>
                              <span className="text-sm font-medium text-green-700">Recomendações:</span>
                              <ul className="list-disc list-inside text-sm text-green-600 mt-1">
                                {result.recommendations.slice(0, 3).map((rec: string, i: number) => (
                                  <li key={i}>{rec}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium text-blue-800 mb-2">🎉 Teste Concluído!</h4>
                    <p className="text-sm text-blue-700">
                      A análise de IA foi executada com sucesso. Agora você pode:
                    </p>
                    <ul className="list-disc list-inside text-sm text-blue-700 mt-2 space-y-1">
                      <li>Ver os resultados no Dashboard principal</li>
                      <li>Ir para a página de Criativos para mais detalhes</li>
                      <li>Configurar novas políticas na página de Políticas</li>
                      <li>Verificar o histórico na página de Histórico</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}