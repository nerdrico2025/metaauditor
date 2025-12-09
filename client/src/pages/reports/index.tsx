import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Download, Search, BarChart3, AlertTriangle, Filter, Loader2, TrendingUp, TrendingDown, Target, Image } from "lucide-react";

interface ConsolidatedMetrics {
  campaigns: { total: number; active: number; inactive: number };
  adSets: { total: number };
  creatives: { total: number; analyzed: number; pending: number };
  audits: { total: number; compliant: number; nonCompliant: number; pending: number; avgComplianceScore: string };
}

interface RejectionReason {
  category: string;
  count: number;
  uniqueCreatives: number;
  examples: string[];
}

interface RejectionReport {
  totalNonCompliant: number;
  reasons: RejectionReason[];
}

interface KeywordResult {
  keyword: string;
  totalMatches: number;
  creatives: Array<{
    id: string;
    name: string;
    type: string;
    platform: string;
    thumbnailUrl?: string;
    audit?: {
      status: string;
      complianceScore: string;
      matchedIssues: string[];
    };
  }>;
}

export default function Reports() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [keywordSearch, setKeywordSearch] = useState("");
  const [searchedKeyword, setSearchedKeyword] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const { data: consolidatedMetrics, isLoading: metricsLoading } = useQuery<ConsolidatedMetrics>({
    queryKey: ['/api/reports/consolidated-metrics'],
    enabled: isAuthenticated,
  });

  const { data: rejectionReport, isLoading: rejectionLoading } = useQuery<RejectionReport>({
    queryKey: ['/api/reports/rejection-reasons'],
    enabled: isAuthenticated,
  });

  const { data: keywordResults, isLoading: keywordLoading, refetch: refetchKeyword } = useQuery<KeywordResult>({
    queryKey: ['/api/reports/by-keyword', searchedKeyword],
    enabled: isAuthenticated && searchedKeyword.length > 0,
  });

  const handleKeywordSearch = () => {
    if (keywordSearch.trim()) {
      setSearchedKeyword(keywordSearch.trim());
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/reports/export?format=${format}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Erro ao exportar');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `click-auditor-report.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: 'Relatório exportado',
        description: `Arquivo ${format.toUpperCase()} baixado com sucesso.`,
      });
    } catch (error) {
      toast({
        title: 'Erro na exportação',
        description: 'Não foi possível exportar o relatório.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Relatórios" />
        
        <main className="flex-1 overflow-y-auto">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <Tabs defaultValue="consolidated" className="space-y-6">
                <TabsList className="grid w-full grid-cols-3" data-testid="reports-tabs">
                  <TabsTrigger value="consolidated" data-testid="tab-consolidated">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Métricas Consolidadas
                  </TabsTrigger>
                  <TabsTrigger value="rejections" data-testid="tab-rejections">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Motivos de Reprovação
                  </TabsTrigger>
                  <TabsTrigger value="keywords" data-testid="tab-keywords">
                    <Filter className="h-4 w-4 mr-2" />
                    Filtrar por Palavra-chave
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="consolidated" className="space-y-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center">
                          <BarChart3 className="h-6 w-6 mr-2 text-primary" />
                          Métricas Consolidadas
                        </CardTitle>
                        <CardDescription>
                          Visão geral de todas as campanhas, anúncios e auditorias
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExport('csv')}
                          disabled={isExporting}
                          data-testid="button-export-csv"
                        >
                          {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                          CSV
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExport('json')}
                          disabled={isExporting}
                          data-testid="button-export-json"
                        >
                          {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                          JSON
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {metricsLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                      ) : consolidatedMetrics ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200">
                            <CardContent className="pt-6">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Campanhas</p>
                                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{consolidatedMetrics.campaigns.total}</p>
                                </div>
                                <Target className="h-8 w-8 text-blue-500" />
                              </div>
                              <div className="mt-2 flex gap-2 text-xs">
                                <Badge variant="secondary" className="bg-green-100 text-green-700">
                                  {consolidatedMetrics.campaigns.active} ativas
                                </Badge>
                                <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                                  {consolidatedMetrics.campaigns.inactive} inativas
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="bg-purple-50 dark:bg-purple-950 border-purple-200">
                            <CardContent className="pt-6">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Anúncios</p>
                                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{consolidatedMetrics.creatives.total}</p>
                                </div>
                                <Image className="h-8 w-8 text-purple-500" />
                              </div>
                              <div className="mt-2 flex gap-2 text-xs">
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                                  {consolidatedMetrics.creatives.analyzed} analisados
                                </Badge>
                                <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                                  {consolidatedMetrics.creatives.pending} pendentes
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="bg-green-50 dark:bg-green-950 border-green-200">
                            <CardContent className="pt-6">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-green-600 dark:text-green-400">Conformes</p>
                                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">{consolidatedMetrics.audits.compliant}</p>
                                </div>
                                <TrendingUp className="h-8 w-8 text-green-500" />
                              </div>
                              <div className="mt-2 text-xs text-green-700 dark:text-green-400">
                                {consolidatedMetrics.audits.total > 0 
                                  ? `${((consolidatedMetrics.audits.compliant / consolidatedMetrics.audits.total) * 100).toFixed(1)}% do total`
                                  : 'Nenhuma auditoria'}
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="bg-red-50 dark:bg-red-950 border-red-200">
                            <CardContent className="pt-6">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-red-600 dark:text-red-400">Não Conformes</p>
                                  <p className="text-2xl font-bold text-red-900 dark:text-red-100">{consolidatedMetrics.audits.nonCompliant}</p>
                                </div>
                                <TrendingDown className="h-8 w-8 text-red-500" />
                              </div>
                              <div className="mt-2 text-xs text-red-700 dark:text-red-400">
                                {consolidatedMetrics.audits.total > 0 
                                  ? `${((consolidatedMetrics.audits.nonCompliant / consolidatedMetrics.audits.total) * 100).toFixed(1)}% do total`
                                  : 'Nenhuma auditoria'}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      ) : (
                        <p className="text-center text-slate-500 py-8">Nenhum dado disponível</p>
                      )}

                      {consolidatedMetrics && (
                        <Card className="mt-6 bg-slate-50 dark:bg-slate-800">
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Score Médio de Conformidade</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Média de todas as auditorias realizadas</p>
                              </div>
                              <div className="text-4xl font-bold text-primary">
                                {consolidatedMetrics.audits.avgComplianceScore}%
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="rejections" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <AlertTriangle className="h-6 w-6 mr-2 text-yellow-500" />
                        Principais Motivos de Reprovação
                      </CardTitle>
                      <CardDescription>
                        Análise consolidada dos motivos mais frequentes de não conformidade
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {rejectionLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                      ) : rejectionReport && rejectionReport.reasons.length > 0 ? (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                            <span className="font-medium text-red-700 dark:text-red-400">
                              Total de anúncios não conformes:
                            </span>
                            <Badge variant="destructive" className="text-lg px-4 py-1">
                              {rejectionReport.totalNonCompliant}
                            </Badge>
                          </div>

                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Categoria</TableHead>
                                <TableHead className="text-center">Ocorrências</TableHead>
                                <TableHead className="text-center">Anúncios Afetados</TableHead>
                                <TableHead>Exemplos</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {rejectionReport.reasons.map((reason, index) => (
                                <TableRow key={index} data-testid={`rejection-row-${index}`}>
                                  <TableCell className="font-medium">
                                    <Badge variant="outline" className="text-sm">
                                      {reason.category}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className="font-bold text-red-600">{reason.count}</span>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {reason.uniqueCreatives}
                                  </TableCell>
                                  <TableCell className="max-w-md">
                                    <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400">
                                      {reason.examples.slice(0, 2).map((example, i) => (
                                        <li key={i} className="truncate">{example}</li>
                                      ))}
                                    </ul>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <AlertTriangle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                            Nenhuma reprovação encontrada
                          </h3>
                          <p className="text-slate-600 dark:text-slate-400">
                            Todos os anúncios analisados estão em conformidade ou ainda não foram auditados.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="keywords" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Filter className="h-6 w-6 mr-2 text-primary" />
                        Filtrar Reprovações por Palavra-chave
                      </CardTitle>
                      <CardDescription>
                        Busque anúncios reprovados por termos específicos das políticas
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2 mb-6">
                        <Input
                          placeholder="Ex: grátis, bairro, promoção..."
                          value={keywordSearch}
                          onChange={(e) => setKeywordSearch(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleKeywordSearch()}
                          className="max-w-md"
                          data-testid="input-keyword-search"
                        />
                        <Button onClick={handleKeywordSearch} disabled={keywordLoading} data-testid="button-search-keyword">
                          {keywordLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                          Buscar
                        </Button>
                      </div>

                      {keywordLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                      ) : keywordResults && searchedKeyword ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                            <span className="font-medium text-blue-700 dark:text-blue-400">
                              Resultados para "{keywordResults.keyword}":
                            </span>
                            <Badge variant="secondary" className="text-lg px-4 py-1">
                              {keywordResults.totalMatches} anúncios
                            </Badge>
                          </div>

                          {keywordResults.creatives.length > 0 ? (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Anúncio</TableHead>
                                  <TableHead>Plataforma</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Problemas Encontrados</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {keywordResults.creatives.map((creative) => (
                                  <TableRow key={creative.id} data-testid={`keyword-result-${creative.id}`}>
                                    <TableCell>
                                      <div className="flex items-center gap-3">
                                        {creative.thumbnailUrl && (
                                          <img 
                                            src={creative.thumbnailUrl} 
                                            alt={creative.name}
                                            className="w-12 h-12 object-cover rounded"
                                          />
                                        )}
                                        <div>
                                          <p className="font-medium">{creative.name}</p>
                                          <p className="text-xs text-slate-500">{creative.type}</p>
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline">{creative.platform}</Badge>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant={creative.audit?.status === 'conforme' ? 'default' : 'destructive'}>
                                        {creative.audit?.status || 'Não analisado'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-md">
                                      <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400">
                                        {creative.audit?.matchedIssues?.slice(0, 3).map((issue, i) => (
                                          <li key={i} className="truncate">{issue}</li>
                                        ))}
                                      </ul>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          ) : (
                            <div className="text-center py-8 text-slate-500">
                              Nenhum anúncio encontrado com essa palavra-chave.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <Search className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                            Pesquise por Palavra-chave
                          </h3>
                          <p className="text-slate-600 dark:text-slate-400">
                            Digite uma palavra-chave para encontrar anúncios reprovados por esse termo específico.
                          </p>
                          <p className="text-sm text-slate-500 mt-2">
                            Exemplos: "grátis", "bairro", "promoção", "desconto"
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
