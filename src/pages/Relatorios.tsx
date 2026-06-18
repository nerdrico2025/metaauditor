import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase, supabaseUrl } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    FileText,
    Download,
    Loader2,
    Calendar,
    BarChart3,
    Megaphone,
    Image,
    FileCheck,
    ExternalLink,
    Clock
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Report {
    id: string;
    report_type: string;
    date_from: string;
    date_to: string;
    created_at: string;
}

const REPORT_TYPES = [
    { value: 'performance', label: 'Performance Geral', icon: BarChart3 },
    { value: 'campaigns', label: 'Campanhas', icon: Megaphone },
    { value: 'creatives', label: 'Criativos', icon: Image },
    { value: 'audits', label: 'Auditorias', icon: FileCheck },
];

export default function Relatorios() {
    const { user } = useAuth();
    const companyId = user?.company?.id;
    const [reportType, setReportType] = useState<string>('performance');
    const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));

    // Fetch report history
    const { data: reports = [], isLoading } = useQuery({
        queryKey: ['reports', companyId],
        queryFn: async () => {
            if (!companyId) throw new Error('No company ID');
            const { data, error } = await supabase
                .from('reports')
                .select('id, report_type, date_from, date_to, created_at')
                .eq('company_id', companyId)
                .order('created_at', { ascending: false })
                .limit(20);
            if (error) throw error;
            return data as Report[];
        },
        enabled: !!companyId,
    });

    const generateReport = useMutation({
        mutationFn: async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No session');

            const response = await fetch(
                `${supabaseUrl}/functions/v1/generate-report`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        report_type: reportType,
                        date_from: dateFrom,
                        date_to: dateTo,
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Report generation failed');
            }

            const html = await response.text();
            return html;
        },
        onSuccess: (html) => {
            // Open report in new window
            const win = window.open('', '_blank');
            if (win) {
                win.document.write(html);
                win.document.close();
            }
            toast.success('Relatório gerado com sucesso');
        },
        onError: (error) => {
            toast.error(`Erro ao gerar relatório: ${error.message}`);
        },
    });

    const getReportTypeLabel = (type: string) => {
        return REPORT_TYPES.find(t => t.value === type)?.label || type;
    };

    const getReportIcon = (type: string) => {
        const Icon = REPORT_TYPES.find(t => t.value === type)?.icon || FileText;
        return <Icon className="w-4 h-4" />;
    };

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-foreground mb-2">Relatórios</h1>
                <p className="text-muted-foreground">
                    Gere relatórios detalhados de performance, campanhas, criativos e auditorias.
                </p>
            </div>

            {/* Report Generator */}
            <div className="glass rounded-xl p-6 mb-8">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-ch-orange" />
                    Gerar Novo Relatório
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                        <Label>Tipo de Relatório</Label>
                        <Select value={reportType} onValueChange={setReportType}>
                            <SelectTrigger className="bg-muted border-border">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {REPORT_TYPES.map(t => (
                                    <SelectItem key={t.value} value={t.value}>
                                        <div className="flex items-center gap-2">
                                            <t.icon className="w-4 h-4" />
                                            {t.label}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Data Início</Label>
                        <Input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="bg-muted border-border"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Data Fim</Label>
                        <Input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="bg-muted border-border"
                        />
                    </div>

                    <div className="flex items-end">
                        <Button
                            onClick={() => generateReport.mutate()}
                            disabled={generateReport.isPending}
                            className="w-full bg-ch-orange hover:bg-ch-orange/90"
                        >
                            {generateReport.isPending ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4 mr-2" />
                            )}
                            Gerar Relatório
                        </Button>
                    </div>
                </div>
            </div>

            {/* Report History */}
            <div className="glass rounded-xl p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-ch-orange" />
                    Histórico de Relatórios
                </h2>

                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-ch-orange" />
                    </div>
                ) : reports.length > 0 ? (
                    <div className="space-y-2">
                        {reports.map((report) => (
                            <div
                                key={report.id}
                                className="bg-muted rounded-lg p-4 flex items-center gap-4"
                            >
                                <div className="p-2 bg-ch-gray rounded-lg text-ch-orange">
                                    {getReportIcon(report.report_type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-foreground">
                                        {getReportTypeLabel(report.report_type)}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {format(new Date(report.date_from), 'dd/MM/yyyy', { locale: ptBR })} -{' '}
                                        {format(new Date(report.date_to), 'dd/MM/yyyy', { locale: ptBR })}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-muted-foreground">
                                        {format(new Date(report.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">Nenhum relatório gerado ainda.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
