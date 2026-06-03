import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/utils";

interface TopPerformersProps {
    data: Array<{
        id: string;
        name: string;
        spend: number;
        conversions: number;
    }>;
}

export function TopPerformers({ data }: TopPerformersProps) {
    const navigate = useNavigate();

    return (
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm flex flex-col h-full">
            <div className="p-6 flex flex-col space-y-1.5 border-b">
                <h3 className="font-semibold text-lg leading-none tracking-tight">Top Campanhas</h3>
                <p className="text-sm text-muted-foreground">Melhores campanhas baseadas em investimento.</p>
            </div>
            <div className="p-0 flex-1 overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[45%]">Campanha</TableHead>
                            <TableHead className="text-right">Investimento</TableHead>
                            <TableHead className="text-right">Resultado</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
                                    Nenhuma campanha encontrada.
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((campaign) => (
                                <TableRow
                                    key={campaign.id}
                                    className="hover:bg-muted/50 cursor-pointer group transition-colors"
                                    onClick={() => navigate(`/campanhas/${campaign.id}`)}
                                >
                                    <TableCell className="font-medium truncate max-w-[400px] py-4 group-hover:text-ch-orange transition-colors" title={campaign.name}>
                                        {campaign.name}
                                    </TableCell>
                                    <TableCell className="text-right font-medium py-4">
                                        {formatCurrency(campaign.spend)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums font-semibold py-4">
                                        {campaign.conversions}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
