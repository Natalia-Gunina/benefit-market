"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PopularTableProps {
  data: Array<{
    name: string;
    category: string;
    order_count: number;
    total_points: number;
    unique_users: number;
  }>;
  title?: string;
}

export function PopularTable({ data, title = "Топ-10 популярных льгот" }: PopularTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">#</th>
                <th className="pb-2 pr-4 font-medium">Льгота</th>
                <th className="pb-2 pr-4 font-medium">Категория</th>
                <th className="pb-2 pr-4 text-right font-medium">Заказов</th>
                <th className="pb-2 pr-4 text-right font-medium">Баллов</th>
                <th className="pb-2 text-right font-medium">Уник. польз.</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, i) => (
                <tr key={item.name} className="border-b last:border-0">
                  <td className="py-2.5 pr-4 tabular-nums text-muted-foreground">{i + 1}</td>
                  <td className="py-2.5 pr-4 font-medium">{item.name}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{item.category}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{item.order_count}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    {item.total_points.toLocaleString("ru-RU")}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{item.unique_users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
